import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VoiceSettingsDto, AISettingsDto, WorkingHoursDto } from './create-agent.dto';

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => VoiceSettingsDto)
  @IsOptional()
  voiceSettings?: VoiceSettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => AISettingsDto)
  @IsOptional()
  aiSettings?: AISettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkingHoursDto)
  @IsOptional()
  workingHours?: WorkingHoursDto;

  @IsString()
  @IsOptional()
  inboundGreetingMessage?: string;

  @IsString()
  @IsOptional()
  outboundGreetingMessage?: string;

  @IsString()
  @IsOptional()
  fallbackMessage?: string;

  @IsString()
  @IsOptional()
  endingMessage?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  phoneNumbers?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
