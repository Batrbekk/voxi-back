# Multi-stage build для оптимизации размера образа
FROM node:20-alpine AS builder

# Установка зависимостей для сборки
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./

# Установка зависимостей
RUN npm ci

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Production образ
FROM node:20-alpine

# Установка runtime зависимостей
RUN apk add --no-cache dumb-init

WORKDIR /app

# Копирование package.json для production установки
COPY package*.json ./

# Установка только production зависимостей
RUN npm ci --only=production && npm cache clean --force

# Копирование собранного приложения из builder stage
COPY --from=builder /app/dist ./dist

# Создание директории для временных аудио файлов
RUN mkdir -p /tmp/voxi-audio && chmod 777 /tmp/voxi-audio

# Использование non-root пользователя для безопасности
USER node

# Использование dumb-init для правильной обработки сигналов
ENTRYPOINT ["dumb-init", "--"]

# Запуск приложения
CMD ["node", "dist/main.js"]
