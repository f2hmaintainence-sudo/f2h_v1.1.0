// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : role-resolver.service.ts
// Description : Resolves user roles and fine-grained RBAC permissions with Redis caching
//
// ============================================================================

import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from 'src/shared/database/Database.service';
import { RedisService } from 'src/shared/redis/redis.service';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';

const ROLE_CACHE_KEY = (userId: string) => `f2h_user_roles_${userId}`;
const PERMS_CACHE_KEY = (userId: string) => `f2h_user_perms_${userId}`;
const ROLE_CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

export interface PermissionCheck {
  permission_key: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

@Injectable()
export class RoleResolverService {
  private readonly logger = new Logger(RoleResolverService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly reflector?: Reflector,
  ) {}

  /**
   * Resolves the roles a user actually holds from the database (Redis-cached).
   */
  async resolveRoles(userId: string): Promise<string[]> {
    if (!userId) return [];

    const cacheKey = ROLE_CACHE_KEY(userId);
    const cached = await this.redis.fetch<string[]>(cacheKey).catch(() => null);
    if (cached) {
      const parsed = typeof cached === 'string' ? this.parse(cached) : cached;
      if (Array.isArray(parsed)) return parsed;
    }

    const roles = await this.loadRolesFromDatabase(userId);

    await this.redis
      .put(cacheKey, JSON.stringify(roles), ROLE_CACHE_TTL_SECONDS)
      .catch(() => undefined);

    return roles;
  }

  /**
   * Resolves the granular permission keys assigned to this user's roles.
   */
  async resolvePermissions(userId: string): Promise<string[]> {
    if (!userId) return [];

    const cacheKey = PERMS_CACHE_KEY(userId);
    const cached = await this.redis.fetch<string[]>(cacheKey).catch(() => null);
    if (cached) {
      const parsed = typeof cached === 'string' ? this.parse(cached) : cached;
      if (Array.isArray(parsed)) return parsed;
    }

    const perms = await this.loadPermissionsFromDatabase(userId);

    await this.redis
      .put(cacheKey, JSON.stringify(perms), ROLE_CACHE_TTL_SECONDS)
      .catch(() => undefined);

    return perms;
  }

  /**
   * Checks whether the user has permission to access the requested route and method.
   */
  async checkRoutePermission(
    userId: string,
    method: string,
    urlPath: string,
    context?: ExecutionContext,
  ): Promise<boolean> {
    if (!userId) return false;

    // 1. If explicit @RequirePermissions(...) metadata exists, check against it
    if (context && this.reflector) {
      const explicitPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (explicitPerms?.length) {
        const userPerms = await this.resolvePermissions(userId);
        return explicitPerms.some((p) => userPerms.includes(p));
      }
    }

    // 2. Resolve user's permissions
    const userPerms = await this.resolvePermissions(userId);
    if (!userPerms || userPerms.length === 0) {
      return false;
    }

    // 3. Match candidate permissions based on path and HTTP method
    const cleanPath = (urlPath || '').split('?')[0].replace(/^\/api\/v\d+/, '');
    const upperMethod = (method || 'GET').toUpperCase();

    const candidates = this.getCandidatePermissionsForRoute(cleanPath, upperMethod);
    if (candidates.length === 0) {
      // If no candidate permissions defined for this admin route, default to checking if user has any admin-panel permissions
      return userPerms.length > 0;
    }

    return candidates.some((cand) => userPerms.includes(cand));
  }

