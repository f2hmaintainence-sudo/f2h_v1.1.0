import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { PushNotificationService } from '../../../../shared/pushNotifications/pushNotification.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import * as path from 'path';
import * as fs from 'fs';
@Injectable()
export class DeliveryOrderService {
  constructor(
    private readonly db: DatabaseService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly developer: DeveloperService,
  ) {}

  cleanDeliveryImagePath(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    const idx = imageUrl.indexOf('/uploads/');
    if (idx !== -1) {
      return imageUrl.substring(idx);
    }
    return imageUrl;
  }

  mapDeliveryImage(imagePath: string | null): string | null {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const cleaned = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${backendUrl}${cleaned}`;
  }

  async resolveDeliveryPartner(userId: string) {
    const boyRes = await this.db.query(
      `SELECT id, user_id, full_name, branch_id FROM delivery_partners WHERE user_id = $1 OR delivery_partner_id = $1 LIMIT 1`,
      [userId],
    );
    if (!boyRes?.length) {
      throw new NotFoundException('Delivery boy profile not found for this account');
    }
    return boyRes[0];
  }

  async buildDeliveryResponses(orders: any[]) {
    const orderIds = orders.map((o: any) => o.order_id);

    const items = await this.db.query(
      `SELECT
         oi.order_id,
         oi.quantity,
         oi.final_price,
         pv.name AS product_name,
         pv.unit_value,
         pv.unit_type,
         COALESCE(c.is_returnable, p.is_returnable, false) AS is_returnable
       FROM order_items oi
       JOIN product_variants pv ON pv.variant_id = oi.variant_id
       JOIN products p ON p.product_id = pv.product_id
       LEFT JOIN containers c ON c.container_id = pv.container_id
       WHERE oi.order_id = ANY($1)`,
      [orderIds],
    );

    const itemsByOrder: Record<string, any[]> = {};
    const expectedBottlesByOrder: Record<string, number> = {};
    for (const item of items || []) {
      const key = String(item.order_id);
      if (!itemsByOrder[key]) itemsByOrder[key] = [];
      itemsByOrder[key].push({
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit: `${item.unit_value}${item.unit_type}`,
        price: Number(item.final_price),
      });

      if (item.is_returnable) {
        expectedBottlesByOrder[key] = (expectedBottlesByOrder[key] || 0) + Number(item.quantity);
      }
    }

    const collectedRes = await this.db.query(
      `SELECT reference_id AS order_id, COALESCE(SUM(quantity), 0) AS collected
       FROM container_transactions
       WHERE reference_type = 'order'
         AND reference_id = ANY($1)
         AND transaction_type = 'return'
       GROUP BY reference_id`,
      [orderIds],
    );

    const collectedBottlesByOrder: Record<string, number> = {};
    for (const row of collectedRes || []) {
      collectedBottlesByOrder[String(row.order_id)] = Number(row.collected);
    }

    const customerIds = [...new Set(orders.map((o: any) => o.customer_id))];
    const bottlesWithCustomerByCustomer: Record<string, number> = {};
    if (customerIds.length > 0) {
      const balanceRes = await this.db.query(
        `SELECT customer_id, 
                COALESCE(SUM(issued_quantity - returned_quantity - damaged_quantity - lost_quantity), 0) AS balance
         FROM customer_container_balances
         WHERE customer_id = ANY($1)
         GROUP BY customer_id`,
        [customerIds],
      );
      for (const row of balanceRes || []) {
        bottlesWithCustomerByCustomer[String(row.customer_id)] = Number(row.balance);
      }
    }

    return orders.map((o: any, idx: number) => ({
      stop: o.sequence_number ?? o.sequence_no ?? idx + 1,
      order_id: o.order_id,
      subscription_id: o.subscription_id,
      order_type: o.order_type,
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      address_id: o.address_id,
      address: o.customer_address,
      address_lat: Number(o.address_lat),
      address_lng: Number(o.address_lng),
      zone_id: o.zone_id,
      route_id: o.route_id,
      route_name: o.route_name,
      branch_id: o.branch_id,
      delivery_slot: o.delivery_slot,
      scheduled_date: o.scheduled_date,
      status: o.status,
      subtotal: Number(o.subtotal),
      discount_amount: Number(o.discount_amount),
      gst_amount: Number(o.gst_amount),
      payment_mode: o.payment_mode,
      payment_status: o.payment_status,
      is_cod: o.payment_mode === 'cod',
      cod_amount: o.payment_mode === 'cod' ? Number(o.total_amount) : null,
      total_amount: Number(o.total_amount),
      delivery_partner_id: o.delivery_partner_id,
      delivery_session_id: o.delivery_session_id ?? o.run_id ?? null,
      run_id: o.run_id ?? null,
      special_instructions: o.special_instructions,
      invoice_image: o.invoice_image,
      delivery_image: this.mapDeliveryImage(o.delivery_image),
      payment_screenshot: o.payment_screenshot,
      created_at: o.created_at,
      updated_at: o.updated_at,
      empty_bottles_expected: expectedBottlesByOrder[String(o.order_id)] || 0,
      empty_bottles_collected: collectedBottlesByOrder[String(o.order_id)] || 0,
      bottles_with_customer: bottlesWithCustomerByCustomer[String(o.customer_id)] || 0,
      products: itemsByOrder[String(o.order_id)] || [],
    }));
  }

  getRunIdentifiers(run: any): string[] {
    const ids = [String(run.id)];
    if (run.run_id && String(run.run_id) !== String(run.id)) {
      ids.push(String(run.run_id));
    }
    return ids;
  }

  async resolveRunByIdentifier(identifier: string | number | null | undefined) {
    if (!identifier) return null;
    const idStr = String(identifier);
    const runRes = await this.db.query(
      `SELECT id, run_id, status, delivery_slot AS slot, run_date, branch_id
       FROM delivery_runs
       WHERE id::text = $1 OR run_id::text = $1
       LIMIT 1`,
      [idStr],
    );
    if (!runRes?.length) return null;
    const run = runRes[0];
    return { run, ids: this.getRunIdentifiers(run) };
  }

  async findDeliveryRunByIdAndBoy(runId: string, boy: any) {
    const runRes = await this.db.query(
      `SELECT id, run_id, status, delivery_slot AS slot, run_date, branch_id FROM delivery_runs
       WHERE delivery_partner_id = $1
         AND (id::text = $2::text OR run_id::text = $2::text)
       LIMIT 1`,
      [String(boy.user_id), runId],
    );
    if (!runRes?.length) {
      throw new NotFoundException('Delivery run not found');
    }
    return runRes[0];
  }

  getKolkataDateAndSlot(dateParam?: string): { targetDate: string; targetSlot: string } {
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const targetDate = dateParam || kolkataDateStr;

    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(timeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(timeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const targetSlot = h < 13 || (h === 13 && m < 30) ? 'morning' : 'evening';

    return { targetDate, targetSlot };
  }

  normalizeDeliveryBody(body: any) {
    const damagedQty = Number(body.damaged_containers ?? body.damagedContainers ?? 0);
    const lostQty = Number(body.lost_containers ?? body.lostContainers ?? 0);
    return {
      paymentMode: (body.payment_mode || body.paymentMode || null) as string | null,
      paymentStatus: (body.payment_status || body.paymentStatus || null) as string | null,
      deliveryImage: this.cleanDeliveryImagePath(body.delivery_image || body.deliveryImage),
      bottles: (body.empty_bottles_collected ?? body.emptyBottlesCollected ?? 0) as number,
      returnedContainers: (body.returned_containers ?? body.returnedContainers ?? 0) as number,
      damagedContainers: (damagedQty + lostQty) as number,
      lostContainers: 0 as number,
      notes: (body.remarks || body.notes || null) as string | null,
      latitude: body.latitude ? Number(body.latitude) : null,
      longitude: body.longitude ? Number(body.longitude) : null,
      cashOverride: body.cash_collected !== undefined
        ? Number(body.cash_collected)
        : body.cashCollected !== undefined
          ? Number(body.cashCollected)
          : undefined,
    };
  }

  computeCashCollected(
    norm: { cashOverride?: number },
    orders: any[],
    status: string,
    paymentMode: string | null,
  ): number {
    if (norm.cashOverride !== undefined) return norm.cashOverride;
    let cash = 0;
    if (['delivered', 'partial'].includes(status)) {
      for (const o of orders) {
        if (paymentMode === 'cod' || o.payment_mode === 'cod') {
          cash += Number(o.total_amount || 0);
        }
      }
    }
    return cash;
  }

  buildItemsJson(items: any[], defaultSlot?: string): any[] {
    return items.map((item) => {
      const slot = item.delivery_slot || defaultSlot;
      const isMorning = slot === 'morning'
        || slot?.toString().toLowerCase().startsWith('m')
        || slot?.startsWith('AM');
      return {
        product_variant_id: item.variant_id,
        product_name: item.product_name || 'Product',
        m_qty: isMorning ? Number(item.quantity) : 0,
        e_qty: !isMorning ? Number(item.quantity) : 0,
      };
    });
  }

  async isRunHandedOver(runId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM delivery_logs
       WHERE run_id = $1
         AND (remarks = 'Warehouse handover completed' OR remarks = 'Warehouse handover confirmed')
       LIMIT 1`,
      [runId],
    );
    return !!(res?.length);
  }

  async upsertDeliveryLog(
    client: any,
    params: {
      orderId: string;
      runIdentifier: string;
      customerId: string;
      addressId: string;
      deliveryPartnerId: string;
      deliveryDate: string;
      slot: string;
      itemsJson: any[];
      status: string;
      norm: {
        bottles: number; returnedContainers: number; damagedContainers: number;
        lostContainers: number; deliveryImage: string | null;
        notes: string | null; latitude: number | null; longitude: number | null;
      };
      cashCollected: number;
    },
  ): Promise<void> {
    const { orderId, norm, status, cashCollected } = params;
    const updateRes = await client.query(
      `UPDATE delivery_logs
       SET bottles_collected = $1, cash_collected = $2,
           latitude = $3, longitude = $4, status = $5,
           delivered_at = NOW(), returned_containers = $6,
           damaged_containers = $7, lost_containers = $8,
           proof_photo_url = $9, delivery_time = NOW()
       WHERE order_id = $10`,
      [
        norm.bottles, cashCollected, norm.latitude, norm.longitude,
        status, norm.returnedContainers, norm.damagedContainers,
        norm.lostContainers, norm.deliveryImage, orderId,
      ],
    );
    if (updateRes.rowCount === 0) {
      await client.query(
        `INSERT INTO delivery_logs (
          order_id, run_id, customer_id, address_id, delivery_partner_id,
          delivery_date, delivery_slot, items_json, status,
          bottles_collected, cash_collected, latitude, longitude,
          proof_photo_url, delivery_time, returned_containers,
          damaged_containers, lost_containers, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15, $16, $17, NOW(), NOW())`,
        [
          orderId, params.runIdentifier, params.customerId, params.addressId,
          params.deliveryPartnerId, params.deliveryDate, params.slot,
          JSON.stringify(params.itemsJson), status, norm.bottles, cashCollected,
          norm.latitude, norm.longitude, norm.deliveryImage, norm.returnedContainers,
          norm.damagedContainers, norm.lostContainers,
        ],
      );
    }
  }

  async handleContainerReturn(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
      customerId: string;
      referenceOrderId: string;
      containerId: string;
      returned: number;
      damaged: number;
      lost: number;
      remarks: string | null;
      createdBy: string;
    },
  ): Promise<void> {
    const total = Number(params.returned || 0) + Number(params.damaged || 0) + Number(params.lost || 0);
    if (total <= 0) return;

    if (params.returned > 0) {
      await executor.query(
        `INSERT INTO container_transactions (
           customer_id, container_id, reference_type, reference_id,
           transaction_type, quantity, remarks, transaction_date, created_by
         ) VALUES ($1, $2, 'order', $3, 'return', $4, $5, CURRENT_DATE, $6)`,
        [params.customerId, params.containerId, params.referenceOrderId, params.returned,
         params.remarks || 'Collected by delivery boy', params.createdBy],
      );
    }

    if (params.damaged > 0) {
      await executor.query(
        `INSERT INTO container_transactions (
           customer_id, container_id, reference_type, reference_id,
           transaction_type, quantity, remarks, transaction_date, created_by
         ) VALUES ($1, $2, 'order', $3, 'damaged', $4, 'Damaged during delivery', CURRENT_DATE, $5)`,
        [params.customerId, params.containerId, params.referenceOrderId, params.damaged, params.createdBy],
      );
    }

    if (params.lost > 0) {
      await executor.query(
        `INSERT INTO container_transactions (
           customer_id, container_id, reference_type, reference_id,
           transaction_type, quantity, remarks, transaction_date, created_by
         ) VALUES ($1, $2, 'order', $3, 'lost', $4, 'Lost during delivery', CURRENT_DATE, $5)`,
        [params.customerId, params.containerId, params.referenceOrderId, params.lost, params.createdBy],
      );
    }

    await executor.query(
      `INSERT INTO customer_container_balances (
         customer_id, container_id, issued_quantity, returned_quantity,
         damaged_quantity, lost_quantity, updated_at
       ) VALUES ($1, $2, 0, $3, $4, $5, NOW())
       ON CONFLICT (customer_id, container_id)
       DO UPDATE SET
         returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
         damaged_quantity = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
         lost_quantity = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
         updated_at = NOW()`,
      [params.customerId, params.containerId, params.returned, params.damaged, params.lost],
    );
  }

  async handleBottleReturn(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
      customerId: string;
      referenceOrderId: string;
      returned: number;
      damaged: number;
      lost: number;
      remarks: string | null;
      createdBy: string;
    },
  ): Promise<void> {
    return this.handleContainerReturn(executor, {
      customerId: params.customerId,
      referenceOrderId: params.referenceOrderId,
      containerId: 'CONT-001',
      returned: params.returned,
      damaged: params.damaged,
      lost: params.lost,
      remarks: params.remarks,
      createdBy: params.createdBy,
    });
  }

  async handleContainerIssue(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
      customerId: string;
      referenceOrderId: string;
      containerId: string;
      quantity: number;
      createdBy: string;
    },
  ): Promise<void> {
    if (params.quantity <= 0) return;

    await executor.query(
      `INSERT INTO container_transactions (
         customer_id, container_id, reference_type, reference_id,
         transaction_type, quantity, remarks, transaction_date, created_by
       ) VALUES ($1, $2, 'order', $3, 'issue', $4, 'Issued during delivery', CURRENT_DATE, $5)`,
      [params.customerId, params.containerId, params.referenceOrderId, params.quantity, params.createdBy],
    );

    await executor.query(
      `INSERT INTO customer_container_balances (
         customer_id, container_id, issued_quantity, returned_quantity,
         damaged_quantity, lost_quantity, updated_at
       ) VALUES ($1, $2, $3, 0, 0, 0, NOW())
       ON CONFLICT (customer_id, container_id)
       DO UPDATE SET
         issued_quantity = customer_container_balances.issued_quantity + EXCLUDED.issued_quantity,
         updated_at = NOW()`,
      [params.customerId, params.containerId, params.quantity],
    );
  }

  async handleBottleIssue(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
      customerId: string;
      referenceOrderId: string;
      packagingTypeId: string;
      quantity: number;
      createdBy: string;
    },
  ): Promise<void> {
    return this.handleContainerIssue(executor, {
      customerId: params.customerId,
      referenceOrderId: params.referenceOrderId,
      containerId: params.packagingTypeId,
      quantity: params.quantity,
      createdBy: params.createdBy,
    });
  }

  async getTodayRun(userId: string, dateParam?: string, status?: string) {
    const boy = await this.resolveDeliveryPartner(userId);
    const { targetDate, targetSlot } = this.getKolkataDateAndSlot(dateParam);

    const runs = await this.db.query(
      `SELECT id, run_id, status, delivery_slot, run_date
       FROM delivery_runs
       WHERE delivery_partner_id = $1
         AND DATE(run_date AT TIME ZONE 'Asia/Kolkata') = $2::date
         AND delivery_slot = $3
         AND status != 'cancelled'
       ORDER BY run_date DESC, created_at DESC`,
      [String(boy.user_id), targetDate, targetSlot],
    );

    let activeRunId: string | null = null;
    let activeRunStatus: string | null = null;

    if (runs?.length) {
      const activeRun = runs[0];
      activeRunId = activeRun.run_id || String(activeRun.id);
      activeRunStatus = activeRun.status;

      if (activeRunStatus === 'completed') {
        if (await this.isRunHandedOver(activeRunId!)) {
          activeRunStatus = 'handed_over';
        }
      }
    }

    const orderStatuses = status
      ? [status]
      : ['confirmed', 'out_for_delivery', 'delivered', 'failed', 'assigned', 'packed'];

    const orders = await this.db.query(
      `SELECT
          o.order_id,
          o.subscription_id,
          CASE WHEN o.subscription_id IS NULL THEN 'single' ELSE 'subscription' END AS order_type,
          o.customer_id,
          o.status,
          o.address_id,
          NULL AS zone_id,
          drc.route_id::text AS route_id,
          COALESCE(r.route_name, o.delivery_run_id::text) AS route_name,
          o.branch_id,
          o.delivery_slot,
          o.scheduled_date,
          o.subtotal,
          o.discount_amount,
          o.gst_amount,
          o.payment_mode,
          o.payment_status,
          o.total_amount,
          o.delivery_partner_id,
          o.delivery_run_id AS run_id,
          o.special_instructions,
          o.invoice_image,
          o.delivery_image,
          o.payment_screenshot,
          o.created_at,
          o.updated_at,
          COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
          c.phone AS customer_phone,
          COALESCE(ca.flat_no, '') || ' ' ||
          COALESCE(ca.building_name, '') || ' ' ||
          COALESCE(ca.street, '') || ' ' ||
          COALESCE(ca.area, '') AS customer_address,
          COALESCE(ca.latitude, 0.0) AS address_lat,
          COALESCE(ca.longitude, 0.0) AS address_lng,
          o.run_sequence AS sequence_number
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN customer_addresses ca
         ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
       LEFT JOIN delivery_route_customers drc
         ON drc.customer_id = c.id
       LEFT JOIN delivery_routes r
         ON r.id = drc.route_id
        WHERE o.delivery_partner_id = $1
          AND o.status = ANY($3)
          AND DATE(o.scheduled_date AT TIME ZONE 'Asia/Kolkata') = $2::date
          AND o.delivery_slot = $4
        ORDER BY o.run_sequence ASC NULLS LAST,
                 o.created_at ASC`,
      [String(boy.user_id), targetDate, orderStatuses, targetSlot],
    );

    if (!activeRunId && orders?.length) {
      const orderWithRun = orders.find((o: any) => o.run_id);
      if (orderWithRun) {
        activeRunId = orderWithRun.run_id;
        activeRunStatus = 'in_progress';
      }
    }

    if (activeRunId && activeRunStatus === 'in_progress') {
      const dbRun = await this.db.query(
        `SELECT status FROM delivery_runs WHERE run_id = $1 OR id::text = $1 LIMIT 1`,
        [activeRunId],
      );
      if (dbRun?.length && dbRun[0].status === 'completed') {
        activeRunStatus = (await this.isRunHandedOver(activeRunId!)) ? 'handed_over' : 'completed';
      }
    }

    if (!orders?.length) {
      return {
        status: true,
        delivery_partner: { id: boy.id, name: boy.full_name },
        date: targetDate,
        run_id: activeRunId,
        run_status: activeRunStatus,
        total: 0,
        deliveries: [],
      };
    }

    const deliveries = await this.buildDeliveryResponses(orders);

    return {
      status: true,
      delivery_partner: { id: boy.id, name: boy.full_name },
      date: targetDate,
      run_id: activeRunId,
      run_status: activeRunStatus,
      total: deliveries.length,
      deliveries,
    };
  }

  async startTodayRun(userId: string, runId: string) {
    const boy = await this.resolveDeliveryPartner(userId);
    const run = await this.findDeliveryRunByIdAndBoy(runId, boy);

    if (!['pending', 'assigned', 'planned', 'dispatched'].includes(run.status)) {
      return { success: true, message: 'Run already started or completed', status: run.status };
    }

    const runIdentifier = run.run_id || String(run.id);

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE delivery_runs SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [run.id],
      );

      const runAddressesRes = await client.query(
        `SELECT order_id FROM orders WHERE delivery_run_id = ANY($1)`,
        [this.getRunIdentifiers(run)],
      );
      const runAddresses = runAddressesRes.rows || [];
      const orderIds = runAddresses.map((row) => String(row.order_id));

      if (orderIds.length > 0) {
        await client.query(
          `UPDATE orders
             SET status = 'out_for_delivery',
                 delivery_partner_id = $1,
                 delivery_run_id = $2,
                 updated_at = NOW()
             WHERE order_id = ANY($3) AND status IN ('pending', 'placed', 'confirmed', 'packed', 'assigned')`,
          [boy.user_id, runIdentifier, orderIds],
        );
      }
    });

    return { success: true, message: 'Delivery run started successfully', status: 'in_progress' };
  }

  async markStopDelivered(
    userId: string,
    runId: string,
    addressId: string,
    body: any,
  ) {
    const boy = await this.resolveDeliveryPartner(userId);
    const run = await this.findDeliveryRunByIdAndBoy(runId, boy);
    const runIds = this.getRunIdentifiers(run);
    const runIdentifier = run.run_id || String(run.id);

    const stopsRes = await this.db.query(
      `SELECT order_id, customer_id, status, total_amount, payment_mode FROM orders
       WHERE delivery_run_id = ANY($1) AND address_id = $2`,
      [runIds, addressId],
    );

    if (!stopsRes?.length) {
      throw new NotFoundException('No orders found for this stop');
    }

    const norm = this.normalizeDeliveryBody(body);
    const status = body.status || 'delivered';

    await this.db.transaction(async (client) => {
      let isFirstOrder = true;
      for (const order of stopsRes) {
        if (['delivered', 'failed'].includes(order.status)) continue;

        // Perform bottle/container collection ONLY ONCE for the stop to prevent duplication
        if (norm.bottles > 0 && isFirstOrder) {
          await this.handleBottleReturn(client, {
            customerId: order.customer_id,
            referenceOrderId: order.order_id,
            returned: norm.bottles,
            damaged: norm.damagedContainers,
            lost: norm.lostContainers,
            remarks: norm.notes,
            createdBy: boy.full_name,
          });
        }

        const cashCollected = this.computeCashCollected(norm, [order], status, norm.paymentMode);

        // Update order record
        await client.query(
          `UPDATE orders 
           SET status = $1, payment_mode = COALESCE($2, payment_mode),
               payment_status = COALESCE($3, payment_status),
               delivery_image = COALESCE($4, delivery_image),
               updated_at = NOW()
           WHERE order_id = $5`,
          [status, norm.paymentMode, norm.paymentStatus, norm.deliveryImage, order.order_id],
        );

        // Add order status log
        await client.query(
          `INSERT INTO order_status_logs (order_id, status, notes, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [order.order_id, status, norm.notes || `Stop marked as ${status} by driver`, boy.full_name],
        );

        const itemsRes = await client.query(
          `SELECT variant_id, quantity FROM order_items WHERE order_id = $1`,
          [order.order_id],
        );
        const itemsJson = this.buildItemsJson(itemsRes.rows || [], run.slot);

        // Zero out counts for subsequent orders of the same stop in log entries to prevent duplicate sums
        const orderNorm = {
          ...norm,
          bottles: isFirstOrder ? norm.bottles : 0,
          returnedContainers: isFirstOrder ? norm.returnedContainers : 0,
          damagedContainers: isFirstOrder ? norm.damagedContainers : 0,
          lostContainers: isFirstOrder ? norm.lostContainers : 0,
        };

        await this.upsertDeliveryLog(client, {
          orderId: order.order_id,
          runIdentifier,
          customerId: order.customer_id,
          addressId,
          deliveryPartnerId: boy.user_id,
          deliveryDate: new Date().toISOString().split('T')[0],
          slot: run.slot || 'morning',
          itemsJson,
          status,
          norm: orderNorm,
          cashCollected,
        });

        isFirstOrder = false;
      }
    });

    return { success: true, message: `Stop marked as ${status} successfully` };
  }

  async handoverRun(userId: string, runId: string) {
    const boy = await this.resolveDeliveryPartner(userId);
    const run = await this.findDeliveryRunByIdAndBoy(runId, boy);
    const runIds = this.getRunIdentifiers(run);
    const runIdentifier = run.run_id || String(run.id);

    if (await this.isRunHandedOver(runIdentifier)) {
      return {
        success: true,
        message: 'Run already handed over',
        status: 'handed_over',
        empty_bottles_returned: 0,
        returned_items: [],
      };
    }

    const bottlesRes = await this.db.query(
      `SELECT COALESCE(SUM(bottles_collected), 0) AS total_bottles
       FROM delivery_logs
       WHERE run_id = ANY($1) AND status != 'pickup_confirmed' AND status != 'handed_over'`,
      [runIds],
    );
    const totalBottles = Number(bottlesRes[0]?.total_bottles || 0);

    const returnedItemsRes = await this.db.query(
      `SELECT 
           oi.variant_id, 
           pv.name AS product_name, 
           SUM(oi.quantity) AS quantity,
           pv.unit_value,
           pv.unit_type
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.order_id
         JOIN product_variants pv ON pv.variant_id = oi.variant_id
         WHERE o.delivery_run_id = ANY($1) 
           AND o.status != 'delivered'
         GROUP BY oi.variant_id, pv.name, pv.unit_value, pv.unit_type`,
      [runIds],
    );

    const returnedItems = (returnedItemsRes || []).map((item: any) => ({
      product_variant_id: item.variant_id,
      product_name: item.product_name || 'Unknown Product',
      quantity: Number(item.quantity),
      unit: `${item.unit_value || 1}${item.unit_type || 'PCS'}`,
    }));

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE delivery_runs SET status = 'completed', actual_end_time = COALESCE(actual_end_time, NOW()), updated_at = NOW() WHERE id = $1`,
        [run.id],
      );

      await client.query(
        `UPDATE delivery_logs
           SET delivery_date = CURRENT_DATE,
               photo_id = NULL,
               bottles_collected = COALESCE(bottles_collected, 0),
               cash_collected = COALESCE(cash_collected, 0),
               remarks = 'Warehouse handover completed',
               status = 'completed',
               delivered_at = NOW(),
               created_at = NOW()
           WHERE run_id = ANY($1)`,
        [runIds],
      );
    });

    return {
      success: true,
      message: 'Run handed over successfully',
      status: 'handed_over',
      empty_bottles_returned: totalBottles,
      returned_items: returnedItems,
    };
  }

  async markOrdersOutForDelivery(userId: string) {
    const boy = await this.resolveDeliveryPartner(userId);
    const targetDate = new Date().toISOString().split('T')[0];

    const pendingRes = await this.db.query(
      `SELECT order_id FROM orders
       WHERE delivery_partner_id = $1
         AND status = 'confirmed'
         AND DATE(scheduled_date) <= $2::date`,
      [String(boy.user_id), targetDate],
    );

    if (!pendingRes?.length) {
      return {
        success: true,
        message: 'No pending orders to mark',
        updated_count: 0,
      };
    }

    const orderIds = pendingRes.map((r: any) => r.order_id);

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE orders
           SET status = 'out_for_delivery',
               delivery_partner_id = $1,
               updated_at = NOW()
           WHERE order_id = ANY($2)
             AND status NOT IN ('cancelled', 'delivered', 'failed', 'out_for_delivery')`,
        [boy.user_id, orderIds],
      );

      await client.query(
        `INSERT INTO order_status_logs (order_id, status, notes, changed_by, created_at)
           SELECT oid, 'out_for_delivery', 'Rider confirmed pickup — marked out for delivery', $2, NOW()
           FROM unnest($1::text[]) AS oid`,
        [orderIds, boy.full_name],
      );
    });

    return {
      success: true,
      message: 'Orders marked out for delivery successfully',
      updated_count: orderIds.length,
    };
  }

  async updateOrderStatus(userId: string, orderId: string, body: any) {
    const boy = await this.resolveDeliveryPartner(userId);

    const orderRes = await this.db.query(
      `SELECT order_id, status, customer_id, delivery_partner_id, delivery_run_id AS delivery_session_id, address_id, scheduled_date, delivery_slot, payment_mode, total_amount
       FROM orders WHERE order_id = $1`,
      [orderId],
    );
    if (!orderRes?.length) throw new NotFoundException('Order not found');
    const order = orderRes[0];

    if (String(order.delivery_partner_id) !== String(boy.user_id)) {
      throw new ForbiddenException('You are not authorized to update this order status');
    }

    if (['delivered', 'failed'].includes(order.status)) {
      return { success: true, message: 'Order status already updated', status: order.status };
    }

    const norm = this.normalizeDeliveryBody(body);
    const status = body.status || 'delivered';

    await this.db.transaction(async (client) => {
      if (norm.bottles > 0) {
        await this.handleBottleReturn(client, {
          customerId: order.customer_id,
          referenceOrderId: order.order_id,
          returned: norm.bottles,
          damaged: norm.damagedContainers,
          lost: norm.lostContainers,
          remarks: norm.notes,
          createdBy: boy.full_name,
        });
      }

      const cashCollected = this.computeCashCollected(norm, [order], status, norm.paymentMode);

      await client.query(
        `UPDATE orders 
         SET status = $1, payment_mode = COALESCE($2, payment_mode),
             payment_status = COALESCE($3, payment_status),
             delivery_image = COALESCE($4, delivery_image),
             updated_at = NOW()
         WHERE order_id = $5`,
        [status, norm.paymentMode, norm.paymentStatus, norm.deliveryImage, order.order_id],
      );

      await client.query(
        `INSERT INTO order_status_logs (order_id, status, notes, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [order.order_id, status, norm.notes || `Order marked as ${status} by driver`, boy.full_name],
      );

      const itemsRes = await client.query(
        `SELECT variant_id, quantity FROM order_items WHERE order_id = $1`,
        [order.order_id],
      );
      const itemsJson = this.buildItemsJson(itemsRes.rows || [], order.delivery_slot);

      await this.upsertDeliveryLog(client, {
        orderId: order.order_id,
        runIdentifier: order.delivery_session_id || 'legacy',
        customerId: order.customer_id,
        addressId: order.address_id,
        deliveryPartnerId: boy.user_id,
        deliveryDate: new Date().toISOString().split('T')[0],
        slot: order.delivery_slot || 'morning',
        itemsJson,
        status,
        norm,
        cashCollected,
      });
    });

    return { success: true, message: `Order status updated to ${status} successfully` };
  }

  async getPickupItems(userId: string, dateParam?: string) {
    const boy = await this.resolveDeliveryPartner(userId);
    const { targetDate, targetSlot } = this.getKolkataDateAndSlot(dateParam);

    const runs = await this.db.query(
      `SELECT id, run_id, status, delivery_slot AS slot, run_date FROM delivery_runs
         WHERE delivery_partner_id = $1
           AND DATE(run_date AT TIME ZONE 'Asia/Kolkata') = $2::date
           AND delivery_slot = $3
           AND status NOT IN ('completed', 'handed_over', 'cancelled')
         ORDER BY run_date DESC, created_at DESC`,
      [String(boy.user_id), targetDate, targetSlot],
    );

    let runIds: string[] = [];
    let runIdentifier: string | null = null;
    let runStatus = 'pending';
    let runSlot = 'morning';
    let stops: any[] = [];
    const runOrderIds: string[] = [];

    if (runs?.length) {
      const run = runs[0];
      runIdentifier = run.run_id || String(run.id);
      runStatus = run.status;
      runSlot = run.slot || 'morning';

      runIds = runs.flatMap((r: any) => {
        const ids = [String(r.id)];
        if (r.run_id && String(r.run_id) !== String(r.id)) ids.push(String(r.run_id));
        return ids;
      });

      stops = await this.db.query(
        `SELECT
             o.run_sequence AS sequence_no,
             o.address_id,
             o.order_id,
             o.customer_id,
             COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
             COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address
           FROM orders o
           JOIN customers c ON c.customer_id = o.customer_id
           LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
           WHERE o.delivery_run_id = ANY($1)
             AND o.status IN ('confirmed', 'out_for_delivery', 'assigned', 'packed')
             AND o.delivery_slot = $2
           ORDER BY o.run_sequence ASC`,
        [runIds, targetSlot],
      );

      for (const stop of stops || []) {
        if (stop.order_id) {
          runOrderIds.push(String(stop.order_id));
        }
      }
    }

    const directOrders = await this.db.query(
      `SELECT
           1 AS sequence_no,
           o.address_id,
           o.order_id,
           o.customer_id,
           COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
           COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address
         FROM orders o
         JOIN customers c ON c.customer_id = o.customer_id
         LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
         WHERE o.delivery_partner_id = $1
           AND DATE(o.scheduled_date AT TIME ZONE 'Asia/Kolkata') = $2::date
           AND o.status IN ('confirmed', 'out_for_delivery', 'assigned', 'packed')
           AND o.delivery_slot = $3`,
      [String(boy.user_id), targetDate, targetSlot],
    );

    const directStops = directOrders || [];
    for (const stop of directStops) {
      if (stop.order_id && !runOrderIds.includes(String(stop.order_id))) {
        runOrderIds.push(String(stop.order_id));
        stops.push(stop);
      }
    }

    if (!runs?.length && !stops?.length) {
      return {
        status: true,
        delivery_partner: { id: boy.id, name: boy.full_name },
        date: targetDate,
        run_id: null,
        pickup_confirmed: false,
        items: [],
        message: 'No delivery run or orders found for today',
      };
    }

    const allOrderIds: string[] = [];
    for (const stop of stops || []) {
      if (stop.order_id) {
        allOrderIds.push(String(stop.order_id));
      }
    }

    let items: any[] = [];
    const itemsByOrder: Record<string, any[]> = {};

    if (allOrderIds.length > 0) {
      const orderItems = await this.db.query(
        `SELECT
             oi.order_id,
             oi.variant_id AS product_variant_id,
             oi.quantity,
             pv.name AS product_name,
             pv.unit_value,
             pv.unit_type,
             p.is_returnable
           FROM order_items oi
           JOIN product_variants pv ON pv.variant_id = oi.variant_id
           LEFT JOIN products p ON p.product_id = pv.product_id
           WHERE oi.order_id = ANY($1)`,
        [allOrderIds],
      );

      for (const item of orderItems || []) {
        const key = String(item.order_id);
        if (!itemsByOrder[key]) itemsByOrder[key] = [];
        itemsByOrder[key].push({
          product_variant_id: item.product_variant_id,
          product_name: item.product_name,
          quantity: Number(item.quantity),
          unit: `${item.unit_value}${item.unit_type}`,
          unit_value: item.unit_value || 1,
          is_returnable: item.is_returnable || false,
        });
      }

      const consolidatedPickupItems: Record<string, any> = {};
      for (const orderId of allOrderIds) {
        const oItems = itemsByOrder[String(orderId)] || [];
        for (const item of oItems) {
          const key = `${item.product_variant_id}_${item.unit}`;
          if (!consolidatedPickupItems[key]) {
            consolidatedPickupItems[key] = {
              id: key,
              dispatch_id: '',
              product_variant_id: item.product_variant_id,
              product_name: item.product_name || 'Unknown Product',
              quantity: item.quantity,
              unit: item.unit || 'PCS',
              unit_value: item.unit_value || 1,
              is_returnable: item.is_returnable || false,
              loaded_qty: 0,
            };
          } else {
            consolidatedPickupItems[key].quantity += item.quantity;
          }
        }
      }
      items = Object.values(consolidatedPickupItems);
    }

    const baggingInstructions = (stops || []).map((stop: any) => {
      const ids = stop.order_id ? [String(stop.order_id)] : [];
      const stopItems: any[] = [];
      for (const orderId of ids) {
        const oItems = itemsByOrder[orderId] || [];
        stopItems.push(...oItems);
      }

      const consolidatedItems: Record<string, any> = {};
      for (const item of stopItems) {
        const key = `${item.product_name}_${item.unit}`;
        if (!consolidatedItems[key]) {
          consolidatedItems[key] = { ...item };
        } else {
          consolidatedItems[key].quantity += item.quantity;
        }
      }

      return {
        sequence_no: stop.sequence_no,
        customer_name: stop.customer_name,
        address: stop.customer_address,
        items: Object.values(consolidatedItems),
      };
    });

    return {
      status: true,
      delivery_partner: { id: boy.id, name: boy.full_name },
      date: targetDate,
      run_id: runIdentifier,
      run_status: runStatus,
      slot: runSlot,
      pickup_confirmed: ['in_progress', 'completed', 'partial'].includes(String(runStatus)),
      items,
      bagging_instructions: baggingInstructions,
    };
  }

  async confirmPickup(
    userId: string,
    body: {
      run_id: string;
      items: Array<{ product_variant_id: string; confirmed_qty: number }>;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const boy = await this.resolveDeliveryPartner(userId);
    const run = await this.findDeliveryRunByIdAndBoy(body.run_id, boy);
    const runIds = this.getRunIdentifiers(run);
    const runIdentifier = run.run_id || String(run.id);

    if (!['planned', 'assigned', 'dispatched'].includes(String(run.status))) {
      return { success: true, message: 'Pickup already confirmed', status: run.status };
    }

    await this.db.transaction(async (client) => {
      for (const item of body.items) {
        await client.query(
          `UPDATE delivery_dispatch_items
             SET loaded_qty = $1, updated_at = NOW()
             WHERE delivery_run_id = ANY($2) AND product_variant_id = $3`,
          [item.confirmed_qty, runIds, item.product_variant_id],
        );
      }

      await client.query(
        `UPDATE delivery_runs
           SET status = 'in_progress',
               actual_start_time = COALESCE(actual_start_time, NOW()),
               updated_at = NOW()
           WHERE id = $1`,
        [run.id],
      );

      const runAddressesRes = await client.query(
        `SELECT order_id FROM orders WHERE delivery_run_id = ANY($1)`,
        [runIds],
      );
      const orderIds = (runAddressesRes.rows || []).map((row) => String(row.order_id));

      if (orderIds.length > 0) {
        await client.query(
          `UPDATE orders
             SET status = 'out_for_delivery',
                 delivery_partner_id = $1,
                 delivery_run_id = $2,
                 updated_at = NOW()
             WHERE order_id = ANY($3)
               AND status IN ('pending', 'placed', 'confirmed', 'packed', 'assigned')`,
          [boy.user_id, runIdentifier, orderIds],
        );
      }

      await client.query(
        `UPDATE delivery_logs
           SET status = 'pickup_confirmed',
               latitude = COALESCE($2, latitude),
               longitude = COALESCE($3, longitude),
               delivery_time = NOW(),
               remarks = 'Warehouse pickup confirmed'
           WHERE run_id = ANY($1)
             AND status = 'pending'`,
        [
          runIds,
          body.latitude ? Number(body.latitude) : null,
          body.longitude ? Number(body.longitude) : null,
        ],
      );
    });

    return {
      success: true,
      message: 'Pickup confirmed successfully',
      run_id: runIdentifier,
      status: 'in_progress',
    };
  }

  async updateOrderContainers(
    userId: string,
    id: string,
    body: {
      container_updates: Array<{
        container_id: string;
        expected_quantity?: number;
        returned_quantity?: number;
        status?: string;
        notes?: string;
      }>;
    },
  ) {
    const boy = await this.resolveDeliveryPartner(userId);

    const orderRes = await this.db.query(
      `SELECT order_id, customer_id FROM orders
       WHERE (order_id = $1 OR id::text = $1)
         AND delivery_partner_id::text = $2
       LIMIT 1`,
      [id, String(boy.user_id)],
    );
    if (!orderRes?.length) {
      throw new NotFoundException('Order not found or not assigned to you');
    }

    const order = orderRes[0];
    const { container_updates } = body;

    if (!Array.isArray(container_updates) || container_updates.length === 0) {
      throw new BadRequestException('container_updates must be a non-empty array');
    }

    for (const item of container_updates) {
      const { container_id, expected_quantity = 1, returned_quantity = 0, status = 'returned', notes } = item;
      if (!container_id) continue;

      await this.db.query(
        `INSERT INTO order_containers 
         (order_id, customer_id, container_id, expected_quantity, returned_quantity, status, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [order.order_id, order.customer_id, container_id, expected_quantity, returned_quantity, status, notes || null],
      );

      const txnType = status === 'returned' ? 'return' : status === 'broken' ? 'damaged' : status === 'lost' ? 'lost' : 'issue';
      const qty = Math.max(1, Number(returned_quantity || expected_quantity || 1));

      await this.db.query(
        `INSERT INTO container_transactions 
         (customer_id, container_id, reference_type, reference_id, transaction_type, quantity, remarks, transaction_date, created_by)
         VALUES ($1, $2, 'order', $3, $4, $5, $6, CURRENT_DATE, $7)`,
        [order.customer_id, container_id, order.order_id, txnType, qty, notes || `Order ${order.order_id} container check (${status})`, boy.full_name || String(boy.user_id)],
      ).catch(() => null);

      const returnAdd = txnType === 'return' ? qty : 0;
      const damagedAdd = txnType === 'damaged' ? qty : 0;
      const lostAdd = txnType === 'lost' ? qty : 0;

      await this.db.query(
        `INSERT INTO customer_container_balances 
         (customer_id, container_id, issued_quantity, returned_quantity, damaged_quantity, lost_quantity, updated_at)
         VALUES ($1, $2, 0, $3, $4, $5, NOW())
         ON CONFLICT (customer_id, container_id) DO UPDATE SET
           returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
           damaged_quantity = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
           lost_quantity = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
           updated_at = NOW()`,
        [order.customer_id, container_id, returnAdd, damagedAdd, lostAdd],
      ).catch(() => null);
    }

    return {
      success: true,
      message: 'Container checklist & statuses updated successfully',
    };
  }
}
