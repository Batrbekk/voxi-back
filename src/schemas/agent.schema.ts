import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AgentDocument = Agent & Document;

export enum AgentLanguage {
  RU = 'ru', // Russian
  EN = 'en', // English
  KZ = 'kz', // Kazakh
}

// Gemini Live voice options
export enum GeminiLiveVoice {
  // English voices
  PUCK = 'Puck', // Friendly, conversational
  CHARON = 'Charon', // Calm, professional
  KORE = 'Kore', // Warm, engaging
  FENRIR = 'Fenrir', // Deep, authoritative
  AOEDE = 'Aoede', // Clear, neutral - works well for Russian

  // Multilingual voices (work best for Russian/Kazakh)
  ORBIT = 'Orbit', // Versatile, clear
  VALE = 'Vale', // Natural, expressive
}

export interface VoiceSettings {
  voiceName: GeminiLiveVoice; // Gemini Live voice
  language: AgentLanguage;
  speakingRate?: number; // 0.5 to 2.0, default 1.0
  pitch?: number; // -10.0 to 10.0, default 0.0 (if supported)
}

export interface AISettings {
  model: string; // 'gemini-2.0-flash-exp' for Gemini Live
  systemPrompt: string;
  temperature: number; // 0.0 to 1.0, default 0.7
  responseModalities?: ('AUDIO' | 'TEXT')[]; // Audio and/or text responses
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
