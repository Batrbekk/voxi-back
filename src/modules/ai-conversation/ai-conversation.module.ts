import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIConversationService } from './ai-conversation.service';
import { AgentSchema } from '../../schemas/agent.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Agent', schema: AgentSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
    GoogleCloudModule,
  ],
  providers: [AIConversationService],
  exports: [AIConversationService],
})
export class AIConversationModule {}
