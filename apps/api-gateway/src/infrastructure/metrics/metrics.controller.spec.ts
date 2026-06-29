import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: {
            getMetrics: jest.fn(),
            httpRequestTotal: {
              inc: jest.fn(),
            },
            httpRequestDuration: {
              observe: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get(MetricsController);
    metricsService = module.get(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return Prometheus metrics', async () => {
      const mockMetrics = `# HELP http_requests_total Total HTTP requests
        # TYPE http_requests_total counter
        http_requests_total{method="GET",route="/health",status_code="200"} 42`;

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result).toBe(mockMetrics);
      expect(metricsService.getMetrics).toHaveBeenCalled();
    });

    it('should return metrics in text format', async () => {
      const mockMetrics = 'metric_name 123\nother_metric 456';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(typeof result).toBe('string');
      expect(result).toContain('metric_name');
    });

    it('should handle empty metrics', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue('');

      const result = await controller.getMetrics();

      expect(result).toBe('');
    });

    it('should handle metrics service errors', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockRejectedValue(new Error('Metrics unavailable'));

      await expect(controller.getMetrics()).rejects.toThrow('Metrics unavailable');
    });

    it('should call metrics service once per request', async () => {
      const mockMetrics = 'test_metric 1';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      await controller.getMetrics();

      expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);
    });

    it('should return fresh metrics on each call', async () => {
      const metrics1 = 'metric_value 1';
      const metrics2 = 'metric_value 2';

      jest
        .spyOn(metricsService, 'getMetrics')
        .mockResolvedValueOnce(metrics1)
        .mockResolvedValueOnce(metrics2);

      const result1 = await controller.getMetrics();
      const result2 = await controller.getMetrics();

      expect(result1).toBe(metrics1);
      expect(result2).toBe(metrics2);
      expect(metricsService.getMetrics).toHaveBeenCalledTimes(2);
    });

    it('should return metrics with proper format', async () => {
      const mockMetrics = `# HELP process_cpu_user_seconds_total Total user CPU time
        # TYPE process_cpu_user_seconds_total counter
        process_cpu_user_seconds_total 0.5
        
        # HELP http_requests_total Total HTTP requests
        # TYPE http_requests_total counter
        http_requests_total 100`;

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result).toContain('# HELP');
      expect(result).toContain('# TYPE');
      expect(result).toContain('counter');
    });

    it('should handle large metrics output', async () => {
      let largeMetrics = '';
      for (let i = 0; i < 1000; i++) {
        largeMetrics += `metric_${i} ${Math.random()}\n`;
      }

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(largeMetrics);

      const result = await controller.getMetrics();

      expect(result.length).toBeGreaterThan(5000);
      expect(typeof result).toBe('string');
    });

    it('should handle concurrent requests', async () => {
      const mockMetrics = 'concurrent_metric 1';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const promises = Array(10)
        .fill(null)
        .map(() => controller.getMetrics());

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r === mockMetrics)).toBe(true);
      expect(metricsService.getMetrics).toHaveBeenCalledTimes(10);
    });
  });

  describe('response handling', () => {
    it('should return string response', async () => {
      const mockMetrics = 'test_response 1';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(typeof result).toBe('string');
    });

    it('should preserve line breaks in metrics', async () => {
      const mockMetrics = 'line1\nline2\nline3';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result).toContain('\n');
      expect(result.split('\n')).toHaveLength(3);
    });

    it('should handle special characters', async () => {
      const mockMetrics = 'metric{label="value with spaces"} 1';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result).toContain('{');
      expect(result).toContain('}');
      expect(result).toContain('=');
    });
  });

  describe('performance', () => {
    it('should respond quickly', async () => {
      const mockMetrics = 'fast_metric 1';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const start = Date.now();
      await controller.getMetrics();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should respond in < 100ms
    });

    it('should handle rapid successive calls', async () => {
      const mockMetrics = 'rapid_metric 1';

      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(mockMetrics);

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        await controller.getMetrics();
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // 100 calls in < 1s
    });
  });

  describe('error scenarios', () => {
    it('should propagate service errors', async () => {
      const error = new Error('Service error');

      jest.spyOn(metricsService, 'getMetrics').mockRejectedValue(error);

      await expect(controller.getMetrics()).rejects.toThrow('Service error');
    });

    it('should handle timeout errors', async () => {
      jest
        .spyOn(metricsService, 'getMetrics')
        .mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
        );

      await expect(controller.getMetrics()).rejects.toThrow('Timeout');
    });

    it('should handle null response', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(null);

      const result = await controller.getMetrics();

      expect(result).toBeNull();
    });

    it('should handle undefined response', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockResolvedValue(undefined);

      const result = await controller.getMetrics();

      expect(result).toBeUndefined();
    });
  });
});
