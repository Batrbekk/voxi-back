import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ManagerService } from './manager.service';
import { InviteManagerDto, UpdateManagerDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../schemas/user.schema';
import { Types } from 'mongoose';

@Controller('managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  /**
   * Invite a new manager
   */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async inviteManager(@Request() req, @Body() inviteDto: InviteManagerDto) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const adminId = new Types.ObjectId(req.user.userId);

    return this.managerService.inviteManager(companyId, adminId, inviteDto);
  }

  /**
   * Get all managers for the company
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getManagers(@Request() req) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.managerService.getManagersByCompany(companyId);
  }

  /**
   * Get manager by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getManagerById(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const managerId = new Types.ObjectId(id);

    return this.managerService.getManagerById(managerId, companyId);
  }

  /**
   * Update manager permissions
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateManager(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateManagerDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const managerId = new Types.ObjectId(id);

    return this.managerService.updateManagerPermissions(
      managerId,
      companyId,
      updateDto,
    );
  }

  /**
   * Deactivate manager
   */
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateManager(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const managerId = new Types.ObjectId(id);

    return this.managerService.deactivateManager(managerId, companyId);
  }

  /**
   * Delete manager
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteManager(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const managerId = new Types.ObjectId(id);

    return this.managerService.deleteManager(managerId, companyId);
  }

  /**
   * Get manager statistics
   */
  @Get(':id/stats')
  @HttpCode(HttpStatus.OK)
  async getManagerStats(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const managerId = new Types.ObjectId(id);

    return this.managerService.getManagerStats(managerId, companyId);
  }
}
