import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationWebSocketGateway } from './notification.gateway';

interface NotificationPayload {
  userId: string;
  [key: string]: unknown;
}

@Controller()
export class NotificationController {
  constructor(private readonly gateway: NotificationWebSocketGateway) {}

  @EventPattern('upload-progress')
  handleUploadProgress(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'upload-progress', rest);
  }

  @EventPattern('upload-complete')
  handleUploadComplete(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'upload-complete', rest);
  }

  @EventPattern('upload-error')
  handleUploadError(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'upload-error', rest);
  }

  @EventPattern('suggestion-created')
  handleSuggestionCreated(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'suggestion-created', rest);
  }

  @EventPattern('favorite-added')
  handleFavoriteAdded(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'favorite-added', rest);
  }

  @EventPattern('favorite-deleted')
  handleFavoriteDeleted(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'favorite-deleted', rest);
  }

  @EventPattern('file-deleted')
  handleFileDeleted(@Payload() data: NotificationPayload) {
    const { userId, ...rest } = data;
    this.gateway.sendToUser(userId, 'file-deleted', rest);
  }
}
