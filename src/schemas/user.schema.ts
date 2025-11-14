import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  SUPER_ADMIN = 'super_admin', // Platform admin
  COMPANY_ADMIN = 'company_admin', // Company owner
  MANAGER = 'manager', // Can manage users and settings
  AGENT = 'agent', // Regular user
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending', // Email not verified
  SUSPENDED = 'suspended',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: String, enum: UserRole, default: UserRole.AGENT })
  role: UserRole;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ trim: true })
  emailVerificationToken?: string;

  @Prop({ type: Date })
  emailVerificationExpiry?: Date;

  @Prop({ trim: true })
  passwordResetToken?: string;

  @Prop({ type: Date })
  passwordResetExpiry?: Date;

  @Prop({ trim: true })
  refreshToken?: string;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ trim: true })
  lastLoginIp?: string;

  @Prop({ trim: true })
  avatar?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ companyId: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });
UserSchema.index({ status: 1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function (this: UserDocument) {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });
