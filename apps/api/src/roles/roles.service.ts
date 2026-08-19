import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../shared/database/Database.service';

export interface UserRole {
  id: number;
  role_id: string; // Like 'ADMIN', 'USER', etc.
  name: string;
  description: string;
  sno: string;
  is_system_role: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
}

export interface UserWithRoles {
  user_id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
  roles: UserRole[];
  is_admin: boolean; // Helper: true if has admin role
}


@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Fetch user with roles - JOIN users and roles tables
   * Returns user data + array of role objects
   * users.role_id → roles.role_id (foreign key)
   * Check roles.role_id = 'ADMIN' to determine admin status
   */
  async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    try {
      const userResult = await this.db.query(
        `SELECT user_id, first_name, last_name, user_name, email, created_at, updated_at
           FROM users
          WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId],
      );

      const user = userResult?.[0];
      if (!user) {
        this.logger.warn(`User ${userId} not found`);
        return null;
      }

      // Roles come from two places: explicit grants in `role_assignments` (staff) and
      // the account's own `users.role_id` (every customer). Reading only one of them
      // misses whole categories of user.
      const roles = await this.db.query<UserRole>(
        `SELECT DISTINCT r.role_id, r.name, r.description, r.is_system_role, r.is_active
           FROM roles r
          WHERE r.is_active = 1
            AND (
              r.role_id IN (
                SELECT ra.role_id FROM role_assignments ra
                 WHERE ra.user_id = $1 AND ra.is_active = 1 AND ra.deleted_at IS NULL
              )
              OR r.role_id = (SELECT u.role_id FROM users u WHERE u.user_id = $1)
            )`,
        [userId],
      );

      const isAdmin = (roles ?? []).some(
        (r) => r.role_id && r.role_id.toUpperCase() === 'ADMIN',
      );

      return {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.user_name,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
        roles: roles ?? [],
        is_admin: isAdmin,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user with roles for ${userId}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
