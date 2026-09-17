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
      await this.ensureRoleAndPermissionTables();

      const { page = 1, limit = 50, search, branch_id, role_id, is_active } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const params: any[] = [];
      const where: string[] = [
        'u.deleted_at IS NULL',
        "(LOWER(COALESCE(u.role_id, '')) NOT IN ('customer', 'delivery_partner', 'delivery_boy', 'vendor') OR ms.management_id IS NOT NULL)",
      ];

      if (search) {
        params.push(`%${search}%`);
        const pIdx = params.length;
        where.push(
          `(u.user_name ILIKE $${pIdx} OR u.first_name ILIKE $${pIdx} OR u.last_name ILIKE $${pIdx} OR u.phone ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR ms.department ILIKE $${pIdx} OR ms.designation ILIKE $${pIdx})`,
        );
      }

      if (branch_id) {
        params.push(branch_id);
        where.push(`ms.branch_id = $${params.length}`);
      }

      if (role_id) {
        params.push(role_id);
        const pIdx = params.length;
        where.push(
          `(LOWER(COALESCE(u.role_id, '')) = LOWER($${pIdx}) OR LOWER(COALESCE(ms.role_id, '')) = LOWER($${pIdx}))`,
        );
      }

      if (is_active !== undefined && is_active !== '') {
        const isActiveBool = is_active === true || String(is_active) === 'true';
        params.push(isActiveBool);
        const pIdx = params.length;
        where.push(
          `(COALESCE(ms.is_active, CASE WHEN u.account_status = 'active' THEN true ELSE false END) = $${pIdx})`,
        );
      }

      const sql = `
      SELECT
        COALESCE(ms.management_id, 'MNG-' || u.user_id) AS management_id,
        u.user_id,
        COALESCE(u.user_name, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS user_name,
        u.email,
        COALESCE(u.phone, '') AS phone,
        COALESCE(ms.role_id, u.role_id, 'admin') AS role_id,
        COALESCE(ar.role_name, r.name, ms.role_id, u.role_id, 'Admin') AS role_name,
        ms.branch_id,
        b.branch_name,
        ms.department,
        ms.designation,
        COALESCE(ms.is_active, CASE WHEN u.account_status = 'active' THEN true ELSE false END) AS is_active,
        COALESCE(ms.created_at, u.created_at) AS created_at,
        COALESCE(ms.updated_at, u.updated_at) AS updated_at
      FROM users u
      LEFT JOIN management_staff ms ON ms.user_id = u.user_id AND ms.deleted_at IS NULL
      LEFT JOIN (SELECT DISTINCT ON (UPPER(role_id)) role_id, name FROM roles WHERE deleted_at IS NULL) r ON UPPER(r.role_id) = UPPER(COALESCE(ms.role_id, u.role_id))
      LEFT JOIN (SELECT DISTINCT ON (LOWER(role_name)) role_name, id FROM admin_roles) ar ON (LOWER(ar.role_name) = LOWER(COALESCE(ms.role_id, u.role_id)) OR ar.id::text = COALESCE(ms.role_id, u.role_id))
      LEFT JOIN branches b ON b.branch_id = ms.branch_id
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(ms.created_at, u.created_at) DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

      const queryParams = [...params, parseInt(limit, 10), offset];
      const rows = await this.db.query(sql, queryParams);

      const countSql = `
      SELECT COUNT(*)::int AS total
      FROM users u
      LEFT JOIN management_staff ms ON ms.user_id = u.user_id AND ms.deleted_at IS NULL
      WHERE ${where.join(' AND ')}
    `;

      const countRows = await this.db.query(countSql, params);

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
        // Insert into users (source of truth for identity)
        await client.query(
          `INSERT INTO users (user_id, email, phone, user_name, first_name, password, role_id, account_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $4, $5, $6, 'active', $7, $7)`,
          [userId, cleanEmail, cleanPhone, cleanUserName, hashedPassword, targetRole, now],
        );

        // Insert into role_assignments
        await client.query(
          `INSERT INTO role_assignments (id, user_id, role_id, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, 1, $4, $4)`,
          [Date.now() + Math.floor(Math.random() * 1000), userId, targetRole, now],
        );

        // Insert into management_staff (WITHOUT user_name or phone)
        await client.query(
          `INSERT INTO management_staff (
             management_id, user_id, branch_id, role_id,
             department, designation, is_active, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
          [
            managementId,
            userId,
            branch_id?.trim() || null,
            targetRole,
            department?.trim() || null,
            designation?.trim() || null,
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

  async getAdminUserById(identifier: string) {
    try {
      const cleanId = String(identifier || '').trim();
      const strippedId = cleanId.replace(/^MNG-/, '');
      const withMngPrefix = cleanId.startsWith('MNG-') ? cleanId : `MNG-${cleanId}`;

      const rows = await this.db.query(
        `SELECT
           COALESCE(ms.management_id, 'MNG-' || u.user_id) AS management_id,
           u.user_id,
           COALESCE(u.user_name, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS user_name,
           u.first_name,
           u.last_name,
           u.email,
           COALESCE(u.phone, '') AS phone,
           COALESCE(ms.role_id, u.role_id, 'admin') AS role_id,
           COALESCE(ar.role_name, r.name, ms.role_id, u.role_id, 'Admin') AS role_name,
           ms.branch_id,
           b.branch_name,
           ms.department,
           ms.designation,
           COALESCE(ms.is_active, CASE WHEN u.account_status = 'active' THEN true ELSE false END) AS is_active,
           COALESCE(ms.created_at, u.created_at) AS created_at,
           COALESCE(ms.updated_at, u.updated_at) AS updated_at
         FROM users u
         LEFT JOIN management_staff ms ON ms.user_id = u.user_id AND ms.deleted_at IS NULL
         LEFT JOIN (SELECT DISTINCT ON (UPPER(role_id)) role_id, name FROM roles WHERE deleted_at IS NULL) r ON UPPER(r.role_id) = UPPER(COALESCE(ms.role_id, u.role_id))
         LEFT JOIN (SELECT DISTINCT ON (LOWER(role_name)) role_name, id FROM admin_roles) ar ON (LOWER(ar.role_name) = LOWER(COALESCE(ms.role_id, u.role_id)) OR ar.id::text = COALESCE(ms.role_id, u.role_id))
         LEFT JOIN branches b ON b.branch_id = ms.branch_id
         WHERE (
           u.user_id = $1 
           OR u.user_id = $2
           OR ms.management_id = $1 
           OR ms.management_id = $2
           OR ms.management_id = $3
           OR u.email = $1
           OR ('MNG-' || u.user_id) = $1
         ) AND u.deleted_at IS NULL
         ORDER BY (ms.management_id IS NOT NULL) DESC
         LIMIT 1`,
        [cleanId, strippedId, withMngPrefix],
      );

      if (!rows.length) {
        throw new BadRequestException('Staff member not found');
      }

      return {
        status: true,
        data: rows[0],
        message: 'Staff member fetched',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getAdminUserById error', { error });
      throw new InternalServerErrorException(error.message || 'Failed to retrieve staff member');
    }
  }

  async updateAdminUser(identifier: string, body: any, adminId: string = 'system') {
    try {
      const cleanId = String(identifier || '').trim();
      const strippedId = cleanId.replace(/^MNG-/, '');
      const withMngPrefix = cleanId.startsWith('MNG-') ? cleanId : `MNG-${cleanId}`;

      const staffRows = await this.db.query(
        `SELECT u.user_id, u.email, u.phone, u.user_name, u.role_id,
                ms.management_id, ms.branch_id, ms.department, ms.designation, ms.is_active
         FROM users u
         LEFT JOIN management_staff ms ON ms.user_id = u.user_id AND ms.deleted_at IS NULL
         WHERE (
           u.user_id = $1 
           OR u.user_id = $2
           OR ms.management_id = $1 
           OR ms.management_id = $2
           OR ms.management_id = $3
           OR u.email = $1
           OR ('MNG-' || u.user_id) = $1
         ) AND u.deleted_at IS NULL
         ORDER BY (ms.management_id IS NOT NULL) DESC
         LIMIT 1`,
        [cleanId, strippedId, withMngPrefix],
      );

      if (!staffRows.length) {
        throw new BadRequestException('Staff member not found');
      }

      const current = staffRows[0];
      const userId = current.user_id;
      let managementId = current.management_id;

      if (!managementId) {
        const existingMs = await this.db.query(
          `SELECT management_id FROM management_staff WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
          [userId],
        );
        if (existingMs.length > 0) {
          managementId = existingMs[0].management_id;
        }
      }

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
        // Update users table (identity single source of truth)
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
          userParams.push(body.user_name.trim());
          userUpdates.push(`first_name = $${userParams.length}`);
        }
        if (body.first_name !== undefined) {
          userParams.push(body.first_name?.trim() || null);
          userUpdates.push(`first_name = $${userParams.length}`);
        }
        if (body.last_name !== undefined) {
          userParams.push(body.last_name?.trim() || null);
          userUpdates.push(`last_name = $${userParams.length}`);
        }
        if (newRole) {
          userParams.push(newRole);
          userUpdates.push(`role_id = $${userParams.length}`);
        }
        if (body.is_active !== undefined) {
          const isActive = body.is_active === true || String(body.is_active) === 'true' || Number(body.is_active) === 1;
          userParams.push(isActive ? 'active' : 'inactive');
          userUpdates.push(`account_status = $${userParams.length}`);
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

        // Update or insert management_staff table without phone or user_name
        if (managementId) {
          const msUpdates: string[] = ['updated_at = NOW()'];
          const msParams: any[] = [managementId];

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
            const isActive = body.is_active === true || String(body.is_active) === 'true' || Number(body.is_active) === 1;
            msParams.push(isActive);
            msUpdates.push(`is_active = $${msParams.length}`);
          }

          await client.query(
            `UPDATE management_staff SET ${msUpdates.join(', ')} WHERE management_id = $1`,
            msParams,
          );
        } else {
          // If no management_staff record exists yet for this user, insert one
          managementId = generateId('MNG', 12);
          const targetRole = newRole || current.role_id || 'admin';
          const isActive = body.is_active !== undefined ? (body.is_active === true || String(body.is_active) === 'true' || Number(body.is_active) === 1) : true;

          await client.query(
            `INSERT INTO management_staff (
               management_id, user_id, branch_id, role_id,
               department, designation, is_active, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [
              managementId,
              userId,
              body.branch_id?.trim() || null,
              targetRole,
              body.department?.trim() || null,
              body.designation?.trim() || null,
              isActive,
            ],
          );
        }
      });

      await this.createAuditLog({
        admin_id: adminId,
        action: 'staff_update',
        target_type: 'management_staff',
        target_id: managementId || identifier,
        details: { changes: Object.keys(body), identifier },
      });

      return { status: true, message: 'Staff member updated successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('updateAdminUser error', { error });
      throw new InternalServerErrorException(error.message || 'Failed to update staff member');
    }
  }

  async deleteAdminUser(identifier: string, adminId: string = 'system') {
    try {
      const cleanId = String(identifier || '').trim();
      const strippedId = cleanId.replace(/^MNG-/, '');
      const withMngPrefix = cleanId.startsWith('MNG-') ? cleanId : `MNG-${cleanId}`;

      const staffRows = await this.db.query(
        `SELECT u.user_id, u.user_name, ms.management_id
         FROM users u
         LEFT JOIN management_staff ms ON ms.user_id = u.user_id
         WHERE (
           u.user_id = $1 
           OR u.user_id = $2
           OR ms.management_id = $1 
           OR ms.management_id = $2
           OR ms.management_id = $3
           OR u.email = $1
           OR ('MNG-' || u.user_id) = $1
         ) AND u.deleted_at IS NULL
         ORDER BY (ms.management_id IS NOT NULL) DESC
         LIMIT 1`,
        [cleanId, strippedId, withMngPrefix],
      );

      if (!staffRows.length) {
        throw new BadRequestException('Staff member not found');
      }

      const staff = staffRows[0];

      await this.db.transaction(async (client) => {
        if (staff.management_id) {
          await client.query(
            'UPDATE management_staff SET deleted_at = NOW(), is_active = false WHERE management_id = $1',
            [staff.management_id],
          );
        } else {
          await client.query(
            'UPDATE management_staff SET deleted_at = NOW(), is_active = false WHERE user_id = $1',
            [staff.user_id],
          );
        }
        await client.query(
          `UPDATE users SET deleted_at = NOW(), account_status = 'deleted' WHERE user_id = $1`,
          [staff.user_id],
        );
      });

      await this.createAuditLog({
        admin_id: adminId,
        action: 'staff_delete',
        target_type: 'management_staff',
        target_id: staff.management_id || staff.user_id,
        details: { username: staff.user_name },
      });

      return { status: true, message: 'Staff member deleted successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('deleteAdminUser error', { error });
      throw new InternalServerErrorException(error.message || 'Failed to delete staff member');
    }
  }

  // ────────────────────────────────────────────────
  // Roles & Permissions Master Tables
  // ────────────────────────────────────────────────
  private async ensureRoleAndPermissionTables() {
    // 1. Master roles table schema check & unique index
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id BIGINT NOT NULL,
        sno VARCHAR(10) NOT NULL,
        role_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) DEFAULT NULL,
        description TEXT,
        parent_role_id VARCHAR(30) DEFAULT NULL,
        is_system_role SMALLINT DEFAULT 0,
        is_active SMALLINT DEFAULT 1,
        created_by VARCHAR(30) DEFAULT NULL,
        updated_by VARCHAR(30) DEFAULT NULL,
        delete_on TIMESTAMP WITHOUT TIME ZONE,
        restored_at TIMESTAMP WITHOUT TIME ZONE,
        deleted_at TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `, []);
    await this.db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_id_unique ON roles(role_id)`, []).catch(() => {});

    // 2. Structured role_permissions table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id BIGSERIAL PRIMARY KEY,
        role_id VARCHAR(50) NOT NULL,
        permission_key VARCHAR(100) NOT NULL,
        module VARCHAR(50) DEFAULT NULL,
        can_view BOOLEAN DEFAULT TRUE,
        can_create BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_role_permissions_role_key UNIQUE (role_id, permission_key)
      )
    `, []);
    await this.db.query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id)`, []).catch(() => {});
    await this.db.query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key ON role_permissions(permission_key)`, []).catch(() => {});

    // 3. Admin roles table (JSONB cache / backward compatibility)
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
  }

  async getRoles() {
    try {
      await this.ensureRoleAndPermissionTables();

      // Seed DEFAULT_ROLES into roles table ONLY if the role does not exist at all
      for (const defaultRole of DEFAULT_ROLES) {
        const roleIdUpper = defaultRole.role_name.toUpperCase().replace(/\s+/g, '_');
        const roleNameDisplay = defaultRole.role_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const existing = await this.db.query(
          `SELECT id FROM roles WHERE UPPER(role_id) = UPPER($1) LIMIT 1`,
          [roleIdUpper],
        ).catch(() => []);

        if (!existing || existing.length === 0) {
          // Step 1: Store role in master roles table FIRST
          await this.db.query(`
            INSERT INTO roles (id, sno, role_id, name, description, is_system_role, is_active, created_at, updated_at)
            VALUES (COALESCE((SELECT MAX(id)+1 FROM roles), 1), '1', $1, $2, $3, 1, 1, NOW(), NOW())
            ON CONFLICT (role_id) DO NOTHING
          `, [roleIdUpper, roleNameDisplay, defaultRole.description]).catch(() => {});

          // Step 2: Store permissions in role_permissions table
          for (const permKey of defaultRole.permissions) {
            const moduleName = permKey.split('.')[0] || 'general';
            await this.db.query(`
              INSERT INTO role_permissions (role_id, permission_key, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
              VALUES ($1, $2, $3, TRUE, TRUE, TRUE, FALSE, NOW(), NOW())
              ON CONFLICT (role_id, permission_key) DO NOTHING
            `, [roleIdUpper, permKey, moduleName]).catch(() => {});
          }

          // Maintain admin_roles as well
          await this.db.query(`
            INSERT INTO admin_roles (role_name, description, permissions, is_active)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (role_name) DO NOTHING
          `, [defaultRole.role_name, defaultRole.description, JSON.stringify(defaultRole.permissions), defaultRole.is_active]).catch(() => {});
        }
      }

      // Fetch from roles + role_permissions
      const rolesWithPerms = await this.db.query(`
        SELECT 
          r.id,
          r.role_id,
          r.name AS role_name_display,
          r.description,
          r.is_active,
          r.is_system_role,
          r.created_at,
          r.updated_at,
          COALESCE(
            (
              SELECT json_agg(rp.permission_key)
              FROM role_permissions rp
              WHERE UPPER(rp.role_id) = UPPER(r.role_id)
            ),
            '[]'::json
          ) AS permissions
        FROM roles r
        WHERE r.deleted_at IS NULL
        ORDER BY r.id ASC
      `, []);

      // Format response with role_name matching frontend contracts
      const formatted = rolesWithPerms.map((row: any) => ({
        id: row.id,
        role_name: row.role_id,
        name: row.role_name_display || row.role_id,
        description: row.description,
        permissions: Array.isArray(row.permissions) ? row.permissions : (typeof row.permissions === 'string' ? JSON.parse(row.permissions || '[]') : []),
        is_active: row.is_active === 1 || row.is_active === true,
        is_system_role: row.is_system_role === 1 || row.is_system_role === true,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      return { status: true, data: formatted, message: 'Roles fetched successfully' };
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
      await this.ensureRoleAndPermissionTables();

      const rawRoleName = body.role_name.trim();
      const roleId = rawRoleName.toUpperCase().replace(/\s+/g, '_');
      const roleNameDisplay = rawRoleName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const description = body.description?.trim() || null;
      const isActive = body.is_active !== false && String(body.is_active) !== 'false';
      const permissions: string[] = Array.isArray(body.permissions) ? body.permissions : [];

      // Step 1: FIRST store role in master roles table
      let insertedRole: any = null;
      try {
        const rows = await this.db.query(`
          INSERT INTO roles (id, sno, role_id, name, description, is_system_role, is_active, created_at, updated_at)
          VALUES (COALESCE((SELECT MAX(id)+1 FROM roles), 10), '10', $1, $2, $3, 0, $4, NOW(), NOW())
          ON CONFLICT (role_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
          RETURNING *
        `, [roleId, roleNameDisplay, description, isActive ? 1 : 0]);
        insertedRole = rows?.[0];
      } catch {
        const existing = await this.db.query(`SELECT * FROM roles WHERE UPPER(role_id) = $1 LIMIT 1`, [roleId]);
        insertedRole = existing?.[0];
      }

      // Step 2: Store permissions in role_permissions table
      await this.db.query(`DELETE FROM role_permissions WHERE UPPER(role_id) = $1`, [roleId]);
      for (const permKey of permissions) {
        const moduleName = permKey.split('.')[0] || 'general';
        await this.db.query(`
          INSERT INTO role_permissions (role_id, permission_key, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
          VALUES ($1, $2, $3, TRUE, TRUE, TRUE, FALSE, NOW(), NOW())
          ON CONFLICT (role_id, permission_key) DO NOTHING
        `, [roleId, permKey, moduleName]).catch(() => {});
      }

      // Also sync admin_roles table
      await this.db.query(`
        INSERT INTO admin_roles (role_name, description, permissions, is_active)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (role_name) DO UPDATE SET
          description = EXCLUDED.description,
          permissions = EXCLUDED.permissions,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `, [roleId.toLowerCase(), description, JSON.stringify(permissions), isActive]);

      return {
        status: true,
        data: {
          id: insertedRole?.id || Date.now(),
          role_name: roleId,
          name: roleNameDisplay,
          description,
          permissions,
          is_active: isActive,
        },
        message: 'Role and permissions stored successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('createRole error', { error });
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  async updateRole(idOrRoleId: string, body: any) {
    try {
      await this.ensureRoleAndPermissionTables();

      // Find current role
      const isNumeric = /^\d+$/.test(idOrRoleId);
      const roleRows = await this.db.query(
        isNumeric
          ? `SELECT * FROM roles WHERE id = $1 LIMIT 1`
          : `SELECT * FROM roles WHERE UPPER(role_id) = UPPER($1) LIMIT 1`,
        [idOrRoleId],
      );

      const current = roleRows?.[0];
      const roleId = current?.role_id || idOrRoleId;

      // Update master roles table FIRST
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [roleId];

      if (body.role_name || body.name) {
        const nameVal = (body.name || body.role_name).trim();
        params.push(nameVal);
        updates.push(`name = $${params.length}`);
      }
      if (body.description !== undefined) {
        params.push(body.description?.trim() || null);
        updates.push(`description = $${params.length}`);
      }
      if (body.is_active !== undefined) {
        const activeNum = (body.is_active === true || String(body.is_active) === 'true' || body.is_active === 1) ? 1 : 0;
        params.push(activeNum);
        updates.push(`is_active = $${params.length}`);
      }

      await this.db.query(
        `UPDATE roles SET ${updates.join(', ')} WHERE UPPER(role_id) = UPPER($1)`,
        params,
      );

      // Update role_permissions table
      if (body.permissions && Array.isArray(body.permissions)) {
        await this.db.query(`DELETE FROM role_permissions WHERE UPPER(role_id) = UPPER($1)`, [roleId]);
        for (const permKey of body.permissions) {
          const moduleName = permKey.split('.')[0] || 'general';
          await this.db.query(`
            INSERT INTO role_permissions (role_id, permission_key, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
            VALUES ($1, $2, $3, TRUE, TRUE, TRUE, FALSE, NOW(), NOW())
            ON CONFLICT (role_id, permission_key) DO NOTHING
          `, [roleId, permKey, moduleName]).catch(() => {});
        }
      }

      // Sync admin_roles
      const adminRoleUpdates: string[] = ['updated_at = NOW()'];
      const adminRoleParams: any[] = [roleId.toLowerCase()];
      if (body.description !== undefined) {
        adminRoleParams.push(body.description?.trim() || null);
        adminRoleUpdates.push(`description = $${adminRoleParams.length}`);
      }
      if (body.permissions) {
        adminRoleParams.push(JSON.stringify(body.permissions));
        adminRoleUpdates.push(`permissions = $${adminRoleParams.length}`);
      }
      if (body.is_active !== undefined) {
        adminRoleParams.push(body.is_active === true || String(body.is_active) === 'true');
        adminRoleUpdates.push(`is_active = $${adminRoleParams.length}`);
      }
      await this.db.query(
        `UPDATE admin_roles SET ${adminRoleUpdates.join(', ')} WHERE LOWER(role_name) = $1`,
        adminRoleParams,
      ).catch(() => {});

      return { status: true, message: 'Role and permissions updated successfully' };
    } catch (error) {
      this.developer.error('updateRole error', { error });
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  async deleteRole(idOrRoleId: string) {
    try {
      await this.ensureRoleAndPermissionTables();
      const isNumeric = /^\d+$/.test(idOrRoleId);

      let roleId = idOrRoleId;
      if (isNumeric) {
        const rows = await this.db.query(`SELECT role_id FROM roles WHERE id = $1 LIMIT 1`, [idOrRoleId]);
        if (rows?.[0]?.role_id) roleId = rows[0].role_id;
      }

      // 1. Delete permissions first
      await this.db.query(`DELETE FROM role_permissions WHERE UPPER(role_id) = UPPER($1)`, [roleId]);
      // 2. Delete from admin_roles
      await this.db.query(`DELETE FROM admin_roles WHERE LOWER(role_name) = LOWER($1) OR id::text = $2`, [roleId, idOrRoleId]).catch(() => {});
      // 3. Mark deleted / remove from master roles table
      await this.db.query(`UPDATE roles SET deleted_at = NOW(), is_active = 0 WHERE UPPER(role_id) = UPPER($1) OR id::text = $2`, [roleId, idOrRoleId]);

      return { status: true, message: 'Role and permissions deleted successfully' };
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
