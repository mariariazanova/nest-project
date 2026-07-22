import { Global, Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

// @Global() makes SocketGateway available everywhere without per-module imports.
// Phase 2.2 will swap the no-op stub for the real Socket.IO gateway here.
@Global()
@Module({
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
