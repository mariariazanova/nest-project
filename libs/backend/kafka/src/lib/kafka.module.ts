import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserActivityProducerService } from './user-activity-producer.service';

@Module({
  imports: [ConfigModule],
  providers: [UserActivityProducerService],
  exports: [UserActivityProducerService],
})
export class KafkaModule {}
