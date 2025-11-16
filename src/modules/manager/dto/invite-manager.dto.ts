import { IsEmail, IsNotEmpty, IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ManagerPermissions } from '../../../schemas/manager.schema';

export class InviteManagerDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  permissions?: Partial<ManagerPermissions>;
}
