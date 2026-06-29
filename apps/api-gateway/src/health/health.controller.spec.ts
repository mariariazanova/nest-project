import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  HealthCheckResult,
  MemoryHealthIndicator,
  HttpHealthIndicator,
} from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: jest.fn(),
            checkRSS: jest.fn(),
          },
        },
        {
          provide: HttpHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
    healthCheckService = module.get(HealthCheckService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          memory: { status: 'up' },
        },
        error: {},
        details: {
          memory: { status: 'up' },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result).toEqual(mockResult);
      expect(result.status).toBe('ok');
    });

    it('should include health check information', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          memory: { status: 'up' as const, heap: '50MB' },
        },
        error: {},
        details: {
          memory: { status: 'up' as const, heap: '50MB' },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result.info).toBeDefined();
      expect(result.info).toHaveProperty('memory');
    });

    it('should return error status when unhealthy', async () => {
      const mockResult: HealthCheckResult = {
        status: 'error',
        info: {},
        error: {
          memory: { status: 'down' as const, message: 'Out of memory' },
        },
        details: {
          memory: { status: 'down' as const, message: 'Out of memory' },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('memory');
    });

    it('should handle check failure gracefully', async () => {
      jest.spyOn(healthCheckService, 'check').mockRejectedValue(new Error('Health check failed'));

      await expect(controller.check()).rejects.toThrow('Health check failed');
    });

    it('should call health check service', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      await controller.check();

      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should include details in response', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up' as const },
        },
        error: {},
        details: {
          database: { status: 'up' as const },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result.details).toBeDefined();
      expect(result.details).toHaveProperty('database');
    });

    it('should handle multiple health indicators', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          memory: { status: 'up' as const },
          database: { status: 'up' as const },
        },
        error: {},
        details: {
          memory: { status: 'up' as const },
          database: { status: 'up' as const },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(Object.keys(result.info || {}).length).toBeGreaterThanOrEqual(1);
    });

    it('should return proper structure', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('info');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('details');
    });

    it('should handle partial failures', async () => {
      const mockResult: HealthCheckResult = {
        status: 'error',
        info: {
          memory: { status: 'up' as const },
        },
        error: {
          database: { status: 'down' as const },
        },
        details: {
          memory: { status: 'up' as const },
          database: { status: 'down' as const },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.info).toHaveProperty('memory');
      expect(result.error).toHaveProperty('database');
    });

    it('should work with async health checks', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          asyncCheck: { status: 'up' as const },
        },
        error: {},
        details: {
          asyncCheck: { status: 'up' as const },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
    });
  });
});
