import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LeadAction } from './lead.schema';

export type ConversationDocument = Conversation & Document;

export enum CallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum CallStatus {
  RINGING = 'ringing',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  MISSED = 'missed',
  NO_ANSWER = 'no_answer',
  BUSY = 'busy',
}

export enum CallerType {
  AI_AGENT = 'ai_agent',
  HUMAN_MANAGER = 'human_manager',
}

export enum SentimentType {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
}

export interface TranscriptSegment {
  speaker: 'caller' | 'callee';
  text: string;
  timestamp: number;
  confidence: number;
}

export enum CallOutcome {
  AGREED_TO_BUY = 'agreed_to_buy',
  REJECTED = 'rejected',
  NEEDS_FOLLOWUP = 'needs_followup',
  THINKING = 'thinking',
  NOT_INTERESTED = 'not_interested',
  INFORMATION_PROVIDED = 'information_provided',
  OTHER = 'other',
}

export interface ExtractedCustomerData {
  name?: string;
  email?: string;
  phone?: string;
  budget?: string;
  preferences?: string[];
  specialRequirements?: string;
  bestTimeToCall?: string;
  additionalInfo?: Record<string, any>;
}

export interface AIAnalysis {
  summary: string;
  sentiment: SentimentType;
  keyPoints: string[];
  customerIntention?: string;
  nextSteps: string[];
  recommendedAction?: LeadAction;

  // Enhanced fields for detailed analysis
  callOutcome?: CallOutcome;
  extractedCustomerData?: ExtractedCustomerData;
  dealProbability?: number; // 0-100
  conversationQuality?: number; // 0-10
  concerns?: string[]; // Customer concerns or objections
}

@Schema({ timestamps: true })
export class Conversation {
  // Basic call information
  @Prop({ required: true, unique: true })
  callId: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  phoneNumber: string;

  @Prop({ type: String, enum: CallDirection, required: true })
  direction: CallDirection;

  @Prop({ type: String, enum: CallStatus, default: CallStatus.RINGING })
  status: CallStatus;

  // Caller information
  @Prop({ type: String, enum: CallerType, required: true })
  callerType: CallerType;

  @Prop({ type: Types.ObjectId, ref: 'Agent' })
  agentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  managerId?: Types.ObjectId;

  @Prop({ trim: true })
  managerName?: string;

  // Timing
  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date })
  answeredAt?: Date;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ default: 0 })
  duration: number; // in seconds

  @Prop({ default: 0 })
  ringDuration: number; // in seconds

  // Audio and transcription
  @Prop({ trim: true })
  audioUrl?: string; // Google Storage URL

  @Prop({ default: 'webm' })
  audioFormat: string;

  @Prop({ type: String })
  transcript?: string;

  @Prop({ type: [Object], default: [] })
  transcriptSegments: TranscriptSegment[];

  // AI analysis
  @Prop({ type: Object })
  aiAnalysis?: AIAnalysis;

  // CRM integration
  @Prop({ type: Types.ObjectId, ref: 'Lead' })
  leadId?: Types.ObjectId;

  @Prop({ type: String, enum: LeadAction })
  leadAction?: LeadAction;

  @Prop({ type: Date })
  nextFollowUp?: Date;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  notes: string[];

  // Technical SIP information
  @Prop({ trim: true })
  sipCallId?: string;

  @Prop({ trim: true })
  sipFromUri?: string;

  @Prop({ trim: true })
  sipToUri?: string;

  @Prop({ type: Date })
  recordingStartedAt?: Date;

  @Prop({ type: [String], default: [] })
  errors: string[];

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ callId: 1 }, { unique: true });
ConversationSchema.index({ companyId: 1 });
ConversationSchema.index({ phoneNumber: 1 });
ConversationSchema.index({ status: 1 });
ConversationSchema.index({ callerType: 1 });
ConversationSchema.index({ agentId: 1 });
ConversationSchema.index({ managerId: 1 });
ConversationSchema.index({ leadId: 1 });
ConversationSchema.index({ startedAt: -1 });
ConversationSchema.index({ createdAt: -1 });

// Compound indexes
ConversationSchema.index({ companyId: 1, status: 1 });
ConversationSchema.index({ companyId: 1, startedAt: -1 });
ConversationSchema.index({ companyId: 1, leadId: 1 });
ConversationSchema.index({ companyId: 1, callerType: 1, startedAt: -1 });
