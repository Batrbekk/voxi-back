import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { Lead, LeadSchema } from '../../schemas/lead.schema';
import { LeadHistory, LeadHistorySchema } from '../../schemas/lead-history.schema';
import { Manager, ManagerSchema } from '../../schemas/manager.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: LeadHistory.name, schema: LeadHistorySchema },
      { name: Manager.name, schema: ManagerSchema },
    ]),
  ],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}
