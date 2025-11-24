import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

const Mrf = require('drachtio-fsmrf');

export interface MediaEndpoint {
  callId: string;
  endpoint: any; // drachtio-fsmrf Endpoint
  dialog: any; // SIP dialog
  isActive: boolean;
}

@Injectable()
export class MediaService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private mrf: any; // Mrf instance
  private mediaserver: any; // Freeswitch mediaserver
  private activeEndpoints: Map<string, MediaEndpoint> = new Map();

  // Freeswitch connection settings
  private freeswitchHost: string;
  private freeswitchPort: number;
  private freeswitchSecret: string;

  // Temporary directory for audio files
  private tempAudioDir: string;

  constructor(
    private configService: ConfigService,
  ) {
    super();

    this.freeswitchHost = this.configService.get<string>('FREESWITCH_HOST') || '127.0.0.1';
    this.freeswitchPort = parseInt(this.configService.get<string>('FREESWITCH_PORT') || '8021');
    this.freeswitchSecret = this.configService.get<string>('FREESWITCH_SECRET') || 'ClueCon';
    this.tempAudioDir = this.configService.get<string>('TEMP_AUDIO_DIR') || '/tmp/voxi-audio';
  }

  async onModuleInit() {
    this.logger.log('Media Service initialization started (non-blocking)');

    // Ensure temp audio directory exists
    try {
      await fs.mkdir(this.tempAudioDir, { recursive: true });
      this.logger.log(`Temp audio directory created: ${this.tempAudioDir}`);
    } catch (error) {
      this.logger.error(`Failed to create temp audio directory: ${error.message}`);
    }

    // Initialize Mrf (will be connected when SRF is available)
    this.logger.log('Media Service initialized (Freeswitch connection will be established when needed)');
  }

  async onModuleDestroy() {
    // Destroy all active endpoints
    for (const [callId, mediaEndpoint] of this.activeEndpoints.entries()) {
      try {
        if (mediaEndpoint.endpoint) {
          mediaEndpoint.endpoint.destroy();
        }
        if (mediaEndpoint.dialog) {
          mediaEndpoint.dialog.destroy();
        }
      } catch (error) {
        this.logger.error(`Error destroying endpoint ${callId}:`, error);
      }
    }

    // Disconnect from media server
    if (this.mediaserver) {
      try {
        this.mediaserver.disconnect();
        this.logger.log('Disconnected from Freeswitch media server');
      } catch (error) {
        this.logger.error('Error disconnecting from media server:', error);
      }
    }
  }

  /**
   * Initialize Mrf with SRF instance
   */
  initializeMrf(srf: any): void {
    if (this.mrf) {
      this.logger.warn('Mrf already initialized');
      return;
    }

    this.mrf = new Mrf(srf);
    this.logger.log('Mrf initialized with SRF');
  }

  /**
   * Connect to Freeswitch media server
   */
  async connectToMediaServer(): Promise<void> {
    if (this.mediaserver) {
      this.logger.log('Already connected to media server');
      return;
    }

    // Check if FreeSWITCH is disabled
    if (this.configService.get<string>('DISABLE_FREESWITCH') === 'true') {
      this.logger.warn('FreeSWITCH connection disabled via DISABLE_FREESWITCH flag');
      return;
    }

    if (!this.mrf) {
      throw new Error('Mrf not initialized. Call initializeMrf() first.');
    }

    try {
      this.logger.log(`Connecting to Freeswitch at ${this.freeswitchHost}:${this.freeswitchPort}`);

      this.mediaserver = await this.mrf.connect({
        address: this.freeswitchHost,
        port: this.freeswitchPort,
        secret: this.freeswitchSecret,
      });

      this.logger.log(`Connected to Freeswitch media server: ${JSON.stringify(this.mediaserver.sip)}`);

      // Listen to media server events
      this.mediaserver.on('error', (err: Error) => {
        this.logger.error('Media server error:', err);
      });

    } catch (error) {
      this.logger.error(`Failed to connect to Freeswitch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect incoming call to media server
   */
  async connectCaller(callId: string, req: any, res: any): Promise<MediaEndpoint> {
    try {
      // Ensure connected to media server
      if (!this.mediaserver) {
        await this.connectToMediaServer();
      }

      this.logger.log(`Connecting call ${callId} to media server`);

      const { endpoint, dialog } = await this.mediaserver.connectCaller(req, res);

      const mediaEndpoint: MediaEndpoint = {
        callId,
        endpoint,
        dialog,
        isActive: true,
      };

      this.activeEndpoints.set(callId, mediaEndpoint);

      this.logger.log(`Call ${callId} connected to media server, endpoint UUID: ${endpoint.uuid}`);

      // Listen to endpoint events
      endpoint.on('destroy', () => {
        this.logger.log(`Endpoint destroyed for call ${callId}`);
        this.activeEndpoints.delete(callId);
      });

      return mediaEndpoint;
    } catch (error) {
      this.logger.error(`Failed to connect caller ${callId} to media server:`, error);
      throw error;
    }
  }

  /**
   * Play audio file on endpoint
   */
  async playAudio(callId: string, audioFilePath: string): Promise<void> {
    const mediaEndpoint = this.activeEndpoints.get(callId);
    if (!mediaEndpoint || !mediaEndpoint.isActive) {
      throw new Error(`No active media endpoint for call ${callId}`);
    }

    try {
      this.logger.log(`Playing audio file on call ${callId}: ${audioFilePath}`);

      await mediaEndpoint.endpoint.play(audioFilePath);

      this.logger.log(`Audio playback completed for call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to play audio on call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Save TTS audio buffer to temporary file and play it
   */
  async playTTS(callId: string, audioBuffer: Buffer, format: string = 'mp3'): Promise<void> {
    try {
      // Generate unique filename
      const filename = `tts-${callId}-${Date.now()}.${format}`;
      const filePath = path.join(this.tempAudioDir, filename);

      // Save audio buffer to file
      await fs.writeFile(filePath, audioBuffer);
      this.logger.log(`TTS audio saved to ${filePath}`);

      // Play the audio
      await this.playAudio(callId, filePath);

      // Clean up file after playback (with delay to ensure playback completed)
      setTimeout(async () => {
        try {
          await fs.unlink(filePath);
          this.logger.debug(`Cleaned up temporary audio file: ${filePath}`);
        } catch (err) {
          this.logger.warn(`Failed to cleanup audio file ${filePath}: ${err.message}`);
        }
      }, 5000);

    } catch (error) {
      this.logger.error(`Failed to play TTS for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Start audio forking for STT (WebSocket streaming)
   */
  async startAudioFork(callId: string, wsUrl: string): Promise<void> {
    const mediaEndpoint = this.activeEndpoints.get(callId);
    if (!mediaEndpoint || !mediaEndpoint.isActive) {
      throw new Error(`No active media endpoint for call ${callId}`);
    }

    try {
      this.logger.log(`Starting audio fork for call ${callId} to ${wsUrl}`);

      await mediaEndpoint.endpoint.forkAudioStart({
        wsUrl,
        sampling: '16000', // 16kHz for better STT quality
        mixType: 'mono',
        bugname: `stt-${callId}`,
      });

      this.logger.log(`Audio fork started for call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to start audio fork for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Stop audio forking
   */
  async stopAudioFork(callId: string): Promise<void> {
    const mediaEndpoint = this.activeEndpoints.get(callId);
    if (!mediaEndpoint || !mediaEndpoint.isActive) {
      return;
    }

    try {
      this.logger.log(`Stopping audio fork for call ${callId}`);

      await mediaEndpoint.endpoint.forkAudioStop(`stt-${callId}`);

      this.logger.log(`Audio fork stopped for call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to stop audio fork for call ${callId}:`, error);
    }
  }

  /**
   * Destroy media endpoint
   */
  async destroyEndpoint(callId: string): Promise<void> {
    const mediaEndpoint = this.activeEndpoints.get(callId);
    if (!mediaEndpoint) {
      return;
    }

    try {
      this.logger.log(`Destroying media endpoint for call ${callId}`);

      mediaEndpoint.isActive = false;

      if (mediaEndpoint.endpoint) {
        mediaEndpoint.endpoint.destroy();
      }

      if (mediaEndpoint.dialog) {
        mediaEndpoint.dialog.destroy();
      }

      this.activeEndpoints.delete(callId);

      this.logger.log(`Media endpoint destroyed for call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to destroy endpoint for call ${callId}:`, error);
    }
  }

  /**
   * Get media endpoint
   */
  getEndpoint(callId: string): MediaEndpoint | undefined {
    return this.activeEndpoints.get(callId);
  }

  /**
   * Check if endpoint is active
   */
  isEndpointActive(callId: string): boolean {
    const endpoint = this.activeEndpoints.get(callId);
    return endpoint?.isActive || false;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      activeEndpoints: this.activeEndpoints.size,
      freeswitchConnected: !!this.mediaserver,
      freeswitchHost: this.freeswitchHost,
      freeswitchPort: this.freeswitchPort,
    };
  }
}
