import { IsString, IsNotEmpty } from 'class-validator';

export class AddConversationNoteDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}
