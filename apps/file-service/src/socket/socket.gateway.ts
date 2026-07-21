import { Injectable } from '@nestjs/common';

@Injectable()
export class SocketGateway {
  emitToUser(_userId: string, _event: string, _payload: unknown): void {
    // no-op until Phase 2.2 wires the real Socket.IO gateway
  }
}
