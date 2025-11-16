import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleCloudService } from './google-cloud.service';

@Module({
  imports: [ConfigModule],
  providers: [GoogleCloudService],
  exports: [GoogleCloudService],
})
export class GoogleCloudModule {}
