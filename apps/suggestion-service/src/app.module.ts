import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { SuggestionModule } from './suggestion/suggestion.module';
import { HealthModule } from './health/health.module';
import { ConsulModule } from '@suggestify/backend/consul';
import { CircuitBreakerModule } from '@suggestify/backend/circuit-breaker';
import { InitialSchema1783077978077 } from './migrations/1783077978077-InitialSchema';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';
import { BookEntity } from './suggestion/entities/book.entity';
import { FilmEntity } from './suggestion/entities/film.entity';
import { GameEntity } from './suggestion/entities/game.entity';
import { SongEntity } from './suggestion/entities/song.entity';
import { MoodEntity } from './shared/entities/mood.entity';
import { GenreEntity } from './shared/entities/genre.entity';
import { EventEntity } from './shared/entities/event.entity';
import { UserEntity } from './suggestion/entities/user.entity';
import { UserSuggestionEntity } from './suggestion/entities/user-suggestions.entity';
import { UserSuggestionCategoryEntity } from './suggestion/entities/user-suggestion-categories.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

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
        entities: [
          BookEntity,
          FilmEntity,
          GameEntity,
          SongEntity,
          MoodEntity,
          GenreEntity,
          EventEntity,
          UserEntity,
          UserSuggestionEntity,
          UserSuggestionCategoryEntity,
        ],
        synchronize: false,
        migrationsRun: true,
        migrations: [InitialSchema1783077978077],
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
          ? `redis://:${encodeURIComponent(password)}@${host}:${port}/2`
          : `redis://${host}:${port}/2`;
        return {
          stores: [new KeyvRedis(url, { connectionTimeout: 10_000 })],
          ttl: 3_600_000,
        };
      },
    }),

    SuggestionModule,
    HealthModule,
    ConsulModule.forRoot({
      serviceName: 'suggestion-service',
      servicePort: 3002,
      tags: ['suggestion', 'microservice', 'nestjs'],
    }),
    CircuitBreakerModule,
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'suggestion-service' }),
  ],
})
export class AppModule {}
