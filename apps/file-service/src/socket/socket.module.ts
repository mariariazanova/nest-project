import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SocketGateway } from './socket.gateway';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATION_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ||
              'amqp://rabbit:rabbitpass@rabbitmq:5672',
          ],
          queue: 'notifications_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
