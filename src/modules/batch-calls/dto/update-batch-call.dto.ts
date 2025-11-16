import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateBatchCallDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsDateString()
  @IsOptional()
  scheduledTime?: string;
}
