import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class PreviewVoiceDto {
  @IsString()
  @IsNotEmpty()
  voiceName: string;

  @IsNumber()
  @Min(0.25)
  @Max(4.0)
  speakingRate: number;

  @IsNumber()
  @Min(-20.0)
  @Max(20.0)
  pitch: number;

  @IsString()
  @IsOptional()
  text?: string;
}
