import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeadDocument = Lead & Document;

export enum LeadSource {
  COLD_CALL = 'cold_call',
  INBOUND = 'inbound',
  REFERRAL = 'referral',
  WEBSITE = 'website',
  SOCIAL_MEDIA = 'social_media',
  MANUAL = 'manual',
  IMPORT = 'import',
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
  ON_HOLD = 'on_hold',
}

export enum AssignmentType {
  AI = 'ai',
  ADMIN = 'admin',
  SELF = 'self',
  AUTO = 'auto',
}

export enum LeadAction {
  INTERESTED = 'interested',
  NOT_INTERESTED = 'not_interested',
  NEEDS_FOLLOWUP = 'needs_followup',
  CONVERTED = 'converted',
  NO_ANSWER = 'no_answer',
  WRONG_NUMBER = 'wrong_number',
}

@Schema({ timestamps: true })
export class Lead {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  company?: string;

  @Prop({ trim: true })
  position?: string;

  @Prop({ type: String, enum: LeadSource, default: LeadSource.MANUAL })
  source: LeadSource;

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId; // Manager or agent

  @Prop({ type: Date })
  assignedAt?: Date;

  @Prop({ type: String, enum: AssignmentType })
  assignedBy?: AssignmentType;

  @Prop({ default: true })
  isAvailable: boolean; // Available for taking by managers

  @Prop({ default: true })
  isInPool: boolean; // In the lead pool for managers to take

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  score: number; // AI quality score

  @Prop({ type: String, enum: LeadAction })
  lastAction?: LeadAction;

  @Prop({ type: Date })
  lastActionAt?: Date;

  @Prop({ type: Date })
  lastContactedAt?: Date;

  @Prop({ type: Date })
  nextFollowUpAt?: Date;

  @Prop({ default: 0 })
  contactAttempts: number;

  @Prop({ default: 0 })
  conversationsCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  notes: string[];

  @Prop({ type: Object })
  customFields?: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// Indexes
LeadSchema.index({ companyId: 1 });
LeadSchema.index({ phone: 1 });
LeadSchema.index({ email: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({ assignedTo: 1 });
LeadSchema.index({ isAvailable: 1 });
LeadSchema.index({ score: -1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ nextFollowUpAt: 1 });

// Compound indexes
LeadSchema.index({ companyId: 1, status: 1 });
LeadSchema.index({ companyId: 1, assignedTo: 1 });
LeadSchema.index({ companyId: 1, isAvailable: 1, score: -1 });
LeadSchema.index({ companyId: 1, phone: 1 }, { unique: true });

// Virtual for full name
LeadSchema.virtual('fullName').get(function (this: LeadDocument) {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON
LeadSchema.set('toJSON', { virtuals: true });
LeadSchema.set('toObject', { virtuals: true });
