import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PhoneController } from './phone.controller';
import { PhoneService } from './phone.service';
import { PhoneNumber, PhoneNumberSchema } from '../../schemas/phone-number.schema';
import { SipModule } from '../sip/sip.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PhoneNumber.name, schema: PhoneNumberSchema },
    ]),
    SipModule,
    ConversationModule,
  ],
  controllers: [PhoneController],
  providers: [PhoneService],
  exports: [PhoneService],
})
export class PhoneModule {}
