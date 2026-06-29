import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConsulService } from './infrastructure/consul/consul.service';
import { SeedService } from './seed.service';

async function bootstrap() {
  const logger = new Logger('SuggestionService');
  const PORT = process.env.PORT || 3002;

  const app = await NestFactory.create(AppModule);

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

  // RabbitMQ Microservice consumer
  const rabbitMQUrl = process.env.RABBITMQ_URL;
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMQUrl],
      queue: 'suggestion_queue',
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();

  try {
    const seedService = app.get(SeedService);
    await seedService.seedData();
    logger.log(`Data seeded successfully`);
  } catch (error) {
    logger.warn(`Seed failed (may already exist): ${error.message}`);
  }

  await app.listen(PORT);

  const consulService = app.get(ConsulService);
  await consulService.registerService();

  logger.log(`Suggestion Service running on port ${PORT}`);
}

bootstrap();
