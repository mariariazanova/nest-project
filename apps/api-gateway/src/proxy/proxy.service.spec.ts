import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ProxyService } from './proxy.service';
import { ConsulService } from '../infrastructure/consul/consul.service';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker/circuit-breaker.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let httpService: HttpService;
  let consulService: ConsulService;
  let circuitBreaker: CircuitBreakerService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cacheManager: any;

  const mockRequest = {
    method: 'GET',
    url: '/auth/profile',
    headers: {
      authorization: 'Bearer token123',
      host: 'localhost:3000',
      'content-length': '100',
    },
    query: { page: '1' },
    body: {},
    user: { userId: 'user123', username: 'testuser' },
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headersSent: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyService,
        {
          provide: HttpService,
          useValue: {
            request: jest.fn(),
          },
        },
        {
          provide: ConsulService,
          useValue: {
            discoverService: jest.fn(),
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ProxyService);
    httpService = module.get(HttpService);
    consulService = module.get(ConsulService);
    circuitBreaker = module.get(CircuitBreakerService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('forward', () => {
    it('should successfully forward request to service', async () => {
      const serviceUrl = 'http://auth-service:3001';
      const targetResponse: AxiosResponse = {
        status: 200,
        data: { message: 'Success' },
        statusText: 'OK',
        headers: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: {} as any,
      };

      cacheManager.get.mockResolvedValue(null);
      (<jest.Mock>consulService.discoverService).mockResolvedValue(serviceUrl);
      (<jest.Mock>circuitBreaker.execute).mockImplementation(async (key, fn) => fn());
      (<jest.Mock>httpService.request).mockReturnValue(of(targetResponse));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.forward(mockRequest as any, mockResponse as any, 'auth-service');

      expect(consulService.discoverService).toHaveBeenCalledWith('auth-service');
      expect(cacheManager.set).toHaveBeenCalledWith('service:auth-service', serviceUrl, 30000);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: { message: 'Success' },
        links: { self: '/auth/profile' },
      });
    });

    it('should use cached service URL', async () => {
      const cachedUrl = 'http://auth-service:3001';
      const targetResponse: AxiosResponse = {
        status: 200,
        data: { data: 'cached' },
        statusText: 'OK',
        headers: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: {} as any,
      };

      cacheManager.get.mockResolvedValue(cachedUrl);
      (<jest.Mock>circuitBreaker.execute).mockImplementation(async (key, fn) => fn());
      (<jest.Mock>httpService.request).mockReturnValue(of(targetResponse));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.forward(mockRequest as any, mockResponse as any, 'auth-service');

      expect(consulService.discoverService).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should throw error when service not available', async () => {
      cacheManager.get.mockResolvedValue(null);
      (<jest.Mock>consulService.discoverService).mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.forward(mockRequest as any, mockResponse as any, 'auth-service');

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('should handle 4xx client errors without breaking circuit', async () => {
      const serviceUrl = 'http://auth-service:3001';
      const error = {
        response: {
          status: 400,
          data: { message: 'Bad Request' },
        },
      };

      cacheManager.get.mockResolvedValue(serviceUrl);
      (<jest.Mock>circuitBreaker.execute).mockImplementation(async (key, fn) => fn());
      (<jest.Mock>httpService.request).mockReturnValue(throwError(() => error));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.forward(mockRequest as any, mockResponse as any, 'auth-service');

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: { message: 'Bad Request' },
        links: { self: '/auth/profile' },
      });
    });

    it('should handle 5xx server errors', async () => {
      const serviceUrl = 'http://auth-service:3001';
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
      };

      cacheManager.get.mockResolvedValue(serviceUrl);
      (<jest.Mock>circuitBreaker.execute).mockImplementation(async (key, fn) => fn());
      (<jest.Mock>httpService.request).mockReturnValue(throwError(() => error));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.forward(mockRequest as any, mockResponse as any, 'auth-service');

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should add user headers when user exists', async () => {
      const serviceUrl = 'http://auth-service:3001';
      const targetResponse: AxiosResponse = {
        status: 200,
        data: { success: true },
        statusText: 'OK',
        headers: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: {} as any,
      };

      cacheManager.get.mockResolvedValue(serviceUrl);
      (<jest.Mock>circuitBreaker.execute).mockImplementation(async (key, fn) => fn());

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedHeaders: any;
      (<jest.Mock>httpService.request).mockImplementation((config) => {
        capturedHeaders = config.headers;
        return of(targetResponse);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.forward(mockRequest as any, mockResponse as any, 'auth-service');

      expect(capturedHeaders['X-User-Id']).toBe('user123');
      expect(capturedHeaders).not.toHaveProperty('host');
      expect(capturedHeaders).not.toHaveProperty('content-length');
    });

    it('should handle circuit breaker fallback', async () => {
      const serviceUrl = 'http://auth-service:3001';

      cacheManager.get.mockResolvedValue(serviceUrl);
      (<jest.Mock>circuitBreaker.execute).mockImplementation(async (key, fn, fallback) =>
        fallback(),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.forward(mockRequest as any, mockResponse as any, 'auth-service');

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe('buildTargetUrl', () => {
    it('should build correct URL with query params', () => {
      const baseUrl = 'http://service:3000';
      const req = { url: '/api/users?page=1&limit=10' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (service as any).buildTargetUrl(baseUrl, req);

      expect(result).toBe('http://service:3000/api/users');
    });
  });

  describe('filterHeaders', () => {
    it('should remove host and content-length headers', () => {
      const headers = {
        authorization: 'Bearer token',
        host: 'localhost',
        'content-length': '100',
        'user-agent': 'test',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered = (service as any).filterHeaders(headers);

      expect(filtered).toHaveProperty('authorization');
      expect(filtered).toHaveProperty('user-agent');
      expect(filtered).not.toHaveProperty('host');
      expect(filtered).not.toHaveProperty('content-length');
    });
  });
});
