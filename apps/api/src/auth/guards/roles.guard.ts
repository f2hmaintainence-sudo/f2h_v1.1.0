// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : roles.guard.ts
// Description : Enforces role and granular RBAC permission-based access control
//
// ============================================================================

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleResolverService } from '../role-resolver.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleResolver: RoleResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length && !requiredPerms?.length) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.user_id || request.user?.id;
    if (!userId) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const roles = await this.roleResolver.resolveRoles(userId);
    request.user.roles = roles;

    // 1. Super Admin and Admin always have full universal access across all modules
    const isSuperOrAdmin = roles.some((role) =>
      ['ADMIN', 'SUPER_ADMIN'].includes((role || '').toUpperCase()),
    );
    if (isSuperOrAdmin) {
      return true;
    }

    // 2. If explicit @RequirePermissions(...) is specified, check against resolved permissions
    if (requiredPerms?.length) {
      const perms = await this.roleResolver.resolvePermissions(userId);
      if (perms.includes('*') || requiredPerms.some((p) => perms.includes(p))) {
        return true;
      }
    }

    // 3. Direct role match (e.g. for CUSTOMER or DELIVERY_PARTNER routes)
    if (requiredRoles?.length) {
      const wanted = requiredRoles.map((role) => role.toUpperCase());
      if (roles.some((role) => wanted.includes(role))) {
        return true;
      }

      // 4. If the route requires ADMIN / SUPER_ADMIN, check granular permissions for staff roles
      const isRequiresAdmin = wanted.includes('ADMIN') || wanted.includes('SUPER_ADMIN');
      if (isRequiresAdmin) {
        const hasAccess = await this.roleResolver.checkRoutePermission(
          userId,
          request.method,
          request.originalUrl || request.url,
          context,
        );
        if (hasAccess) {
          return true;
        }
      }
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
