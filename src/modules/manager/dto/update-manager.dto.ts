import { IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ManagerPermissions } from '../../../schemas/manager.schema';

export class UpdateManagerDto {
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  permissions?: Partial<ManagerPermissions>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
