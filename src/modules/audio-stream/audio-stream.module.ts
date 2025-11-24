import { Module } from '@nestjs/common';
import { AudioStreamService } from './audio-stream.service';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';

@Module({
  imports: [GoogleCloudModule],
  providers: [AudioStreamService],
  exports: [AudioStreamService],
})
export class AudioStreamModule {}
