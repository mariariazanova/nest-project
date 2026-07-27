import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ConsulService } from '@suggestify/backend/consul';

async function bootstrap() {
  const PORT = process.env.PORT || 3006;

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // RabbitMQ consumer: receives notification events from all producing services
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        process.env.RABBITMQ_URL || 'amqp://rabbit:rabbitpass@rabbitmq:5672',
      ],
      queue: 'notifications_queue',
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();
  await app.listen(PORT);

  const consulService = app.get(ConsulService);
  await consulService.registerService();
}

bootstrap();
