import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
  CallStatus,
  CallerType,
  CallDirection,
} from '../../schemas/conversation.schema';
import {
  CreateConversationDto,
  UpdateConversationDto,
  AddConversationNoteDto,
  AddConversationTagDto,
} from './dto';
import { GoogleCloudService } from '../google-cloud/google-cloud.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    private googleCloudService: GoogleCloudService,
  ) {}

  /**
   * Create a new conversation (call)
   */
  async createConversation(
    companyId: Types.ObjectId,
    createDto: CreateConversationDto,
  ) {
    // Check if call ID already exists
    const existingCall = await this.conversationModel.findOne({
      callId: createDto.callId,
    });

    if (existingCall) {
      throw new ConflictException('Call with this ID already exists');
    }

    // Validate caller type and corresponding ID
    if (createDto.callerType === CallerType.AI_AGENT && !createDto.agentId) {
      throw new BadRequestException('Agent ID is required for AI agent calls');
    }

    if (
      createDto.callerType === CallerType.HUMAN_MANAGER &&
      !createDto.managerId
    ) {
      throw new BadRequestException(
        'Manager ID is required for human manager calls',
      );
    }

    const conversation = await this.conversationModel.create({
      ...createDto,
      companyId,
      agentId: createDto.agentId ? new Types.ObjectId(createDto.agentId) : undefined,
      managerId: createDto.managerId
        ? new Types.ObjectId(createDto.managerId)
        : undefined,
      leadId: createDto.leadId ? new Types.ObjectId(createDto.leadId) : undefined,
      status: CallStatus.RINGING,
      duration: 0,
      ringDuration: 0,
    });

    this.logger.log(`Conversation created: ${conversation.callId}`);

    return conversation;
  }

  /**
   * Get conversation by call ID
   */
  async getConversationByCallId(callId: string, companyId: Types.ObjectId) {
    const conversation = await this.conversationModel
      .findOne({ callId, companyId })
      .populate('agentId', 'name voiceSettings')
      .populate('managerId', 'firstName lastName email')
      .populate('leadId', 'firstName lastName phone status')
      .lean();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Get conversation by MongoDB ID
   */
  async getConversationById(
    conversationId: Types.ObjectId,
    companyId: Types.ObjectId,
  ) {
    const conversation = await this.conversationModel
      .findOne({ _id: conversationId, companyId })
      .populate('agentId', 'name voiceSettings')
      .populate('managerId', 'firstName lastName email')
      .populate('leadId', 'firstName lastName phone status')
      .lean();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Get all conversations for a company with filters
   */
  async getConversations(
    companyId: Types.ObjectId,
    filters?: {
      status?: CallStatus;
      callerType?: CallerType;
      direction?: CallDirection;
      agentId?: string;
      managerId?: string;
      leadId?: string;
      phoneNumber?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const query: any = { companyId };

    if (filters) {
      if (filters.status) query.status = filters.status;
      if (filters.callerType) query.callerType = filters.callerType;
      if (filters.direction) query.direction = filters.direction;
      if (filters.agentId) query.agentId = new Types.ObjectId(filters.agentId);
      if (filters.managerId)
        query.managerId = new Types.ObjectId(filters.managerId);
      if (filters.leadId) query.leadId = new Types.ObjectId(filters.leadId);
      if (filters.phoneNumber) query.phoneNumber = filters.phoneNumber;

      if (filters.startDate || filters.endDate) {
        query.startedAt = {};
        if (filters.startDate) {
          query.startedAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.startedAt.$lte = new Date(filters.endDate);
        }
      }
    }

    const conversations = await this.conversationModel
      .find(query)
      .populate('agentId', 'name voiceSettings')
      .populate('managerId', 'firstName lastName email')
      .populate('leadId', 'firstName lastName phone status')
      .sort({ startedAt: -1 })
      .lean();

    return conversations;
  }

  /**
   * Update conversation
   */
  async updateConversation(
    conversationId: Types.ObjectId,
    companyId: Types.ObjectId,
    updateDto: UpdateConversationDto,
  ) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      companyId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    Object.assign(conversation, updateDto);
    await conversation.save();

    this.logger.log(`Conversation updated: ${conversation.callId}`);

    return conversation;
  }

  /**
   * Update conversation status
   */
  async updateStatus(
    callId: string,
    companyId: Types.ObjectId,
    status: CallStatus,
  ) {
    const conversation = await this.conversationModel.findOne({
      callId,
      companyId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.status = status;

    // Set timestamps based on status
    if (status === CallStatus.ONGOING && !conversation.answeredAt) {
      conversation.answeredAt = new Date();
      const ringDuration =
        (conversation.answeredAt.getTime() -
          new Date(conversation.startedAt).getTime()) /
        1000;
      conversation.ringDuration = Math.round(ringDuration);
    }

    if (
      [
        CallStatus.COMPLETED,
        CallStatus.FAILED,
        CallStatus.MISSED,
        CallStatus.NO_ANSWER,
        CallStatus.BUSY,
      ].includes(status)
    ) {
      conversation.endedAt = new Date();
      if (conversation.answeredAt) {
        const duration =
          (conversation.endedAt.getTime() -
            new Date(conversation.answeredAt).getTime()) /
          1000;
        conversation.duration = Math.round(duration);
      }
    }

    await conversation.save();

    this.logger.log(`Conversation ${callId} status updated to ${status}`);

    return conversation;
  }

  /**
   * Add note to conversation
   */
  async addNote(
    conversationId: Types.ObjectId,
    companyId: Types.ObjectId,
    noteDto: AddConversationNoteDto,
  ) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      companyId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.notes.push(noteDto.note);
    await conversation.save();

    this.logger.log(`Note added to conversation ${conversation.callId}`);

    return conversation;
  }

  /**
   * Add tag to conversation
   */
  async addTag(
    conversationId: Types.ObjectId,
    companyId: Types.ObjectId,
    tagDto: AddConversationTagDto,
  ) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      companyId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.tags.includes(tagDto.tag)) {
      conversation.tags.push(tagDto.tag);
      await conversation.save();
    }

    this.logger.log(`Tag added to conversation ${conversation.callId}`);

    return conversation;
  }

  /**
   * Remove tag from conversation
   */
  async removeTag(
    conversationId: Types.ObjectId,
    companyId: Types.ObjectId,
    tag: string,
  ) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      companyId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.tags = conversation.tags.filter((t) => t !== tag);
    await conversation.save();

    this.logger.log(`Tag removed from conversation ${conversation.callId}`);

    return conversation;
  }

  /**
   * Get conversations by lead ID
   */
  async getConversationsByLead(
    leadId: Types.ObjectId,
    companyId: Types.ObjectId,
  ) {
    const conversations = await this.conversationModel
      .find({ leadId, companyId })
      .populate('agentId', 'name voiceSettings')
      .populate('managerId', 'firstName lastName email')
      .sort({ startedAt: -1 })
      .lean();

    return conversations;
  }

  /**
   * Get conversations by agent ID
   */
  async getConversationsByAgent(
    agentId: Types.ObjectId,
    companyId: Types.ObjectId,
  ) {
    const conversations = await this.conversationModel
      .find({ agentId, companyId })
      .populate('leadId', 'firstName lastName phone status')
      .sort({ startedAt: -1 })
      .lean();

    return conversations;
  }

  /**
   * Get conversations by manager ID
   */
  async getConversationsByManager(
    managerId: Types.ObjectId,
    companyId: Types.ObjectId,
  ) {
    const conversations = await this.conversationModel
      .find({ managerId, companyId })
      .populate('leadId', 'firstName lastName phone status')
      .sort({ startedAt: -1 })
      .lean();

    return conversations;
  }

  /**
   * Get conversation statistics for a company
   */
  async getConversationStats(companyId: Types.ObjectId, filters?: {
    startDate?: string;
    endDate?: string;
    callerType?: CallerType;
  }) {
    const query: any = { companyId };

    if (filters) {
      if (filters.callerType) query.callerType = filters.callerType;

      if (filters.startDate || filters.endDate) {
        query.startedAt = {};
        if (filters.startDate) {
          query.startedAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.startedAt.$lte = new Date(filters.endDate);
        }
      }
    }

    const totalCalls = await this.conversationModel.countDocuments(query);

    const completedCalls = await this.conversationModel.countDocuments({
      ...query,
      status: CallStatus.COMPLETED,
    });

    const failedCalls = await this.conversationModel.countDocuments({
      ...query,
      status: { $in: [CallStatus.FAILED, CallStatus.MISSED, CallStatus.NO_ANSWER] },
    });

    const conversations = await this.conversationModel.find({
      ...query,
      status: CallStatus.COMPLETED,
      duration: { $gt: 0 },
    });

    const totalDuration = conversations.reduce(
      (sum, conv) => sum + conv.duration,
      0,
    );
    const averageDuration =
      conversations.length > 0
        ? Math.round(totalDuration / conversations.length)
        : 0;

    // Sentiment analysis
    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    conversations.forEach((conv) => {
      if (conv.aiAnalysis?.sentiment) {
        sentimentCounts[conv.aiAnalysis.sentiment]++;
      }
    });

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      successRate:
        totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(2) : 0,
      averageDuration,
      sentimentAnalysis: sentimentCounts,
    };
  }

  /**
   * Delete conversation (soft delete by adding to errors)
   */
  async deleteConversation(
    conversationId: Types.ObjectId,
    companyId: Types.ObjectId,
  ) {
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      companyId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.conversationModel.deleteOne({ _id: conversationId });

    this.logger.log(`Conversation deleted: ${conversation.callId}`);

    return {
      message: 'Conversation deleted successfully',
    };
  }

  /**
   * Get active calls (ringing or ongoing)
   */
  async getActiveCalls(companyId: Types.ObjectId) {
    const activeCalls = await this.conversationModel
      .find({
        companyId,
        status: { $in: [CallStatus.RINGING, CallStatus.ONGOING] },
      })
      .populate('agentId', 'name voiceSettings')
      .populate('managerId', 'firstName lastName email')
      .populate('leadId', 'firstName lastName phone')
      .sort({ startedAt: -1 })
      .lean();

    return activeCalls;
  }

  /**
   * Get audio URL for conversation
   */
  async getAudioUrl(
    conversationId: Types.ObjectId,
    companyId: Types.ObjectId,
  ): Promise<string> {
    const conversation = await this.getConversationById(
      conversationId,
      companyId,
    );

    if (!conversation.audioUrl) {
      throw new NotFoundException('Audio recording not found for this conversation');
    }

    // Extract file name from the existing URL
    const fileName = conversation.audioUrl.split('/').pop()?.split('?')[0];

    if (!fileName) {
      throw new BadRequestException('Invalid audio URL format');
    }

    // Generate a new signed URL (valid for 7 days)
    const signedUrl = await this.googleCloudService.getSignedUrl(fileName, 7);

    return signedUrl;
  }
}
