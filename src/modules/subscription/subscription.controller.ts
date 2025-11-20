import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../schemas/user.schema';
import { Plan, PlanType } from '../../schemas/plan.schema';
import { Types } from 'mongoose';

@Controller('subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Получить все тарифные планы
  @Get('plans')
  async getAllPlans() {
    return this.subscriptionService.getAllPlans();
  }

  // Получить тарифный план по ID
  @Get('plans/:id')
  async getPlanById(@Param('id') id: string) {
    return this.subscriptionService.getPlanById(id);
  }

  // Получить текущую подписку компании
  @Get('current')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  async getCurrentSubscription(@Request() req) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.subscriptionService.getCompanySubscription(companyId);
  }

  // Создать подписку (обычно вызывается при регистрации)
  @Post()
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(@Request() req, @Body('planType') planType: PlanType) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.subscriptionService.createSubscription(companyId, planType);
  }

  // Обновить подписку (сменить план)
  @Put()
  @Roles(UserRole.COMPANY_ADMIN)
  async updateSubscription(@Request() req, @Body('planType') planType: PlanType) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.subscriptionService.updateSubscription(companyId, planType);
  }

  // Проверить лимиты тарифа
  @Get('limits')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  async checkLimits(@Request() req) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.subscriptionService.checkLimits(companyId);
  }

  // Отменить подписку
  @Delete()
  @Roles(UserRole.COMPANY_ADMIN)
  async cancelSubscription(@Request() req) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.subscriptionService.cancelSubscription(companyId);
  }

  // Возобновить подписку
  @Post('renew')
  @Roles(UserRole.COMPANY_ADMIN)
  async renewSubscription(@Request() req) {
    const companyId = Types.ObjectId.isValid(req.user.companyId)
      ? new Types.ObjectId(req.user.companyId)
      : req.user.companyId;

    return this.subscriptionService.renewSubscription(companyId);
  }
}
