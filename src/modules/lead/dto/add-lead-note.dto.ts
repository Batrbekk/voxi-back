import { IsNotEmpty, IsString } from 'class-validator';

export class AddLeadNoteDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}
