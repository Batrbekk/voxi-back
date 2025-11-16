import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { AssignmentType } from '../../../schemas/lead.schema';

export class AssignLeadDto {
  @IsString()
  @IsNotEmpty()
  managerId: string;

  @IsEnum(AssignmentType)
  @IsOptional()
  assignedBy?: AssignmentType;
}
