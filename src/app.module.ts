import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { ManagerModule } from './modules/manager/manager.module';
import { LeadModule } from './modules/lead/lead.module';
import { AgentModule } from './modules/agent/agent.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { GoogleCloudModule } from './modules/google-cloud/google-cloud.module';
import { SipModule } from './modules/sip/sip.module';
import { WebRtcModule } from './modules/webrtc/webrtc.module';
import { PhoneModule } from './modules/phone/phone.module';
import { BatchCallsModule } from './modules/batch-calls/batch-calls.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: configService.get<string>('DATABASE_NAME'),
      }),
      inject: [ConfigService],
    }),

    // Schedule
    ScheduleModule.forRoot(),

    // Modules
    AuthModule,
    EmailModule,
    GoogleCloudModule,
    SipModule,
    WebRtcModule,
    ManagerModule,
    LeadModule,
    AgentModule,
    ConversationModule,
    PhoneModule,
    BatchCallsModule,
    KnowledgeBaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
