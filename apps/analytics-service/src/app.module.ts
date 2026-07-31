import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConsulModule } from '@suggestify/backend/consul';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AnalyticsEventEntity } from './analytics/analytics-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // synchronize: true — convert to migration when Phase 1.1 (DB Migrations) runs
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'postgres-analytics'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'analytics_db'),
        entities: [AnalyticsEventEntity],
        synchronize: true,
        logging: config.get<string>('NODE_ENV') === 'development',
        ssl:
          config.get<string>('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),

    HealthModule,
    AnalyticsModule,
    ConsulModule.forRoot({
      serviceName: 'analytics-service',
      servicePort: 3007,
      tags: ['analytics', 'microservice', 'nestjs'],
    }),
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'analytics-service' }),
  ],
})
export class AppModule {}
