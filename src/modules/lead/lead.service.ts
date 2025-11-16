import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument, LeadStatus, AssignmentType } from '../../schemas/lead.schema';
import { LeadHistory, LeadHistoryDocument, ChangedBy, ChangeType } from '../../schemas/lead-history.schema';
import { Manager, ManagerDocument } from '../../schemas/manager.schema';
import {
  CreateLeadDto,
  UpdateLeadDto,
  AssignLeadDto,
  UpdateLeadStatusDto,
  AddLeadNoteDto,
} from './dto';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(LeadHistory.name) private leadHistoryModel: Model<LeadHistoryDocument>,
    @InjectModel(Manager.name) private managerModel: Model<ManagerDocument>,
  ) {}

  /**
   * Create a new lead
   */
  async createLead(companyId: Types.ObjectId, createDto: CreateLeadDto, createdBy?: Types.ObjectId) {
    // Check for duplicate phone number
    const existingLead = await this.leadModel.findOne({
      companyId,
      phone: createDto.phone,
    });

    if (existingLead) {
      throw new BadRequestException('Lead with this phone number already exists');
    }

    const lead = await this.leadModel.create({
      ...createDto,
      companyId,
      score: 0,
      isInPool: true,
    });

    // Create history entry
    await this.leadHistoryModel.create({
      leadId: lead._id,
      companyId,
      changeType: ChangeType.CREATED,
      changedBy: createdBy ? ChangedBy.USER : ChangedBy.SYSTEM,
      userId: createdBy,
      newValue: JSON.stringify({
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        source: lead.source,
      }),
    });

    this.logger.log(`Lead created: ${lead._id} - ${lead.firstName} ${lead.lastName}`);

    return lead;
  }

  /**
   * Get all leads for a company with filters
   */
  async getLeads(
    companyId: Types.ObjectId,
    filters?: {
      status?: LeadStatus;
      assignedTo?: Types.ObjectId;
      isInPool?: boolean;
      source?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const query: any = { companyId };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }

    if (filters?.isInPool !== undefined) {
      query.isInPool = filters.isInPool;
    }

    if (filters?.source) {
      query.source = filters.source;
    }

    if (filters?.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { company: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [leads, total] = await Promise.all([
      this.leadModel
        .find(query)
        .populate('assignedTo', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean(),
      this.leadModel.countDocuments(query),
    ]);

    return {
      leads,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get lead by ID
   */
  async getLeadById(leadId: Types.ObjectId, companyId: Types.ObjectId) {
    const lead = await this.leadModel
      .findOne({ _id: leadId, companyId })
      .populate('assignedTo', 'firstName lastName email phone')
      .lean();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  /**
   * Update lead
   */
  async updateLead(
    leadId: Types.ObjectId,
    companyId: Types.ObjectId,
    updateDto: UpdateLeadDto,
    updatedBy?: Types.ObjectId,
  ) {
    const lead = await this.leadModel.findOne({ _id: leadId, companyId });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const oldValue = { ...lead.toObject() };

    Object.assign(lead, updateDto);
    await lead.save();

    // Create history entry
    await this.leadHistoryModel.create({
      leadId: lead._id,
      companyId,
      changeType: ChangeType.UPDATED,
      changedBy: updatedBy ? ChangedBy.USER : ChangedBy.SYSTEM,
      userId: updatedBy,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(updateDto),
    });

    this.logger.log(`Lead updated: ${leadId}`);

    return lead;
  }

  /**
   * Assign lead to manager
   */
  async assignLead(
    leadId: Types.ObjectId,
    companyId: Types.ObjectId,
    assignDto: AssignLeadDto,
    assignedByUserId?: Types.ObjectId,
  ) {
    const lead = await this.leadModel.findOne({ _id: leadId, companyId });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Check if manager exists and belongs to company
    const manager = await this.managerModel
      .findOne({
        _id: new Types.ObjectId(assignDto.managerId),
        companyId,
        isActive: true,
      })
      .populate('userId');

    if (!manager) {
      throw new NotFoundException('Manager not found or inactive');
    }

    const previousAssignee = lead.assignedTo;

    lead.assignedTo = manager.userId as any;
    lead.assignedAt = new Date();
    lead.assignedBy = assignDto.assignedBy || AssignmentType.ADMIN;
    lead.isInPool = false;

    await lead.save();

    // Update manager stats
    await this.managerModel.findByIdAndUpdate(manager._id, {
      $inc: { assignedLeadsCount: 1 },
    });

    // Decrease previous manager's count
    if (previousAssignee) {
      const previousManager = await this.managerModel.findOne({
        userId: previousAssignee,
        companyId,
      });
      if (previousManager) {
        await this.managerModel.findByIdAndUpdate(previousManager._id, {
          $inc: { assignedLeadsCount: -1 },
        });
      }
    }

    // Create history entry
    await this.leadHistoryModel.create({
      leadId: lead._id,
      companyId,
      changeType: ChangeType.ASSIGNMENT,
      changedBy: assignedByUserId ? ChangedBy.USER : ChangedBy.SYSTEM,
      userId: assignedByUserId,
      newValue: JSON.stringify({
        assignedTo: manager.userId,
        assignedBy: lead.assignedBy,
      }),
    });

    this.logger.log(`Lead ${leadId} assigned to manager ${assignDto.managerId}`);

    return {
      message: 'Lead assigned successfully',
      lead,
    };
  }

  /**
   * Self-take lead from pool (for managers)
   */
  async takeLead(leadId: Types.ObjectId, companyId: Types.ObjectId, managerId: Types.ObjectId) {
    const lead = await this.leadModel.findOne({ _id: leadId, companyId });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!lead.isInPool) {
      throw new BadRequestException('Lead is not available in pool');
    }

    if (lead.assignedTo) {
      throw new BadRequestException('Lead is already assigned');
    }

    // Check manager permissions
    const manager = await this.managerModel.findOne({
      userId: managerId,
      companyId,
      isActive: true,
    });

    if (!manager) {
      throw new ForbiddenException('Manager not found or inactive');
    }

    if (!manager.permissions?.canTakeLeads) {
      throw new ForbiddenException('You do not have permission to take leads');
    }

    lead.assignedTo = managerId;
    lead.assignedAt = new Date();
    lead.assignedBy = AssignmentType.SELF;
    lead.isInPool = false;

    await lead.save();

    // Update manager stats
    await this.managerModel.findByIdAndUpdate(manager._id, {
      $inc: { assignedLeadsCount: 1 },
    });

    // Create history entry
    await this.leadHistoryModel.create({
      leadId: lead._id,
      companyId,
      changeType: ChangeType.ASSIGNMENT,
      changedBy: ChangedBy.USER,
      userId: managerId,
      newValue: JSON.stringify({
        assignedTo: managerId,
        assignedBy: AssignmentType.SELF,
      }),
    });

    this.logger.log(`Lead ${leadId} self-taken by manager ${managerId}`);

    return {
      message: 'Lead taken successfully',
      lead,
    };
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(
    leadId: Types.ObjectId,
    companyId: Types.ObjectId,
    statusDto: UpdateLeadStatusDto,
    updatedBy?: Types.ObjectId,
  ) {
    const lead = await this.leadModel.findOne({ _id: leadId, companyId });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const oldStatus = lead.status;

    lead.status = statusDto.status;

    if (statusDto.lastAction) {
      lead.lastAction = statusDto.lastAction;
      lead.lastActionAt = new Date();
    }

    if (statusDto.nextFollowUpAt) {
      lead.nextFollowUpAt = new Date(statusDto.nextFollowUpAt);
    }

    if (statusDto.notes) {
      lead.notes.push(statusDto.notes);
    }

    await lead.save();

    // Create history entry
    await this.leadHistoryModel.create({
      leadId: lead._id,
      companyId,
      changeType: ChangeType.STATUS_CHANGE,
      changedBy: updatedBy ? ChangedBy.USER : ChangedBy.SYSTEM,
      userId: updatedBy,
      oldValue: oldStatus,
      newValue: statusDto.status,
      notes: statusDto.notes,
    });

    this.logger.log(`Lead ${leadId} status updated: ${oldStatus} -> ${statusDto.status}`);

    return lead;
  }

  /**
   * Add note to lead
   */
  async addNote(
    leadId: Types.ObjectId,
    companyId: Types.ObjectId,
    noteDto: AddLeadNoteDto,
    addedBy?: Types.ObjectId,
  ) {
    const lead = await this.leadModel.findOne({ _id: leadId, companyId });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    lead.notes.push(noteDto.note);
    await lead.save();

    // Create history entry
    await this.leadHistoryModel.create({
      leadId: lead._id,
      companyId,
      changeType: ChangeType.NOTE_ADDED,
      changedBy: addedBy ? ChangedBy.USER : ChangedBy.SYSTEM,
      userId: addedBy,
      notes: noteDto.note,
    });

    this.logger.log(`Note added to lead ${leadId}`);

    return lead;
  }

  /**
   * Delete lead
   */
  async deleteLead(leadId: Types.ObjectId, companyId: Types.ObjectId, deletedBy?: Types.ObjectId) {
    const lead = await this.leadModel.findOne({ _id: leadId, companyId });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Update manager stats if assigned
    if (lead.assignedTo) {
      const manager = await this.managerModel.findOne({
        userId: lead.assignedTo,
        companyId,
      });
      if (manager) {
        await this.managerModel.findByIdAndUpdate(manager._id, {
          $inc: { assignedLeadsCount: -1 },
        });
      }
    }

    await this.leadModel.deleteOne({ _id: leadId });

    // Create history entry
    await this.leadHistoryModel.create({
      leadId: lead._id,
      companyId,
      changeType: ChangeType.DELETED,
      changedBy: deletedBy ? ChangedBy.USER : ChangedBy.SYSTEM,
      userId: deletedBy,
    });

    this.logger.log(`Lead deleted: ${leadId}`);

    return {
      message: 'Lead deleted successfully',
    };
  }

  /**
   * Get lead pool (available leads)
   */
  async getLeadPool(companyId: Types.ObjectId, limit: number = 50, offset: number = 0) {
    const [leads, total] = await Promise.all([
      this.leadModel
        .find({
          companyId,
          isInPool: true,
          assignedTo: null,
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean(),
      this.leadModel.countDocuments({
        companyId,
        isInPool: true,
        assignedTo: null,
      }),
    ]);

    return {
      leads,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get lead history
   */
  async getLeadHistory(leadId: Types.ObjectId, companyId: Types.ObjectId) {
    const history = await this.leadHistoryModel
      .find({ leadId, companyId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    return history;
  }

  /**
   * Get lead statistics for company
   */
  async getLeadStats(companyId: Types.ObjectId) {
    const [total, byStatus, bySource, inPool, assigned] = await Promise.all([
      this.leadModel.countDocuments({ companyId }),
      this.leadModel.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.leadModel.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      this.leadModel.countDocuments({ companyId, isInPool: true, assignedTo: null }),
      this.leadModel.countDocuments({ companyId, assignedTo: { $ne: null } }),
    ]);

    return {
      total,
      byStatus,
      bySource,
      inPool,
      assigned,
      unassigned: total - assigned,
    };
  }
}
