import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Agent, AgentDocument } from '../../schemas/agent.schema';
import { CreateAgentDto, UpdateAgentDto } from './dto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
  ) {}

  /**
   * Create a new agent
   */
  async createAgent(companyId: Types.ObjectId, createDto: CreateAgentDto, createdBy?: Types.ObjectId) {
    // Check if agent name already exists
    const existingAgent = await this.agentModel.findOne({
      companyId,
      name: createDto.name,
    });

    if (existingAgent) {
      throw new ConflictException('Agent with this name already exists');
    }

    // Validate phone numbers uniqueness if provided
    if (createDto.phoneNumbers && createDto.phoneNumbers.length > 0) {
      const existingPhone = await this.agentModel.findOne({
        companyId,
        phoneNumbers: { $in: createDto.phoneNumbers },
      });

      if (existingPhone) {
        throw new ConflictException('One or more phone numbers are already assigned to another agent');
      }
    }

    const agent = await this.agentModel.create({
      ...createDto,
      companyId,
      createdBy,
      isActive: true,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
    });

    this.logger.log(`Agent created: ${agent._id} - ${agent.name}`);

    return agent;
  }

  /**
   * Get all agents for a company
   */
  async getAgentsByCompany(companyId: Types.ObjectId, isActive?: boolean) {
    const query: any = { companyId };

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const agents = await this.agentModel
      .find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    return agents;
  }

  /**
   * Get agent by ID
   */
  async getAgentById(agentId: Types.ObjectId, companyId: Types.ObjectId) {
    const agent = await this.agentModel
      .findOne({ _id: agentId, companyId })
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent;
  }

  /**
   * Update agent
   */
  async updateAgent(
    agentId: Types.ObjectId,
    companyId: Types.ObjectId,
    updateDto: UpdateAgentDto,
  ) {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Check name uniqueness if updating name
    if (updateDto.name && updateDto.name !== agent.name) {
      const existingAgent = await this.agentModel.findOne({
        companyId,
        name: updateDto.name,
        _id: { $ne: agentId },
      });

      if (existingAgent) {
        throw new ConflictException('Agent with this name already exists');
      }
    }

    // Check phone numbers uniqueness if updating
    if (updateDto.phoneNumbers && updateDto.phoneNumbers.length > 0) {
      const existingPhone = await this.agentModel.findOne({
        companyId,
        phoneNumbers: { $in: updateDto.phoneNumbers },
        _id: { $ne: agentId },
      });

      if (existingPhone) {
        throw new ConflictException('One or more phone numbers are already assigned to another agent');
      }
    }

    Object.assign(agent, updateDto);
    await agent.save();

    this.logger.log(`Agent updated: ${agentId}`);

    return agent;
  }

  /**
   * Activate/Deactivate agent
   */
  async toggleAgentStatus(agentId: Types.ObjectId, companyId: Types.ObjectId, isActive: boolean) {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    agent.isActive = isActive;
    await agent.save();

    this.logger.log(`Agent ${agentId} ${isActive ? 'activated' : 'deactivated'}`);

    return {
      message: `Agent ${isActive ? 'activated' : 'deactivated'} successfully`,
      agent,
    };
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: Types.ObjectId, companyId: Types.ObjectId) {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Check if agent has active calls (in real implementation)
    // For now, just delete

    await this.agentModel.deleteOne({ _id: agentId });

    this.logger.log(`Agent deleted: ${agentId}`);

    return {
      message: 'Agent deleted successfully',
    };
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(agentId: Types.ObjectId, companyId: Types.ObjectId) {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return {
      totalCalls: agent.totalCalls,
      successfulCalls: agent.successfulCalls,
      failedCalls: agent.failedCalls,
      successRate: agent.totalCalls > 0
        ? ((agent.successfulCalls / agent.totalCalls) * 100).toFixed(2)
        : 0,
      averageDuration: agent.averageDuration,
      phoneNumbers: agent.phoneNumbers,
      isActive: agent.isActive,
    };
  }

  /**
   * Assign phone number to agent
   */
  async assignPhoneNumber(
    agentId: Types.ObjectId,
    companyId: Types.ObjectId,
    phoneNumber: string,
  ) {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Check if phone number is already assigned
    const existingPhone = await this.agentModel.findOne({
      companyId,
      phoneNumbers: phoneNumber,
    });

    if (existingPhone) {
      throw new ConflictException('Phone number is already assigned to another agent');
    }

    if (!agent.phoneNumbers.includes(phoneNumber)) {
      agent.phoneNumbers.push(phoneNumber);
      await agent.save();
    }

    this.logger.log(`Phone number ${phoneNumber} assigned to agent ${agentId}`);

    return {
      message: 'Phone number assigned successfully',
      agent,
    };
  }

  /**
   * Remove phone number from agent
   */
  async removePhoneNumber(
    agentId: Types.ObjectId,
    companyId: Types.ObjectId,
    phoneNumber: string,
  ) {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    agent.phoneNumbers = agent.phoneNumbers.filter((phone) => phone !== phoneNumber);
    await agent.save();

    this.logger.log(`Phone number ${phoneNumber} removed from agent ${agentId}`);

    return {
      message: 'Phone number removed successfully',
      agent,
    };
  }

  /**
   * Update agent call statistics (called after call completion)
   */
  async updateCallStats(
    agentId: Types.ObjectId,
    companyId: Types.ObjectId,
    success: boolean,
    duration: number,
  ) {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    agent.totalCalls += 1;

    if (success) {
      agent.successfulCalls += 1;
    } else {
      agent.failedCalls += 1;
    }

    // Calculate new average duration
    const totalDuration = agent.averageDuration * (agent.totalCalls - 1) + duration;
    agent.averageDuration = Math.round(totalDuration / agent.totalCalls);

    await agent.save();

    this.logger.log(`Agent ${agentId} call stats updated`);

    return agent;
  }

  /**
   * Check if agent is available (working hours)
   */
  async isAgentAvailable(agentId: Types.ObjectId, companyId: Types.ObjectId): Promise<boolean> {
    const agent = await this.agentModel.findOne({ _id: agentId, companyId });

    if (!agent || !agent.isActive) {
      return false;
    }

    // If working hours not set, agent is always available
    if (!agent.workingHours || !agent.workingHours.enabled) {
      return true;
    }

    const now = new Date();
    const workingHours = agent.workingHours;

    // Check if today is a working day
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    if (!workingHours.workDays.includes(dayOfWeek)) {
      return false;
    }

    // Check if current time is within working hours
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: workingHours.timezone
    });

    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);

    const currentMinutes = currentHour * 60 + currentMinute;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Get available agents (active and within working hours)
   */
  async getAvailableAgents(companyId: Types.ObjectId) {
    const agents = await this.agentModel.find({
      companyId,
      isActive: true
    }).lean();

    const availableAgents: typeof agents = [];

    for (const agent of agents) {
      const isAvailable = await this.isAgentAvailable(agent._id as Types.ObjectId, companyId);
      if (isAvailable) {
        availableAgents.push(agent);
      }
    }

    return availableAgents;
  }
}
