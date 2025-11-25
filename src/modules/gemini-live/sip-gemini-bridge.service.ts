import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiLiveService, GeminiLiveConfig } from './gemini-live.service';
import { EventEmitter } from 'events';
import * as transform from 'stream';

export interface BridgeConfig extends GeminiLiveConfig {
  sipCallId: string;
  phoneNumber: string;
  direction: 'inbound' | 'outbound';
}

/**
 * Bridge between SIP media stream and Gemini Live API
 * Handles audio format conversion and bidirectional streaming
 */
@Injectable()
export class SipGeminiBridge extends EventEmitter {
  private readonly logger = new Logger(SipGeminiBridge.name);
  private geminiService: GeminiLiveService | null = null;
  private sipEndpoint: any = null;
  private isActive: boolean = false;
  private audioBuffer: Buffer[] = [];
  private recordingBuffer: Buffer[] = [];
  private conversationStartTime: Date | null = null;
  private transcriptSegments: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
  }> = [];

  constructor(private configService: ConfigService) {
    super();
  }

  /**
   * Start the bridge between SIP and Gemini Live
   */
  async start(sipEndpoint: any, config: BridgeConfig): Promise<void> {
    try {
      this.logger.log(`Starting SIP-Gemini bridge for call ${config.sipCallId}`);
      this.sipEndpoint = sipEndpoint;
      this.conversationStartTime = new Date();
      this.isActive = true;

      // Create new Gemini Live service instance
      this.geminiService = new GeminiLiveService(this.configService);

      // Set up Gemini Live event handlers
      this.setupGeminiHandlers();

      // Connect to Gemini Live
      await this.geminiService.connect(config);

      // Set up SIP audio handlers
      this.setupSipHandlers();

      this.emit('bridgeStarted', {
        callId: config.sipCallId,
        phoneNumber: config.phoneNumber,
      });

    } catch (error) {
      this.logger.error('Failed to start bridge:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Set up handlers for Gemini Live events
   */
  private setupGeminiHandlers(): void {
    if (!this.geminiService) return;

    // Handle audio from Gemini (to be sent to SIP)
    this.geminiService.on('audio', async (audioData: any) => {
      try {
        // Convert audio format if needed (Gemini uses PCM, SIP might use different codec)
        const convertedAudio = await this.convertAudioForSip(audioData.data);

        // Send to SIP endpoint
        if (this.sipEndpoint && this.isActive) {
          this.sipEndpoint.write(convertedAudio);

          // Store for recording
          this.recordingBuffer.push(convertedAudio);
        }
      } catch (error) {
        this.logger.error('Failed to send audio to SIP:', error);
      }
    });

    // Handle transcripts
    this.geminiService.on('transcript', (transcript: any) => {
      this.transcriptSegments.push({
        role: transcript.role || 'assistant',
        text: transcript.text,
        timestamp: transcript.timestamp,
      });

      this.emit('transcript', transcript);
      this.logger.debug(`Assistant: ${transcript.text}`);
    });

    // Handle turn completion
    this.geminiService.on('turnComplete', (data: any) => {
      this.emit('turnComplete', data);
    });

    // Handle interruptions
    this.geminiService.on('interrupted', () => {
      this.logger.log('User interrupted the assistant');
      this.emit('interrupted');
    });

    // Handle tool calls
    this.geminiService.on('toolCall', (toolCall: any) => {
      this.logger.log(`Tool call requested: ${JSON.stringify(toolCall)}`);
      this.emit('toolCall', toolCall);
    });

    // Handle errors
    this.geminiService.on('error', (error: any) => {
      this.logger.error('Gemini Live error:', error);
      this.emit('error', error);
    });

    // Handle disconnection
    this.geminiService.on('disconnected', () => {
      this.logger.log('Gemini Live disconnected');
      this.stop();
    });
  }

  /**
   * Set up handlers for SIP audio stream
   */
  private setupSipHandlers(): void {
    if (!this.sipEndpoint) return;

    // Create a transform stream to handle incoming audio
    const audioProcessor = new transform.Transform({
      transform: async (chunk: Buffer, encoding: string, callback: transform.TransformCallback) => {
        try {
          if (this.isActive && this.geminiService) {
            // Buffer audio chunks to send in larger segments
            this.audioBuffer.push(chunk);

            // Send to Gemini when we have enough data (e.g., 100ms of audio)
            if (this.audioBuffer.length >= 10) {
              const audioData = Buffer.concat(this.audioBuffer);
              this.audioBuffer = [];

              // Convert audio format for Gemini (SIP codec to PCM)
              const pcmAudio = await this.convertAudioForGemini(audioData);

              // Send to Gemini Live
              await this.geminiService.sendAudio(pcmAudio);

              // Store for recording
              this.recordingBuffer.push(audioData);
            }
          }
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });

    // Pipe SIP audio through processor
    this.sipEndpoint.pipe(audioProcessor);

    // Handle SIP endpoint events
    this.sipEndpoint.on('end', () => {
      this.logger.log('SIP endpoint ended');
      this.stop();
    });

    this.sipEndpoint.on('error', (error: any) => {
      this.logger.error('SIP endpoint error:', error);
      this.emit('error', error);
      this.stop();
    });
  }

  /**
   * Convert audio from SIP codec to PCM for Gemini
   * SIP typically uses G.711 (PCMU/PCMA) or G.722
   */
  private async convertAudioForGemini(audioData: Buffer): Promise<Buffer> {
    // For now, assume SIP is sending PCMU (G.711 μ-law)
    // In production, detect codec from SDP and convert accordingly

    // G.711 μ-law to Linear PCM conversion
    const pcmBuffer = Buffer.alloc(audioData.length * 2); // PCM is 16-bit

    for (let i = 0; i < audioData.length; i++) {
      const sample = this.mulawToPcm(audioData[i]);
      pcmBuffer.writeInt16LE(sample, i * 2);
    }

    return pcmBuffer;
  }

  /**
   * Convert audio from Gemini PCM to SIP codec
   */
  private async convertAudioForSip(pcmData: Buffer): Promise<Buffer> {
    // Convert Linear PCM to G.711 μ-law for SIP
    const mulawBuffer = Buffer.alloc(pcmData.length / 2);

    for (let i = 0; i < pcmData.length; i += 2) {
      const sample = pcmData.readInt16LE(i);
      mulawBuffer[i / 2] = this.pcmToMulaw(sample);
    }

    return mulawBuffer;
  }

  /**
   * μ-law to PCM conversion
   */
  private mulawToPcm(mulaw: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;

    mulaw = ~mulaw;
    const sign = mulaw & 0x80;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0F;

    let sample = (mantissa << 3) + BIAS;
    sample = sample << exponent;

    return sign ? -sample : sample;
  }

  /**
   * PCM to μ-law conversion
   */
  private pcmToMulaw(pcm: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;
    const MAX = 0x1FFF;

    let sign = 0;
    if (pcm < 0) {
      sign = 0x80;
      pcm = -pcm;
    }

    if (pcm > CLIP) pcm = CLIP;

    pcm += BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}

    const mantissa = (pcm >> (exponent + 3)) & 0x0F;
    const mulaw = ~(sign | (exponent << 4) | mantissa);

    return mulaw & 0xFF;
  }

  /**
   * Stop the bridge and clean up
   */
  async stop(): Promise<void> {
    if (!this.isActive) return;

    this.logger.log('Stopping SIP-Gemini bridge');
    this.isActive = false;

    // Disconnect from Gemini
    if (this.geminiService) {
      this.geminiService.disconnect();
      this.geminiService.removeAllListeners();
      this.geminiService = null;
    }

    // Close SIP endpoint
    if (this.sipEndpoint) {
      this.sipEndpoint.unpipe();
      this.sipEndpoint.removeAllListeners();
      this.sipEndpoint = null;
    }

    // Emit conversation ended event with data
    const duration = this.conversationStartTime
      ? (Date.now() - this.conversationStartTime.getTime()) / 1000
      : 0;

    this.emit('bridgeEnded', {
      duration,
      transcriptSegments: this.transcriptSegments,
      recordingBuffer: Buffer.concat(this.recordingBuffer),
    });

    // Clear buffers
    this.audioBuffer = [];
    this.recordingBuffer = [];
    this.transcriptSegments = [];
    this.conversationStartTime = null;
  }

  /**
   * Get current conversation data
   */
  getConversationData(): any {
    return {
      isActive: this.isActive,
      duration: this.conversationStartTime
        ? (Date.now() - this.conversationStartTime.getTime()) / 1000
        : 0,
      transcriptCount: this.transcriptSegments.length,
      recordingSize: this.recordingBuffer.reduce((acc, buf) => acc + buf.length, 0),
    };
  }
}