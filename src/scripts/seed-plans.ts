import { connect, connection } from 'mongoose';
import { PlanType } from '../schemas/plan.schema';

const MONGODB_URI =
  'mongodb+srv://admin_db_user:rCeekL8z3gybzD9K@voxi.nblzcdt.mongodb.net/voxi?appName=voxi';

const plans = [
  {
    type: PlanType.STARTER,
    name: 'Starter',
    nameRu: 'Стартовый',
    priceKzt: 12000,
    priceUsd: 26.67,
    minutesIncluded: 500,
    maxAgents: 2,
    maxManagers: 5,
    pricePerExtraMinute: 24,
    features: [
      '500 минут разговоров в месяц',
      'До 2 AI агентов',
      'До 5 менеджеров',
      'Базовая аналитика',
      'Email поддержка',
    ],
    isActive: true,
  },
  {
    type: PlanType.BUSINESS,
    name: 'Business',
    nameRu: 'Бизнес',
    priceKzt: 40000,
    priceUsd: 88.89,
    minutesIncluded: 2000,
    maxAgents: 10,
    maxManagers: 20,
    pricePerExtraMinute: 20,
    features: [
      '2,000 минут разговоров в месяц',
      'До 10 AI агентов',
      'До 20 менеджеров',
      'Расширенная аналитика',
      'Приоритетная поддержка',
      'Кастомизация промптов',
    ],
    isActive: true,
  },
  {
    type: PlanType.ENTERPRISE,
    name: 'Enterprise',
    nameRu: 'Корпоративный',
    priceKzt: 170000,
    priceUsd: 377.78,
    minutesIncluded: 10000,
    maxAgents: -1, // Безлимит
    maxManagers: -1, // Безлимит
    pricePerExtraMinute: 17,
    features: [
      '10,000 минут разговоров в месяц',
      'Безлимитное количество AI агентов',
      'Безлимитное количество менеджеров',
      'Полная аналитика и отчеты',
      'Выделенный менеджер',
      'SLA 99.9%',
      'Индивидуальные настройки',
      'API доступ',
    ],
    isActive: true,
  },
];

async function seedPlans() {
  try {
    console.log('Подключение к MongoDB...');
    await connect(MONGODB_URI);
    console.log('Подключено к MongoDB');

    const db = connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }
    const plansCollection = db.collection('plans');

    // Удаляем существующие планы
    console.log('Удаление существующих планов...');
    await plansCollection.deleteMany({});

    // Добавляем новые планы
    console.log('Добавление тарифных планов...');
    const result = await plansCollection.insertMany(plans);
    console.log(`Добавлено ${result.insertedCount} тарифных планов`);

    console.log('\nТарифные планы успешно добавлены:');
    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.nameRu} (${plan.name})`);
      console.log(`   Цена: ${plan.priceKzt}₸ / месяц`);
      console.log(`   Минут: ${plan.minutesIncluded}`);
      console.log(`   Агентов: ${plan.maxAgents === -1 ? 'Безлимит' : plan.maxAgents}`);
      console.log(`   Менеджеров: ${plan.maxManagers === -1 ? 'Безлимит' : plan.maxManagers}`);
      console.log('');
    });

    await connection.close();
    console.log('Соединение с БД закрыто');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при добавлении планов:', error);
    await connection.close();
    process.exit(1);
  }
}

seedPlans();
