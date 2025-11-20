import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
} from '../../schemas/subscription.schema';
import { Plan, PlanDocument, PlanType } from '../../schemas/plan.schema';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Plan.name)
    private planModel: Model<PlanDocument>,
  ) {}

  // Получить все тарифные планы
  async getAllPlans(): Promise<Plan[]> {
    return this.planModel.find({ isActive: true }).exec();
  }

  // Получить тарифный план по ID
  async getPlanById(planId: string): Promise<Plan> {
    const plan = await this.planModel.findById(planId).exec();
    if (!plan) {
      throw new NotFoundException('План не найден');
    }
    return plan;
  }

  // Получить подписку компании
  async getCompanySubscription(companyId: Types.ObjectId): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .populate('planId')
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    return subscription;
  }

  // Создать подписку для компании
  async createSubscription(
    companyId: Types.ObjectId,
    planType: PlanType,
  ): Promise<Subscription> {
    // Проверяем, есть ли уже подписка
    const existingSubscription = await this.subscriptionModel
      .findOne({ companyId })
      .exec();

    if (existingSubscription) {
      throw new BadRequestException('У компании уже есть активная подписка');
    }

    // Находим план
    const plan = await this.planModel.findOne({ type: planType }).exec();
    if (!plan) {
      throw new NotFoundException('План не найден');
    }

    // Создаем подписку (пробный период 14 дней)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14); // 14 дней пробного периода

    const newSubscription = new this.subscriptionModel({
      companyId,
      planId: plan._id,
      status: SubscriptionStatus.TRIAL,
      startDate,
      endDate,
      autoRenew: true,
      currentPeriodUsage: {
        minutesUsed: 0,
        agentsCreated: 0,
        managersCreated: 0,
        whatsappMessagesUsed: 0,
      },
    });

    return newSubscription.save();
  }

  // Обновить подписку (сменить план)
  async updateSubscription(
    companyId: Types.ObjectId,
    planType: PlanType,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    const newPlan = await this.planModel.findOne({ type: planType }).exec();
    if (!newPlan) {
      throw new NotFoundException('План не найден');
    }

    subscription.planId = newPlan._id as Types.ObjectId;
    return subscription.save();
  }

  // Трекинг использования минут
  async trackMinutesUsage(
    companyId: Types.ObjectId,
    minutes: number,
  ): Promise<void> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    subscription.currentPeriodUsage.minutesUsed += minutes;
    await subscription.save();
  }

  // Трекинг создания агента
  async trackAgentCreation(companyId: Types.ObjectId): Promise<void> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    subscription.currentPeriodUsage.agentsCreated += 1;
    await subscription.save();
  }

  // Трекинг создания менеджера
  async trackManagerCreation(companyId: Types.ObjectId): Promise<void> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    subscription.currentPeriodUsage.managersCreated += 1;
    await subscription.save();
  }

  // Проверка лимитов
  async checkLimits(companyId: Types.ObjectId): Promise<{
    canCreateAgent: boolean;
    canCreateManager: boolean;
    canMakeCall: boolean;
    remainingMinutes: number;
  }> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .populate('planId')
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    const plan = subscription.planId as any;

    const canCreateAgent =
      plan.maxAgents === -1 ||
      subscription.currentPeriodUsage.agentsCreated < plan.maxAgents;

    const canCreateManager =
      plan.maxManagers === -1 ||
      subscription.currentPeriodUsage.managersCreated < plan.maxManagers;

    const remainingMinutes =
      plan.minutesIncluded - subscription.currentPeriodUsage.minutesUsed;

    const canMakeCall = remainingMinutes > 0;

    return {
      canCreateAgent,
      canCreateManager,
      canMakeCall,
      remainingMinutes: Math.max(0, remainingMinutes),
    };
  }

  // Отмена подписки
  async cancelSubscription(companyId: Types.ObjectId): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;

    return subscription.save();
  }

  // Возобновить подписку
  async renewSubscription(companyId: Types.ObjectId): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findOne({ companyId })
      .exec();

    if (!subscription) {
      throw new NotFoundException('Подписка не найдена');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.autoRenew = true;

    // Продлить на месяц
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + 1);
    subscription.endDate = newEndDate;

    // Сбросить счетчики использования
    subscription.currentPeriodUsage = {
      minutesUsed: 0,
      agentsCreated: 0,
      managersCreated: 0,
      whatsappMessagesUsed: 0,
    };

    return subscription.save();
  }
}
