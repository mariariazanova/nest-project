import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignUpDto, LoginDto } from './dto';
import { TokenBlacklistService } from './token-blacklist/token-blacklist.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signUp(dto: SignUpDto): Promise<{ user: any; accessToken: string }> {
    this.logger.log(`Sign up attempt for username: ${dto.username}`);

    const existingUser = await this.usersService.findByUsername(dto.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      username: dto.username,
      password: hashedPassword,
    });

    const tokens = await this.generateTokens(user.id, user.username);

    this.logger.log(`User registered successfully: ${user.username}`);

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      ...tokens,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async login(dto: LoginDto): Promise<{ user: any; accessToken: string }> {
    this.logger.log(`Login attempt for username: ${dto.username}`);

    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.username);

    this.logger.log(`User logged in successfully: ${user.username}`);

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      ...tokens,
    };
  }

  async logout(token: string): Promise<{ message: string; statusCode: number }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decoded = this.jwtService.decode(token) as any;

      if (!decoded || !decoded.exp) {
        throw new UnauthorizedException('Invalid token format');
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - currentTime;

      if (expiresIn <= 0) {
        this.logger.debug('Token already expired, skipping blacklist');
        return {
          message: 'Logged out successfully',
          statusCode: 200,
        };
      }

      await this.tokenBlacklistService.blacklistToken(token, expiresIn);

      this.logger.log(`User logged out: ${decoded.username}`);

      return {
        message: 'Logged out successfully',
        statusCode: 200,
      };
    } catch (error) {
      this.logger.error(`Logout error: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getProfile(userId: string): Promise<{ id: string; username: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
    };
  }

  async validateToken(
    token: string,
  ): Promise<{ valid: boolean; userId?: string; username?: string }> {
    try {
      const isBlacklisted = await this.tokenBlacklistService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return { valid: false };
      }

      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      return {
        valid: true,
        userId: decoded.sub,
        username: decoded.username,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  private async generateTokens(userId: string, username: string): Promise<{ accessToken: string }> {
    const payload = { sub: userId, username };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
    });

    return { accessToken };
  }
}
