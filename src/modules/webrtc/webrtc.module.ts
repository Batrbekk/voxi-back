import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebRtcGateway } from './webrtc.gateway';
import { SipModule } from '../sip/sip.module';
import { ConversationModule } from '../conversation/conversation.module';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';
import { AIConversationModule } from '../ai-conversation/ai-conversation.module';
import { MediaModule } from '../media/media.module';
import { GeminiLiveModule } from '../gemini-live/gemini-live.module';
import { AgentSchema } from '../../schemas/agent.schema';
import { KnowledgeBaseSchema } from '../../schemas/knowledge-base.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Agent', schema: AgentSchema },
      { name: 'KnowledgeBase', schema: KnowledgeBaseSchema },
    ]),
    SipModule,
    ConversationModule,
    GoogleCloudModule,
    AIConversationModule,
    MediaModule,
    GeminiLiveModule,
  ],
  providers: [WebRtcGateway],
  exports: [WebRtcGateway],
})
export class WebRtcModule {}
