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
import { LeadService } from './lead.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  AssignLeadDto,
  UpdateLeadStatusDto,
  AddLeadNoteDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../schemas/user.schema';
import { LeadStatus } from '../../schemas/lead.schema';
import { Types } from 'mongoose';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  /**
   * Create a new lead
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async createLead(@Request() req, @Body() createDto: CreateLeadDto) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const userId = new Types.ObjectId(req.user.userId);

    return this.leadService.createLead(companyId, createDto, userId);
  }

  /**
   * Get all leads with filters
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getLeads(
    @Request() req,
    @Query('status') status?: LeadStatus,
    @Query('source') source?: string,
    @Query('isInPool') isInPool?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const userId = new Types.ObjectId(req.user.userId);

    // If manager, show only their leads unless they can view all
    let assignedTo: Types.ObjectId | undefined;
    if (req.user.role === UserRole.MANAGER) {
      // Check manager permissions
      const canViewAll = req.user.manager?.permissions?.canViewAllLeads;
      if (!canViewAll) {
        assignedTo = userId;
      }
    }

    return this.leadService.getLeads(companyId, {
      status,
      source,
      isInPool: isInPool === 'true',
      assignedTo,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * Get lead pool (available leads for taking)
   * Accessible by: MANAGER
   */
  @Get('pool')
  @Roles(UserRole.MANAGER, UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getLeadPool(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.leadService.getLeadPool(
      companyId,
      limit ? parseInt(limit) : undefined,
      offset ? parseInt(offset) : undefined,
    );
  }

  /**
   * Get lead statistics
   * Accessible by: COMPANY_ADMIN
   */
  @Get('stats')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getLeadStats(@Request() req) {
    const companyId = new Types.ObjectId(req.user.companyId);

    return this.leadService.getLeadStats(companyId);
  }

  /**
   * Get lead by ID
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getLeadById(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);

    return this.leadService.getLeadById(leadId, companyId);
  }

  /**
   * Update lead
   * Accessible by: COMPANY_ADMIN, MANAGER (with permission)
   */
  @Patch(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateLead(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateLeadDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(req.user.userId);

    return this.leadService.updateLead(leadId, companyId, updateDto, userId);
  }

  /**
   * Assign lead to manager
   * Accessible by: COMPANY_ADMIN
   */
  @Post(':id/assign')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async assignLead(
    @Request() req,
    @Param('id') id: string,
    @Body() assignDto: AssignLeadDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(req.user.userId);

    return this.leadService.assignLead(leadId, companyId, assignDto, userId);
  }

  /**
   * Take lead from pool (self-assign)
   * Accessible by: MANAGER
   */
  @Post(':id/take')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async takeLead(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);
    const managerId = new Types.ObjectId(req.user.userId);

    return this.leadService.takeLead(leadId, companyId, managerId);
  }

  /**
   * Update lead status
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Patch(':id/status')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async updateLeadStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() statusDto: UpdateLeadStatusDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(req.user.userId);

    return this.leadService.updateLeadStatus(leadId, companyId, statusDto, userId);
  }

  /**
   * Add note to lead
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Post(':id/notes')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async addNote(
    @Request() req,
    @Param('id') id: string,
    @Body() noteDto: AddLeadNoteDto,
  ) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(req.user.userId);

    return this.leadService.addNote(leadId, companyId, noteDto, userId);
  }

  /**
   * Get lead history
   * Accessible by: COMPANY_ADMIN, MANAGER
   */
  @Get(':id/history')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async getLeadHistory(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);

    return this.leadService.getLeadHistory(leadId, companyId);
  }

  /**
   * Delete lead
   * Accessible by: COMPANY_ADMIN
   */
  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteLead(@Request() req, @Param('id') id: string) {
    const companyId = new Types.ObjectId(req.user.companyId);
    const leadId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(req.user.userId);

    return this.leadService.deleteLead(leadId, companyId, userId);
  }
}
