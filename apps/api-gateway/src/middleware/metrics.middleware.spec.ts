import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from '../infrastructure/metrics/metrics.service';

describe('MetricsMiddleware', () => {
  let middleware: MetricsMiddleware;
  let metricsService: MetricsService;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsMiddleware,
        {
          provide: MetricsService,
          useValue: {
            httpRequestDuration: {
              observe: jest.fn(),
            },
            httpRequestTotal: {
              inc: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    middleware = module.get(MetricsMiddleware);
    metricsService = module.get(MetricsService);

    mockNext = jest.fn();

    process.env.SERVICE_HOST = 'api-gateway';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.SERVICE_HOST;
  });

  const createMockRequest = (path: string, method = 'GET'): Partial<Request> => ({
    method,
    path,
    route: { path },
  });

  const createMockResponse = (statusCode = 200): Partial<Response> => ({
    statusCode,
    on: jest.fn(),
  });

  it('should call next middleware', () => {
    const mockRequest = createMockRequest('/auth/profile');
    const mockResponse = createMockResponse();

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should register finish event listener', () => {
    const mockRequest = createMockRequest('/auth/profile');
    const mockResponse = createMockResponse();

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should record metrics on response finish', () => {
    let finishCallback: (() => void) | undefined;
    const mockRequest = createMockRequest('/auth/profile');
    const mockResponse = createMockResponse();

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    finishCallback!();

    expect(metricsService.httpRequestDuration.observe).toHaveBeenCalled();
    expect(metricsService.httpRequestTotal.inc).toHaveBeenCalled();
  });

  it('should include correct labels in metrics', () => {
    let finishCallback: (() => void) | undefined;
    const mockRequest = createMockRequest('/auth/profile', 'GET');
    const mockResponse = createMockResponse(200);

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    finishCallback!();

    const expectedLabels = {
      method: 'GET',
      route: '/auth/profile',
      status_code: '200',
      service: 'api-gateway',
      target_service: 'auth-service',
    };

    expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
      expectedLabels,
      expect.any(Number),
    );
    expect(metricsService.httpRequestTotal.inc).toHaveBeenCalledWith(expectedLabels);
  });

  it('should identify target service from path', () => {
    const testCases = [
      { path: '/auth/login', expectedTarget: 'auth-service' },
      { path: '/suggestion/books', expectedTarget: 'suggestion-service' },
      { path: '/history/recent', expectedTarget: 'history-service' },
      { path: '/unknown', expectedTarget: 'unknown' },
    ];

    testCases.forEach(({ path, expectedTarget }) => {
      jest.clearAllMocks();
      let finishCallback: (() => void) | undefined;

      const mockRequest = createMockRequest(path);
      const mockResponse = createMockResponse();

      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      finishCallback!();

      expect(metricsService.httpRequestTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          target_service: expectedTarget,
        }),
      );
    });
  });

  it('should record duration in seconds', (done) => {
    let finishCallback: (() => void) | undefined;
    const mockRequest = createMockRequest('/auth/profile');
    const mockResponse = createMockResponse();

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    setTimeout(() => {
      finishCallback!();

      const observeCall = (metricsService.httpRequestDuration.observe as jest.Mock).mock.calls[0];
      const duration = observeCall[1];

      expect(duration).toBeGreaterThanOrEqual(0.05); // At least 50ms in seconds
      expect(duration).toBeLessThan(0.15); // Less than 150ms in seconds

      done();
    }, 50);
  });

  it('should handle missing route path gracefully', () => {
    let finishCallback: (() => void) | undefined;
    const mockRequest = {
      method: 'GET',
      path: '/some/path',
      route: undefined,
    } as Partial<Request>;
    const mockResponse = createMockResponse();

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    finishCallback!();

    expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/some/path',
      }),
      expect.any(Number),
    );
  });

  it('should use unknown when path is missing', () => {
    let finishCallback: (() => void) | undefined;
    const mockRequest = {
      method: 'GET',
      path: undefined,
      route: undefined,
    } as Partial<Request>;
    const mockResponse = createMockResponse();

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    finishCallback!();

    expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'unknown',
      }),
      expect.any(Number),
    );
  });

  it('should use default service name when SERVICE_HOST not set', () => {
    delete process.env.SERVICE_HOST;
    let finishCallback: (() => void) | undefined;
    const mockRequest = createMockRequest('/auth/profile');
    const mockResponse = createMockResponse();

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    finishCallback!();

    expect(metricsService.httpRequestTotal.inc).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'unknown-service',
      }),
    );
  });

  it('should handle different HTTP status codes', () => {
    const statusCodes = [200, 201, 400, 404, 500, 503];

    statusCodes.forEach((statusCode) => {
      jest.clearAllMocks();
      let finishCallback: (() => void) | undefined;
      const mockRequest = createMockRequest('/auth/profile');
      const mockResponse = createMockResponse(statusCode);

      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      finishCallback!();

      expect(metricsService.httpRequestTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: statusCode.toString(),
        }),
      );
    });
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    methods.forEach((method) => {
      jest.clearAllMocks();
      let finishCallback: (() => void) | undefined;
      const mockRequest = createMockRequest('/auth/profile', method);
      const mockResponse = createMockResponse();

      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      finishCallback!();

      expect(metricsService.httpRequestTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          method,
        }),
      );
    });
  });
});
