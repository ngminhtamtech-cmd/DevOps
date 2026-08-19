import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@t-hotel/shared-types';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';
import { REQUIRED_ROLES_KEY } from './decorators';

/**
 * Chan request neu role cua user khong nam trong danh sach @Roles(...).
 * Guard nay phai chay SAU SupabaseJwtGuard vi no doc request.user.
 * Thu tu dang ky trong app.module quyet dinh thu tu chay.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Endpoint nay yeu cau role: ${requiredRoles.join(' hoac ')}`);
    }
    return true;
  }
}
