import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AgentDocument = Agent & Document;

export enum AgentLanguage {
  RU_RU = 'ru-RU',
  EN_US = 'en-US',
  KK_KZ = 'kk-KZ',
}

export enum AgentGender {
  MALE = 'male',
  FEMALE = 'female',
  NEUTRAL = 'neutral',
}

export interface VoiceSettings {
  voiceName: string; // Google TTS voice name (e.g., 'ru-RU-Wavenet-A')
  language: AgentLanguage;
  gender: AgentGender;
  speakingRate: number; // 0.25 to 4.0, default 1.0
  pitch: number; // -20.0 to 20.0, default 0.0
  volumeGainDb: number; // -96.0 to 16.0, default 0.0
}

export interface AISettings {
  model: string; // e.g., 'gemini-2.0-flash-001'
  systemPrompt: string;
  temperature: number; // 0.0 to 1.0
  maxTokens: number;
  integratedWithAi: boolean;
}

export interface WorkingHours {
  enabled: boolean;
  timezone: string;
  start: string; // HH:mm format
  end: string; // HH:mm format
  workDays: number[]; // [1,2,3,4,5] for Mon-Fri
}

@Schema({ timestamps: true })
export class Agent {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Object, required: true })
  voiceSettings: VoiceSettings;

  @Prop({ type: Object, required: true })
  aiSettings: AISettings;

  @Prop({ type: Object })
  workingHours?: WorkingHours;

  @Prop({ type: Types.ObjectId, ref: 'KnowledgeBase' })
  knowledgeBaseId?: Types.ObjectId;

  @Prop({ trim: true })
  inboundGreetingMessage?: string;

  @Prop({ trim: true })
  outboundGreetingMessage?: string;

  @Prop({ trim: true })
  fallbackMessage?: string;

  @Prop({ trim: true })
  endingMessage?: string;

  @Prop({ type: [String], default: [] })
  phoneNumbers: string[]; // Assigned phone numbers

  @Prop({ default: 0 })
  totalCalls: number;

  @Prop({ default: 0 })
  successfulCalls: number;

  @Prop({ default: 0 })
  failedCalls: number;

  @Prop({ default: 0 })
  averageDuration: number; // in seconds

  @Prop({ default: 0 })
  conversionRate: number; // percentage

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Date })
  lastUsedAt?: Date;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

// Indexes
AgentSchema.index({ companyId: 1 });
AgentSchema.index({ isActive: 1 });
AgentSchema.index({ createdAt: -1 });
AgentSchema.index({ lastUsedAt: -1 });

// Compound indexes
AgentSchema.index({ companyId: 1, isActive: 1 });
AgentSchema.index({ companyId: 1, name: 1 });
