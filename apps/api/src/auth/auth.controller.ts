import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators';

@Controller('auth')
export class AuthController {
  /** Cho client kiem tra token con hieu luc va biet role hien tai. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
