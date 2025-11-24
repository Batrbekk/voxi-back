import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server as WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { GoogleCloudService } from '../google-cloud/google-cloud.service';

interface AudioStreamSession {
  callId: string;
  ws: any;
  audioStream: Readable;
  sttStream: any;
  language: string;
  isActive: boolean;
  audioChunks: Buffer[];
  silenceTimeout?: NodeJS.Timeout;
}

@Injectable()
export class AudioStreamService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AudioStreamService.name);
  private wss: WebSocketServer;
  private activeSessions: Map<string, AudioStreamSession> = new Map();
  private port: number;
  private silenceThreshold: number = 2000; // 2 seconds of silence triggers transcription

  constructor(
    private configService: ConfigService,
    private googleCloudService: GoogleCloudService,
  ) {
    super();
    this.port = parseInt(this.configService.get<string>('AUDIO_STREAM_WS_PORT') || '8082');
  }

  async onModuleInit() {
    this.startWebSocketServer();
  }

  async onModuleDestroy() {
    // Close all active sessions
    for (const session of this.activeSessions.values()) {
      this.stopSession(session.callId);
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    this.logger.log('AudioStreamService destroyed');
  }

  /**
   * Start WebSocket server for audio streaming
   */
  private startWebSocketServer() {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('listening', () => {
      this.logger.log(`Audio Stream WebSocket server listening on port ${this.port}`);
    });

    this.wss.on('connection', (ws, req) => {
      const url = req.url || '';
      const callId = this.extractCallIdFromUrl(url);

      if (!callId) {
        this.logger.warn('WebSocket connection without callId, closing');
        ws.close();
        return;
      }

      this.logger.log(`WebSocket connected for call ${callId}`);
      this.handleWebSocketConnection(callId, ws);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle WebSocket connection for a call
   */
  private handleWebSocketConnection(callId: string, ws: any) {
    const session = this.activeSessions.get(callId);

    if (!session) {
      this.logger.warn(`No session found for call ${callId}`);
      ws.close();
      return;
    }

    session.ws = ws;

    ws.on('message', (data: Buffer) => {
      this.handleAudioChunk(callId, data);
    });

    ws.on('close', () => {
      this.logger.log(`WebSocket closed for call ${callId}`);
      this.stopSession(callId);
    });

    ws.on('error', (error) => {
      this.logger.error(`WebSocket error for call ${callId}:`, error);
      this.stopSession(callId);
    });
  }

  /**
   * Handle incoming audio chunk from Freeswitch
   */
  private handleAudioChunk(callId: string, audioData: Buffer) {
    const session = this.activeSessions.get(callId);

    if (!session || !session.isActive) {
      return;
    }

    try {
      // Push audio to stream for STT
      if (session.audioStream) {
        session.audioStream.push(audioData);
      }

      // Store chunks for potential later use
      session.audioChunks.push(audioData);

      // Reset silence timeout - user is speaking
      if (session.silenceTimeout) {
        clearTimeout(session.silenceTimeout);
      }

      // Set new silence timeout
      session.silenceTimeout = setTimeout(() => {
        this.handleSilence(callId);
      }, this.silenceThreshold);

    } catch (error) {
      this.logger.error(`Error handling audio chunk for call ${callId}:`, error);
    }
  }

  /**
   * Handle silence detection (end of user speech)
   */
  private async handleSilence(callId: string) {
    const session = this.activeSessions.get(callId);

    if (!session || !session.isActive) {
      return;
    }

    try {
      this.logger.log(`Silence detected for call ${callId}, processing transcription`);

      // End the audio stream to trigger STT final result
      if (session.audioStream) {
        session.audioStream.push(null); // Signal end of stream
      }

      // Note: Transcription result will be handled by the STT stream listener
      // which was set up in startSession()

    } catch (error) {
      this.logger.error(`Error handling silence for call ${callId}:`, error);
    }
  }

  /**
   * Start streaming session for a call
   */
  async startSession(callId: string, language: string = 'ru-RU'): Promise<string> {
    try {
      this.logger.log(`Starting audio stream session for call ${callId}`);

      // Create readable stream for audio
      const audioStream = new Readable({
        read() {
          // No-op: data will be pushed manually
        },
      });

      // Create session
      const session: AudioStreamSession = {
        callId,
        ws: null,
        audioStream,
        sttStream: null,
        language,
        isActive: true,
        audioChunks: [],
      };

      this.activeSessions.set(callId, session);

      // Start Google STT streaming
      await this.startSTTStreaming(session);

      // Return WebSocket URL for Freeswitch to connect
      const wsUrl = `ws://localhost:${this.port}/audio/${callId}`;
      return wsUrl;

    } catch (error) {
      this.logger.error(`Failed to start audio stream session for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Start Google Speech-to-Text streaming
   */
  private async startSTTStreaming(session: AudioStreamSession): Promise<void> {
    try {
      this.logger.log(`Starting STT streaming for call ${session.callId}`);

      // Google STT streaming configuration
      const request = {
        config: {
          encoding: 'LINEAR16' as const,
          sampleRateHertz: 16000,
          languageCode: session.language,
          enableAutomaticPunctuation: true,
          model: 'default',
        },
        interimResults: true, // Get interim results while user is speaking
      };

      // Create STT stream
      const sttStream = this.googleCloudService['speechClient']
        .streamingRecognize(request)
        .on('error', (error) => {
          this.logger.error(`STT stream error for call ${session.callId}:`, error);
        })
        .on('data', (data) => {
          this.handleSTTResult(session.callId, data);
        });

      // Pipe audio stream to STT
      session.audioStream.pipe(sttStream);
      session.sttStream = sttStream;

      this.logger.log(`STT streaming started for call ${session.callId}`);
    } catch (error) {
      this.logger.error(`Failed to start STT streaming for call ${session.callId}:`, error);
      throw error;
    }
  }

  /**
   * Handle STT result (interim or final)
   */
  private handleSTTResult(callId: string, data: any) {
    try {
      if (!data.results || data.results.length === 0) {
        return;
      }

      const result = data.results[0];
      if (!result.alternatives || result.alternatives.length === 0) {
        return;
      }

      const transcript = result.alternatives[0].transcript;
      const isFinal = result.isFinal;

      if (isFinal) {
        this.logger.log(`Final transcription for call ${callId}: "${transcript}"`);

        // Emit event with final transcription
        this.emit('transcription', {
          callId,
          transcript,
          isFinal: true,
        });

        // Restart audio stream for next utterance
        this.restartAudioStream(callId);
      } else {
        this.logger.debug(`Interim transcription for call ${callId}: "${transcript}"`);

        // Emit interim result for real-time feedback (optional)
        this.emit('transcription', {
          callId,
          transcript,
          isFinal: false,
        });
      }
    } catch (error) {
      this.logger.error(`Error handling STT result for call ${callId}:`, error);
    }
  }

  /**
   * Restart audio stream after processing an utterance
   */
  private restartAudioStream(callId: string) {
    const session = this.activeSessions.get(callId);

    if (!session || !session.isActive) {
      return;
    }

    try {
      // Create new audio stream
      const audioStream = new Readable({
        read() {
          // No-op
        },
      });

      session.audioStream = audioStream;
      session.audioChunks = [];

      // Restart STT streaming with new stream
      this.startSTTStreaming(session);

      this.logger.debug(`Audio stream restarted for call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to restart audio stream for call ${callId}:`, error);
    }
  }

  /**
   * Stop streaming session
   */
  stopSession(callId: string) {
    const session = this.activeSessions.get(callId);

    if (!session) {
      return;
    }

    try {
      this.logger.log(`Stopping audio stream session for call ${callId}`);

      session.isActive = false;

      // Clear silence timeout
      if (session.silenceTimeout) {
        clearTimeout(session.silenceTimeout);
      }

      // Close WebSocket
      if (session.ws) {
        session.ws.close();
      }

      // End audio stream
      if (session.audioStream) {
        session.audioStream.push(null);
      }

      // Clean up STT stream
      if (session.sttStream) {
        session.sttStream.destroy();
      }

      this.activeSessions.delete(callId);

      this.logger.log(`Audio stream session stopped for call ${callId}`);
    } catch (error) {
      this.logger.error(`Error stopping audio stream session for call ${callId}:`, error);
    }
  }

  /**
   * Check if session is active
   */
  isSessionActive(callId: string): boolean {
    const session = this.activeSessions.get(callId);
    return session?.isActive || false;
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Extract callId from WebSocket URL
   */
  private extractCallIdFromUrl(url: string): string | null {
    // URL format: /audio/{callId}
    const match = url.match(/\/audio\/([^/?]+)/);
    return match ? match[1] : null;
  }
}
