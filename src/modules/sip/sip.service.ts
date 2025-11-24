import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Srf from 'drachtio-srf';
import { EventEmitter } from 'events';
import { MediaService } from '../media/media.service';

export interface CallSession {
  callId: string;
  direction: 'inbound' | 'outbound';
  phoneNumber: string; // Customer's phone number (from for inbound, to for outbound)
  from: string; // Caller number (customer for inbound, our number for outbound)
  to: string; // Destination number (our number for inbound, customer for outbound)
  status: 'ringing' | 'ongoing' | 'completed' | 'failed';
  startedAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
  sipDialog?: any;
  mediaStream?: any;
}

@Injectable()
export class SipService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SipService.name);
  private srf: Srf;
  private activeCalls: Map<string, CallSession> = new Map();

  // Drachtio server configuration (local SIP controller)
  private drachtioHost: string;
  private drachtioPort: number;
  private drachtioSecret: string;

  // Beeline SIP Trunk configuration (for outbound calls)
  private beelineTrunkHost: string;
  private beelineTrunkPort: number;
  private sipProtocol: string;
  private sipNumber: string;
  private maxSessions: number;

  constructor(
    private configService: ConfigService,
    private mediaService: MediaService,
  ) {
    super();

    // Drachtio connection settings
    this.drachtioHost = this.configService.get<string>('DRACHTIO_HOST') ||
                        this.configService.get<string>('BEELINE_SIP_SERVER') || '127.0.0.1';
    this.drachtioPort = parseInt(this.configService.get<string>('DRACHTIO_PORT') ||
                        this.configService.get<string>('BEELINE_SIP_PORT') || '9022');
    this.drachtioSecret = this.configService.get<string>('DRACHTIO_SECRET') || 'cymru';

    // Beeline trunk settings
    this.beelineTrunkHost = this.configService.get<string>('BEELINE_SIP_TRUNK_HOST') ||
                            this.configService.get<string>('BEELINE_SIP_SERVER') || '46.227.186.229';
    this.beelineTrunkPort = parseInt(this.configService.get<string>('BEELINE_SIP_TRUNK_PORT') || '5060');
    this.sipProtocol = this.configService.get<string>('BEELINE_SIP_PROTOCOL') || 'UDP';
    this.sipNumber = this.configService.get<string>('BEELINE_SIP_NUMBER') || '';
    this.maxSessions = parseInt(this.configService.get<string>('BEELINE_SIP_MAX_SESSIONS') || '5');

    this.srf = new Srf();
  }

  async onModuleInit() {
    // Don't await SIP connection to avoid blocking app startup
    // SIP will connect in background and log errors if connection fails
    this.initializeSipConnection()
      .then(() => {
        this.logger.log('SIP Service initialized and connected');
      })
      .catch((error) => {
        this.logger.warn('Failed to initialize SIP connection (will retry in background):', error.message);
      });

    this.logger.log('SIP Service initialization started (non-blocking)');
  }

  async onModuleDestroy() {
    try {
      // Hangup all active calls
      for (const [callId, session] of this.activeCalls.entries()) {
        await this.hangupCall(callId);
      }

      // Disconnect SIP
      if (this.srf) {
        this.srf.disconnect();
      }

      this.logger.log('SIP Service destroyed');
    } catch (error) {
      this.logger.error('Error destroying SIP Service:', error);
    }
  }

  /**
   * Initialize SIP connection to Beeline
   */
  private async initializeSipConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add timeout to prevent hanging if SIP server is unreachable
      const connectionTimeout = setTimeout(() => {
        this.logger.warn('SIP connection timeout after 5 seconds - continuing without SIP');
        resolve(); // Resolve to allow app to continue
      }, 5000);

      this.srf.connect({
        host: this.drachtioHost,
        port: this.drachtioPort,
        secret: this.drachtioSecret,
      });

      this.srf.on('connect', async (err, hostport) => {
        clearTimeout(connectionTimeout);
        if (err) {
          this.logger.error('SIP connection error:', err);
          reject(err);
          return;
        }

        this.logger.log(`SIP connected to ${hostport}`);

        // Initialize Media Service with SRF
        try {
          this.mediaService.initializeMrf(this.srf);
          this.logger.log('Media Service Mrf initialized');

          // Connect to Freeswitch media server
          await this.mediaService.connectToMediaServer();
          this.logger.log('Media Service connected to Freeswitch');
        } catch (error) {
          this.logger.warn(`Failed to initialize Media Service (calls will work without media features): ${error.message}`);
        }

        // Handle incoming INVITE (incoming calls)
        this.srf.invite(this.handleIncomingCall.bind(this));

        resolve();
      });

      this.srf.on('error', (err) => {
        this.logger.error('SIP error:', err);
      });
    });
  }

  /**
   * Handle incoming SIP call
   */
  private async handleIncomingCall(req: any, res: any) {
    const callId = req.get('Call-ID');
    const fromNumber = this.extractPhoneNumber(req.get('From'));
    const toNumber = this.extractPhoneNumber(req.get('To'));

    this.logger.log(`Incoming call: ${fromNumber} -> ${toNumber} (${callId})`);

    // Create call session
    const session: CallSession = {
      callId,
      direction: 'inbound',
      phoneNumber: fromNumber, // Customer's number
      from: fromNumber, // Customer is calling
      to: toNumber, // Our number (agent's assigned number)
      status: 'ringing',
      startedAt: new Date(),
    };

    this.activeCalls.set(callId, session);

    // Emit event for other services with req/res so they can handle the call
    // WebRtcGateway will decide: AI agent -> Freeswitch, or Manager -> manual handling
    this.emit('call:incoming', { session, req, res });

    // Note: The call handler (WebRtcGateway) is responsible for answering the call
    // either through MediaService.connectCaller() for AI or through manual handling
  }

  /**
   * Make outbound call
   */
  /**
   * Format phone number to E164 (11 digits, no +)
   */
  private formatPhoneNumberE164(number: string): string {
    // Remove all non-digits
    let digits = number.replace(/\D/g, '');

    // Ensure it's 11 digits (7 + 10)
    if (digits.length === 10 && !digits.startsWith('7')) {
      digits = '7' + digits; // Add country code if missing
    }

    return digits;
  }

  async makeCall(
    phoneNumber: string,
    fromNumber?: string,
  ): Promise<CallSession> {
    const callId = this.generateCallId();
    const from = this.formatPhoneNumberE164(fromNumber || this.sipNumber);
    const to = this.formatPhoneNumberE164(phoneNumber);

    this.logger.log(`Making outbound call: ${from} -> ${to}`);

    const session: CallSession = {
      callId,
      direction: 'outbound',
      phoneNumber: to, // Customer's number
      from: from, // Our number (agent's assigned number)
      to: to, // Customer's destination number
      status: 'ringing',
      startedAt: new Date(),
    };

    this.activeCalls.set(callId, session);

    try {
      const dialog = await this.srf.createUAC(
        `sip:${to}@${this.beelineTrunkHost}:${this.beelineTrunkPort}`,
        {
          localSdp: await this.generateSDP(),
          headers: {
            'From': `<sip:${from}@${this.beelineTrunkHost}>`,
            'Call-ID': callId,
          },
        },
      );

      session.status = 'ongoing';
      session.answeredAt = new Date();
      session.sipDialog = dialog;

      this.logger.log(`Outbound call connected: ${callId}`);

      // Emit event
      this.emit('call:connected', session);

      // Handle dialog events
      dialog.on('destroy', () => {
        this.handleCallEnd(callId, 'completed');
      });

      return session;

    } catch (error) {
      this.logger.error(`Failed to make call to ${phoneNumber}:`, error);
      session.status = 'failed';
      session.endedAt = new Date();
      this.emit('call:failed', session);
      this.activeCalls.delete(callId);
      throw error;
    }
  }

  /**
   * Hangup call
   */
  async hangupCall(callId: string): Promise<void> {
    const session = this.activeCalls.get(callId);

    if (!session) {
      throw new Error(`Call ${callId} not found`);
    }

    this.logger.log(`Hanging up call: ${callId}`);

    try {
      if (session.sipDialog) {
        session.sipDialog.destroy();
      }

      this.handleCallEnd(callId, 'completed');
    } catch (error) {
      this.logger.error(`Error hanging up call ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Handle call end
   */
  private handleCallEnd(callId: string, reason: 'completed' | 'failed') {
    const session = this.activeCalls.get(callId);

    if (!session) {
      return;
    }

    session.status = reason;
    session.endedAt = new Date();

    this.logger.log(`Call ended: ${callId} (${reason})`);

    // Emit event
    this.emit('call:ended', session);

    // Remove from active calls
    this.activeCalls.delete(callId);
  }

  /**
   * Send DTMF tones
   */
  async sendDTMF(callId: string, digits: string): Promise<void> {
    const session = this.activeCalls.get(callId);

    if (!session || !session.sipDialog) {
      throw new Error(`Call ${callId} not found or not active`);
    }

    this.logger.log(`Sending DTMF to ${callId}: ${digits}`);

    // Send DTMF using SIP INFO method
    await session.sipDialog.request({
      method: 'INFO',
      headers: {
        'Content-Type': 'application/dtmf-relay',
      },
      body: `Signal=${digits}\r\nDuration=100`,
    });
  }

  /**
   * Get active call by ID
   */
  getCall(callId: string): CallSession | undefined {
    return this.activeCalls.get(callId);
  }

  /**
   * Get all active calls
   */
  getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get call count
   */
  getActiveCallCount(): number {
    return this.activeCalls.size;
  }

  /**
   * Check if max sessions reached
   */
  isMaxSessionsReached(): boolean {
    return this.activeCalls.size >= this.maxSessions;
  }

  /**
   * Generate SDP for media negotiation
   */
  private async generateSDP(): Promise<string> {
    // This is a simplified SDP - in production, you'd generate proper SDP
    // with actual RTP endpoints
    const sdp = `v=0
o=- 0 0 IN IP4 ${this.beelineTrunkHost}
s=Voxi
c=IN IP4 ${this.beelineTrunkHost}
t=0 0
m=audio 20000 RTP/AVP 8 0 101
a=rtpmap:8 PCMA/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=sendrecv`;

    return sdp;
  }

  /**
   * Extract phone number from SIP URI
   */
  private extractPhoneNumber(uri: string): string {
    const match = uri.match(/sip:(\+?\d+)@/);
    return match ? match[1] : uri;
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get SIP statistics
   */
  getStatistics() {
    return {
      activeCalls: this.activeCalls.size,
      maxSessions: this.maxSessions,
      drachtioHost: this.drachtioHost,
      drachtioPort: this.drachtioPort,
      beelineTrunkHost: this.beelineTrunkHost,
      beelineTrunkPort: this.beelineTrunkPort,
      sipProtocol: this.sipProtocol,
    };
  }
}
