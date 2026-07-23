import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';

@Injectable()
export class AdminSystemService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) { }

  // ────────────────────────────────────────────────
  // Admin Users
  // ────────────────────────────────────────────────
  async getAdminUsers(query: any) {
    try {
      const { page = 1, limit = 50, search } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const params: any[] = [];
      const where: string[] = [];

      if (search) {
        params.push(`%${search}%`);
        where.push(
          `(ms.user_name ILIKE $${params.length} OR ms.phone ILIKE $${params.length})`,
        );
      }

      const sql = `
      SELECT
        ms.user_id,
        ms.user_name,
        u.email,
        ms.phone,
        ms.role_id,
        r.name AS role_name,
        ms.is_active,
        ms.created_at,
        ms.updated_at
      FROM management_staff ms
      LEFT JOIN roles r ON r.role_id = ms.role_id
      LEFT JOIN users u ON u.user_id = ms.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ms.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      const countSql = `
      SELECT COUNT(*)::int AS total
      FROM management_staff ms
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    `;

      const countRows = await this.db.query(countSql, params.slice(0, -2));

      return {
        status: true,
        data: rows,
        total: countRows[0]?.total ?? 0,
        message: 'Management staff fetched',
      };
    } catch (error) {
      this.developer.error('getAdminUsers error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve management staff',
      );
    }
  }

  async updateAdminUser(userId: string, body: any) {
    try {
      const updateFields: string[] = ['updated_at = NOW()'];
      const params: any[] = [userId];

      if (body.role) { params.push(body.role); updateFields.push(`role_id = $${params.length}`); }
      if (body.is_active !== undefined) { params.push(body.is_active); updateFields.push(`is_active = $${params.length}`); }

      await this.db.query(
        `UPDATE management_staff SET ${updateFields.join(', ')} WHERE user_id = $1`,
        params,
      );

      return { status: true, message: 'Admin user updated' };
    } catch (error) {
      this.developer.error('updateAdminUser error', { error });
      throw new InternalServerErrorException('Failed to update admin user');
    }
  }

  // ────────────────────────────────────────────────
  // Roles & Permissions
  // ────────────────────────────────────────────────
  async getRoles() {
    try {
      const rows = await this.db.query(
        'SELECT * FROM admin_roles ORDER BY created_at ASC', [],
      );
      return { status: true, data: rows, message: 'Roles fetched' };
    } catch (error) {
      this.developer.error('getRoles error', { error });
      throw new InternalServerErrorException('Failed to retrieve roles');
    }
  }

  async createRole(body: any) {
    try {
      const sql = `
        INSERT INTO admin_roles (role_name, description, permissions, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const rows = await this.db.query(sql, [
        body.role_name, body.description,
        JSON.stringify(body.permissions || []), body.is_active !== false,
      ]);
      return { status: true, data: rows[0], message: 'Role created' };
    } catch (error) {
      this.developer.error('createRole error', { error });
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  async updateRole(id: string, body: any) {
    try {
      const updateFields: string[] = ['updated_at = NOW()'];
      const params: any[] = [id];

      if (body.role_name) { params.push(body.role_name); updateFields.push(`role_name = $${params.length}`); }
      if (body.description !== undefined) { params.push(body.description); updateFields.push(`description = $${params.length}`); }
      if (body.permissions) { params.push(JSON.stringify(body.permissions)); updateFields.push(`permissions = $${params.length}`); }
      if (body.is_active !== undefined) { params.push(body.is_active); updateFields.push(`is_active = $${params.length}`); }

      await this.db.query(`UPDATE admin_roles SET ${updateFields.join(', ')} WHERE id = $1`, params);
      return { status: true, message: 'Role updated' };
    } catch (error) {
      this.developer.error('updateRole error', { error });
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  // ────────────────────────────────────────────────
  // Notification Settings
  // ────────────────────────────────────────────────
  async getNotificationSettings() {
    try {
      const rows = await this.db.query(
        'SELECT * FROM notification_settings ORDER BY setting_key ASC', [],
      );
      return { status: true, data: rows, message: 'Notification settings fetched' };
    } catch (error) {
      this.developer.error('getNotificationSettings error', { error });
      throw new InternalServerErrorException('Failed to retrieve notification settings');
    }
  }

  async updateNotificationSetting(id: string, body: any, adminId: string) {
    try {
      const updateFields: string[] = ['updated_at = NOW()', `updated_by = '${adminId}'`];
      const params: any[] = [id];

      if (body.setting_value) { params.push(JSON.stringify(body.setting_value)); updateFields.push(`setting_value = $${params.length}`); }
      if (body.is_active !== undefined) { params.push(body.is_active); updateFields.push(`is_active = $${params.length}`); }
      if (body.description) { params.push(body.description); updateFields.push(`description = $${params.length}`); }

      await this.db.query(
        `UPDATE notification_settings SET ${updateFields.join(', ')} WHERE id = $1`, params,
      );
      return { status: true, message: 'Notification setting updated' };
    } catch (error) {
      this.developer.error('updateNotificationSetting error', { error });
      throw new InternalServerErrorException('Failed to update notification setting');
    }
  }

  async createNotificationSetting(body: any, adminId: string) {
    try {
      const sql = `
        INSERT INTO notification_settings (setting_key, setting_value, description, is_active, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (setting_key) DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `;
      const rows = await this.db.query(sql, [
        body.setting_key, JSON.stringify(body.setting_value || {}),
        body.description, body.is_active !== false, adminId,
      ]);
      return { status: true, data: rows[0], message: 'Notification setting saved' };
    } catch (error) {
      this.developer.error('createNotificationSetting error', { error });
      throw new InternalServerErrorException('Failed to create notification setting');
    }
  }

  // ────────────────────────────────────────────────
  // Audit Logs
  // ────────────────────────────────────────────────
  async getAuditLogs(query: any) {
    try {
      const { admin_id, action, target_type, page = 1, limit = 50, search } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = [];

      if (admin_id) { params.push(admin_id); where.push(`al.admin_id = $${params.length}`); }
      if (action) { params.push(action); where.push(`al.action = $${params.length}`); }
      if (target_type) { params.push(target_type); where.push(`al.target_type = $${params.length}`); }
      if (search) {
        params.push(`%${search}%`);
        where.push(`(al.admin_name ILIKE $${params.length} OR al.action ILIKE $${params.length} OR al.target_type ILIKE $${params.length})`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT al.*
        FROM admin_audit_logs al
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      const countSql = `SELECT COUNT(*)::int AS total FROM admin_audit_logs al ${whereClause}`;
      const countRows = await this.db.query(countSql, params.slice(0, -2));

      return {
        status: true,
        data: rows,
        total: countRows[0]?.total ?? 0,
        message: 'Audit logs fetched',
      };
    } catch (error) {
      this.developer.error('getAuditLogs error', { error });
      throw new InternalServerErrorException('Failed to retrieve audit logs');
    }
  }

  async createAuditLog(data: {
    admin_id: string; admin_name?: string; action: string;
    target_type: string; target_id?: string; details?: any;
    ip_address?: string; user_agent?: string;
  }) {
    try {
      await this.db.query(
        `INSERT INTO admin_audit_logs
          (admin_id, admin_name, action, target_type, target_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.admin_id, data.admin_name, data.action, data.target_type,
          data.target_id, JSON.stringify(data.details || {}),
          data.ip_address, data.user_agent,
        ],
      );
    } catch (error) {
      this.developer.error('createAuditLog error', { error });
      // Don't throw - audit logging should not break main operations
    }
  }

  // ────────────────────────────────────────────────
  // Version Control (app_configs)
  // ────────────────────────────────────────────────
  async getAppConfigs() {
    try {
      const rows = await this.db.query(
        `SELECT id, platform, latest_version, min_version, force_update, store_url, update_message, updated_at 
         FROM app_configs 
         ORDER BY platform`
      );
      return {
        status: true,
        data: rows,
        message: 'App configs fetched',
      };
    } catch (error) {
      this.developer.error('getAppConfigs error', { error });
      throw new InternalServerErrorException('Failed to retrieve app configs');
    }
  }

  async updateAppConfig(platform: string, body: any) {
    try {
      const { latest_version, min_version, force_update, store_url, update_message } = body;
      await this.db.query(
        `UPDATE app_configs 
         SET latest_version = $2, min_version = $3, force_update = $4, store_url = $5, update_message = $6, updated_at = NOW() 
         WHERE platform = $1`,
        [platform, latest_version, min_version, force_update, store_url, update_message]
      );
      return {
        status: true,
        message: 'App configuration updated successfully',
      };
    } catch (error) {
      this.developer.error('updateAppConfig error', { error });
      throw new InternalServerErrorException('Failed to update app configuration');
    }
  }
}
