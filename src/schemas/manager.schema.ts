import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ManagerDocument = Manager & Document;

export interface ManagerPermissions {
  canViewAllLeads: boolean;
  canTakeLeads: boolean;
  canEditLeads: boolean;
  canMakeCallsAsAgent: boolean;
  canViewAnalytics: boolean;
  canManageOwnLeads: boolean;
}

@Schema({ timestamps: true })
export class Manager {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  addedBy: Types.ObjectId; // Company admin who added this manager

  @Prop({
    type: Object,
    default: {
      canViewAllLeads: true,
      canTakeLeads: true,
      canEditLeads: true,
      canMakeCallsAsAgent: true,
      canViewAnalytics: false,
      canManageOwnLeads: true,
    },
  })
  permissions: ManagerPermissions;

  @Prop({ default: 0 })
  assignedLeadsCount: number;

  @Prop({ default: 0 })
  completedCallsCount: number;

  @Prop({ default: 0 })
  successfulConversionsCount: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, required: true })
  invitedAt: Date;

  @Prop({ type: Date })
  firstLoginAt?: Date;

  @Prop({ type: Date })
  lastActivityAt?: Date;

  @Prop({ trim: true })
  temporaryPassword?: string; // For first-time login

  @Prop({ default: false })
  hasChangedPassword: boolean;

  @Prop({ type: [String], default: [] })
  notes: string[];
}

export const ManagerSchema = SchemaFactory.createForClass(Manager);

// Indexes
ManagerSchema.index({ userId: 1 });
ManagerSchema.index({ companyId: 1 });
ManagerSchema.index({ addedBy: 1 });
ManagerSchema.index({ isActive: 1 });
ManagerSchema.index({ invitedAt: -1 });

// Compound indexes for queries
ManagerSchema.index({ companyId: 1, isActive: 1 });
ManagerSchema.index({ userId: 1, companyId: 1 }, { unique: true });
