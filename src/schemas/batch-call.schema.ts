import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BatchCallDocument = BatchCall & Document;
export type BatchCallRecipientDocument = BatchCallRecipient & Document;

export enum BatchCallStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RecipientCallStatus {
  PENDING = 'pending',
  CALLING = 'calling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Schema({ _id: false })
export class BatchCallRecipient {
  @Prop({ required: true, trim: true })
  phoneNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Lead' })
  leadId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(RecipientCallStatus), default: RecipientCallStatus.PENDING })
  status: RecipientCallStatus;

  @Prop({ type: Types.ObjectId, ref: 'Conversation' })
  conversationId?: Types.ObjectId;

  @Prop({ type: Date })
  scheduledAt?: Date;

  @Prop({ type: Date })
  calledAt?: Date;

  @Prop({ type: Object, default: {} })
  customVariables: Record<string, any>;
}

export const BatchCallRecipientSchema = SchemaFactory.createForClass(BatchCallRecipient);

@Schema({ timestamps: true })
export class BatchCall {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true })
  agentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PhoneNumber', required: true })
  phoneNumberId: Types.ObjectId;

  @Prop({ type: Date })
  scheduledTime?: Date;

  @Prop({ type: String, enum: Object.values(BatchCallStatus), default: BatchCallStatus.SCHEDULED })
  status: BatchCallStatus;

  @Prop({ default: 0 })
  totalRecipientsCount: number;

  @Prop({ default: 0 })
  completedCallsCount: number;

  @Prop({ default: 0 })
  failedCallsCount: number;

  @Prop({ default: 0 })
  cancelledCallsCount: number;

  @Prop({ type: [BatchCallRecipientSchema], default: [] })
  recipients: BatchCallRecipient[];

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const BatchCallSchema = SchemaFactory.createForClass(BatchCall);
