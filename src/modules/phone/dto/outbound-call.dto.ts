import { IsString, IsNotEmpty, IsMongoId, IsOptional } from 'class-validator';

export class OutboundCallDto {
  @IsMongoId()
  @IsNotEmpty()
  agent_id: string;

  @IsMongoId()
  @IsNotEmpty()
  agent_phone_number_id: string;

  @IsString()
  @IsNotEmpty()
  to_number: string;

  @IsMongoId()
  @IsOptional()
  lead_id?: string;
}
