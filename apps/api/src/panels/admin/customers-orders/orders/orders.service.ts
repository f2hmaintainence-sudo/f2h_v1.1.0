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
import { WalletLedgerService } from '../../../../shared/payments/wallet-ledger.service';
import { PushNotificationService } from '../../../../shared/pushNotifications/pushNotification.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataService: DataService,
    private readonly databaseService: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly pdfService: PdfService,
    private readonly firstOrderDetector: FirstOrderDetectorService,
    private readonly referralRewardEngine: ReferralRewardEngineService,
    private readonly walletLedger: WalletLedgerService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async getOrderView(orderId: string) {
    try {
      const cleanId = String(orderId || '').replace(/^[#\s]+|[#\s]+$/g, '').trim();
      const rows = await this.databaseService.query(
        `SELECT
           orders.*,
           TRIM(CONCAT(dpu.first_name, ' ', COALESCE(dpu.last_name, ''))) AS partner_name,
           dpu.phone AS partner_phone,
           dp.vehicle_type,
           dp.vehicle_number
         FROM orders
         LEFT JOIN users dpu ON dpu.user_id = orders.delivery_partner_id
         LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = orders.delivery_partner_id
         WHERE orders.order_id = $1 
            OR orders.order_id = $2
            OR orders.id::text = $1
         LIMIT 1`,
        [cleanId, orderId],
      );

      return {
        status: true,
        data: rows?.[0] ?? null,
        message: rows?.[0] ? 'Order fetched' : 'Order not found',
      };
    } catch (error) {
      this.developer.error('getOrderView error', { error, orderId });
      throw new InternalServerErrorException('Failed to retrieve order');
    }
  }

  async getOrderItems(orderId: string) {
    try {
      const cleanId = String(orderId || '').replace(/^[#\s]+|[#\s]+$/g, '').trim();
      const sql = `
        SELECT
          oi.id,
          oi.order_id,
          oi.variant_id,
          COALESCE(NULLIF(oi.product_name, ''), p.name, pv.name, 'Produce Item') AS product_name,
          COALESCE(pv.name, '') AS variant_name,
          pv.quantity_value,
          pv.quantity_unit,
          oi.quantity,
          oi.unit_price,
          oi.original_price,
          oi.discount_amount,
          oi.coupon_amount,
          oi.total_price,
          oi.final_price,
          oi.is_free,
          oi.created_at
        FROM order_items oi
        LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        WHERE oi.order_id = $1 OR oi.order_id = $2
        ORDER BY oi.id ASC
      `;
      let rows = await this.databaseService.query(sql, [cleanId, orderId]);

      // Fallback for subscription recurring deliveries if items are in subscription_items
      if (!rows || rows.length === 0) {
        const subSql = `
          SELECT
            si.id,
            $1 AS order_id,
            si.variant_id,
            COALESCE(NULLIF(si.product_name, ''), p.name, pv.name, 'Produce Item') AS product_name,
            COALESCE(pv.name, '') AS variant_name,
            pv.quantity_value,
            pv.quantity_unit,
            COALESCE(si.quantity, (COALESCE(si.default_m_quantity, 0) + COALESCE(si.default_e_quantity, 0)), 1) AS quantity,
            si.unit_price,
            si.original_price,
            si.discount_amount,
            si.coupon_amount,
            si.total_price,
            si.final_price,
            si.is_free,
            si.created_at
          FROM subscription_items si
          JOIN orders o ON o.subscription_id = si.subscription_id
          LEFT JOIN product_variants pv ON pv.variant_id = si.variant_id
          LEFT JOIN products p ON p.product_id = pv.product_id
          WHERE o.order_id = $1 OR o.order_id = $2 OR o.id::text = $1
          ORDER BY si.id ASC
        `;
        rows = await this.databaseService.query(subSql, [cleanId, orderId]);
      }

      return {
        status: true,
        data: rows ?? [],
        message: 'Order items fetched',
      };
    } catch (error) {
      this.developer.error('getOrderItems error', { error, orderId });
      return {
        status: true,
        data: [],
        message: 'Order items fetched',
      };
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
          COUNT(*) FILTER (WHERE status = 'assigned')::int           AS assigned,
          COUNT(*) FILTER (WHERE status = 'packed')::int             AS packed,
          COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int   AS out_for_delivery,
          COUNT(*) FILTER (WHERE status = 'delivered')::int          AS delivered,
          COUNT(*) FILTER (WHERE status = 'failed')::int             AS failed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int          AS cancelled,
          COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled', 'failed')), 0) AS revenue,
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
      const fromDate = query.fromDate ? (String(query.fromDate).includes('-') ? query.fromDate.split('-').length === 3 && query.fromDate.split('-')[2].length === 4 ? `${query.fromDate.split('-')[2]}-${query.fromDate.split('-')[1].padStart(2, '0')}-${query.fromDate.split('-')[0].padStart(2, '0')}` : query.fromDate : query.fromDate) : (query.date || todayInIndia());
      const toDate = query.toDate ? (String(query.toDate).includes('-') ? query.toDate.split('-').length === 3 && query.toDate.split('-')[2].length === 4 ? `${query.toDate.split('-')[2]}-${query.toDate.split('-')[1].padStart(2, '0')}-${query.toDate.split('-')[0].padStart(2, '0')}` : query.toDate : query.toDate) : fromDate;

      const params: any[] = [fromDate, toDate];
      let slotClause = '';
      if (query.slot && query.slot !== 'all') {
        params.push(query.slot);
        slotClause = ` AND delivery_slot = $${params.length}`;
      }

      const sql = `
        UPDATE orders
        SET    status     = 'delivered',
               updated_at = CURRENT_TIMESTAMP
        WHERE  scheduled_date >= $1::date
          AND  scheduled_date <= $2::date
          AND  status IN ('out_for_delivery', 'assigned', 'packed', 'confirmed')
          ${slotClause}
        RETURNING order_id, customer_id
      `;

      const rows = await this.databaseService.query(sql, params);

      if (rows && rows.length > 0) {
        for (const ord of rows) {
          if (ord.customer_id && ord.order_id) {
            try {
              const isFirstOrder = await this.firstOrderDetector.detectAndMarkFirstOrder(ord.customer_id, ord.order_id);
              if (isFirstOrder) {
                await this.referralRewardEngine.processReferralReward(ord.customer_id, ord.order_id);
              }
            } catch (error) {
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
        message: `${rows.length} order(s) marked as delivered (${fromDate} to ${toDate})`,
      };
    } catch (error) {
      this.developer.error('bulkMarkDelivered error', { error });
      throw new InternalServerErrorException('Failed to bulk-mark orders');
    }
  }

  // ────────────────────────────────────────────────
  // Bulk Mark Failed (Refund One-Time Orders Only)
  // ────────────────────────────────────────────────
  async bulkMarkFailed(query: any) {
    try {
      const today = todayInIndia();
      let fromDate: string = today;
      let toDate: string = today;

      if (query.scope === 'last_month' || query.date === 'last_month' || query.lastMonth === true || query.lastMonth === 'true') {
        const d = new Date();
        const firstDayPrev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const lastDayPrev = new Date(d.getFullYear(), d.getMonth(), 0);
        fromDate = `${firstDayPrev.getFullYear()}-${String(firstDayPrev.getMonth() + 1).padStart(2, '0')}-01`;
        toDate = `${lastDayPrev.getFullYear()}-${String(lastDayPrev.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrev.getDate()).padStart(2, '0')}`;
      } else {
        const rawFrom = query.fromDate || query.date || today;
        const rawTo = query.toDate || query.fromDate || query.date || today;

        const normalize = (val: string) => {
          const str = String(val).trim();
          if (!str || str.toLowerCase() === 'today') return today;
          if (str.includes('-')) {
            const parts = str.split('-');
            if (parts[0].length === 4) {
              return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          return str;
        };

        fromDate = normalize(rawFrom);
        toDate = normalize(rawTo);
      }

      if (fromDate >= today && toDate >= today) {
        return {
          status: false,
          updated: 0,
          refundedCount: 0,
          totalRefunded: 0,
          message: `Bulk failure can only be processed for past dates. Active orders for today (${today}) are currently in progress.`,
        };
      }

      const params: any[] = [fromDate, toDate];
      let slotClause = '';
      if (query.slot && query.slot !== 'all') {
        params.push(query.slot);
        slotClause = ` AND delivery_slot = $${params.length}`;
      }

      // Find all pending undelivered orders for the specified date range (up to yesterday)
      const candidateOrders = await this.databaseService.query(
        `SELECT order_id, customer_id, total_amount, payment_mode, payment_status, order_source, subscription_id, status, scheduled_date
         FROM orders
         WHERE scheduled_date >= $1::date
           AND scheduled_date <= $2::date
           AND scheduled_date < CURRENT_DATE
           AND status IN ('pending', 'placed', 'confirmed', 'assigned', 'packed', 'out_for_delivery')
           AND status != 'delivered'
           AND status != 'failed'
           AND status != 'cancelled'
           ${slotClause}
         ORDER BY scheduled_date ASC, created_at ASC`,
        params,
      );

      if (!candidateOrders || candidateOrders.length === 0) {
        return {
          status: true,
          updated: 0,
          refundedCount: 0,
          totalRefunded: 0,
          message: `No pending undelivered orders found for period ${fromDate} to ${toDate}`,
        };
      }

      let refundedCount = 0;
      let totalRefunded = 0;
      let oneTimeCount = 0;
      let subscriptionCount = 0;

      for (const ord of candidateOrders) {
        const isOneTime = String(ord.order_source || '').toLowerCase() === 'one-time' || !ord.subscription_id;
        const totalAmount = Number(ord.total_amount || 0);
        const paymentMode = String(ord.payment_mode || '').toLowerCase();
        const paymentStatus = String(ord.payment_status || '').toLowerCase();
        const isPrepaid = (paymentStatus === 'paid' || ['wallet', 'prepaid', 'razorpay', 'online'].includes(paymentMode)) && totalAmount > 0 && paymentStatus !== 'refunded';

        let isRefunded = false;

        // Refund ONLY for one-time prepaid orders
        if (isOneTime) {
          oneTimeCount++;
          if (isPrepaid) {
            try {
              await this.walletLedger.credit({
                customerId: ord.customer_id,
                amount: totalAmount,
                referenceType: 'order_refund',
                referenceId: ord.order_id,
                remarks: `Refund for failed delivery of One-Time Order #${ord.order_id}`,
                createdBy: 'admin',
              });
              isRefunded = true;
              refundedCount++;
              totalRefunded += totalAmount;
            } catch (refundError) {
              this.developer.error('BulkMarkFailed: Failed to refund wallet for one-time order', {
                orderId: ord.order_id,
                customerId: ord.customer_id,
                refundError,
              });
            }
          }
        } else {
          subscriptionCount++;
        }

        // Update order status and payment status if refunded
        await this.databaseService.query(
          `UPDATE orders
           SET status = 'failed',
               payment_status = CASE WHEN $2 = true THEN 'refunded' ELSE payment_status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE order_id = $1`,
          [ord.order_id, isRefunded],
        );

        // Send notifications
        if (ord.customer_id) {
          if (isRefunded) {
            this.pushNotificationService.sendNotificationToUsers([ord.customer_id], {
              title: '📦 Order Delivery Failed & Refunded',
              body: `Your one-time order #${ord.order_id} could not be delivered. ₹${totalAmount.toFixed(2)} has been refunded to your wallet.`,
              data: {
                type: 'order_failed_refund',
                order_id: ord.order_id,
                refund_amount: String(totalAmount),
              },
            }).catch(() => {});
          } else if (isOneTime) {
            this.pushNotificationService.sendNotificationToUsers([ord.customer_id], {
              title: '📦 Order Delivery Failed',
              body: `Your one-time order #${ord.order_id} could not be delivered.`,
              data: {
                type: 'order_failed',
                order_id: ord.order_id,
              },
            }).catch(() => {});
          } else {
            this.pushNotificationService.sendNotificationToUsers([ord.customer_id], {
              title: '🥛 Subscription Delivery Failed',
              body: `Your subscription delivery for #${ord.order_id} could not be delivered today.`,
              data: {
                type: 'subscription_order_failed',
                order_id: ord.order_id,
              },
            }).catch(() => {});
          }
        }
      }

      return {
        status: true,
        updated: candidateOrders.length,
        oneTimeCount,
        subscriptionCount,
        refundedCount,
        totalRefunded: parseFloat(totalRefunded.toFixed(2)),
        message: `${candidateOrders.length} undelivered order(s) marked as failed (${refundedCount} one-time orders refunded ₹${totalRefunded.toFixed(2)}).`,
      };
    } catch (error) {
      this.developer.error('bulkMarkFailed error', { error });
      throw new InternalServerErrorException('Failed to bulk-mark orders as failed');
    }
  }

  // ────────────────────────────────────────────────
  // Single Order Status Update (with One-Time Refund)
  // ────────────────────────────────────────────────
  async updateOrderStatus(orderId: string, status: string, notes?: string) {
    try {
      const normStatus = String(status || '').toLowerCase().replace(/[\s_-]+/g, '_');
      const validStatuses = ['pending', 'placed', 'confirmed', 'assigned', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'failed'];
      if (!validStatuses.includes(normStatus)) {
        return { status: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` };
      }

      const existingOrderRows = await this.databaseService.query(
        `SELECT order_id, customer_id, total_amount, payment_mode, payment_status, order_source, subscription_id, status 
         FROM orders 
         WHERE order_id = $1 OR id::text = $1 LIMIT 1`,
        [orderId],
      );
      if (!existingOrderRows?.length) {
        return { status: false, message: `Order not found: ${orderId}` };
      }
      const existingOrder = existingOrderRows[0];

      const updateFields: string[] = [
        `status = $2`,
        `updated_at = CURRENT_TIMESTAMP`,
      ];
      const params: any[] = [existingOrder.order_id, normStatus];

      let isRefunded = false;
      const isOneTime = String(existingOrder.order_source || '').toLowerCase() === 'one-time' || !existingOrder.subscription_id;

      if (normStatus === 'failed') {
        const totalAmount = Number(existingOrder.total_amount || 0);
        const paymentMode = String(existingOrder.payment_mode || '').toLowerCase();
        const paymentStatus = String(existingOrder.payment_status || '').toLowerCase();
        const isPrepaid = (paymentStatus === 'paid' || ['wallet', 'prepaid', 'razorpay', 'online'].includes(paymentMode)) && totalAmount > 0 && paymentStatus !== 'refunded';

        // Refund ONLY for one-time orders
        if (isOneTime && isPrepaid) {
          try {
            await this.walletLedger.credit({
              customerId: existingOrder.customer_id,
              amount: totalAmount,
              referenceType: 'order_refund',
              referenceId: existingOrder.order_id,
              remarks: `Refund for failed delivery of One-Time Order #${existingOrder.order_id}`,
              createdBy: 'admin',
            });
            updateFields.push(`payment_status = 'refunded'`);
            isRefunded = true;
          } catch (refundError) {
            this.developer.error('Failed to process wallet refund for failed order', {
              orderId: existingOrder.order_id,
              customerId: existingOrder.customer_id,
              totalAmount,
              refundError,
            });
          }
        }
      }

      const sql = `
        UPDATE orders
        SET ${updateFields.join(', ')}
        WHERE order_id = $1
        RETURNING order_id, customer_id, status, payment_status
      `;

      const rows = await this.databaseService.query(sql, params);
      const updatedOrder = rows?.[0];

      if (normStatus === 'failed' && existingOrder.customer_id) {
        const totalAmount = Number(existingOrder.total_amount || 0);
        if (isRefunded) {
          this.pushNotificationService.sendNotificationToUsers([existingOrder.customer_id], {
            title: '📦 Order Delivery Failed & Refunded',
            body: `Your one-time order #${existingOrder.order_id} could not be delivered. ₹${totalAmount.toFixed(2)} has been refunded to your wallet.`,
            data: {
              type: 'order_failed_refund',
              order_id: existingOrder.order_id,
              refund_amount: String(totalAmount),
            },
          }).catch(() => {});
        } else if (isOneTime) {
          this.pushNotificationService.sendNotificationToUsers([existingOrder.customer_id], {
            title: '📦 Order Delivery Failed',
            body: `Your one-time order #${existingOrder.order_id} could not be delivered.`,
            data: {
              type: 'order_failed',
              order_id: existingOrder.order_id,
            },
          }).catch(() => {});
        } else {
          this.pushNotificationService.sendNotificationToUsers([existingOrder.customer_id], {
            title: '🥛 Subscription Delivery Failed',
            body: `Your subscription delivery for #${existingOrder.order_id} could not be delivered today.`,
            data: {
              type: 'subscription_order_failed',
              order_id: existingOrder.order_id,
            },
          }).catch(() => {});
        }
      }

      return {
        status: true,
        message: `Order #${existingOrder.order_id} status updated to ${normStatus}`,
        data: updatedOrder,
        refunded: isRefunded,
      };
    } catch (error) {
      this.developer.error('updateOrderStatus error', { error, orderId, status });
      return { status: false, message: 'Failed to update order status' };
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
