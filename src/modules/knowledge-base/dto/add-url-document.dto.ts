import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class AddUrlDocumentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsUrl()
  @IsNotEmpty()
  url: string;
}
