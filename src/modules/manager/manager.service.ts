import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Manager, ManagerDocument } from '../../schemas/manager.schema';
import { User, UserDocument, UserRole, UserStatus } from '../../schemas/user.schema';
import { EmailService } from '../email/email.service';
import { InviteManagerDto, UpdateManagerDto } from './dto';

@Injectable()
export class ManagerService {
  private readonly logger = new Logger(ManagerService.name);

  constructor(
    @InjectModel(Manager.name) private managerModel: Model<ManagerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private emailService: EmailService,
  ) {}

  /**
   * Invite a new manager
   */
  async inviteManager(
    companyId: Types.ObjectId,
    adminId: Types.ObjectId,
    inviteDto: InviteManagerDto,
  ) {
    const { email, firstName, lastName, permissions } = inviteDto;

    // Check if user with this email already exists
    const existingUser = await this.userModel.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create User
    const user = await this.userModel.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      companyId,
      role: UserRole.MANAGER,
      status: UserStatus.ACTIVE,
      isEmailVerified: true, // Auto-verified for invited managers
    });

    // Create Manager record
    const manager = await this.managerModel.create({
      userId: user._id,
      companyId,
      addedBy: adminId,
      permissions: permissions || {},
      invitedAt: new Date(),
      temporaryPassword: hashedPassword,
      hasChangedPassword: false,
    });

    this.logger.log(`Manager invited: ${email} by admin ${adminId}`);

    // Send invitation email
    try {
      await this.emailService.sendManagerInvitation(
        email,
        firstName,
        temporaryPassword,
      );
    } catch (error) {
      this.logger.error('Failed to send invitation email', error);
      // Don't throw error here, manager is already created
    }

    return {
      message: 'Manager invited successfully',
      managerId: manager._id,
      userId: user._id,
      temporaryPassword, // Return for testing/debugging (remove in production)
    };
  }

  /**
   * Get all managers for a company
   */
  async getManagersByCompany(companyId: Types.ObjectId) {
    const managers = await this.managerModel
      .find({ companyId })
      .populate('userId', 'firstName lastName email lastLoginAt')
      .populate('addedBy', 'firstName lastName email')
      .sort({ invitedAt: -1 })
      .lean();

    return managers;
  }

  /**
   * Get manager by ID
   */
  async getManagerById(managerId: Types.ObjectId, companyId: Types.ObjectId) {
    const manager = await this.managerModel
      .findOne({ _id: managerId, companyId })
      .populate('userId', 'firstName lastName email phone lastLoginAt')
      .populate('addedBy', 'firstName lastName email')
      .lean();

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    return manager;
  }

  /**
   * Get manager by userId
   */
  async getManagerByUserId(userId: Types.ObjectId) {
    const manager = await this.managerModel
      .findOne({ userId })
      .populate('userId')
      .lean();

    return manager;
  }

  /**
   * Update manager permissions
   */
  async updateManagerPermissions(
    managerId: Types.ObjectId,
    companyId: Types.ObjectId,
    updateDto: UpdateManagerDto,
  ) {
    const manager = await this.managerModel.findOne({
      _id: managerId,
      companyId,
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    if (updateDto.permissions) {
      manager.permissions = {
        ...manager.permissions,
        ...updateDto.permissions,
      };
    }

    if (updateDto.isActive !== undefined) {
      manager.isActive = updateDto.isActive;
    }

    await manager.save();

    this.logger.log(`Manager ${managerId} permissions updated`);

    return {
      message: 'Manager updated successfully',
      manager,
    };
  }

  /**
   * Deactivate manager
   */
  async deactivateManager(managerId: Types.ObjectId, companyId: Types.ObjectId) {
    const manager = await this.managerModel.findOne({
      _id: managerId,
      companyId,
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    manager.isActive = false;
    await manager.save();

    // Also deactivate the user
    await this.userModel.findByIdAndUpdate(manager.userId, {
      status: UserStatus.INACTIVE,
    });

    this.logger.log(`Manager ${managerId} deactivated`);

    return {
      message: 'Manager deactivated successfully',
    };
  }

  /**
   * Delete manager
   */
  async deleteManager(managerId: Types.ObjectId, companyId: Types.ObjectId) {
    const manager = await this.managerModel.findOne({
      _id: managerId,
      companyId,
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    // Check if manager has assigned leads
    if (manager.assignedLeadsCount > 0) {
      throw new BadRequestException(
        'Cannot delete manager with assigned leads. Please reassign leads first.',
      );
    }

    // Delete manager record
    await this.managerModel.deleteOne({ _id: managerId });

    // Delete user record
    await this.userModel.deleteOne({ _id: manager.userId });

    this.logger.log(`Manager ${managerId} deleted`);

    return {
      message: 'Manager deleted successfully',
    };
  }

  /**
   * Get manager statistics
   */
  async getManagerStats(managerId: Types.ObjectId, companyId: Types.ObjectId) {
    const manager = await this.managerModel.findOne({
      _id: managerId,
      companyId,
    });

    if (!manager) {
      throw new NotFoundException('Manager not found');
    }

    return {
      assignedLeadsCount: manager.assignedLeadsCount,
      completedCallsCount: manager.completedCallsCount,
      successfulConversionsCount: manager.successfulConversionsCount,
      conversionRate:
        manager.completedCallsCount > 0
          ? (manager.successfulConversionsCount / manager.completedCallsCount) * 100
          : 0,
    };
  }

  /**
   * Mark first login
   */
  async markFirstLogin(managerId: Types.ObjectId) {
    await this.managerModel.findByIdAndUpdate(managerId, {
      firstLoginAt: new Date(),
    });
  }

  /**
   * Mark password changed
   */
  async markPasswordChanged(managerId: Types.ObjectId) {
    await this.managerModel.findByIdAndUpdate(managerId, {
      hasChangedPassword: true,
      temporaryPassword: null,
    });
  }

  /**
   * Generate temporary password
   */
  private generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }
}
