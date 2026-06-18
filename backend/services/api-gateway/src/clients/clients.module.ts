import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Global()
@Module({
  imports: [
    // RabbitMQ Clients for producer
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const rabbitUrl =
            config.get<string>('RABBITMQ_URL') || 'amqp://rabbit:rabbitpass@rabbitmq:5672';

          return {
            transport: Transport.RMQ,
            options: {
              urls: [rabbitUrl],
              queue: 'auth_queue',
              queueOptions: { durable: true },
            },
          };
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class GlobalClientsModule {}
