import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsDateString,
} from 'class-validator';
import { CallDirection, CallerType } from '../../../schemas/conversation.schema';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  callId: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsEnum(CallDirection)
  @IsNotEmpty()
  direction: CallDirection;

  @IsEnum(CallerType)
  @IsNotEmpty()
  callerType: CallerType;

  @IsMongoId()
  @IsOptional()
  agentId?: string;

  @IsMongoId()
  @IsOptional()
  managerId?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsDateString()
  @IsNotEmpty()
  startedAt: string;

  @IsMongoId()
  @IsOptional()
  leadId?: string;

  @IsString()
  @IsOptional()
  sipCallId?: string;

  @IsString()
  @IsOptional()
  sipFromUri?: string;

  @IsString()
  @IsOptional()
  sipToUri?: string;
}
