import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, AddTextDocumentDto, AddUrlDocumentDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  /**
   * Create a new knowledge base
   */
  @Post()
  async create(@Request() req, @Body() createDto: CreateKnowledgeBaseDto) {
    const knowledgeBase = await this.knowledgeBaseService.create(
      req.user.companyId,
      req.user.userId,
      createDto,
    );

    return {
      success: true,
      data: knowledgeBase,
      message: 'Knowledge base created successfully',
    };
  }

  /**
   * Get all knowledge bases
   */
  @Get()
  async findAll(
    @Request() req,
    @Query('page_size', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    const knowledgeBases = await this.knowledgeBaseService.findAll(
      req.user.companyId,
      pageSize,
    );

    return {
      success: true,
      data: knowledgeBases,
      count: knowledgeBases.length,
    };
  }

  /**
   * Get knowledge base by ID
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    const knowledgeBase = await this.knowledgeBaseService.findOne(req.user.companyId, id);

    return {
      success: true,
      data: knowledgeBase,
    };
  }

  /**
   * Update knowledge base
   */
  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateKnowledgeBaseDto,
  ) {
    const knowledgeBase = await this.knowledgeBaseService.update(
      req.user.companyId,
      id,
      updateDto,
    );

    return {
      success: true,
      data: knowledgeBase,
      message: 'Knowledge base updated successfully',
    };
  }

  /**
   * Delete knowledge base
   */
  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.knowledgeBaseService.remove(req.user.companyId, id);

    return {
      success: true,
      message: 'Knowledge base deleted successfully',
    };
  }

  /**
   * Add text document to knowledge base
   */
  @Post(':id/documents/text')
  async addTextDocument(
    @Request() req,
    @Param('id') id: string,
    @Body() textDto: AddTextDocumentDto,
  ) {
    const knowledgeBase = await this.knowledgeBaseService.addTextDocument(
      req.user.companyId,
      id,
      textDto,
    );

    return {
      success: true,
      data: knowledgeBase,
      message: 'Text document added successfully',
    };
  }

  /**
   * Add URL document to knowledge base
   */
  @Post(':id/documents/url')
  async addUrlDocument(
    @Request() req,
    @Param('id') id: string,
    @Body() urlDto: AddUrlDocumentDto,
  ) {
    const knowledgeBase = await this.knowledgeBaseService.addUrlDocument(
      req.user.companyId,
      id,
      urlDto,
    );

    return {
      success: true,
      data: knowledgeBase,
      message: 'URL document is being processed',
    };
  }

  /**
   * Upload file document to knowledge base
   */
  @Post(':id/documents/file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileDocument(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed types: PDF, DOCX, DOC, XLSX, XLS',
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const knowledgeBase = await this.knowledgeBaseService.uploadFileDocument(
      req.user.companyId,
      id,
      file,
    );

    return {
      success: true,
      data: knowledgeBase,
      message: 'File is being processed',
    };
  }

  /**
   * Get documents from knowledge base
   */
  @Get(':id/documents')
  async getDocuments(@Request() req, @Param('id') id: string) {
    const knowledgeBase = await this.knowledgeBaseService.findOne(req.user.companyId, id);

    return {
      success: true,
      data: knowledgeBase.documents,
      count: knowledgeBase.documents.length,
    };
  }

  /**
   * Delete document from knowledge base
   */
  @Delete(':id/documents/:docIndex')
  async deleteDocument(
    @Request() req,
    @Param('id') id: string,
    @Param('docIndex', ParseIntPipe) docIndex: number,
  ) {
    const knowledgeBase = await this.knowledgeBaseService.deleteDocument(
      req.user.companyId,
      id,
      docIndex,
    );

    return {
      success: true,
      data: knowledgeBase,
      message: 'Document deleted successfully',
    };
  }
}
