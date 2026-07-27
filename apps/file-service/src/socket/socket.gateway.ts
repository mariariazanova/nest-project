import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class SocketGateway {
  constructor(
    @Inject('NOTIFICATION_CLIENT')
    private readonly notificationClient: ClientProxy,
  ) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.notificationClient.emit(event, {
      userId,
      ...(payload as Record<string, unknown>),
    });
  }
}
