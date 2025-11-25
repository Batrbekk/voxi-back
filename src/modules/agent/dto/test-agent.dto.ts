import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class TestTranscribeDto {
  @IsString()
  @IsNotEmpty()
  audioBase64: string; // Base64 encoded audio data
}

export class TestChatDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class TestSynthesizeDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class SaveTestConversationDto {
  @IsArray()
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}
