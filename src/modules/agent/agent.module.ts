import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { Agent, AgentSchema } from '../../schemas/agent.schema';
import { ConversationSchema } from '../../schemas/conversation.schema';
import { PhoneNumberSchema } from '../../schemas/phone-number.schema';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'PhoneNumber', schema: PhoneNumberSchema },
    ]),
    GoogleCloudModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
