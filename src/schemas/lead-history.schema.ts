import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LeadStatus, LeadAction } from './lead.schema';

export type LeadHistoryDocument = LeadHistory & Document;

export enum ChangeType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  STATUS_CHANGE = 'status_change',
  ASSIGNMENT = 'assignment',
  CONVERSATION = 'conversation',
  NOTE_ADDED = 'note_added',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
  FIELD_UPDATE = 'field_update',
  FOLLOW_UP_SCHEDULED = 'follow_up_scheduled',
}

export enum ChangedBy {
  AI = 'ai',
  USER = 'user',
  SYSTEM = 'system',
}

@Schema({ timestamps: true })
export class LeadHistory {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: String, enum: ChangeType, required: true })
  changeType: ChangeType;

  @Prop({ type: String, enum: ChangedBy, required: true })
  changedBy: ChangedBy;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId; // If changed by user

  @Prop({ trim: true })
  userName?: string;

  // Status change
  @Prop({ type: String, enum: LeadStatus })
  previousStatus?: LeadStatus;

  @Prop({ type: String, enum: LeadStatus })
  newStatus?: LeadStatus;

  // Assignment change
  @Prop({ type: Types.ObjectId, ref: 'User' })
  previousAssignedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  newAssignedTo?: Types.ObjectId;

  // Conversation reference
  @Prop({ type: Types.ObjectId, ref: 'Conversation' })
  conversationId?: Types.ObjectId;

  @Prop({ type: String, enum: LeadAction })
  conversationAction?: LeadAction;

  // Generic changes
  @Prop({ trim: true })
  fieldName?: string;

  @Prop({ type: Object })
  oldValue?: any;

  @Prop({ type: Object })
  newValue?: any;

  @Prop({ trim: true })
  reason?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const LeadHistorySchema = SchemaFactory.createForClass(LeadHistory);

// Indexes
LeadHistorySchema.index({ leadId: 1 });
LeadHistorySchema.index({ companyId: 1 });
LeadHistorySchema.index({ changeType: 1 });
LeadHistorySchema.index({ changedBy: 1 });
LeadHistorySchema.index({ userId: 1 });
LeadHistorySchema.index({ conversationId: 1 });
LeadHistorySchema.index({ createdAt: -1 });

// Compound indexes
LeadHistorySchema.index({ leadId: 1, createdAt: -1 });
LeadHistorySchema.index({ companyId: 1, createdAt: -1 });
LeadHistorySchema.index({ leadId: 1, changeType: 1, createdAt: -1 });
