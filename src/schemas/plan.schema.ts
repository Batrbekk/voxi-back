import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

export enum PlanType {
  STARTER = 'starter',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
}

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true, unique: true, enum: PlanType })
  type: PlanType;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  nameRu: string;

  @Prop({ required: true })
  priceKzt: number;

  @Prop({ required: true })
  priceUsd: number;

  @Prop({ required: true })
  minutesIncluded: number;

  @Prop({ required: true })
  maxAgents: number;

  @Prop({ required: true })
  maxManagers: number;

  @Prop({ required: true })
  pricePerExtraMinute: number; // в тенге

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
