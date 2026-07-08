import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { ThrottlerModule } from '@nestjs/throttler';

// Modules
import { ProxyModule } from './proxy/proxy.module';
import { HealthModule } from '@suggestify/backend/health';
import { ConsulModule } from '@suggestify/backend/consul';
import { CircuitBreakerModule } from '@suggestify/backend/circuit-breaker';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';

// Middleware
import { MetricsMiddleware } from './middleware/metrics.middleware';
import { AuthMiddleware } from './middleware/auth.middleware';

// Clients
import { GlobalClientsModule } from './clients/clients.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('RATE_LIMIT_WINDOW_MS', 60000),
            limit: config.get('RATE_LIMIT_MAX_REQUESTS', 100),
          },
        ],
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
          stores: [new KeyvRedis(url, { connectionTimeout: 10_000 })],
          ttl: 300_000,
        };
      },
    }),

    GlobalClientsModule,
    ProxyModule,
    HealthModule,
    ConsulModule.forRoot({
      serviceName: 'api-gateway',
      servicePort: 3000,
      tags: ['api-gateway', 'microservice', 'nestjs'],
    }),
    CircuitBreakerModule,
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'api-gateway' }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware, AuthMiddleware).forRoutes('*path');
  }
}
