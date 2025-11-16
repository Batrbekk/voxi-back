import { IsString, IsNotEmpty, IsMongoId, IsOptional, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BatchCallRecipientDto } from './batch-call-recipient.dto';

export class CreateBatchCallDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  agentId: string;

  @IsMongoId()
  @IsNotEmpty()
  phoneNumberId: string;

  @IsDateString()
  @IsOptional()
  scheduledTime?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchCallRecipientDto)
  recipients: BatchCallRecipientDto[];
}
