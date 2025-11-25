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
import { AgentLanguage, GeminiLiveVoice } from '../../../schemas/agent.schema';

export class VoiceSettingsDto {
  @IsEnum(GeminiLiveVoice)
  @IsNotEmpty()
  voiceName: GeminiLiveVoice;

  @IsEnum(AgentLanguage)
  language: AgentLanguage;

  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  @IsOptional()
  speakingRate?: number;

  @IsNumber()
  @Min(-10.0)
  @Max(10.0)
  @IsOptional()
  pitch?: number;
}

export class AISettingsDto {
  @IsString()
  @IsNotEmpty()
  model: string; // gemini-2.0-flash-exp for Gemini Live

  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  temperature: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  responseModalities?: ('AUDIO' | 'TEXT')[];
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

  @IsString()
  @IsOptional()
  knowledgeBaseId?: string;
}
