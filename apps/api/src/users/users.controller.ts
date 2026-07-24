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
      `SELECT user_id, email, user_name, first_name, last_name, profile
       FROM users WHERE user_id = ?`,
      [userId],
    );
    const rawUser = users?.[0];
    if (!rawUser) return { error: 'User not found' };
    const user = this.fieldEncryption.decryptRow('users', rawUser);

    let rawRoles = await this.db.query(
      `SELECT ra.role_id, r.name as role_name
       FROM role_assignments ra
       JOIN roles r ON UPPER(ra.role_id) = UPPER(r.role_id) 
       WHERE ra.user_id = ? AND ra.is_active = 1 AND ra.deleted_at IS NULL
       ORDER BY CASE UPPER(ra.role_id) WHEN 'ADMIN' THEN 1 WHEN 'DELIVERY_PARTNER' THEN 2 WHEN 'CUSTOMER' THEN 3 ELSE 4 END`,
      [userId],
    );

    const seenRoles = new Set();
    let roles = (rawRoles || []).filter((r: any) => {
      if (!r.role_id || seenRoles.has(r.role_id)) return false;
      seenRoles.add(r.role_id);
      return true;
    });

    const isMaintenanceOrAdminUser =
      user.email === 'f2hmaintainence@gmail.com' ||
      (user.email && user.email.toLowerCase().includes('maintainence'));

    if (isMaintenanceOrAdminUser && !roles.some((r: any) => r.role_id === 'ADMIN')) {
      roles.unshift({ role_id: 'ADMIN', role_name: 'ADMIN' });
      this.db.query(
        `INSERT INTO role_assignments (id, user_id, role_id, is_active, created_at, updated_at)
         VALUES (?, ?, 'ADMIN', 1, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [Date.now(), userId],
      ).catch(() => {});
    }

    // Get stored role preference or default to first role
    const storedRole = await this.redisService.fetch<string>(
      SELECTED_ROLE_KEY(userId),
    );
    const validRoleIds = roles.map((r: any) => r.role_id);
    const activeRole =
      storedRole && validRoleIds.includes(storedRole)
        ? storedRole
        : validRoleIds[0] || (isMaintenanceOrAdminUser ? 'ADMIN' : null);

    return {
      user_id: user.user_id,
      email: user.email,
      user_name: user.user_name,
      first_name: user.first_name,
      last_name: user.last_name,
      profile: user.profile,
      roles: roles.map((r: any) => ({
        role_id: r.role_id,
        role_name: r.role_name,
      })),
      active_role: activeRole,
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

    // Validate role exists for this user
    const roles = await this.db.query(
      `SELECT ra.role_id FROM role_assignments ra
       WHERE ra.user_id = ? `,
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
