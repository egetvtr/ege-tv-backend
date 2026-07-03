import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * @Roles(...) dekoratörü ile işaretlenmiş route'larda kullanıcı rolünü kontrol eder.
 * JwtAuthGuard'dan sonra uygulanmalı (önce token doğrulama, sonra rol kontrolü).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles dekoratörü yoksa, sadece authenticated olmak yeterli
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // SUPER_ADMIN her şeyi yapabilir
    if (user.role === AdminRole.SUPER_ADMIN) return true;

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Bu işlem için ${requiredRoles.join(' veya ')} rolü gereklidir`,
      );
    }
    return true;
  }
}
