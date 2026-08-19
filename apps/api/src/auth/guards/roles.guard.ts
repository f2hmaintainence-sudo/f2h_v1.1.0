import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RoleResolverService } from '../role-resolver.service';

/**
 * Enforces `@Roles()`. Registered globally after `JwtAuthGuard`, so by the time it
 * runs `req.user` is populated for every non-public route.
 *
 * The roles are re-read from the database (Redis-cached) instead of taken from the
 * token, so revoking a role takes effect within the cache TTL rather than at token
 * rotation — which, for this system, could be never.
 */
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

    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.user_id;
    if (!userId) {
      throw new ForbiddenException('Insufficient role');
    }

    const roles = await this.roleResolver.resolveRoles(userId);
    // Cache the resolved roles on the request so handlers and later guards
    // (branch scoping, audit) do not resolve them a second time.
    request.user.roles = roles;

    const wanted = required.map((role) => role.toUpperCase());
    if (!roles.some((role) => wanted.includes(role))) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
