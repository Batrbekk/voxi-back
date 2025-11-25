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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AgentService } from './agent.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  PreviewVoiceDto,
  TestTranscribeDto,
  TestChatDto,
  TestSynthesizeDto,
  SaveTestConversationDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../schemas/user.schema';
import { Types } from 'mongoose';
import { GoogleCloudService } from '../google-cloud/google-cloud.service';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly googleCloudService: GoogleCloudService,
  ) {}

  /**
   * Create a new agent
   * Accessible by: COMPANY_ADMIN
   */
  @Post()
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createAgent(@Request() req, @Body() createDto: CreateAgentDto) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const userId = Types.ObjectId.isValid(req.user.userId)
      ? new Types.ObjectId(req.user.userId)
      : req.user.userId;

    return this.agentService.createAgent(companyId, createDto, userId);
  }

  /**
   * Get available Gemini Live voices
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('voices')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getAvailableVoices() {
    return this.agentService.getAvailableVoices();
  }

  /**
   * Get all agents for the company
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getAgents(
    @Request() req,
    @Query('isActive') isActive?: string,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.agentService.getAgentsByCompany(
      companyId,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    );
  }

  /**
   * Get available agents (active and within working hours)
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get('available')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getAvailableAgents(@Request() req) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.agentService.getAvailableAgents(companyId);
  }

  /**
   * Get agent by ID
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getAgentById(@Request() req, @Param('id') id: string) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.getAgentById(agentId, companyId);
  }

  /**
   * Update agent
   * Accessible by: COMPANY_ADMIN
   */
  @Patch(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateAgent(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateAgentDto,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.updateAgent(agentId, companyId, updateDto);
  }

  /**
   * Activate agent
   * Accessible by: COMPANY_ADMIN
   */
  @Patch(':id/activate')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async activateAgent(@Request() req, @Param('id') id: string) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.toggleAgentStatus(agentId, companyId, true);
  }

  /**
   * Deactivate agent
   * Accessible by: COMPANY_ADMIN
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deactivateAgent(@Request() req, @Param('id') id: string) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.toggleAgentStatus(agentId, companyId, false);
  }

  /**
   * Delete agent
   * Accessible by: COMPANY_ADMIN
   */
  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteAgent(@Request() req, @Param('id') id: string) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.deleteAgent(agentId, companyId);
  }

  /**
   * Get agent statistics
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get(':id/stats')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getAgentStats(@Request() req, @Param('id') id: string) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.getAgentStats(agentId, companyId);
  }

  /**
   * Assign phone number to agent
   * Accessible by: COMPANY_ADMIN
   */
  @Post(':id/phone-numbers')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async assignPhoneNumber(
    @Request() req,
    @Param('id') id: string,
    @Body('phoneNumber') phoneNumber: string,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.assignPhoneNumber(agentId, companyId, phoneNumber);
  }

  /**
   * Remove phone number from agent
   * Accessible by: COMPANY_ADMIN
   */
  @Delete(':id/phone-numbers/:phoneNumber')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async removePhoneNumber(
    @Request() req,
    @Param('id') id: string,
    @Param('phoneNumber') phoneNumber: string,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    return this.agentService.removePhoneNumber(agentId, companyId, phoneNumber);
  }

  /**
   * Check if agent is available
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get(':id/availability')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async checkAvailability(@Request() req, @Param('id') id: string) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    const isAvailable = await this.agentService.isAgentAvailable(agentId, companyId);

    return {
      agentId: id,
      isAvailable,
    };
  }

  /**
   * Preview voice with custom settings
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post('preview-voice')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async previewVoice(
    @Body() previewVoiceDto: PreviewVoiceDto,
    @Res() res: Response,
  ) {
    const { voiceName, speakingRate, pitch, text } = previewVoiceDto;

    // Default text for preview with natural intonation
    const previewText = text || 'Добрый день! Меня зовут Ассистент, и я буду рад вам помочь. Чем могу быть полезен сегодня?';

    // Generate audio using Google Cloud TTS
    const audioBuffer = await this.googleCloudService.synthesizeSpeech(
      previewText,
      voiceName,
      'ru-RU',
      speakingRate,
      pitch,
    );

    // Return audio as base64
    res.setHeader('Content-Type', 'application/json');
    res.send({
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg',
    });
  }

  /**
   * Test agent - Transcribe audio (STT)
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post(':id/test/transcribe')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async testTranscribe(
    @Request() req,
    @Param('id') id: string,
    @Body() testTranscribeDto: TestTranscribeDto,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    // Get agent to verify access and get language
    const agent = await this.agentService.getAgentById(agentId, companyId);

    // Decode base64 audio
    const audioBuffer = Buffer.from(testTranscribeDto.audioBase64, 'base64');

    // Transcribe using Google Cloud STT
    const transcript = await this.googleCloudService.transcribeAudioBuffer(
      audioBuffer,
      agent.voiceSettings?.language || 'ru-RU',
    );

    return {
      transcript,
      language: agent.voiceSettings?.language || 'ru-RU',
    };
  }

  /**
   * Test agent - Generate AI response
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post(':id/test/chat')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async testChat(
    @Request() req,
    @Param('id') id: string,
    @Body() testChatDto: TestChatDto,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    // Get agent settings
    const agent = await this.agentService.getAgentById(agentId, companyId);

    // Build conversation context
    const conversationHistory = testChatDto.conversationHistory || [];
    const fullHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: testChatDto.message },
    ];

    const conversationContext = fullHistory
      .map((msg) => `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.content}`)
      .join('\n');

    // Generate AI response
    const aiResponse = await this.googleCloudService.generateAIResponse(
      conversationContext,
      agent.aiSettings?.systemPrompt || 'Ты дружелюбный AI ассистент.',
      agent.aiSettings?.model || 'gemini-2.0-flash-exp',
      agent.aiSettings?.temperature || 0.7,
      1024, // Default max tokens for Gemini Live
    );

    return {
      response: aiResponse,
      conversationHistory: [
        ...fullHistory,
        { role: 'assistant' as const, content: aiResponse },
      ],
    };
  }

  /**
   * Test agent - Synthesize speech (TTS)
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post(':id/test/synthesize')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async testSynthesize(
    @Request() req,
    @Param('id') id: string,
    @Body() testSynthesizeDto: TestSynthesizeDto,
    @Res() res: Response,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);

    // Get agent voice settings
    const agent = await this.agentService.getAgentById(agentId, companyId);

    // Generate TTS audio
    const audioBuffer = await this.googleCloudService.synthesizeSpeech(
      testSynthesizeDto.text,
      agent.voiceSettings?.voiceName || 'ru-RU-Wavenet-B',
      agent.voiceSettings?.language || 'ru-RU',
      agent.voiceSettings?.speakingRate || 1.0,
      agent.voiceSettings?.pitch || 0.0,
    );

    // Return audio as base64
    res.setHeader('Content-Type', 'application/json');
    res.send({
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg',
    });
  }

  /**
   * Save test conversation
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post(':id/test/conversation')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async saveTestConversation(
    @Request() req,
    @Param('id') id: string,
    @Body() saveTestConversationDto: SaveTestConversationDto,
  ) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;
    const agentId = new Types.ObjectId(id);
    const userId = Types.ObjectId.isValid(req.user.userId)
      ? new Types.ObjectId(req.user.userId)
      : req.user.userId;

    // Save as a conversation record for history
    return this.agentService.saveTestConversation(
      agentId,
      companyId,
      userId,
      saveTestConversationDto.conversationHistory,
    );
  }
}
