import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PhoneNumber, PhoneNumberDocument } from '../../schemas/phone-number.schema';
import { CreatePhoneNumberDto } from './dto/create-phone-number.dto';
import { AssignAgentDto } from './dto/assign-agent.dto';
import { OutboundCallDto } from './dto/outbound-call.dto';
import { SipService } from '../sip/sip.service';
import { ConversationService } from '../conversation/conversation.service';
import { CallDirection, CallerType } from '../../schemas/conversation.schema';

@Injectable()
export class PhoneService {
  private readonly logger = new Logger(PhoneService.name);

  constructor(
    @InjectModel(PhoneNumber.name) private phoneNumberModel: Model<PhoneNumberDocument>,
    private sipService: SipService,
    private conversationService: ConversationService,
  ) {}

  /**
   * Create a new phone number
   */
  async create(
    companyId: string,
    createPhoneNumberDto: CreatePhoneNumberDto,
  ): Promise<PhoneNumberDocument> {
    // Check if phone number already exists
    const existing = await this.phoneNumberModel.findOne({
      phoneNumber: createPhoneNumberDto.phoneNumber,
    });

    if (existing) {
      throw new BadRequestException('Номер телефона уже существует');
    }

    const phoneNumber = new this.phoneNumberModel({
      companyId: new Types.ObjectId(companyId),
      ...createPhoneNumberDto,
      provider: 'sip_trunk_beeline',
    });

    return phoneNumber.save();
  }

  /**
   * Get all phone numbers for a company
   */
  async findAll(companyId: string): Promise<PhoneNumberDocument[]> {
    return this.phoneNumberModel
      .find({ companyId: new Types.ObjectId(companyId) })
      .populate('assignedAgentId', 'name')
      .exec();
  }

  /**
   * Get a single phone number by ID
   */
  async findOne(companyId: string, id: string): Promise<PhoneNumberDocument> {
    const phoneNumber = await this.phoneNumberModel
      .findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
      })
      .populate('assignedAgentId', 'name')
      .exec();

    if (!phoneNumber) {
      throw new NotFoundException('Номер телефона не найден');
    }

    return phoneNumber;
  }

  /**
   * Delete a phone number
   */
  async remove(companyId: string, id: string): Promise<void> {
    const result = await this.phoneNumberModel.deleteOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Номер телефона не найден');
    }
  }

  /**
   * Assign an agent to a phone number
   */
  async assignAgent(
    companyId: string,
    phoneNumberId: string,
    assignAgentDto: AssignAgentDto,
  ): Promise<PhoneNumberDocument> {
    const phoneNumber = await this.findOne(companyId, phoneNumberId);

    phoneNumber.assignedAgentId = assignAgentDto.agentId
      ? new Types.ObjectId(assignAgentDto.agentId)
      : undefined;

    return phoneNumber.save();
  }

  /**
   * Claim (take ownership of) an available phone number
   */
  async claimNumber(
    companyId: string,
    phoneNumberId: string,
  ): Promise<PhoneNumberDocument> {
    const phoneNumber = await this.phoneNumberModel.findById(phoneNumberId);

    if (!phoneNumber) {
      throw new NotFoundException('Номер телефона не найден');
    }

    if (phoneNumber.status === 'owned') {
      throw new BadRequestException('Этот номер уже занят');
    }

    phoneNumber.status = 'owned';
    phoneNumber.companyId = new Types.ObjectId(companyId);

    return phoneNumber.save();
  }

  /**
   * Release (return) an owned phone number back to available pool
   */
  async releaseNumber(
    companyId: string,
    phoneNumberId: string,
  ): Promise<PhoneNumberDocument> {
    const phoneNumber = await this.findOne(companyId, phoneNumberId);

    if (phoneNumber.status === 'available') {
      throw new BadRequestException('Этот номер уже в доступных');
    }

    phoneNumber.status = 'available';
    phoneNumber.assignedAgentId = undefined;

    return phoneNumber.save();
  }

  /**
   * Make an outbound call
   */
  async makeOutboundCall(companyId: string, outboundCallDto: OutboundCallDto) {
    try {
      // Get phone number
      const phoneNumber = await this.findOne(companyId, outboundCallDto.agent_phone_number_id);

      if (!phoneNumber.isActive) {
        throw new BadRequestException('Номер телефона неактивен');
      }

      // Check if max sessions reached
      if (phoneNumber.activeCallsCount >= phoneNumber.sipConfig.maxSessions) {
        throw new BadRequestException('Достигнуто максимальное количество одновременных звонков');
      }

      // Make SIP call
      const sipSession = await this.sipService.makeCall(
        outboundCallDto.to_number,
        phoneNumber.phoneNumber,
      );

      // Create conversation record
      const conversation = await this.conversationService.createConversation(
        new Types.ObjectId(companyId),
        {
          callId: sipSession.callId,
          phoneNumber: outboundCallDto.to_number,
          direction: CallDirection.OUTBOUND,
          callerType: CallerType.AI_AGENT,
          agentId: outboundCallDto.agent_id,
          startedAt: sipSession.startedAt.toISOString(),
          leadId: outboundCallDto.lead_id,
          sipCallId: sipSession.callId,
        },
      );

      // Update phone number stats
      await this.phoneNumberModel.updateOne(
        { _id: phoneNumber._id },
        {
          $inc: { totalCallsCount: 1, activeCallsCount: 1 },
          $set: { lastUsedAt: new Date() },
        },
      );

      this.logger.log(`Outbound call initiated: ${sipSession.callId} to ${outboundCallDto.to_number}`);

      return {
        success: true,
        data: {
          conversation_id: (conversation as any)._id.toString(),
          call_id: sipSession.callId,
          to_number: outboundCallDto.to_number,
          status: sipSession.status,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to make outbound call: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Decrement active calls count when call ends
   */
  async decrementActiveCalls(phoneNumber: string): Promise<void> {
    await this.phoneNumberModel.updateOne(
      { phoneNumber },
      { $inc: { activeCallsCount: -1 } },
    );
  }
}
