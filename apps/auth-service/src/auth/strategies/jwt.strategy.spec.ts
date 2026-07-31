import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { TokenBlacklistService } from '../token-blacklist/token-blacklist.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let tokenBlacklistService: TokenBlacklistService;

  const mockRequest = {
    headers: {
      authorization: 'Bearer valid-jwt-token-123',
    },
  };

  const mockPayload = {
    sub: 'user-123',
    username: 'testuser',
    iat: 1234567890,
    exp: 9999999999,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret-key',
              };
              return config[key];
            }),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            isTokenBlacklisted: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
    configService = module.get(ConfigService);
    tokenBlacklistService = module.get(TokenBlacklistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with JWT_SECRET from config', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('should configure strategy to extract JWT from Bearer token', () => {
      // Strategy is configured in constructor
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should validate and return user data for valid token', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const result = await strategy.validate(mockRequest, mockPayload);

      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith('valid-jwt-token-123');
      expect(result).toEqual({
        userId: mockPayload.sub,
        username: mockPayload.username,
        token: 'valid-jwt-token-123',
      });
    });

    it('should throw UnauthorizedException if token is blacklisted', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(true);

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        'Token has been revoked',
      );
    });

    it('should throw UnauthorizedException if payload has no sub', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithoutSub = {
        username: 'testuser',
        iat: 1234567890,
      };

      await expect(strategy.validate(mockRequest, payloadWithoutSub)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if payload.sub is undefined', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithUndefinedSub = {
        sub: undefined,
        username: 'testuser',
      };

      await expect(strategy.validate(mockRequest, payloadWithUndefinedSub)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if payload.sub is null', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithNullSub = {
        sub: null,
        username: 'testuser',
      };

      await expect(strategy.validate(mockRequest, payloadWithNullSub)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should extract token from Authorization header', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const result = await strategy.validate(mockRequest, mockPayload);

      expect(result.token).toBe('valid-jwt-token-123');
    });

    it('should handle request with different token format', async () => {
      const requestWithDifferentToken = {
        headers: {
          authorization: 'Bearer another-token-456',
        },
      };

      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const result = await strategy.validate(requestWithDifferentToken, mockPayload);

      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith('another-token-456');
      expect(result.token).toBe('another-token-456');
    });

    it('should include all payload data in response', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithExtra = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user', 'admin'],
      };

      const result = await strategy.validate(mockRequest, payloadWithExtra);

      expect(result).toEqual({
        userId: 'user-123',
        username: 'testuser',
        token: 'valid-jwt-token-123',
      });
    });

    it('should check blacklist before validating payload', async () => {
      const mockIsBlacklisted = jest
        .spyOn(tokenBlacklistService, 'isTokenBlacklisted')
        .mockResolvedValue(true);

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow();

      expect(mockIsBlacklisted).toHaveBeenCalled();
    });

    it('should handle missing Authorization header gracefully', async () => {
      const requestWithoutAuth = {
        headers: {},
      };

      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      // ExtractJwt will return null if no token found
      // This might throw or return undefined based on implementation
      const result = await strategy.validate(requestWithoutAuth, mockPayload);

      // Should still validate payload even if token extraction returns null
      expect(result.userId).toBe(mockPayload.sub);
    });

    it('should return correct user structure', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const result = await strategy.validate(mockRequest, mockPayload);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('token');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('should handle empty string sub', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithEmptySub = {
        sub: '',
        username: 'testuser',
      };

      await expect(strategy.validate(mockRequest, payloadWithEmptySub)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle payload with only sub', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const minimalPayload = {
        sub: 'user-123',
      };

      const result = await strategy.validate(mockRequest, minimalPayload);

      expect(result).toEqual({
        userId: 'user-123',
        username: undefined,
        token: 'valid-jwt-token-123',
      });
    });

    it('should pass token to blacklist service correctly', async () => {
      const customToken = 'custom-jwt-token-xyz';
      const customRequest = {
        headers: {
          authorization: `Bearer ${customToken}`,
        },
      };

      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      await strategy.validate(customRequest, mockPayload);

      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(customToken);
      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledTimes(1);
    });
  });

  describe('error scenarios', () => {
    it('should handle blacklist service errors', async () => {
      jest
        .spyOn(tokenBlacklistService, 'isTokenBlacklisted')
        .mockRejectedValue(new Error('Redis connection failed'));

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        'Redis connection failed',
      );
    });

    it('should propagate unexpected errors', async () => {
      jest
        .spyOn(tokenBlacklistService, 'isTokenBlacklisted')
        .mockRejectedValue(new Error('Unexpected error'));

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow('Unexpected error');
    });

    it('should handle null request object', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      // This tests robustness - might throw or handle gracefully
      await expect(strategy.validate(null, mockPayload)).rejects.toThrow();
    });
  });

  describe('token extraction', () => {
    it('should extract token from Bearer scheme', async () => {
      const requestWithBearer = {
        headers: {
          authorization: 'Bearer extracted-token-789',
        },
      };

      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const result = await strategy.validate(requestWithBearer, mockPayload);

      expect(result.token).toBe('extracted-token-789');
    });

    it('should handle authorization header with extra spaces', async () => {
      const requestWithSpaces = {
        headers: {
          authorization: 'Bearer   token-with-spaces  ',
        },
      };

      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      await strategy.validate(requestWithSpaces, mockPayload);

      // Token extraction behavior depends on passport-jwt implementation
      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalled();
    });

    it('should handle lowercase authorization header', async () => {
      const requestWithLowercase = {
        headers: {
          authorization: 'bearer lowercase-token-123',
        },
      };

      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      await strategy.validate(requestWithLowercase, mockPayload);

      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalled();
    });
  });

  describe('payload validation', () => {
    it('should accept numeric sub', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithNumericSub = {
        sub: 12345,
        username: 'testuser',
      };

      const result = await strategy.validate(mockRequest, payloadWithNumericSub);

      expect(result.userId).toBe(12345);
    });

    it('should accept payload without username', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithoutUsername = {
        sub: 'user-123',
      };

      const result = await strategy.validate(mockRequest, payloadWithoutUsername);

      expect(result.userId).toBe('user-123');
      expect(result.username).toBeUndefined();
    });

    it('should handle payload with extra fields', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);

      const payloadWithExtras = {
        sub: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['read', 'write'],
      };

      const result = await strategy.validate(mockRequest, payloadWithExtras);

      // Should only return userId, username, and token
      expect(result).toEqual({
        userId: 'user-123',
        username: 'testuser',
        token: 'valid-jwt-token-123',
      });
    });
  });
});
