import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
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
import { TsRest, NestControllerInterface } from '@ts-rest/nest';
import { authContract, Status } from '@suggestify/shared/contract';
import { AuthService } from './auth.service';
import { SignUpDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

@TsRest({})
@ApiTags('auth')
@Controller('auth')
// Method names must match the route keys defined in authContract
export class AuthController
  implements NestControllerInterface<typeof authContract>
{
  constructor(
    private readonly authService: AuthService,
    private readonly cls: ClsService,
  ) {}

  @Post('users')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignUpDto })
  @ApiResponse({
    status: Status.Created,
    description: 'User created. Returns user object and accessToken.',
  })
  @ApiResponse({
    status: Status.BadRequest,
    description: 'Validation error or username already taken.',
  })
  async register(@Body() dto: SignUpDto) {
    const result = await this.authService.signUp(dto);

    return { status: Status.Created, body: result };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Login and obtain a JWT access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: Status.Ok,
    description: 'Login successful. Returns user object and accessToken.',
  })
  @ApiResponse({
    status: Status.Unauthorized,
    description: 'Invalid credentials.',
  })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

    return { status: Status.Ok, body: result };
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate the current JWT token' })
  @ApiResponse({ status: Status.Ok, description: 'Logged out.' })
  @ApiResponse({
    status: Status.Unauthorized,
    description: 'Missing or invalid token.',
  })
  async logout(@Request() req) {
    const result = await this.authService.logout(req.user.token);

    return { status: Status.Ok, body: result };
  }

  @Get('users/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: Status.Ok, description: 'User profile.' })
  @ApiResponse({
    status: Status.Unauthorized,
    description: 'Missing or invalid token.',
  })
  async getProfile(@Request() req) {
    const result = await this.authService.getProfile(req.user.userId);

    return { status: Status.Ok, body: result };
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
