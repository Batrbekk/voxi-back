import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeBase, KnowledgeBaseDocument, DocumentType, DocumentStatus } from '../../schemas/knowledge-base.schema';
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, AddTextDocumentDto, AddUrlDocumentDto } from './dto';
import { DocumentProcessorService } from './document-processor.service';
import { GoogleCloudService } from '../google-cloud/google-cloud.service';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @InjectModel(KnowledgeBase.name) private knowledgeBaseModel: Model<KnowledgeBaseDocument>,
    private documentProcessor: DocumentProcessorService,
    private googleCloudService: GoogleCloudService,
  ) {}

  /**
   * Create a new knowledge base
   */
  async create(
    companyId: string,
    userId: string,
    createDto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseDocument> {
    const knowledgeBase = new this.knowledgeBaseModel({
      companyId: new Types.ObjectId(companyId),
      createdBy: new Types.ObjectId(userId),
      ...createDto,
      documents: [],
      totalDocuments: 0,
      totalWordCount: 0,
    });

    return knowledgeBase.save();
  }

  /**
   * Get all knowledge bases for a company
   */
  async findAll(companyId: string, pageSize: number = 20): Promise<KnowledgeBaseDocument[]> {
    return this.knowledgeBaseModel
      .find({ companyId: new Types.ObjectId(companyId) })
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .exec();
  }

  /**
   * Get knowledge base by ID
   */
  async findOne(companyId: string, id: string): Promise<KnowledgeBaseDocument> {
    const knowledgeBase = await this.knowledgeBaseModel
      .findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
      })
      .exec();

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    return knowledgeBase;
  }

  /**
   * Update knowledge base
   */
  async update(
    companyId: string,
    id: string,
    updateDto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseDocument> {
    const knowledgeBase = await this.findOne(companyId, id);

    Object.assign(knowledgeBase, updateDto);
    knowledgeBase.lastUpdatedAt = new Date();

    return knowledgeBase.save();
  }

  /**
   * Delete knowledge base
   */
  async remove(companyId: string, id: string): Promise<void> {
    const knowledgeBase = await this.findOne(companyId, id);

    // Delete all uploaded files from Google Cloud Storage
    for (const doc of knowledgeBase.documents) {
      if (doc.fileUrl) {
        try {
          const fileName = doc.fileUrl.split('/').pop()?.split('?')[0];
          if (fileName) {
            await this.googleCloudService.deleteAudioFile(fileName);
          }
        } catch (error) {
          this.logger.error(`Failed to delete file: ${error.message}`);
        }
      }
    }

    await this.knowledgeBaseModel.deleteOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId),
    });
  }

  /**
   * Add text document to knowledge base
   */
  async addTextDocument(
    companyId: string,
    id: string,
    textDto: AddTextDocumentDto,
  ): Promise<KnowledgeBaseDocument> {
    const knowledgeBase = await this.findOne(companyId, id);

    const wordCount = this.documentProcessor.countWords(textDto.content);

    knowledgeBase.documents.push({
      type: DocumentType.TEXT,
      title: textDto.title,
      content: textDto.content,
      status: DocumentStatus.COMPLETED,
      metadata: {
        wordCount,
        uploadedAt: new Date(),
        processedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    knowledgeBase.totalDocuments++;
    knowledgeBase.totalWordCount += wordCount;
    knowledgeBase.lastUpdatedAt = new Date();

    return knowledgeBase.save();
  }

  /**
   * Add URL document to knowledge base
   */
  async addUrlDocument(
    companyId: string,
    id: string,
    urlDto: AddUrlDocumentDto,
  ): Promise<KnowledgeBaseDocument> {
    const knowledgeBase = await this.findOne(companyId, id);

    // Add document with processing status
    const docIndex = knowledgeBase.documents.push({
      type: DocumentType.URL,
      title: urlDto.title,
      url: urlDto.url,
      status: DocumentStatus.PROCESSING,
      metadata: {
        uploadedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }) - 1;

    knowledgeBase.totalDocuments++;
    await knowledgeBase.save();

    // Process URL in background
    this.processUrlDocument(knowledgeBase, docIndex, urlDto.url).catch((error) => {
      this.logger.error(`Failed to process URL: ${error.message}`, error.stack);
    });

    return knowledgeBase;
  }

  /**
   * Process URL document in background
   */
  private async processUrlDocument(
    knowledgeBase: KnowledgeBaseDocument,
    docIndex: number,
    url: string,
  ): Promise<void> {
    try {
      const result = await this.documentProcessor.processUrl(url);

      const doc = knowledgeBase.documents[docIndex];
      doc.content = result.text;
      doc.title = result.title || doc.title;
      doc.status = DocumentStatus.COMPLETED;
      doc.metadata.wordCount = this.documentProcessor.countWords(result.text);
      doc.metadata.processedAt = new Date();

      knowledgeBase.totalWordCount += doc.metadata.wordCount || 0;
      knowledgeBase.lastUpdatedAt = new Date();

      await knowledgeBase.save();

      this.logger.log(`URL processed successfully: ${url}`);
    } catch (error) {
      const doc = knowledgeBase.documents[docIndex];
      doc.status = DocumentStatus.FAILED;
      doc.metadata.error = error.message;
      await knowledgeBase.save();

      this.logger.error(`Failed to process URL ${url}: ${error.message}`);
    }
  }

  /**
   * Upload and process file document
   */
  async uploadFileDocument(
    companyId: string,
    id: string,
    file: Express.Multer.File,
  ): Promise<KnowledgeBaseDocument> {
    const knowledgeBase = await this.findOne(companyId, id);

    // Add document with processing status
    const docIndex = knowledgeBase.documents.push({
      type: DocumentType.PDF, // Will be updated after processing
      title: file.originalname,
      originalFileName: file.originalname,
      status: DocumentStatus.PROCESSING,
      metadata: {
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }) - 1;

    knowledgeBase.totalDocuments++;
    await knowledgeBase.save();

    // Process file in background
    this.processFileDocument(knowledgeBase, docIndex, file).catch((error) => {
      this.logger.error(`Failed to process file: ${error.message}`, error.stack);
    });

    return knowledgeBase;
  }

  /**
   * Process file document in background
   */
  private async processFileDocument(
    knowledgeBase: KnowledgeBaseDocument,
    docIndex: number,
    file: Express.Multer.File,
  ): Promise<void> {
    try {
      // Process file and extract text
      const result = await this.documentProcessor.processFile(
        file.buffer,
        file.originalname,
        file.mimetype,
      );

      // Upload original file to Google Cloud Storage
      const fileName = `knowledge-base/${knowledgeBase._id}/${Date.now()}-${file.originalname}`;
      const fileUrl = await this.googleCloudService.uploadAudioFile(
        file.buffer,
        fileName,
        file.mimetype,
      );

      // Update document
      const doc = knowledgeBase.documents[docIndex];
      doc.type = result.type;
      doc.content = result.text;
      doc.fileUrl = fileUrl;
      doc.status = DocumentStatus.COMPLETED;
      doc.metadata = {
        ...doc.metadata,
        ...result.metadata,
        processedAt: new Date(),
      };

      knowledgeBase.totalWordCount += result.metadata.wordCount;
      knowledgeBase.lastUpdatedAt = new Date();

      await knowledgeBase.save();

      this.logger.log(`File processed successfully: ${file.originalname}`);
    } catch (error) {
      const doc = knowledgeBase.documents[docIndex];
      doc.status = DocumentStatus.FAILED;
      doc.metadata.error = error.message;
      await knowledgeBase.save();

      this.logger.error(`Failed to process file ${file.originalname}: ${error.message}`);
    }
  }

  /**
   * Delete document from knowledge base
   */
  async deleteDocument(
    companyId: string,
    id: string,
    documentIndex: number,
  ): Promise<KnowledgeBaseDocument> {
    const knowledgeBase = await this.findOne(companyId, id);

    if (documentIndex < 0 || documentIndex >= knowledgeBase.documents.length) {
      throw new NotFoundException('Document not found');
    }

    const doc = knowledgeBase.documents[documentIndex];

    // Delete file from Google Cloud Storage if exists
    if (doc.fileUrl) {
      try {
        const fileName = doc.fileUrl.split('/').pop()?.split('?')[0];
        if (fileName) {
          await this.googleCloudService.deleteAudioFile(fileName);
        }
      } catch (error) {
        this.logger.error(`Failed to delete file: ${error.message}`);
      }
    }

    // Update totals
    knowledgeBase.totalDocuments--;
    if (doc.metadata?.wordCount) {
      knowledgeBase.totalWordCount -= doc.metadata.wordCount;
    }

    // Remove document
    knowledgeBase.documents.splice(documentIndex, 1);
    knowledgeBase.lastUpdatedAt = new Date();

    return knowledgeBase.save();
  }

  /**
   * Get knowledge base content for RAG
   */
  async getKnowledgeBaseContent(id: string): Promise<string> {
    const knowledgeBase = await this.knowledgeBaseModel.findById(id);

    if (!knowledgeBase) {
      throw new NotFoundException('Knowledge base not found');
    }

    const completedDocs = knowledgeBase.documents.filter(
      (doc) => doc.status === DocumentStatus.COMPLETED && doc.content,
    );

    if (completedDocs.length === 0) {
      return '';
    }

    // Combine all document contents
    const content = completedDocs
      .map((doc) => `### ${doc.title}\n\n${doc.content}`)
      .join('\n\n---\n\n');

    return content;
  }
}
