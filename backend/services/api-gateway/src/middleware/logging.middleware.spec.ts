import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggingMiddleware } from './logging.middleware';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new LoggingMiddleware();

    mockRequest = {
      method: 'GET',
      originalUrl: '/api/users',
    };

    mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    };

    mockNext = jest.fn();

    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  it('should call next middleware', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should register finish event listener', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should log request details on response finish', () => {
    let finishCallback: (() => void) | undefined;

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Simulate response finish
    finishCallback!();

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('GET /api/users 200'));
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringMatching(/\d+ms$/));
  });

  it('should log different HTTP methods correctly', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    methods.forEach((method) => {
      loggerSpy.mockClear();
      let finishCallback: (() => void) | undefined;

      mockRequest.method = method;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      finishCallback!();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining(method));
    });
  });

  it('should log different status codes correctly', () => {
    const statusCodes = [200, 201, 400, 404, 500];

    statusCodes.forEach((statusCode) => {
      loggerSpy.mockClear();
      let finishCallback: (() => void) | undefined;

      mockResponse.statusCode = statusCode;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      finishCallback!();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining(statusCode.toString()));
    });
  });

  it('should measure request duration accurately', (done) => {
    let finishCallback: (() => void) | undefined;

    (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'finish') {
        finishCallback = callback;
      }
    });

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Wait 100ms before finishing
    setTimeout(() => {
      finishCallback!();

      const logCall = loggerSpy.mock.calls[0][0];
      const durationMatch = logCall.match(/(\d+)ms$/);

      expect(durationMatch).toBeTruthy();

      const duration = parseInt(durationMatch[1], 10);

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(150);

      done();
    }, 100);
  }, 10000);

  it('should handle different URL paths', () => {
    const urls = ['/api/users', '/auth/login', '/suggestion/books?page=1', '/history/recent'];

    urls.forEach((url) => {
      loggerSpy.mockClear();
      let finishCallback: (() => void) | undefined;

      mockRequest.originalUrl = url;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      finishCallback!();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining(url));
    });
  });
});
