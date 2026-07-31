import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import * as client from 'prom-client';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize httpRequestDuration histogram', () => {
      expect(service.httpRequestDuration).toBeDefined();
      expect(service.httpRequestDuration).toBeInstanceOf(client.Histogram);
    });

    it('should initialize httpRequestTotal counter', () => {
      expect(service.httpRequestTotal).toBeDefined();
      expect(service.httpRequestTotal).toBeInstanceOf(client.Counter);
    });
  });

  describe('httpRequestDuration', () => {
    it('should record request duration', async () => {
      const labels = {
        method: 'GET',
        route: '/health',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      };

      service.httpRequestDuration.observe(labels, 0.123);

      const metricsString = await service.getMetrics();
      expect(metricsString).toContain('http_request_duration_seconds');
    });

    it('should handle multiple duration recordings', () => {
      const labels1 = {
        method: 'GET',
        route: '/users',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      };

      const labels2 = {
        method: 'POST',
        route: '/users',
        status_code: '201',
        service: 'api-gateway',
        target_service: 'auth-service',
      };

      expect(() => {
        service.httpRequestDuration.observe(labels1, 0.1);
        service.httpRequestDuration.observe(labels2, 0.2);
      }).not.toThrow();
    });

    it('should track different routes separately', async () => {
      service.httpRequestDuration.observe(
        {
          method: 'GET',
          route: '/route1',
          status_code: '200',
          service: 'api-gateway',
          target_service: 'service1',
        },
        0.1,
      );

      service.httpRequestDuration.observe(
        {
          method: 'GET',
          route: '/route2',
          status_code: '200',
          service: 'api-gateway',
          target_service: 'service2',
        },
        0.2,
      );

      const metricsString = await service.getMetrics();
      expect(metricsString).toContain('route1');
      expect(metricsString).toContain('route2');
    });

    it('should track different status codes', async () => {
      service.httpRequestDuration.observe(
        {
          method: 'GET',
          route: '/test',
          status_code: '200',
          service: 'api-gateway',
          target_service: 'auth-service',
        },
        0.1,
      );

      service.httpRequestDuration.observe(
        {
          method: 'GET',
          route: '/test',
          status_code: '404',
          service: 'api-gateway',
          target_service: 'auth-service',
        },
        0.2,
      );

      const metricsString = await service.getMetrics();
      expect(metricsString).toContain('status_code="200"');
      expect(metricsString).toContain('status_code="404"');
    });

    it('should handle very small durations', () => {
      expect(() => {
        service.httpRequestDuration.observe(
          {
            method: 'GET',
            route: '/fast',
            status_code: '200',
            service: 'api-gateway',
            target_service: 'auth-service',
          },
          0.001,
        );
      }).not.toThrow();
    });

    it('should handle large durations', () => {
      expect(() => {
        service.httpRequestDuration.observe(
          {
            method: 'GET',
            route: '/slow',
            status_code: '200',
            service: 'api-gateway',
            target_service: 'auth-service',
          },
          10.5,
        );
      }).not.toThrow();
    });
  });

  describe('httpRequestTotal', () => {
    it('should increment request counter', async () => {
      const labels = {
        method: 'GET',
        route: '/health',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      };

      service.httpRequestTotal.inc(labels);

      const metricsString = await service.getMetrics();
      expect(metricsString).toContain('http_requests_total');
    });

    it('should increment by custom amount', () => {
      const labels = {
        method: 'GET',
        route: '/batch',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      };

      expect(() => {
        service.httpRequestTotal.inc(labels, 5);
      }).not.toThrow();
    });

    it('should track multiple increments', () => {
      const labels = {
        method: 'GET',
        route: '/popular',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      };

      expect(() => {
        service.httpRequestTotal.inc(labels);
        service.httpRequestTotal.inc(labels);
        service.httpRequestTotal.inc(labels);
      }).not.toThrow();
    });

    it('should track different methods separately', async () => {
      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/test',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      service.httpRequestTotal.inc({
        method: 'POST',
        route: '/test',
        status_code: '201',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      const metricsString = await service.getMetrics();
      expect(metricsString).toContain('method="GET"');
      expect(metricsString).toContain('method="POST"');
    });

    it('should track error status codes', async () => {
      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/error',
        status_code: '500',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/notfound',
        status_code: '404',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      const metricsString = await service.getMetrics();
      expect(metricsString).toContain('status_code="500"');
      expect(metricsString).toContain('status_code="404"');
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/test',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      const metrics = await service.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
      expect(metrics).toContain('http_requests_total');
    });

    it('should include all registered metrics', async () => {
      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/test',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      service.httpRequestDuration.observe(
        {
          method: 'GET',
          route: '/test',
          status_code: '200',
          service: 'api-gateway',
          target_service: 'auth-service',
        },
        0.123,
      );

      const metrics = await service.getMetrics();

      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('http_request_duration_seconds');
    });

    it('should include default Node.js metrics', async () => {
      const metrics = await service.getMetrics();

      expect(metrics.length).toBeGreaterThan(0);
      expect(typeof metrics).toBe('string');
    });

    it('should format metrics correctly', async () => {
      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/format-test',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      const metrics = await service.getMetrics();

      expect(metrics).toMatch(/# HELP http_requests_total/);
      expect(metrics).toMatch(/# TYPE http_requests_total counter/);
    });

    it('should return string', async () => {
      const metrics = await service.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('metric labels', () => {
    it('should support all required label dimensions', async () => {
      const labels = {
        method: 'GET',
        route: '/test',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      };

      service.httpRequestTotal.inc(labels);
      service.httpRequestDuration.observe(labels, 0.1);

      const metrics = await service.getMetrics();

      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/test"');
      expect(metrics).toContain('status_code="200"');
      expect(metrics).toContain('service="api-gateway"');
      expect(metrics).toContain('target_service="auth-service"');
    });

    it('should handle different target services', async () => {
      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/test',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/test',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'suggestion-service',
      });

      const metrics = await service.getMetrics();

      expect(metrics).toContain('target_service="auth-service"');
      expect(metrics).toContain('target_service="suggestion-service"');
    });

    it('should handle special characters in labels', async () => {
      service.httpRequestTotal.inc({
        method: 'GET',
        route: '/test/with/path',
        status_code: '200',
        service: 'api-gateway',
        target_service: 'auth-service',
      });

      const metrics = await service.getMetrics();

      expect(metrics).toContain('route="/test/with/path"');
    });
  });

  describe('performance', () => {
    it('should handle high volume of metrics', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        service.httpRequestTotal.inc({
          method: 'GET',
          route: `/route${i % 10}`,
          status_code: '200',
          service: 'api-gateway',
          target_service: 'auth-service',
        });
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should efficiently record durations', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        service.httpRequestDuration.observe(
          {
            method: 'GET',
            route: '/test',
            status_code: '200',
            service: 'api-gateway',
            target_service: 'auth-service',
          },
          0.1,
        );
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
