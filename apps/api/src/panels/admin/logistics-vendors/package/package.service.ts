import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  FieldDef,
  FormHelper,
  FormResponse,
} from '../../../../helpers/FormHelper';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

type TableColumn = {
  data: string;
  name: string;
  title: string;
  orderable: boolean;
  searchable: boolean;
  visible: boolean;
  width: string;
  className: string;
  isDate: boolean;
  renderHtml: boolean;
};

const TRANSACTION_TYPES = ['issue', 'return', 'damaged', 'lost', 'adjustment'];
const REFERENCE_TYPES = ['subscription', 'order', 'trial', 'manual'];

function makePackagingTypeId() {
  return `PKG_${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`.slice(0, 30);
}

@Injectable()
export class PackageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly formHelper: FormHelper,
    private readonly developer: DeveloperService,
  ) { }

  async dashboard(query: any) {
    try {
      const days = Number(query.days || 30);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - Math.max(1, Math.min(days, 365)));
      const from = fromDate.toISOString().slice(0, 10);

      const [summary] = await this.db.query(
        `
        SELECT
          COALESCE(SUM(issued_quantity), 0)::int AS issued_quantity,
          COALESCE(SUM(returned_quantity), 0)::int AS returned_quantity,
          COALESCE(SUM(damaged_quantity), 0)::int AS damaged_quantity,
          COALESCE(SUM(lost_quantity), 0)::int AS lost_quantity,
          COALESCE(SUM(balance_quantity), 0)::int AS balance_quantity,
          COUNT(*)::int AS customer_package_rows
        FROM customer_container_balances
        WHERE deleted_at IS NULL
        `,
      );

      const packaging = await this.db.query(
        `
        SELECT
          c.container_id AS id,
          c.name,
          COALESCE(SUM(ccb.balance_quantity), 0)::int AS balance_quantity,
          COALESCE(SUM(ccb.damaged_quantity), 0)::int AS damaged_quantity,
          COALESCE(SUM(ccb.lost_quantity), 0)::int AS lost_quantity
        FROM containers c
        LEFT JOIN customer_container_balances ccb
          ON ccb.container_id = c.container_id AND ccb.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.container_id, c.id, c.name
        ORDER BY c.name ASC
        `,
      );

      return {
        status: true,
        data: {
          summary,
          packaging,
          from_date: from,
        },
      };
    } catch (error) {
      this.developer.error('Package dashboard error', { error });
      throw new InternalServerErrorException('Failed to load package dashboard');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /admin/package/pending
  // Returns customers who currently have returnable containers with them.
  // Simple: balance_quantity = issued - returned - damaged - lost > 0
  // ──────────────────────────────────────────────────────────────────────────
  async getPendingReturns(query: any) {
    try {
      const search = String(query.search || '').trim();
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
      const offset = (page - 1) * limit;

      const params: any[] = [];
      let searchClause = '';
      if (search) {
        params.push(`%${search}%`);
        searchClause = `AND (
          CAST(c.customer_id AS TEXT) ILIKE $${params.length}
          OR COALESCE(c.full_name, CONCAT(c.first_name, ' ', c.last_name)) ILIKE $${params.length}
          OR c.phone ILIKE $${params.length}
          OR cnt.name ILIKE $${params.length}
          OR cnt.container_id ILIKE $${params.length}
        )`;
      }

      const sql = `
        SELECT
          ccb.customer_id,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            NULLIF(TRIM(u.user_name), ''),
            NULLIF(TRIM(c.full_name), ''),
            NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''),
            NULLIF(TRIM(latest_ord.customer_name), ''),
            CONCAT('Customer #', ccb.customer_id)
          ) AS customer_name,
          COALESCE(
            NULLIF(TRIM(u.phone), ''),
            NULLIF(TRIM(c.phone), ''),
            'N/A'
          ) AS phone,
          ccb.container_id AS container_type_id,
          COALESCE(cnt.name, ccb.container_id) AS container_name,
          '1' AS capacity,
          'PCS' AS unit,
          ccb.issued_quantity,
          ccb.returned_quantity,
          ccb.damaged_quantity,
          ccb.lost_quantity,
          COALESCE(ccb.balance_quantity, (ccb.issued_quantity - ccb.returned_quantity - ccb.damaged_quantity - ccb.lost_quantity)) AS pending_count,
          ccb.updated_at,
          latest_ord.order_id AS latest_order_id,
          latest_ord.delivery_partner_name,
          latest_ord.delivery_partner_phone,
          latest_ord.delivered_at AS latest_delivery_date
        FROM customer_container_balances ccb
        LEFT JOIN users u ON u.user_id = ccb.customer_id
        LEFT JOIN customers c ON (c.customer_id = ccb.customer_id OR c.id::text = ccb.customer_id)
        LEFT JOIN containers cnt ON cnt.container_id = ccb.container_id AND cnt.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT 
            o.order_id,
            o.customer_name,
            dp.full_name AS delivery_partner_name,
            dp.phone AS delivery_partner_phone,
            COALESCE(o.updated_at, o.created_at) AS delivered_at
          FROM orders o
          LEFT JOIN delivery_partners dp ON (dp.delivery_partner_id = o.delivery_partner_id OR dp.id::text = o.delivery_partner_id)
          WHERE o.customer_id = ccb.customer_id OR o.customer_id = c.customer_id
          ORDER BY o.created_at DESC
          LIMIT 1
        ) latest_ord ON true
        WHERE ccb.deleted_at IS NULL
          ${searchClause}
        ORDER BY ccb.updated_at DESC
      `;

      const countSql = `SELECT COUNT(*) AS total FROM (${sql}) sub`;

      const [countRes, rows] = await Promise.all([
        this.db.query(countSql, params),
        this.db.query(`${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
          ...params, limit, offset,
        ]),
      ]);

      const total = parseInt(countRes[0]?.total || '0', 10);

      return {
        status: true,
        data: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.developer.error('getPendingReturns error', { error });
      throw new InternalServerErrorException('Failed to load pending returns');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /admin/package/adjust
  // Admin manually marks containers as returned, lost, or damaged for a customer.
  // Body: { customer_id, container_type_id, action: 'returned'|'lost'|'damaged', quantity, notes }
  // ──────────────────────────────────────────────────────────────────────────
  async adjustContainers(
    body: {
      customer_id: string;
      container_type_id: string;
      action: 'returned' | 'lost' | 'damaged';
      quantity: number;
      notes?: string;
    },
    adminId: string,
  ) {
    try {
      const { customer_id, container_type_id, action } = body;
      const qty = Math.max(1, Math.round(Number(body.quantity) || 0));

      if (!customer_id) throw new BadRequestException('customer_id is required');
      if (!container_type_id) throw new BadRequestException('container_type_id is required');
      if (!['returned', 'lost', 'damaged'].includes(action)) {
        throw new BadRequestException('action must be returned, lost, or damaged');
      }
      if (!qty) throw new BadRequestException('quantity must be at least 1');

      await this.db.transaction(async (client) => {
        const col =
          action === 'returned' ? 'returned_quantity' :
            action === 'damaged' ? 'damaged_quantity' :
              'lost_quantity';

        // (customer_id, container_id) is unique, so this upserts atomically.
        // `balance_quantity` is a generated column and is never written directly.
        await client.query(
          `INSERT INTO customer_container_balances (
            customer_id, container_id, issued_quantity, returned_quantity,
            damaged_quantity, lost_quantity, updated_at
          ) VALUES ($1, $2, 0, $3, $4, $5, NOW())
          ON CONFLICT (customer_id, container_id) DO UPDATE SET
            ${col} = customer_container_balances.${col} + EXCLUDED.${col},
            updated_at = NOW()`,
          [
            customer_id,
            container_type_id,
            action === 'returned' ? qty : 0,
            action === 'damaged' ? qty : 0,
            action === 'lost' ? qty : 0,
          ],
        );
      });

      return {
        status: true,
        message: `${qty} container(s) marked as ${action} for customer ${customer_id}`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('adjustContainers error', { error });
      throw new InternalServerErrorException('Failed to adjust containers');
    }
  }

  async customerBalancesTable(query: any) {
    const columns = {
      id: 'ccb.id',
      customer_id: 'ccb.customer_id',
      packaging_type: 'COALESCE(cnt.name, ccb.container_id)',
      issued_quantity: 'ccb.issued_quantity',
      returned_quantity: 'ccb.returned_quantity',
      damaged_quantity: 'ccb.damaged_quantity',
      lost_quantity: 'ccb.lost_quantity',
      balance_quantity: 'ccb.balance_quantity',
      updated_at: 'ccb.updated_at',
    };

    return this.tableResponse({
      query,
      columns,
      fromSql: `
        FROM customer_container_balances ccb
        LEFT JOIN containers cnt ON cnt.container_id = ccb.container_id
      `,
      selectSql: `
        SELECT
          ccb.id,
          ccb.customer_id,
          COALESCE(cnt.name, ccb.container_id) AS packaging_type,
          ccb.issued_quantity,
          ccb.returned_quantity,
          ccb.damaged_quantity,
          ccb.lost_quantity,
          ccb.balance_quantity,
          ccb.updated_at::text AS updated_at
      `,
      searchable: ['ccb.customer_id', 'cnt.name'],
      defaultSort: 'ccb.updated_at DESC',
      actionTypes: false,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /admin/package/recollections
  // Returns warehouse container recollection records with partner & run details
  // ──────────────────────────────────────────────────────────────────────────
  async getRecollections(query: any) {
    try {
      const warehouseId = query.warehouse_id ? String(query.warehouse_id).trim() : '';
      const status = query.status ? String(query.status).trim() : 'all';
      const search = query.search ? String(query.search).trim() : '';
      const date = query.date ? String(query.date).trim() : '';
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
      const offset = (page - 1) * limit;

      const whereClauses: string[] = ['dcr.deleted_at IS NULL'];
      const params: any[] = [];

      if (warehouseId && warehouseId !== 'all') {
        params.push(warehouseId);
        whereClauses.push(`(dcr.warehouse_id = $${params.length} OR w.warehouse_id = $${params.length})`);
      }

      if (status && status !== 'all') {
        params.push(status);
        whereClauses.push(`dcr.status = $${params.length}`);
      }

      if (date) {
        params.push(date);
        whereClauses.push(`(dcr.created_at::date = $${params.length}::date OR dr.run_date = $${params.length}::date)`);
      }

      if (search) {
        params.push(`%${search}%`);
        const pIdx = params.length;
        whereClauses.push(`(
          dcr.run_id ILIKE $${pIdx}
          OR cnt.name ILIKE $${pIdx}
          OR dcr.container_id ILIKE $${pIdx}
          OR u.first_name ILIKE $${pIdx}
          OR u.last_name ILIKE $${pIdx}
          OR dp.full_name ILIKE $${pIdx}
          OR w.name ILIKE $${pIdx}
        )`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const baseFromSql = `
        FROM delivery_container_reconciliation dcr
        LEFT JOIN containers cnt ON cnt.container_id = dcr.container_id AND cnt.deleted_at IS NULL
        LEFT JOIN warehouses w ON (w.warehouse_id = dcr.warehouse_id OR w.id::varchar = dcr.warehouse_id) AND w.deleted_at IS NULL
        LEFT JOIN delivery_runs dr ON (dr.run_id = dcr.run_id OR dr.id::varchar = dcr.run_id)
        LEFT JOIN delivery_partners dp ON (dp.delivery_partner_id = dr.delivery_partner_id OR dp.delivery_partner_id = dcr.submitted_by OR dp.id::varchar = dr.delivery_partner_id)
        LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
        LEFT JOIN users ru ON ru.user_id = dcr.review_by
        ${whereSql}
      `;

      const selectSql = `
        SELECT
          dcr.id,
          dcr.warehouse_id,
          COALESCE(w.name, 'Main Warehouse') AS warehouse_name,
          dcr.run_id,
          dr.run_date,
          dr.delivery_slot,
          COALESCE(dr.delivery_partner_id, dcr.submitted_by) AS delivery_partner_id,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            NULLIF(TRIM(dp.full_name), ''),
            'Delivery Partner'
          ) AS delivery_partner_name,
          COALESCE(NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(dp.phone), ''), 'N/A') AS delivery_partner_phone,
          dcr.container_id,
          COALESCE(cnt.name, dcr.container_id) AS container_name,
          COALESCE(dcr.collected_quantity, 0) AS collected_quantity,
          COALESCE(dcr.submitted_quantity, 0) AS submitted_quantity,
          COALESCE(dcr.damaged_quantity, 0) AS damaged_quantity,
          COALESCE(dcr.lost_quantity, 0) AS lost_quantity,
          COALESCE(dcr.discrepancy_quantity, 0) AS discrepancy_quantity,
          dcr.status,
          dcr.review_by,
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ru.first_name, ru.last_name)), ''), dcr.review_by) AS reviewer_name,
          dcr.reviewed_at,
          dcr.collection_notes,
          dcr.submission_notes,
          dcr.created_at,
          dcr.updated_at
        ${baseFromSql}
        ORDER BY dcr.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countSql = `SELECT COUNT(*)::int AS total ${baseFromSql}`;

      const [countRes, rows] = await Promise.all([
        this.db.query(countSql, params),
        this.db.query(selectSql, [...params, limit, offset]),
      ]);

      const total = parseInt(countRes[0]?.total || '0', 10);

      // Summary metrics for KPI tiles
      const [summaryRes] = await this.db.query(
        `
        SELECT
          COUNT(*)::int AS total_records,
          COALESCE(SUM(CASE WHEN dcr.status = 'submitted' OR dcr.status = 'pending' THEN 1 ELSE 0 END), 0)::int AS pending_verification,
          COALESCE(SUM(CASE WHEN dcr.status = 'closed' THEN 1 ELSE 0 END), 0)::int AS closed_count,
          COALESCE(SUM(CASE WHEN dcr.status = 'discrepancy' THEN 1 ELSE 0 END), 0)::int AS discrepancy_count,
          COALESCE(SUM(dcr.collected_quantity), 0)::int AS total_collected_units,
          COALESCE(SUM(dcr.submitted_quantity), 0)::int AS total_accepted_units,
          COALESCE(SUM(dcr.damaged_quantity), 0)::int AS total_damaged_units,
          COALESCE(SUM(dcr.lost_quantity), 0)::int AS total_lost_units
        FROM delivery_container_reconciliation dcr
        WHERE dcr.deleted_at IS NULL
        ${warehouseId && warehouseId !== 'all' ? `AND dcr.warehouse_id = '${warehouseId}'` : ''}
        `,
      );

      return {
        status: true,
        data: rows,
        total,
        summary: summaryRes || {
          total_records: 0,
          pending_verification: 0,
          closed_count: 0,
          discrepancy_count: 0,
          total_collected_units: 0,
          total_accepted_units: 0,
          total_damaged_units: 0,
          total_lost_units: 0,
        },
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.developer.error('getRecollections error', { error });
      throw new InternalServerErrorException('Failed to load container recollections');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /admin/package/recollections/verify
  // Reviewer accepts & verifies submitted containers at warehouse
  // ──────────────────────────────────────────────────────────────────────────
  async verifyRecollection(
    body: {
      id: number | string;
      submitted_quantity: number;
      damaged_quantity?: number;
      lost_quantity?: number;
      notes?: string;
    },
    adminId: string,
  ) {
    try {
      const recId = body.id;
      if (!recId) throw new BadRequestException('Recollection ID is required');

      const submittedQty = Math.max(0, Number(body.submitted_quantity) || 0);
      const damagedQty = Math.max(0, Number(body.damaged_quantity) || 0);
      const lostQty = Math.max(0, Number(body.lost_quantity) || 0);
      const notes = body.notes ? String(body.notes).trim() : null;

      let resultRecord: any = null;

      await this.db.transaction(async (client) => {
        const checkRes = await client.query(
          `SELECT * FROM delivery_container_reconciliation WHERE id = $1 AND deleted_at IS NULL`,
          [recId],
        );
        const existing = checkRes.rows[0];

        if (!existing) {
          throw new BadRequestException('Container recollection record not found');
        }

        const collectedQty = Number(existing.collected_quantity || 0);
        const discrepancyQty = collectedQty - (submittedQty + damagedQty + lostQty);
        const newStatus = discrepancyQty !== 0 ? 'discrepancy' : 'closed';

        const updateRes = await client.query(
          `UPDATE delivery_container_reconciliation
           SET submitted_quantity = $1,
               damaged_quantity = $2,
               lost_quantity = $3,
               status = $4,
               review_by = $5,
               reviewed_at = NOW(),
               submission_notes = COALESCE($6, submission_notes),
               updated_at = NOW()
           WHERE id = $7
           RETURNING *`,
          [
            submittedQty,
            damagedQty,
            lostQty,
            newStatus,
            adminId,
            notes,
            recId,
          ],
        );

        resultRecord = updateRes.rows[0];

        // Restock warehouse container inventory with good accepted units
        if (submittedQty > 0 && existing.container_id) {
          await client.query(
            `UPDATE containers
             SET quantity = quantity + $1,
                 updated_at = NOW()
             WHERE container_id = $2 AND deleted_at IS NULL`,
            [submittedQty, existing.container_id],
          );
        }
      });

      return {
        status: true,
        message: 'Container recollection verified and warehouse stock updated successfully',
        data: resultRecord,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('verifyRecollection error', { error });
      throw new InternalServerErrorException('Failed to verify container recollection');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /admin/package/recollections/direct
  // Direct warehouse intake of returnable containers (from partner/customer/branch)
  // ──────────────────────────────────────────────────────────────────────────
  async directRecollection(
    body: {
      warehouse_id: string;
      container_id: string;
      delivery_partner_id?: string;
      run_id?: string;
      customer_id?: string;
      quantity: number;
      damaged_quantity?: number;
      lost_quantity?: number;
      notes?: string;
    },
    adminId: string,
  ) {
    try {
      const warehouseId = String(body.warehouse_id || '').trim();
      const containerId = String(body.container_id || '').trim();
      const qty = Math.max(1, Number(body.quantity) || 0);
      const damagedQty = Math.max(0, Number(body.damaged_quantity) || 0);
      const lostQty = Math.max(0, Number(body.lost_quantity) || 0);
      const runId = body.run_id ? String(body.run_id).trim() : `INTAKE-${Date.now().toString(36).toUpperCase()}`;
      const partnerId = body.delivery_partner_id ? String(body.delivery_partner_id).trim() : null;
      const customerId = body.customer_id ? String(body.customer_id).trim() : null;
      const notes = body.notes ? String(body.notes).trim() : 'Direct warehouse container recollection';

      if (!containerId) throw new BadRequestException('Container ID is required');

      let insertedId: any = null;

      await this.db.transaction(async (client) => {
        // 1. Create reconciliation entry
        const res = await client.query(
          `INSERT INTO delivery_container_reconciliation (
            warehouse_id, run_id, container_id,
            collected_quantity, submitted_quantity,
            damaged_quantity, lost_quantity,
            status, review_by, reviewed_at,
            collection_notes, submission_notes,
            created_by, submitted_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3,
            $4, $4,
            $5, $6,
            'closed', $7, NOW(),
            $8, $8,
            $7, $9, NOW(), NOW()
          ) RETURNING id`,
          [
            warehouseId || null,
            runId,
            containerId,
            qty,
            damagedQty,
            lostQty,
            adminId,
            notes,
            partnerId || adminId,
          ],
        );
        insertedId = res.rows[0]?.id;

        // 2. If customer_id was specified, adjust customer balance
        if (customerId) {
          await client.query(
            `INSERT INTO customer_container_balances (
              customer_id, container_id, issued_quantity, returned_quantity,
              damaged_quantity, lost_quantity, updated_at
            ) VALUES ($1, $2, 0, $3, $4, $5, NOW())
            ON CONFLICT (customer_id, container_id) DO UPDATE SET
              returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
              damaged_quantity = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
              lost_quantity = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
              updated_at = NOW()`,
            [customerId, containerId, qty, damagedQty, lostQty],
          );
        }

        // 3. Restock container inventory
        await client.query(
          `UPDATE containers
           SET quantity = quantity + $1,
               updated_at = NOW()
           WHERE container_id = $2 AND deleted_at IS NULL`,
          [qty, containerId],
        );
      });

      return {
        status: true,
        message: `Successfully recollected and restocked ${qty} container(s) at warehouse`,
        data: { id: insertedId },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('directRecollection error', { error });
      throw new InternalServerErrorException('Failed to record direct container recollection');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /admin/package/runs-pending
  // Fetch active/recent runs with delivery partner details for recollection intake
  // ──────────────────────────────────────────────────────────────────────────
  async getPendingRunsForRecollection(query: any) {
    try {
      const warehouseId = query.warehouse_id ? String(query.warehouse_id).trim() : '';
      const date = query.date ? String(query.date).trim() : new Date().toISOString().slice(0, 10);

      const params: any[] = [date];
      let whClause = '';
      if (warehouseId && warehouseId !== 'all') {
        params.push(warehouseId);
        whClause = `AND (w.warehouse_id = $${params.length} OR dr.branch_id = $${params.length})`;
      }

      const rows = await this.db.query(
        `
        SELECT
          dr.run_id,
          dr.run_id AS run_number,
          dr.run_date,
          dr.delivery_slot,
          dr.status AS run_status,
          dr.delivery_partner_id,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            NULLIF(TRIM(dp.full_name), ''),
            'Delivery Partner'
          ) AS delivery_partner_name,
          COALESCE(NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(dp.phone), ''), 'N/A') AS delivery_partner_phone,
          COALESCE(w.warehouse_id, (SELECT warehouse_id FROM warehouses WHERE is_active = true AND deleted_at IS NULL LIMIT 1)) AS warehouse_id,
          COALESCE(w.name, b.branch_name, 'Main Warehouse') AS warehouse_name
        FROM delivery_runs dr
        LEFT JOIN delivery_partners dp ON (dp.delivery_partner_id = dr.delivery_partner_id OR dp.id::varchar = dr.delivery_partner_id)
        LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
        LEFT JOIN warehouses w ON (w.branch_id = dr.branch_id AND w.is_active = true AND w.deleted_at IS NULL)
        LEFT JOIN branches b ON (b.branch_id = dr.branch_id OR b.id::varchar = dr.branch_id)
        WHERE dr.deleted_at IS NULL
          AND dr.run_date >= ($1::date - INTERVAL '7 days')
          ${whClause}
        ORDER BY dr.run_date DESC, dr.created_at DESC
        LIMIT 50
        `,
        params,
      );

      return {
        status: true,
        data: rows,
      };
    } catch (error) {
      this.developer.error('getPendingRunsForRecollection error', { error });
      throw new InternalServerErrorException('Failed to load pending delivery runs');
    }
  }

  private async tableResponse(config: {
    query: any;
    columns: Record<string, string>;
    fromSql: string;
    selectSql: string;
    searchable: string[];
    defaultSort: string;
    actionTypes: boolean;
  }) {
    const page = Math.max(1, Number(config.query.page || 1));
    const limit = Math.max(1, Math.min(Number(config.query.limit || 10), 100));
    const offset = (page - 1) * limit;
    const bindings: any[] = [];
    const where = this.buildSearchWhere(
      config.query.search,
      config.searchable,
      bindings,
      config.fromSql.includes('WHERE'),
    );
    const sort = this.resolveSort(
      config.query.sortBy,
      config.query.sortDir,
      config.columns,
      config.defaultSort,
    );

    const totalRows = await this.db.query(
      `SELECT COUNT(*)::int AS count ${config.fromSql}`,
    );
    const filteredRows = await this.db.query(
      `SELECT COUNT(*)::int AS count ${config.fromSql}${where}`,
      bindings,
    );
    const data = await this.db.query(
      `
      ${config.selectSql}
      ${config.fromSql}
      ${where}
      ORDER BY ${sort}
      LIMIT $${bindings.length + 1}
      OFFSET $${bindings.length + 2}
      `,
      [...bindings, limit, offset],
    );

    return {
      status: true,
      draw: Number(config.query.draw || 1),
      data,
      columns: this.columnsMeta(Object.keys(config.columns), config.actionTypes),
      recordsTotal: totalRows[0]?.count ?? 0,
      recordsFiltered: filteredRows[0]?.count ?? 0,
      message: 'Table data fetched',
    };
  }

  private buildSearchWhere(
    search: string | undefined,
    searchable: string[],
    bindings: any[],
    hasWhere: boolean,
  ) {
    const clean = String(search || '').trim();
    if (!clean) return '';

    bindings.push(`%${clean}%`);
    const param = `$${bindings.length}`;
    const clause = searchable
      .map((column) => `CAST(${column} AS TEXT) ILIKE ${param}`)
      .join(' OR ');

    return `${hasWhere ? ' AND' : ' WHERE'} (${clause})`;
  }

  private resolveSort(
    sortBy: string,
    sortDir: string,
    columns: Record<string, string>,
    defaultSort: string,
  ) {
    const column = columns[sortBy];
    if (!column) return defaultSort;
    const direction = String(sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return `${column} ${direction}`;
  }

  private columnsMeta(keys: string[], actionTypes: boolean): TableColumn[] {
    const columns = keys.map((key) => ({
      data: key,
      name: key,
      title: this.title(key),
      orderable: true,
      searchable: true,
      visible: key !== 'id',
      width: 'auto',
      className: '',
      isDate: key.includes('date') || key.includes('_at'),
      renderHtml: false,
    }));

    if (actionTypes) {
      columns.push({
        data: 'actions',
        name: 'actions',
        title: 'Actions',
        orderable: false,
        searchable: false,
        visible: true,
        width: '120px',
        className: 'skl-actions-cell',
        isDate: false,
        renderHtml: true,
      });
    }

    return columns;
  }

  private title(value: string) {
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
