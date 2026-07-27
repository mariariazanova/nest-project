import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

const NOTIFICATION_EVENTS = [
  'upload-progress',
  'upload-complete',
  'upload-error',
  'suggestion-created',
  'favorite-added',
  'favorite-deleted',
  'file-deleted',
];

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: (
      origin: string,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = (
        process.env.CORS_ORIGIN || 'http://localhost:4200'
      ).split(',');
      if (!origin || allowed.includes(origin) || allowed.includes('*')) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
})
@Injectable()
export class WebSocketProxyGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebSocketProxyGateway.name);

  // Single shared connection to notification-service (not one per frontend client)
  private notificationClient: ClientSocket;

  // userId → Set of frontend socket IDs (one user may have multiple tabs)
  private readonly userToClientsMap = new Map<string, Set<string>>();
  // frontend socket ID → userId
  private readonly clientToUserMap = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  afterInit() {
    const notificationUrl = this.config.get(
      'NOTIFICATION_SERVICE_URL',
      'http://notification-service:3006',
    );

    this.notificationClient = ioClient(notificationUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    this.notificationClient.on('connect', () =>
      this.logger.log('Connected to notification-service'),
    );
    this.notificationClient.on('disconnect', (reason) =>
      this.logger.warn(`Disconnected from notification-service: ${reason}`),
    );
    this.notificationClient.on('connect_error', (err) =>
      this.logger.error(
        `notification-service connection error: ${err.message}`,
      ),
    );

    // Forward all notification events to the right frontend clients
    NOTIFICATION_EVENTS.forEach((eventName) => {
      this.notificationClient.on(eventName, (data: { userId: string }) => {
        const clientIds = this.userToClientsMap.get(data.userId);
        if (clientIds) {
          clientIds.forEach((clientId) =>
            this.server.to(clientId).emit(eventName, data),
          );
        }
      });
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Rejected WS connection — no token (${client.id})`);
      client.disconnect();
      return;
    }

    try {
      const result = await firstValueFrom(
        this.authClient.send<{ valid: boolean; userId: string }>(
          { cmd: 'validate_token' },
          { token },
        ),
      );

      if (!result.valid) {
        this.logger.warn(
          `Rejected WS connection — invalid token (${client.id})`,
        );
        client.disconnect();
        return;
      }

      client.data.userId = result.userId;
      this.logger.log(
        `WS connected: userId=${result.userId} socketId=${client.id}`,
      );
    } catch (err) {
      this.logger.error(`WS auth error for socket ${client.id}`, err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.clientToUserMap.get(client.id);
    if (userId) {
      const clients = this.userToClientsMap.get(userId);
      clients?.delete(client.id);
      if (clients?.size === 0) this.userToClientsMap.delete(userId);
      this.clientToUserMap.delete(client.id);
    }
    this.logger.log(`WS disconnected: socketId=${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    if (!this.userToClientsMap.has(userId)) {
      this.userToClientsMap.set(userId, new Set());
    }
    this.userToClientsMap.get(userId)?.add(client.id);
    this.clientToUserMap.set(client.id, userId);

    // Tell notification-service to add the shared proxy socket to this user's room
    this.notificationClient.emit('join', { userId });

    client.emit('joined', { room: `user:${userId}`, userId });
    this.logger.log(`Client ${client.id} registered for userId=${userId}`);
  }

  onModuleDestroy() {
    this.notificationClient.disconnect();
  }
}
