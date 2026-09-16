import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { generateId } from '../../../helpers/RandomHelper';
import { AuditLogQueryDto } from './admin-system.dto';
import {
  APP_VERSION_PATTERN,
  compareAppVersions,
} from '../../../shared/version/app-version.util';

export interface AuditActionBreakdown {
  action: string;
  count: number;
}

interface AuditInsightRow {
  total_events: number;
  events_today: number;
  delete_events: number;
  active_admins: number;
  affected_resources: number;
  action_breakdown: AuditActionBreakdown[] | null;
}

interface AuditFilterOptionsRow {
  actions: string[] | null;
  target_types: string[] | null;
}

export interface AuditAdminOption {
  admin_id: string;
  admin_name: string;
}

const DEFAULT_ROLES = [
  {
    role_name: 'super_admin',
    description: 'Full unrestricted system access across all modules and settings',
    permissions: [
      'dashboard.view', 'dashboard.analytics', 'reports.view', 'reports.export',
      'orders.view', 'orders.manage', 'orders.cancel', 'subscriptions.view', 'subscriptions.manage', 'subscriptions.refunds',
      'customers.view', 'customers.manage', 'customers.special_prices',
      'catalog.view', 'catalog.manage', 'catalog.categories', 'catalog.pricing', 'catalog.promotions',
      'vendors.view', 'vendors.manage', 'vendors.collections.view', 'vendors.collections.create', 'vendors.collections.manage', 'vendors.slips.send',
      'inventory.view', 'inventory.manage', 'warehouse.view', 'warehouse.stock_movements', 'warehouse.dispatch', 'packages.containers',
      'delivery.view', 'delivery.assign', 'delivery.partners.manage', 'delivery.logs.view', 'delivery.leave_requests', 'delivery.referrals',
      'finance.view', 'finance.manage', 'finance.billing', 'finance.wallet', 'finance.refunds', 'finance.outstandings',
      'branches.view', 'branches.manage', 'branches.zones', 'staff.view', 'staff.manage', 'staff.roles',
      'system.admins', 'system.roles', 'system.notifications', 'system.audit', 'system.version_control', 'developer.api_integrations',
    ],
    is_active: true,
  },
  {
    role_name: 'admin',
    description: 'Administrative operations across catalog, orders, delivery, warehouse, and finance',
    permissions: [
      'dashboard.view', 'dashboard.analytics', 'reports.view', 'reports.export',
      'orders.view', 'orders.manage', 'subscriptions.view', 'subscriptions.manage',
      'customers.view', 'customers.manage', 'customers.special_prices',
      'catalog.view', 'catalog.manage', 'catalog.categories', 'catalog.pricing', 'catalog.promotions',
      'vendors.view', 'vendors.manage', 'vendors.collections.view', 'vendors.collections.create', 'vendors.collections.manage', 'vendors.slips.send',
      'inventory.view', 'inventory.manage', 'warehouse.view', 'warehouse.stock_movements', 'warehouse.dispatch', 'packages.containers',
      'delivery.view', 'delivery.assign', 'delivery.partners.manage', 'delivery.logs.view', 'delivery.leave_requests',
      'finance.view', 'finance.billing', 'finance.wallet', 'finance.outstandings',
      'branches.view', 'staff.view', 'staff.manage',
      'system.notifications', 'system.audit',
    ],
    is_active: true,
  },
  {
    role_name: 'branch_manager',
    description: 'Branch-level operational management, local inventory, local dispatch, and delivery partner tracking',
    permissions: [
      'dashboard.view',
      'orders.view', 'orders.manage', 'subscriptions.view',
      'customers.view',
      'catalog.view',
      'vendors.view', 'vendors.collections.view', 'vendors.collections.create', 'vendors.collections.manage', 'vendors.slips.send',
      'inventory.view', 'inventory.manage', 'warehouse.view', 'warehouse.dispatch',
      'delivery.view', 'delivery.assign', 'delivery.partners.manage', 'delivery.logs.view', 'delivery.leave_requests',
      'branches.view', 'staff.view',
    ],
    is_active: true,
  },
  {
    role_name: 'milk_procurement_officer',
    description: 'Manages milk and fresh produce intake, collections, fat testing, and vendor slip dispatches',
    permissions: [
      'dashboard.view',
      'catalog.view',
      'vendors.view', 'vendors.manage', 'vendors.collections.view', 'vendors.collections.create', 'vendors.collections.manage', 'vendors.slips.send',
      'inventory.view',
    ],
    is_active: true,
  },
  {
    role_name: 'warehouse_manager',
    description: 'Inventory management, warehouse operations, stock transfers, and packing dispatch',
    permissions: [
      'dashboard.view',
      'catalog.view',
      'inventory.view', 'inventory.manage', 'warehouse.view', 'warehouse.stock_movements', 'warehouse.dispatch', 'packages.containers',
    ],
    is_active: true,
  },
  {
    role_name: 'delivery_dispatcher',
    description: 'Delivery route coordination, partner assignments, and live delivery operations',
    permissions: [
      'dashboard.view',
      'orders.view',
      'delivery.view', 'delivery.assign', 'delivery.partners.manage', 'delivery.logs.view', 'delivery.leave_requests',
    ],
    is_active: true,
  },
  {
    role_name: 'finance_billing_staff',
    description: 'Billing, customer outstandings, payments reconciliation, refunds, and wallet management',
    permissions: [
      'dashboard.view', 'reports.view', 'reports.export',
      'orders.view',
      'customers.view',
      'finance.view', 'finance.manage', 'finance.billing', 'finance.wallet', 'finance.refunds', 'finance.outstandings',
    ],
    is_active: true,
  },
  {
    role_name: 'staff',
    description: 'General staff access for operational viewing and basic tasks',
    permissions: [
      'dashboard.view',
      'orders.view',
      'customers.view',
      'catalog.view',
      'vendors.collections.view',
      'inventory.view',
      'delivery.view',
    ],
    is_active: true,
  },
  {
    role_name: 'milk_collector',
    description: 'Milk collector role with dedicated access exclusively for daily milk and produce collections logging',
    permissions: [
      'vendors.collections.view',
      'vendors.collections.create',
      'vendors.collections.manage',
      'vendors.slips.send',
    ],
    is_active: true,
  },
];

