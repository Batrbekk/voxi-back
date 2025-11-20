// Полный seed скрипт для тестовых данных Voxi
// Создает: Компанию, Пользователя (админа), и AI Агента

print('🚀 Создание тестовых данных для Voxi...\n');

// ===== 1. СОЗДАНИЕ КОМПАНИИ =====
print('📦 Шаг 1: Создание тестовой компании...');

const company = {
  name: 'Тестовая Компания',
  industry: 'Технологии',
  website: 'https://test-company.voxi.kz',
  phone: '+77001234567',
  email: 'info@test-company.voxi.kz',
  address: {
    country: 'Kazakhstan',
    city: 'Алматы',
    street: 'пр. Абая, 150',
    postalCode: '050000'
  },
  settings: {
    defaultLanguage: 'ru-RU',
    timezone: 'Asia/Almaty',
    currency: 'KZT'
  },
  subscription: {
    planType: 'trial',
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
    maxAgents: 5,
    maxPhoneNumbers: 2,
    maxMonthlyMinutes: 1000
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const companyResult = db.companies.insertOne(company);
const companyId = companyResult.insertedId;

print('✅ Компания создана:', companyId);
print('   Название:', company.name);
print('');

// ===== 2. СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ-АДМИНА =====
print('👤 Шаг 2: Создание пользователя-админа...');

// Пароль: test123
// Хеш создан с помощью bcrypt (10 раундов)
const passwordHash = '$2b$10$X3kM9vKGZQKZ.Qz5QY5zPeH8xJ7Y9Z8wJ5kX3mK9vGZ.QzQY5zPeH';

const user = {
  email: 'admin@test-company.voxi.kz',
  password: passwordHash,
  firstName: 'Тест',
  lastName: 'Админов',
  phone: '+77001234567',
  role: 'COMPANY_ADMIN',
  companyId: companyId,
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const userResult = db.users.insertOne(user);
const userId = userResult.insertedId;

print('✅ Пользователь создан:', userId);
print('   Email:', user.email);
print('   Пароль: test123 (для входа)');
print('   Роль:', user.role);
print('');

// ===== 3. СОЗДАНИЕ AI АГЕНТА =====
print('🤖 Шаг 3: Создание AI агента...');

const agent = {
  companyId: companyId,
  name: 'Анна - Голосовой Ассистент',
  description: 'Дружелюбный AI ассистент для обработки входящих звонков и помощи клиентам',

  voiceSettings: {
    voiceName: 'ru-RU-Wavenet-A',
    language: 'ru-RU',
    gender: 'female',
    speakingRate: 1.0,
    pitch: 0.0,
    volumeGainDb: 0.0
  },

  aiSettings: {
    model: 'gemini-2.0-flash-exp',
    systemPrompt: 'Ты - Анна, профессиональный голосовой ассистент компании. Твоя задача - помогать клиентам с их вопросами о продуктах и услугах компании, записывать обращения и создавать приятный опыт общения. Будь дружелюбной, но профессиональной. Отвечай кратко и по делу - твои ответы будут озвучены голосом. Если клиент хочет поговорить с менеджером, скажи что передашь его обращение. Всегда представляйся в начале разговора.',
    temperature: 0.7,
    maxTokens: 256,
    integratedWithAi: true
  },

  workingHours: {
    enabled: true,
    timezone: 'Asia/Almaty',
    start: '09:00',
    end: '18:00',
    workDays: [1, 2, 3, 4, 5]
  },

  greetingMessage: 'Добрый день! Меня зовут Анна, я голосовой ассистент. Чем могу вам помочь сегодня?',
  fallbackMessage: 'Извините, я не совсем поняла. Не могли бы вы переформулировать ваш вопрос?',
  endingMessage: 'Спасибо за ваше обращение! Всего доброго!',

  phoneNumbers: [],
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  averageDuration: 0,
  conversionRate: 0,
  isActive: true,
  createdBy: userId,

  createdAt: new Date(),
  updatedAt: new Date()
};

const agentResult = db.agents.insertOne(agent);
const agentId = agentResult.insertedId;

print('✅ AI Агент создан:', agentId);
print('   Имя:', agent.name);
print('   Голос:', agent.voiceSettings.voiceName);
print('   AI модель:', agent.aiSettings.model);
print('');

// ===== ИТОГОВАЯ ИНФОРМАЦИЯ =====
print('═══════════════════════════════════════════');
print('✅ Тестовые данные успешно созданы!\n');
print('📋 ДАННЫЕ ДЛЯ ВХОДА:');
print('   Email:    admin@test-company.voxi.kz');
print('   Пароль:   test123');
print('   API URL:  https://api.voxi.kz/api');
print('');
print('🏢 КОМПАНИЯ:');
print('   ID:       ' + companyId);
print('   Название: ' + company.name);
print('');
print('🤖 AI АГЕНТ:');
print('   ID:       ' + agentId);
print('   Имя:      ' + agent.name);
print('   Модель:   ' + agent.aiSettings.model);
print('');
print('📝 СЛЕДУЮЩИЕ ШАГИ:');
print('   1. Войдите в систему через API или веб-интерфейс');
print('   2. Получите номер телефона (если нужно)');
print('   3. Назначьте номер агенту');
print('   4. Протестируйте звонок!');
print('═══════════════════════════════════════════');
