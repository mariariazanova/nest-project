import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class SocketGateway {
  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    @Inject('NOTIFICATION_CLIENT')
    private readonly notificationClient: ClientProxy,
  ) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.notificationClient
      .emit(event, {
        userId,
        ...(payload as Record<string, unknown>),
      })
      .subscribe({
        error: (err) =>
          this.logger.error(`Failed to emit ${event} notification:`, err),
      });
  }
}
