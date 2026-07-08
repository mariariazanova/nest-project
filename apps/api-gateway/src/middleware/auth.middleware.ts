import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(
    @Inject('AUTH_SERVICE') private authClient: ClientProxy,
    private readonly cls: ClsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0];
    this.logger.debug(`Auth check: ${req.method} ${path}`);

    if (this.isPublicRoute(path)) {
      this.logger.debug(`Public route - skipping auth`);
      return next();
    }

    this.logger.debug(`Protected route - checking token`);

    const token = this.extractToken(req);

    this.logger.debug(`Found token: ${token}`);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const result = await firstValueFrom(
        this.authClient.send(
          { cmd: 'validate_token' },
          { token, correlationId: this.cls.get(CORRELATION_ID_KEY) },
        ),
      );

      this.logger.debug(`Result got: ${result}`);
      if (!result.valid) {
        throw new UnauthorizedException('Invalid token');
      }

      // Attach user to request
      req['user'] = {
        userId: result.userId,
        username: result.username,
      };

      next();
    } catch (error) {
      this.logger.error(`Validation error: ${JSON.stringify(error)}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');

    return type === 'Bearer' ? token : null;
  }

  private isPublicRoute(path: string): boolean {
    const publicRoutes = [
      '/v1/auth/users', // signup
      '/v1/auth/sessions', // login
      '/v1/health',
      '/v1/metrics',
    ];

    return publicRoutes.some((route) => path.startsWith(route));
  }
}
