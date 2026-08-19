import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';

@Injectable()
export class BasketService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Resolves or creates an active delivery basket for a partner/run.
   */
  async getOrCreateActiveBasket(partnerId: string, runId?: string, dateParam?: string): Promise<any> {
    const today = (dateParam || new Date().toISOString()).split('T')[0];

    const existingRes = await this.db.query(
      `SELECT * FROM delivery_baskets
       WHERE delivery_partner_id = $1
         AND (delivery_date = $2::date OR DATE(created_at AT TIME ZONE 'Asia/Kolkata') = $2::date)
         AND status IN ('OPEN', 'IN_DELIVERY')
       ORDER BY created_at DESC
       LIMIT 1`,
      [partnerId, today],
    );

    if (existingRes?.length) {
      const basket = existingRes[0];
      if (runId && !basket.delivery_run_id) {
        await this.db.query(
          `UPDATE delivery_baskets SET delivery_run_id = $1, updated_at = NOW() WHERE id = $2`,
          [runId, basket.id],
        );
        basket.delivery_run_id = runId;
      }
      await this.syncRunOrdersToBasket(basket.id, partnerId, runId);
      return basket;
    }

    // Create new basket
    const basketId = `BSK-${today.replaceAll('-', '')}-${partnerId.substring(0, 8)}`;
    await this.db.query(
      `INSERT INTO delivery_baskets (
         id, delivery_partner_id, delivery_run_id, delivery_date, status, opened_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4::date, 'OPEN', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [basketId, partnerId, runId || null, today],
    );

    await this.syncRunOrdersToBasket(basketId, partnerId, runId);

    const newBasketRes = await this.db.query(`SELECT * FROM delivery_baskets WHERE id = $1`, [basketId]);
    return newBasketRes[0];
  }

  /**
   * Synchronizes assigned run order items into physical basket_items.
   */
  async syncRunOrdersToBasket(basketId: string, partnerId: string, runId?: string): Promise<void> {
    // 0. Purge any stale basket items not belonging to today's active orders
    await this.db.query(
      `DELETE FROM basket_items
       WHERE basket_id = $1
         AND item_type = 'ORDER'
         AND order_id NOT IN (
           SELECT o.order_id FROM orders o
           WHERE (o.delivery_partner_id = $2 OR ($3::text IS NOT NULL AND o.delivery_run_id = $3::text))
             AND (o.scheduled_date::date = CURRENT_DATE OR (o.scheduled_date IS NULL AND DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE))
             AND o.status NOT IN ('cancelled', 'failed')
         )`,
      [basketId, partnerId, runId || null],
    );

    // Query all active orders assigned to partner / run for today
    const ordersRes = await this.db.query(
      `SELECT o.order_id, oi.id AS order_item_id, oi.variant_id, oi.quantity, oi.item_status, pv.product_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
       WHERE (o.delivery_partner_id = $1 OR ($2::text IS NOT NULL AND o.delivery_run_id = $2::text))
         AND (o.scheduled_date::date = CURRENT_DATE OR (o.scheduled_date IS NULL AND DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE))
         AND o.status NOT IN ('cancelled', 'failed')`,
      [partnerId, runId || null],
    );

    for (const item of ordersRes || []) {
      const basketItemId = `BKI-${item.order_id}-${item.order_item_id}`;
      const qty = Number(item.quantity || 1);
      const isDelivered = item.item_status === 'DELIVERED';
      const itemStatus = isDelivered ? 'DELIVERED' : 'IN_BASKET';

      const insertRes = await this.db.query(
        `INSERT INTO basket_items (
           id, basket_id, product_id, variant_id, order_id, order_item_id,
           quantity, item_type, status, loaded_at, delivered_at, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 'ORDER', $8, NOW(), ${isDelivered ? 'NOW()' : 'NULL'}, NOW(), NOW()
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          basketItemId,
          basketId,
          item.product_id || null,
          item.variant_id,
          item.order_id,
          item.order_item_id,
          qty,
          itemStatus,
        ],
      );

      // Log movement if inserted
      await this.db.query(
        `INSERT INTO basket_movements (
           basket_id, basket_item_id, user_id, delivery_partner_id, order_id,
           order_item_id, variant_id, quantity, previous_status, new_status, movement_type, reason, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, 'LOADED', 'Initial run loading', NOW())
         ON CONFLICT DO NOTHING`,
        [
          basketId,
          basketItemId,
          partnerId,
          partnerId,
          item.order_id,
          item.order_item_id,
          item.variant_id,
          qty,
          itemStatus,
        ],
      );
    }
  }

  /**
   * Adds Emergency extra buffer stock to a delivery partner's active basket.
   */
  async addEmergencyStock(
    adminId: string,
    partnerId: string,
    variantId: string,
    quantity: number,
    reason?: string,
  ): Promise<any> {
    if (quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');

    const basket = await this.getOrCreateActiveBasket(partnerId);
    const basketItemId = `BKI-EMG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Resolve product_id from variant
    const variantRes = await this.db.query(
      `SELECT product_id FROM product_variants WHERE variant_id = $1 LIMIT 1`,
      [variantId],
    );
    const productId = variantRes?.length ? variantRes[0].product_id : null;

    await this.db.query(
      `INSERT INTO basket_items (
         id, basket_id, product_id, variant_id, order_id, order_item_id,
         quantity, item_type, status, loaded_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, NULL, NULL, $5, 'EMERGENCY', 'IN_BASKET', NOW(), NOW(), NOW())`,
      [basketItemId, basket.id, productId, variantId, quantity],
    );

    await this.db.query(
      `INSERT INTO basket_movements (
         basket_id, basket_item_id, user_id, delivery_partner_id, order_id,
         order_item_id, variant_id, quantity, previous_status, new_status, movement_type, reason, created_at
       ) VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, NULL, 'IN_BASKET', 'EMERGENCY_ADDED', $7, NOW())`,
      [basket.id, basketItemId, adminId, partnerId, variantId, quantity, reason || 'Emergency extra stock added by admin'],
    );

    return { success: true, basketItemId, basketId: basket.id };
  }

  /**
   * Records item delivery and deducts physical items from basket.
   */
  async processOrderDeliveryEvent(
    userId: string,
    orderId: string,
    orderItemId?: string,
  ): Promise<void> {
    // 1. Update order_items status
    if (orderItemId) {
      await this.db.query(
        `UPDATE order_items SET item_status = 'DELIVERED', updated_at = NOW() WHERE id = $1 OR order_item_id = $1`,
        [orderItemId],
      );
    } else {
      await this.db.query(
        `UPDATE order_items SET item_status = 'DELIVERED', updated_at = NOW() WHERE order_id = $1`,
        [orderId],
      );
    }

    // 2. Find basket items to update
    const basketItemsRes = await this.db.query(
      `SELECT id, basket_id, order_item_id, variant_id, quantity, status
       FROM basket_items
       WHERE order_id = $1
         ${orderItemId ? 'AND (order_item_id = $2 OR id = $2)' : ''}
         AND status = 'IN_BASKET'`,
      orderItemId ? [orderId, orderItemId] : [orderId],
    );

    for (const bItem of basketItemsRes || []) {
      await this.db.query(
        `UPDATE basket_items SET status = 'DELIVERED', delivered_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [bItem.id],
      );

      // Audit movement
      await this.db.query(
        `INSERT INTO basket_movements (
           basket_id, basket_item_id, user_id, delivery_partner_id, order_id,
           order_item_id, variant_id, quantity, previous_status, new_status, movement_type, reason, created_at
         ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, 'DELIVERED', 'DELIVERED', 'Delivered to customer', NOW())`,
        [
          bItem.basket_id,
          bItem.id,
          userId,
          orderId,
          bItem.order_item_id,
          bItem.variant_id,
          bItem.quantity,
          bItem.status,
        ],
      );
    }

    // 3. Update delivered_qty in delivery_dispatch_items table
    await this.db.query(
      `UPDATE delivery_dispatch_items ddi
       SET delivered_qty = ddi.delivered_qty + oi.quantity, updated_at = NOW()
       FROM orders o
       JOIN delivery_dispatch dd ON dd.delivery_run_id = o.delivery_run_id
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE o.order_id = $1
         ${orderItemId ? 'AND (oi.id = $2 OR oi.order_item_id = $2)' : ''}
         AND ddi.dispatch_id = dd.dispatch_id
         AND ddi.product_variant_id = oi.variant_id
         AND ddi.deleted_at IS NULL`,
      orderItemId ? [orderId, orderItemId] : [orderId],
    );
  }

  /**
   * Generates physical basket ledger summary and product breakdown.
   */
  async getBasketSummary(partnerId: string, runId?: string): Promise<any> {
    const basket = await this.getOrCreateActiveBasket(partnerId, runId);

    // 1. Fetch active delivery_run for this partner on today's date
    const runRes = await this.db.query(
      `SELECT dr.id, dr.run_id, dr.delivery_partner_id, dr.warehouse_id, dr.delivery_slot, dr.status
       FROM delivery_runs dr
       WHERE (dr.delivery_partner_id = $1 OR dr.run_id = $2)
         AND DATE(dr.run_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
         AND dr.status != 'cancelled'
       ORDER BY dr.created_at DESC
       LIMIT 1`,
      [partnerId, runId || ''],
    );

    const activeRun = runRes?.length ? runRes[0] : null;
    const activeRunId = activeRun ? (activeRun.run_id || String(activeRun.id)) : (runId || basket.delivery_run_id);

    // 2. Fetch live planned & delivered quantities from orders table
    const livePlannedRes = await this.db.query(
      `SELECT
         oi.variant_id AS product_variant_id,
         SUM(oi.quantity)::numeric AS planned_qty,
         SUM(CASE WHEN o.status IN ('delivered', 'completed') THEN oi.quantity ELSE 0 END)::numeric AS delivered_qty
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE (o.delivery_run_id = $1 OR o.delivery_partner_id = $2)
         AND (o.scheduled_date::date = CURRENT_DATE OR (o.scheduled_date IS NULL AND DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE))
         AND o.status NOT IN ('cancelled', 'failed')
       GROUP BY oi.variant_id`,
      [activeRunId, partnerId],
    );
    const livePlannedMap: Record<string, { planned: number; delivered: number }> = {};
    for (const lp of livePlannedRes || []) {
      livePlannedMap[String(lp.product_variant_id)] = {
        planned: Number(lp.planned_qty || 0),
        delivered: Number(lp.delivered_qty || 0),
      };
    }

    // 3. Fetch delivery_dispatch_items by joining delivery_runs -> delivery_dispatch -> delivery_dispatch_items
    const dispatchItemsRes = await this.db.query(
      `SELECT
         ddi.id,
         dd.dispatch_id,
         dd.delivery_run_id,
         dd.status AS dispatch_status,
         ddi.product_variant_id,
         pv.name AS variant_name,
         pv.unit_value,
         pv.unit_type,
         COALESCE(ddi.planned_qty, 0) AS planned_qty,
         COALESCE(ddi.loaded_qty, 0) AS loaded_qty,
         COALESCE(ddi.delivered_qty, 0) AS delivered_qty,
         COALESCE(ddi.returned_qty, 0) AS returned_qty,
         COALESCE(ddi.damaged_qty, 0) AS damaged_qty,
         COALESCE(ddi.extra_sold_qty, 0) AS extra_sold_qty
       FROM delivery_runs dr
       JOIN delivery_dispatch dd ON dd.delivery_run_id = dr.run_id
       JOIN delivery_dispatch_items ddi ON ddi.dispatch_id = dd.dispatch_id
       LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
       WHERE (dr.delivery_partner_id = $1 OR dr.run_id = $2)
         AND DATE(dr.run_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
         AND ddi.deleted_at IS NULL`,
      [partnerId, activeRunId || ''],
    );

    if (dispatchItemsRes && dispatchItemsRes.length > 0) {
      let totalLoaded = 0;
      let customerItemsCount = 0;
      let emergencyItemsCount = 0;
      let deliveredCount = 0;
      let returnedCount = 0;
      let damagedCount = 0;

      const productMap: Record<string, any> = {};

      const isContainerName = (name: string) => {
        const lower = (name || '').toLowerCase();
        return lower.includes('empty bottle') || lower.includes('glass bottle') || lower.includes('container return') || lower.includes('milk bottel');
      };

      for (const dItem of dispatchItemsRes) {
        if (isContainerName(dItem.variant_name)) continue;

        const liveInfo = livePlannedMap[dItem.product_variant_id];
        const planned = liveInfo ? Math.max(liveInfo.planned, Number(dItem.planned_qty || 0)) : Number(dItem.planned_qty || 0);
        const rawLoaded = Number(dItem.loaded_qty || 0);
        const loaded = Math.max(planned, rawLoaded);
        const delivered = Math.max(Number(dItem.delivered_qty || 0), liveInfo ? liveInfo.delivered : 0);
        const returned = Number(dItem.returned_qty || 0);
        const damaged = Number(dItem.damaged_qty || 0);
        const extra = Math.max(0, loaded - planned);

        totalLoaded += loaded;
        customerItemsCount += planned;
        emergencyItemsCount += extra;
        deliveredCount += delivered;
        returnedCount += returned;
        damagedCount += damaged;

        const pKey = dItem.product_variant_id || 'UNKNOWN';
        if (!productMap[pKey]) {
          productMap[pKey] = {
            variant_id: dItem.product_variant_id,
            name: dItem.variant_name || 'Product Item',
            unit: `${dItem.unit_value || ''}${dItem.unit_type || ''}`,
            planned: 0,
            loaded: 0,
            delivered: 0,
            pending: 0,
            emergency: 0,
            returned: 0,
            damaged: 0,
            current_basket: 0,
          };
        }

        const pEntry = productMap[pKey];
        pEntry.planned += planned;
        pEntry.loaded += loaded;
        pEntry.delivered += delivered;
        pEntry.emergency += extra;
        pEntry.returned += returned;
        pEntry.damaged += damaged;
        pEntry.current_basket += Math.max(0, loaded - delivered - returned - damaged);
      }

      const dispatchStatus = dispatchItemsRes[0]?.dispatch_status || 'loaded';
      const dispatchId = dispatchItemsRes[0]?.dispatch_id || `DSP-${basket.id.replace('BSK-', '')}`;

      const currentBasket = Math.max(0, totalLoaded - deliveredCount - returnedCount - damagedCount);

      return {
        basket_id: basket.id,
        dispatch_id: dispatchId,
        delivery_partner_id: partnerId,
        delivery_run_id: activeRunId || basket.delivery_run_id,
        date: basket.delivery_date,
        status: basket.status,
        pickup_confirmed: true,
        total_loaded: totalLoaded,
        customer_items_count: customerItemsCount,
        emergency_items_count: emergencyItemsCount,
        delivered_count: deliveredCount,
        pending_count: Math.max(0, customerItemsCount - deliveredCount),
        returned_count: returnedCount,
        damaged_count: damagedCount,
        cancelled_count: 0,
        current_basket: currentBasket,
        product_breakdown: Object.values(productMap),
        items: dispatchItemsRes,
      };
    }

    // 2. Fallback to basket_items query if dispatch items are not found
    const rawItems = await this.db.query(
      `SELECT
         bi.id,
         bi.basket_id,
         bi.product_id,
         bi.variant_id,
         bi.order_id,
         bi.order_item_id,
         bi.quantity,
         bi.item_type,
         bi.status,
         bi.loaded_at,
         bi.delivered_at,
         bi.returned_at,
         pv.name AS variant_name,
         pv.unit_value,
         pv.unit_type
       FROM basket_items bi
       LEFT JOIN product_variants pv ON pv.variant_id = bi.variant_id
       WHERE bi.basket_id = $1`,
      [basket.id],
    );

    let totalLoaded = 0;
    let customerItemsCount = 0;
    let emergencyItemsCount = 0;
    let deliveredCount = 0;
    let pendingCount = 0;
    let returnedCount = 0;
    let damagedCount = 0;
    let cancelledCount = 0;

    const productMap: Record<string, any> = {};

    for (const item of rawItems || []) {
      const qty = Number(item.quantity || 1);
      totalLoaded += qty;

      if (item.item_type === 'EMERGENCY') {
        emergencyItemsCount += qty;
      } else {
        customerItemsCount += qty;
      }

      if (item.status === 'DELIVERED') deliveredCount += qty;
      else if (item.status === 'IN_BASKET' || item.status === 'ALLOCATED') pendingCount += qty;
      else if (item.status === 'RETURNED') returnedCount += qty;
      else if (item.status === 'DAMAGED') damagedCount += qty;
      else if (item.status === 'CANCELLED') cancelledCount += qty;

      // Group product level breakdown
      const pKey = item.variant_id || item.product_id || 'UNKNOWN';
      if (!productMap[pKey]) {
        productMap[pKey] = {
          variant_id: item.variant_id,
          name: item.variant_name || 'Product Item',
          unit: `${item.unit_value || ''}${item.unit_type || ''}`,
          loaded: 0,
          delivered: 0,
          pending: 0,
          emergency: 0,
          returned: 0,
          damaged: 0,
          current_basket: 0,
        };
      }

      const pEntry = productMap[pKey];
      pEntry.loaded += qty;
      if (item.item_type === 'EMERGENCY') pEntry.emergency += qty;
      if (item.status === 'DELIVERED') pEntry.delivered += qty;
      else if (item.status === 'IN_BASKET' || item.status === 'ALLOCATED') {
        pEntry.pending += qty;
        pEntry.current_basket += qty;
      } else if (item.status === 'RETURNED') pEntry.returned += qty;
      else if (item.status === 'DAMAGED') pEntry.damaged += qty;
    }

    const dispatchRes = await this.db.query(
      `SELECT dispatch_id, status FROM delivery_dispatch WHERE delivery_run_id = $1 LIMIT 1`,
      [basket.delivery_run_id],
    );
    const checkRunRes = await this.db.query(
      `SELECT status FROM delivery_runs WHERE id::text = $1 OR run_id = $1 LIMIT 1`,
      [basket.delivery_run_id],
    );
    const dispatchStatus = dispatchRes?.length ? dispatchRes[0].status : null;
    const runStatus = checkRunRes?.length ? checkRunRes[0].status : null;

    const isPickupConfirmed = dispatchStatus === 'collected' ||
      ['in_progress', 'in_transit', 'out_for_delivery', 'completed'].includes(String(runStatus));

    const dispatchId = dispatchRes?.length
      ? dispatchRes[0].dispatch_id
      : `DSP-${basket.id.replace('BSK-', '')}`;

    const effectiveCurrentBasket = isPickupConfirmed
      ? (totalLoaded - deliveredCount - returnedCount - damagedCount - cancelledCount)
      : emergencyItemsCount;

    const finalProductBreakdown = Object.values(productMap).map((entry: any) => ({
      ...entry,
      current_basket: isPickupConfirmed ? entry.current_basket : entry.emergency,
    }));

    return {
      basket_id: basket.id,
      dispatch_id: dispatchId,
      delivery_partner_id: partnerId,
      delivery_run_id: basket.delivery_run_id,
      date: basket.delivery_date,
      status: basket.status,
      pickup_confirmed: isPickupConfirmed,
      total_loaded: totalLoaded,
      customer_items_count: customerItemsCount,
      emergency_items_count: emergencyItemsCount,
      delivered_count: deliveredCount,
      pending_count: pendingCount,
      returned_count: returnedCount,
      damaged_count: damagedCount,
      cancelled_count: cancelledCount,
      current_basket: Math.max(0, effectiveCurrentBasket),
      product_breakdown: finalProductBreakdown,
      items: rawItems,
    };
  }

  /**
   * End of Day Reconciliation.
   */
  async reconcileBasket(basketId: string, userId: string, notes?: string): Promise<any> {
    const summary = await this.getBasketSummary(userId, undefined);
    const expectedCurrent = summary.total_loaded - summary.delivered_count - summary.returned_count - summary.damaged_count - summary.cancelled_count;

    if (summary.current_basket !== expectedCurrent) {
      throw new BadRequestException(
        `Discrepancy detected! Loaded (${summary.total_loaded}) != Delivered (${summary.delivered_count}) + Returned (${summary.returned_count}) + Damaged (${summary.damaged_count}) + Remaining (${summary.current_basket}).`,
      );
    }

    await this.db.query(
      `UPDATE delivery_baskets
       SET status = 'CLOSED', closed_at = NOW(), reconciled_by = $1, reconciliation_notes = $2, updated_at = NOW()
       WHERE id = $3`,
      [userId, notes || 'Reconciliation completed cleanly', basketId],
    );

    return { success: true, status: 'CLOSED', summary };
  }

  /**
   * Retrieves overall real-time basket status for all active delivery partners for Admin view.
   * Format: Delivery Boy | Taken | Delivered | In Bag | Extra
   */
  async getAllPartnersBasketOverview(dateParam?: string): Promise<any[]> {
    const activePartners = await this.db.query(
      `SELECT
         dp.delivery_partner_id,
         CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS partner_name,
         u.phone
       FROM delivery_partners dp
       JOIN users u ON u.user_id = dp.delivery_partner_id
       WHERE dp.is_active = true OR dp.is_online = true`,
    );

    const results: any[] = [];

    for (const partner of activePartners || []) {
      const summary = await this.getBasketSummary(partner.delivery_partner_id, undefined);
      results.push({
        delivery_partner_id: partner.delivery_partner_id,
        partner_name: partner.partner_name.trim() || partner.delivery_partner_id,
        phone: partner.phone,
        taken: summary.total_loaded,
        delivered: summary.delivered_count,
        currently_have: summary.current_basket,
        extra_items: summary.emergency_items_count,
        basket_status: summary.status,
        last_updated: new Date().toISOString(),
      });
    }

    return results;
  }

  /**
   * Generates container status summary strictly for the active run_id from delivery_container_reconciliation.
   * Auto-syncs live container_transactions into delivery_container_reconciliation if missing.
   */
  async getContainerSummary(partnerId: string, runId?: string): Promise<any> {
    const basket = await this.getOrCreateActiveBasket(partnerId, runId);
    const activeRunId = runId || basket.delivery_run_id;

    // 1. Fetch warehouse_id and partner_id for the active delivery run
    const runRes = await this.db.query(
      `SELECT warehouse_id, delivery_partner_id FROM delivery_runs WHERE run_id = $1 LIMIT 1`,
      [activeRunId],
    );
    const warehouseId = runRes?.[0]?.warehouse_id || 'WH-MRXD13W8PWMMON';
    const runPartnerId = runRes?.[0]?.delivery_partner_id || partnerId;

    // 2. Aggregate live container_transactions for this active run
    const liveTxRes = await this.db.query(
      `SELECT
         ct.container_id,
         SUM(CASE WHEN ct.transaction_type = 'return' THEN ct.quantity ELSE 0 END)::int AS collected_quantity,
         SUM(CASE WHEN ct.transaction_type = 'damage' THEN ct.quantity ELSE 0 END)::int AS damaged_quantity
       FROM container_transactions ct
       JOIN orders o ON o.order_id = ct.reference_id
       WHERE (o.delivery_run_id = $1 OR o.delivery_partner_id = $2 OR o.delivery_partner_id = $3)
         AND ct.deleted_at IS NULL
       GROUP BY ct.container_id`,
      [activeRunId, partnerId, runPartnerId],
    );

    // 3. Upsert live collected & damaged quantities into delivery_container_reconciliation
    if (liveTxRes && liveTxRes.length > 0) {
      for (const r of liveTxRes) {
        const coll = Number(r.collected_quantity || 0);
        const dam = Number(r.damaged_quantity || 0);
        if (coll > 0 || dam > 0) {
          await this.db.query(
            `INSERT INTO delivery_container_reconciliation (
               warehouse_id, run_id, container_id,
               collected_quantity, submitted_quantity, damaged_quantity, lost_quantity,
               status, created_by, created_at, updated_at
             )
             VALUES ($1, $2, $3, $4, 0, $5, 0, 'pending', $6, NOW(), NOW())
             ON CONFLICT (run_id, container_id) DO UPDATE
             SET
               collected_quantity = GREATEST(delivery_container_reconciliation.collected_quantity, EXCLUDED.collected_quantity),
               damaged_quantity = GREATEST(delivery_container_reconciliation.damaged_quantity, EXCLUDED.damaged_quantity),
               updated_at = NOW()`,
            [warehouseId, activeRunId, r.container_id, coll, dam, partnerId],
          );
        }
      }
    }

    // 4. Query overall summary metrics from delivery_container_reconciliation
    const summaryRows = await this.db.query(
      `SELECT
         COALESCE(SUM(collected_quantity), 0)::int AS total_collected,
         COALESCE(SUM(submitted_quantity), 0)::int AS total_submitted,
         COALESCE(SUM(damaged_quantity), 0)::int AS total_damaged,
         COALESCE(SUM(lost_quantity), 0)::int AS total_lost,
         COALESCE(SUM(GREATEST(0, collected_quantity - submitted_quantity - damaged_quantity - lost_quantity)), 0)::int AS total_remaining,
         COUNT(*)::int AS container_types_count
       FROM delivery_container_reconciliation
       WHERE run_id = $1 AND deleted_at IS NULL`,
      [activeRunId],
    );

    // 5. Query detailed container breakdown from delivery_container_reconciliation
    const breakdownRows = await this.db.query(
      `SELECT
         dcr.container_id,
         COALESCE(c.name, dcr.container_id) AS container_name,
         COALESCE(dcr.collected_quantity, 0)::int AS collected_quantity,
         COALESCE(dcr.submitted_quantity, 0)::int AS submitted_quantity,
         COALESCE(dcr.damaged_quantity, 0)::int AS damaged_quantity,
         COALESCE(dcr.lost_quantity, 0)::int AS lost_quantity,
         COALESCE(GREATEST(0, dcr.collected_quantity - dcr.submitted_quantity - dcr.damaged_quantity - dcr.lost_quantity), 0)::int AS remaining_quantity
       FROM delivery_container_reconciliation dcr
       LEFT JOIN containers c ON (c.container_id = dcr.container_id OR c.id::text = dcr.container_id)
       WHERE dcr.run_id = $1 AND dcr.deleted_at IS NULL
       ORDER BY dcr.id ASC`,
      [activeRunId],
    );

    const summary = summaryRows?.[0] || {
      total_collected: 0,
      total_submitted: 0,
      total_damaged: 0,
      total_lost: 0,
      total_remaining: 0,
      container_types_count: 0,
    };

    return {
      run_id: activeRunId,
      partner_id: partnerId,
      ...summary,
      container_breakdown: breakdownRows || [],
      is_fully_submitted: Number(summary.total_remaining) === 0 && Number(summary.total_collected) > 0,
    };
  }

  /**
   * Submits all collected containers strictly for the active run_id back to the hub.
   * Updates delivery_container_reconciliation table with status='submitted'.
   */
  async submitAllContainersToHub(partnerId: string, body: any): Promise<any> {
    const runId = body.run_id || body.runId;
    const basket = await this.getOrCreateActiveBasket(partnerId, runId);
    const activeRunId = runId || basket.delivery_run_id;

    if (!activeRunId) {
      return { status: false, message: 'No active delivery run found' };
    }

    // 1. Ensure live container transactions are synced to delivery_container_reconciliation first
    await this.getContainerSummary(partnerId, activeRunId);

    // 2. Submit all collected containers for activeRunId in delivery_container_reconciliation
    const updatedRows = await this.db.query(
      `UPDATE delivery_container_reconciliation
       SET
         submitted_quantity = GREATEST(0, collected_quantity - damaged_quantity - lost_quantity),
         status = 'submitted',
         submitted_by = $1,
         submission_notes = COALESCE($2, 'Submitted all containers back to hub via mobile app'),
         updated_at = NOW()
       WHERE run_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [partnerId, body.notes || null, activeRunId],
    );

    // 3. Fetch refreshed summary metrics after update
    const summary = await this.getContainerSummary(partnerId, activeRunId);

    return {
      status: true,
      message: 'All containers for active run successfully submitted to hub!',
      total_submitted: summary.total_submitted,
      total_remaining: summary.total_remaining,
      is_submitted: true,
      records: updatedRows || [],
      summary: summary,
    };
  }

  /**
   * Returns all remaining physical products & extra emergency items for the active run back to the hub.
   * Updates returned_qty on delivery_dispatch_items and status on delivery_baskets.
   */
  async returnProductsToHub(partnerId: string, body: any): Promise<any> {
    const runId = body.run_id || body.runId;
    const basket = await this.getOrCreateActiveBasket(partnerId, runId);
    const activeRunId = runId || basket.delivery_run_id;

    if (!activeRunId) {
      return { status: false, message: 'No active delivery run found' };
    }

    // 1. Fetch dispatch IDs for active run
    const dispatchRes = await this.db.query(
      `SELECT dispatch_id FROM delivery_dispatch
       WHERE (delivery_run_id = $1 OR delivery_partner_id = $2) AND status != 'cancelled'`,
      [activeRunId, partnerId],
    );
    const dispatchIds = (dispatchRes || []).map((d: any) => d.dispatch_id);

    // 2. Update delivery_dispatch_items: set returned_qty = (loaded_qty - delivered_qty - damaged_qty)
    if (dispatchIds.length > 0) {
      await this.db.query(
        `UPDATE delivery_dispatch_items
         SET
           returned_qty = GREATEST(0, loaded_qty - delivered_qty - damaged_qty),
           updated_at = NOW()
         WHERE (delivery_run_id = $1 OR dispatch_id = ANY($2::varchar[]))
           AND deleted_at IS NULL`,
        [activeRunId, dispatchIds],
      );
    } else {
      await this.db.query(
        `UPDATE delivery_dispatch_items
         SET
           returned_qty = GREATEST(0, loaded_qty - delivered_qty - damaged_qty),
           updated_at = NOW()
         WHERE delivery_run_id = $1 AND deleted_at IS NULL`,
        [activeRunId],
      );
    }

    // 3. Update delivery_baskets status to 'RETURNING' or 'CLOSED'
    await this.db.query(
      `UPDATE delivery_baskets
       SET
         status = 'RETURNING',
         closed_at = NOW(),
         reconciliation_notes = COALESCE($1, 'Returned remaining products & extra items to hub via mobile app'),
         updated_at = NOW()
       WHERE delivery_partner_id = $2
         AND status IN ('OPEN', 'IN_DELIVERY')`,
      [body.notes || null, partnerId],
    );

    // 4. Fetch refreshed summary
    const summary = await this.getBasketSummary(partnerId, activeRunId);

    return {
      status: true,
      message: 'All remaining products & extra items successfully returned to hub!',
      total_returned: summary.total_returned || 0,
      total_in_bag_now: summary.total_in_bag_now || 0,
      is_returned: true,
      summary: summary,
    };
  }
}
