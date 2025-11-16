import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  AddConversationNoteDto,
  AddConversationTagDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../schemas/user.schema';
import { Types } from 'mongoose';
import { CallStatus, CallerType, CallDirection } from '../../schemas/conversation.schema';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  /**
   * Create a new conversation (call)
   * Accessible by: COMPANY_ADMIN, MANAGER
   * Note: Typically called by system when call is initiated
   */
  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @Request() req,
    @Body() createDto: CreateConversationDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.conversationService.createConversation(companyId, createDto);
  }

  /**
   * Get all conversations with filters
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConversations(
    @Request() req,
    @Query('status') status?: CallStatus,
    @Query('callerType') callerType?: CallerType,
    @Query('direction') direction?: CallDirection,
    @Query('agentId') agentId?: string,
    @Query('managerId') managerId?: string,
    @Query('leadId') leadId?: string,
    @Query('phoneNumber') phoneNumber?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.conversationService.getConversations(companyId, {
      status,
      callerType,
      direction,
      agentId,
      managerId,
      leadId,
      phoneNumber,
      startDate,
      endDate,
    });
  }

  /**
   * Get active calls (ringing or ongoing)
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('active')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getActiveCalls(@Request() req) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.conversationService.getActiveCalls(companyId);
  }

  /**
   * Get conversation statistics
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('stats')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConversationStats(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('callerType') callerType?: CallerType,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.conversationService.getConversationStats(companyId, {
      startDate,
      endDate,
      callerType,
    });
  }

  /**
   * Get conversation by call ID
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('call/:callId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConversationByCallId(@Request() req, @Param('callId') callId: string) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.conversationService.getConversationByCallId(callId, companyId);
  }

  /**
   * Get conversation by ID
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConversationById(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const conversationId = new Types.ObjectId(id);

    return this.conversationService.getConversationById(
      conversationId,
      companyId,
    );
  }

  /**
   * Update conversation
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Patch(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateConversation(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateConversationDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const conversationId = new Types.ObjectId(id);

    return this.conversationService.updateConversation(
      conversationId,
      companyId,
      updateDto,
    );
  }

  /**
   * Update conversation status
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Patch(':callId/status')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Request() req,
    @Param('callId') callId: string,
    @Body('status') status: CallStatus,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.conversationService.updateStatus(callId, companyId, status);
  }

  /**
   * Add note to conversation
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post(':id/notes')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async addNote(
    @Request() req,
    @Param('id') id: string,
    @Body() noteDto: AddConversationNoteDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const conversationId = new Types.ObjectId(id);

    return this.conversationService.addNote(conversationId, companyId, noteDto);
  }

  /**
   * Add tag to conversation
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post(':id/tags')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async addTag(
    @Request() req,
    @Param('id') id: string,
    @Body() tagDto: AddConversationTagDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const conversationId = new Types.ObjectId(id);

    return this.conversationService.addTag(conversationId, companyId, tagDto);
  }

  /**
   * Remove tag from conversation
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Delete(':id/tags/:tag')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async removeTag(
    @Request() req,
    @Param('id') id: string,
    @Param('tag') tag: string,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const conversationId = new Types.ObjectId(id);

    return this.conversationService.removeTag(conversationId, companyId, tag);
  }

  /**
   * Get conversations by lead ID
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('lead/:leadId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConversationsByLead(
    @Request() req,
    @Param('leadId') leadId: string,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadObjectId = new Types.ObjectId(leadId);

    return this.conversationService.getConversationsByLead(
      leadObjectId,
      companyId,
    );
  }

  /**
   * Get conversations by agent ID
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('agent/:agentId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConversationsByAgent(
    @Request() req,
    @Param('agentId') agentId: string,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const agentObjectId = new Types.ObjectId(agentId);

    return this.conversationService.getConversationsByAgent(
      agentObjectId,
      companyId,
    );
  }

  /**
   * Get conversations by manager ID
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('manager/:managerId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getConversationsByManager(
    @Request() req,
    @Param('managerId') managerId: string,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const managerObjectId = new Types.ObjectId(managerId);

    return this.conversationService.getConversationsByManager(
      managerObjectId,
      companyId,
    );
  }

  /**
   * Get audio recording URL for conversation
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get(':id/audio')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getAudioUrl(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const conversationId = new Types.ObjectId(id);

    const audioUrl = await this.conversationService.getAudioUrl(
      conversationId,
      companyId,
    );

    return {
      success: true,
      data: {
        audioUrl,
      },
    };
  }

  /**
   * Delete conversation
   * Accessible by: COMPANY_ADMIN
   */
  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteConversation(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const conversationId = new Types.ObjectId(id);

    return this.conversationService.deleteConversation(
      conversationId,
      companyId,
    );
  }
}
