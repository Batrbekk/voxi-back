import { Module } from '@nestjs/common';
import { WebRtcGateway } from './webrtc.gateway';
import { SipModule } from '../sip/sip.module';
import { ConversationModule } from '../conversation/conversation.module';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';

@Module({
  imports: [SipModule, ConversationModule, GoogleCloudModule],
  providers: [WebRtcGateway],
  exports: [WebRtcGateway],
})
export class WebRtcModule {}
