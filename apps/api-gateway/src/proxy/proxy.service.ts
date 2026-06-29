import { Injectable, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConsulService } from '../infrastructure/consul/consul.service';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker/circuit-breaker.service';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly consulService: ConsulService,
    private readonly circuitBreaker: CircuitBreakerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async forward(req: Request, res: Response, serviceName: string) {
    try {
      this.logger.debug(`Forward request with body: ${JSON.stringify(req.body)}`);

      // Discover service URL
      const serviceUrl = await this.discoverServiceUrl(serviceName);
      this.logger.debug(`Discovered service URL: ${serviceUrl}`);

      if (!serviceUrl) {
        throw new HttpException(
          `Service ${serviceName} not available`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Build target URL
      const targetUrl = this.buildTargetUrl(serviceUrl, req);
      const headers = {
        ...this.filterHeaders(req.headers),
        'cache-control': 'no-cache, no-store, must-revalidate',
        pragma: 'no-cache',
      };

      if (req['user'] && req['user']['userId']) {
        headers['X-User-Id'] = req['user']['userId'];
      }

      // Execute with circuit breaker
      const response = await this.circuitBreaker.execute(
        `${serviceName}-${req.method}-${req.url}`,
        async () => {
          try {
            return await firstValueFrom(
              this.httpService.request({
                method: req.method,
                url: targetUrl,
                headers,
                data: req.body,
                params: req.query,
                timeout: 10000,
              }),
            );
          } catch (error) {
            // If 4xx - don't throw error, only return response
            if (error.response?.status >= 400 && error.response?.status < 500) {
              this.logger.debug(
                `Client error ${error.response.status} - not a circuit breaker failure`,
              );
              // Return object (it's not an error for Circuit Breaker)
              return {
                status: error.response.status,
                data: error.response.data,
              };
            }
            // If 5xx or timeout - throw error (Circuit Breaker will count it)
            throw error;
          }
        },
        () => {
          this.logger.error('Service temporarily unavailable (circuit breaker triggered)');
          throw new HttpException(
            'Service temporarily unavailable',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        },
      );

      this.logger.debug(`Received response from target service: ${JSON.stringify(response.data)}`);

      // Forward response
      res.status(response.status).json({
        data: response.data,
        links: this.buildResponseLinks(req.url),
      });
    } catch (error) {
      this.logger.error(`Catch error: ${error}`);
      this.handleError(error, res);
    }
  }

  private async discoverServiceUrl(serviceName: string): Promise<string | null> {
    const cached = await this.cacheManager.get<string>(`service:${serviceName}`);

    if (cached) {
      return cached;
    }

    // Discover from Consul
    const url = await this.consulService.discoverService(serviceName);

    if (url) {
      await this.cacheManager.set(`service:${serviceName}`, url, 30000); // Cache for 30 seconds
    }

    return url;
  }

  private buildTargetUrl(baseUrl: string, req: Request): string {
    const path = req.url.split('?')[0].replace(/^\/v1/, ''); // Remove query string and /v1/ prefix

    return `${baseUrl}${path}`;
  }

  private buildResponseLinks(url: string): Record<string, string> {
    const base: Record<string, string> = { self: url };

    if (url.includes('/auth/sessions')) {
      base['users'] = '/v1/auth/users/me';
      base['suggestions'] = '/v1/suggestion';
      base['favorites'] = '/v1/favorite';
      base['history'] = '/v1/history';
    }

    if (url.includes('/auth/users') && !url.includes('/me')) {
      base['sessions'] = '/v1/auth/sessions';
      base['users'] = '/v1/auth/users/me';
      base['suggestions'] = '/v1/suggestion';
      base['favorites'] = '/v1/favorite';
      base['history'] = '/v1/history';
    }

    if (url.includes('/auth/users/me')) {
      base['suggestions'] = '/v1/suggestion';
      base['favorites'] = '/v1/favorite';
      base['history'] = '/v1/history';
    }

    if (url.includes('/suggestion')) {
      base['favorites'] = '/v1/favorite';
      base['history'] = '/v1/history';
    }

    if (url.includes('/favorite')) {
      base['suggestions'] = '/v1/suggestion';
      base['history'] = '/v1/history';
    }

    if (url.includes('/history')) {
      base['suggestions'] = '/v1/suggestion';
      base['favorites'] = '/v1/favorite';
    }

    return base;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private filterHeaders(headers: any): any {
    const filtered = { ...headers };

    delete filtered.host;
    delete filtered['content-length'];

    return filtered;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleError(error: any, res: Response) {
    this.logger.error('Proxy error:', error.message || error);

    // Check if response already sent
    if (res.headersSent) {
      return;
    }

    if (error.response && error.response.status) {
      // Axios error with correct status
      res.status(error.response.status).json(error.response.data);
    } else if (error instanceof HttpException) {
      // NestJS HttpException
      res.status(error.getStatus()).json({
        statusCode: error.getStatus(),
        message: error.message,
      });
    } else {
      // Fallback for all other errors
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Internal server error',
      });
    }
  }
}
