import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConsulService } from '@suggestify/backend/consul';

async function bootstrap() {
  const logger = new Logger('AuthService');
  const PORT = process.env.PORT || 3001;

  // HTTP Application
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // RabbitMQ Microservice consumer
  const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://rabbit:rabbitpass@rabbitmq:5672';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMQUrl],
      queue: 'auth_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  await app.listen(PORT);

  // Register with Consul
  const consulService = app.get(ConsulService);
  await consulService.registerService();

  logger.log(`Auth Service running on port ${PORT}`);
  logger.log(`RabbitMQ connected to ${rabbitMQUrl}`);
  logger.log(`Registered with Consul`);
}

bootstrap();
