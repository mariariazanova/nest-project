import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaModule } from '@suggestify/backend/kafka';
import { FavoriteController } from './favorite.controller';
import { FavoriteService } from './favorite.service';
import { FavoriteEntity } from './entities/favorite.entity';

@Module({
  imports: [
    KafkaModule,
    TypeOrmModule.forFeature([FavoriteEntity]),
    ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ||
              'amqp://rabbit:rabbitpass@rabbitmq:5672',
          ],
          queue: 'file_queue',
          queueOptions: { durable: true },
        },
      },
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
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
