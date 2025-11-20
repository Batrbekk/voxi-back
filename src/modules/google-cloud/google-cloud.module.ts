import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleCloudService } from './google-cloud.service';
import { GoogleCloudTestController } from './google-cloud-test.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GoogleCloudTestController],
  providers: [GoogleCloudService],
  exports: [GoogleCloudService],
})
export class GoogleCloudModule {}
