import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { DocumentProcessorService } from './document-processor.service';
import { KnowledgeBase, KnowledgeBaseSchema } from '../../schemas/knowledge-base.schema';
import { GoogleCloudModule } from '../google-cloud/google-cloud.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnowledgeBase.name, schema: KnowledgeBaseSchema },
    ]),
    GoogleCloudModule,
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, DocumentProcessorService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
