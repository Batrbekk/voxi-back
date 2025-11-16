import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { LeadSource, LeadStatus } from '../../../schemas/lead.schema';

export class UpdateLeadDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsEnum(LeadSource)
  @IsOptional()
  source?: LeadSource;

  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  score?: number;

  @IsString()
  @IsOptional()
  tags?: string;
}
