import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsKafkaConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private consumer: Consumer;
  private readonly logger = new Logger(AnalyticsKafkaConsumerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const kafka = new Kafka({
      clientId: 'analytics-service',
      brokers: this.config.get('KAFKA_BROKERS', 'kafka:9092').split(','),
    });
    this.consumer = kafka.consumer({ groupId: 'analytics-consumer' });
    this.startConsumer().catch((err) =>
      this.logger.error('Kafka consumer failed to start', err),
    );
  }

  private async startConsumer(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: ['user.activity'],
        fromBeginning: false,
      });
      await this.consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          try {
            const event = JSON.parse(message.value.toString());
            await this.analyticsService.record(event);
          } catch (error) {
            this.logger.error('Failed to process Kafka message', error);
          }
        },
      });
      this.logger.log('Kafka consumer connected, subscribed to user.activity');
    } catch (error) {
      this.logger.error(
        'Kafka consumer startup failed — will not consume events',
        error,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }
}
