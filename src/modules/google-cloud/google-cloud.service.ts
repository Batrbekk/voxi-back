import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Storage } from '@google-cloud/storage';
import { Readable } from 'stream';
import { SentimentType } from '../../schemas/conversation.schema';
import * as path from 'path';

@Injectable()
export class GoogleCloudService {
  private readonly logger = new Logger(GoogleCloudService.name);
  private speechClient: SpeechClient;
  private ttsClient: TextToSpeechClient;
  private vertexAI: VertexAI;
  private genAI: GoogleGenerativeAI;
  private storage: Storage;
  private bucketName: string;
  private projectId: string;
  private location: string;

  constructor(private configService: ConfigService) {
    // Initialize Google Cloud clients
    const credentials = this.getCredentials();

    this.projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID') || 'lofty-hall-478200-a7';
    this.location = this.configService.get<string>('VERTEX_AI_LOCATION') || 'us-central1';

    this.speechClient = new SpeechClient({ credentials });
    this.ttsClient = new TextToSpeechClient({ credentials });

    // Initialize Vertex AI
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
    });

    // Initialize Google Generative AI (fallback to Vertex AI if no API key)
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(geminiApiKey);
      this.logger.log('Google Generative AI initialized with API key');
    }

    this.storage = new Storage({ credentials });
    const bucketName = this.configService.get<string>('GCS_BUCKET_NAME');
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME is not configured');
    }
    this.bucketName = bucketName;

    this.logger.log(`Google Cloud Service initialized (Project: ${this.projectId}, Location: ${this.location})`);
  }

  /**
   * Get Google Cloud credentials from environment
   */
  private getCredentials() {
    const credentialsPath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

    if (credentialsPath) {
      // Resolve path relative to project root (process.cwd())
      const absolutePath = path.resolve(process.cwd(), credentialsPath);
      return require(absolutePath);
    }

    // Load from environment variable (JSON string)
    const credentialsJson = this.configService.get<string>('GOOGLE_CREDENTIALS_JSON');
    if (credentialsJson) {
      return JSON.parse(credentialsJson);
    }

    throw new Error('Google Cloud credentials not found');
  }

  /**
   * Speech-to-Text: Transcribe audio stream
   */
  async transcribeAudioStream(
    audioStream: Readable,
    languageCode: string = 'ru-RU',
    sampleRate: number = 16000,
  ): Promise<string> {
    const request = {
      config: {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: sampleRate,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
        model: 'default',
      },
      interimResults: false,
    };

    const recognizeStream = this.speechClient
      .streamingRecognize(request)
      .on('error', (error) => {
        this.logger.error('STT stream error:', error);
      });

    audioStream.pipe(recognizeStream);

    let transcript = '';

    for await (const response of recognizeStream) {
      if (response.results && response.results.length > 0) {
        const result = response.results[0];
        if (result.alternatives && result.alternatives.length > 0) {
          transcript += result.alternatives[0].transcript + ' ';
        }
      }
    }

    return transcript.trim();
  }

  /**
   * Speech-to-Text: Transcribe audio buffer
   */
  async transcribeAudioBuffer(
    audioBuffer: Buffer,
    languageCode: string = 'ru-RU',
    sampleRate: number = 16000,
  ): Promise<string> {
    const audio = {
      content: audioBuffer.toString('base64'),
    };

    const config = {
      encoding: 'LINEAR16' as const,
      sampleRateHertz: sampleRate,
      languageCode: languageCode,
      enableAutomaticPunctuation: true,
    };

    const request = {
      audio: audio,
      config: config,
    };

    const [response] = await this.speechClient.recognize(request);

    let transcript = '';
    if (response.results) {
      response.results.forEach((result) => {
        if (result.alternatives && result.alternatives.length > 0) {
          transcript += result.alternatives[0].transcript + ' ';
        }
      });
    }

    return transcript.trim();
  }

  /**
   * Text-to-Speech: Synthesize speech from text
   */
  async synthesizeSpeech(
    text: string,
    voiceName: string = 'ru-RU-Wavenet-A',
    languageCode: string = 'ru-RU',
    speakingRate: number = 1.0,
    pitch: number = 0.0,
  ): Promise<Buffer> {
    const request = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16' as const,
        speakingRate,
        pitch,
      },
    };

    const [response] = await this.ttsClient.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content in TTS response');
    }

    return Buffer.from(response.audioContent);
  }

  /**
   * Vertex AI: Generate AI response
   */
  async generateAIResponse(
    prompt: string,
    systemPrompt?: string,
    modelName: string = 'gemini-2.0-flash-exp',
    temperature: number = 0.7,
    maxTokens: number = 1024,
  ): Promise<string> {
    // Try Vertex AI first (more reliable for production)
    try {
      const generativeModel = this.vertexAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
        systemInstruction: systemPrompt || undefined,
      });

      const result = await generativeModel.generateContent(prompt);
      const response = result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response from Vertex AI');
      }

      const text = response.candidates[0].content.parts[0].text || '';
      return text;
    } catch (vertexError) {
      // Fallback to Google AI if Vertex AI fails
      if (this.genAI) {
        this.logger.warn(`Vertex AI failed, trying Google AI: ${vertexError.message}`);
        try {
          // Map Vertex AI model names to Google AI model names
          let googleAIModelName = modelName;
          if (modelName === 'gemini-pro' || modelName === 'gemini-1.5-pro') {
            googleAIModelName = 'gemini-2.5-pro';
          } else if (modelName === 'gemini-1.5-flash' || modelName === 'gemini-1.5-flash-002') {
            googleAIModelName = 'gemini-2.5-flash';
          } else if (modelName === 'gemini-2.0-flash-exp' || modelName === 'gemini-2.0-flash') {
            googleAIModelName = 'gemini-2.0-flash';
          }

          this.logger.log(`Using Google AI model: ${googleAIModelName}`);

          const model = this.genAI.getGenerativeModel({
            model: googleAIModelName,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
            systemInstruction: systemPrompt || undefined,
          });

          const result = await model.generateContent(prompt);
          const response = result.response;
          return response.text();
        } catch (googleAIError) {
          this.logger.error(`Both Vertex AI and Google AI failed`);
          throw new Error(`AI generation failed: Vertex AI - ${vertexError.message}, Google AI - ${googleAIError.message}`);
        }
      }
      throw vertexError;
    }
  }

  /**
   * Vertex AI: Start streaming conversation
   */
  async *generateAIResponseStream(
    prompt: string,
    systemPrompt?: string,
    modelName: string = 'gemini-1.5-flash-002',
    temperature: number = 0.7,
  ): AsyncGenerator<string> {
    const generativeModel = this.vertexAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature,
      },
      systemInstruction: systemPrompt || undefined,
    });

    const result = await generativeModel.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      if (chunk.candidates && chunk.candidates.length > 0) {
        const text = chunk.candidates[0].content.parts[0].text || '';
        if (text) {
          yield text;
        }
      }
    }
  }

  /**
   * Vertex AI: Analyze conversation for insights
   */
  async analyzeConversation(
    transcript: string,
  ): Promise<{
    summary: string;
    sentiment: SentimentType;
    keyPoints: string[];
    customerIntention: string;
    nextSteps: string[];
  }> {
    const prompt = `Проанализируй следующий разговор и предоставь:
1. Краткое резюме разговора (2-3 предложения)
2. Общий тон разговора (positive/neutral/negative)
3. Ключевые моменты (3-5 пунктов)
4. Намерение клиента
5. Рекомендуемые следующие шаги (2-3 пункта)

Верни результат в формате JSON:
{
  "summary": "...",
  "sentiment": "positive|neutral|negative",
  "keyPoints": ["...", "...", "..."],
  "customerIntention": "...",
  "nextSteps": ["...", "..."]
}

Разговор:
${transcript}`;

    const response = await this.generateAIResponse(
      prompt,
      'Ты опытный аналитик разговоров. Твоя задача - анализировать телефонные разговоры и предоставлять структурированные инсайты.',
      'gemini-1.5-flash-002',
      0.3,
    );

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI analysis response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Map sentiment to enum
    const sentimentMap: Record<string, SentimentType> = {
      'positive': SentimentType.POSITIVE,
      'neutral': SentimentType.NEUTRAL,
      'negative': SentimentType.NEGATIVE,
    };

    analysis.sentiment = sentimentMap[analysis.sentiment.toLowerCase()] || SentimentType.NEUTRAL;

    return analysis;
  }

  /**
   * Cloud Storage: Upload audio file
   */
  async uploadAudioFile(
    audioBuffer: Buffer,
    fileName: string,
    contentType: string = 'audio/webm',
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(`recordings/${fileName}`);

    await file.save(audioBuffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make file publicly accessible (optional, depending on requirements)
    // await file.makePublic();

    // Return signed URL (valid for 7 days)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    this.logger.log(`Audio file uploaded: ${fileName}`);

    return signedUrl;
  }

  /**
   * Cloud Storage: Upload audio stream
   */
  async uploadAudioStream(
    audioStream: Readable,
    fileName: string,
    contentType: string = 'audio/webm',
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(`recordings/${fileName}`);

    const writeStream = file.createWriteStream({
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    return new Promise((resolve, reject) => {
      audioStream
        .pipe(writeStream)
        .on('error', (error) => {
          this.logger.error('Upload stream error:', error);
          reject(error);
        })
        .on('finish', async () => {
          // Return signed URL
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          });

          this.logger.log(`Audio stream uploaded: ${fileName}`);
          resolve(signedUrl);
        });
    });
  }

  /**
   * Cloud Storage: Delete audio file
   */
  async deleteAudioFile(fileName: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(`recordings/${fileName}`);

    await file.delete();

    this.logger.log(`Audio file deleted: ${fileName}`);
  }

  /**
   * Cloud Storage: Get file signed URL
   */
  async getSignedUrl(fileName: string, expiresInDays: number = 7): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(`recordings/${fileName}`);

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    });

    return signedUrl;
  }

  /**
   * List available TTS voices
   */
  async listVoices(languageCode: string = 'ru-RU'): Promise<any[]> {
    const [response] = await this.ttsClient.listVoices({
      languageCode,
    });

    return response.voices || [];
  }
}
