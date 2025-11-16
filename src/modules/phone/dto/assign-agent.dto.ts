import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AssignAgentDto {
  @IsMongoId()
  @IsNotEmpty()
  agent_id: string;
}
