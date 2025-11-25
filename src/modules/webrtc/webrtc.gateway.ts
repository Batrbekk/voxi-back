import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SipService } from '../sip/sip.service';
import { ConversationService } from '../conversation/conversation.service';
import { GoogleCloudService } from '../google-cloud/google-cloud.service';
import { AIConversationService } from '../ai-conversation/ai-conversation.service';
import { MediaService } from '../media/media.service';
import { SipGeminiBridge } from '../gemini-live/sip-gemini-bridge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CallDirection, CallerType, CallStatus } from '../../schemas/conversation.schema';
import { Agent } from '../../schemas/agent.schema';
import { KnowledgeBase } from '../../schemas/knowledge-base.schema';

interface CallData {
  phoneNumber: string;
  managerId: string;
  leadId?: string;
}

interface ManagerSession {
  socket: Socket;
  managerId: string;
  managerName: string;
  currentCallId?: string;
  isRecording: boolean;
  audioChunks: Buffer[];
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    credentials: true,
  },
  namespace: '/webrtc',
})
export class WebRtcGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRtcGateway.name);
  private managerSessions: Map<string, ManagerSession> = new Map();
  private activeBridges: Map<string, SipGeminiBridge> = new Map();

  constructor(
    private sipService: SipService,
    private conversationService: ConversationService,
    private googleCloudService: GoogleCloudService,
    private aiConversationService: AIConversationService,
    private mediaService: MediaService,
    private sipGeminiBridge: SipGeminiBridge,
    @InjectModel('Agent') private agentModel: Model<Agent>,
    @InjectModel('KnowledgeBase') private knowledgeBaseModel: Model<KnowledgeBase>,
  ) {
    // Listen to SIP service events
    this.sipService.on('call:incoming', (data) => {
      this.handleIncomingCall(data);
    });

    this.sipService.on('call:answered', (session) => {
      this.notifyCallStatus(session.callId, 'answered');
    });

    this.sipService.on('call:connected', (session) => {
      this.handleIncomingCall(session);
    });

    this.sipService.on('call:ended', (session) => {
      this.handleCallEnded(session);
    });

    this.sipService.on('call:failed', (session) => {
      this.notifyCallStatus(session.callId, 'failed');
    });

    // Listen to AI conversation service events
    this.aiConversationService.on('play-audio', (data) => {
      this.handleAIAudioPlayback(data);
    });
  }

  afterInit(server: Server) {
    this.logger.log('WebRTC Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Extract user info from JWT token (passed in handshake auth)
    const token = client.handshake.auth.token;
    if (!token) {
      client.disconnect();
      return;
    }

    // TODO: Verify JWT token and extract user info
    // For now, accepting connection
    client.emit('connected', {
      message: 'Connected to WebRTC Gateway',
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Find and cleanup manager session
    for (const [managerId, session] of this.managerSessions.entries()) {
      if (session.socket.id === client.id) {
        // Hangup active call if any
        if (session.currentCallId) {
          await this.sipService.hangupCall(session.currentCallId);
        }

        this.managerSessions.delete(managerId);
        break;
      }
    }
  }

  /**
   * Manager registers their session
   */
  @SubscribeMessage('register')
  async handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { managerId: string; managerName: string },
  ) {
    this.logger.log(`Manager registered: ${data.managerId}`);

    const session: ManagerSession = {
      socket: client,
      managerId: data.managerId,
      managerName: data.managerName,
      isRecording: false,
      audioChunks: [],
    };

    this.managerSessions.set(data.managerId, session);

    client.emit('registered', {
      success: true,
      message: 'Manager session registered',
    });
  }

  /**
   * Manager initiates outbound call
   */
  @SubscribeMessage('call:start')
  async handleStartCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallData,
  ) {
    const session = this.findSessionBySocket(client);

    if (!session) {
      client.emit('error', { message: 'Session not registered' });
      return;
    }

    try {
      this.logger.log(`Starting call to ${data.phoneNumber} by manager ${session.managerId}`);

      // Create SIP call
      const sipSession = await this.sipService.makeCall(data.phoneNumber);

      // Create conversation record
      const conversation = await this.conversationService.createConversation(
        session.managerId as any, // companyId will be extracted from JWT
        {
          callId: sipSession.callId,
          phoneNumber: data.phoneNumber,
          direction: CallDirection.OUTBOUND,
          callerType: CallerType.HUMAN_MANAGER,
          managerId: session.managerId,
          managerName: session.managerName,
          startedAt: sipSession.startedAt.toISOString(),
          leadId: data.leadId,
        },
      );

      session.currentCallId = sipSession.callId;
      session.isRecording = true;
      session.audioChunks = [];

      client.emit('call:started', {
        callId: sipSession.callId,
        conversationId: conversation._id,
      });

    } catch (error) {
      this.logger.error('Failed to start call:', error);
      client.emit('call:failed', {
        error: error.message,
      });
    }
  }

  /**
   * Manager ends call
   */
  @SubscribeMessage('call:end')
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    const session = this.findSessionBySocket(client);

    if (!session) {
      return;
    }

    try {
      await this.sipService.hangupCall(data.callId);

      session.currentCallId = undefined;
      session.isRecording = false;

      client.emit('call:ended', {
        callId: data.callId,
      });

    } catch (error) {
      this.logger.error('Failed to end call:', error);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Receive audio stream from manager (for recording)
   */
  @SubscribeMessage('audio:stream')
  async handleAudioStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; audio: ArrayBuffer },
  ) {
    const session = this.findSessionBySocket(client);

    if (!session || !session.isRecording) {
      return;
    }

    // Store audio chunk
    const audioBuffer = Buffer.from(data.audio);
    session.audioChunks.push(audioBuffer);
  }

  /**
   * Send DTMF tones
   */
  @SubscribeMessage('call:dtmf')
  async handleDTMF(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; digits: string },
  ) {
    try {
      await this.sipService.sendDTMF(data.callId, data.digits);

      client.emit('dtmf:sent', {
        callId: data.callId,
        digits: data.digits,
      });

    } catch (error) {
      this.logger.error('Failed to send DTMF:', error);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Handle incoming call notification
   */
  private async handleIncomingCall(data: { session: any; req?: any; res?: any }) {
    const { session: sipSession, req, res } = data;

    this.logger.log(`Incoming call: ${sipSession.callId} from ${sipSession.phoneNumber}`);

    try {
      // Determine the phone number to check for agent assignment
      // For inbound calls: check 'to' (the number being called)
      // For outbound calls: check 'from' (our number making the call)
      const phoneToCheck = sipSession.direction === 'inbound'
        ? sipSession.to
        : sipSession.from;

      // Find agent assigned to this phone number
      const agent = await this.agentModel.findOne({
        phoneNumbers: phoneToCheck,
        isActive: true,
      }).lean();

      if (agent && req && res) {
        this.logger.log(`Agent ${agent.name} found for phone number ${phoneToCheck}`);

        // Always use Gemini Live for natural conversations
        await this.handleGeminiLiveCall(sipSession, req, res, agent);
      } else {
        this.logger.log(`No agent found for phone number ${phoneToCheck}, notifying managers`);

        // No agent assigned - notify managers for manual handling
        this.server.emit('call:incoming', {
          callId: sipSession.callId,
          phoneNumber: sipSession.phoneNumber,
          startedAt: sipSession.startedAt,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to handle incoming call ${sipSession.callId}:`, error);

      // Fallback: notify managers
      this.server.emit('call:incoming', {
        callId: sipSession.callId,
        phoneNumber: sipSession.phoneNumber,
        startedAt: sipSession.startedAt,
      });
    }
  }

  /**
   * Handle call ended - save recording and transcript
   */
  private async handleCallEnded(sipSession: any) {
    this.logger.log(`Call ended: ${sipSession.callId}`);

    // Check if there's an active Gemini Live bridge and end it
    const bridge = this.activeBridges.get(sipSession.callId);
    if (bridge) {
      try {
        await bridge.stop();
        this.activeBridges.delete(sipSession.callId);
        this.logger.log(`Gemini Live bridge stopped for call ${sipSession.callId}`);
        // Bridge will emit 'bridgeEnded' event which handles conversation saving
        return; // Exit early as bridge handles saving
      } catch (error) {
        this.logger.error(`Failed to stop Gemini Live bridge for call ${sipSession.callId}:`, error);
      }
    }

    // Check if there's an active AI session and end it
    if (this.aiConversationService.isSessionActive(sipSession.callId)) {
      try {
        await this.aiConversationService.endSession(sipSession.callId);
        this.logger.log(`AI conversation session ended for call ${sipSession.callId}`);
      } catch (error) {
        this.logger.error(`Failed to end AI session for call ${sipSession.callId}:`, error);
      }
    }

    // Find manager session
    for (const session of this.managerSessions.values()) {
      if (session.currentCallId === sipSession.callId) {
        try {
          // Combine audio chunks
          const fullAudio = Buffer.concat(session.audioChunks);

          // Upload to Google Cloud Storage
          const audioUrl = await this.googleCloudService.uploadAudioFile(
            fullAudio,
            `${sipSession.callId}.webm`,
            'audio/webm',
          );

          // Transcribe audio
          const transcript = await this.googleCloudService.transcribeAudioBuffer(
            fullAudio,
            'ru-RU',
          );

          // Analyze conversation
          const analysis = await this.googleCloudService.analyzeConversation(transcript);

          // Update conversation record
          await this.conversationService.updateConversation(
            sipSession.callId as any,
            session.managerId as any,
            {
              status: CallStatus.COMPLETED,
              endedAt: sipSession.endedAt?.toISOString(),
              duration: sipSession.duration,
              audioUrl,
              transcript,
              aiAnalysis: analysis,
            },
          );

          // Notify manager
          session.socket.emit('call:processed', {
            callId: sipSession.callId,
            audioUrl,
            transcript,
            analysis,
          });

          // Cleanup
          session.currentCallId = undefined;
          session.isRecording = false;
          session.audioChunks = [];

        } catch (error) {
          this.logger.error('Failed to process call recording:', error);
        }

        break;
      }
    }
  }

  /**
   * Handle incoming call with Gemini Live API for natural conversations
   */
  private async handleGeminiLiveCall(
    sipSession: any,
    req: any,
    res: any,
    agent: any,
  ): Promise<void> {
    try {
      this.logger.log(`Starting Gemini Live session for call ${sipSession.callId}`);

      // Get knowledge base if configured
      let knowledgeBase: any = null;
      if (agent.knowledgeBaseId) {
        knowledgeBase = await this.knowledgeBaseModel.findById(agent.knowledgeBaseId).lean();
      }

      // Connect call to Freeswitch to get media endpoint
      const mediaEndpoint = await this.mediaService.connectCaller(
        sipSession.callId,
        req,
        res,
      );

      this.logger.log(`Call ${sipSession.callId} connected to Freeswitch for Gemini Live`);

      // Use the injected bridge service (we'll need to clone/create instances differently)
      // For now, use the injected instance (in production, might need a factory)
      const bridge = this.sipGeminiBridge;

      // Prepare configuration for Gemini Live
      const config = {
        sipCallId: sipSession.callId,
        phoneNumber: sipSession.phoneNumber,
        direction: sipSession.direction,
        agentId: agent._id.toString(),
        systemPrompt: agent.aiSettings?.systemPrompt || 'You are a helpful AI assistant.',
        voiceSettings: agent.voiceSettings || {
          voiceName: 'Aoede', // Default Russian-friendly voice
          language: 'ru',
          speakingRate: 1.0,
          pitch: 0,
        },
        greetingMessages: {
          inbound: agent.inboundGreetingMessage,
          outbound: agent.outboundGreetingMessage,
          fallback: agent.fallbackMessage,
          ending: agent.endingMessage,
        },
        knowledgeBase: knowledgeBase ? {
          name: knowledgeBase.name,
          documents: knowledgeBase.documents,
          metadata: knowledgeBase.metadata,
        } : null,
        temperature: agent.aiSettings?.temperature || 0.7,
      };

      // Set up bridge event handlers
      bridge.on('transcript', (data) => {
        this.logger.debug(`Transcript: ${data.text}`);
      });

      bridge.on('bridgeEnded', async (data) => {
        this.logger.log(`Gemini Live bridge ended for call ${sipSession.callId}`);

        try {
          // Process the conversation data
          const transcript = data.transcriptSegments
            .map((seg: any) => `${seg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${seg.text}`)
            .join('\n\n');

          // Upload audio recording to Google Cloud Storage
          let audioUrl: string | null = null;
          if (data.recordingBuffer && data.recordingBuffer.length > 0) {
            audioUrl = await this.googleCloudService.uploadAudioFile(
              data.recordingBuffer,
              `${sipSession.callId}.pcm`,
              'audio/pcm',
            );
          }

          // Analyze conversation
          const analysis = await this.googleCloudService.analyzeConversation(transcript);

          // Create conversation record (first create with basic info)
          const conversation = await this.conversationService.createConversation(
            agent.companyId,
            {
              callId: sipSession.callId,
              phoneNumber: sipSession.phoneNumber,
              direction: sipSession.direction === 'inbound' ? CallDirection.INBOUND : CallDirection.OUTBOUND,
              callerType: CallerType.AI_AGENT,
              agentId: agent._id.toString(),
              startedAt: sipSession.startedAt?.toISOString() || new Date().toISOString(),
            },
          );

          // Then update with complete data
          await this.conversationService.updateConversation(
            conversation._id as any,
            agent._id.toString() as any,
            {
              status: CallStatus.COMPLETED,
              endedAt: new Date().toISOString(),
              duration: data.duration,
              audioUrl: audioUrl || undefined,
              transcript,
              aiAnalysis: analysis,
              metadata: {
                isGeminiLive: true,
                transcriptSegments: data.transcriptSegments.length,
              },
            },
          );

          this.logger.log(`Conversation saved for Gemini Live call ${sipSession.callId}`);
        } catch (error) {
          this.logger.error(`Failed to save Gemini Live conversation:`, error);
        }

        // Remove from active bridges
        this.activeBridges.delete(sipSession.callId);
      });

      bridge.on('error', (error) => {
        this.logger.error(`Gemini Live bridge error for call ${sipSession.callId}:`, error);
        this.activeBridges.delete(sipSession.callId);
      });

      // Start the bridge
      await bridge.start(mediaEndpoint.endpoint, config);

      // Store the bridge for later cleanup
      this.activeBridges.set(sipSession.callId, bridge);

      this.logger.log(`Gemini Live session active for call ${sipSession.callId}`);

    } catch (error) {
      this.logger.error(`Failed to start Gemini Live session for call ${sipSession.callId}:`, error);

      // Fall back to traditional AI conversation if Gemini Live fails
      this.logger.log(`Falling back to traditional AI conversation for call ${sipSession.callId}`);

      // Start traditional AI conversation session as fallback
      await this.aiConversationService.startSession(
        sipSession.callId,
        agent._id.toString(),
        sipSession.direction === 'inbound' ? 'inbound' : 'outbound',
      );
    }
  }

  /**
   * Handle AI audio playback (TTS)
   */
  private handleAIAudioPlayback(data: { callId: string; audioContent: Buffer; message: string }) {
    this.logger.log(`AI audio playback for call ${data.callId}: "${data.message}"`);

    // TODO: Implement actual audio playback through SIP dialog
    // This requires media server (Freeswitch/Asterisk) integration
    // The audioContent is a Buffer containing the MP3/WAV audio from Google TTS

    // For now, just log that we have the audio ready
    this.logger.debug(`Audio buffer size: ${data.audioContent.length} bytes`);

    // Future implementation:
    // 1. Convert audio format if needed (MP3 -> ulaw/alaw for SIP)
    // 2. Stream audio to the SIP dialog via drachtio-fsmrf
    // 3. Wait for audio playback to complete
    // 4. Listen for user speech input
  }

  /**
   * Notify call status to relevant manager
   */
  private notifyCallStatus(callId: string, status: string) {
    for (const session of this.managerSessions.values()) {
      if (session.currentCallId === callId) {
        session.socket.emit('call:status', {
          callId,
          status,
        });
        break;
      }
    }
  }

  /**
   * Find session by socket
   */
  private findSessionBySocket(socket: Socket): ManagerSession | undefined {
    for (const session of this.managerSessions.values()) {
      if (session.socket.id === socket.id) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Get active manager sessions count
   */
  getActiveSessions(): number {
    return this.managerSessions.size;
  }

  /**
   * Get active calls count
   */
  getActiveCalls(): number {
    let count = 0;
    for (const session of this.managerSessions.values()) {
      if (session.currentCallId) {
        count++;
      }
    }
    return count;
  }
}
