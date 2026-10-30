import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../@decorators/current-user.decorator.js';
import { Public } from '../@decorators/public.decorator.js';
import { LoginDto, RegisterDto, type AuthenticatedUser } from '../contracts.js';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './local-auth.guard.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ type: RegisterDto })
  @ApiOperation({ summary: 'Create an account and issue an access token' })
  @ApiResponse({
    status: 201,
    description:
      'Account created; data contains accessToken, tokenType and user',
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary:
      'Authenticate with email and password using Passport local strategy',
  })
  @ApiResponse({
    status: 200,
    description: 'data contains accessToken, tokenType and user',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() _body: LoginDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auth.login(user);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
