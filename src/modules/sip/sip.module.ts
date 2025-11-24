import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SipService } from './sip.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [ConfigModule, MediaModule],
  providers: [SipService],
  exports: [SipService],
})
export class SipModule {}