  /**
   * Maps an admin route path + HTTP verb to candidate permission keys.
   */
  private getCandidatePermissionsForRoute(path: string, method: string): string[] {
    const isGet = method === 'GET' || method === 'HEAD';
    const isPost = method === 'POST';
    const isEdit = method === 'PUT' || method === 'PATCH';
    const isDelete = method === 'DELETE';

    // ── Dashboard & Analytics ──
    if (path.startsWith('/admin/dashboard/growth') || path.startsWith('/admin/dashboard/branch-performance')) {
      return ['dashboard.analytics', 'dashboard.view'];
    }
    if (path.startsWith('/admin/dashboard')) {
      return ['dashboard.view', 'dashboard.analytics'];
    }
    if (path.startsWith('/admin/analytics/export') || path.startsWith('/admin/reports/export')) {
      return ['reports.export', 'dashboard.analytics', 'reports.view'];
    }
    if (path.startsWith('/admin/analytics') || path.startsWith('/admin/reports')) {
      return ['dashboard.analytics', 'reports.view', 'dashboard.view'];
    }

    // ── System & Roles ──
    if (path.startsWith('/admin/system/roles')) {
      return ['system.roles', 'staff.roles'];
    }
    if (path.startsWith('/admin/system/admins')) {
      return isGet
        ? ['system.admins', 'staff.view', 'staff.manage', 'system.roles']
        : ['system.admins', 'staff.manage', 'system.roles'];
    }
    if (path.startsWith('/admin/system/notifications') || path.startsWith('/admin/notifications')) {
      return ['system.notifications', 'system.admins'];
    }
    if (path.startsWith('/admin/system/audit')) {
      return ['system.audit', 'system.admins'];
    }
    if (path.startsWith('/admin/system/version')) {
      return ['system.version_control', 'system.admins'];
    }
    if (path.startsWith('/admin/system') || path.startsWith('/admin/profile')) {
      return ['system.roles', 'system.admins', 'staff.view', 'staff.manage', 'dashboard.view'];
    }
    if (path.startsWith('/developer') || path.startsWith('/admin/developer')) {
      return ['developer.api_integrations', 'system.admins'];
    }

    // ── Staff & Branches ──
    if (path.startsWith('/admin/branch/staffs')) {
      if (isGet) return ['staff.view', 'staff.manage', 'staff.roles', 'system.roles'];
      return ['staff.manage', 'staff.roles', 'system.roles'];
    }
    if (path.startsWith('/admin/branch/branches') || path.startsWith('/admin/branch/config')) {
      if (isGet) return ['branches.view', 'branches.manage'];
      return ['branches.manage'];
    }
    if (path.startsWith('/admin/branch/zones') || path.startsWith('/admin/branch/zone-expansion')) {
      return ['branches.zones', 'branches.view', 'branches.manage'];
    }
    if (path.startsWith('/admin/branch/delivery')) {
      return ['delivery.view', 'delivery.assign', 'delivery.logs.view'];
    }
    if (path.startsWith('/admin/branch/customers')) {
      if (isGet) return ['customers.view', 'customers.manage'];
      return ['customers.manage'];
    }
    if (path.startsWith('/admin/branch')) {
      if (isGet) return ['branches.view', 'branches.manage', 'staff.view'];
      return ['branches.manage', 'staff.manage'];
    }

    // ── Vendors & Milk Procurement ──
    if (path.includes('collections/slip') || path.includes('send-slip')) {
      return ['vendors.slips.send', 'vendors.collections.manage', 'vendors.collections.create'];
    }
    if (path.startsWith('/admin/catalog/collections') || path.startsWith('/vendors/collections') || path.startsWith('/admin/collections')) {
      if (isGet) return ['vendors.collections.view', 'vendors.collections.manage', 'vendors.view'];
      if (isPost) return ['vendors.collections.create', 'vendors.collections.manage'];
      return ['vendors.collections.manage'];
    }
    if (path.startsWith('/admin/catalog/vendors') || path.startsWith('/vendors') || path.startsWith('/admin/vendors')) {
      if (isGet) return ['vendors.view', 'vendors.manage', 'vendors.collections.view'];
      return ['vendors.manage'];
    }

    // ── Catalog & Inventory ──
    if (path.startsWith('/admin/promotions') || path.startsWith('/admin/promotions-coupons')) {
      return ['catalog.promotions', 'catalog.manage', 'catalog.view'];
    }
    if (path.startsWith('/admin/catalog/categories') || path.startsWith('/admin/catalog-inventory/categories')) {
      return ['catalog.categories', 'catalog.manage', 'catalog.view'];
    }
    if (path.startsWith('/admin/catalog/pricing') || path.startsWith('/admin/catalog-inventory/pricing')) {
      return ['catalog.pricing', 'catalog.manage', 'catalog.view'];
    }
    if (path.startsWith('/admin/containers') || path.startsWith('/admin/packages') || path.startsWith('/admin/logistics-vendors/package')) {
      return ['packages.containers', 'inventory.view', 'warehouse.view'];
    }
    if (path.startsWith('/admin/warehouse/stock-movements') || path.startsWith('/admin/catalog-inventory/warehouse/stock-movements')) {
      return ['warehouse.stock_movements', 'warehouse.view', 'inventory.manage'];
    }
    if (path.startsWith('/admin/warehouse/dispatch') || path.startsWith('/admin/catalog-inventory/warehouse/dispatch')) {
      return ['warehouse.dispatch', 'warehouse.view'];
    }
    if (path.startsWith('/admin/warehouse') || path.startsWith('/admin/catalog-inventory/warehouse')) {
      return ['warehouse.view', 'warehouse.dispatch', 'warehouse.stock_movements', 'inventory.view'];
    }
    if (path.startsWith('/admin/inventory') || path.startsWith('/admin/catalog-inventory/inventory') || path.startsWith('/admin/production')) {
      if (isGet) return ['inventory.view', 'inventory.manage', 'catalog.view'];
      return ['inventory.manage'];
    }
    if (path.startsWith('/admin/catalog') || path.startsWith('/admin/catalog-inventory')) {
      if (isGet) return ['catalog.view', 'catalog.manage', 'inventory.view'];
      return ['catalog.manage'];
    }

    // ── Orders & Subscriptions ──
    if (path.includes('cancel')) {
      return ['orders.cancel', 'orders.manage'];
    }
    if (path.includes('refund-candidates') || path.includes('refunds')) {
      return ['subscriptions.refunds', 'finance.refunds', 'subscriptions.manage'];
    }
    if (path.startsWith('/admin/customers-orders/subscriptions') || path.startsWith('/admin/subscriptions')) {
      if (isGet) return ['subscriptions.view', 'subscriptions.manage', 'orders.view'];
      return ['subscriptions.manage'];
    }
    if (path.startsWith('/admin/customers-orders/customer-billing')) {
      return ['finance.billing', 'finance.view', 'orders.view'];
    }
    if (path.startsWith('/admin/orders') || path.startsWith('/admin/customers-orders/orders')) {
      if (isGet) return ['orders.view', 'orders.manage'];
      if (isDelete) return ['orders.cancel', 'orders.manage'];
      return ['orders.manage'];
    }

    // ── Customers ──
    if (path.includes('special-prices')) {
      return ['customers.special_prices', 'customers.manage', 'customers.view'];
    }
    if (path.startsWith('/admin/customers')) {
      if (isGet) return ['customers.view', 'customers.manage'];
      return ['customers.manage'];
    }

    // ── Delivery ──
    if (path.startsWith('/admin/delivery/assign') || path.startsWith('/admin/delivery-runs')) {
      return ['delivery.assign', 'delivery.view'];
    }
    if (path.startsWith('/admin/delivery/partners') || path.startsWith('/admin/delivery/partners-manage')) {
      return ['delivery.partners.manage', 'delivery.view'];
    }
    if (path.startsWith('/admin/delivery/logs') || path.startsWith('/admin/branch/delivery-proof')) {
      return ['delivery.logs.view', 'delivery.view'];
    }
    if (path.startsWith('/admin/delivery/leave')) {
      return ['delivery.leave_requests', 'delivery.view'];
    }
    if (path.startsWith('/admin/referrals')) {
      return ['delivery.referrals', 'reports.view'];
    }
    if (path.startsWith('/admin/delivery')) {
      if (isGet) return ['delivery.view', 'delivery.assign'];
      return ['delivery.assign', 'delivery.partners.manage'];
    }

    // ── Finance ──
    if (path.startsWith('/admin/finance/billing')) {
      return ['finance.billing', 'finance.view', 'finance.manage'];
    }
    if (path.startsWith('/admin/finance/wallet')) {
      return ['finance.wallet', 'finance.view', 'finance.manage'];
    }
    if (path.startsWith('/admin/finance/refunds')) {
      return ['finance.refunds', 'finance.manage'];
    }
    if (path.startsWith('/admin/finance/outstandings')) {
      return ['finance.outstandings', 'finance.view'];
    }
    if (path.startsWith('/admin/finance')) {
      if (isGet) return ['finance.view', 'finance.manage', 'finance.billing', 'finance.outstandings'];
      return ['finance.manage', 'finance.billing', 'finance.refunds'];
    }

    return [];
  }

