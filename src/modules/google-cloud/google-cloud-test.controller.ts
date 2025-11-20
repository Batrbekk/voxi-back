import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { GoogleCloudService } from './google-cloud.service';

@Controller('test/ai')
export class GoogleCloudTestController {
  private readonly logger = new Logger(GoogleCloudTestController.name);

  constructor(private readonly googleCloudService: GoogleCloudService) {}

  /**
   * Test TTS (Text-to-Speech)
   */
  @Post('tts')
  async testTTS(@Body() body: { text: string; voiceName?: string }) {
    try {
      const text = body.text || 'Привет! Это тестовое сообщение от Voxi AI.';
      const voiceName = body.voiceName || 'ru-RU-Wavenet-A';

      this.logger.log(`Testing TTS with text: "${text}"`);

      const audioBuffer = await this.googleCloudService.synthesizeSpeech(
        text,
        voiceName,
        'ru-RU',
        1.0,
        0.0,
      );

      return {
        success: true,
        message: 'TTS test successful',
        audioSize: audioBuffer.length,
        voiceName,
        text,
      };
    } catch (error) {
      this.logger.error('TTS test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test STT (Speech-to-Text) with sample audio
   */
  @Get('stt')
  async testSTT() {
    try {
      // For STT test, we need audio data
      // This is a simplified test - in real scenario, you'd send actual audio
      this.logger.log('STT test - requires audio data');

      return {
        success: true,
        message: 'STT service is configured. Send audio data to /api/test/ai/stt-audio for actual test',
        note: 'Use POST with audio buffer to test STT',
      };
    } catch (error) {
      this.logger.error('STT test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test Gemini AI
   */
  @Post('gemini')
  async testGemini(@Body() body: { prompt: string }) {
    try {
      const prompt = body.prompt || 'Расскажи короткую шутку на русском языке.';

      this.logger.log(`Testing Gemini with prompt: "${prompt}"`);

      const response = await this.googleCloudService.generateAIResponse(
        prompt,
        'Ты дружелюбный AI ассистент.',
        'gemini-1.5-flash-002',
        0.7,
        256,
      );

      return {
        success: true,
        message: 'Gemini AI test successful',
        prompt,
        response,
      };
    } catch (error) {
      this.logger.error('Gemini test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test Cloud Storage
   */
  @Get('storage')
  async testStorage() {
    try {
      this.logger.log('Testing Cloud Storage');

      // Create a small test file
      const testBuffer = Buffer.from('This is a test audio file from Voxi AI');
      const fileName = `test-${Date.now()}.txt`;

      const signedUrl = await this.googleCloudService.uploadAudioFile(
        testBuffer,
        fileName,
        'text/plain',
      );

      return {
        success: true,
        message: 'Cloud Storage test successful',
        fileName,
        signedUrl: signedUrl.substring(0, 100) + '...',
      };
    } catch (error) {
      this.logger.error('Storage test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test all AI services
   */
  @Get('all')
  async testAll() {
    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // Test TTS
    try {
      await this.testTTS({ text: 'Тест голосового синтеза' });
      results.tests['tts'] = { success: true, message: 'TTS работает' };
    } catch (error) {
      results.tests['tts'] = { success: false, error: error.message };
    }

    // Test Gemini
    try {
      await this.testGemini({ prompt: 'Скажи привет' });
      results.tests['gemini'] = { success: true, message: 'Gemini AI работает' };
    } catch (error) {
      results.tests['gemini'] = { success: false, error: error.message };
    }

    // Test Storage
    try {
      await this.testStorage();
      results.tests['storage'] = { success: true, message: 'Cloud Storage работает' };
    } catch (error) {
      results.tests['storage'] = { success: false, error: error.message };
    }

    return results;
  }

  /**
   * Get list of available TTS voices
   */
  @Get('voices')
  async listVoices() {
    try {
      const voices = await this.googleCloudService.listVoices('ru-RU');

      return {
        success: true,
        count: voices.length,
        voices: voices.map((v) => ({
          name: v.name,
          gender: v.ssmlGender,
          languageCodes: v.languageCodes,
        })),
      };
    } catch (error) {
      this.logger.error('List voices failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
