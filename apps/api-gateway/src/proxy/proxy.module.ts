import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { AuthMiddleware } from '../middleware/auth.middleware';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 0,
    }),
  ],
  controllers: [ProxyController],
  providers: [ProxyService, AuthMiddleware],
  exports: [AuthMiddleware],
})
export class ProxyModule {}
