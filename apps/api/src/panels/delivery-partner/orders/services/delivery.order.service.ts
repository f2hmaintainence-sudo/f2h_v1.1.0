import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { PushNotificationService } from '../../../../shared/pushNotifications/pushNotification.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Injectable()
export class DeliveryOrderService {
  constructor(
    private readonly db: DatabaseService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly developer: DeveloperService,
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
    const boyRes = await this.db.query(
      `SELECT dp.id, dp.user_id, dp.delivery_partner_id, dp.branch_id,
              u.first_name || ' ' || u.last_name AS full_name
       FROM delivery_partners dp
       LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
       WHERE dp.user_id = $1 OR dp.delivery_partner_id = $1 LIMIT 1`,
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

    // 1. Fetch expected containers by order
    const expectedContainersRes = await this.db.query(
      `SELECT oi.order_id, pv.container_id, c.name AS container_name, SUM(oi.quantity)::int AS expected
       FROM order_items oi
       JOIN product_variants pv ON pv.variant_id = oi.variant_id
       JOIN products p ON p.product_id = pv.product_id
       JOIN containers c ON c.container_id = pv.container_id
       WHERE oi.order_id = ANY($1) AND COALESCE(c.is_returnable, p.is_returnable, false) = true
       GROUP BY oi.order_id, pv.container_id, c.name`,
      [orderIds],
    );

    const expectedContainersMap: Record<string, Record<string, { name: string; expected: number }>> = {};
    for (const row of expectedContainersRes || []) {
      const oid = String(row.order_id);
      const cid = String(row.container_id);
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

    // 3. Fetch actual returned counts in this order
    const collectedContainersRes = await this.db.query(
      `SELECT reference_id AS order_id, container_id, COALESCE(SUM(quantity), 0)::int AS collected
       FROM container_transactions
       WHERE reference_type = 'order'
         AND reference_id = ANY($1)
         AND transaction_type = 'return'
       GROUP BY reference_id, container_id`,
      [orderIds],
    );

    const collectedContainersMap: Record<string, Record<string, number>> = {};
    const collectedBottlesByOrder: Record<string, number> = {};
    for (const row of collectedContainersRes || []) {
      const oid = String(row.order_id);
      const cid = String(row.container_id);
      if (!collectedContainersMap[oid]) collectedContainersMap[oid] = {};
      collectedContainersMap[oid][cid] = row.collected;

      if (cid === 'CONT-001') {
        collectedBottlesByOrder[oid] = row.collected;
      }
    }

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
          expected_delivery: expected,
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
          COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '') AS customer_name,
          cu.phone AS customer_phone,
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
      const uncompletedOrdersRes = await this.db.query(
        `SELECT COUNT(*)::int AS count FROM orders
         WHERE (delivery_run_id = $1 OR delivery_run_id::text = $1)
           AND status NOT IN ('delivered', 'failed', 'completed', 'cancelled')`,
        [activeRunId],
      );
      const uncompletedCount = Number(uncompletedOrdersRes[0]?.count || 0);
      const dbRun = await this.db.query(
        `SELECT status FROM delivery_runs WHERE run_id = $1 OR id::text = $1 LIMIT 1`,
        [activeRunId],
      );
      const currentDbStatus = dbRun?.length ? dbRun[0].status : 'in_progress';

      if (uncompletedCount === 0 && orders?.length > 0 && currentDbStatus !== 'handed_over') {
        await this.db.query(
          `UPDATE delivery_runs SET status = 'completed', actual_end_time = COALESCE(actual_end_time, NOW()), updated_at = NOW() WHERE run_id = $1 OR id::text = $1`,
          [activeRunId],
        );
        activeRunStatus = (await this.isRunHandedOver(activeRunId!)) ? 'handed_over' : 'completed';
      } else if (currentDbStatus === 'completed') {
        activeRunStatus = (await this.isRunHandedOver(activeRunId!)) ? 'handed_over' : 'completed';
      } else if (currentDbStatus === 'handed_over') {
        activeRunStatus = 'handed_over';
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

        // Issue containers FIRST (so the balance exists before we try to collect empties)
        if (status === 'delivered') {
          const returnableItems = await client.query(
            `SELECT oi.quantity, pv.container_id
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
            });
          }
        }

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

        isFirstOrder = false;
      }

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
        } catch (e) {}
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
      `SELECT COALESCE(SUM(ct.quantity), 0) AS total_bottles
       FROM container_transactions ct
       JOIN orders o ON o.order_id = ct.reference_id
       WHERE o.delivery_run_id = ANY($1) AND ct.transaction_type = 'return'`,
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
      // Issue containers FIRST so the balance exists before collection check
      if (status === 'delivered') {
        const returnableItems = await client.query(
          `SELECT oi.quantity, pv.container_id
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
          });
        }
      }

      // Now collect returned containers (balance already updated above)
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

      // Auto-complete the run if all orders are delivered or failed
      if (order.delivery_run_id) {
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
             COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '') AS customer_name,
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
           COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '') AS customer_name,
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


    });

    return {
      success: true,
      message: 'Pickup confirmed successfully',
      run_id: runIdentifier,
      status: 'in_progress',
    };
  }


}