@Injectable()
export class AdminSystemService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ────────────────────────────────────────────────
  // Admin & Staff Users
  // ────────────────────────────────────────────────
  async getAdminUsers(query: any) {
    try {
      const { page = 1, limit = 50, search, branch_id, role_id, is_active } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const params: any[] = [];
      const where: string[] = ['ms.deleted_at IS NULL'];

      if (search) {
        params.push(`%${search}%`);
        where.push(
          `(ms.user_name ILIKE $${params.length} OR ms.phone ILIKE $${params.length} OR u.email ILIKE $${params.length} OR ms.department ILIKE $${params.length} OR ms.designation ILIKE $${params.length})`,
        );
      }

      if (branch_id) {
        params.push(branch_id);
        where.push(`ms.branch_id = $${params.length}`);
      }

      if (role_id) {
        params.push(role_id);
        where.push(`(ms.role_id = $${params.length} OR r.role_id = $${params.length} OR ar.role_name = $${params.length})`);
      }

      if (is_active !== undefined && is_active !== '') {
        params.push(is_active === true || String(is_active) === 'true');
        where.push(`ms.is_active = $${params.length}`);
      }

      const sql = `
      SELECT
        ms.management_id,
        ms.user_id,
        ms.user_name,
        u.email,
        ms.phone,
        ms.role_id,
        COALESCE(ar.role_name, r.name, ms.role_id) AS role_name,
        ms.branch_id,
        b.branch_name,
        ms.department,
        ms.designation,
        ms.is_active,
        ms.created_at,
        ms.updated_at
      FROM management_staff ms
      LEFT JOIN users u ON u.user_id = ms.user_id
      LEFT JOIN roles r ON r.role_id = ms.role_id
      LEFT JOIN admin_roles ar ON (ar.role_name = ms.role_id OR ar.id::text = ms.role_id)
      LEFT JOIN branches b ON b.branch_id = ms.branch_id
      WHERE ${where.join(' AND ')}
      ORDER BY ms.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      const countSql = `
      SELECT COUNT(*)::int AS total
      FROM management_staff ms
      LEFT JOIN users u ON u.user_id = ms.user_id
      LEFT JOIN roles r ON r.role_id = ms.role_id
      LEFT JOIN admin_roles ar ON (ar.role_name = ms.role_id OR ar.id::text = ms.role_id)
      WHERE ${where.join(' AND ')}
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

  async createAdminUser(body: any, adminId: string = 'system') {
    try {
      const {
        user_name,
        email,
        phone,
        password,
        role_id,
        role,
        branch_id,
        department,
        designation,
        is_active,
      } = body;
      const targetRole = role_id || role || 'admin';

      if (!user_name?.trim()) {
        throw new BadRequestException('Staff username / name is required');
      }
      if (!email?.trim()) {
        throw new BadRequestException('Email address is required');
      }
      if (!phone?.trim()) {
        throw new BadRequestException('Phone number is required');
      }
      if (!password?.trim() || password.trim().length < 6) {
        throw new BadRequestException('Password must be at least 6 characters');
      }

      const cleanEmail = email.toLowerCase().trim();
      const cleanPhone = phone.trim();
      const cleanUserName = user_name.trim();

      // Check duplicate email
      const emailRows = await this.db.query(
        'SELECT user_id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
        [cleanEmail],
      );
      if (emailRows.length > 0) {
        throw new BadRequestException('An account with this email already exists');
      }

      // Check duplicate phone
      const phoneRows = await this.db.query(
        'SELECT user_id FROM users WHERE phone = $1 AND deleted_at IS NULL LIMIT 1',
        [cleanPhone],
      );
      if (phoneRows.length > 0) {
        throw new BadRequestException('An account with this phone number already exists');
      }

      const userId = generateId('F2H', 9);
      const managementId = generateId('MNG', 12);
      const hashedPassword = bcrypt.hashSync(password.trim(), 10);
      const now = new Date().toISOString();

      await this.db.transaction(async (client) => {
        // Insert into users
        await client.query(
          `INSERT INTO users (user_id, email, phone, user_name, password, role_id, account_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)`,
          [userId, cleanEmail, cleanPhone, cleanUserName, hashedPassword, targetRole, now],
        );

        // Insert into role_assignments
        await client.query(
          `INSERT INTO role_assignments (id, user_id, role_id, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, 1, $4, $4)`,
          [Date.now() + Math.floor(Math.random() * 1000), userId, targetRole, now],
        );

        // Insert into management_staff
        await client.query(
          `INSERT INTO management_staff (
             management_id, user_id, branch_id, role_id, user_name,
             department, designation, phone, is_active, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
          [
            managementId,
            userId,
            branch_id?.trim() || null,
            targetRole,
            cleanUserName,
            department?.trim() || null,
            designation?.trim() || null,
            cleanPhone,
            is_active !== false && String(is_active) !== 'false',
            now,
          ],
        );
      });

      await this.createAuditLog({
        admin_id: adminId,
        action: 'staff_create',
        target_type: 'management_staff',
        target_id: managementId,
        details: { username: cleanUserName, email: cleanEmail, role: targetRole, branch_id },
      });

      return {
        status: true,
        message: 'Staff member created successfully',
        data: { user_id: userId, management_id: managementId },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('createAdminUser error', { error });
      throw new InternalServerErrorException(error.message || 'Failed to create staff member');
    }
  }

  async updateAdminUser(identifier: string, body: any, adminId: string = 'system') {
    try {
      const staffRows = await this.db.query(
        `SELECT ms.*, u.email, u.phone AS user_phone
         FROM management_staff ms
         JOIN users u ON u.user_id = ms.user_id
         WHERE (ms.user_id = $1 OR ms.management_id = $1) AND ms.deleted_at IS NULL
         LIMIT 1`,
        [identifier],
      );

      if (!staffRows.length) {
        throw new BadRequestException('Staff member not found');
      }

      const current = staffRows[0];
      const userId = current.user_id;
      const managementId = current.management_id;

      // Validate duplicate email if changed
      if (body.email && body.email.toLowerCase().trim() !== current.email?.toLowerCase().trim()) {
        const cleanEmail = body.email.toLowerCase().trim();
        const existingEmail = await this.db.query(
          'SELECT user_id FROM users WHERE email = $1 AND user_id <> $2 AND deleted_at IS NULL LIMIT 1',
          [cleanEmail, userId],
        );
        if (existingEmail.length > 0) {
          throw new BadRequestException('This email is already registered to another user');
        }
      }

      // Validate duplicate phone if changed
      if (body.phone && body.phone.trim() !== current.phone?.trim()) {
        const cleanPhone = body.phone.trim();
        const existingPhone = await this.db.query(
          'SELECT user_id FROM users WHERE phone = $1 AND user_id <> $2 AND deleted_at IS NULL LIMIT 1',
          [cleanPhone, userId],
        );
        if (existingPhone.length > 0) {
          throw new BadRequestException('This phone number is already registered to another user');
        }
      }

      const newRole = body.role_id || body.role;

      await this.db.transaction(async (client) => {
        // Update users table
        const userUpdates: string[] = ['updated_at = NOW()'];
        const userParams: any[] = [userId];

        if (body.email) {
          userParams.push(body.email.toLowerCase().trim());
          userUpdates.push(`email = $${userParams.length}`);
        }
        if (body.phone) {
          userParams.push(body.phone.trim());
          userUpdates.push(`phone = $${userParams.length}`);
        }
        if (body.user_name) {
          userParams.push(body.user_name.trim());
          userUpdates.push(`user_name = $${userParams.length}`);
        }
        if (newRole) {
          userParams.push(newRole);
          userUpdates.push(`role_id = $${userParams.length}`);
        }
        if (body.password && body.password.trim()) {
          const hashedPassword = bcrypt.hashSync(body.password.trim(), 10);
          userParams.push(hashedPassword);
          userUpdates.push(`password = $${userParams.length}`);
        }

        await client.query(
          `UPDATE users SET ${userUpdates.join(', ')} WHERE user_id = $1`,
          userParams,
        );

        // Update role_assignments if role changed
        if (newRole && newRole !== current.role_id) {
          await client.query(
            'UPDATE role_assignments SET is_active = 0, updated_at = NOW() WHERE user_id = $1',
            [userId],
          );
          await client.query(
            `INSERT INTO role_assignments (id, user_id, role_id, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, 1, NOW(), NOW())`,
            [Date.now() + Math.floor(Math.random() * 1000), userId, newRole],
          );
        }

        // Update management_staff table
        const msUpdates: string[] = ['updated_at = NOW()'];
        const msParams: any[] = [managementId];

        if (body.user_name) {
          msParams.push(body.user_name.trim());
          msUpdates.push(`user_name = $${msParams.length}`);
        }
        if (body.phone) {
          msParams.push(body.phone.trim());
          msUpdates.push(`phone = $${msParams.length}`);
        }
        if (newRole) {
          msParams.push(newRole);
          msUpdates.push(`role_id = $${msParams.length}`);
        }
        if (body.branch_id !== undefined) {
          msParams.push(body.branch_id?.trim() || null);
          msUpdates.push(`branch_id = $${msParams.length}`);
        }
        if (body.department !== undefined) {
          msParams.push(body.department?.trim() || null);
          msUpdates.push(`department = $${msParams.length}`);
        }
        if (body.designation !== undefined) {
          msParams.push(body.designation?.trim() || null);
          msUpdates.push(`designation = $${msParams.length}`);
        }
        if (body.is_active !== undefined) {
          const isActive = body.is_active === true || String(body.is_active) === 'true';
          msParams.push(isActive);
          msUpdates.push(`is_active = $${msParams.length}`);
        }

        await client.query(
          `UPDATE management_staff SET ${msUpdates.join(', ')} WHERE management_id = $1`,
          msParams,
        );
      });

      await this.createAuditLog({
        admin_id: adminId,
        action: 'staff_update',
        target_type: 'management_staff',
        target_id: managementId,
        details: { changes: Object.keys(body), identifier },
      });

      return { status: true, message: 'Staff member updated successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('updateAdminUser error', { error });
      throw new InternalServerErrorException('Failed to update staff member');
    }
  }

  async deleteAdminUser(identifier: string, adminId: string = 'system') {
    try {
      const staffRows = await this.db.query(
        `SELECT ms.management_id, ms.user_id, ms.user_name
         FROM management_staff ms
         WHERE (ms.user_id = $1 OR ms.management_id = $1) AND ms.deleted_at IS NULL
         LIMIT 1`,
        [identifier],
      );

      if (!staffRows.length) {
        throw new BadRequestException('Staff member not found');
      }

      const staff = staffRows[0];

      await this.db.transaction(async (client) => {
        await client.query(
          'UPDATE management_staff SET deleted_at = NOW(), is_active = false WHERE management_id = $1',
          [staff.management_id],
        );
        await client.query(
          `UPDATE users SET deleted_at = NOW(), account_status = 'deleted' WHERE user_id = $1`,
          [staff.user_id],
        );
      });

      await this.createAuditLog({
        admin_id: adminId,
        action: 'staff_delete',
        target_type: 'management_staff',
        target_id: staff.management_id,
        details: { username: staff.user_name },
      });

      return { status: true, message: 'Staff member deleted successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('deleteAdminUser error', { error });
      throw new InternalServerErrorException('Failed to delete staff member');
    }
  }

  // ────────────────────────────────────────────────
  // Roles & Permissions
  // ────────────────────────────────────────────────
  async getRoles() {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS admin_roles (
          id SERIAL PRIMARY KEY,
          role_name VARCHAR(50) NOT NULL UNIQUE,
          description TEXT DEFAULT NULL,
          permissions JSONB DEFAULT '[]'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `, []);

      for (const role of DEFAULT_ROLES) {
        await this.db.query(`
          INSERT INTO admin_roles (role_name, description, permissions, is_active)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (role_name) DO NOTHING
        `, [role.role_name, role.description, JSON.stringify(role.permissions), role.is_active]);
      }

      const rows = await this.db.query(
        'SELECT * FROM admin_roles ORDER BY id ASC',
        [],
      );
      return { status: true, data: rows, message: 'Roles fetched' };
    } catch (error) {
      this.developer.error('getRoles error', { error });
      throw new InternalServerErrorException('Failed to retrieve roles');
    }
  }

  async createRole(body: any) {
    try {
      if (!body.role_name?.trim()) {
        throw new BadRequestException('Role name is required');
      }

      const sql = `
        INSERT INTO admin_roles (role_name, description, permissions, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const rows = await this.db.query(sql, [
        body.role_name.trim(),
        body.description?.trim() || null,
        JSON.stringify(body.permissions || []),
        body.is_active !== false && String(body.is_active) !== 'false',
      ]);
      return { status: true, data: rows[0], message: 'Role created' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('createRole error', { error });
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  async updateRole(id: string, body: any) {
    try {
      const updateFields: string[] = ['updated_at = NOW()'];
      const params: any[] = [id];

      if (body.role_name) {
        params.push(body.role_name.trim());
        updateFields.push(`role_name = $${params.length}`);
      }
      if (body.description !== undefined) {
        params.push(body.description?.trim() || null);
        updateFields.push(`description = $${params.length}`);
      }
      if (body.permissions) {
        params.push(JSON.stringify(body.permissions));
        updateFields.push(`permissions = $${params.length}`);
      }
      if (body.is_active !== undefined) {
        params.push(body.is_active === true || String(body.is_active) === 'true');
        updateFields.push(`is_active = $${params.length}`);
      }

      await this.db.query(
        `UPDATE admin_roles SET ${updateFields.join(', ')} WHERE id = $1`,
        params,
      );
      return { status: true, message: 'Role updated' };
    } catch (error) {
      this.developer.error('updateRole error', { error });
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  async deleteRole(id: string) {
    try {
      await this.db.query('DELETE FROM admin_roles WHERE id = $1', [id]);
      return { status: true, message: 'Role deleted successfully' };
    } catch (error) {
      this.developer.error('deleteRole error', { error });
      throw new InternalServerErrorException('Failed to delete role');
    }
  }

  // ────────────────────────────────────────────────
  // Notification Settings
  // ────────────────────────────────────────────────
  async getNotificationSettings() {
    try {
      const rows = await this.db.query(
        'SELECT * FROM notification_settings ORDER BY setting_key ASC',
        [],
      );
      return {
        status: true,
        data: rows,
        message: 'Notification settings fetched',
      };
    } catch (error) {
      this.developer.error('getNotificationSettings error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve notification settings',
      );
    }
  }

  async updateNotificationSetting(id: string, body: any, adminId: string) {
    try {
      const updateFields: string[] = [
        'updated_at = NOW()',
        `updated_by = '${adminId}'`,
      ];
      const params: any[] = [id];

      if (body.setting_value) {
        params.push(JSON.stringify(body.setting_value));
        updateFields.push(`setting_value = $${params.length}`);
      }
      if (body.is_active !== undefined) {
        params.push(body.is_active);
        updateFields.push(`is_active = $${params.length}`);
      }
      if (body.description) {
        params.push(body.description);
        updateFields.push(`description = $${params.length}`);
      }

      await this.db.query(
        `UPDATE notification_settings SET ${updateFields.join(', ')} WHERE id = $1`,
        params,
      );
      return { status: true, message: 'Notification setting updated' };
    } catch (error) {
      this.developer.error('updateNotificationSetting error', { error });
      throw new InternalServerErrorException(
        'Failed to update notification setting',
      );
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
        body.setting_key,
        JSON.stringify(body.setting_value || {}),
        body.description,
        body.is_active !== false,
        adminId,
      ]);
      return {
        status: true,
        data: rows[0],
        message: 'Notification setting saved',
      };
    } catch (error) {
      this.developer.error('createNotificationSetting error', { error });
      throw new InternalServerErrorException(
        'Failed to create notification setting',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Audit Logs
  // ────────────────────────────────────────────────
  async getAuditLogs(query: AuditLogQueryDto) {
    if (query.from_date && query.to_date && query.from_date > query.to_date) {
      throw new BadRequestException('from_date cannot be after to_date');
    }

    try {
      const {
        admin_id,
        action,
        target_type,
        search,
        from_date,
        to_date,
        include_filter_options = 'true',
        page = 1,
        limit = 50,
      } = query;
      const offset = (page - 1) * limit;
      const params: string[] = [];
      const where: string[] = [];
      const resolvedAdminNameSql = `COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
        NULLIF(BTRIM(u.user_name), ''),
        NULLIF(BTRIM(al.admin_name), ''),
        al.admin_id
      )`;

      if (admin_id) {
        params.push(admin_id);
        where.push(`al.admin_id = $${params.length}`);
      }
      if (action) {
        params.push(action);
        where.push(`al.action = $${params.length}`);
      }
      if (target_type) {
        params.push(target_type);
        where.push(`al.target_type = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        where.push(`(
          ${resolvedAdminNameSql} ILIKE $${params.length}
          OR al.action ILIKE $${params.length}
          OR al.target_type ILIKE $${params.length}
          OR COALESCE(al.target_id, '') ILIKE $${params.length}
          OR COALESCE(al.ip_address, '') ILIKE $${params.length}
        )`);
      }
      if (from_date) {
        params.push(from_date);
        where.push(
          `al.created_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`,
        );
      }
      if (to_date) {
        params.push(to_date);
        where.push(
          `al.created_at < (($${params.length}::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata')`,
        );
      }

      const whereClause =
        where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const rowsSql = `
        SELECT
          al.id,
          al.admin_id,
          ${resolvedAdminNameSql} AS admin_name,
          al.action,
          al.target_type,
          al.target_id,
          al.details,
          al.ip_address,
          al.user_agent,
          al.created_at,
          al.deleted_at
        FROM admin_audit_logs al
        LEFT JOIN users u ON u.user_id = al.admin_id
        ${whereClause}
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const insightSql = `
        WITH filtered_logs AS (
          SELECT al.action, al.admin_id, al.target_type, al.created_at
          FROM admin_audit_logs al
          LEFT JOIN users u ON u.user_id = al.admin_id
          ${whereClause}
        )
        SELECT
          COUNT(*)::int AS total_events,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date =
              (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          )::int AS events_today,
          COUNT(*) FILTER (WHERE LOWER(action) LIKE '%delete%')::int AS delete_events,
          COUNT(DISTINCT admin_id)::int AS active_admins,
          COUNT(DISTINCT target_type)::int AS affected_resources,
          COALESCE((
            SELECT json_agg(
              json_build_object('action', ranked.action, 'count', ranked.count)
              ORDER BY ranked.count DESC, ranked.action ASC
            )
            FROM (
              SELECT action, COUNT(*)::int AS count
              FROM filtered_logs
              GROUP BY action
              ORDER BY count DESC, action ASC
              LIMIT 5
            ) ranked
          ), '[]'::json) AS action_breakdown
        FROM filtered_logs
      `;

      const filterOptionsSql = `
        SELECT
          COALESCE(
            ARRAY_AGG(DISTINCT action ORDER BY action)
              FILTER (WHERE action IS NOT NULL AND action <> ''),
            ARRAY[]::varchar[]
          ) AS actions,
          COALESCE(
            ARRAY_AGG(DISTINCT target_type ORDER BY target_type)
              FILTER (WHERE target_type IS NOT NULL AND target_type <> ''),
            ARRAY[]::varchar[]
          ) AS target_types
        FROM admin_audit_logs
      `;

      const adminOptionsSql = `
        SELECT
          al.admin_id,
          ${resolvedAdminNameSql} AS admin_name
        FROM (
          SELECT DISTINCT ON (admin_id)
            admin_id,
            admin_name
          FROM admin_audit_logs
          WHERE admin_id IS NOT NULL AND admin_id <> ''
          ORDER BY admin_id, created_at DESC, id DESC
        ) al
        LEFT JOIN users u ON u.user_id = al.admin_id
        ORDER BY admin_name ASC, al.admin_id ASC
      `;

      const shouldLoadFilterOptions = include_filter_options === 'true';
      const [rows, insightRows, filterOptionRows, adminOptions] =
        await Promise.all([
          this.db.query<Record<string, unknown>>(rowsSql, [
            ...params,
            limit,
            offset,
          ]),
          this.db.query<AuditInsightRow>(insightSql, params),
          shouldLoadFilterOptions
            ? this.db.query<AuditFilterOptionsRow>(filterOptionsSql)
            : Promise.resolve([]),
          shouldLoadFilterOptions
            ? this.db.query<AuditAdminOption>(adminOptionsSql)
            : Promise.resolve([]),
        ]);

      const insightRow = insightRows[0];
      const filterOptionRow = filterOptionRows[0];
      const insights = {
        total_events: Number(insightRow?.total_events ?? 0),
        events_today: Number(insightRow?.events_today ?? 0),
        delete_events: Number(insightRow?.delete_events ?? 0),
        active_admins: Number(insightRow?.active_admins ?? 0),
        affected_resources: Number(insightRow?.affected_resources ?? 0),
        action_breakdown: Array.isArray(insightRow?.action_breakdown)
          ? insightRow.action_breakdown
          : [],
      };

      return {
        status: true,
        data: rows,
        total: insights.total_events,
        insights,
        ...(shouldLoadFilterOptions
          ? {
              filter_options: {
                actions: filterOptionRow?.actions ?? [],
                target_types: filterOptionRow?.target_types ?? [],
                admins: adminOptions,
              },
            }
          : {}),
        message: 'Audit logs fetched',
      };
    } catch (error) {
      this.developer.error('getAuditLogs error', { error });
      throw new InternalServerErrorException('Failed to retrieve audit logs');
    }
  }

  async createAuditLog(data: {
    admin_id: string;
    admin_name?: string;
    action: string;
    target_type: string;
    target_id?: string;
    details?: any;
    ip_address?: string;
    user_agent?: string;
  }) {
    try {
      await this.db.query(
        `INSERT INTO admin_audit_logs
          (admin_id, admin_name, action, target_type, target_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.admin_id,
          data.admin_name,
          data.action,
          data.target_type,
          data.target_id,
          JSON.stringify(data.details || {}),
          data.ip_address,
          data.user_agent,
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
         ORDER BY platform`,
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
      const {
        latest_version,
        min_version,
        force_update,
        store_url,
        update_message,
        update_title,
        release_notes,
      } = body;

      // These two values decide whether every installed copy of the app keeps
      // working. A typo in `min_version` that parses as a huge number would
      // force-update the entire customer base with no way back, so the format
      // is checked before it can reach the table.
      for (const [field, value] of [
        ['latest_version', latest_version],
        ['min_version', min_version],
      ] as const) {
        if (!APP_VERSION_PATTERN.test(String(value ?? '').trim())) {
          throw new BadRequestException(
            `${field} must look like 1.2.3 or 1.2.3+45 — received "${value ?? ''}"`,
          );
        }
      }

      // A minimum above the latest release would demand a build nobody can
      // install, which is the same outage by a different route.
      if (compareAppVersions(min_version, latest_version) > 0) {
        throw new BadRequestException(
          `min_version (${min_version}) cannot be newer than latest_version (${latest_version})`,
        );
      }

      if (!String(store_url ?? '').trim().startsWith('https://')) {
        throw new BadRequestException('store_url must be an https:// link to the store listing');
      }

      const result = await this.db.query(
        `UPDATE app_configs
         SET latest_version = $2,
             min_version = $3,
             force_update = $4,
             store_url = $5,
             update_message = $6,
             update_title = COALESCE($7, update_title),
             release_notes = COALESCE($8, release_notes),
             updated_at = NOW()
         WHERE platform = $1 AND deleted_at IS NULL
         RETURNING platform`,
        [
          platform,
          String(latest_version).trim(),
          String(min_version).trim(),
          force_update === true || force_update === 'true',
          String(store_url).trim(),
          update_message,
          update_title ?? null,
          release_notes ?? null,
        ],
      );

      if (!result || result.length === 0) {
        throw new BadRequestException(`No app configuration exists for platform "${platform}"`);
      }
      return {
        status: true,
        message: 'App configuration updated successfully',
      };
    } catch (error) {
      // A rejected value is the admin's to fix — turning it into a 500 would
      // hide which field was wrong on the one screen that can lock out the app.
      if (error instanceof BadRequestException) throw error;
      this.developer.error('updateAppConfig error', { error });
      throw new InternalServerErrorException(
        'Failed to update app configuration',
      );
    }
  }

  // ────────────────────────────────────────────────
  // Site Settings (footer / contact info)
  // ────────────────────────────────────────────────

  /** Ensure the site_settings table exists, then return all settings as a key-value map. */
  async getSiteSettings(): Promise<{
    status: boolean;
    data: Record<string, any>;
  }> {
    try {
      await this.db.query(
        `
        CREATE TABLE IF NOT EXISTS site_settings (
          key   VARCHAR(120) PRIMARY KEY,
          value TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
        [],
      );

      const rows: { key: string; value: string }[] = await this.db.query(
        'SELECT key, value FROM site_settings ORDER BY key ASC',
        [],
      );

      const data: Record<string, any> = {};
      for (const row of rows) {
        try {
          data[row.key] = JSON.parse(row.value);
        } catch {
          data[row.key] = row.value;
        }
      }
      return { status: true, data };
    } catch (error) {
      this.developer.error('getSiteSettings error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve site settings',
      );
    }
  }

  /** Insert or update one site setting. */
  async upsertSiteSetting(
    key: string,
    value: any,
  ): Promise<{ status: boolean; message: string }> {
    try {
      await this.db.query(
        `
        CREATE TABLE IF NOT EXISTS site_settings (
          key   VARCHAR(120) PRIMARY KEY,
          value TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
        [],
      );

      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      await this.db.query(
        `
        INSERT INTO site_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = NOW()
      `,
        [key, serialized],
      );

      return { status: true, message: 'Site setting saved' };
    } catch (error) {
      this.developer.error('upsertSiteSetting error', { error });
      throw new InternalServerErrorException('Failed to save site setting');
    }
  }

  /** Bulk upsert — body is a plain object { key: value, ... } */
  async upsertSiteSettings(
    body: Record<string, any>,
  ): Promise<{ status: boolean; message: string }> {
    try {
      for (const [key, value] of Object.entries(body)) {
        await this.upsertSiteSetting(key, value);
      }
      return { status: true, message: 'Site settings saved' };
    } catch (error) {
      this.developer.error('upsertSiteSettings error', { error });
      throw new InternalServerErrorException('Failed to save site settings');
    }
  }

  // ────────────────────────────────────────────────
  // Public: Active Branches list for landing page
  // ────────────────────────────────────────────────
  async getPublicBranches(): Promise<{ status: boolean; data: any[] }> {
    try {
      const rows = await this.db.query(
        `
        SELECT branch_id, branch_name, city, state,
               lat, lng, delivery_radius_km
        FROM branches
        WHERE is_active = true
        ORDER BY branch_name ASC
      `,
        [],
      );
      return { status: true, data: rows };
    } catch (error) {
      this.developer.error('getPublicBranches error', { error });
      return { status: false, data: [] };
    }
  }
}
