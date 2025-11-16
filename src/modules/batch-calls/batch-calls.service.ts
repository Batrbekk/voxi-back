import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BatchCall, BatchCallDocument, BatchCallStatus, RecipientCallStatus } from '../../schemas/batch-call.schema';
import { CreateBatchCallDto } from './dto/create-batch-call.dto';
import { UpdateBatchCallDto } from './dto/update-batch-call.dto';
import { PhoneService } from '../phone/phone.service';

@Injectable()
export class BatchCallsService {
  private readonly logger = new Logger(BatchCallsService.name);

  constructor(
    @InjectModel(BatchCall.name) private batchCallModel: Model<BatchCallDocument>,
    private phoneService: PhoneService,
  ) {}

  /**
   * Create a new batch call
   */
  async create(
    companyId: string,
    createBatchCallDto: CreateBatchCallDto,
  ): Promise<BatchCallDocument> {
    const batchCall = new this.batchCallModel({
      companyId: new Types.ObjectId(companyId),
      name: createBatchCallDto.name,
      agentId: new Types.ObjectId(createBatchCallDto.agentId),
      phoneNumberId: new Types.ObjectId(createBatchCallDto.phoneNumberId),
      scheduledTime: createBatchCallDto.scheduledTime ? new Date(createBatchCallDto.scheduledTime) : undefined,
      totalRecipientsCount: createBatchCallDto.recipients.length,
      recipients: createBatchCallDto.recipients.map(recipient => ({
        phoneNumber: recipient.phoneNumber,
        leadId: recipient.leadId ? new Types.ObjectId(recipient.leadId) : undefined,
        status: RecipientCallStatus.PENDING,
        customVariables: recipient.customVariables || {},
      })),
    });

    return batchCall.save();
  }

  /**
   * Get all batch calls for a company with pagination
   */
  async findAll(
    companyId: string,
    pageSize: number = 20,
  ): Promise<BatchCallDocument[]> {
    return this.batchCallModel
      .find({ companyId: new Types.ObjectId(companyId) })
      .populate('agentId', 'name')
      .populate('phoneNumberId', 'phoneNumber label')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .exec();
  }

  /**
   * Get a single batch call by ID
   */
  async findOne(companyId: string, id: string): Promise<BatchCallDocument> {
    const batchCall = await this.batchCallModel
      .findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
      })
      .populate('agentId', 'name')
      .populate('phoneNumberId', 'phoneNumber label')
      .exec();

    if (!batchCall) {
      throw new NotFoundException('Batch call not found');
    }

    return batchCall;
  }

  /**
   * Update a batch call
   */
  async update(
    companyId: string,
    id: string,
    updateBatchCallDto: UpdateBatchCallDto,
  ): Promise<BatchCallDocument> {
    const batchCall = await this.findOne(companyId, id);

    if (batchCall.status !== BatchCallStatus.SCHEDULED) {
      throw new BadRequestException('Can only update scheduled batch calls');
    }

    if (updateBatchCallDto.name) {
      batchCall.name = updateBatchCallDto.name;
    }

    if (updateBatchCallDto.scheduledTime) {
      batchCall.scheduledTime = new Date(updateBatchCallDto.scheduledTime);
    }

    return batchCall.save();
  }

  /**
   * Delete a batch call
   */
  async remove(companyId: string, id: string): Promise<void> {
    const batchCall = await this.findOne(companyId, id);

    if (batchCall.status === BatchCallStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot delete batch call in progress');
    }

    const result = await this.batchCallModel.deleteOne({
      _id: new Types.ObjectId(id),
      companyId: new Types.ObjectId(companyId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Batch call not found');
    }
  }

  /**
   * Cancel a batch call
   */
  async cancel(companyId: string, id: string): Promise<BatchCallDocument> {
    const batchCall = await this.findOne(companyId, id);

    if (batchCall.status === BatchCallStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed batch call');
    }

    if (batchCall.status === BatchCallStatus.CANCELLED) {
      throw new BadRequestException('Batch call is already cancelled');
    }

    // Cancel all pending recipients
    batchCall.recipients.forEach(recipient => {
      if (recipient.status === RecipientCallStatus.PENDING) {
        recipient.status = RecipientCallStatus.CANCELLED;
        batchCall.cancelledCallsCount++;
      }
    });

    batchCall.status = BatchCallStatus.CANCELLED;
    batchCall.completedAt = new Date();

    return batchCall.save();
  }

  /**
   * Process scheduled batch calls
   * Runs every minute to check for scheduled calls
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledBatchCalls() {
    try {
      const now = new Date();

      const scheduledCalls = await this.batchCallModel.find({
        status: BatchCallStatus.SCHEDULED,
        scheduledTime: { $lte: now },
      });

      for (const batchCall of scheduledCalls) {
        await this.processBatchCall(batchCall);
      }
    } catch (error) {
      this.logger.error(`Error processing scheduled batch calls: ${error.message}`, error.stack);
    }
  }

  /**
   * Process a single batch call
   */
  private async processBatchCall(batchCall: BatchCallDocument) {
    try {
      this.logger.log(`Starting batch call: ${batchCall._id}`);

      batchCall.status = BatchCallStatus.IN_PROGRESS;
      batchCall.startedAt = new Date();
      await batchCall.save();

      const companyId = batchCall.companyId.toString();

      for (const recipient of batchCall.recipients) {
        if (recipient.status !== RecipientCallStatus.PENDING) {
          continue;
        }

        try {
          recipient.status = RecipientCallStatus.CALLING;
          recipient.calledAt = new Date();
          await batchCall.save();

          // Make outbound call
          const result = await this.phoneService.makeOutboundCall(companyId, {
            agent_id: batchCall.agentId.toString(),
            agent_phone_number_id: batchCall.phoneNumberId.toString(),
            to_number: recipient.phoneNumber,
            lead_id: recipient.leadId?.toString(),
          });

          recipient.status = RecipientCallStatus.COMPLETED;
          recipient.conversationId = new Types.ObjectId(result.data.conversation_id);
          batchCall.completedCallsCount++;

          this.logger.log(`Call completed for ${recipient.phoneNumber}`);
        } catch (error) {
          this.logger.error(`Failed to call ${recipient.phoneNumber}: ${error.message}`);
          recipient.status = RecipientCallStatus.FAILED;
          batchCall.failedCallsCount++;
        }

        await batchCall.save();

        // Small delay between calls to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      batchCall.status = BatchCallStatus.COMPLETED;
      batchCall.completedAt = new Date();
      await batchCall.save();

      this.logger.log(`Batch call completed: ${batchCall._id}`);
    } catch (error) {
      this.logger.error(`Error processing batch call ${batchCall._id}: ${error.message}`, error.stack);
      batchCall.status = BatchCallStatus.COMPLETED;
      batchCall.completedAt = new Date();
      await batchCall.save();
    }
  }
}
