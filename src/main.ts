import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  const apiPrefix = configService.get('API_PREFIX') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // CORS
  const corsOrigin = configService.get('CORS_ORIGIN') || 'http://localhost:3001';
  app.enableCors({
    origin: corsOrigin.split(','),
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`🚀 Voxi Backend is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📧 Email configured: ${configService.get('EMAIL_USER')}`);
  console.log(`💾 MongoDB connected: ${configService.get('DATABASE_NAME')}`);
}

bootstrap();
