import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TokenBlacklistService } from './token-blacklist/token-blacklist.service';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let tokenBlacklistService: TokenBlacklistService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    password: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByUsername: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistToken: jest.fn(),
            isTokenBlacklisted: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRATION: '15m',
              };
              return config[key] || defaultValue;
            }),
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

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    tokenBlacklistService = module.get(TokenBlacklistService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    const signUpDto = {
      username: 'newuser',
      password: 'Password123!',
    };

    it('should create a new user successfully', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-access-token');

      const result = await service.signUp(signUpDto);

      expect(usersService.findByUsername).toHaveBeenCalledWith(signUpDto.username);
      expect(bcrypt.hash).toHaveBeenCalledWith(signUpDto.password, 10);
      expect(usersService.create).toHaveBeenCalledWith({
        username: signUpDto.username,
        password: 'hashedPassword',
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          username: mockUser.username,
        },
        accessToken: 'mock-access-token',
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(mockUser);

      await expect(service.signUp(signUpDto)).rejects.toThrow(ConflictException);
      await expect(service.signUp(signUpDto)).rejects.toThrow('Username already exists');
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should hash password with salt rounds of 10', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-token');

      await service.signUp(signUpDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(signUpDto.password, 10);
    });

    it('should generate access token with correct payload', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-token');

      await service.signUp(signUpDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, username: mockUser.username },
        expect.objectContaining({
          secret: 'test-secret',
          expiresIn: '15m',
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      username: 'testuser',
      password: 'Password123!',
    };

    it('should login user successfully with valid credentials', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-access-token');

      const result = await service.login(loginDto);

      expect(usersService.findByUsername).toHaveBeenCalledWith(loginDto.username);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          username: mockUser.username,
        },
        accessToken: 'mock-access-token',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should generate access token on successful login', async () => {
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-token');

      await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, username: mockUser.username },
        expect.objectContaining({
          secret: 'test-secret',
        }),
      );
    });
  });

  describe('logout', () => {
    const mockToken = 'valid.jwt.token';
    const decodedToken = {
      sub: 'user-123',
      username: 'testuser',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    it('should logout user successfully', async () => {
      jest.spyOn(jwtService, 'decode').mockReturnValue(decodedToken);
      jest.spyOn(tokenBlacklistService, 'blacklistToken').mockResolvedValue(undefined);

      const result = await service.logout(mockToken);

      expect(jwtService.decode).toHaveBeenCalledWith(mockToken);
      expect(tokenBlacklistService.blacklistToken).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Logged out successfully',
        statusCode: 200,
      });
    });

    it('should handle already expired token', async () => {
      const expiredToken = {
        ...decodedToken,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(expiredToken);

      const result = await service.logout(mockToken);

      expect(tokenBlacklistService.blacklistToken).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Logged out successfully',
        statusCode: 200,
      });
    });

    it('should throw UnauthorizedException if token format is invalid', async () => {
      jest.spyOn(jwtService, 'decode').mockReturnValue(null);

      await expect(service.logout(mockToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.logout(mockToken)).rejects.toThrow('Invalid token');
    });

    it('should throw UnauthorizedException if decoded token has no exp', async () => {
      jest.spyOn(jwtService, 'decode').mockReturnValue({ sub: 'user-123' });

      await expect(service.logout(mockToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should calculate correct TTL for blacklist', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 7200; // 2 hours
      const tokenWithFutureExp = { ...decodedToken, exp: futureExp };

      jest.spyOn(jwtService, 'decode').mockReturnValue(tokenWithFutureExp);
      jest.spyOn(tokenBlacklistService, 'blacklistToken').mockResolvedValue(undefined);

      await service.logout(mockToken);

      expect(tokenBlacklistService.blacklistToken).toHaveBeenCalledWith(
        mockToken,
        expect.any(Number),
      );

      const actualTTL = (tokenBlacklistService.blacklistToken as jest.Mock).mock.calls[0][1];
      expect(actualTTL).toBeGreaterThan(0);
      expect(actualTTL).toBeLessThanOrEqual(7200);
    });
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(UnauthorizedException);
      await expect(service.getProfile('non-existent-id')).rejects.toThrow('User not found');
    });

    it('should not return password in profile', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('validateToken', () => {
    const mockToken = 'valid.jwt.token';
    const decodedPayload = {
      sub: 'user-123',
      username: 'testuser',
    };

    it('should validate token successfully', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);
      jest.spyOn(jwtService, 'verify').mockReturnValue(decodedPayload);

      const result = await service.validateToken(mockToken);

      expect(tokenBlacklistService.isTokenBlacklisted).toHaveBeenCalledWith(mockToken);
      expect(jwtService.verify).toHaveBeenCalledWith(mockToken, {
        secret: 'test-secret',
      });
      expect(result).toEqual({
        valid: true,
        userId: decodedPayload.sub,
        username: decodedPayload.username,
      });
    });

    it('should return invalid if token is blacklisted', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(true);

      const result = await service.validateToken(mockToken);

      expect(result).toEqual({ valid: false });
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('should return invalid if token verification fails', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateToken(mockToken);

      expect(result).toEqual({ valid: false });
    });

    it('should handle expired tokens', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const result = await service.validateToken(mockToken);

      expect(result).toEqual({ valid: false });
    });

    it('should handle malformed tokens', async () => {
      jest.spyOn(tokenBlacklistService, 'isTokenBlacklisted').mockResolvedValue(false);
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      const result = await service.validateToken('invalid-token');

      expect(result).toEqual({ valid: false });
    });
  });

  describe('generateTokens (private method)', () => {
    it('should generate access token with correct configuration', async () => {
      const signUpDto = {
        username: 'testuser',
        password: 'Password123!',
      };

      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('generated-token');

      await service.signUp(signUpDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, username: mockUser.username },
        {
          secret: 'test-secret',
          expiresIn: '15m',
        },
      );
    });

    it('should use JWT_SECRET from config', async () => {
      const signUpDto = {
        username: 'testuser',
        password: 'Password123!',
      };

      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      await service.signUp(signUpDto);

      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          secret: 'test-secret',
        }),
      );
    });

    it('should use JWT_EXPIRATION from config with default', async () => {
      const signUpDto = {
        username: 'testuser',
        password: 'Password123!',
      };

      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      await service.signUp(signUpDto);

      expect(configService.get).toHaveBeenCalledWith('JWT_EXPIRATION', '15m');
    });
  });

  describe('edge cases', () => {
    it('should handle database errors during signup', async () => {
      const signUpDto = {
        username: 'testuser',
        password: 'Password123!',
      };

      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockRejectedValue(new Error('Database error'));

      await expect(service.signUp(signUpDto)).rejects.toThrow('Database error');
    });

    it('should handle database errors during login', async () => {
      const loginDto = {
        username: 'testuser',
        password: 'Password123!',
      };

      jest.spyOn(usersService, 'findByUsername').mockRejectedValue(new Error('Database error'));

      await expect(service.login(loginDto)).rejects.toThrow('Database error');
    });

    it('should handle bcrypt errors', async () => {
      const signUpDto = {
        username: 'testuser',
        password: 'Password123!',
      };

      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      await expect(service.signUp(signUpDto)).rejects.toThrow('Bcrypt error');
    });
  });
});
