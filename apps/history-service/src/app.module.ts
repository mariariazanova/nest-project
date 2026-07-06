import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';

import { HistoryModule } from './history/history.module';
import { HealthModule } from './health/health.module';
import { ConsulModule } from '@suggestify/backend/consul';
import { CircuitBreakerModule } from '@suggestify/backend/circuit-breaker';
import { MetricsModule } from '@suggestify/backend/metrics';
import { DatabaseMigrationService } from './database/database-migration.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get('MONGODB_URI'),
        autoIndex: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // Redis Cache
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<string>('REDIS_PORT', '6379');
        const password = config.get<string>('REDIS_PASSWORD');
        const url = password
          ? `redis://:${encodeURIComponent(password)}@${host}:${port}/4`
          : `redis://${host}:${port}/4`;
        return {
          stores: [new KeyvRedis(url, { connectionTimeout: 10_000 })],
          ttl: 900_000,
        };
      },
    }),

    HistoryModule,
    HealthModule,
    ConsulModule.forRoot({
      serviceName: 'history-service',
      servicePort: 3003,
      tags: ['history', 'microservice', 'nestjs'],
    }),
    CircuitBreakerModule,
    MetricsModule,
  ],
  providers: [DatabaseMigrationService],
})
export class AppModule {}
