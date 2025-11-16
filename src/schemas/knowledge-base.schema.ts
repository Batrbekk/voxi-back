import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type KnowledgeBaseDocument = KnowledgeBase & Document;
export type KnowledgeBaseItemDocument = KnowledgeBaseItem & Document;

export enum DocumentType {
  TEXT = 'text',
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  URL = 'url',
}

export enum DocumentStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ _id: false, timestamps: true })
export class KnowledgeBaseItem {
  @Prop({ type: String, enum: Object.values(DocumentType), required: true })
  type: DocumentType;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String })
  content?: string;

  @Prop({ type: String })
  originalFileName?: string;

  @Prop({ type: String })
  url?: string;

  @Prop({ type: String })
  fileUrl?: string;

  @Prop({ type: String, enum: Object.values(DocumentStatus), default: DocumentStatus.PROCESSING })
  status: DocumentStatus;

  @Prop({ type: Object, default: {} })
  metadata: {
    fileSize?: number;
    mimeType?: string;
    pageCount?: number;
    wordCount?: number;
    language?: string;
    uploadedAt?: Date;
    processedAt?: Date;
    error?: string;
  };

  @Prop({ type: [Number] })
  embedding?: number[];

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const KnowledgeBaseItemSchema = SchemaFactory.createForClass(KnowledgeBaseItem);

@Schema({ timestamps: true })
export class KnowledgeBase {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [KnowledgeBaseItemSchema], default: [] })
  documents: KnowledgeBaseItem[];

  @Prop({ default: 0 })
  totalDocuments: number;

  @Prop({ default: 0 })
  totalWordCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date })
  lastUpdatedAt?: Date;
}

export const KnowledgeBaseSchema = SchemaFactory.createForClass(KnowledgeBase);

// Add indexes
KnowledgeBaseSchema.index({ companyId: 1 });
KnowledgeBaseSchema.index({ name: 1, companyId: 1 });
