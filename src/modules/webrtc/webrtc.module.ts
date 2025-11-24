import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebRtcGateway } from './webrtc.gateway';
import { SipModule } from '../sip/sip.module';
import { ConversationModule } from '../conversation/conversation.module';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';
import { AIConversationModule } from '../ai-conversation/ai-conversation.module';
import { AgentSchema } from '../../schemas/agent.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Agent', schema: AgentSchema }]),
    SipModule,
    ConversationModule,
    GoogleCloudModule,
    AIConversationModule,
  ],
  providers: [WebRtcGateway],
  exports: [WebRtcGateway],
})
export class WebRtcModule {}