  /**
   * Invalidates Redis cache for a specific user ID.
   */
  async invalidate(userId: string): Promise<void> {
    if (!userId) return;
    await Promise.allSettled([
      this.redis.forget(ROLE_CACHE_KEY(userId)),
      this.redis.forget(PERMS_CACHE_KEY(userId)),
    ]);
  }

  /**
   * Invalidates role and permissions cache across all users when role definitions change.
   */
  async invalidateRolePermissions(roleId?: string): Promise<void> {
    try {
      await Promise.allSettled([
        this.redis.clearPattern('f2h_user_perms_*'),
        this.redis.clearPattern('f2h_user_roles_*'),
      ]);
    } catch {
      // Ignore cache flush errors
    }
  }

  private async loadRolesFromDatabase(userId: string): Promise<string[]> {
    try {
      const rows = await this.db.query<{ role_id: string }>(
        `SELECT UPPER(u.role_id) AS role_id
           FROM users u
          WHERE u.user_id = $1
            AND u.role_id IS NOT NULL
            AND u.deleted_at IS NULL
         UNION
         SELECT UPPER(ms.role_id) AS role_id
           FROM management_staff ms
          WHERE ms.user_id = $1
            AND ms.role_id IS NOT NULL
            AND ms.deleted_at IS NULL`,
        [userId],
      );

      return Array.from(
        new Set(
          (rows ?? [])
            .map((row) => (row.role_id ?? '').trim().toUpperCase())
            .filter(Boolean),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Role resolution failed for user ${userId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private async loadPermissionsFromDatabase(userId: string): Promise<string[]> {
    try {
      const userRoles = await this.loadRolesFromDatabase(userId);
      const allRoleKeys = Array.from(
        new Set([
          ...userRoles.map((r) => r.toUpperCase()),
          ...userRoles.map((r) => r.toLowerCase()),
        ]),
      );

      if (allRoleKeys.length === 0) return [];

      // If user holds super_admin or admin, return full wildcard access
      if (allRoleKeys.some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r.toUpperCase()))) {
        return ['*'];
      }

      // Query from role_permissions table
      const permRows = await this.db.query<{ permission_key: string }>(
        `SELECT DISTINCT rp.permission_key
           FROM role_permissions rp
          WHERE UPPER(rp.role_id) = ANY($1)
             OR LOWER(rp.role_id) = ANY($1)
             OR rp.role_id IN (
               SELECT u.role_id FROM users u WHERE u.user_id = $2 AND u.role_id IS NOT NULL
               UNION
               SELECT ms.role_id FROM management_staff ms WHERE ms.user_id = $2 AND ms.deleted_at IS NULL
             )`,
        [allRoleKeys, userId],
      );

      let perms = (permRows || []).map((r) => r.permission_key).filter(Boolean);

      // Fallback: check admin_roles if role_permissions was empty
      if (perms.length === 0) {
        const adminRoleRows = await this.db.query<{ permissions: any }>(
          `SELECT permissions
             FROM admin_roles
            WHERE LOWER(role_name) = ANY($1)
               OR UPPER(role_name) = ANY($1)
               OR role_name IN (
                 SELECT u.role_id FROM users u WHERE u.user_id = $2 AND u.role_id IS NOT NULL
                 UNION
                 SELECT ms.role_id FROM management_staff ms WHERE ms.user_id = $2 AND ms.deleted_at IS NULL
               )`,
          [allRoleKeys, userId],
        );

        const permSet = new Set<string>();
        for (const row of adminRoleRows || []) {
          const list = Array.isArray(row.permissions)
            ? row.permissions
            : typeof row.permissions === 'string'
            ? JSON.parse(row.permissions || '[]')
            : [];
          list.forEach((p: string) => permSet.add(p));
        }
        perms = Array.from(permSet);
      }

      return perms;
    } catch (error) {
      this.logger.error(
        `Permissions resolution failed for user ${userId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private parse(value: string): string[] | null {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
