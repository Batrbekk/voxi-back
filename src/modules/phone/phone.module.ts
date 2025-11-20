import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PhoneController } from './phone.controller';
import { PhoneService } from './phone.service';
import { PhoneNumber, PhoneNumberSchema } from '../../schemas/phone-number.schema';
import { Agent, AgentSchema } from '../../schemas/agent.schema';
import { SipModule } from '../sip/sip.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PhoneNumber.name, schema: PhoneNumberSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    SipModule,
    forwardRef(() => ConversationModule),
  ],
  controllers: [PhoneController],
  providers: [PhoneService],
  exports: [PhoneService],
})
export class PhoneModule {}
