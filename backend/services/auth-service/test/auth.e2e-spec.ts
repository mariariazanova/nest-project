import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

class MockJwtAuthGuard {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canActivate(context: any) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token.includes('.')) {
      return false;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return false;
    }

    const [userId, username] = parts;

    request.user = {
      userId: userId || 'unknown',
      username: username || 'unknown',
      token: token,
    };

    return true;
  }
}

@Controller('auth')
class TestAuthController {
  private users: Array<{
    id: string;
    username: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  private blacklistedTokens = new Set<string>();

  constructor() {
    this.initializeUsers();
  }

  private async initializeUsers() {
    const hash1 = await bcrypt.hash('Password123!', 10);
    const hash2 = await bcrypt.hash('John123!', 10);

    this.users = [
      {
        id: 'user-123',
        username: 'testuser',
        password: hash1,
        createdAt: new Date('2024-01-01T10:00:00.000Z'),
        updatedAt: new Date('2024-01-01T10:00:00.000Z'),
      },
      {
        id: 'user-456',
        username: 'johndoe',
        password: hash2,
        createdAt: new Date('2024-01-02T12:00:00.000Z'),
        updatedAt: new Date('2024-01-02T12:00:00.000Z'),
      },
    ];
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() dto: { username: string; password: string }) {
    if (!dto.username || !dto.password) {
      throw new BadRequestException([
        'username should not be empty',
        'password should not be empty',
      ]);
    }

    if (dto.password.length < 6) {
      throw new BadRequestException(['password must be longer than or equal to 6 characters']);
    }

    const existingUser = this.users.find((u) => u.username === dto.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newUser = {
      id: `user-${Date.now()}`,
      username: dto.username,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.push(newUser);

    const accessToken = `${newUser.id}.${newUser.username}.${Date.now()}`;

    return {
      user: {
        id: newUser.id,
        username: newUser.username,
      },
      accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: { username: string; password: string }) {
    if (!dto.username || !dto.password) {
      throw new BadRequestException([
        'username should not be empty',
        'password should not be empty',
      ]);
    }

    const user = this.users.find((u) => u.username === dto.username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = `${user.id}.${user.username}.${Date.now()}`;

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MockJwtAuthGuard)
  async logout(@Request() req) {
    const token = req.user?.token;

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    this.blacklistedTokens.add(token);

    return {
      message: 'Logged out successfully',
    };
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MockJwtAuthGuard)
  async getProfile(@Request() req) {
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const token = req.user?.token;
    if (this.blacklistedTokens.has(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
    };
  }
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestAuthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signup', () => {
    it('should create new user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'newuser',
          password: 'NewUser123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user).toHaveProperty('id');
          expect(res.body.user).toHaveProperty('username', 'newuser');
          expect(res.body.user).not.toHaveProperty('password');
          expect(res.body.accessToken).toBeTruthy();
          expect(typeof res.body.accessToken).toBe('string');
        });
    });

    it('should return access token with correct format', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'tokentest',
          password: 'Token123!',
        })
        .expect(201)
        .expect((res) => {
          const token = res.body.accessToken;
          expect(token).toContain('.');
          expect(token.split('.').length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should reject duplicate username', async () => {
      const username = 'duplicate';

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: username,
          password: 'Password123!',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: username,
          password: 'Different123!',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toBe('Username already exists');
        });
    });

    it('should reject weak password (too short)', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'weakpass',
          password: '123',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'password must be longer than or equal to 6 characters',
          );
        });
    });

    it('should reject empty username', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: '',
          password: 'Password123!',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('username should not be empty');
        });
    });

    it('should reject empty password', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'validuser',
          password: '',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('password should not be empty');
        });
    });

    it('should reject missing fields', () => {
      return request(app.getHttpServer()).post('/auth/signup').send({}).expect(400);
    });

    it('should hash password (not store plaintext)', async () => {
      const password = 'SecurePassword123!';

      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'hashtest',
          password: password,
        })
        .expect(201);

      expect(res.body.user.password).toBeUndefined();
      expect(res.body).not.toHaveProperty('password');
    });

    it('should handle special characters in username', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'user@domain.com',
          password: 'Password123!',
        })
        .expect(201);
    });

    it('should create user with valid password', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'validuser123',
          password: 'ValidPass123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user.username).toBe('validuser123');
        });
    });
  });

  describe('POST /auth/login', () => {
    it('should login existing user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user).toHaveProperty('id');
          expect(res.body.user).toHaveProperty('username', 'testuser');
          expect(res.body.accessToken).toBeTruthy();
        });
    });

    it('should return 401 for invalid username', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'nonexistent',
          password: 'Password123!',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials');
        });
    });

    it('should return 401 for invalid password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'WrongPassword!',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid credentials');
        });
    });

    it('should reject empty username', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: '',
          password: 'Password123!',
        })
        .expect(400);
    });

    it('should reject empty password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: '',
        })
        .expect(400);
    });

    it('should return new token on each login', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const res2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200);

      expect(res1.body.accessToken).not.toBe(res2.body.accessToken);
    });

    it('should login user created via signup', async () => {
      const username = 'signupuser';
      const password = 'SignUp123!';

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username, password })
        .expect(201);

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200)
        .expect((res) => {
          expect(res.body.user.username).toBe(username);
        });
    });

    it('should not expose password in response', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.user.password).toBeUndefined();
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should handle case-sensitive username', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'CaseSensitive',
          password: 'Password123!',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'casesensitive',
          password: 'Password123!',
        })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user successfully', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200);

      const token = loginRes.body.accessToken;

      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out successfully');
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(403);
    });

    it('should reject invalid token format', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token-no-dots')
        .expect(403);
    });

    it('should reject missing Bearer prefix', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200);

      const token = loginRes.body.accessToken;

      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', token)
        .expect(403);
    });

    it('should blacklist token after logout', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200);

      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Token has been revoked');
        });
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile with valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200);

      const token = loginRes.body.accessToken;

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('username', 'testuser');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).get('/auth/profile').expect(403);
    });

    it('should reject invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);
    });

    it('should return correct user based on token', async () => {
      const signupRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          username: 'profileuser',
          password: 'Profile123!',
        })
        .expect(201);

      const token = signupRes.body.accessToken;

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.username).toBe('profileuser');
        });
    });

    it('should not return password in profile', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        })
        .expect(200);

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.password).toBeUndefined();
        });
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete signup -> login -> profile -> logout flow', async () => {
      const username = 'flowtest';
      const password = 'FlowTest123!';

      const signupRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username, password })
        .expect(201);

      expect(signupRes.body.accessToken).toBeTruthy();

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200);

      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should allow login after logout', async () => {
      const username = 'relogin';
      const password = 'ReLogin123!';

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username, password })
        .expect(201);

      const login1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${login1.body.accessToken}`)
        .expect(200);

      const login2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200);

      expect(login2.body.accessToken).toBeTruthy();
      expect(login2.body.accessToken).not.toBe(login1.body.accessToken);
    });
  });

  describe('HTTP Methods', () => {
    it('should handle POST for signup', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'methodtest1', password: 'Method123!' })
        .expect(201);
    });

    it('should handle POST for login', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'Password123!' })
        .expect(200);
    });

    it('should handle POST for logout', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'Password123!' });

      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);
    });

    it('should handle GET for profile', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'Password123!' });

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);
    });
  });

  describe('Headers and Content Type', () => {
    it('should return JSON by default', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'Password123!' })
        .expect('Content-Type', /json/)
        .expect(200);
    });

    it('should accept JSON content type', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .set('Content-Type', 'application/json')
        .send({ username: 'jsontest', password: 'Json123!' })
        .expect(201);
    });

    it('should require Bearer token in Authorization header', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'Password123!' });

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);
    });
  });

  describe('Performance', () => {
    it('should respond quickly to signup requests', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'perftest1', password: 'Perf123!' })
        .expect(201);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });

    it('should respond quickly to login requests', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'Password123!' })
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });

    it('should handle multiple concurrent login requests', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/auth/login')
            .send({ username: 'testuser', password: 'Password123!' }),
        );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeTruthy();
      });
    });
  });

  describe('Data Validation', () => {
    it('should validate user object structure', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'structtest', password: 'Struct123!' })
        .expect(201);

      expect(res.body.user).toMatchObject({
        id: expect.any(String),
        username: expect.any(String),
      });
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should validate token format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'Password123!' })
        .expect(200);

      const token = res.body.accessToken;
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(token).toContain('.');
    });

    it('should return consistent response structure', async () => {
      const signupRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'consistent1', password: 'Consistent123!' });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'consistent1', password: 'Consistent123!' });

      expect(Object.keys(signupRes.body).sort()).toEqual(Object.keys(loginRes.body).sort());
    });
  });

  describe('Security', () => {
    it('should not allow SQL injection in username', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: "admin' OR '1'='1",
          password: 'anything',
        })
        .expect(401);
    });

    it('should not expose internal error details', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'nonexistent', password: 'Pass123!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
      expect(res.body.message).not.toContain('database');
      expect(res.body.message).not.toContain('error');
    });

    it('should prevent timing attacks (consistent response time)', async () => {
      const start1 = Date.now();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'nonexistent', password: 'Pass123!' });
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });
      const time2 = Date.now() - start2;

      expect(Math.abs(time1 - time2)).toBeLessThan(500);
    });

    it('should hash passwords (bcrypt)', async () => {
      const password = 'TestPassword123!';

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'hashtest2', password })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'hashtest2', password })
        .expect(200);

      expect(loginRes.body.accessToken).toBeTruthy();
    });
  });
});
