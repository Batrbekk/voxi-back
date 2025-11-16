import { IsEnum, IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';
import { LeadStatus, LeadAction } from '../../../schemas/lead.schema';

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  @IsNotEmpty()
  status: LeadStatus;

  @IsEnum(LeadAction)
  @IsOptional()
  lastAction?: LeadAction;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  nextFollowUpAt?: string;
}
