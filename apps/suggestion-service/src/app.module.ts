import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
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
        ],
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
          stores: [new KeyvRedis(url, { connectionTimeout: 10_000 })],
          ttl: 3_600_000,
        };
      },
    }),

    SuggestionModule,
    HealthModule,
    ConsulModule,
    CircuitBreakerModule,
    MetricsModule,
  ],
})
export class AppModule {}
