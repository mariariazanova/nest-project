import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { SuggestionModule } from './suggestion/suggestion.module';
import { HealthModule } from './health/health.module';
import { ConsulModule } from './infrastructure/consul/consul.module';
import { CircuitBreakerModule } from './infrastructure/circuit-breaker/circuit-breaker.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { BookEntity } from './suggestion/entities/book.entity';
import { FilmEntity } from './suggestion/entities/film.entity';
import { GameEntity } from './suggestion/entities/game.entity';
import { SongEntity } from './suggestion/entities/song.entity';
import { MoodEntity } from './shared/entities/mood.entity';
import { GenreEntity } from './shared/entities/genre.entity';
import { EventEntity } from './shared/entities/event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [
          BookEntity,
          FilmEntity,
          GameEntity,
          SongEntity,
          MoodEntity,
          GenreEntity,
          EventEntity,
        ],
        synchronize: config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development',
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
          ttl: 3600, // 1 hour default
        }),
      }),
    }),

    SuggestionModule,
    HealthModule,
    ConsulModule,
    CircuitBreakerModule,
    MetricsModule,
  ],
})
export class AppModule {}
