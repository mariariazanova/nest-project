import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsulModule } from '@suggestify/backend/consul';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';
import { HealthModule } from './health/health.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    NotificationModule,
    ConsulModule.forRoot({
      serviceName: 'notification-service',
      servicePort: 3006,
      tags: ['notifications', 'microservice', 'nestjs'],
    }),
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'notification-service' }),
  ],
})
export class AppModule {}
