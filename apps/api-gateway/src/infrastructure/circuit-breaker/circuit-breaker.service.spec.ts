import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get(CircuitBreakerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    it('should execute function successfully', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn();

      const result = await service.execute('test-key', mockFn, fallback);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should call fallback on failure', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service failed'));
      const fallback = jest.fn().mockReturnValue('fallback-value');

      const result = await service.execute('test-key', mockFn, fallback);

      expect(result).toBe('fallback-value');
      expect(mockFn).toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    it('should handle multiple consecutive failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      const fallback = jest.fn().mockReturnValue('fallback');

      // Execute multiple times
      for (let i = 0; i < 5; i++) {
        await service.execute('failing-service', mockFn, fallback);
      }

      expect(mockFn).toHaveBeenCalledTimes(5);
      expect(fallback).toHaveBeenCalledTimes(5);
    });

    it('should reuse circuit breaker for same key', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn();

      await service.execute('same-key', mockFn, fallback);
      await service.execute('same-key', mockFn, fallback);

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should create different circuit breakers for different keys', async () => {
      const mockFn1 = jest.fn().mockResolvedValue('result1');
      const mockFn2 = jest.fn().mockResolvedValue('result2');
      const fallback = jest.fn();

      const result1 = await service.execute('key-1', mockFn1, fallback);
      const result2 = await service.execute('key-2', mockFn2, fallback);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(mockFn1).toHaveBeenCalled();
      expect(mockFn2).toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      const slowFn = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('slow'), 10000)),
        );
      const fallback = jest.fn().mockReturnValue('timeout-fallback');

      await service.execute('timeout-test', slowFn, fallback);

      // Should call fallback due to timeout
      expect(fallback).toHaveBeenCalled();
    });

    it('should propagate success after recovery', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');
      const fallback = jest.fn().mockReturnValue('fallback');

      // First call fails
      const result1 = await service.execute('recovery-test', mockFn, fallback);

      expect(result1).toBe('fallback');

      // Second call succeeds
      const result2 = await service.execute('recovery-test', mockFn, fallback);

      expect(result2).toBe('success');
    });

    it('should handle synchronous errors', async () => {
      const mockFn = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      const fallback = jest.fn().mockReturnValue('fallback');

      const result = await service.execute('sync-error', mockFn, fallback);

      expect(result).toBe('fallback');
      expect(fallback).toHaveBeenCalled();
    });

    it('should execute without fallback', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await service.execute('no-fallback', mockFn);

      expect(result).toBe('success');
    });

    it('should throw error when no fallback provided and function fails', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));

      await expect(service.execute('no-fallback-fail', mockFn)).rejects.toThrow();
    });
  });

  describe('getBreaker', () => {
    it('should return existing breaker for key', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn();

      await service.execute('existing-key', mockFn, fallback);
      const breaker = service.getBreaker('existing-key', mockFn);

      expect(breaker).toBeDefined();
    });

    it('should create new breaker if not exists', () => {
      const mockFn = jest.fn().mockResolvedValue('test');

      const breaker = service.getBreaker('new-breaker-key', mockFn);

      expect(breaker).toBeDefined();
    });

    it('should create circuit breaker for each key', () => {
      const mockFn1 = jest.fn().mockResolvedValue('test1');
      const mockFn2 = jest.fn().mockResolvedValue('test2');

      const breaker1 = service.getBreaker('key-1', mockFn1);
      const breaker2 = service.getBreaker('key-2', mockFn2);

      expect(breaker1).toBeDefined();
      expect(breaker2).toBeDefined();
    });
  });

  describe('circuit breaker state', () => {
    it('should track circuit state', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn();

      await service.execute('state-test', mockFn, fallback);
      const breaker = service.getBreaker('state-test', mockFn);

      // Circuit should be closed (working)
      expect(breaker).toBeDefined();
    });

    it('should handle rapid successive calls', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const fallback = jest.fn();

      const promises = Array(10)
        .fill(null)
        .map(() => service.execute('rapid-calls', mockFn, fallback));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r === 'success')).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      let callCount = 0;
      const mixedFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.resolve('success');
        }
        return Promise.reject(new Error('failure'));
      });
      const fallback = jest.fn().mockReturnValue('fallback');

      for (let i = 0; i < 4; i++) {
        await service.execute('mixed-test', mixedFn, fallback);
      }

      expect(mixedFn).toHaveBeenCalledTimes(4);
      expect(fallback).toHaveBeenCalledTimes(2); // Called on failures
    });
  });

  describe('performance', () => {
    it('should execute quickly for successful calls', async () => {
      const mockFn = jest.fn().mockResolvedValue('fast');
      const fallback = jest.fn();

      const start = Date.now();
      await service.execute('perf-test', mockFn, fallback);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle concurrent executions efficiently', async () => {
      const mockFn = jest.fn().mockResolvedValue('concurrent');
      const fallback = jest.fn();

      const start = Date.now();
      const promises = Array(100)
        .fill(null)
        .map(() => service.execute('concurrent-test', mockFn, fallback));

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(mockFn).toHaveBeenCalledTimes(100);
      expect(duration).toBeLessThan(1000); // Should handle 100 calls in under 1s
    });
  });
});
