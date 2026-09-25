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
      where.push("o.status = 'delivered'");
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
        `(p.name ILIKE $${params.length} OR oi.product_name ILIKE $${params.length} OR pv.name ILIKE $${params.length} OR pv.sku ILIKE $${params.length} OR o.order_id::text ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`
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
   * Main sales report aggregating KPIs, trend, product breakdown with profit/loss,
   * branch breakdown, and paginated line items.
   */
  async getSalesReport(query: any) {
    try {
      const { from, to, params, whereClause } = this.buildFilters(query);
      const page = Math.max(parseInt(query?.page || '1', 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(query?.limit || '50', 10) || 50, 1), 200);
      const offset = (page - 1) * limit;

      const NET_REVENUE =
        'COALESCE(NULLIF(oi.total_price, 0), NULLIF(oi.final_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0)';
      const GROSS_REVENUE =
        'COALESCE(NULLIF(pv.original_price, 0), NULLIF(oi.original_price, 0), oi.unit_price, 0) * COALESCE(oi.quantity, 1)';
      const DISCOUNT_LOSS =
        'GREATEST(0, (COALESCE(NULLIF(pv.original_price, 0), NULLIF(oi.original_price, 0), oi.unit_price, 0) * COALESCE(oi.quantity, 1)) - COALESCE(NULLIF(oi.total_price, 0), NULLIF(oi.final_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0))';
      const ESTIMATED_COST =
        'COALESCE(NULLIF(pv.purchase_price, 0), NULLIF(pe.avg_unit_cost, 0), NULLIF(vc.avg_unit_cost, 0), 0) * COALESCE(oi.quantity, 1)';

      const [totalsRows, dailyRows, productRows, branchRows, lineItemRows, countRows] =
        await Promise.all([
          // 1. Headline Totals
          this.db.query(
            `SELECT
               COALESCE(SUM(${NET_REVENUE}), 0)::numeric AS total_net_sales,
               COALESCE(SUM(${GROSS_REVENUE}), 0)::numeric AS total_gross_sales,
               COALESCE(SUM(${DISCOUNT_LOSS}), 0)::numeric AS total_discounts,
               COALESCE(SUM(${ESTIMATED_COST}), 0)::numeric AS total_cogs,
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
             LEFT JOIN (
               SELECT variant_id, AVG(unit_cost)::numeric AS avg_unit_cost
               FROM purchase_entries
               WHERE deleted_at IS NULL AND unit_cost > 0
               GROUP BY variant_id
             ) pe ON pe.variant_id = pv.variant_id
             LEFT JOIN (
               SELECT product_id, AVG(rate_per_unit)::numeric AS avg_unit_cost
               FROM vendor_collections
               WHERE deleted_at IS NULL AND rate_per_unit > 0
               GROUP BY product_id
             ) vc ON vc.product_id = p.product_id
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

          // 3. Sales & Profitability by Product
          this.db.query(
            `SELECT
               COALESCE(p.product_id, pv.product_id, 'other') AS product_id,
               COALESCE(NULLIF(oi.product_name, ''), p.name, pv.name, 'Produce Item') AS product_name,
               COALESCE(c.name, 'General') AS category_name,
               COALESCE(pv.name, '') AS variant_name,
               COALESCE(pv.sku, '') AS sku,
               COALESCE(pv.unit_value::text || ' ' || pv.unit_type, '') AS pack_size,
               COUNT(DISTINCT o.order_id)::int AS orders_count,
               COALESCE(SUM(oi.quantity), 0)::numeric AS quantity_sold,
               COALESCE(SUM(${GROSS_REVENUE}), 0)::numeric AS gross_sales,
               COALESCE(SUM(${DISCOUNT_LOSS}), 0)::numeric AS discount_loss,
               COALESCE(SUM(${NET_REVENUE}), 0)::numeric AS revenue,
               COALESCE(SUM(${ESTIMATED_COST}), 0)::numeric AS estimated_cogs,
               COALESCE(MAX(pv.purchase_price), MAX(pe.avg_unit_cost), MAX(vc.avg_unit_cost), 0)::numeric AS unit_purchase_price,
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
             LEFT JOIN (
               SELECT variant_id, AVG(unit_cost)::numeric AS avg_unit_cost
               FROM purchase_entries
               WHERE deleted_at IS NULL AND unit_cost > 0
               GROUP BY variant_id
             ) pe ON pe.variant_id = pv.variant_id
             LEFT JOIN (
               SELECT product_id, AVG(rate_per_unit)::numeric AS avg_unit_cost
               FROM vendor_collections
               WHERE deleted_at IS NULL AND rate_per_unit > 0
               GROUP BY product_id
             ) vc ON vc.product_id = p.product_id
             WHERE ${whereClause}
             GROUP BY 1, 2, 3, 4, 5, 6
             ORDER BY revenue DESC
             LIMIT 200`,
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
               COALESCE(pv.purchase_price, pe.avg_unit_cost, vc.avg_unit_cost, 0)::numeric AS purchase_price,
               COALESCE(${ESTIMATED_COST}, 0)::numeric AS estimated_cogs,
               COALESCE(${GROSS_REVENUE}, 0)::numeric AS gross_amount,
               COALESCE(${DISCOUNT_LOSS}, 0)::numeric AS discount_amount,
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
             LEFT JOIN (
               SELECT variant_id, AVG(unit_cost)::numeric AS avg_unit_cost
               FROM purchase_entries
               WHERE deleted_at IS NULL AND unit_cost > 0
               GROUP BY variant_id
             ) pe ON pe.variant_id = pv.variant_id
             LEFT JOIN (
               SELECT product_id, AVG(rate_per_unit)::numeric AS avg_unit_cost
               FROM vendor_collections
               WHERE deleted_at IS NULL AND rate_per_unit > 0
               GROUP BY product_id
             ) vc ON vc.product_id = p.product_id
             WHERE ${whereClause}
             ORDER BY COALESCE(o.scheduled_date, o.created_at::date) DESC, o.order_id DESC, oi.id ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset],
          ),

          // 6. Total count of line items
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
      const totalDiscounts = Number(t.total_discounts || 0);
      const totalCogs = Number(t.total_cogs || 0);
      const totalOrders = Number(t.total_orders || 0);
      const grossProfit = Math.round((netSales - totalCogs) * 100) / 100;
      const grossMarginPct = netSales > 0 ? Math.round((grossProfit / netSales) * 1000) / 10 : 0;

      const shareOf = (v: number) => (netSales > 0 ? (v / netSales) * 100 : 0);

      // Process product breakdown with profit, loss, and gross profit
      const productsWithProfit = (productRows || []).map((p: any) => {
        const rev = Number(p.revenue || 0);
        const gross = Number(p.gross_sales || 0);
        const purchaseCost = Number(p.estimated_cogs || 0);
        const pGrossProfit = Math.round((rev - purchaseCost) * 100) / 100;
        const pProfit = Math.max(0, pGrossProfit);
        const pLoss = Math.round(Math.max(0, purchaseCost - rev) * 100) / 100;
        const marginPct = rev > 0 ? Math.round((pGrossProfit / rev) * 1000) / 10 : 0;

        return {
          product_id: p.product_id,
          product_name: p.product_name,
          category_name: p.category_name,
          variant_name: p.variant_name,
          sku: p.sku,
          pack_size: p.pack_size,
          orders_count: Number(p.orders_count || 0),
          quantity_sold: Number(p.quantity_sold || 0),
          gross_sales: gross,
          total_loss: pLoss,
          revenue: rev,
          estimated_cogs: purchaseCost,
          purchase_price: Number(p.unit_purchase_price || 0),
          gross_profit: pGrossProfit,
          total_profit: pProfit,
          margin_pct: marginPct,
          avg_price: Number(p.avg_price || 0),
          share_pct: shareOf(rev),
        };
      });

      const totalProfit = Math.round(
        productsWithProfit.reduce((acc: number, item: any) => acc + (item.total_profit || 0), 0) * 100
      ) / 100;
      const totalLoss = Math.round(
        productsWithProfit.reduce((acc: number, item: any) => acc + (item.total_loss || 0), 0) * 100
      ) / 100;

      const totals = {
        total_net_sales: netSales,
        total_gross_sales: grossSales,
        total_discounts: totalDiscounts,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        total_profit: totalProfit,
        total_loss: totalLoss,
        gross_margin_pct: grossMarginPct,
        total_quantity: Number(t.total_quantity || 0),
        total_orders: totalOrders,
        total_products: Number(t.total_products || 0),
        total_customers: Number(t.total_customers || 0),
        avg_order_value: totalOrders > 0 ? netSales / totalOrders : 0,
      };

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
          by_product: productsWithProfit,
          by_branch: branchesWithShare,
          line_items: (lineItemRows || []).map((item: any) => ({
            ...item,
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
            purchase_price: Number(item.purchase_price || 0),
            estimated_cogs: Number(item.estimated_cogs || 0),
            gross_amount: Number(item.gross_amount || 0),
            discount_amount: Number(item.discount_amount || 0),
            total_amount: Number(item.total_amount || 0),
          })),
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
   * Export sales report as Product Summary CSV based on active filters:
   * Products, Total Orders, Total Profit, Total Loss, Gross Profit.
   */
  async exportSalesCsv(query: any): Promise<string> {
    try {
      const { params, whereClause } = this.buildFilters(query);

      const NET_REVENUE =
        'COALESCE(NULLIF(oi.total_price, 0), NULLIF(oi.final_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0)';
      const GROSS_REVENUE =
        'COALESCE(NULLIF(pv.original_price, 0), NULLIF(oi.original_price, 0), oi.unit_price, 0) * COALESCE(oi.quantity, 1)';
      const DISCOUNT_LOSS =
        'GREATEST(0, (COALESCE(NULLIF(pv.original_price, 0), NULLIF(oi.original_price, 0), oi.unit_price, 0) * COALESCE(oi.quantity, 1)) - COALESCE(NULLIF(oi.total_price, 0), NULLIF(oi.final_price, 0), (COALESCE(oi.quantity, 1) * oi.unit_price), 0))';
      const ESTIMATED_COST =
        'COALESCE(NULLIF(pv.purchase_price, 0), NULLIF(pe.avg_unit_cost, 0), NULLIF(vc.avg_unit_cost, 0), 0) * COALESCE(oi.quantity, 1)';

      const sql = `
        SELECT
          COALESCE(p.product_id, pv.product_id, 'other') AS product_id,
          COALESCE(NULLIF(oi.product_name, ''), p.name, pv.name, 'Produce Item') AS product_name,
          COALESCE(c.name, 'General') AS category_name,
          COALESCE(pv.name, '') AS variant_name,
          COALESCE(pv.sku, '') AS sku,
          COALESCE(pv.unit_value::text || ' ' || pv.unit_type, '') AS pack_size,
          COUNT(DISTINCT o.order_id)::int AS total_orders,
          COALESCE(SUM(oi.quantity), 0)::numeric AS total_quantity,
          COALESCE(SUM(${GROSS_REVENUE}), 0)::numeric AS gross_sales,
          COALESCE(SUM(${DISCOUNT_LOSS}), 0)::numeric AS discount_loss,
          COALESCE(SUM(${NET_REVENUE}), 0)::numeric AS net_revenue,
          COALESCE(SUM(${ESTIMATED_COST}), 0)::numeric AS estimated_cogs,
          COALESCE(MAX(pv.purchase_price), MAX(pe.avg_unit_cost), MAX(vc.avg_unit_cost), 0)::numeric AS unit_purchase_price
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        LEFT JOIN categories c ON (c.category_id = p.category_id OR c.id::text = p.category_id)
        LEFT JOIN branches b ON b.branch_id = o.branch_id
        LEFT JOIN users u ON u.user_id = o.customer_id
        LEFT JOIN (
          SELECT variant_id, AVG(unit_cost)::numeric AS avg_unit_cost
          FROM purchase_entries
          WHERE deleted_at IS NULL AND unit_cost > 0
          GROUP BY variant_id
        ) pe ON pe.variant_id = pv.variant_id
        LEFT JOIN (
          SELECT product_id, AVG(rate_per_unit)::numeric AS avg_unit_cost
          FROM vendor_collections
          WHERE deleted_at IS NULL AND rate_per_unit > 0
          GROUP BY product_id
        ) vc ON vc.product_id = p.product_id
        WHERE ${whereClause}
        GROUP BY 1, 2, 3, 4, 5, 6
        ORDER BY net_revenue DESC
      `;

      const rows = await this.db.query(sql, params);

      const headers = [
        'Product Name',
        'Category',
        'Variant / Pack Size',
        'SKU',
        'Total Orders',
        'Quantity Sold',
        'Purchase Price (INR)',
        'Purchase Cost / COGS (INR)',
        'Gross Sales (INR)',
        'Total Loss (INR)',
        'Net Sales (INR)',
        'Gross Profit (INR)',
        'Total Profit (INR)',
        'Profit Margin (%)',
      ];

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      let sumOrders = 0;
      let sumQty = 0;
      let sumCogs = 0;
      let sumGross = 0;
      let sumLoss = 0;
      let sumNet = 0;
      let sumGrossProfit = 0;
      let sumTotalProfit = 0;

      const lines = [headers.join(',')];

      for (const r of rows) {
        const orders = Number(r.total_orders || 0);
        const qty = Number(r.total_quantity || 0);
        const gross = Number(r.gross_sales || 0);
        const discountLoss = Number(r.discount_loss || 0);
        const net = Number(r.net_revenue || 0);
        const cogs = Number(r.estimated_cogs || 0);
        const purchasePrice = Number(r.unit_purchase_price || (qty > 0 && cogs > 0 ? cogs / qty : 0));

        const grossProfit = Math.round((net - cogs) * 100) / 100;
        const totalProfit = Math.max(0, grossProfit);
        const totalLoss = Math.round(Math.max(0, cogs - net) * 100) / 100;
        const marginPct = net > 0 ? Math.round((grossProfit / net) * 1000) / 10 : 0;

        sumOrders += orders;
        sumQty += qty;
        sumCogs += cogs;
        sumGross += gross;
        sumLoss += totalLoss;
        sumNet += net;
        sumGrossProfit += grossProfit;
        sumTotalProfit += totalProfit;

        lines.push(
          [
            escapeCsv(r.product_name),
            escapeCsv(r.category_name),
            escapeCsv(r.pack_size || r.variant_name || 'Standard'),
            escapeCsv(r.sku || '-'),
            orders,
            qty,
            purchasePrice.toFixed(2),
            cogs.toFixed(2),
            gross.toFixed(2),
            totalLoss.toFixed(2),
            net.toFixed(2),
            grossProfit.toFixed(2),
            totalProfit.toFixed(2),
            `${marginPct.toFixed(1)}%`,
          ].join(',')
        );
      }

      // Total summary row
      const overallMargin = sumNet > 0 ? Math.round((sumGrossProfit / sumNet) * 1000) / 10 : 0;
      lines.push(
        [
          escapeCsv('TOTAL / SUMMARY'),
          escapeCsv('-'),
          escapeCsv('-'),
          escapeCsv('-'),
          sumOrders,
          sumQty,
          escapeCsv('-'),
          sumCogs.toFixed(2),
          sumGross.toFixed(2),
          sumLoss.toFixed(2),
          sumNet.toFixed(2),
          sumGrossProfit.toFixed(2),
          sumTotalProfit.toFixed(2),
          `${overallMargin.toFixed(1)}%`,
        ].join(',')
      );

      return lines.join('\r\n');
    } catch (error) {
      this.developer.error('exportSalesCsv error', { error });
      throw new InternalServerErrorException('Failed to generate product sales summary CSV');
    }
  }
}
