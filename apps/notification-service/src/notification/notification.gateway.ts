import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class NotificationWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationWebSocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const room = `user:${data.userId}`;

    client.join(room);
    client.emit('joined', { room, userId: data.userId });

    this.logger.log(`Socket ${client.id} joined room ${room}`);
  }

  sendToUser(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.server.to(`user:${userId}`).emit(event, { userId, ...payload });
  }
}
