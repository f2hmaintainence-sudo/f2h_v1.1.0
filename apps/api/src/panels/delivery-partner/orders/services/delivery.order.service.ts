import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { PushNotificationService } from '../../../../shared/pushNotifications/pushNotification.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { FirstOrderDetectorService } from '../../../customer/referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from '../../../customer/referral/services/referral-reward-engine.service';
import { isDispatchHandedOver } from '../dispatch-status';

@Injectable()
export class DeliveryOrderService {
  constructor(
    private readonly db: DatabaseService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly developer: DeveloperService,
    private readonly firstOrderDetector: FirstOrderDetectorService,
    private readonly referralRewardEngine: ReferralRewardEngineService,
  ) { }

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
    // delivery_partners has no surrogate `id` and no separate `user_id` — the
    // partner is keyed by delivery_partner_id, which is also the users.user_id.
    // The `id`/`user_id` aliases keep the shape callers in this service expect.
    const boyRes = await this.db.query(
      `SELECT dp.delivery_partner_id AS id,
              dp.delivery_partner_id AS user_id,
              dp.delivery_partner_id,
              dp.branch_id,
              COALESCE(
                NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
                u.user_name,
                dp.delivery_partner_id
              ) AS full_name
       FROM delivery_partners dp
       LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
       WHERE dp.delivery_partner_id = $1
         AND dp.deleted_at IS NULL
       LIMIT 1`,
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
         (
           SELECT COALESCE(NULLIF(pi.url, ''), '/uploads/' || pi.storage_key)
           FROM product_images pi
           WHERE (pi.variant_id = pv.variant_id OR pi.product_id = pv.product_id)
             AND pi.deleted_at IS NULL
           ORDER BY (pi.variant_id = pv.variant_id) DESC, pi.is_primary DESC, pi.sort_order ASC
           LIMIT 1
         ) AS product_image,
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
        product_image: item.product_image || null,
        image_url: item.product_image || null,
      });

      if (item.is_returnable) {
        expectedBottlesByOrder[key] = (expectedBottlesByOrder[key] || 0) + Number(item.quantity);
      }
    }

    // 1. Fetch expected containers by order
    const expectedContainersRes = await this.db.query(
      `SELECT oi.order_id, pv.container_id, COALESCE(c.name, 'Glass Bottle') AS container_name, SUM(oi.quantity)::int AS expected
       FROM order_items oi
       JOIN product_variants pv ON pv.variant_id = oi.variant_id
       JOIN products p ON p.product_id = pv.product_id
       LEFT JOIN containers c ON (c.container_id = pv.container_id OR c.id::text = pv.container_id)
       WHERE oi.order_id = ANY($1) AND (COALESCE(c.is_returnable, p.is_returnable, false) = true OR pv.container_id IS NOT NULL)
       GROUP BY oi.order_id, pv.container_id, c.name`,
      [orderIds],
    );

    const expectedContainersMap: Record<string, Record<string, { name: string; expected: number }>> = {};
    for (const row of expectedContainersRes || []) {
      const oid = String(row.order_id);
      const cid = String(row.container_id || 'CONT-001');
      if (!expectedContainersMap[oid]) expectedContainersMap[oid] = {};
      expectedContainersMap[oid][cid] = { name: row.container_name, expected: row.expected };
    }

    // 2. Fetch customer container balances
    const customerIds = [...new Set(orders.map((o: any) => o.customer_id))];
    const balancesMap: Record<string, Record<string, { name: string; balance: number }>> = {};
    const bottlesWithCustomerByCustomer: Record<string, number> = {};

    if (customerIds.length > 0) {
      const balanceRes = await this.db.query(
        `SELECT cb.customer_id, cb.container_id, c.name AS container_name,
                COALESCE(SUM(cb.issued_quantity - cb.returned_quantity - cb.damaged_quantity - cb.lost_quantity), 0)::int AS balance
         FROM customer_container_balances cb
         JOIN containers c ON c.container_id = cb.container_id
         WHERE cb.customer_id = ANY($1)
         GROUP BY cb.customer_id, cb.container_id, c.name`,
        [customerIds],
      );

      for (const row of balanceRes || []) {
        const custId = String(row.customer_id);
        const cid = String(row.container_id);
        if (!balancesMap[custId]) balancesMap[custId] = {};
        balancesMap[custId][cid] = { name: row.container_name, balance: row.balance };

        // For legacy single field support
        if (cid === 'CONT-001') {
          bottlesWithCustomerByCustomer[custId] = row.balance;
        }
      }
    }

    const collectedContainersMap: Record<string, Record<string, number>> = {};
    const collectedBottlesByOrder: Record<string, number> = {};

    return orders.map((o: any, idx: number) => {
      const ordId = String(o.order_id);
      const custId = String(o.customer_id);

      // Aggregate all container lists for this specific order/customer
      const containersToCollect: any[] = [];
      const allCids = new Set([
        ...Object.keys(expectedContainersMap[ordId] || {}),
        ...Object.keys(balancesMap[custId] || {}),
      ]);

      for (const cid of allCids) {
        const name = expectedContainersMap[ordId]?.[cid]?.name || balancesMap[custId]?.[cid]?.name || 'Container';
        const expected = expectedContainersMap[ordId]?.[cid]?.expected || 0;
        const balance = balancesMap[custId]?.[cid]?.balance || 0;
        const collected = collectedContainersMap[ordId]?.[cid] || 0;

        containersToCollect.push({
          container_id: cid,
          name,
          expected: expected,
          expected_delivery: expected,
          balance: balance,
          customer_balance: balance,
          max_collectable: expected + balance,
          collected,
        });
      }

      return {
        stop: o.sequence_number ?? o.sequence_no ?? idx + 1,
        order_id: o.order_id,
        subscription_id: o.subscription_id,
        order_type: o.order_type,
        customer_id: o.customer_id,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        address_id: o.address_id,
        address: (o.customer_address || '').trim(),
        landmark: (o.customer_landmark || '').trim() || null,
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
        empty_bottles_expected: expectedBottlesByOrder[ordId] || 0,
        empty_bottles_collected: collectedBottlesByOrder[ordId] || 0,
        bottles_with_customer: bottlesWithCustomerByCustomer[custId] || 0,
        containers_to_collect: containersToCollect,
        container_balances: containersToCollect,
        products: itemsByOrder[ordId] || [],
      };
    });
  }

  getRunIdentifiers(run: any): string[] {
    const ids = [String(run.id)];
    if (run.run_id && String(run.run_id) !== String(run.id)) {
      ids.push(String(run.run_id));
    }
    return ids;
  }


  /**
   * The active delivery_dispatch row for a run. `delivery_dispatch.delivery_run_id`
   * stores the textual run_id, but callers may hold either the numeric id or the
   * run_id, so both identifiers are passed through.
   */
  async findActiveDispatchForRun(runIds: string[]): Promise<any | null> {
    if (!runIds?.length) return null;

    const res = await this.db.query(
      `SELECT dd.id, dd.dispatch_id, dd.delivery_run_id, dd.status, dd.loaded_at, dd.collected_at
       FROM delivery_dispatch dd
       WHERE dd.delivery_run_id = ANY($1)
         AND dd.deleted_at IS NULL
         AND dd.status NOT IN ('draft', 'completed')
       ORDER BY dd.created_at DESC
       LIMIT 1`,
      [runIds],
    );
    return res?.length ? res[0] : null;
  }

  /**
   * Quantities the partner's assigned orders actually require, per variant, taken
   * from order_items. Scoped to the run's slot so an evening run never counts
   * against a morning dispatch.
   */
  async getOrderedQtyByVariant(
    runIds: string[],
    partnerUserId: string,
    targetDate: string,
    slot: string,
  ): Promise<Record<string, number>> {
    const rows = await this.db.query(
      `SELECT
         oi.variant_id AS product_variant_id,
         SUM(oi.quantity)::numeric AS ordered_qty
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE (o.delivery_run_id = ANY($1) OR o.delivery_partner_id = $2)
         AND (o.scheduled_date::date = $3::date
              OR (o.scheduled_date IS NULL AND DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = $3::date))
         AND (o.delivery_slot = $4 OR o.delivery_slot IS NULL)
         AND o.status NOT IN ('cancelled', 'failed')
       GROUP BY oi.variant_id`,
      [runIds.length ? runIds : ['NONE'], partnerUserId, targetDate, slot],
    );

    const map: Record<string, number> = {};
    for (const r of rows || []) {
      map[String(r.product_variant_id)] = Number(r.ordered_qty || 0);
    }
    return map;
  }

  /**
   * Physical quantity a dispatch row represents. loaded_qty is authoritative once
   * the warehouse has loaded anything; planned_qty stands in only while nothing
   * has been loaded yet.
   */
  effectiveLoadedQty(item: { loaded_qty?: any; planned_qty?: any }): number {
    const loaded = Number(item.loaded_qty || 0);
    return loaded > 0 ? loaded : Number(item.planned_qty || 0);
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

  private cachedSlotTimings: any = null;
  private lastSlotTimingsFetch = 0;

  async getSlotTimingsConfig(): Promise<any> {
    const now = Date.now();
    if (this.cachedSlotTimings && now - this.lastSlotTimingsFetch < 15000) {
      return this.cachedSlotTimings;
    }
    try {
      const rows = await this.db.query(
        `SELECT config_data FROM system_configurations WHERE config_key = 'slot_timings' AND is_active = true LIMIT 1`,
      );
      if (rows?.[0]?.config_data) {
        this.cachedSlotTimings = rows[0].config_data;
        this.lastSlotTimingsFetch = now;
        return this.cachedSlotTimings;
      }
    } catch (_) {}
    return this.cachedSlotTimings || {};
  }

  private parseCutoffMinutes(timeStr?: string, defaultMinutes = 960): number {
    if (!timeStr || typeof timeStr !== 'string') return defaultMinutes;
    const parts = timeStr.split(':');
    if (parts.length < 2) return defaultMinutes;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return defaultMinutes;
    return h * 60 + m;
  }

  async getKolkataDateAndSlot(dateParam?: string, slotParam?: string): Promise<{ targetDate: string; targetSlot: string }> {
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(timeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(timeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const timeMinutes = h * 60 + m;

    const timings = await this.getSlotTimingsConfig();
    // Morning delivery closes at Evening Slot Customer Order Cutoff Time (read directly from system_configurations table)
    const morningClosingMinutes = this.parseCutoffMinutes(timings?.evening_slot?.customer_cutoff_time, 16 * 60);
    // Evening delivery closes at Morning Slot Customer Order Cutoff Time (read directly from system_configurations table)
    const eveningClosingMinutes = this.parseCutoffMinutes(timings?.morning_slot?.customer_cutoff_time, 23 * 60);

    let targetSlot = slotParam;
    let targetDate = dateParam || kolkataDateStr;

    if (!targetSlot) {
      if (timeMinutes < morningClosingMinutes) {
        targetSlot = 'morning';
      } else if (timeMinutes < eveningClosingMinutes) {
        targetSlot = 'evening';
      } else {
        // After evening closing, advance target date to next day's morning preparation if no date was passed
        if (!dateParam) {
          const nextDay = new Date();
          nextDay.setDate(nextDay.getDate() + 1);
          targetDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(nextDay);
        }
        targetSlot = 'morning';
      }
    }

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


  async isRunHandedOver(runId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM delivery_runs
       WHERE (run_id = $1 OR id::text = $1)
         AND status = 'completed'
       LIMIT 1`,
      [runId],
    );
    return !!(res?.length);
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
      runId?: string;
      partnerId?: string;
      warehouseId?: string;
    },
  ): Promise<void> {
    const total = Number(params.returned || 0) + Number(params.damaged || 0) + Number(params.lost || 0);
    if (total <= 0) return;

    // Get current customer balance
    const balanceRes = await executor.query(
      `SELECT COALESCE(SUM(issued_quantity - returned_quantity - damaged_quantity - lost_quantity), 0)::int AS balance
       FROM customer_container_balances
       WHERE customer_id = $1 AND container_id = $2`,
      [params.customerId, params.containerId],
    );
    const currentBalance = Number(balanceRes.rows?.[0]?.balance ?? 0);

    // Get expected/delivered in the current order
    const orderExpectedRes = await executor.query(
      `SELECT COALESCE(SUM(oi.quantity), 0)::int AS expected
       FROM order_items oi
       JOIN product_variants pv ON pv.variant_id = oi.variant_id
       JOIN products p ON p.product_id = pv.product_id
       LEFT JOIN containers c ON c.container_id = pv.container_id
       WHERE oi.order_id = $1 AND pv.container_id = $2 AND COALESCE(c.is_returnable, p.is_returnable, false) = true`,
      [params.referenceOrderId, params.containerId],
    );
    const orderExpected = Number(orderExpectedRes.rows?.[0]?.expected ?? 0);

    const maxAllowed = currentBalance + orderExpected;
    if (total > maxAllowed) {
      throw new BadRequestException(
        `Cannot collect ${total} containers. Customer only has ${currentBalance} outstanding containers (plus ${orderExpected} delivered in this order).`
      );
    }

    // 1. Update customer running balance
    await this.applyBalanceDelta(executor, params.customerId, params.containerId, {
      returned: params.returned,
      damaged: params.damaged,
      lost: params.lost,
    });

    // 2. Upsert into delivery_container_reconciliation for this (run_id, container_id)
    if (params.runId) {
      await this.upsertContainerReconciliation(executor, {
        runId: params.runId,
        containerId: params.containerId,
        returned: params.returned,
        damaged: params.damaged,
        lost: params.lost,
        remarks: params.remarks,
        submittedBy: params.partnerId || params.createdBy,
        warehouseId: params.warehouseId,
      });
    }
  }

  private async upsertContainerReconciliation(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
      runId: string;
      containerId: string;
      returned: number;
      damaged: number;
      lost: number;
      remarks?: string | null;
      submittedBy: string;
      warehouseId?: string;
    },
  ): Promise<void> {
    const runId = params.runId;
    const containerId = params.containerId;
    const collectedQty = Number(params.returned || 0);
    const damagedQty = Number(params.damaged || 0);
    const lostQty = Number(params.lost || 0);

    let warehouseId = params.warehouseId;
    if (!warehouseId) {
      const whRes = await executor.query(
        `SELECT warehouse_id FROM delivery_dispatch
         WHERE (delivery_run_id = $1 OR delivery_run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1))
           AND deleted_at IS NULL
         LIMIT 1`,
        [runId],
      );
      warehouseId = whRes.rows?.[0]?.warehouse_id || 'WH-MAIN';
    }

    // Check if record exists for (run_id, container_id)
    const existing = await executor.query(
      `SELECT id, collected_quantity, damaged_quantity, lost_quantity
       FROM delivery_container_reconciliation
       WHERE (run_id = $1 OR run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1))
         AND container_id = $2 AND deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [runId, containerId],
    );

    if (existing.rows && existing.rows.length > 0) {
      await executor.query(
        `UPDATE delivery_container_reconciliation
         SET collected_quantity = collected_quantity + $1,
             damaged_quantity = damaged_quantity + $2,
             lost_quantity = lost_quantity + $3,
             collection_notes = COALESCE($4, collection_notes),
             warehouse_id = COALESCE(warehouse_id, $5),
             updated_at = NOW()
         WHERE id = $6`,
        [collectedQty, damagedQty, lostQty, params.remarks || null, warehouseId, existing.rows[0].id],
      );
    } else {
      await executor.query(
        `INSERT INTO delivery_container_reconciliation (
           warehouse_id, run_id, container_id,
           collected_quantity, submitted_quantity,
           damaged_quantity, lost_quantity,
           status, collection_notes, submitted_by,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3,
           $4, 0,
           $5, $6,
           'pending', $7, $8,
           NOW(), NOW()
         )`,
        [
          warehouseId,
          runId,
          containerId,
          collectedQty,
          damagedQty,
          lostQty,
          params.remarks || 'Collected on route delivery',
          params.submittedBy,
        ],
      );
    }
  }

  /**
   * Adds a delta to a customer's running container balance.
   *
   * (customer_id, container_id) is unique, so this upserts in one statement.
   * `balance_quantity` is a generated column and is never written directly.
   */
  private async applyBalanceDelta(
    executor: { query: (sql: string, params?: any[]) => Promise<any> },
    customerId: string,
    containerId: string,
    delta: { issued?: number; returned?: number; damaged?: number; lost?: number },
  ): Promise<void> {
    await executor.query(
      `INSERT INTO customer_container_balances (
         customer_id, container_id, issued_quantity, returned_quantity,
         damaged_quantity, lost_quantity, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (customer_id, container_id) DO UPDATE SET
         issued_quantity   = customer_container_balances.issued_quantity + EXCLUDED.issued_quantity,
         returned_quantity = customer_container_balances.returned_quantity + EXCLUDED.returned_quantity,
         damaged_quantity  = customer_container_balances.damaged_quantity + EXCLUDED.damaged_quantity,
         lost_quantity     = customer_container_balances.lost_quantity + EXCLUDED.lost_quantity,
         updated_at = NOW()`,
      [
        customerId,
        containerId,
        delta.issued ?? 0,
        delta.returned ?? 0,
        delta.damaged ?? 0,
        delta.lost ?? 0,
      ],
    );
  }

  /**
   * Bottle returns are container returns against the default bottle container.
   */
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
      runId?: string;
      partnerId?: string;
      warehouseId?: string;
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
      runId: params.runId,
      partnerId: params.partnerId,
      warehouseId: params.warehouseId,
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
      runId?: string;
      partnerId?: string;
      warehouseId?: string;
    },
  ): Promise<void> {
    if (params.quantity <= 0) return;

    // 1. Update customer running balance
    await this.applyBalanceDelta(executor, params.customerId, params.containerId, {
      issued: params.quantity,
    });

    // 2. Resolve source warehouse
    let warehouseId = params.warehouseId;
    if (!warehouseId && params.runId) {
      const whRes = await executor.query(
        `SELECT dd.warehouse_id 
         FROM delivery_dispatch dd
         WHERE (dd.delivery_run_id = $1 OR dd.delivery_run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1))
           AND dd.deleted_at IS NULL
         LIMIT 1`,
        [params.runId],
      );
      warehouseId = whRes.rows?.[0]?.warehouse_id || whRes[0]?.warehouse_id;
      if (!warehouseId) {
        const runWh = await executor.query(
          `SELECT w.warehouse_id 
           FROM delivery_runs dr 
           LEFT JOIN warehouses w ON (w.branch_id = dr.branch_id OR w.warehouse_id = dr.warehouse_id) AND w.deleted_at IS NULL 
           WHERE dr.id::text = $1 OR dr.run_id = $1 
           LIMIT 1`,
          [params.runId],
        );
        warehouseId = runWh.rows?.[0]?.warehouse_id || runWh[0]?.warehouse_id;
      }
    }

    if (!warehouseId) {
      const defWh = await executor.query(
        `SELECT warehouse_id FROM warehouses WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1`
      );
      warehouseId = defWh.rows?.[0]?.warehouse_id || defWh[0]?.warehouse_id;
    }

    // 3. Deduct from warehouse container stock
    if (warehouseId) {
      await executor.query(
        `INSERT INTO warehouse_containers (warehouse_id, container_id, quantity, created_at, updated_at)
         VALUES ($1, $2, 0, NOW(), NOW())
         ON CONFLICT (warehouse_id, container_id) DO UPDATE
         SET quantity = GREATEST(0, warehouse_containers.quantity - $3),
             updated_at = NOW()`,
        [warehouseId, params.containerId, params.quantity],
      );

      // 4. Sync total quantity on master containers table
      await executor.query(
        `UPDATE containers 
         SET quantity = (
           SELECT COALESCE(SUM(quantity), 0)::int 
           FROM warehouse_containers 
           WHERE container_id = $1 AND deleted_at IS NULL
         ), updated_at = NOW()
         WHERE container_id = $1`,
        [params.containerId],
      );
    }

    // 5. Upsert reconciliation
    if (params.runId) {
      await this.upsertContainerReconciliation(executor, {
        runId: params.runId,
        containerId: params.containerId,
        returned: 0,
        damaged: 0,
        lost: 0,
        remarks: 'Delivered returnable container on route',
        submittedBy: params.partnerId || params.createdBy,
        warehouseId: warehouseId,
      });
    }
  }


  async getTodayRun(userId: string, dateParam?: string, status?: string) {
    const boy = await this.resolveDeliveryPartner(userId);
    const { targetDate, targetSlot } = await this.getKolkataDateAndSlot(dateParam);

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
    let runIds: string[] = [String(boy.user_id)];

    if (runs?.length) {
      const activeRun = runs[0];
      activeRunId = activeRun.run_id || String(activeRun.id);
      activeRunStatus = activeRun.status;
      runIds = runs.map((r: any) => String(r.run_id || r.id));

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
          o.delivery_run_id::text AS route_id,
          COALESCE(o.delivery_run_id::text, 'Run') AS route_name,
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
          COALESCE(ca.contact_name, NULLIF(TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')), ''), cu.user_name, 'Customer') AS customer_name,
          COALESCE(ca.contact_mobile, cu.phone) AS customer_phone,
          COALESCE(ca.flat_no, '') || ' ' ||
          COALESCE(ca.building_name, '') || ' ' ||
          COALESCE(ca.street, '') || ' ' ||
          COALESCE(ca.area, '') AS customer_address,
          COALESCE(ca.landmark, '') AS customer_landmark,
          COALESCE(ca.latitude, 0.0) AS address_lat,
          COALESCE(ca.longitude, 0.0) AS address_lng,
          o.run_sequence AS sequence_number
       FROM orders o
       JOIN users cu ON cu.user_id = o.customer_id
       LEFT JOIN customer_addresses ca
         ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
        WHERE (o.delivery_partner_id = $1 OR o.delivery_run_id = ANY($5))
          AND o.status = ANY($3)
          AND o.scheduled_date = $2::date
          AND o.delivery_slot = $4
        ORDER BY o.run_sequence ASC NULLS LAST,
                 o.created_at ASC`,
      [String(boy.user_id), targetDate, orderStatuses, targetSlot, runIds],
    );

    if (!activeRunId && orders?.length) {
      const orderWithRun = orders.find((o: any) => o.run_id);
      if (orderWithRun) {
        activeRunId = orderWithRun.run_id;
        activeRunStatus = 'in_progress';
      }
    }

    if (activeRunId) {
      const dbRun = await this.db.query(
        `SELECT status FROM delivery_runs WHERE run_id = $1 OR id::text = $1 LIMIT 1`,
        [activeRunId],
      );
      const currentDbStatus = dbRun?.length ? dbRun[0].status : 'assigned';

      // Only evaluate run completion if the run was actually active/in progress
      if (['in_progress', 'out_for_delivery', 'dispatched'].includes(currentDbStatus)) {
        const uncompletedOrdersRes = await this.db.query(
          `SELECT COUNT(*)::int AS count FROM orders
           WHERE (delivery_run_id = $1 OR delivery_run_id::text = $1)
             AND status NOT IN ('delivered', 'failed', 'completed', 'cancelled')`,
          [activeRunId],
        );
        const uncompletedCount = Number(uncompletedOrdersRes[0]?.count || 0);

        if (uncompletedCount === 0 && orders?.length > 0) {
          await this.db.query(
            `UPDATE delivery_runs SET status = 'completed', actual_end_time = COALESCE(actual_end_time, NOW()), updated_at = NOW() WHERE run_id = $1 OR id::text = $1`,
            [activeRunId],
          );
          activeRunStatus = (await this.isRunHandedOver(activeRunId!)) ? 'handed_over' : 'completed';
        } else {
          activeRunStatus = currentDbStatus;
        }
      } else if (currentDbStatus === 'completed') {
        activeRunStatus = (await this.isRunHandedOver(activeRunId!)) ? 'handed_over' : 'completed';
      } else if (currentDbStatus === 'handed_over') {
        activeRunStatus = 'handed_over';
      } else {
        activeRunStatus = currentDbStatus;
      }
    }

    // The handover state the app gates its Pickup/Confirm action on lives on
    // delivery_dispatch, not on the run — surface it alongside the run status.
    const activeDispatch = activeRunId
      ? await this.findActiveDispatchForRun([...new Set([...runIds, activeRunId])])
      : null;
    const dispatchStatus = activeDispatch?.status || null;
    const pickupConfirmed = isDispatchHandedOver(dispatchStatus);

    if (!orders?.length) {
      return {
        status: true,
        delivery_partner: { id: boy.id, name: boy.full_name },
        date: targetDate,
        run_id: activeRunId,
        run_status: activeRunStatus,
        dispatch_id: activeDispatch?.dispatch_id || null,
        dispatch_status: dispatchStatus,
        pickup_confirmed: pickupConfirmed,
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
      dispatch_id: activeDispatch?.dispatch_id || null,
      dispatch_status: dispatchStatus,
      pickup_confirmed: pickupConfirmed,
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

      await client.query(
        `UPDATE delivery_dispatch
         SET status = 'in_progress', updated_at = NOW()
         WHERE delivery_run_id = ANY($1)
           AND status IN ('collected', 'loaded')`,
        [this.getRunIdentifiers(run)],
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
    const runIdentifier = run.run_id || String(run.id) || runId;
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
      // 1. Mark each order in the stop as delivered/failed & process containers
      let isFirstOrder = true;
      for (const order of stopsRes) {
        if (['delivered', 'failed'].includes(order.status)) continue;

        // Issue containers FIRST (so the balance exists before we try to collect empties)
        if (status === 'delivered') {
          const runIdToUse = runIdentifier || runIds?.[0] || order.delivery_run_id;
          if (Array.isArray(body.container_deliveries) && body.container_deliveries.length > 0) {
            for (const item of body.container_deliveries) {
              const qty = Number(item.quantity ?? item.delivered ?? item.expected ?? 0);
              if (qty > 0) {
                await this.handleContainerIssue(client, {
                  customerId: order.customer_id,
                  referenceOrderId: order.order_id,
                  containerId: item.container_id || 'CONT-001',
                  quantity: qty,
                  createdBy: boy.full_name,
                  runId: runIdToUse,
                  partnerId: boy.user_id,
                });
              }
            }
          } else {
            const returnableItems = await client.query(
              `SELECT oi.quantity, pv.container_id AS container_id
               FROM order_items oi
               JOIN product_variants pv ON pv.variant_id = oi.variant_id
               JOIN products p ON p.product_id = pv.product_id
               LEFT JOIN containers c ON c.container_id = pv.container_id
               WHERE oi.order_id = $1
                 AND pv.container_id IS NOT NULL
                 AND COALESCE(c.is_returnable, p.is_returnable, false) = true`,
              [order.order_id],
            );
            for (const item of returnableItems.rows || []) {
              await this.handleContainerIssue(client, {
                customerId: order.customer_id,
                referenceOrderId: order.order_id,
                containerId: item.container_id,
                quantity: Number(item.quantity),
                createdBy: boy.full_name,
                runId: runIdToUse,
                partnerId: boy.user_id,
              });
            }
          }
        }

        // Perform bottle/container collection ONLY ONCE for the stop to prevent duplication
        if (isFirstOrder) {
          const runIdToUse = runIdentifier || runIds?.[0] || order.delivery_run_id;
          if (Array.isArray(body.container_returns) && body.container_returns.length > 0) {
            for (const cr of body.container_returns) {
              const ret = Number(cr.returned ?? 0);
              const dam = Number(cr.damaged ?? 0);
              const lost = Number(cr.lost ?? 0);
              if (ret > 0 || dam > 0 || lost > 0) {
                await this.handleContainerReturn(client, {
                  customerId: order.customer_id,
                  referenceOrderId: order.order_id,
                  containerId: cr.container_id || 'CONT-001',
                  returned: ret,
                  damaged: dam,
                  lost: lost,
                  remarks: norm.notes,
                  createdBy: boy.full_name,
                  runId: runIdToUse,
                  partnerId: boy.user_id,
                });
              }
            }
          } else if (norm.bottles > 0) {
            await this.handleBottleReturn(client, {
              customerId: order.customer_id,
              referenceOrderId: order.order_id,
              returned: norm.bottles,
              damaged: norm.damagedContainers,
              lost: norm.lostContainers,
              remarks: norm.notes,
              createdBy: boy.full_name,
              runId: runIdToUse,
              partnerId: boy.user_id,
            });
          }
        }

        const cashCollected = this.computeCashCollected(norm, [order], status, norm.paymentMode);

        const effectivePaymentMode = (norm.paymentMode || order.payment_mode || '').toLowerCase();
        const isCOD = (effectivePaymentMode === 'cod' || effectivePaymentMode === 'cash');
        const effectivePaymentStatus = norm.paymentStatus || (status === 'delivered' && isCOD ? 'paid' : null);

        // Update order record
        await client.query(
          `UPDATE orders 
           SET status = $1,
               payment_mode = COALESCE($2, payment_mode),
               payment_status = COALESCE($3, payment_status),
               delivered_at = NOW(),
               delivery_image = COALESCE($4, delivery_image),
               updated_at = NOW()
           WHERE order_id = $5`,
          [
            status,
            norm.paymentMode,
            effectivePaymentStatus,
            norm.deliveryImage,
            order.order_id,
          ],
        );

        // When a COD order is delivered, record cash payment transaction and settle/create customer bill
        if (status === 'delivered' && isCOD) {
          await this.handleCodDeliveryPaymentAndBill(client, order, boy.full_name);
        }

        // Update stop status in delivery_run_addresses
        await client.query(
          `UPDATE delivery_run_addresses
           SET delivery_status = $1,
               delivered_at = NOW(),
               failed_reason = $2,
               delivery_image = COALESCE($3, delivery_image),
               updated_at = NOW()
           WHERE run_id = ANY($4) AND address_id = $5`,
          [status, status === 'failed' ? (norm.notes || 'Delivery failed') : '', norm.deliveryImage, runIds, addressId],
        );

        // Synchronize delivery_runs stop counters, times, and completion status
        await client.query(
          `UPDATE delivery_runs dr
           SET completed_addresses = COALESCE(sub.completed_stops, 0),
               failed_addresses    = COALESCE(sub.failed_stops, 0),
               total_addresses     = GREATEST(COALESCE(dr.total_addresses, 0), COALESCE(sub.total_stops, 0)),
               status              = CASE
                                       WHEN dr.status = 'handed_over' THEN dr.status
                                       WHEN COALESCE(sub.pending_stops, 0) = 0 AND COALESCE(sub.total_stops, 0) > 0 THEN 'completed'
                                       WHEN dr.status = 'assigned' THEN 'in_progress'
                                       ELSE dr.status
                                     END,
               actual_start_time   = COALESCE(dr.actual_start_time, NOW()),
               actual_end_time     = CASE
                                       WHEN COALESCE(sub.pending_stops, 0) = 0 AND COALESCE(sub.total_stops, 0) > 0 THEN COALESCE(dr.actual_end_time, NOW())
                                       ELSE dr.actual_end_time
                                     END,
               updated_at          = NOW()
           FROM (
             SELECT
               dra.run_id,
               COUNT(*)::int AS total_stops,
               COUNT(*) FILTER (WHERE dra.delivery_status = 'delivered')::int AS completed_stops,
               COUNT(*) FILTER (WHERE dra.delivery_status = 'failed')::int AS failed_stops,
               COUNT(*) FILTER (WHERE dra.delivery_status NOT IN ('delivered', 'failed', 'cancelled'))::int AS pending_stops
             FROM delivery_run_addresses dra
             WHERE dra.run_id = ANY($1)
             GROUP BY dra.run_id
           ) sub
           WHERE (dr.run_id = sub.run_id OR dr.id::text = sub.run_id OR dr.run_id = ANY($1) OR dr.id::text = ANY($1))`,
          [runIds],
        );

        // Update delivery_dispatch_items delivered quantities
        if (status === 'delivered') {
          await client.query(
            `UPDATE delivery_dispatch_items ddi
             SET delivered_qty = ddi.delivered_qty + oi.quantity,
                 updated_at = NOW()
             FROM orders o
             JOIN delivery_dispatch dd ON (dd.delivery_run_id = o.delivery_run_id OR dd.delivery_run_id = ANY($2))
             JOIN order_items oi ON oi.order_id = o.order_id
             WHERE o.order_id = $1
               AND ddi.dispatch_id = dd.dispatch_id
               AND ddi.product_variant_id = oi.variant_id
               AND ddi.deleted_at IS NULL`,
            [order.order_id, runIds],
          );
        }

        // Add order status log
        await client.query(
          `INSERT INTO order_status_logs (order_id, status, notes, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [order.order_id, status, norm.notes || `Stop marked as ${status} by driver`, boy.full_name],
        );

        isFirstOrder = false;
      }

      // Ensure dispatch status is in_progress once deliveries are taking place
      await client.query(
        `UPDATE delivery_dispatch
         SET status = 'in_progress', updated_at = NOW()
         WHERE delivery_run_id = ANY($1)
           AND status IN ('collected', 'loaded')`,
        [runIds],
      );

      // Auto-complete the run if all orders are delivered or failed
      const pendingRes = await client.query(
        `SELECT COUNT(*)::int AS count FROM orders
         WHERE delivery_run_id = ANY($1)
           AND status NOT IN ('delivered', 'failed', 'completed', 'cancelled')`,
        [runIds],
      );
      if (Number(pendingRes.rows?.[0]?.count || 0) === 0) {
        await client.query(
          `UPDATE delivery_runs
           SET status = 'completed', actual_end_time = COALESCE(actual_end_time, NOW()), updated_at = NOW()
           WHERE (id::text = ANY($1) OR run_id = ANY($1)) AND status != 'handed_over'`,
          [runIds],
        );
      }
    });

    // Send FCM push notifications to customers for delivered orders
    for (const order of stopsRes) {
      if (status === 'delivered') {
        try {
          await this.pushNotificationService.sendNotificationToUsers(
            [order.customer_id],
            {
              title: '🚚 Order Delivered! 🎉',
              body: 'Your F2H Fresh order has been delivered successfully. Enjoy your fresh items!',
            },
          );
        } catch {
          // Deliberately tolerated: the caller has a valid fallback for this failure.
        }

        if (order.customer_id && order.order_id) {
          try {
            await this.firstOrderDetector.detectAndMarkFirstOrder(order.customer_id, order.order_id);
            await this.firstOrderDetector.unlockReferralCode(order.customer_id);
            await this.referralRewardEngine.processReferralReward(order.customer_id, order.order_id);
          } catch (refErr) {
            this.developer.error('DeliveryOrderService: Failed to process referral reward for stop', {
              orderId: order.order_id,
              customerId: order.customer_id,
              error: refErr,
            });
          }
        }
      }
    }

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
      `SELECT COALESCE(SUM(dcr.collected_quantity), 0) AS total_bottles
       FROM delivery_container_reconciliation dcr
       WHERE dcr.run_id = ANY($1) AND dcr.deleted_at IS NULL`,
      [runIds],
    );
    const totalBottles = Number(bottlesRes?.[0]?.total_bottles || 0);

    const itemsRes = await this.db.query(
      `SELECT dcr.container_id, dcr.collected_quantity AS quantity, c.name AS container_name
       FROM delivery_container_reconciliation dcr
       LEFT JOIN containers c ON c.container_id = dcr.container_id
       WHERE dcr.run_id = ANY($1) AND dcr.deleted_at IS NULL`,
      [runIds],
    );
    const returnedItems = itemsRes || [];

    await this.db.query(
      `UPDATE delivery_runs
       SET status = 'handed_over',
           empty_bottles_collected = $1,
           actual_end_time = COALESCE(actual_end_time, NOW()),
           updated_at = NOW()
       WHERE id::text = ANY($2) OR run_id = ANY($2)`,
      [totalBottles, runIds],
    );

    await this.db.query(
      `UPDATE delivery_dispatch
       SET status = 'return_pending', updated_at = NOW()
       WHERE delivery_run_id = ANY($1)
         AND status != 'completed'`,
      [runIds],
    );

    const cashRes = await this.db.query(
      `SELECT COALESCE(SUM(o.total_amount), 0) AS total_cash_collected
       FROM orders o
       WHERE (o.delivery_run_id = ANY($1))
         AND o.status = 'delivered'
         AND (o.payment_mode = 'cod' OR o.payment_mode = 'cash')`,
      [runIds],
    );
    const totalCashCollected = Number(cashRes?.[0]?.total_cash_collected || 0);

    return {
      success: true,
      message: 'Run handed over successfully',
      status: 'handed_over',
      empty_bottles_returned: totalBottles,
      returned_items: returnedItems,
      total_cash_collected: totalCashCollected,
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
    return this.markDeliveryDelivered(userId, orderId, body);
  }

  async markDeliveryDelivered(
    userId: string,
    orderId: string,
    body: any,
  ) {
    const boy = await this.resolveDeliveryPartner(userId);
    const orderRes = await this.db.query(
      `SELECT order_id, customer_id, status, total_amount, payment_mode, delivery_run_id FROM orders
       WHERE order_id = $1 OR id::text = $1 LIMIT 1`,
      [orderId],
    );
    if (!orderRes?.length) {
      throw new NotFoundException('Order not found');
    }
    const order = orderRes[0];

    if (order.delivery_run_id) {
      const runRes = await this.db.query(
        `SELECT id, run_id, status, delivery_partner_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1 LIMIT 1`,
        [order.delivery_run_id],
      );
      if (runRes?.length) {
        const run = runRes[0];
        if (String(run.delivery_partner_id) !== String(boy.user_id)) {
          throw new ForbiddenException('You are not assigned to this delivery run');
        }
        const runIds = [String(run.id), run.run_id].filter(Boolean);
        const dispatch = await this.findActiveDispatchForRun(runIds);
        if (dispatch && !isDispatchHandedOver(dispatch.status)) {
          throw new BadRequestException(
            'Cannot deliver order: Items have not been picked up from the warehouse yet. Please verify and confirm pickup first.',
          );
        }
      }
    } else if (!['out_for_delivery', 'delivered'].includes(order.status)) {
      const activeRuns = await this.db.query(
        `SELECT id, run_id, status FROM delivery_runs 
         WHERE delivery_partner_id = $1 
           AND DATE(run_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE 
           AND status != 'cancelled' LIMIT 1`,
        [String(boy.user_id)],
      );
      if (activeRuns?.length) {
        const runIds = [String(activeRuns[0].id), activeRuns[0].run_id].filter(Boolean);
        const dispatch = await this.findActiveDispatchForRun(runIds);
        if (dispatch && !isDispatchHandedOver(dispatch.status)) {
          throw new BadRequestException(
            'Cannot deliver order: Items have not been picked up from the warehouse yet. Please verify and confirm pickup first.',
          );
        }
      }
    }

    if (['delivered', 'failed'].includes(order.status)) {
      return { success: true, message: 'Order status already updated', status: order.status };
    }

    const norm = this.normalizeDeliveryBody(body);
    const status = body.status || 'delivered';

    await this.db.transaction(async (client) => {
      // Issue containers FIRST so the balance exists before collection check
      const runIdToUse = order.delivery_run_id;
      if (status === 'delivered') {
        if (Array.isArray(body.container_deliveries) && body.container_deliveries.length > 0) {
          for (const item of body.container_deliveries) {
            const qty = Number(item.quantity ?? item.delivered ?? item.expected ?? 0);
            if (qty > 0) {
              await this.handleContainerIssue(client, {
                customerId: order.customer_id,
                referenceOrderId: order.order_id,
                containerId: item.container_id || 'CONT-001',
                quantity: qty,
                createdBy: boy.full_name,
                runId: runIdToUse,
                partnerId: boy.user_id,
              });
            }
          }
        } else {
          const returnableItems = await client.query(
            `SELECT oi.quantity, pv.container_id AS container_id
             FROM order_items oi
             JOIN product_variants pv ON pv.variant_id = oi.variant_id
             JOIN products p ON p.product_id = pv.product_id
             LEFT JOIN containers c ON c.container_id = pv.container_id
             WHERE oi.order_id = $1
               AND pv.container_id IS NOT NULL
               AND COALESCE(c.is_returnable, p.is_returnable, false) = true`,
            [order.order_id],
          );
          for (const item of returnableItems.rows || []) {
            await this.handleContainerIssue(client, {
              customerId: order.customer_id,
              referenceOrderId: order.order_id,
              containerId: item.container_id,
              quantity: Number(item.quantity),
              createdBy: boy.full_name,
              runId: runIdToUse,
              partnerId: boy.user_id,
            });
          }
        }
      }

      // Now collect returned containers (balance already updated above)
      if (Array.isArray(body.container_returns) && body.container_returns.length > 0) {
        for (const cr of body.container_returns) {
          const ret = Number(cr.returned ?? 0);
          const dam = Number(cr.damaged ?? 0);
          const lost = Number(cr.lost ?? 0);
          if (ret > 0 || dam > 0 || lost > 0) {
            await this.handleContainerReturn(client, {
              customerId: order.customer_id,
              referenceOrderId: order.order_id,
              containerId: cr.container_id || 'CONT-001',
              returned: ret,
              damaged: dam,
              lost: lost,
              remarks: norm.notes,
              createdBy: boy.full_name,
              runId: runIdToUse,
              partnerId: boy.user_id,
            });
          }
        }
      } else if (norm.bottles > 0) {
        await this.handleBottleReturn(client, {
          customerId: order.customer_id,
          referenceOrderId: order.order_id,
          returned: norm.bottles,
          damaged: norm.damagedContainers,
          lost: norm.lostContainers,
          remarks: norm.notes,
          createdBy: boy.full_name,
          runId: runIdToUse,
          partnerId: boy.user_id,
        });
      }

      const cashCollected = this.computeCashCollected(norm, [order], status, norm.paymentMode);

      const effectivePaymentMode = (norm.paymentMode || order.payment_mode || '').toLowerCase();
      const isCOD = (effectivePaymentMode === 'cod' || effectivePaymentMode === 'cash');
      const effectivePaymentStatus = norm.paymentStatus || (status === 'delivered' && isCOD ? 'paid' : null);

      await client.query(
        `UPDATE orders 
         SET status = $1,
             payment_mode = COALESCE($2, payment_mode),
             payment_status = COALESCE($3, payment_status),
             delivered_at = NOW(),
             delivery_image = COALESCE($4, delivery_image),
             updated_at = NOW()
         WHERE order_id = $5`,
        [status, norm.paymentMode, effectivePaymentStatus, norm.deliveryImage, order.order_id],
      );

      if (status === 'delivered' && isCOD) {
        await this.handleCodDeliveryPaymentAndBill(client, order, boy.full_name);
      }

      // Update delivery_dispatch_items delivered quantities
      if (status === 'delivered') {
        await client.query(
          `UPDATE delivery_dispatch_items ddi
           SET delivered_qty = ddi.delivered_qty + oi.quantity,
               updated_at = NOW()
           FROM orders o
           JOIN delivery_dispatch dd ON dd.delivery_run_id = o.delivery_run_id
           JOIN order_items oi ON oi.order_id = o.order_id
           WHERE o.order_id = $1
             AND ddi.dispatch_id = dd.dispatch_id
             AND ddi.product_variant_id = oi.variant_id
             AND ddi.deleted_at IS NULL`,
          [order.order_id],
        );
      }

      await client.query(
        `INSERT INTO order_status_logs (order_id, status, notes, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [order.order_id, status, norm.notes || `Order marked as ${status} by driver`, boy.full_name],
      );

      // Auto-complete and update delivery_runs if order belongs to a run
      if (order.delivery_run_id) {
        if (order.address_id) {
          await client.query(
            `UPDATE delivery_run_addresses dra
             SET delivery_status = $1,
                 delivered_at = NOW(),
                 delivery_image = COALESCE($2, delivery_image),
                 updated_at = NOW()
             WHERE (dra.run_id = $3 OR dra.run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $3 OR run_id = $3))
               AND dra.address_id = $4
               AND NOT EXISTS (
                 SELECT 1 FROM orders o
                 WHERE o.delivery_run_id = dra.run_id
                   AND o.address_id = dra.address_id
                   AND o.status NOT IN ('delivered', 'failed', 'completed', 'cancelled')
               )`,
            [status, norm.deliveryImage, order.delivery_run_id, order.address_id],
          );
        }

        // Synchronize delivery_runs stop counters, times, and completion status
        await client.query(
          `UPDATE delivery_runs dr
           SET completed_addresses = COALESCE(sub.completed_stops, 0),
               failed_addresses    = COALESCE(sub.failed_stops, 0),
               total_addresses     = GREATEST(COALESCE(dr.total_addresses, 0), COALESCE(sub.total_stops, 0)),
               status              = CASE
                                       WHEN dr.status = 'handed_over' THEN dr.status
                                       WHEN COALESCE(sub.pending_stops, 0) = 0 AND COALESCE(sub.total_stops, 0) > 0 THEN 'completed'
                                       WHEN dr.status = 'assigned' THEN 'in_progress'
                                       ELSE dr.status
                                     END,
               actual_start_time   = COALESCE(dr.actual_start_time, NOW()),
               actual_end_time     = CASE
                                       WHEN COALESCE(sub.pending_stops, 0) = 0 AND COALESCE(sub.total_stops, 0) > 0 THEN COALESCE(dr.actual_end_time, NOW())
                                       ELSE dr.actual_end_time
                                     END,
               updated_at          = NOW()
           FROM (
             SELECT
               dra.run_id,
               COUNT(*)::int AS total_stops,
               COUNT(*) FILTER (WHERE dra.delivery_status = 'delivered')::int AS completed_stops,
               COUNT(*) FILTER (WHERE dra.delivery_status = 'failed')::int AS failed_stops,
               COUNT(*) FILTER (WHERE dra.delivery_status NOT IN ('delivered', 'failed', 'cancelled'))::int AS pending_stops
             FROM delivery_run_addresses dra
             WHERE dra.run_id = $1 OR dra.run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1)
             GROUP BY dra.run_id
           ) sub
           WHERE (dr.run_id = sub.run_id OR dr.id::text = sub.run_id OR dr.run_id = $1 OR dr.id::text = $1)`,
          [order.delivery_run_id],
        );

        const pendingRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM orders
           WHERE delivery_run_id = $1
             AND status NOT IN ('delivered', 'failed', 'completed', 'cancelled')`,
          [order.delivery_run_id],
        );
        if (Number(pendingRes.rows?.[0]?.count || 0) === 0) {
          await client.query(
            `UPDATE delivery_runs
             SET status = 'completed', actual_end_time = COALESCE(actual_end_time, NOW()), updated_at = NOW()
             WHERE (id::text = $1 OR run_id = $1) AND status != 'handed_over'`,
            [order.delivery_run_id],
          );
        }
      }
    });

    if (status === 'delivered' && order.customer_id && order.order_id) {
      try {
        await this.firstOrderDetector.detectAndMarkFirstOrder(order.customer_id, order.order_id);
        await this.firstOrderDetector.unlockReferralCode(order.customer_id);
        await this.referralRewardEngine.processReferralReward(order.customer_id, order.order_id);
      } catch (refErr) {
        this.developer.error('DeliveryOrderService: Failed to process referral reward for order', {
          orderId: order.order_id,
          customerId: order.customer_id,
          error: refErr,
        });
      }
    }

    return { success: true, message: `Order status updated to ${status} successfully` };
  }

  async getPickupItems(userId: string, dateParam?: string) {
    const boy = await this.resolveDeliveryPartner(userId);
    const { targetDate, targetSlot } = await this.getKolkataDateAndSlot(dateParam);

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
             COALESCE(ca.contact_name, NULLIF(TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')), ''), cu.user_name, 'Customer') AS customer_name,
             COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address,
             COALESCE(ca.landmark, '') AS customer_landmark
           FROM orders o
           JOIN users cu ON cu.user_id = o.customer_id
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
           COALESCE(ca.contact_name, NULLIF(TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')), ''), cu.user_name, 'Customer') AS customer_name,
           COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address,
           COALESCE(ca.landmark, '') AS customer_landmark
         FROM orders o
         JOIN users cu ON cu.user_id = o.customer_id
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

    // 1. Resolve the active dispatch for this run. Its status — not the run status —
    //    decides whether the handover has already happened.
    const dispatch = await this.findActiveDispatchForRun(runIds);
    const dispatchStatus = dispatch?.status || 'draft';

    // 2. Fetch items ONLY from delivery_dispatch_items, keyed on the active dispatch_id
    //    so EXTRA quantities loaded at the warehouse come through untouched.
    const dispatchItemsRes = dispatch
      ? await this.db.query(
        `SELECT
             ddi.id,
             ddi.dispatch_id,
             ddi.product_variant_id,
             pv.name AS product_name,
             pv.unit_value,
             pv.unit_type,
             p.is_returnable,
             COALESCE(ddi.planned_qty, 0)::numeric AS planned_qty,
             COALESCE(ddi.loaded_qty, 0)::numeric AS loaded_qty,
             COALESCE(ddi.delivered_qty, 0)::numeric AS delivered_qty,
             COALESCE(ddi.returned_qty, 0)::numeric AS returned_qty,
             COALESCE(ddi.damaged_qty, 0)::numeric AS damaged_qty,
             COALESCE(ddi.unit::text, pv.unit_type::text, 'PCS') AS unit
           FROM delivery_dispatch_items ddi
           LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
           LEFT JOIN products p ON p.product_id = pv.product_id
           WHERE ddi.dispatch_id = $1
             AND ddi.deleted_at IS NULL
           ORDER BY pv.name`,
        [dispatch.dispatch_id],
      )
      : [];

    // 3. Quantities the assigned orders require, from order_items.
    const orderedMap = await this.getOrderedQtyByVariant(runIds, String(boy.user_id), targetDate, targetSlot);

    const items = (dispatchItemsRes || []).map((di: any) => {
      const vId = String(di.product_variant_id);
      const orderedQty = orderedMap[vId] || 0;
      const plannedQty = Number(di.planned_qty || 0);
      const loadedQty = Number(di.loaded_qty || 0);
      const deliveredQty = Number(di.delivered_qty || 0);
      const returnedQty = Number(di.returned_qty || 0);
      const damagedQty = Number(di.damaged_qty || 0);
      const effectiveStock = this.effectiveLoadedQty(di);

      return {
        id: di.id ? String(di.id) : vId,
        dispatch_id: di.dispatch_id,
        product_variant_id: vId,
        product_name: di.product_name || 'Product Item',
        unit: `${di.unit_value || ''}${di.unit || 'PCS'}`,
        unit_value: di.unit_value || 1,
        is_returnable: di.is_returnable || false,
        planned_qty: plannedQty,
        loaded_qty: loadedQty,
        delivered_qty: deliveredQty,
        returned_qty: returnedQty,
        damaged_qty: damagedQty,
        ordered_qty: orderedQty,
        required_qty: orderedQty,
        extra_qty: Math.max(0, effectiveStock - orderedQty),
        shortage_qty: Math.max(0, orderedQty - effectiveStock),
        remaining_qty: Math.max(0, orderedQty - deliveredQty),
        in_basket_qty: Math.max(0, loadedQty - deliveredQty - returnedQty - damagedQty),
        is_sufficient: effectiveStock >= orderedQty,
        is_extra_only: orderedQty === 0 && effectiveStock > 0,
        quantity: effectiveStock,
      };
    });

    // A variant the orders need but the dispatch never loaded is a shortage that must
    // block confirmation, so it has to be counted even though it has no dispatch row.
    const dispatchedVariantIds = new Set(items.map((i) => i.product_variant_id));
    const missingVariantIds = Object.keys(orderedMap).filter(
      (vId) => orderedMap[vId] > 0 && !dispatchedVariantIds.has(vId),
    );

    const isSufficientForOrders =
      missingVariantIds.length === 0 &&
      items.filter((i) => i.ordered_qty > 0).every((i) => i.is_sufficient);

    const isConfirmed = isDispatchHandedOver(dispatchStatus);

    return {
      status: true,
      delivery_partner: { id: boy.id, name: boy.full_name },
      date: targetDate,
      run_id: runIdentifier,
      run_status: runStatus,
      slot: runSlot,
      dispatch_id: dispatch?.dispatch_id || null,
      dispatch_status: dispatchStatus,
      has_dispatch: !!dispatch,
      pickup_confirmed: isConfirmed,
      can_confirm_pickup: !!dispatch && !isConfirmed && isSufficientForOrders && items.length > 0,
      is_sufficient_for_orders: isSufficientForOrders,
      missing_variant_ids: missingVariantIds,
      items,
    };
  }

  /**
   * Takes custody of a loaded dispatch: validates that what the warehouse loaded
   * covers what the assigned orders need, then moves delivery_dispatch,
   * delivery_runs, delivery_run_addresses and orders forward together in a single
   * transaction so a partial handover can never be persisted.
   */
  async confirmPickup(
    userId: string,
    body: {
      run_id?: string;
      items?: Array<{ product_variant_id: string; confirmed_qty: number }>;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const boy = await this.resolveDeliveryPartner(userId);
    let run: any;
    if (body?.run_id && body.run_id.trim().length > 0) {
      run = await this.findDeliveryRunByIdAndBoy(body.run_id, boy);
    } else {
      const activeRuns = await this.db.query(
        `SELECT id, run_id, status, delivery_slot AS slot, run_date, branch_id
         FROM delivery_runs
         WHERE delivery_partner_id = $1
           AND DATE(run_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
           AND status != 'cancelled'
         ORDER BY created_at DESC
         LIMIT 1`,
        [String(boy.user_id)],
      );
      if (!activeRuns?.length) {
        throw new NotFoundException('No active delivery run found for today');
      }
      run = activeRuns[0];
    }
    const runIds = this.getRunIdentifiers(run);
    const runIdentifier = run.run_id || String(run.id);
    const runSlot = run.slot || run.delivery_slot || 'morning';
    const { targetDate } = await this.getKolkataDateAndSlot();

    const dispatch = await this.findActiveDispatchForRun(runIds);

    if (!dispatch) {
      throw new BadRequestException(
        'No dispatch has been loaded for this run yet. Please wait for the warehouse to load your items.',
      );
    }

    // The dispatch status is the single source of truth for the handover. A run
    // sitting at 'in_progress' with a dispatch still at 'loaded' is NOT confirmed —
    // treating it as confirmed is what left the dispatch stuck and hid the action.
    if (isDispatchHandedOver(dispatch.status)) {
      return {
        success: true,
        message: 'Pickup already confirmed',
        status: run.status,
        run_id: runIdentifier,
        dispatch_id: dispatch.dispatch_id,
        dispatch_status: dispatch.status,
        pickup_confirmed: true,
      };
    }

    const orderedMap = await this.getOrderedQtyByVariant(runIds, String(boy.user_id), targetDate, runSlot);

    const confirmedQtyByVariant = new Map<string, number>();
    for (const item of body.items || []) {
      if (!item?.product_variant_id) continue;
      confirmedQtyByVariant.set(String(item.product_variant_id), Number(item.confirmed_qty || 0));
    }

    const result = await this.db.transaction(async (client) => {
      // 1. Apply the quantities the partner actually accepted at the warehouse.
      //    Only rows the client named are touched, so EXTRA items the app did not
      //    send keep their loaded_qty instead of being silently zeroed.
      for (const [variantId, confirmedQty] of confirmedQtyByVariant) {
        await client.query(
          `UPDATE delivery_dispatch_items
           SET loaded_qty = $1, updated_at = NOW()
           WHERE dispatch_id = $2
             AND product_variant_id = $3
             AND deleted_at IS NULL`,
          [confirmedQty, dispatch.dispatch_id, variantId],
        );
      }

      // 2. Re-read the dispatch inside the transaction and validate sufficiency
      //    against the post-update quantities — validating before the update would
      //    let a client confirm short by sending lower quantities.
      const dispatchItems = await client.query(
        `SELECT product_variant_id,
                COALESCE(loaded_qty, 0)::numeric AS loaded_qty,
                COALESCE(planned_qty, 0)::numeric AS planned_qty
         FROM delivery_dispatch_items
         WHERE dispatch_id = $1 AND deleted_at IS NULL`,
        [dispatch.dispatch_id],
      );

      const loadedMap: Record<string, number> = {};
      for (const di of dispatchItems.rows || []) {
        loadedMap[String(di.product_variant_id)] = this.effectiveLoadedQty(di);
      }

      const shortages: string[] = [];
      for (const [variantId, orderedQty] of Object.entries(orderedMap)) {
        if (orderedQty <= 0) continue;
        const loadedQty = loadedMap[variantId] || 0;
        if (loadedQty < orderedQty) {
          shortages.push(`${variantId} (loaded ${loadedQty}, required ${orderedQty})`);
        }
      }

      if (shortages.length) {
        throw new BadRequestException(
          `Cannot confirm pickup: dispatched quantities are insufficient for the assigned orders — ${shortages.join(
            ', ',
          )}. Please ask the warehouse to load the missing quantities.`,
        );
      }

      // 3. delivery_dispatch: loaded -> collected (the partner now holds the stock)
      const updatedDispatch = await client.query(
        `UPDATE delivery_dispatch
         SET status = 'collected',
             collected_at = COALESCE(collected_at, NOW()),
             loaded_by = COALESCE(loaded_by, $1),
             updated_at = NOW()
         WHERE dispatch_id = $2
         RETURNING dispatch_id, status`,
        [boy.user_id, dispatch.dispatch_id],
      );

      // 4. delivery_runs: the route is now under way
      await client.query(
        `UPDATE delivery_runs
         SET status = 'in_progress',
             actual_start_time = COALESCE(actual_start_time, NOW()),
             updated_at = NOW()
         WHERE (id::text = $1 OR run_id = $2)
           AND status NOT IN ('completed', 'handed_over', 'cancelled')`,
        [String(run.id), runIdentifier],
      );

      // 5. delivery_run_addresses: every stop still waiting is now in transit
      await client.query(
        `UPDATE delivery_run_addresses
         SET delivery_status = 'in_transit',
             updated_at = NOW()
         WHERE run_id = ANY($1)
           AND deleted_at IS NULL
           AND COALESCE(delivery_status, 'pending') IN ('pending', 'assigned')`,
        [runIds],
      );

      // 6. orders: scoped to this run (or this partner's unassigned orders in the
      //    same slot) so a second run's orders are never dragged out for delivery
      const updatedOrders = await client.query(
        `UPDATE orders
         SET status = 'out_for_delivery',
             delivery_partner_id = $1,
             delivery_run_id = $2,
             updated_at = NOW()
         WHERE (delivery_run_id = ANY($3)
                OR (delivery_partner_id = $1 AND delivery_run_id IS NULL))
           AND (scheduled_date::date = $4::date
                OR (scheduled_date IS NULL AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $4::date))
           AND (delivery_slot = $5 OR delivery_slot IS NULL)
           AND status IN ('pending', 'placed', 'confirmed', 'packed', 'assigned')
         RETURNING order_id`,
        [boy.user_id, runIdentifier, runIds, targetDate, runSlot],
      );

      return {
        dispatchStatus: updatedDispatch.rows?.[0]?.status || 'collected',
        ordersUpdated: updatedOrders.rows?.length || 0,
      };
    });

    return {
      success: true,
      message: 'Pickup confirmed successfully. Orders are now Out for Delivery.',
      run_id: runIdentifier,
      status: 'in_progress',
      dispatch_id: dispatch.dispatch_id,
      dispatch_status: result.dispatchStatus,
      pickup_confirmed: true,
      orders_updated: result.ordersUpdated,
    };
  }

  private async handleCodDeliveryPaymentAndBill(
    client: { query: (sql: string, params?: any[]) => Promise<any> },
    order: { order_id: string; customer_id: string; total_amount: number | string; payment_mode?: string; scheduled_date?: string },
    boyFullName: string,
  ) {
    const cashAmount = Number(order.total_amount || 0);

    // 1. Record cash collection in payment_transactions if not already existing
    const existingTxn = await client.query(
      `SELECT 1 FROM payment_transactions WHERE reference_id = $1 AND purpose = 'order_payment' AND status = 'success' LIMIT 1`,
      [order.order_id],
    );
    if (!existingTxn?.rows?.length && !existingTxn?.length) {
      const txnId = `TXN_COD_${order.order_id}_${Date.now()}`;
      await client.query(
        `INSERT INTO payment_transactions (
          transaction_id, customer_id, purpose, reference_id,
          provider, method, amount, currency, status, paid_at, created_at, updated_at
        ) VALUES ($1, $2, 'order_payment', $3, 'cash', 'cash', $4, 'INR', 'success', NOW(), NOW(), NOW())`,
        [txnId, order.customer_id, order.order_id, cashAmount],
      );
    }

    // 2. Settle or create customer_bills and customer_bill_items
    const existingBill = await client.query(
      `SELECT bill_id FROM customer_bills WHERE reference_id = $1 LIMIT 1`,
      [order.order_id],
    );
    if (existingBill?.rows?.length || existingBill?.length) {
      await client.query(
        `UPDATE customer_bills
         SET status = 'paid',
             paid_amount = total_amount,
             due_amount = 0,
             updated_at = NOW()
         WHERE reference_id = $1`,
        [order.order_id],
      );
    } else {
      const newBillId = `BILL-${order.order_id}`;
      await client.query(
        `INSERT INTO customer_bills (
          bill_id, customer_id, bill_type, reference_id, payment_type, payment_method,
          billing_from, billing_to, due_date, subtotal, discount_amount, tax_amount,
          total_amount, paid_amount, due_amount, status, remarks, created_at, updated_at
        ) VALUES (
          $1, $2, 'order', $3, 'cod', 'cod',
          CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, $4, 0, 0,
          $4, $4, 0, 'paid', 'Cash on Delivery - Collected on delivery', NOW(), NOW()
        )`,
        [newBillId, order.customer_id, order.order_id, cashAmount],
      );

      const orderItemsRes = await client.query(
        `SELECT variant_id, quantity, unit_price, total_price FROM order_items WHERE order_id = $1 AND deleted_at IS NULL`,
        [order.order_id],
      );
      const items = orderItemsRes.rows || orderItemsRes || [];
      for (const item of items) {
        const itemTotal = Number(item.total_price || (Number(item.unit_price || 0) * Number(item.quantity || 1)));
        await client.query(
          `INSERT INTO customer_bill_items (
            bill_id, reference_type, reference_id, product_variant_id,
            quantity, unit_price, discount_amount, tax_amount, total_amount, created_at
          ) VALUES ($1, 'order', $2, $3, $4, $5, 0, 0, $6, NOW())`,
          [newBillId, order.order_id, item.variant_id, item.quantity, item.unit_price, itemTotal],
        );
      }
    }
  }
}
