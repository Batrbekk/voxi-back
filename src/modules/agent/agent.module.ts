import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { Agent, AgentSchema } from '../../schemas/agent.schema';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
    ]),
    GoogleCloudModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
