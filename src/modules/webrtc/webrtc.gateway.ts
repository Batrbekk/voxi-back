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
import { SipService } from '../sip/sip.service';
import { ConversationService } from '../conversation/conversation.service';
import { GoogleCloudService } from '../google-cloud/google-cloud.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CallDirection, CallerType, CallStatus } from '../../schemas/conversation.schema';

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

  constructor(
    private sipService: SipService,
    private conversationService: ConversationService,
    private googleCloudService: GoogleCloudService,
  ) {
    // Listen to SIP service events
    this.sipService.on('call:incoming', (session) => {
      this.handleIncomingCall(session);
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
  private handleIncomingCall(sipSession: any) {
    this.logger.log(`Incoming call: ${sipSession.callId} from ${sipSession.phoneNumber}`);

    // Notify all connected managers about incoming call
    this.server.emit('call:incoming', {
      callId: sipSession.callId,
      phoneNumber: sipSession.phoneNumber,
      startedAt: sipSession.startedAt,
    });
  }

  /**
   * Handle call ended - save recording and transcript
   */
  private async handleCallEnded(sipSession: any) {
    this.logger.log(`Call ended: ${sipSession.callId}`);

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
