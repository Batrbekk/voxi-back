import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Agent } from '../../schemas/agent.schema';
import { Conversation } from '../../schemas/conversation.schema';
import { GoogleCloudService } from '../google-cloud/google-cloud.service';
import { EventEmitter } from 'events';

export interface AIConversationSession {
  callId: string;
  agentId: string;
  agent: Agent;
  conversation: Conversation;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  audioBuffer: Buffer[];
  isActive: boolean;
}

@Injectable()
export class AIConversationService extends EventEmitter {
  private readonly logger = new Logger(AIConversationService.name);
  private activeSessions: Map<string, AIConversationSession> = new Map();

  constructor(
    @InjectModel('Agent') private agentModel: Model<Agent>,
    @InjectModel('Conversation') private conversationModel: Model<Conversation>,
    private googleCloudService: GoogleCloudService,
  ) {
    super();
  }

  /**
   * Start AI conversation session for a call
   */
  async startSession(callId: string, agentId: string, direction: 'inbound' | 'outbound'): Promise<void> {
    try {
      this.logger.log(`Starting AI conversation session for call ${callId} with agent ${agentId}`);

      // Get agent details
      const agent = await this.agentModel.findById(agentId).lean();
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Get conversation record
      const conversation = await this.conversationModel.findOne({ callId }).lean();
      if (!conversation) {
        throw new Error(`Conversation ${callId} not found`);
      }

      // Determine greeting message
      const greetingMessage =
        direction === 'inbound'
          ? agent.inboundGreetingMessage || 'Здравствуйте! Чем могу помочь?'
          : agent.outboundGreetingMessage || 'Здравствуйте! Меня зовут AI ассистент.';

      // Initialize session
      const session: AIConversationSession = {
        callId,
        agentId,
        agent,
        conversation,
        conversationHistory: [
          {
            role: 'assistant',
            content: greetingMessage,
          },
        ],
        audioBuffer: [],
        isActive: true,
      };

      this.activeSessions.set(callId, session);

      // Generate and play greeting
      await this.playGreeting(session, greetingMessage);

      this.logger.log(`AI conversation session started for call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to start AI session for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Play greeting message using TTS
   */
  private async playGreeting(session: AIConversationSession, message: string): Promise<void> {
    try {
      this.logger.log(`Generating greeting TTS for call ${session.callId}`);

      // Generate TTS audio
      const audioContent = await this.googleCloudService.synthesizeSpeech(
        message,
        session.agent.voiceSettings?.language || 'ru-RU',
        session.agent.voiceSettings?.voiceName || 'ru-RU-Wavenet-B',
        session.agent.voiceSettings?.speakingRate || 1.0,
        session.agent.voiceSettings?.pitch || 0.0,
      );

      // TODO: Play audio through SIP dialog
      // This requires media server (Freeswitch/Asterisk) integration
      this.logger.warn('Audio playback not implemented yet - requires media server');

      // Emit event for potential media server integration
      this.emit('play-audio', {
        callId: session.callId,
        audioContent,
        message,
      });
    } catch (error) {
      this.logger.error(`Failed to play greeting for call ${session.callId}:`, error);
    }
  }

  /**
   * Process incoming audio from caller (speech-to-text)
   */
  async processAudio(callId: string, audioChunk: Buffer): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session || !session.isActive) {
      return;
    }

    // Buffer audio chunks
    session.audioBuffer.push(audioChunk);

    // TODO: Implement streaming STT or process in chunks
    this.logger.debug(`Buffering audio for call ${callId}, total chunks: ${session.audioBuffer.length}`);
  }

  /**
   * Process transcribed text and generate AI response
   */
  async processUserMessage(callId: string, userMessage: string): Promise<string> {
    const session = this.activeSessions.get(callId);
    if (!session || !session.isActive) {
      throw new Error(`No active session for call ${callId}`);
    }

    try {
      this.logger.log(`Processing user message for call ${callId}: "${userMessage}"`);

      // Add user message to history
      session.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Build context for AI
      const systemPrompt = this.buildSystemPrompt(session);
      const conversationContext = this.buildConversationContext(session);

      // Generate AI response using Gemini
      const aiResponse = await this.googleCloudService.generateAIResponse(
        conversationContext,
        systemPrompt,
        session.agent.aiSettings?.model || 'gemini-1.5-flash-002',
        session.agent.aiSettings?.temperature || 0.7,
        session.agent.aiSettings?.maxTokens || 1024,
      );

      // Add AI response to history
      session.conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
      });

      this.logger.log(`Generated AI response for call ${callId}: "${aiResponse}"`);

      // Generate TTS for response
      await this.playResponse(session, aiResponse);

      return aiResponse;
    } catch (error) {
      this.logger.error(`Failed to process message for call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(session: AIConversationSession): string {
    let prompt = session.agent.aiSettings?.systemPrompt || 'Ты дружелюбный AI ассистент.';

    // Add knowledge base context if available
    if (session.agent.knowledgeBaseId) {
      prompt += '\n\nИспользуй следующую информацию для ответов:\n';
      // TODO: Fetch and add knowledge base documents
      prompt += '[Knowledge base будет добавлена позже]';
    }

    return prompt;
  }

  /**
   * Build conversation context for AI
   */
  private buildConversationContext(session: AIConversationSession): string {
    return session.conversationHistory
      .map((msg) => `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Play AI response using TTS
   */
  private async playResponse(session: AIConversationSession, message: string): Promise<void> {
    try {
      // Generate TTS audio
      const audioContent = await this.googleCloudService.synthesizeSpeech(
        message,
        session.agent.voiceSettings?.language || 'ru-RU',
        session.agent.voiceSettings?.voiceName || 'ru-RU-Wavenet-B',
        session.agent.voiceSettings?.speakingRate || 1.0,
        session.agent.voiceSettings?.pitch || 0.0,
      );

      // TODO: Play audio through SIP dialog
      this.logger.warn('Audio playback not implemented yet - requires media server');

      // Emit event for potential media server integration
      this.emit('play-audio', {
        callId: session.callId,
        audioContent,
        message,
      });
    } catch (error) {
      this.logger.error(`Failed to play response for call ${session.callId}:`, error);
    }
  }

  /**
   * End AI conversation session
   */
  async endSession(callId: string): Promise<void> {
    const session = this.activeSessions.get(callId);
    if (!session) {
      return;
    }

    try {
      this.logger.log(`Ending AI conversation session for call ${callId}`);

      session.isActive = false;

      // Process any remaining audio buffer
      if (session.audioBuffer.length > 0) {
        const fullAudio = Buffer.concat(session.audioBuffer);
        // TODO: Final transcription if needed
      }

      // Save conversation history to database
      await this.saveConversationHistory(session);

      this.activeSessions.delete(callId);

      this.logger.log(`AI conversation session ended for call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to end AI session for call ${callId}:`, error);
    }
  }

  /**
   * Save conversation history to database
   */
  private async saveConversationHistory(session: AIConversationSession): Promise<void> {
    try {
      const transcript = session.conversationHistory
        .map((msg) => `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.content}`)
        .join('\n\n');

      await this.conversationModel.updateOne(
        { callId: session.callId },
        {
          $set: {
            transcript,
            updatedAt: new Date(),
          },
        },
      );

      this.logger.log(`Saved conversation history for call ${session.callId}`);
    } catch (error) {
      this.logger.error(`Failed to save conversation history for call ${session.callId}:`, error);
    }
  }

  /**
   * Get active session
   */
  getSession(callId: string): AIConversationSession | undefined {
    return this.activeSessions.get(callId);
  }

  /**
   * Check if session is active
   */
  isSessionActive(callId: string): boolean {
    const session = this.activeSessions.get(callId);
    return session?.isActive || false;
  }
}
