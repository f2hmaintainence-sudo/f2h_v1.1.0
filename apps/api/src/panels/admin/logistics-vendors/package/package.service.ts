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

      const transactions = await this.db.query(
        `
        SELECT
          transaction_type,
          COALESCE(SUM(quantity), 0)::int AS quantity
        FROM container_transactions
        WHERE deleted_at IS NULL AND transaction_date >= $1::date
        GROUP BY transaction_type
        ORDER BY transaction_type
        `,
        [from],
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
          ON ccb.packaging_type_id = c.container_id AND ccb.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.container_id, c.name
        ORDER BY c.name ASC
        `,
      );

      const recent = await this.db.query(
        `
        SELECT
          ct.id,
          ct.customer_id,
          COALESCE(cnt.name, pt.name, ct.packaging_type_id) AS packaging_type,
          ct.transaction_type,
          ct.quantity,
          ct.transaction_date::text,
          ct.created_at::text
        FROM container_transactions ct
        LEFT JOIN packaging_types pt ON pt.id = ct.packaging_type_id AND pt.deleted_at IS NULL
        LEFT JOIN containers cnt ON cnt.container_id = ct.packaging_type_id AND cnt.deleted_at IS NULL
        WHERE ct.deleted_at IS NULL
        ORDER BY ct.created_at DESC
        LIMIT 8
        `,
      );

      return {
        status: true,
        data: {
          summary,
          transactions,
          packaging,
          recent,
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
          OR pt.name ILIKE $${params.length}
        )`;
      }

      const sql = `
        SELECT
          ccb.customer_id,
          COALESCE(c.full_name, CONCAT(c.first_name, ' ', c.last_name)) AS customer_name,
          c.phone,
          COALESCE(cnt.container_id, pt.id, ccb.packaging_type_id) AS container_type_id,
          COALESCE(cnt.name, pt.name, ccb.packaging_type_id) AS container_name,
          COALESCE(pt.capacity::text, '1') AS capacity,
          COALESCE(pt.unit, 'PCS') AS unit,
          ccb.issued_quantity,
          ccb.returned_quantity,
          ccb.damaged_quantity,
          ccb.lost_quantity,
          GREATEST(0, ccb.issued_quantity - ccb.returned_quantity - ccb.damaged_quantity - ccb.lost_quantity) AS pending_count,
          ccb.updated_at
        FROM customer_container_balances ccb
        JOIN customers c ON c.customer_id = ccb.customer_id
        LEFT JOIN packaging_types pt ON pt.id = ccb.packaging_type_id AND pt.deleted_at IS NULL
        LEFT JOIN containers cnt ON cnt.container_id = ccb.packaging_type_id AND cnt.deleted_at IS NULL
        WHERE ccb.deleted_at IS NULL
          AND GREATEST(0, ccb.issued_quantity - ccb.returned_quantity - ccb.damaged_quantity - ccb.lost_quantity) > 0
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
      const { customer_id, container_type_id, action, notes } = body;
      const qty = Math.max(1, Math.round(Number(body.quantity) || 0));

      if (!customer_id) throw new BadRequestException('customer_id is required');
      if (!container_type_id) throw new BadRequestException('container_type_id is required');
      if (!['returned', 'lost', 'damaged'].includes(action)) {
        throw new BadRequestException('action must be returned, lost, or damaged');
      }
      if (!qty) throw new BadRequestException('quantity must be at least 1');

      // Map action to transaction type
      const txType = action === 'returned' ? 'return' : action;

      await this.db.transaction(async (client) => {
        // Insert into ledger
        await client.query(
          `INSERT INTO container_transactions (
            customer_id, packaging_type_id, reference_type, reference_id,
            transaction_type, quantity, remarks, transaction_date, created_by
          ) VALUES ($1, $2, 'manual', 'admin-adjust', $3, $4, $5, CURRENT_DATE, $6)`,
          [customer_id, container_type_id, txType, qty, notes || `Admin adjustment: ${action}`, adminId],
        );

        // Update balance
        const col =
          action === 'returned' ? 'returned_quantity' :
          action === 'damaged' ? 'damaged_quantity' :
          'lost_quantity';

        await client.query(
          `INSERT INTO customer_container_balances (
            customer_id, packaging_type_id, issued_quantity, returned_quantity,
            damaged_quantity, lost_quantity, updated_at
          ) VALUES ($1, $2, 0, $3, $4, $5, NOW())
          ON CONFLICT (customer_id, packaging_type_id)
          DO UPDATE SET
            ${col} = customer_container_balances.${col} + $${action === 'returned' ? 3 : action === 'damaged' ? 4 : 5},
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

  async transactionsTable(query: any) {
    const columns = {
      id: 'ct.id',
      customer_id: 'ct.customer_id',
      packaging_type: 'COALESCE(cnt.name, pt.name, ct.packaging_type_id)',
      reference_type: 'ct.reference_type',
      reference_id: 'ct.reference_id',
      transaction_type: 'ct.transaction_type',
      quantity: 'ct.quantity',
      transaction_date: 'ct.transaction_date',
      created_by: 'ct.created_by',
      created_at: 'ct.created_at',
    };

    return this.tableResponse({
      query,
      columns,
      fromSql: `
        FROM container_transactions ct
        LEFT JOIN packaging_types pt ON pt.id = ct.packaging_type_id
        LEFT JOIN containers cnt ON cnt.container_id = ct.packaging_type_id
      `,
      selectSql: `
        SELECT
          ct.id,
          ct.customer_id,
          COALESCE(cnt.name, pt.name, ct.packaging_type_id) AS packaging_type,
          ct.packaging_type_id,
          ct.reference_type,
          ct.reference_id,
          ct.transaction_type,
          ct.quantity,
          ct.remarks,
          ct.transaction_date::text AS transaction_date,
          ct.created_by,
          ct.created_at::text AS created_at
      `,
      searchable: [
        'ct.customer_id',
        'cnt.name',
        'pt.name',
        'ct.reference_type',
        'ct.reference_id',
        'ct.transaction_type',
        'ct.remarks',
      ],
      defaultSort: 'ct.created_at DESC',
      actionTypes: true,
    });
  }

  async packagingTypesTable(query: any) {
    const columns = {
      id: 'pt.id',
      name: 'pt.name',
      capacity: 'pt.capacity',
      unit: 'pt.unit',
      is_returnable: 'pt.is_returnable',
      deposit_amount: 'pt.deposit_amount',
      status: 'pt.status',
      created_at: 'pt.created_at',
    };

    return this.tableResponse({
      query,
      columns,
      fromSql: 'FROM packaging_types pt',
      selectSql: `
        SELECT
          pt.id,
          pt.name,
          pt.capacity::text AS capacity,
          pt.unit,
          pt.is_returnable,
          pt.deposit_amount::text AS deposit_amount,
          pt.status,
          pt.created_at::text AS created_at
      `,
      searchable: ['pt.id', 'pt.name', 'pt.unit', 'pt.status'],
      defaultSort: 'pt.created_at DESC',
      actionTypes: true,
    });
  }

  async customerBalancesTable(query: any) {
    const columns = {
      id: 'ccb.id',
      customer_id: 'ccb.customer_id',
      packaging_type: 'COALESCE(cnt.name, pt.name, ccb.packaging_type_id)',
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
        LEFT JOIN packaging_types pt ON pt.id = ccb.packaging_type_id
        LEFT JOIN containers cnt ON cnt.container_id = ccb.packaging_type_id
      `,
      selectSql: `
        SELECT
          ccb.id,
          ccb.customer_id,
          COALESCE(cnt.name, pt.name, ccb.packaging_type_id) AS packaging_type,
          ccb.issued_quantity,
          ccb.returned_quantity,
          ccb.damaged_quantity,
          ccb.lost_quantity,
          ccb.balance_quantity,
          ccb.updated_at::text AS updated_at
      `,
      searchable: ['ccb.customer_id', 'cnt.name', 'pt.name'],
      defaultSort: 'ccb.updated_at DESC',
      actionTypes: false,
    });
  }

  async damageTable(query: any) {
    const columns = {
      id: 'ct.id',
      customer_id: 'ct.customer_id',
      packaging_type: 'COALESCE(cnt.name, pt.name, ct.packaging_type_id)',
      transaction_type: 'ct.transaction_type',
      quantity: 'ct.quantity',
      remarks: 'ct.remarks',
      transaction_date: 'ct.transaction_date',
      created_by: 'ct.created_by',
    };

    return this.tableResponse({
      query,
      columns,
      fromSql: `
        FROM container_transactions ct
        LEFT JOIN packaging_types pt ON pt.id = ct.packaging_type_id
        LEFT JOIN containers cnt ON cnt.container_id = ct.packaging_type_id
        WHERE ct.transaction_type IN ('damaged', 'lost')
      `,
      selectSql: `
        SELECT
          ct.id,
          ct.customer_id,
          COALESCE(cnt.name, pt.name, ct.packaging_type_id) AS packaging_type,
          ct.transaction_type,
          ct.quantity,
          ct.remarks,
          ct.transaction_date::text AS transaction_date,
          ct.created_by
      `,
      searchable: ['ct.customer_id', 'cnt.name', 'pt.name', 'ct.remarks'],
      defaultSort: 'ct.transaction_date DESC, ct.id DESC',
      actionTypes: false,
    });
  }

  async reconciliationTable(query: any) {
    const columns = {
      customer_id: 'issued.customer_id',
      packaging_type: 'pt.name',
      delivered_quantity: 'issued.delivered_quantity',
      transaction_issued: 'COALESCE(txn.transaction_issued, 0)',
      returned_quantity: 'COALESCE(bal.returned_quantity, 0)',
      damaged_quantity: 'COALESCE(bal.damaged_quantity, 0)',
      lost_quantity: 'COALESCE(bal.lost_quantity, 0)',
      balance_quantity: 'COALESCE(bal.balance_quantity, 0)',
      variance: '(issued.delivered_quantity - COALESCE(txn.transaction_issued, 0))',
    };

    return this.tableResponse({
      query,
      columns,
      fromSql: `
        FROM (
          SELECT
            customer_id,
            packaging_type_id,
            COALESCE(SUM(quantity), 0)::int AS delivered_quantity
          FROM delivery_container_lines
          GROUP BY customer_id, packaging_type_id
        ) issued
        JOIN packaging_types pt ON pt.id = issued.packaging_type_id
        LEFT JOIN (
          SELECT
            customer_id,
            packaging_type_id,
            COALESCE(SUM(quantity), 0)::int AS transaction_issued
          FROM container_transactions
          WHERE transaction_type = 'issue'
          GROUP BY customer_id, packaging_type_id
        ) txn
          ON txn.customer_id = issued.customer_id
         AND txn.packaging_type_id = issued.packaging_type_id
        LEFT JOIN customer_container_balances bal
          ON bal.customer_id = issued.customer_id
         AND bal.packaging_type_id = issued.packaging_type_id
      `,
      selectSql: `
        SELECT
          issued.customer_id,
          pt.name AS packaging_type,
          issued.delivered_quantity,
          COALESCE(txn.transaction_issued, 0)::int AS transaction_issued,
          COALESCE(bal.returned_quantity, 0)::int AS returned_quantity,
          COALESCE(bal.damaged_quantity, 0)::int AS damaged_quantity,
          COALESCE(bal.lost_quantity, 0)::int AS lost_quantity,
          COALESCE(bal.balance_quantity, 0)::int AS balance_quantity,
          (issued.delivered_quantity - COALESCE(txn.transaction_issued, 0))::int AS variance
      `,
      searchable: ['issued.customer_id', 'pt.name'],
      defaultSort: 'issued.customer_id ASC, pt.name ASC',
      actionTypes: false,
    });
  }

  async transactionView(id: string) {
    const [row] = await this.db.query(
      `
      SELECT
        ct.*,
        pt.name AS packaging_type
      FROM container_transactions ct
      JOIN packaging_types pt ON pt.id = ct.packaging_type_id
      WHERE ct.id = $1
      LIMIT 1
      `,
      [id],
    );

    return {
      status: true,
      data: row ?? null,
      message: row ? 'Transaction fetched' : 'Transaction not found',
    };
  }

  async packagingTypeView(id: string) {
    const [row] = await this.db.query(
      `
      SELECT
        id,
        name,
        capacity::text AS capacity,
        unit,
        is_returnable,
        deposit_amount::text AS deposit_amount,
        status,
        created_at::text AS created_at
      FROM packaging_types
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return {
      status: true,
      data: row ?? null,
      message: row ? 'Packaging type fetched' : 'Packaging type not found',
    };
  }

  async packagingTypeForm(id?: string): Promise<FormResponse> {
    const data = id ? await this.getPackagingType(id) : {};

    return this.formHelper.generateResponse({
      title: id ? 'Edit Packaging Type' : 'Add Packaging Type',
      submitLabel: id ? 'Update Packaging Type' : 'Save Packaging Type',
      fields: this.packagingTypeFields(),
      data,
      script: '',
    });
  }

  async savePackagingType(body: any, adminId: string) {
    try {
      const payload = this.normalizePackagingType(body);
      const id = body.id ? String(body.id).trim() : makePackagingTypeId();

      const [exists] = await this.db.query(
        `SELECT id FROM packaging_types WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (exists) throw new BadRequestException('Packaging type ID already exists');

      const [inserted] = await this.db.query(
        `
        INSERT INTO packaging_types (
          id,
          name,
          capacity,
          unit,
          is_returnable,
          deposit_amount,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        `,
        [
          id,
          payload.name,
          payload.capacity,
          payload.unit,
          payload.is_returnable,
          payload.deposit_amount,
          payload.status,
        ],
      );

      return {
        status: true,
        message: 'Packaging type saved successfully',
        data: { ...inserted, created_by: adminId },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('save packaging type error', { error });
      throw new InternalServerErrorException('Failed to save packaging type');
    }
  }

  async updatePackagingType(id: string, body: any, adminId: string) {
    try {
      const current = await this.getPackagingType(id);
      if (!current?.id) throw new BadRequestException('Packaging type not found');

      const payload = this.normalizePackagingType(body);

      await this.db.query(
        `
        UPDATE packaging_types
        SET
          name = $1,
          capacity = $2,
          unit = $3,
          is_returnable = $4,
          deposit_amount = $5,
          status = $6
        WHERE id = $7
        `,
        [
          payload.name,
          payload.capacity,
          payload.unit,
          payload.is_returnable,
          payload.deposit_amount,
          payload.status,
          id,
        ],
      );

      return {
        status: true,
        message: 'Packaging type updated successfully',
        data: { id, updated_by: adminId },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('update packaging type error', { error, id });
      throw new InternalServerErrorException('Failed to update packaging type');
    }
  }

  async transactionForm(id?: string): Promise<FormResponse> {
    const data = id ? await this.getTransaction(id) : {};

    return this.formHelper.generateResponse({
      title: id ? 'Edit Container Transaction' : 'Add Container Transaction',
      submitLabel: id ? 'Update Transaction' : 'Save Transaction',
      fields: await this.transactionFields(),
      data,
      script: '',
    });
  }

  async saveTransaction(body: any, adminId: string) {
    try {
      const payload = this.normalizeTransaction(body, adminId);
      await this.assertPackagingType(payload.packaging_type_id);

      const [inserted] = await this.db.query(
        `
        INSERT INTO container_transactions (
          customer_id,
          packaging_type_id,
          reference_type,
          reference_id,
          transaction_type,
          quantity,
          remarks,
          transaction_date,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        `,
        [
          payload.customer_id,
          payload.packaging_type_id,
          payload.reference_type,
          payload.reference_id,
          payload.transaction_type,
          payload.quantity,
          payload.remarks,
          payload.transaction_date,
          payload.created_by,
        ],
      );

      await this.applyBalance(payload);

      return {
        status: true,
        message: 'Container transaction saved successfully',
        data: inserted,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('save package transaction error', { error });
      throw new InternalServerErrorException('Failed to save transaction');
    }
  }

  async updateTransaction(id: string, body: any, adminId: string) {
    try {
      const oldRow = await this.getTransaction(id);
      if (!oldRow?.id) throw new BadRequestException('Transaction not found');

      const payload = this.normalizeTransaction(body, adminId);
      await this.assertPackagingType(payload.packaging_type_id);

      await this.applyBalance(oldRow, -1);

      await this.db.query(
        `
        UPDATE container_transactions
        SET
          customer_id = $1,
          packaging_type_id = $2,
          reference_type = $3,
          reference_id = $4,
          transaction_type = $5,
          quantity = $6,
          remarks = $7,
          transaction_date = $8,
          created_by = $9
        WHERE id = $10
        `,
        [
          payload.customer_id,
          payload.packaging_type_id,
          payload.reference_type,
          payload.reference_id,
          payload.transaction_type,
          payload.quantity,
          payload.remarks,
          payload.transaction_date,
          payload.created_by,
          id,
        ],
      );

      await this.applyBalance(payload);

      return {
        status: true,
        message: 'Container transaction updated successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('update package transaction error', { error, id });
      throw new InternalServerErrorException('Failed to update transaction');
    }
  }

  private async transactionFields(): Promise<FieldDef[]> {
    const packagingTypes = await this.db.query(
      `
      SELECT id, name
      FROM packaging_types
      WHERE COALESCE(status, 'active') = 'active'
      ORDER BY name ASC
      `,
    );

    return [
      {
        name: 'customer_id',
        label: 'Customer ID',
        type: 'text',
        required: true,
        width: 'half',
        validation: { maxLength: 30 },
      },
      {
        name: 'packaging_type_id',
        label: 'Packaging Type',
        type: 'select',
        required: true,
        width: 'half',
        options: packagingTypes.map((item: any) => ({
          value: item.id,
          label: item.name,
        })),
      },
      {
        name: 'transaction_type',
        label: 'Transaction Type',
        type: 'select',
        required: true,
        width: 'half',
        options: TRANSACTION_TYPES.map((value) => ({
          value,
          label: this.title(value),
        })),
      },
      {
        name: 'quantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        width: 'half',
        validation: { min: 1 },
      },
      {
        name: 'reference_type',
        label: 'Reference Type',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'manual',
        options: REFERENCE_TYPES.map((value) => ({
          value,
          label: this.title(value),
        })),
      },
      {
        name: 'reference_id',
        label: 'Reference ID',
        type: 'text',
        required: false,
        width: 'half',
        validation: { maxLength: 30 },
      },
      {
        name: 'transaction_date',
        label: 'Transaction Date',
        type: 'date',
        required: true,
        width: 'half',
        defaultValue: new Date().toISOString().slice(0, 10),
      },
      {
        name: 'remarks',
        label: 'Remarks',
        type: 'textarea',
        required: false,
        width: 'full',
        validation: { maxLength: 1000 },
      },
    ];
  }

  private packagingTypeFields(): FieldDef[] {
    return [
      {
        name: 'id',
        label: 'Packaging ID',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'Auto generated if blank',
        validation: { maxLength: 30 },
      },
      {
        name: 'name',
        label: 'Name',
        type: 'text',
        required: true,
        width: 'half',
        placeholder: '1 L Bottle',
        validation: { maxLength: 100 },
      },
      {
        name: 'capacity',
        label: 'Capacity',
        type: 'number',
        required: true,
        width: 'half',
        validation: { min: 0 },
      },
      {
        name: 'unit',
        label: 'Unit',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'PCS',
        options: [
          { value: 'LTR', label: 'LTR' },
          { value: 'ML', label: 'ML' },
          { value: 'KG', label: 'KG' },
          { value: 'GM', label: 'GM' },
          { value: 'PCS', label: 'PCS' },
        ],
      },
      {
        name: 'is_returnable',
        label: 'Returnable',
        type: 'toggle',
        required: false,
        width: 'half',
        defaultValue: true,
      },
      {
        name: 'deposit_amount',
        label: 'Deposit Amount',
        type: 'number',
        required: false,
        width: 'half',
        defaultValue: 0,
        validation: { min: 0 },
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    ];
  }

  private normalizeTransaction(body: any, adminId: string) {
    const transactionType = String(body.transaction_type || '').toLowerCase();
    const referenceType = String(body.reference_type || 'manual').toLowerCase();
    const quantity = Number(body.quantity);

    if (!body.customer_id) throw new BadRequestException('customer_id is required');
    if (!body.packaging_type_id) {
      throw new BadRequestException('packaging_type_id is required');
    }
    if (!TRANSACTION_TYPES.includes(transactionType)) {
      throw new BadRequestException('Invalid transaction_type');
    }
    if (!REFERENCE_TYPES.includes(referenceType)) {
      throw new BadRequestException('Invalid reference_type');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity must be greater than 0');
    }

    return {
      customer_id: String(body.customer_id).trim(),
      packaging_type_id: String(body.packaging_type_id).trim(),
      reference_type: referenceType,
      reference_id:
        typeof body.reference_id === 'string' && body.reference_id.trim()
          ? body.reference_id.trim()
          : null,
      transaction_type: transactionType,
      quantity,
      remarks:
        typeof body.remarks === 'string' && body.remarks.trim()
          ? body.remarks.trim()
          : null,
      transaction_date:
        body.transaction_date || new Date().toISOString().slice(0, 10),
      created_by: adminId,
    };
  }

  private normalizePackagingType(body: any) {
    const name = String(body.name || '').trim();
    const capacity = Number(body.capacity);
    const unit = String(body.unit || '').trim().toUpperCase();
    const depositAmount = Number(body.deposit_amount ?? 0);
    const status = String(body.status || 'active').trim().toLowerCase();

    if (!name) throw new BadRequestException('name is required');
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new BadRequestException('capacity must be greater than 0');
    }
    if (!unit) throw new BadRequestException('unit is required');
    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      throw new BadRequestException('deposit_amount cannot be negative');
    }
    if (!['active', 'inactive'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return {
      name,
      capacity,
      unit,
      is_returnable:
        body.is_returnable === true || body.is_returnable === 'true',
      deposit_amount: depositAmount,
      status,
    };
  }

  private async getPackagingType(id: string) {
    const [row] = await this.db.query(
      `
      SELECT *
      FROM packaging_types
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return row ?? {};
  }

  private async getTransaction(id: string) {
    const [row] = await this.db.query(
      `
      SELECT *
      FROM container_transactions
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return row ?? {};
  }

  private async assertPackagingType(id: string) {
    const [row] = await this.db.query(
      `SELECT id FROM packaging_types WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!row) throw new BadRequestException('Packaging type not found');
  }

  private async applyBalance(transaction: any, direction = 1) {
    const deltas = {
      issued_quantity: 0,
      returned_quantity: 0,
      damaged_quantity: 0,
      lost_quantity: 0,
    };
    const quantity = Number(transaction.quantity) * direction;

    if (transaction.transaction_type === 'issue') {
      deltas.issued_quantity = quantity;
    } else if (transaction.transaction_type === 'return') {
      deltas.returned_quantity = quantity;
    } else if (transaction.transaction_type === 'damaged') {
      deltas.damaged_quantity = quantity;
    } else if (transaction.transaction_type === 'lost') {
      deltas.lost_quantity = quantity;
    } else if (transaction.transaction_type === 'adjustment') {
      deltas.issued_quantity = quantity;
    }

    await this.db.query(
      `
      INSERT INTO customer_container_balances (
        customer_id,
        packaging_type_id,
        issued_quantity,
        returned_quantity,
        damaged_quantity,
        lost_quantity,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (customer_id, packaging_type_id)
      DO UPDATE SET
        issued_quantity = customer_container_balances.issued_quantity + EXCLUDED.issued_quantity,
        returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
        damaged_quantity = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
        lost_quantity = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
        updated_at = now()
      `,
      [
        transaction.customer_id,
        transaction.packaging_type_id,
        deltas.issued_quantity,
        deltas.returned_quantity,
        deltas.damaged_quantity,
        deltas.lost_quantity,
      ],
    );
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
