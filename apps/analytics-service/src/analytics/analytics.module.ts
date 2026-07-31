import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEventEntity } from './analytics-event.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsKafkaConsumerService } from './analytics-kafka-consumer.service';
import { AnalyticsQueryController } from './analytics-query.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEventEntity])],
  providers: [AnalyticsService, AnalyticsKafkaConsumerService],
  controllers: [AnalyticsQueryController],
})
export class AnalyticsModule {}
