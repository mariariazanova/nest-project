import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ConsulService } from './consul.service';
import { CONSUL_OPTIONS } from './consul.options';

describe('ConsulService', () => {
  let service: ConsulService;

  const mockConsulClient = {
    agent: {
      service: {
        register: jest.fn(),
        deregister: jest.fn(),
      },
      check: {
        register: jest.fn(),
      },
    },
    health: {
      service: jest.fn(),
    },
    catalog: {
      service: {
        nodes: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsulService,
        {
          provide: CONSUL_OPTIONS,
          useValue: { serviceName: 'test-service', servicePort: 3000 },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                CONSUL_HOST: 'localhost',
                CONSUL_PORT: '8500',
                SERVICE_HOST: 'test-service',
                PORT: '3000',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ConsulService);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).consul = mockConsulClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerService', () => {
    it('should register service with Consul', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.registerService();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-service',
          address: 'test-service',
          port: 3000,
        }),
      );
    });

    it('should include health check in registration', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.registerService();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          check: expect.objectContaining({
            http: expect.stringContaining('/health'),
          }),
        }),
      );
    });

    it('should handle registration failure', async () => {
      const error = new Error('Consul unavailable');
      mockConsulClient.agent.service.register.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await service.registerService();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to register'),
        expect.anything(),
      );

      loggerSpy.mockRestore();
    });

    it('should use correct service ID format', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.registerService();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/test-service-.+/),
        }),
      );
    });

    it('should set appropriate tags', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.registerService();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['test-service']),
        }),
      );
    });
  });

  describe('deregisterService', () => {
    it('should deregister service from Consul', async () => {
      mockConsulClient.agent.service.deregister.mockResolvedValue(undefined);

      await service.deregisterService();

      expect(mockConsulClient.agent.service.deregister).toHaveBeenCalled();
    });

    it('should handle deregistration failure gracefully', async () => {
      const error = new Error('Deregistration failed');
      mockConsulClient.agent.service.deregister.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await service.deregisterService();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to deregister'),
        expect.anything(),
      );

      loggerSpy.mockRestore();
    });

    it('should use correct service ID for deregistration', async () => {
      mockConsulClient.agent.service.deregister.mockResolvedValue(undefined);

      await service.deregisterService();

      expect(mockConsulClient.agent.service.deregister).toHaveBeenCalledWith(
        expect.stringMatching(/test-service-.+/),
      );
    });
  });

  describe('discoverService', () => {
    it('should discover healthy service instances', async () => {
      const mockServices = [
        {
          Service: {
            Address: 'auth-service',
            Port: 3001,
          },
          Checks: [
            {
              Status: 'passing',
            },
          ],
        },
      ];

      mockConsulClient.health.service.mockResolvedValue(mockServices);

      const result = await service.discoverService('auth-service');

      expect(result).toBe('http://auth-service:3001');
      expect(mockConsulClient.health.service).toHaveBeenCalledWith({
        service: 'auth-service',
        passing: true,
      });
    });

    it('should return null when no healthy instances found', async () => {
      mockConsulClient.health.service.mockResolvedValue([]);

      const result = await service.discoverService('nonexistent-service');

      expect(result).toBeNull();
    });

    it('should handle discovery errors', async () => {
      const error = new Error('Discovery failed');
      mockConsulClient.health.service.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      const result = await service.discoverService('failing-service');

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to discover'),
        expect.anything(),
      );

      loggerSpy.mockRestore();
    });

    it('should select a healthy instance', async () => {
      const mockServices = [
        {
          Service: { Address: 'instance-1', Port: 3001 },
          Checks: [{ Status: 'passing' }],
        },
        {
          Service: { Address: 'instance-2', Port: 3002 },
          Checks: [{ Status: 'passing' }],
        },
      ];

      mockConsulClient.health.service.mockResolvedValue(mockServices);

      const result = await service.discoverService('multi-instance-service');

      expect(result).toMatch(/http:\/\/instance-[12]:300[12]/);
    });

    it('should handle services with different protocols', async () => {
      const mockServices = [
        {
          Service: { Address: 'secure-service', Port: 443 },
          Checks: [{ Status: 'passing' }],
        },
      ];

      mockConsulClient.health.service.mockResolvedValue(mockServices);

      const result = await service.discoverService('secure-service');

      expect(result).toContain('secure-service');
      expect(result).toContain('443');
    });

    it('should call consul for repeated discovery requests', async () => {
      const mockServices = [
        {
          Service: { Address: 'cached-service', Port: 3001 },
          Checks: [{ Status: 'passing' }],
        },
      ];

      mockConsulClient.health.service.mockResolvedValue(mockServices);

      await service.discoverService('cached-service');
      await service.discoverService('cached-service');

      expect(mockConsulClient.health.service).toHaveBeenCalledTimes(2);
    });
  });

  describe('onModuleInit', () => {
    it('should register service on module initialization', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      const error = new Error('Init failed');
      mockConsulClient.agent.service.register.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should deregister service on module destruction', async () => {
      mockConsulClient.agent.service.deregister.mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(mockConsulClient.agent.service.deregister).toHaveBeenCalled();
    });

    it('should handle destruction errors gracefully', async () => {
      const error = new Error('Destroy failed');
      mockConsulClient.agent.service.deregister.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await service.onModuleDestroy();

      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });

  describe('health check configuration', () => {
    it('should set appropriate health check interval', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.registerService();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          check: expect.objectContaining({
            interval: expect.any(String),
          }),
        }),
      );
    });

    it('should set health check timeout', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.registerService();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          check: expect.objectContaining({
            timeout: expect.any(String),
          }),
        }),
      );
    });

    it('should configure deregister critical service after', async () => {
      mockConsulClient.agent.service.register.mockResolvedValue(undefined);

      await service.registerService();

      expect(mockConsulClient.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          check: expect.objectContaining({
            deregistercriticalserviceafter: expect.any(String),
          }),
        }),
      );
    });
  });
});
