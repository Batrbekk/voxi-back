import { IsString, IsNotEmpty } from 'class-validator';

export class AddConversationTagDto {
  @IsString()
  @IsNotEmpty()
  tag: string;
}
