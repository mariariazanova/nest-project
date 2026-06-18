import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: client.Registry;

  // Metrics
  public readonly httpRequestDuration: client.Histogram;
  public readonly httpRequestTotal: client.Counter;
  public readonly activeConnections: client.Gauge;

  constructor() {
    this.register = new client.Registry();

    // Clear any existing metrics (prevents duplicates on hot reload)
    this.register.clear();

    // Collect default metrics
    client.collectDefaultMetrics({ register: this.register });

    // HTTP Request Duration
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service', 'target_service'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // HTTP Request Total
    this.httpRequestTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service', 'target_service'],
      registers: [this.register],
    });

    // Active Connections
    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['service'],
      registers: [this.register],
    });
  }

  getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
