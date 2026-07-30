import { Controller, All, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ProxyService } from './proxy.service';

@ApiExcludeController()
@Controller()
@UseGuards(ThrottlerGuard)
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('auth/*path')
  async proxyAuth(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'auth-service');
  }

  @All(['suggestion', 'suggestion/*path'])
  async proxySuggestion(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'suggestion-service');
  }

  @All(['history', 'history/*path'])
  async proxyHistory(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'history-service');
  }

  @All(['favorite', 'favorite/*path'])
  async proxyFavorite(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'favorite-service');
  }

  @All(['files', 'files/*path'])
  async proxyFiles(@Req() req: Request, @Res() res: Response) {
    // Stream endpoint returns binary bytes — bypass the JSON wrapper
    if (req.method === 'GET' && req.path.endsWith('/stream')) {
      return this.proxyService.forwardStream(req, res, 'file-service');
    }
    return this.proxyService.forward(req, res, 'file-service');
  }

  @All(['analytics', 'analytics/*path'])
  async proxyAnalytics(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'analytics-service');
  }
}
