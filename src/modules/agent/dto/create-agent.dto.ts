import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AgentLanguage, AgentGender } from '../../../schemas/agent.schema';

export class VoiceSettingsDto {
  @IsString()
  @IsNotEmpty()
  voiceName: string;

  @IsEnum(AgentLanguage)
  language: AgentLanguage;

  @IsEnum(AgentGender)
  gender: AgentGender;

  @IsNumber()
  @Min(0.25)
  @Max(4.0)
  speakingRate: number;

  @IsNumber()
  @Min(-20.0)
  @Max(20.0)
  pitch: number;

  @IsNumber()
  @Min(-96.0)
  @Max(16.0)
  volumeGainDb: number;
}

export class AISettingsDto {
  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  temperature: number;

  @IsNumber()
  @Min(1)
  maxTokens: number;

  @IsBoolean()
  integratedWithAi: boolean;
}

export class WorkingHoursDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsNotEmpty()
  timezone: string;

  @IsString()
  @IsNotEmpty()
  start: string;

  @IsString()
  @IsNotEmpty()
  end: string;

  @IsArray()
  @IsNumber({}, { each: true })
  workDays: number[];
}

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => VoiceSettingsDto)
  voiceSettings: VoiceSettingsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => AISettingsDto)
  aiSettings: AISettingsDto;

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
}
