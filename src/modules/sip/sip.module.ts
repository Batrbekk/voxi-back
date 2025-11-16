import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SipService } from './sip.service';

@Module({
  imports: [ConfigModule],
  providers: [SipService],
  exports: [SipService],
})
export class SipModule {}
