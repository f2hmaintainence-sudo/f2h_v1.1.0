import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * These cover the guard that closes F-03: before it existed, a customer's token
 * opened every admin route in the API.
 */
describe('RolesGuard', () => {
  const contextFor = (request: any): ExecutionContext =>
    ({
      getType: () => 'http',
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const reflectorReturning = (metadata: Record<string, unknown>) =>
    ({
      getAllAndOverride: (key: string) => metadata[key],
    }) as unknown as Reflector;

  const resolverReturning = (roles: string[]) =>
    ({ resolveRoles: jest.fn().mockResolvedValue(roles) }) as any;

  it('denies a customer token on a route that requires ADMIN', async () => {
    const guard = new RolesGuard(
      reflectorReturning({ [ROLES_KEY]: ['ADMIN'] }),
      resolverReturning(['CUSTOMER']),
    );

    await expect(
      guard.canActivate(contextFor({ user: { user_id: 'CUST1' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a token whose database roles include one of the required roles', async () => {
    const guard = new RolesGuard(
      reflectorReturning({ [ROLES_KEY]: ['ADMIN', 'SUPER_ADMIN'] }),
      resolverReturning(['CUSTOMER', 'ADMIN']),
    );

    await expect(
      guard.canActivate(contextFor({ user: { user_id: 'ADMIN1' } })),
    ).resolves.toBe(true);
  });

  it('ignores the role claim on the token and uses the database', async () => {
    // A token minted before a role was revoked must stop working.
    const guard = new RolesGuard(
      reflectorReturning({ [ROLES_KEY]: ['ADMIN'] }),
      resolverReturning([]),
    );

    await expect(
      guard.canActivate(contextFor({ user: { user_id: 'EX_ADMIN', role: 'ADMIN' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies when the route requires a role but no user is attached', async () => {
    const guard = new RolesGuard(
      reflectorReturning({ [ROLES_KEY]: ['ADMIN'] }),
      resolverReturning(['ADMIN']),
    );

    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets @Public routes through without resolving roles', async () => {
    const resolver = resolverReturning([]);
    const guard = new RolesGuard(
      reflectorReturning({ [IS_PUBLIC_KEY]: true, [ROLES_KEY]: ['ADMIN'] }),
      resolver,
    );

    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
    expect(resolver.resolveRoles).not.toHaveBeenCalled();
  });

  it('allows routes that declare no roles, leaving authentication as the only gate', async () => {
    const guard = new RolesGuard(reflectorReturning({}), resolverReturning([]));

    await expect(
      guard.canActivate(contextFor({ user: { user_id: 'CUST1' } })),
    ).resolves.toBe(true);
  });

  it('exposes the resolved roles on the request for downstream handlers', async () => {
    const request: any = { user: { user_id: 'ADMIN1' } };
    const guard = new RolesGuard(
      reflectorReturning({ [ROLES_KEY]: ['ADMIN'] }),
      resolverReturning(['ADMIN']),
    );

    await guard.canActivate(contextFor(request));
    expect(request.user.roles).toEqual(['ADMIN']);
  });
});
