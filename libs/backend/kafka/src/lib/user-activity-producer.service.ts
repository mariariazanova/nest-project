import { randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { UserActivityType } from './user-activity.events';

@Injectable()
export class UserActivityProducerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly producer: Producer;
  private isConnected = false;
  private readonly logger = new Logger(UserActivityProducerService.name);

  constructor(private readonly config: ConfigService) {
    const kafka = new Kafka({
      clientId: config.get('SERVICE_NAME', 'service'),
      brokers: config.get('KAFKA_BROKERS', 'kafka:9092').split(','),
    });

    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
    }
  }

  async emit(
    eventType: UserActivityType,
    userId: string,
    payload: Record<string, unknown>,
    username?: string,
  ): Promise<void> {
    if (!this.isConnected) return;

    const eventId = randomUUID();
    const timestamp = new Date().toISOString();

    try {
      await this.producer.send({
        topic: 'user.activity',
        messages: [
          {
            key: userId,
            value: JSON.stringify({
              eventId,
              eventType,
              userId,
              username,
              timestamp,
              ...payload,
            }),
            headers: {
              eventType: Buffer.from(eventType),
              eventId: Buffer.from(eventId),
              timestamp: Buffer.from(timestamp),
            },
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Failed to emit ${eventType}`, error);
    }
  }
}
