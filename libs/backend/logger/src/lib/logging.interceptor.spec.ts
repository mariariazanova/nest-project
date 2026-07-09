import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

jest.mock('nestjs-pino', () => ({
  InjectPinoLogger: () => () => undefined,
  PinoLogger: jest.fn(),
}));

function makeHttpContext(
  overrides: { body?: unknown; statusCode?: number } = {},
) {
  return {
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        method: 'POST',
        url: '/auth/sessions',
        body: overrides.body ?? { username: 'alice', password: 'secret' },
      }),
      getResponse: jest.fn().mockReturnValue({
        statusCode: overrides.statusCode ?? 200,
      }),
    }),
  };
}

function makeRmqContext() {
  return {
    getType: jest.fn().mockReturnValue('rmq'),
    switchToHttp: jest.fn(),
  };
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new LoggingInterceptor(mockLogger as never);
  });

  it('passes through non-HTTP contexts without logging', (done) => {
    const context = makeRmqContext();
    const next = { handle: jest.fn().mockReturnValue(of({ ok: true })) };

    interceptor.intercept(context as never, next).subscribe({
      next: (val) => {
        expect(val).toEqual({ ok: true });
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(context.switchToHttp).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('logs "Request completed" with masked body and response on success', (done) => {
    const context = makeHttpContext();
    const responseData = { data: { id: '1', accessToken: 'tok123' } };
    const next = { handle: jest.fn().mockReturnValue(of(responseData)) };

    interceptor.intercept(context as never, next).subscribe({
      next: () => {
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        const logged = mockLogger.info.mock.calls[0][0];
        expect(logged.msg).toBe('Request completed');
        expect(logged.method).toBe('POST');
        expect(logged.url).toBe('/auth/sessions');
        expect(logged.statusCode).toBe(200);
        expect(logged.duration).toBeGreaterThanOrEqual(0);
        expect(logged.body).toEqual({
          username: 'alice',
          password: '[REDACTED]',
        });
        expect(logged.response).toEqual({
          data: { id: '1', accessToken: '[REDACTED]' },
        });
        done();
      },
    });
  });

  it('logs "Request failed" with error details on thrown exception', (done) => {
    const context = makeHttpContext();
    const error = Object.assign(new Error('Unauthorized'), { status: 401 });
    const next = { handle: jest.fn().mockReturnValue(throwError(() => error)) };

    interceptor.intercept(context as never, next).subscribe({
      error: () => {
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        const logged = mockLogger.error.mock.calls[0][0];
        expect(logged.msg).toBe('Request failed');
        expect(logged.method).toBe('POST');
        expect(logged.url).toBe('/auth/sessions');
        expect(logged.duration).toBeGreaterThanOrEqual(0);
        expect(logged.body).toEqual({
          username: 'alice',
          password: '[REDACTED]',
        });
        expect(logged.error).toEqual({
          message: 'Unauthorized',
          statusCode: 401,
        });
        done();
      },
    });
  });

  it('re-throws the original error after logging', (done) => {
    const context = makeHttpContext();
    const originalError = Object.assign(new Error('Not found'), {
      status: 404,
    });
    const next = {
      handle: jest.fn().mockReturnValue(throwError(() => originalError)),
    };

    interceptor.intercept(context as never, next).subscribe({
      error: (err) => {
        expect(err).toBe(originalError);
        done();
      },
    });
  });

  it('truncates response body larger than 5 KB', (done) => {
    const context = makeHttpContext();
    const largeResponse = { data: 'x'.repeat(6000) };
    const next = { handle: jest.fn().mockReturnValue(of(largeResponse)) };

    interceptor.intercept(context as never, next).subscribe({
      next: () => {
        const logged = mockLogger.info.mock.calls[0][0];
        expect(logged.response).toMatchObject({ _truncated: true });
        expect(logged.response._originalSize).toBeGreaterThan(5120);
        done();
      },
    });
  });

  it('handles undefined body without throwing', (done) => {
    const context = makeHttpContext({ body: undefined });
    const next = { handle: jest.fn().mockReturnValue(of({ ok: true })) };

    interceptor.intercept(context as never, next).subscribe({
      next: () => {
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        done();
      },
      error: done.fail,
    });
  });

  it('handles null response without throwing', (done) => {
    const context = makeHttpContext();
    const next = { handle: jest.fn().mockReturnValue(of(null)) };

    interceptor.intercept(context as never, next).subscribe({
      next: () => {
        const logged = mockLogger.info.mock.calls[0][0];
        expect(logged.response).toBeNull();
        done();
      },
      error: done.fail,
    });
  });
});
