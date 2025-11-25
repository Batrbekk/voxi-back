import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SipService } from './sip.service';
import { MediaModule } from '../media/media.module';
import { GeminiLiveModule } from '../gemini-live/gemini-live.module';

@Module({
  imports: [ConfigModule, MediaModule, GeminiLiveModule],
  providers: [SipService],
  exports: [SipService],
})
export class SipModule {}
