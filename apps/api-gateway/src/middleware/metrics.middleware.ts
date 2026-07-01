import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '@suggestify/backend/metrics';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const serviceName = process.env.SERVICE_HOST || 'unknown-service';

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      const route = req.route?.path || req.path || 'unknown';
      const targetService = this.getTargetService(route);
      const labels = {
        method: req.method,
        route: route,
        status_code: res.statusCode.toString(),
        service: serviceName,
        target_service: targetService,
      };

      // Record metrics
      this.metricsService.httpRequestDuration.observe(labels, duration);
      this.metricsService.httpRequestTotal.inc(labels);
    });

    next();
  }

  private getTargetService(path: string): string {
    if (path.startsWith('/history')) return 'history-service';
    if (path.startsWith('/suggestion')) return 'suggestion-service';
    if (path.startsWith('/auth')) return 'auth-service';
    if (path.startsWith('/favorite')) return 'favorite-service';

    return 'unknown';
  }
}
