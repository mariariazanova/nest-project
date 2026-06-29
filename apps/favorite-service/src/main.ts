import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConsulService } from './infrastructure/consul/consul.service';

async function bootstrap() {
  const logger = new Logger('FavoriteService');
  const PORT = process.env.PORT || 3004;

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

  await app.listen(PORT);

  const consulService = app.get(ConsulService);
  await consulService.registerService();

  logger.log(`Favorite Service running on port ${PORT}`);
}

bootstrap();
