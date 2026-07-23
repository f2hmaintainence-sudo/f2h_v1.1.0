import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

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
       WHERE user_id = ? AND deleted_at IS NULL`,
        [userId],
      );

      if (!userResult || userResult.length === 0) {
        console.warn(`[RolesService] User ${userId} not found`);
        return null;
      }
      const user = userResult[0];
      const rolesResult = await this.db.query(
        `SELECT 
            r.role_id,
            r.name,
            ra.is_active,
            ra.valid_until
                FROM users ra
                INNER JOIN roles r 
                    ON ra.role_id = r.role_id
                WHERE ra.user_id = ?
                    AND ra.is_active = 1
                    AND r.is_active = 1
                    AND ra.deleted_at IS NULL`,
        [userId],
      );
      const roles = rolesResult || [];
      const isAdmin = roles.some(
        (r) => r.role_id && r.role_id.toUpperCase() === 'ADMIN',
      );
      console.log(
        `[RolesService] User ${userId} has ${roles.length} roles, is_admin: ${isAdmin}`,
        roles.map((r) => r.role_id),
      );
      return {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.user_name,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at,
        roles,
        is_admin: isAdmin,
      };
    } catch (error) {
      console.error(
        `[RolesService] Error fetching user with roles for ${userId}:`,
        error,
      );
      return null;
    }
  }
}
