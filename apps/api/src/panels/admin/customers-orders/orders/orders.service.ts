import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { PdfService } from '../../../../common/pdf/pdf.service';

function todayInIndia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0);
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

import { FirstOrderDetectorService } from '../../../customer/referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from '../../../customer/referral/services/referral-reward-engine.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataService: DataService,
    private readonly databaseService: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly pdfService: PdfService,
    private readonly firstOrderDetector: FirstOrderDetectorService,
    private readonly referralRewardEngine: ReferralRewardEngineService,
  ) {}

  async getOrderView(orderId: string) {
    try {
      const result = await this.dataService.query('orders', {
        select: ['orders.*'],
        where: [{ column: 'orders.order_id', operator: '=', value: orderId }],
        limit: 1,
      });

      return {
        status: true,
        data: result?.data?.[0] ?? null,
        message: result?.data?.[0] ? 'Order fetched' : 'Order not found',
      };
    } catch (error) {
      this.developer.error('getOrderView error', { error, orderId });
      throw new InternalServerErrorException('Failed to retrieve order');
    }
  }

  async getOrderItems(orderId: string) {
  try {
    const result = await this.dataService.query('order_items', {
      select: [
        'order_items.id',
        'order_items.order_id',
        'order_items.variant_id',
        'products.name AS product_name',
        'product_variants.name AS variant_name',
        'order_items.quantity',
        'order_items.unit_price',
        'order_items.discount_id',
        'order_items.coupon_id',
        'order_items.discount_amount',
        'order_items.coupon_amount',
        'order_items.total_price',
        'order_items.final_price',
        'order_items.is_free',
        'order_items.created_at',
      ],
      joins: [
        {
          type: 'left',
          table: 'product_variants',
          on: [['order_items.variant_id', 'product_variants.variant_id']],
        },
        {
          type: 'left',
          table: 'products',
          on: [['product_variants.product_id', 'products.product_id']],
        },
      ],
      where: [
        {
          column: 'order_items.order_id',
          operator: '=',
          value: orderId,
        },
      ],
      orderBy: [
        {
          column: 'order_items.id',
          direction: 'ASC',
        },
      ],
    });

    return {
      status: true,
      data: result?.data ?? [],
      message: 'Order items fetched',
    };
  } catch (error) {
    this.developer.error('getOrderItems error', {
      error,
      orderId,
    });

    throw new InternalServerErrorException(
      'Failed to retrieve order items',
    );
  }
}

  // ────────────────────────────────────────────────
  // Today Orders Dashboard Summary
  // ────────────────────────────────────────────────
  async getOrdersSummary(query: any = {}) {
    try {
      const params: any[] = [];
      const where: string[] = [];

      if (query.fromDate && query.toDate) {
        params.push(query.fromDate);
        where.push(`scheduled_date >= $${params.length}`);
        params.push(query.toDate);
        where.push(`scheduled_date <= $${params.length}`);
      } else if (query.fromDate) {
        params.push(query.fromDate);
        where.push(`scheduled_date >= $${params.length}`);
      } else if (query.toDate) {
        params.push(query.toDate);
        where.push(`scheduled_date <= $${params.length}`);
      } else if (query.date) {
        params.push(query.date);
        where.push(`scheduled_date = $${params.length}`);
      }

      if (query.order_source || query.type) {
        params.push(query.order_source || query.type);
        where.push(`order_source = $${params.length}`);
      }

      if (query.status) {
        params.push(query.status);
        where.push(`status = $${params.length}`);
      }

      const sql = `
        SELECT
          COUNT(*)::int                                              AS total_orders,
          COUNT(*) FILTER (WHERE status = 'pending')::int            AS pending,
          COUNT(*) FILTER (WHERE status = 'placed')::int             AS placed,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int          AS confirmed,
          COUNT(*) FILTER (WHERE status = 'packed')::int             AS packed,
          COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int   AS out_for_delivery,
          COUNT(*) FILTER (WHERE status = 'delivered')::int          AS delivered,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int          AS cancelled,
          COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) AS revenue,
          COUNT(*) FILTER (WHERE order_source = 'subscription')::int AS subscription_count,
          COUNT(*) FILTER (WHERE order_source = 'one-time')::int     AS one_time_count
        FROM orders
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      `;

      const rows = await this.databaseService.query(sql, params);

      return {
        status: true,
        data: rows[0] ?? {},
        date: query.date || null,
        message: 'Orders summary fetched',
      };
    } catch (error) {
      this.developer.error('getOrdersSummary error', { error });
      throw new InternalServerErrorException('Failed to retrieve orders summary');
    }
  }

  async getTodaySummary(query: any) {
    const date = query.date || todayInIndia();
    const response = await this.getOrdersSummary({ ...query, date });

    return {
      ...response,
      date,
      message: 'Today summary fetched',
    };
  }

  // ────────────────────────────────────────────────
  // Bulk Mark Delivered
  // ────────────────────────────────────────────────
  async bulkMarkDelivered(query: any) {
    try {
      const date = query.date || todayInIndia();

      const sql = `
        UPDATE orders
        SET    status     = 'delivered',
               updated_at = CURRENT_TIMESTAMP
        WHERE  scheduled_date = $1
          AND  status = 'out_for_delivery'
        RETURNING order_id, customer_id
      `;

      const rows = await this.databaseService.query(sql, [date]);

      if (rows && rows.length > 0) {
        for (const ord of rows) {
          if (ord.customer_id && ord.order_id) {
            try {
              await this.firstOrderDetector.detectAndMarkFirstOrder(ord.customer_id, ord.order_id);
              await this.firstOrderDetector.unlockReferralCode(ord.customer_id);
              await this.referralRewardEngine.processReferralReward(ord.customer_id, ord.order_id);
            } catch (error) {
              // One customer's referral failing must not stop the batch, but a
              // reward that never lands is a money problem — record which order.
              this.developer.error('Referral reward processing failed for order', {
                orderId: ord.order_id,
                customerId: ord.customer_id,
                error,
              });
            }
          }
        }
      }

      return {
        status: true,
        updated: rows.length,
        orderIds: rows.map((r: any) => r.order_id),
        message: `${rows.length} order(s) marked as delivered`,
      };
    } catch (error) {
      this.developer.error('bulkMarkDelivered error', { error });
      throw new InternalServerErrorException('Failed to bulk-mark orders');
    }
  }

  // ────────────────────────────────────────────────
  // Export Today Orders as PDF
  // ────────────────────────────────────────────────
  async exportTodayPdf(query: any): Promise<Buffer> {
    try {
      const date = query.date || todayInIndia();
      const statusFilter = query.status || null;
      const orderSource = query.order_source || null;

      let sql = `
        SELECT
          o.order_id,
          o.customer_id,
          o.customer_name,
          o.order_source,
          o.status,
          o.payment_mode,
          o.payment_status,
          o.delivery_slot,
          o.address_line,
          o.contact_number,
          o.subtotal,
          o.discount_amount,
          o.total_amount,
          o.scheduled_date,
          o.created_at
        FROM orders o
        WHERE o.scheduled_date = $1
      `;
      const params: any[] = [date];
      let paramIndex = 2;

      if (statusFilter) {
        sql += ` AND o.status = $${paramIndex}`;
        params.push(statusFilter);
        paramIndex++;
      }

      if (orderSource) {
        sql += ` AND o.order_source = $${paramIndex}`;
        params.push(orderSource);
        paramIndex++;
      }

      sql += ` ORDER BY o.created_at DESC`;

      const rows = await this.databaseService.query(sql, params);

      // Get summary for cards
      const summaryResult = await this.getTodaySummary(query);
      const summary = summaryResult.data as any;

      const now = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
      });

      const filterParts: string[] = [`Date: ${date}`];
      if (statusFilter) filterParts.push(`Status: ${statusFilter}`);
      if (orderSource) filterParts.push(`Source: ${orderSource}`);

      return this.pdfService.generateReport({
        title: `Today's Orders Report — ${date}`,
        subtitle: filterParts.join(' | '),
        generatedAt: now,
        summaryCards: [
          { label: 'Total', value: summary.total_orders ?? 0, color: '#f0fdf4' },
          { label: 'Pending', value: summary.pending ?? 0, color: '#fefce8' },
          { label: 'Placed', value: summary.placed ?? 0, color: '#eff6ff' },
          { label: 'Packed', value: summary.packed ?? 0, color: '#eef2ff' },
          { label: 'Out for Delivery', value: summary.out_for_delivery ?? 0, color: '#ecfdf5' },
          { label: 'Delivered', value: summary.delivered ?? 0, color: '#f0fdf4' },
          { label: 'Cancelled', value: summary.cancelled ?? 0, color: '#fef2f2' },
        ],
        columns: [
          { header: 'Order ID', key: 'order_id', width: 95 },
          { header: 'Customer', key: 'customer_name', width: 90 },
          { header: 'Source', key: 'order_source', width: 65 },
          { header: 'Status', key: 'status', width: 70 },
          { header: 'Slot', key: 'delivery_slot', width: 55 },
          { header: 'Payment', key: 'payment_mode', width: 55 },
          { header: 'Pay Status', key: 'payment_status', width: 60 },
          { header: 'Address', key: 'address_line', width: 120 },
          { header: 'Phone', key: 'contact_number', width: 70 },
          {
            header: 'Total',
            key: 'total_amount',
            width: 65,
            align: 'right' as const,
            format: (v: unknown) => formatMoney(v),
          },
        ],
        rows: rows as Record<string, unknown>[],
        footer: `Total Orders: ${rows.length} | Revenue: ${formatMoney(
          (rows as any[]).reduce(
            (s, r) =>
              s + (r.status !== 'cancelled' ? Number(r.total_amount ?? 0) : 0),
            0,
          ),
        )} | Generated at ${now}`,
        orientation: 'landscape',
      });
    } catch (error) {
      this.developer.error('exportTodayPdf error', { error });
      throw new InternalServerErrorException('Failed to generate PDF');
    }
  }
}
