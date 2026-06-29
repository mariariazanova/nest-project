import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, Delete } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { SignUpDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('users')
  async signUp(@Body() dto: SignUpDto) {
    console.log('change');
    return this.authService.signUp(dto);
  }

  @Post('sessions')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Delete('sessions')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    return this.authService.logout(req.user.token);
  }

  @Get('users/me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  // RabbitMQ Message Handlers
  @MessagePattern({ cmd: 'validate_token' })
  async validateToken(@Payload() data: { token: string }) {
    return this.authService.validateToken(data.token);
  }
}
