import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Canonical role identifiers. These mirror `roles.role_id` in the database and the
 * `X-Role` header the three clients send at login.
 */
export const ROLE = {
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  CUSTOMER: 'CUSTOMER',
} as const;

export type RoleId = (typeof ROLE)[keyof typeof ROLE] | string;

/**
 * Restricts a controller or handler to the listed roles. Without it a route is
 * reachable by any authenticated user, so `RolesGuard` refuses to boot when a
 * panel controller is missing one (see `assertPanelRoutesAreRoleGuarded`).
 */
export const Roles = (...roles: RoleId[]) => SetMetadata(ROLES_KEY, roles);
