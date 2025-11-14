import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  website?: string;

  @Prop({ type: String, enum: CompanyStatus, default: CompanyStatus.TRIAL })
  status: CompanyStatus;

  @Prop({ type: String, enum: SubscriptionPlan, default: SubscriptionPlan.FREE })
  subscriptionPlan: SubscriptionPlan;

  @Prop({ type: Date })
  subscriptionExpiry?: Date;

  @Prop({ type: Date })
  trialEndsAt?: Date;

  // SIP Configuration for this company
  @Prop({ type: Object })
  sipConfig?: {
    enabled: boolean;
    number?: string;
    maxConcurrentCalls?: number;
  };

  // Google Cloud Storage bucket for this company's recordings
  @Prop({ trim: true })
  storageBucket?: string;

  @Prop({ type: Object })
  settings?: {
    timezone?: string;
    language?: string;
    currency?: string;
  };

  @Prop({ default: true })
  isActive: boolean;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

// Indexes
CompanySchema.index({ email: 1 });
CompanySchema.index({ status: 1 });
