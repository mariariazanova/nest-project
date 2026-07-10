import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ConsulService } from '@suggestify/backend/consul';
import { SeedService } from './seed.service';

async function bootstrap() {
  const PORT = process.env.PORT || 3002;

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  try {
    const seedService = app.get(SeedService);
    await seedService.seedData();
  } catch (error) {
    app
      .get(Logger)
      .warn(`Seed failed (may already exist): ${(error as Error).message}`);
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Suggestion Service')
    .setDescription(
      'Retrieve filtered suggestions and individual items by category',
    )
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDocument);

  await app.listen(PORT);

  const consulService = app.get(ConsulService);
  await consulService.registerService();
}

bootstrap();
