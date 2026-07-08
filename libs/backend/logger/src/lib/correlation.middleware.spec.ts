import {
  CorrelationMiddleware,
  CORRELATION_ID_KEY,
  CORRELATION_ID_HEADER,
} from './correlation.middleware';
import { ClsService } from 'nestjs-cls';
import { Request, Response } from 'express';

describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;
  let cls: { set: jest.Mock; run: jest.Mock };
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    cls = {
      set: jest.fn(),
      run: jest.fn((fn: () => unknown) => fn()),
    };
    middleware = new CorrelationMiddleware(cls as unknown as ClsService);
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  it('uses the existing x-correlation-id header when present', () => {
    const req = {
      headers: { [CORRELATION_ID_HEADER]: 'existing-id-123' },
    } as unknown as Request;

    middleware.use(req, res as Response, next);

    expect(cls.set).toHaveBeenCalledWith(CORRELATION_ID_KEY, 'existing-id-123');
    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      'existing-id-123',
    );
  });

  it('generates a UUID v4 when x-correlation-id header is absent', () => {
    const req = { headers: {} } as unknown as Request;

    middleware.use(req, res as Response, next);

    const generated = (cls.set as jest.Mock).mock.calls[0][1] as string;
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('echoes the correlation ID back in the response header', () => {
    const req = {
      headers: { [CORRELATION_ID_HEADER]: 'test-id' },
    } as unknown as Request;

    middleware.use(req, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      'test-id',
    );
  });

  it('stores the correlation ID in CLS', () => {
    const req = {
      headers: { [CORRELATION_ID_HEADER]: 'cls-id' },
    } as unknown as Request;

    middleware.use(req, res as Response, next);

    expect(cls.set).toHaveBeenCalledWith(CORRELATION_ID_KEY, 'cls-id');
  });

  it('calls next()', () => {
    const req = { headers: {} } as unknown as Request;

    middleware.use(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
