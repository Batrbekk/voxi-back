import { IsString, IsNotEmpty, IsMongoId, IsOptional, IsObject } from 'class-validator';

export class BatchCallRecipientDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsMongoId()
  @IsOptional()
  leadId?: string;

  @IsObject()
  @IsOptional()
  customVariables?: Record<string, any>;
}
