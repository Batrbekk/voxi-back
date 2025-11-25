import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiLiveService } from './gemini-live.service';
import { SipGeminiBridge } from './sip-gemini-bridge.service';

@Module({
  imports: [ConfigModule],
  providers: [GeminiLiveService, SipGeminiBridge],
  exports: [GeminiLiveService, SipGeminiBridge],
})
export class GeminiLiveModule {}