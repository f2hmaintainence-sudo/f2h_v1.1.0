import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

@Injectable()
export class CatalogSalesReportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  /** Resolves reporting window from explicit dates or day count */
  private resolveRange(query: any): { from: string; to: string } {
    const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (isDate(query?.from) && isDate(query?.to)) {
      return query.from <= query.to
        ? { from: query.from, to: query.to }
        : { from: query.to, to: query.from };
    }
    const days = Math.min(Math.max(parseInt(query?.days ?? '30', 10) || 30, 1), 366);
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  }

  /** Builds WHERE conditions and parameter array for sales queries */
  private buildFilters(query: any) {
    const { from, to } = this.resolveRange(query);
    const params: any[] = [from, to];
    const where: string[] = [
      'o.deleted_at IS NULL',
      'COALESCE(o.scheduled_date, o.created_at::date) BETWEEN $1 AND $2',
    ];

    if (query?.status) {
      params.push(query.status);
      where.push(`o.status = $${params.length}`);
    } else {
      where.push("o.status NOT IN ('cancelled', 'failed', 'rejected')");
    }

    if (query?.branch_id) {
      params.push(query.branch_id);
      where.push(`o.branch_id = $${params.length}`);
    }

    if (query?.product_id) {
      params.push(query.product_id);
      where.push(`(p.product_id = $${params.length} OR pv.product_id = $${params.length})`);
    }

    if (query?.category_id) {
      params.push(query.category_id);
      where.push(`(p.category_id = $${params.length} OR c.category_id = $${params.length} OR c.id::text = $${params.length})`);
    }

    if (query?.order_source) {
      params.push(query.order_source);
      where.push(`o.order_source = $${params.length}`);
    }

    if (query?.search) {
      params.push(`%${query.search.trim()}%`);
      where.push(
        `(p.name ILIKE $${params.length} OR oi.product_name ILIKE $${params.length} OR pv.name ILIKE $${params.length} OR o.order_id::text ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`
      );
    }

    return {
      from,
      to,
      params,
      whereClause: where.join(' AND '),
    };
  }

  /**
   * Get filter dropdown options: active products, branches, categories
   */
  async getFilterOptions() {
    try {
      const [products, branches, categories] = await Promise.all([
        this.db.query(
          `SELECT DISTINCT p.product_id, p.name
           FROM products p
           WHERE p.deleted_at IS NULL
           ORDER BY p.name ASC`
        ),
        this.db.query(
          `SELECT b.branch_id, b.branch_name
           FROM branches b
           WHERE b.is_active = true OR b.is_active IS NULL
           ORDER BY b.branch_name ASC`
        ),
        this.db.query(
          `SELECT DISTINCT COALESCE(c.category_id, c.id::text) AS category_id, c.name
           FROM categories c
           WHERE c.deleted_at IS NULL
           ORDER BY c.name ASC`
        ),
      ]);

      return {
        status: true,
        data: {
          products: products || [],
          branches: branches || [],
          categories: categories || [],
        },
        message: 'Filter options fetched',
      };
    } catch (error) {
      this.developer.error('getFilterOptions error', { error });
      throw new InternalServerErrorException('Failed to retrieve filter options');
    }
  }

  /**
   * Main sales report aggregating KPIs, trend, product breakdown, branch breakdown,
   * and paginated line items.
   */
  async getSalesReport(query: any) {
    try {
      const { from, to, params, whereClause } = this.buildFilters(query);
      const page = Math.max(parseInt(query?.page || '1', 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(query?.limit || '50', 10) || 50, 1), 200);
      const offset = (page - 1) * limit;

      const NET_REVENUE =
        'COALESCE(NULLIF(oi.final_price, 0), NULLIF(oi.total_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0)';
      const GROSS_REVENUE =
        'COALESCE(NULLIF(oi.total_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0)';
      const DISCOUNT =
        'COALESCE(oi.discount_amount, 0) + COALESCE(oi.coupon_amount, 0)';

      const [totalsRows, dailyRows, productRows, branchRows, lineItemRows, countRows] =
        await Promise.all([
          // 1. KPI Totals
          this.db.query(
            `SELECT
               COALESCE(SUM(${NET_REVENUE}), 0)::numeric AS total_net_sales,
               COALESCE(SUM(${GROSS_REVENUE}), 0)::numeric AS total_gross_sales,
               COALESCE(SUM(${DISCOUNT}), 0)::numeric AS total_discounts,
               COALESCE(SUM(oi.quantity), 0)::numeric AS total_quantity,
               COUNT(DISTINCT o.order_id)::int AS total_orders,
               COUNT(DISTINCT p.product_id)::int AS total_products,
               COUNT(DISTINCT o.customer_id)::int AS total_customers
             FROM order_items oi
             JOIN orders o ON o.order_id = oi.order_id
             LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
             LEFT JOIN branches b ON b.branch_id = o.branch_id
             LEFT JOIN users u ON u.user_id = o.customer_id
             WHERE ${whereClause}`,
            params,
          ),

          // 2. Daily Sales Trend
          this.db.query(
            `SELECT
               COALESCE(o.scheduled_date, o.created_at::date)::text AS day,
               COUNT(DISTINCT o.order_id)::int AS orders,
               COALESCE(SUM(oi.quantity), 0)::numeric AS quantity,
               COALESCE(SUM(${NET_REVENUE}), 0)::numeric AS revenue,
               COALESCE(SUM(${GROSS_REVENUE}), 0)::numeric AS gross
             FROM order_items oi
             JOIN orders o ON o.order_id = oi.order_id
             LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
             LEFT JOIN branches b ON b.branch_id = o.branch_id
             LEFT JOIN users u ON u.user_id = o.customer_id
             WHERE ${whereClause}
             GROUP BY COALESCE(o.scheduled_date, o.created_at::date)
             ORDER BY day ASC`,
            params,
          ),

          // 3. Sales by Product
          this.db.query(
            `SELECT
               COALESCE(p.product_id, pv.product_id, 'other') AS product_id,
               COALESCE(NULLIF(oi.product_name, ''), p.name, pv.name, 'Produce Item') AS product_name,
               COALESCE(c.name, 'General') AS category_name,
               COALESCE(pv.name, '') AS variant_name,
               COALESCE(SUM(oi.quantity), 0)::numeric AS quantity_sold,
               COUNT(DISTINCT o.order_id)::int AS orders_count,
               COALESCE(SUM(${NET_REVENUE}), 0)::numeric AS revenue,
               COALESCE(SUM(${GROSS_REVENUE}), 0)::numeric AS gross,
               ROUND(
                 COALESCE(SUM(${NET_REVENUE}), 0)::numeric /
                 NULLIF(COALESCE(SUM(oi.quantity), 0), 0), 2
               )::numeric AS avg_price
             FROM order_items oi
             JOIN orders o ON o.order_id = oi.order_id
             LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
             LEFT JOIN branches b ON b.branch_id = o.branch_id
             LEFT JOIN users u ON u.user_id = o.customer_id
             WHERE ${whereClause}
             GROUP BY 1, 2, 3, 4
             ORDER BY revenue DESC
             LIMIT 100`,
            params,
          ),

          // 4. Sales by Branch
          this.db.query(
            `SELECT
               o.branch_id,
               COALESCE(b.branch_name, 'Unassigned') AS branch_name,
               COUNT(DISTINCT o.order_id)::int AS orders_count,
               COALESCE(SUM(oi.quantity), 0)::numeric AS quantity_sold,
               COALESCE(SUM(${NET_REVENUE}), 0)::numeric AS revenue,
               COALESCE(SUM(${GROSS_REVENUE}), 0)::numeric AS gross
             FROM order_items oi
             JOIN orders o ON o.order_id = oi.order_id
             LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
             LEFT JOIN branches b ON b.branch_id = o.branch_id
             LEFT JOIN users u ON u.user_id = o.customer_id
             WHERE ${whereClause}
             GROUP BY o.branch_id, b.branch_name
             ORDER BY revenue DESC`,
            params,
          ),

          // 5. Line items (paginated)
          this.db.query(
            `SELECT
               oi.id AS item_id,
               o.order_id,
               COALESCE(o.scheduled_date, o.created_at::date)::text AS order_date,
               o.order_source,
               o.status AS order_status,
               o.payment_mode,
               o.payment_status,
               COALESCE(b.branch_name, 'Unassigned') AS branch_name,
               COALESCE(NULLIF(oi.product_name, ''), p.name, pv.name, 'Produce Item') AS product_name,
               COALESCE(pv.name, '') AS variant_name,
               pv.unit_value,
               pv.unit_type,
               COALESCE(oi.quantity, 1)::numeric AS quantity,
               COALESCE(oi.unit_price, 0)::numeric AS unit_price,
               COALESCE(${GROSS_REVENUE}, 0)::numeric AS gross_amount,
               COALESCE(${DISCOUNT}, 0)::numeric AS discount_amount,
               COALESCE(${NET_REVENUE}, 0)::numeric AS total_amount,
               TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS customer_name,
               u.phone AS customer_phone
             FROM order_items oi
             JOIN orders o ON o.order_id = oi.order_id
             LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
             LEFT JOIN branches b ON b.branch_id = o.branch_id
             LEFT JOIN users u ON u.user_id = o.customer_id
             WHERE ${whereClause}
             ORDER BY COALESCE(o.scheduled_date, o.created_at::date) DESC, o.order_id DESC, oi.id ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset],
          ),

          // 6. Total count of line items for pagination
          this.db.query(
            `SELECT COUNT(*)::int AS total_items
             FROM order_items oi
             JOIN orders o ON o.order_id = oi.order_id
             LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
             LEFT JOIN products p ON p.product_id = pv.product_id
             LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
             LEFT JOIN branches b ON b.branch_id = o.branch_id
             LEFT JOIN users u ON u.user_id = o.customer_id
             WHERE ${whereClause}`,
            params,
          ),
        ]);

      const t = totalsRows?.[0] || {};
      const netSales = Number(t.total_net_sales || 0);
      const grossSales = Number(t.total_gross_sales || 0);
      const totalOrders = Number(t.total_orders || 0);

      const totals = {
        total_net_sales: netSales,
        total_gross_sales: grossSales,
        total_discounts: Number(t.total_discounts || 0),
        total_quantity: Number(t.total_quantity || 0),
        total_orders: totalOrders,
        total_products: Number(t.total_products || 0),
        total_customers: Number(t.total_customers || 0),
        avg_order_value: totalOrders > 0 ? netSales / totalOrders : 0,
      };

      const shareOf = (v: number) => (netSales > 0 ? (v / netSales) * 100 : 0);

      const productsWithShare = (productRows || []).map((p: any) => ({
        ...p,
        revenue: Number(p.revenue || 0),
        gross: Number(p.gross || 0),
        quantity_sold: Number(p.quantity_sold || 0),
        orders_count: Number(p.orders_count || 0),
        avg_price: Number(p.avg_price || 0),
        share_pct: shareOf(Number(p.revenue || 0)),
      }));

      const branchesWithShare = (branchRows || []).map((b: any) => ({
        ...b,
        revenue: Number(b.revenue || 0),
        gross: Number(b.gross || 0),
        quantity_sold: Number(b.quantity_sold || 0),
        orders_count: Number(b.orders_count || 0),
        share_pct: shareOf(Number(b.revenue || 0)),
      }));

      const totalItems = countRows?.[0]?.total_items || 0;

      return {
        status: true,
        data: {
          range: { from, to },
          totals,
          daily: (dailyRows || []).map((d: any) => ({
            day: d.day,
            orders: Number(d.orders || 0),
            quantity: Number(d.quantity || 0),
            revenue: Number(d.revenue || 0),
            gross: Number(d.gross || 0),
          })),
          by_product: productsWithShare,
          by_branch: branchesWithShare,
          line_items: lineItemRows || [],
          pagination: {
            page,
            limit,
            total_items: totalItems,
            total_pages: Math.ceil(totalItems / limit) || 1,
          },
        },
        message: 'Sales report fetched successfully',
      };
    } catch (error) {
      this.developer.error('getSalesReport error', { error });
      throw new InternalServerErrorException('Failed to retrieve sales report');
    }
  }

  /**
   * Export sales report as CSV matching all active filters
   */
  async exportSalesCsv(query: any): Promise<string> {
    try {
      const { params, whereClause } = this.buildFilters(query);

      const NET_REVENUE =
        'COALESCE(NULLIF(oi.final_price, 0), NULLIF(oi.total_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0)';
      const GROSS_REVENUE =
        'COALESCE(NULLIF(oi.total_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0)';
      const DISCOUNT =
        'COALESCE(oi.discount_amount, 0) + COALESCE(oi.coupon_amount, 0)';

      const sql = `
        SELECT
          o.order_id,
          COALESCE(o.scheduled_date, o.created_at::date)::text AS order_date,
          COALESCE(b.branch_name, 'Unassigned') AS branch_name,
          COALESCE(NULLIF(oi.product_name, ''), p.name, pv.name, 'Produce Item') AS product_name,
          COALESCE(c.name, 'General') AS category_name,
          COALESCE(pv.name, '') AS variant_name,
          COALESCE(pv.unit_value::text || ' ' || pv.unit_type, '') AS pack_size,
          COALESCE(oi.quantity, 1)::numeric AS quantity,
          COALESCE(oi.unit_price, 0)::numeric AS unit_price,
          COALESCE(${DISCOUNT}, 0)::numeric AS discount_amount,
          COALESCE(${NET_REVENUE}, 0)::numeric AS total_amount,
          o.order_source,
          o.status AS order_status,
          o.payment_mode,
          o.payment_status,
          TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS customer_name,
          COALESCE(u.phone, '') AS customer_phone
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
        LEFT JOIN branches b ON b.branch_id = o.branch_id
        LEFT JOIN users u ON u.user_id = o.customer_id
        WHERE ${whereClause}
        ORDER BY COALESCE(o.scheduled_date, o.created_at::date) DESC, o.order_id DESC, oi.id ASC
        LIMIT 10000
      `;

      const rows = await this.db.query(sql, params);

      const headers = [
        'Order ID',
        'Date',
        'Branch',
        'Product Name',
        'Category',
        'Variant',
        'Pack Size',
        'Quantity',
        'Unit Price (INR)',
        'Discount (INR)',
        'Total Amount (INR)',
        'Order Source',
        'Order Status',
        'Payment Mode',
        'Payment Status',
        'Customer Name',
        'Customer Phone',
      ];

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const lines = [headers.join(',')];
      for (const r of rows) {
        lines.push(
          [
            escapeCsv(r.order_id),
            escapeCsv(r.order_date),
            escapeCsv(r.branch_name),
            escapeCsv(r.product_name),
            escapeCsv(r.category_name),
            escapeCsv(r.variant_name),
            escapeCsv(r.pack_size),
            Number(r.quantity || 0),
            Number(r.unit_price || 0).toFixed(2),
            Number(r.discount_amount || 0).toFixed(2),
            Number(r.total_amount || 0).toFixed(2),
            escapeCsv(r.order_source),
            escapeCsv(r.order_status),
            escapeCsv(r.payment_mode),
            escapeCsv(r.payment_status),
            escapeCsv(r.customer_name),
            escapeCsv(r.customer_phone),
          ].join(',')
        );
      }

      return lines.join('\r\n');
    } catch (error) {
      this.developer.error('exportSalesCsv error', { error });
      throw new InternalServerErrorException('Failed to generate sales report CSV');
    }
  }
}
