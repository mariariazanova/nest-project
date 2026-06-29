import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';

describe('JwtAuthGuard - Integration', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret-key-for-testing-only',
          signOptions: { expiresIn: '1h' },
        }),
        await ConfigModule.forRoot(),
      ],
      providers: [
        JwtAuthGuard,
        JwtStrategy,
        TokenBlacklistService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret-key-for-testing-only';
              return null;
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('with real JWT tokens', () => {
    it('should validate and allow valid JWT token', async () => {
      const payload = { sub: 'user-123', username: 'testuser' };
      const token = jwtService.sign(payload);

      const mockExecutionContext = createMockExecutionContext({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      mockCacheManager.get.mockResolvedValue(null); // Token not blacklisted

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should reject expired JWT token', async () => {
      // Create token that expires immediately
      const payload = { sub: 'user-123', username: 'testuser' };
      const expiredToken = jwtService.sign(payload, { expiresIn: '0s' });

      const mockExecutionContext = createMockExecutionContext({
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();
    });

    it('should reject blacklisted token', async () => {
      const payload = { sub: 'user-123', username: 'testuser' };
      const token = jwtService.sign(payload);

      const mockExecutionContext = createMockExecutionContext({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Mock token as blacklisted
      mockCacheManager.get.mockResolvedValue({ revokedAt: new Date() });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject malformed JWT token', async () => {
      const mockExecutionContext = createMockExecutionContext({
        headers: {
          authorization: 'Bearer malformed.token.here',
        },
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();
    });
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockExecutionContext(requestData: any): ExecutionContext {
  const mockRequest = {
    headers: requestData.headers || {},
    user: requestData.user || null,
  };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn().mockReturnValue('http'),
  } as unknown as ExecutionContext;
}
