import { IsString, IsNotEmpty, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SipConfigDto {
  @IsString()
  @IsNotEmpty()
  server: string;

  @IsNotEmpty()
  port: number;

  @IsString()
  @IsNotEmpty()
  protocol: 'UDP' | 'TCP';

  @IsString()
  @IsNotEmpty()
  codec: string;

  @IsNotEmpty()
  maxSessions: number;
}

export class CreatePhoneNumberDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SipConfigDto)
  sipConfig: SipConfigDto;
}
