import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { FavoriteModule } from './favorite/favorite.module';
import { HealthModule } from './health/health.module';
import { ConsulModule } from './infrastructure/consul/consul.module';
import { CircuitBreakerModule } from './infrastructure/circuit-breaker/circuit-breaker.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { FavoriteEntity } from './favorite/entities/favorite.entity';

@Module({
  imports: [
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
        synchronize: config.get<string>('NODE_ENV') === 'development',
        logging: config.get<string>('NODE_ENV') === 'development',
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
          ? `redis://:${encodeURIComponent(password)}@${host}:${port}/0`
          : `redis://${host}:${port}/0`;
        return {
          stores: [new KeyvRedis(url)],
          ttl: 900_000,
        };
      },
    }),
    FavoriteModule,
    HealthModule,
    ConsulModule,
    CircuitBreakerModule,
    MetricsModule,
  ],
})
export class AppModule {}
