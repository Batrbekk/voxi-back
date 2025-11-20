import { IsMongoId, IsOptional } from 'class-validator';

export class AssignAgentDto {
  @IsMongoId()
  @IsOptional()
  agentId?: string;
}
