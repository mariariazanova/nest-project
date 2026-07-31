import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { TsRestModule } from '@ts-rest/nest';
import { FavoriteModule } from './favorite/favorite.module';
import { HealthModule } from './health/health.module';
import { ConsulModule } from '@suggestify/backend/consul';
import { CircuitBreakerModule } from '@suggestify/backend/circuit-breaker';
import { InitialSchema1783077978076 } from './migrations/1783077978076-InitialSchema';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';
import { FavoriteEntity } from './favorite/entities/favorite.entity';

@Module({
  imports: [
    TsRestModule.register({ isGlobal: true }),

    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database - PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [FavoriteEntity],
        synchronize: false,
        migrationsRun: true,
        migrations: [InitialSchema1783077978076],
        logging: config.get<string>('NODE_ENV') === 'development',
        ssl:
          config.get<string>('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
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
          ? `redis://:${encodeURIComponent(password)}@${host}:${port}/3`
          : `redis://${host}:${port}/3`;
        return {
          stores: [new KeyvRedis(url, { connectionTimeout: 10_000 })],
          ttl: 900_000,
        };
      },
    }),
    FavoriteModule,
    HealthModule,
    ConsulModule.forRoot({
      serviceName: 'favorite-service',
      servicePort: 3004,
      tags: ['favorite', 'microservice', 'nestjs'],
    }),
    CircuitBreakerModule,
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'favorite-service' }),
  ],
})
export class AppModule {}
