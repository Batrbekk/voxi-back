import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  TRIAL = 'trial',
}

@Schema({ _id: false })
export class UsageStats {
  @Prop({ default: 0 })
  minutesUsed: number;

  @Prop({ default: 0 })
  agentsCreated: number;

  @Prop({ default: 0 })
  managersCreated: number;

  @Prop({ default: 0 })
  whatsappMessagesUsed: number;
}

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, unique: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Plan', required: true })
  planId: Types.ObjectId;

  @Prop({ required: true, enum: SubscriptionStatus, default: SubscriptionStatus.TRIAL })
  status: SubscriptionStatus;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: UsageStats, default: () => ({}) })
  currentPeriodUsage: UsageStats;

  @Prop({ default: false })
  autoRenew: boolean;

  @Prop({ default: false })
  whatsappEnabled: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Plan' })
  whatsappPlanId?: Types.ObjectId;

  @Prop({ default: 0 })
  whatsappMessagesIncluded: number;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Индексы для быстрого поиска
SubscriptionSchema.index({ companyId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ endDate: 1 });
