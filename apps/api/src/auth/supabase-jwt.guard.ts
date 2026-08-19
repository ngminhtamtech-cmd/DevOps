import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JsonWebTokenError, TokenExpiredError, verify } from 'jsonwebtoken';
import { AppEnv, ENV_NAMESPACE } from '../config/env';
import type { AuthenticatedUser, SupabaseJwtPayload } from './auth.types';
import { IS_PUBLIC_KEY } from './decorators';
import { ProfilesRepository } from './profiles.repository';

/**
 * Xac minh access token do Supabase Auth phat hanh.
 *
 * API khong tu dang nhap va khong tu phat hanh token: client goi Supabase Auth,
 * nhan JWT ky bang HS256 voi JWT secret cua project, roi gui kem Authorization.
 * API chi xac minh chu ky va han dung, sau do tra cuu role trong public.profiles.
 */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly jwtSecret: string;
  private readonly expectedIssuer?: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly profiles: ProfilesRepository,
    configService: ConfigService,
  ) {
    const env = configService.getOrThrow<AppEnv>(ENV_NAMESPACE);
    this.jwtSecret = env.SUPABASE_JWT_SECRET;
    this.expectedIssuer = env.SUPABASE_JWT_ISSUER;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Thieu Authorization: Bearer <access_token>');
    }

    const payload = this.verifyToken(token);
    const profile = await this.profiles.findOrCreate(payload.sub, payload.email ?? null);

    request.user = { id: profile.id, email: profile.email, role: profile.role };
    return true;
  }

  private verifyToken(token: string): SupabaseJwtPayload {
    try {
      const payload = verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        // Supabase dat aud = 'authenticated' cho token cua nguoi dung da dang nhap.
        audience: 'authenticated',
        ...(this.expectedIssuer ? { issuer: this.expectedIssuer } : {}),
      }) as SupabaseJwtPayload;

      if (!payload.sub) {
        throw new UnauthorizedException('Token khong co truong sub');
      }
      return payload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Access token da het han');
      }
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Access token khong hop le');
      }
      throw error;
    }
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}
