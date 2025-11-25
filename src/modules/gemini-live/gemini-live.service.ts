import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';

export interface GeminiLiveConfig {
  agentId: string;
  systemPrompt: string;
  voiceSettings?: {
    voiceName?: string;
    language?: string;
    speakingRate?: number;
    pitch?: number;
  };
  direction?: 'inbound' | 'outbound';
  greetingMessages?: {
    inbound?: string;
    outbound?: string;
    fallback?: string;
    ending?: string;
  };
  knowledgeBase?: any;
  temperature?: number;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
}

@Injectable()
export class GeminiLiveService extends EventEmitter {
  private readonly logger = new Logger(GeminiLiveService.name);
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private audioQueue: AudioChunk[] = [];
  private transcriptBuffer: string = '';

  constructor(private configService: ConfigService) {
    super();
  }

  /**
   * Connect to Gemini Live API via WebSocket
   */
  async connect(config: GeminiLiveConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY is not configured');
        }

        // Gemini Live WebSocket endpoint
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        this.ws = new WebSocket(wsUrl, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        this.ws.on('open', () => {
          this.logger.log('Connected to Gemini Live API');
          this.isConnected = true;
          this.sessionId = `live-${Date.now()}-${config.agentId}`;

          // Send initial configuration
          this.sendSetup(config);
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          this.logger.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', () => {
          this.logger.log('Disconnected from Gemini Live API');
          this.isConnected = false;
          this.emit('disconnected');
        });

      } catch (error) {
        this.logger.error('Failed to connect to Gemini Live:', error);
        reject(error);
      }
    });
  }

  /**
   * Send initial setup message to configure the session
   */
  private sendSetup(config: GeminiLiveConfig): void {
    const setupMessage = {
      setup: {
        model: 'models/gemini-2.0-flash-exp',
        config: {
          responseModalities: ['AUDIO', 'TEXT'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.voiceSettings?.voiceName || 'Aoede', // Russian-friendly voice
              },
            },
          },
          systemInstruction: {
            parts: [
              {
                text: this.buildSystemPrompt(config),
              },
            ],
          },
          temperature: config.temperature || 0.7,
          topP: 0.95,
          topK: 40,
        },
        tools: this.buildTools(config),
      },
    };

    this.send(setupMessage);
    this.logger.log('Setup message sent to Gemini Live');
  }

  /**
   * Build system prompt with agent instructions and RAG context
   */
  private buildSystemPrompt(config: GeminiLiveConfig): string {
    let prompt = config.systemPrompt || 'You are a helpful assistant.';

    // Add language instruction based on agent settings
    const language = config.voiceSettings?.language || 'ru';
    switch(language) {
      case 'ru':
        prompt += '\n\nIMPORTANT: Always respond in Russian language. You are speaking with Russian-speaking customers.';
        break;
      case 'en':
        prompt += '\n\nIMPORTANT: Always respond in English language.';
        break;
      case 'kz':
        prompt += '\n\nIMPORTANT: Always respond in Kazakh language. You are speaking with Kazakh-speaking customers.';
        break;
    }

    // Add greeting instructions based on call direction
    if (config.greetingMessages) {
      if (config.direction === 'inbound' && config.greetingMessages.inbound) {
        prompt += `\n\nFor inbound calls, start with: "${config.greetingMessages.inbound}"`;
      } else if (config.direction === 'outbound' && config.greetingMessages.outbound) {
        prompt += `\n\nFor outbound calls, start with: "${config.greetingMessages.outbound}"`;
      }

      if (config.greetingMessages.ending) {
        prompt += `\n\nEnd conversations politely with: "${config.greetingMessages.ending}"`;
      }

      if (config.greetingMessages.fallback) {
        prompt += `\n\nIf confused or need clarification, say: "${config.greetingMessages.fallback}"`;
      }
    }

    // Add voice characteristics instructions (since Gemini Live doesn't support speakingRate/pitch directly)
    if (config.voiceSettings?.speakingRate) {
      if (config.voiceSettings.speakingRate < 0.8) {
        prompt += '\n- Speak slowly and clearly';
      } else if (config.voiceSettings.speakingRate > 1.2) {
        prompt += '\n- Speak at a brisk, energetic pace';
      }
    }

    if (config.voiceSettings?.pitch) {
      if (config.voiceSettings.pitch < -5) {
        prompt += '\n- Use a deeper, more authoritative tone';
      } else if (config.voiceSettings.pitch > 5) {
        prompt += '\n- Use a lighter, more friendly tone';
      }
    }

    // Add knowledge base context if available
    if (config.knowledgeBase) {
      prompt += '\n\nCompany Knowledge Base:\n';
      prompt += JSON.stringify(config.knowledgeBase, null, 2);
    }

    // Add conversation guidelines
    prompt += '\n\nConversation Guidelines:';
    prompt += '\n- Be natural and conversational';
    prompt += '\n- Listen carefully and do not interrupt';
    prompt += '\n- If unsure, ask clarifying questions';
    prompt += '\n- Keep responses concise but informative';
    prompt += '\n- Show empathy and understanding';

    return prompt;
  }

  /**
   * Build tools for function calling (RAG search, etc.)
   */
  private buildTools(config: GeminiLiveConfig): any[] {
    const tools: any[] = [];

    // Add knowledge base search tool if available
    if (config.knowledgeBase) {
      tools.push({
        functionDeclarations: [
          {
            name: 'searchKnowledgeBase',
            description: 'Search the company knowledge base for information',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query',
                },
              },
              required: ['query'],
            },
          },
        ],
      });
    }

    // Add appointment scheduling tool
    tools.push({
      functionDeclarations: [
        {
          name: 'scheduleAppointment',
          description: 'Schedule an appointment or callback',
          parameters: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'Preferred date',
              },
              time: {
                type: 'string',
                description: 'Preferred time',
              },
              purpose: {
                type: 'string',
                description: 'Purpose of the appointment',
              },
            },
            required: ['date', 'time'],
          },
        },
      ],
    });

    return tools;
  }

  /**
   * Send audio chunk to Gemini Live
   */
  async sendAudio(audioBuffer: Buffer): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Gemini Live');
    }

    // Convert audio to base64 for transmission
    const audioBase64 = audioBuffer.toString('base64');

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm',
            data: audioBase64,
          },
        ],
      },
    };

    this.send(message);
  }

  /**
   * Handle incoming messages from Gemini Live
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle different message types
      if (message.serverContent) {
        this.handleServerContent(message.serverContent);
      } else if (message.toolCall) {
        this.handleToolCall(message.toolCall);
      } else if (message.setupComplete) {
        this.logger.log('Setup complete, ready for conversation');
        this.emit('ready');
      }
    } catch (error) {
      this.logger.error('Failed to parse message:', error);
    }
  }

  /**
   * Handle server content (audio and text responses)
   */
  private handleServerContent(content: any): void {
    // Handle text response
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.text) {
          this.transcriptBuffer += part.text;
          this.emit('transcript', {
            text: part.text,
            role: 'assistant',
            timestamp: Date.now(),
          });
        }

        // Handle inline audio data
        if (part.inlineData) {
          const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
          this.emit('audio', {
            data: audioBuffer,
            mimeType: part.inlineData.mimeType,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Handle turn complete
    if (content.turnComplete) {
      this.emit('turnComplete', {
        transcript: this.transcriptBuffer,
      });
      this.transcriptBuffer = '';
    }

    // Handle interrupted state
    if (content.interrupted) {
      this.emit('interrupted');
      this.logger.log('User interrupted the assistant');
    }
  }

  /**
   * Handle tool calls (function calling)
   */
  private handleToolCall(toolCall: any): void {
    this.emit('toolCall', toolCall);

    // Process tool call and send response
    this.processToolCall(toolCall).then((result) => {
      const response = {
        toolResponse: {
          functionCalls: [
            {
              id: toolCall.functionCalls[0].id,
              response: result,
            },
          ],
        },
      };
      this.send(response);
    }).catch((error) => {
      this.logger.error('Failed to process tool call:', error);
    });
  }

  /**
   * Process tool calls (implement actual functionality)
   */
  private async processToolCall(toolCall: any): Promise<any> {
    const functionName = toolCall.functionCalls[0].name;
    const args = toolCall.functionCalls[0].args;

    switch (functionName) {
      case 'searchKnowledgeBase':
        // Implement knowledge base search
        return {
          results: [
            {
              title: 'Sample Result',
              content: 'This would be actual knowledge base content',
              relevance: 0.95,
            },
          ],
        };

      case 'scheduleAppointment':
        // Implement appointment scheduling
        return {
          success: true,
          appointmentId: `apt-${Date.now()}`,
          message: 'Appointment scheduled successfully',
        };

      default:
        return {
          error: `Unknown function: ${functionName}`,
        };
    }
  }

  /**
   * Send message to Gemini Live
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.logger.warn('WebSocket not ready, queuing message');
      // Could implement message queue here
    }
  }

  /**
   * Disconnect from Gemini Live
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.sessionId = null;
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected;
  }
}