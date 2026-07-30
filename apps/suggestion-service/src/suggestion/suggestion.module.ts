import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaModule } from '@suggestify/backend/kafka';
import { SuggestionController } from './suggestion.controller';
import { SuggestionService } from './suggestion.service';
import { BookEntity } from './entities/book.entity';
import { FilmEntity } from './entities/film.entity';
import { GameEntity } from './entities/game.entity';
import { SongEntity } from './entities/song.entity';
import { MoodEntity } from '../shared/entities/mood.entity';
import { GenreEntity } from '../shared/entities/genre.entity';
import { EventEntity } from '../shared/entities/event.entity';
import { SeedService } from '../seed.service';

@Module({
  imports: [
    KafkaModule,
    TypeOrmModule.forFeature([
      BookEntity,
      FilmEntity,
      GameEntity,
      SongEntity,
      MoodEntity,
      GenreEntity,
      EventEntity,
    ]),
    ClientsModule.registerAsync([
      {
        name: 'HISTORY_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const rabbitUrl =
            config.get('RABBITMQ_URL') ||
            'amqp://rabbit:rabbitpass@rabbitmq:5672';

          return {
            transport: Transport.RMQ,
            options: {
              urls: [rabbitUrl],
              queue: 'history_queue',
              queueOptions: { durable: true },
            },
          };
        },
      },
    ]),
    ClientsModule.register([
      {
        name: 'NOTIFICATION_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env['RABBITMQ_URL'] ||
              'amqp://rabbit:rabbitpass@rabbitmq:5672',
          ],
          queue: 'notifications_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [SuggestionController],
  providers: [SuggestionService, SeedService],
  exports: [SuggestionService, SeedService],
})
export class SuggestionModule {}
