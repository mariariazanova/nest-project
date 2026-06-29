import { Controller, All, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ProxyService } from './proxy.service';

@Controller()
@UseGuards(ThrottlerGuard)
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('auth/*')
  async proxyAuth(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'auth-service');
  }

  @All('suggestion*')
  async proxySuggestion(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'suggestion-service');
  }

  @All('history*')
  async proxyHistory(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'history-service');
  }

  @All('favorite*')
  async proxyFavorite(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'favorite-service');
  }
}
