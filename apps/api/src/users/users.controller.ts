import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesService } from '../roles/roles.service';
import { DatabaseService } from '../shared/database/Database.service';
import { RedisService } from '../redis/redis.service';
import { FieldEncryptionService } from '../encryption/field-encryption.service';

const SELECTED_ROLE_KEY = (userId: string) => `user_selected_role_${userId}`;
const ROLE_PREFERENCE_TTL = 60 * 60 * 24 * 30; // 30 days

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly db: DatabaseService,
    private readonly redisService: RedisService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  /**
   * GET /users/me — returns user info + roles from users
   */
  @Get('me')
  @Throttle({ short: { limit: 100, ttl: 60000 } })
  async getMe(@Req() req: any) {
    const userId = req.user?.user_id;
    if (!userId) return { error: 'Unauthorized' };

    const users = await this.db.query(
      `SELECT user_id, email, user_name, first_name, last_name
       FROM users WHERE user_id = $1`,
      [userId],
    );
    const rawUser = users?.[0];
    if (!rawUser) return { error: 'User not found' };
    const user = this.fieldEncryption.decryptRow('users', rawUser);
    let rawRoles: any[] = [];
    try {
      rawRoles = await this.db.query(
        `SELECT DISTINCT 
           COALESCE(r.role_id, UPPER(sub.role_id)) AS role_id,
           COALESCE(r.name, sub.role_id) AS role_name
         FROM (
           SELECT u.role_id FROM users u WHERE u.user_id = $1 AND u.role_id IS NOT NULL
           UNION
           SELECT ms.role_id FROM management_staff ms WHERE ms.user_id = $1 AND (ms.is_active::text = '1' OR ms.is_active::text = 'true') AND ms.deleted_at IS NULL
         ) sub
         LEFT JOIN roles r ON UPPER(r.role_id) = UPPER(sub.role_id)
         WHERE sub.role_id IS NOT NULL AND sub.role_id != ''`,
        [userId],
      );
    } catch {
      rawRoles = [];
    }

    // Sort roles by priority in JavaScript
    const rolePriority: Record<string, number> = {
      SUPER_ADMIN: 1,
      ADMIN: 2,
      DELIVERY_PARTNER: 3,
      CUSTOMER: 4,
    };

    const roles = rawRoles.sort((a, b) => {
      const pA = rolePriority[a.role_id] || 99;
      const pB = rolePriority[b.role_id] || 99;
      return pA - pB;
    });

    const selectedRole = await this.redisService.fetch<string>(
      SELECTED_ROLE_KEY(userId),
    );
    const activeRole = selectedRole || roles[0]?.role_id || user.role_id || null;

    let permissions: string[] = [];
    try {
      const allUserRoleKeys = Array.from(
        new Set(
          [
            ...roles.map((r: any) => String(r.role_id || '').toUpperCase()),
            ...roles.map((r: any) => String(r.role_id || '').toLowerCase()),
            ...(activeRole ? [String(activeRole).toUpperCase(), String(activeRole).toLowerCase()] : []),
          ].filter(Boolean),
        ),
      );

      const permRows = await this.db.query(
        `SELECT DISTINCT rp.permission_key
         FROM role_permissions rp
         WHERE UPPER(rp.role_id) = ANY($1) 
            OR LOWER(rp.role_id) = ANY($1)
            OR rp.role_id IN (
              SELECT u.role_id FROM users u WHERE u.user_id = $2 AND u.role_id IS NOT NULL
              UNION
              SELECT ms.role_id FROM management_staff ms WHERE ms.user_id = $2 AND (ms.is_active::text = '1' OR ms.is_active::text = 'true') AND ms.deleted_at IS NULL
            )`,
        [allUserRoleKeys, userId],
      );
      permissions = (permRows || []).map((p: any) => p.permission_key);

      // Fallback: check admin_roles if role_permissions is empty
      if (permissions.length === 0) {
        const adminRoleRows = await this.db.query(
          `SELECT permissions FROM admin_roles 
           WHERE LOWER(role_name) = ANY($1)
              OR UPPER(role_name) = ANY($1)
              OR role_name IN (
                SELECT u.role_id FROM users u WHERE u.user_id = $2 AND u.role_id IS NOT NULL
                UNION
                SELECT ms.role_id FROM management_staff ms WHERE ms.user_id = $2 AND (ms.is_active::text = '1' OR ms.is_active::text = 'true') AND ms.deleted_at IS NULL
              )`,
          [allUserRoleKeys, userId],
        );
        const set = new Set<string>();
        for (const row of adminRoleRows || []) {
          const list = Array.isArray(row.permissions)
            ? row.permissions
            : typeof row.permissions === 'string'
            ? JSON.parse(row.permissions || '[]')
            : [];
          list.forEach((p: string) => set.add(p));
        }
        permissions = Array.from(set);
      }
    } catch {
      permissions = [];
    }

    const isAdmin = roles.some((r: any) =>
      ['ADMIN', 'SUPER_ADMIN'].includes((r.role_id || '').toUpperCase())
    ) || (activeRole && ['ADMIN', 'SUPER_ADMIN'].includes(activeRole.toUpperCase()));

    return {
      user_id: user.user_id,
      email: user.email,
      user_name: user.user_name,
      first_name: user.first_name,
      last_name: user.last_name,
      roles: roles.map((r: any) => ({
        role_id: r.role_id,
        role_name: r.role_name,
      })),
      active_role: activeRole,
      permissions,
      is_admin: isAdmin,
    };
  }

  /**
   * GET /users/navigation — redirects to /users/me for backward compatibility
   */
  @Get('navigation')
  @Throttle({ short: { limit: 100, ttl: 60000 } })
  async getNavigation(@Req() req: any) {
    return this.getMe(req);
  }

  /**
   * Save user's selected role preference
   */
  @Patch('selected-role')
  @Throttle({ short: { limit: 50, ttl: 60000 } })
  async setSelectedRole(@Req() req: any, @Body() body: { role_key: string }) {
    const userId = req.user?.user_id;
    if (!userId) return { success: false, error: 'Unauthorized' };

    const { role_key } = body;
    if (!role_key || typeof role_key !== 'string') {
      return { success: false, error: 'Invalid role_key' };
    }

    const roles = await this.db.query(
      `SELECT u.role_id
         FROM users u
        WHERE u.user_id = $1 AND UPPER(u.role_id) = UPPER($2)
       UNION
       SELECT ms.role_id
         FROM management_staff ms
        WHERE ms.user_id = $1 AND UPPER(ms.role_id) = UPPER($2)`,
      [userId, role_key],
    );

    if (!roles?.length) {
      return { success: false, error: 'Role not assigned to user' };
    }

    await this.redisService.put(
      SELECTED_ROLE_KEY(userId),
      role_key,
      ROLE_PREFERENCE_TTL,
    );
    return { success: true, selected_role: role_key };
  }
}
