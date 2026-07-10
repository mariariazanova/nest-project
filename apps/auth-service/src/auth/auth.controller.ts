import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { AuthService } from './auth.service';
import { SignUpDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cls: ClsService,
  ) {}

  @Post('users')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignUpDto })
  @ApiResponse({
    status: 201,
    description: 'User created. Returns user object and accessToken.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or username already taken.',
  })
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Post('sessions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login and obtain a JWT access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns user object and accessToken.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Delete('sessions')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate the current JWT token' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  async logout(@Request() req) {
    return this.authService.logout(req.user.token);
  }

  @Get('users/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  // RabbitMQ Message Handlers
  @ApiExcludeEndpoint()
  @MessagePattern({ cmd: 'validate_token' })
  async validateToken(
    @Payload() data: { token: string; correlationId?: string },
  ) {
    return this.cls.run(async () => {
      if (data.correlationId) {
        this.cls.set(CORRELATION_ID_KEY, data.correlationId);
      }
      return this.authService.validateToken(data.token);
    });
  }
}
