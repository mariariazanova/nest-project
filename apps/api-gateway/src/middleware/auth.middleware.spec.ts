import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { AuthMiddleware } from './auth.middleware';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let authClient: ClientProxy;

  const mockRequest = {
    headers: {},
    originalUrl: '/api/protected',
    path: '/api/protected',
    method: 'GET',
  } as Request;

  const mockResponse = {} as Response;
  const mockNext: NextFunction = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthMiddleware,
        {
          provide: 'AUTH_SERVICE',
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: ClsService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
            set: jest.fn(),
            run: jest.fn((fn: () => unknown) => fn()),
          },
        },
      ],
    }).compile();

    middleware = module.get(AuthMiddleware);
    authClient = module.get('AUTH_SERVICE');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Public Routes', () => {
    it('should allow access to /auth/login without token', async () => {
      const req = { ...mockRequest, originalUrl: '/v1/auth/sessions' };

      await middleware.use(req as Request, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(authClient.send).not.toHaveBeenCalled();
    });

    it('should allow access to /auth/signup without token', async () => {
      const req = { ...mockRequest, originalUrl: '/v1/auth/users' };

      await middleware.use(req as Request, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(authClient.send).not.toHaveBeenCalled();
    });

    it('should allow access to /health without token', async () => {
      const req = { ...mockRequest, originalUrl: '/v1/health' };

      await middleware.use(req as Request, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access to /metrics without token', async () => {
      const req = { ...mockRequest, originalUrl: '/v1/metrics' };

      await middleware.use(req as Request, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Protected Routes', () => {
    it('should throw UnauthorizedException when no token provided', async () => {
      const req = { ...mockRequest, originalUrl: '/api/protected' };

      await expect(
        middleware.use(req as Request, mockResponse, mockNext),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token format is invalid', async () => {
      const req = {
        ...mockRequest,
        originalUrl: '/api/protected',
        headers: { authorization: 'InvalidFormat token123' },
      };

      await expect(
        middleware.use(req as Request, mockResponse, mockNext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is missing Bearer prefix', async () => {
      const req = {
        ...mockRequest,
        originalUrl: '/api/protected',
        headers: { authorization: 'token123' },
      };

      await expect(
        middleware.use(req as Request, mockResponse, mockNext),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should validate token and attach user to request', async () => {
      const req = {
        ...mockRequest,
        originalUrl: '/api/protected',
        headers: { authorization: 'Bearer valid-token-123' },
      };

      const validationResult = {
        valid: true,
        userId: 'user123',
        username: 'testuser',
      };

      jest
        .spyOn(authClient, 'send')
        .mockReturnValue(
          of(validationResult) as ReturnType<ClientProxy['send']>,
        );

      await middleware.use(req as Request, mockResponse, mockNext);

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: 'validate_token' },
        expect.objectContaining({ token: 'valid-token-123' }),
      );
      expect(req['user']).toEqual({
        userId: 'user123',
        username: 'testuser',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token validation fails', async () => {
      const req = {
        ...mockRequest,
        originalUrl: '/api/protected',
        headers: { authorization: 'Bearer invalid-token' },
      };

      jest
        .spyOn(authClient, 'send')
        .mockReturnValue(
          of({ valid: false }) as ReturnType<ClientProxy['send']>,
        );

      await expect(
        middleware.use(req as Request, mockResponse, mockNext),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when auth service fails', async () => {
      const req = {
        ...mockRequest,
        originalUrl: '/api/protected',
        headers: { authorization: 'Bearer token123' },
      };

      jest
        .spyOn(authClient, 'send')
        .mockReturnValue(
          throwError(() => new Error('Service unavailable')) as ReturnType<
            ClientProxy['send']
          >,
        );

      await expect(
        middleware.use(req as Request, mockResponse, mockNext),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('extractToken', () => {
    it('should extract token from valid Bearer header', () => {
      const req = {
        headers: { authorization: 'Bearer valid-token' },
      } as Request;

      const token = (middleware as any).extractToken(req);

      expect(token).toBe('valid-token');
    });

    it('should return null when no authorization header', () => {
      const req = { headers: {} } as Request;

      const token = (middleware as any).extractToken(req);

      expect(token).toBeNull();
    });

    it('should return null when authorization header has wrong format', () => {
      const req = {
        headers: { authorization: 'Basic credentials' },
      } as Request;

      const token = (middleware as any).extractToken(req);

      expect(token).toBeNull();
    });
  });

  describe('isPublicRoute', () => {
    it('should identify public routes correctly', () => {
      const publicPaths = [
        '/v1/auth/sessions',
        '/v1/auth/users',
        '/v1/health',
        '/v1/metrics',
      ];

      publicPaths.forEach((path) => {
        expect((middleware as any).isPublicRoute(path)).toBe(true);
      });
    });

    it('should identify protected routes correctly', () => {
      const protectedPaths = [
        '/api/users',
        '/suggestion/books',
        '/history/recent',
        '/auth/profile',
      ];

      protectedPaths.forEach((path) => {
        expect((middleware as any).isPublicRoute(path)).toBe(false);
      });
    });
  });
});
