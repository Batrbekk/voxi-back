import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsArray,
  IsObject,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CallStatus,
  SentimentType,
  TranscriptSegment,
} from '../../../schemas/conversation.schema';
import { LeadAction } from '../../../schemas/lead.schema';

class TranscriptSegmentDto {
  @IsString()
  speaker: 'caller' | 'callee';

  @IsString()
  text: string;

  @IsNumber()
  timestamp: number;

  @IsNumber()
  @Min(0)
  confidence: number;
}

class AIAnalysisDto {
  @IsString()
  summary: string;

  @IsEnum(SentimentType)
  sentiment: SentimentType;

  @IsArray()
  @IsString({ each: true })
  keyPoints: string[];

  @IsString()
  @IsOptional()
  customerIntention?: string;

  @IsArray()
  @IsString({ each: true })
  nextSteps: string[];

  @IsEnum(LeadAction)
  @IsOptional()
  recommendedAction?: LeadAction;
}

export class UpdateConversationDto {
  @IsEnum(CallStatus)
  @IsOptional()
  status?: CallStatus;

  @IsDateString()
  @IsOptional()
  answeredAt?: string;

  @IsDateString()
  @IsOptional()
  endedAt?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  duration?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  ringDuration?: number;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  audioFormat?: string;

  @IsString()
  @IsOptional()
  transcript?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentDto)
  @IsOptional()
  transcriptSegments?: TranscriptSegmentDto[];

  @ValidateNested()
  @Type(() => AIAnalysisDto)
  @IsOptional()
  aiAnalysis?: AIAnalysisDto;

  @IsEnum(LeadAction)
  @IsOptional()
  leadAction?: LeadAction;

  @IsDateString()
  @IsOptional()
  nextFollowUp?: string;

  @IsDateString()
  @IsOptional()
  recordingStartedAt?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  errors?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
