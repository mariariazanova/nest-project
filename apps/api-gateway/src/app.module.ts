import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ThrottlerModule } from '@nestjs/throttler';

// Modules
import { ProxyModule } from './proxy/proxy.module';
import { HealthModule } from './health/health.module';
import { ConsulModule } from './infrastructure/consul/consul.module';
import { CircuitBreakerModule } from './infrastructure/circuit-breaker/circuit-breaker.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';

// Middleware
import { LoggingMiddleware } from './middleware/logging.middleware';
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
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get('REDIS_HOST'),
            port: config.get('REDIS_PORT'),
            reconnectStrategy: (retries) => Math.min(retries * 50, 500),
            connectTimeout: 10000,
          },
          password: config.get('REDIS_PASSWORD'),
          database: 0, // DB 0 for API Gateway
          ttl: 300, // 5 minutes
        }),
      }),
    }),

    GlobalClientsModule,
    ProxyModule,
    HealthModule,
    ConsulModule,
    CircuitBreakerModule,
    MetricsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware, MetricsMiddleware, AuthMiddleware).forRoutes('*');
  }
}
