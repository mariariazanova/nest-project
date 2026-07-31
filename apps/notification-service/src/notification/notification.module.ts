import { Module } from '@nestjs/common';
import { NotificationWebSocketGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';

@Module({
  providers: [NotificationWebSocketGateway],
  controllers: [NotificationController],
})
export class NotificationModule {}
