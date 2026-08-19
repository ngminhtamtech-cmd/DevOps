import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@t-hotel/shared-types';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const REQUIRED_ROLES_KEY = 'auth:requiredRoles';

/** Danh dau endpoint khong can dang nhap. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Gioi han endpoint cho cac role chi dinh. Dung kem SupabaseJwtGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

/** Lay nguoi dung da xac thuc tu request: `@CurrentUser() user: AuthenticatedUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new Error('CurrentUser duoc dung tren route chua qua SupabaseJwtGuard');
    }
    return request.user;
  },
);
