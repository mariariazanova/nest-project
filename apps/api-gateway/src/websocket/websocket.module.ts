import { Module } from '@nestjs/common';
import { WebSocketProxyGateway } from './websocket-proxy.gateway';

@Module({
  providers: [WebSocketProxyGateway],
})
export class WebSocketModule {}
