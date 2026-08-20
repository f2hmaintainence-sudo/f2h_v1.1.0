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
  ) {}

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

        // No unique key covers (customer_id, container_id), so this is an
        // update-then-insert rather than an upsert. `balance_quantity` is a
        // generated column and is never written directly.
        const updated = await client.query(
          `UPDATE customer_container_balances
             SET ${col} = COALESCE(${col}, 0) + $3,
                 updated_at = NOW()
           WHERE customer_id = $1 AND container_id = $2 AND deleted_at IS NULL
           RETURNING id`,
          [customer_id, container_type_id, qty],
        );

        if (!updated?.rowCount) {
          await client.query(
            `INSERT INTO customer_container_balances (
              customer_id, container_id, issued_quantity, returned_quantity,
              damaged_quantity, lost_quantity, updated_at
            ) VALUES ($1, $2, 0, $3, $4, $5, NOW())`,
            [
              customer_id,
              container_type_id,
              action === 'returned' ? qty : 0,
              action === 'damaged' ? qty : 0,
              action === 'lost' ? qty : 0,
            ],
          );
        }
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
