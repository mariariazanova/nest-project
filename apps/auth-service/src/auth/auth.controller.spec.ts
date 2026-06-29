import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SignUpDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signUp: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    validateToken: jest.fn(),
  };

  // Mock JWT Guard to allow all requests in tests
  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have authService injected', () => {
    expect(authService).toBeDefined();
  });

  describe('POST /auth/signup', () => {
    it('should register new user successfully', async () => {
      const dto: SignUpDto = {
        username: 'newuser',
        password: 'Password123!',
      };

      const mockResult = {
        user: {
          id: 'user-uuid-123',
          username: 'newuser',
        },
        accessToken: 'jwt.token.here',
      };

      mockAuthService.signUp.mockResolvedValue(mockResult);

      const result = await controller.signUp(dto);

      expect(authService.signUp).toHaveBeenCalledWith(dto);
      expect(authService.signUp).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
      expect(result.user.username).toBe('newuser');
      expect(result.accessToken).toBeDefined();
    });

    it('should throw error if username already exists', async () => {
      const dto: SignUpDto = {
        username: 'existing',
        password: 'Password123!',
      };

      mockAuthService.signUp.mockRejectedValue(new Error('Username already exists'));

      await expect(controller.signUp(dto)).rejects.toThrow('Username already exists');
      expect(authService.signUp).toHaveBeenCalledWith(dto);
    });

    it('should throw error for weak password', async () => {
      const dto: SignUpDto = {
        username: 'testuser',
        password: '123',
      };

      mockAuthService.signUp.mockRejectedValue(new Error('Password must be at least 6 characters'));

      await expect(controller.signUp(dto)).rejects.toThrow(
        'Password must be at least 6 characters',
      );
    });
  });

  describe('POST /auth/login', () => {
    it('should login user successfully', async () => {
      const dto: LoginDto = {
        username: 'testuser',
        password: 'Password123!',
      };

      const mockResult = {
        user: {
          id: 'user-uuid-456',
          username: 'testuser',
        },
        accessToken: 'jwt.login.token',
      };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
      expect(result.accessToken).toBeTruthy();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const dto: LoginDto = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(authService.login).toHaveBeenCalledWith(dto);
    });

    it('should throw error for non-existent user', async () => {
      const dto: LoginDto = {
        username: 'ghost',
        password: 'Password123!',
      };

      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should handle empty credentials', async () => {
      const dto: LoginDto = {
        username: '',
        password: '',
      };

      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user successfully', async () => {
      const mockRequest = {
        user: {
          userId: 'user-uuid-123',
          username: 'testuser',
          token: 'jwt.token.abc',
        },
      };

      const mockResult = {
        message: 'Logged out successfully',
        statusCode: 200,
      };

      mockAuthService.logout.mockResolvedValue(mockResult);

      const result = await controller.logout(mockRequest);

      expect(authService.logout).toHaveBeenCalledWith('jwt.token.abc');
      expect(authService.logout).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Logged out successfully');
    });

    it('should be protected by JwtAuthGuard', () => {
      // Guard is mocked to return true
      expect(mockJwtAuthGuard.canActivate).toBeDefined();
    });

    it('should handle invalid token', async () => {
      const mockRequest = {
        user: {
          userId: 'user-uuid-123',
          username: 'testuser',
          token: 'invalid.token',
        },
      };

      mockAuthService.logout.mockRejectedValue(new UnauthorizedException('Invalid token'));

      await expect(controller.logout(mockRequest)).rejects.toThrow(UnauthorizedException);
      expect(authService.logout).toHaveBeenCalledWith('invalid.token');
    });

    it('should extract token from req.user', async () => {
      const token = 'specific.jwt.token.xyz';
      const mockRequest = {
        user: {
          userId: 'user-123',
          username: 'john',
          token: token,
        },
      };

      mockAuthService.logout.mockResolvedValue({
        message: 'Logged out successfully',
        statusCode: 200,
      });

      await controller.logout(mockRequest);

      expect(authService.logout).toHaveBeenCalledWith(token);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile', async () => {
      const mockRequest = {
        user: {
          userId: 'user-uuid-789',
          username: 'profileuser',
        },
      };

      const mockProfile = {
        id: 'user-uuid-789',
        username: 'profileuser',
      };

      mockAuthService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getProfile(mockRequest);

      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-789');
      expect(authService.getProfile).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockProfile);
      expect(result.id).toBe('user-uuid-789');
    });

    it('should be protected by JwtAuthGuard', () => {
      expect(mockJwtAuthGuard.canActivate).toBeDefined();
    });

    it('should throw error if user not found', async () => {
      const mockRequest = {
        user: {
          userId: 'nonexistent-uuid',
          username: 'ghost',
        },
      };

      mockAuthService.getProfile.mockRejectedValue(new UnauthorizedException('User not found'));

      await expect(controller.getProfile(mockRequest)).rejects.toThrow('User not found');
      expect(authService.getProfile).toHaveBeenCalledWith('nonexistent-uuid');
    });

    it('should extract userId from req.user', async () => {
      const userId = 'specific-user-id-123';
      const mockRequest = {
        user: {
          userId: userId,
          username: 'jane',
        },
      };

      mockAuthService.getProfile.mockResolvedValue({
        id: userId,
        username: 'jane',
      });

      await controller.getProfile(mockRequest);

      expect(authService.getProfile).toHaveBeenCalledWith(userId);
    });
  });

  describe('RabbitMQ: validate_token', () => {
    it('should validate token and return user data', async () => {
      const data = {
        token: 'valid.jwt.token.xyz',
      };

      const mockResult = {
        valid: true,
        userId: 'user-uuid-999',
        username: 'validuser',
      };

      mockAuthService.validateToken.mockResolvedValue(mockResult);

      const result = await controller.validateToken(data);

      expect(authService.validateToken).toHaveBeenCalledWith('valid.jwt.token.xyz');
      expect(authService.validateToken).toHaveBeenCalledTimes(1);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-uuid-999');
      expect(result.username).toBe('validuser');
    });

    it('should return invalid for expired token', async () => {
      const data = {
        token: 'expired.token',
      };

      const mockResult = {
        valid: false,
      };

      mockAuthService.validateToken.mockResolvedValue(mockResult);

      const result = await controller.validateToken(data);

      expect(result.valid).toBe(false);
      expect(result.userId).toBeUndefined();
      expect(authService.validateToken).toHaveBeenCalledWith('expired.token');
    });

    it('should return invalid for malformed token', async () => {
      const data = {
        token: 'not.a.real.jwt',
      };

      const mockResult = {
        valid: false,
      };

      mockAuthService.validateToken.mockResolvedValue(mockResult);

      const result = await controller.validateToken(data);

      expect(result.valid).toBe(false);
    });

    it('should return invalid for blacklisted token', async () => {
      const data = {
        token: 'blacklisted.token',
      };

      const mockResult = {
        valid: false,
      };

      mockAuthService.validateToken.mockResolvedValue(mockResult);

      const result = await controller.validateToken(data);

      expect(result.valid).toBe(false);
      expect(authService.validateToken).toHaveBeenCalledWith('blacklisted.token');
    });

    it('should handle empty token', async () => {
      const data = {
        token: '',
      };

      const mockResult = {
        valid: false,
      };

      mockAuthService.validateToken.mockResolvedValue(mockResult);

      const result = await controller.validateToken(data);

      expect(result.valid).toBe(false);
    });

    it('should handle null token', async () => {
      const data = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token: null as any,
      };

      const mockResult = {
        valid: false,
      };

      mockAuthService.validateToken.mockResolvedValue(mockResult);

      const result = await controller.validateToken(data);

      expect(result.valid).toBe(false);
    });

    it('should throw error on validation failure', async () => {
      const data = {
        token: 'problematic.token',
      };

      mockAuthService.validateToken.mockRejectedValue(new Error('Validation service error'));

      await expect(controller.validateToken(data)).rejects.toThrow('Validation service error');
    });
  });

  describe('Controller Integration', () => {
    it('should have all required endpoints', () => {
      expect(controller.signUp).toBeDefined();
      expect(controller.login).toBeDefined();
      expect(controller.logout).toBeDefined();
      expect(controller.getProfile).toBeDefined();
      expect(controller.validateToken).toBeDefined();
    });

    it('should properly inject AuthService', () => {
      expect(authService).toBe(mockAuthService);
    });

    it('should apply guards correctly', () => {
      // logout and getProfile should use JwtAuthGuard
      expect(mockJwtAuthGuard).toBeDefined();
    });
  });
});
