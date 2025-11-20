#!/bin/bash

# Скрипт для создания тестового AI агента в Voxi

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="https://api.voxi.kz/api"

echo -e "${YELLOW}=== Создание тестового AI агента ===${NC}\n"

# Шаг 1: Получение токена (если еще нет)
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}Для создания агента нужен токен авторизации.${NC}"
  echo -e "Пожалуйста, установите переменную окружения AUTH_TOKEN:"
  echo -e "  export AUTH_TOKEN=\"ваш_jwt_токен\""
  echo ""
  echo -e "Или введите email и пароль для авторизации:"
  read -p "Email: " EMAIL
  read -sp "Password: " PASSWORD
  echo ""

  # Авторизация
  AUTH_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

  AUTH_TOKEN=$(echo $AUTH_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

  if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}❌ Ошибка авторизации!${NC}"
    echo "Ответ сервера: $AUTH_RESPONSE"
    exit 1
  fi

  echo -e "${GREEN}✅ Успешная авторизация!${NC}\n"
fi

# Шаг 2: Создание агента
echo -e "${YELLOW}Создаю тестового агента...${NC}"

RESPONSE=$(curl -s -X POST "$API_URL/agents" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-agent-example.json)

# Проверка ответа
AGENT_ID=$(echo $RESPONSE | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

if [ -z "$AGENT_ID" ]; then
  echo -e "${RED}❌ Ошибка создания агента!${NC}"
  echo "Ответ сервера: $RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Агент успешно создан!${NC}"
echo -e "ID агента: ${GREEN}$AGENT_ID${NC}"
echo ""

# Шаг 3: Получение информации об агенте
echo -e "${YELLOW}Получаю информацию об агенте...${NC}"

AGENT_INFO=$(curl -s -X GET "$API_URL/agents/$AGENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo -e "${GREEN}Информация об агенте:${NC}"
echo "$AGENT_INFO" | python3 -m json.tool 2>/dev/null || echo "$AGENT_INFO"

echo ""
echo -e "${GREEN}=== Агент готов к использованию! ===${NC}"
echo -e "Вы можете назначить агенту номер телефона через API:"
echo -e "  PATCH $API_URL/phone/numbers/{phoneNumberId}/assign-agent"
