import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PhoneNumberDocument = PhoneNumber & Document;

export interface SipConfig {
  server: string;
  port: number;
  protocol: 'UDP' | 'TCP';
  codec: string;
  maxSessions: number;
}

@Schema({ timestamps: true })
export class PhoneNumber {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  phoneNumber: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ type: String, enum: ['sip_trunk_beeline'], default: 'sip_trunk_beeline' })
  provider: string;

  @Prop({ type: Types.ObjectId, ref: 'Agent' })
  assignedAgentId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, enum: ['available', 'owned'], default: 'available' })
  status: 'available' | 'owned';

  @Prop({ type: Object, required: true })
  sipConfig: SipConfig;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ default: 0 })
  totalCallsCount: number;

  @Prop({ default: 0 })
  activeCallsCount: number;
}

export const PhoneNumberSchema = SchemaFactory.createForClass(PhoneNumber);

// Indexes
PhoneNumberSchema.index({ companyId: 1 });
PhoneNumberSchema.index({ phoneNumber: 1 }, { unique: true });
PhoneNumberSchema.index({ assignedAgentId: 1 });
PhoneNumberSchema.index({ provider: 1 });
PhoneNumberSchema.index({ isActive: 1 });
