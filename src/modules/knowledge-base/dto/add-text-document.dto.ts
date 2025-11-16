import { IsString, IsNotEmpty } from 'class-validator';

export class AddTextDocumentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
