import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BatchCallsController } from './batch-calls.controller';
import { BatchCallsService } from './batch-calls.service';
import { BatchCall, BatchCallSchema } from '../../schemas/batch-call.schema';
import { PhoneModule } from '../phone/phone.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BatchCall.name, schema: BatchCallSchema },
    ]),
    PhoneModule,
  ],
  controllers: [BatchCallsController],
  providers: [BatchCallsService],
  exports: [BatchCallsService],
})
export class BatchCallsModule {}
