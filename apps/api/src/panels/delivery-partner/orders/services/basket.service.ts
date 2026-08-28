import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { isDispatchHandedOver } from '../dispatch-status';

@Injectable()
export class BasketService {
  constructor(private readonly db: DatabaseService) { }

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
    const kolkataHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    const currentSlot = kolkataHour < 12 ? 'morning' : 'evening';

    // 0. Purge any stale basket items not belonging to today's active orders
    await this.db.query(
      `DELETE FROM basket_items
       WHERE basket_id = $1
         AND item_type = 'ORDER'
         AND order_id NOT IN (
           SELECT o.order_id FROM orders o
           WHERE (($3::text IS NOT NULL AND (o.delivery_run_id = $3::text OR o.delivery_run_id::text = $3::text))
                  OR (o.delivery_partner_id = $2 AND (o.delivery_slot = $4 OR $4 IS NULL)))
             AND (o.scheduled_date::date = CURRENT_DATE OR (o.scheduled_date IS NULL AND DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE))
             AND o.status NOT IN ('cancelled', 'failed')
         )`,
      [basketId, partnerId, runId || null, currentSlot],
    );

    // Query all active orders assigned to partner / run for today
    const ordersRes = await this.db.query(
      `SELECT o.order_id, oi.id AS order_item_id, oi.variant_id, oi.quantity, oi.item_status, pv.product_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
       WHERE (($2::text IS NOT NULL AND (o.delivery_run_id = $2::text OR o.delivery_run_id::text = $2::text))
              OR (o.delivery_partner_id = $1 AND (o.delivery_slot = $3 OR $3 IS NULL)))
         AND (o.scheduled_date::date = CURRENT_DATE OR (o.scheduled_date IS NULL AND DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE))
         AND o.status NOT IN ('cancelled', 'failed')`,
      [partnerId, runId || null, currentSlot],
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

    // 1. Resolve Delivery Partner profile. delivery_partner_id is the only key on
    // this table — it doubles as the users.user_id for the partner.
    const partnerRes = await this.db.query(
      `SELECT dp.delivery_partner_id, dp.branch_id
       FROM delivery_partners dp
       WHERE dp.delivery_partner_id = $1
         AND dp.deleted_at IS NULL
       LIMIT 1`,
      [partnerId],
    );
    const partner = partnerRes?.length ? partnerRes[0] : null;
    const partnerIds = [...new Set(
      [partner?.delivery_partner_id, partnerId].filter(Boolean),
    )];

    // 2. Fetch active delivery_run for this partner on today's date
    const kolkataHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    const currentSlot = kolkataHour < 12 ? 'morning' : 'evening';

    const runRes = await this.db.query(
      `SELECT dr.id, dr.run_id, dr.delivery_partner_id, COALESCE(w.warehouse_id, (SELECT warehouse_id FROM warehouses WHERE is_active = true AND deleted_at IS NULL LIMIT 1)) AS warehouse_id, dr.delivery_slot, dr.status AS run_status,
              dd.dispatch_id, dd.status AS dispatch_status
       FROM delivery_runs dr
       LEFT JOIN warehouses w ON w.branch_id = dr.branch_id AND w.is_active = true AND w.deleted_at IS NULL
       LEFT JOIN delivery_dispatch dd ON (dd.delivery_run_id = dr.run_id OR dd.delivery_run_id = dr.id::text)
       WHERE (dr.delivery_partner_id = ANY($1) OR dr.run_id = $2 OR dr.id::text = $2)
         AND (dr.run_date::date = CURRENT_DATE OR DATE(dr.run_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE OR dr.run_date IS NULL)
         AND dr.status != 'cancelled'
       ORDER BY
         (dr.run_id = $2 OR dr.id::text = $2) DESC,
         dr.created_at DESC,
         dr.id DESC
       LIMIT 1`,
      [partnerIds, runId || ''],
    );

    const activeRun = runRes?.length ? runRes[0] : null;
    const activeRunId = activeRun ? (activeRun.run_id || String(activeRun.id)) : (runId || basket.delivery_run_id);
    const runIds = activeRun ? [String(activeRun.id), activeRun.run_id].filter(Boolean) : (activeRunId ? [activeRunId] : []);

    // 3. Fetch latest delivery_dispatch record for this run / partner
    const dispatchRes = await this.db.query(
      `SELECT dd.id, dd.dispatch_id, dd.delivery_run_id, dd.status AS dispatch_status, dd.loaded_at, dd.collected_at
       FROM delivery_dispatch dd
       WHERE (dd.delivery_run_id = ANY($1)
          OR dd.delivery_run_id IN (
            SELECT dr.run_id FROM delivery_runs dr
            WHERE (dr.delivery_partner_id = ANY($2) OR dr.run_id = $3 OR dr.id::text = $3)
              AND dr.status != 'cancelled'
          ))
       ORDER BY
         (dd.delivery_run_id = $3) DESC,
         dd.created_at DESC,
         dd.id DESC
       LIMIT 1`,
      [runIds.length ? runIds : ['NONE'], partnerIds, runId || (activeRun?.run_id || '')],
    );
    const activeDispatch = dispatchRes?.length ? dispatchRes[0] : (activeRun?.dispatch_id ? activeRun : null);
    const activeDispatchId = activeDispatch?.dispatch_id;
    const dispatchStatus = activeDispatch?.dispatch_status || 'draft';

    // If dispatch status is 'return_pending' or 'completed', partner has already returned items:
    // No need to show items in basket!
    if (dispatchStatus === 'return_pending' || dispatchStatus === 'completed') {
      return {
        status: dispatchStatus === 'return_pending' ? 'RETURNING' : 'CLOSED',
        is_sufficient_for_orders: true,
        pickup_confirmed: true,
        has_dispatch: true,
        dispatch_status: dispatchStatus,
        pickup_action: dispatchStatus,
        insufficient_items: [],
        total_ordered: 0,
        total_planned: 0,
        total_loaded: 0,
        total_extra: 0,
        total_shortage: 0,
        total_returned: 0,
        total_in_bag_now: 0,
        customer_items_count: 0,
        emergency_items_count: 0,
        delivered_count: 0,
        pending_count: 0,
        returned_count: 0,
        damaged_count: 0,
        cancelled_count: 0,
        current_basket: 0,
        product_breakdown: [],
      };
    }

    const runSlot = activeRun?.delivery_slot || currentSlot;

    // 4. Fetch live planned & delivered quantities from orders & order_items for this run/slot
    const livePlannedRes = await this.db.query(
      `SELECT
         oi.variant_id AS product_variant_id,
         pv.name AS variant_name,
         pv.unit_value,
         pv.unit_type::text AS unit_type,
         p.product_id,
         p.name AS product_name,
         SUM(oi.quantity)::numeric AS planned_qty,
         SUM(CASE WHEN o.status IN ('delivered', 'completed') THEN oi.quantity ELSE 0 END)::numeric AS delivered_qty
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
       LEFT JOIN products p ON p.product_id = pv.product_id
       WHERE (
         (o.delivery_run_id = ANY($1))
         OR (o.delivery_partner_id = ANY($2) AND (o.delivery_slot = $3 OR $3 IS NULL))
       )
         AND (o.scheduled_date::date = CURRENT_DATE OR (o.scheduled_date IS NULL AND DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE))
         AND o.status NOT IN ('cancelled', 'failed')
       GROUP BY oi.variant_id, pv.name, pv.unit_value, pv.unit_type, p.product_id, p.name`,
      [runIds.length ? runIds : ['NONE'], partnerIds, runSlot],
    );

    const livePlannedMap: Record<string, { planned: number; delivered: number; name: string; unit: string; product_id?: string }> = {};
    for (const lp of livePlannedRes || []) {
      livePlannedMap[String(lp.product_variant_id)] = {
        planned: Number(lp.planned_qty || 0),
        delivered: Number(lp.delivered_qty || 0),
        name: lp.variant_name || lp.product_name || 'Product Item',
        unit: `${lp.unit_value || ''}${lp.unit_type || ''}`,
        product_id: lp.product_id,
      };
    }

    // 5. Fetch delivery_dispatch_items using the active dispatch_id (or joined by run_id)
    let dispatchItemsRes: any[] = [];
    if (activeDispatchId) {
      dispatchItemsRes = await this.db.query(
        `SELECT
           ddi.id,
           ddi.dispatch_id,
           ddi.product_variant_id,
           pv.name AS variant_name,
           pv.unit_value,
           pv.unit_type::text AS unit_type,
           p.product_id,
           p.name AS product_name,
           p.is_returnable,
           (
             SELECT COALESCE(NULLIF(pi.url, ''), '/uploads/' || pi.storage_key)
             FROM product_images pi
             WHERE (pi.variant_id = pv.variant_id OR pi.product_id = pv.product_id)
               AND pi.deleted_at IS NULL
             ORDER BY (pi.variant_id = pv.variant_id) DESC, pi.is_primary DESC, pi.sort_order ASC
             LIMIT 1
           ) AS product_image,
           COALESCE(ddi.planned_qty, 0)::numeric AS planned_qty,
           COALESCE(ddi.loaded_qty, 0)::numeric AS loaded_qty,
           COALESCE(ddi.delivered_qty, 0)::numeric AS delivered_qty,
           COALESCE(ddi.returned_qty, 0)::numeric AS returned_qty,
           COALESCE(ddi.damaged_qty, 0)::numeric AS damaged_qty,
           COALESCE(ddi.extra_sold_qty, 0)::numeric AS extra_sold_qty,
           COALESCE(ddi.unit::text, pv.unit_type::text, 'PCS') AS unit
         FROM delivery_dispatch_items ddi
         LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
         LEFT JOIN products p ON p.product_id = pv.product_id
         WHERE ddi.dispatch_id = $1
           AND ddi.deleted_at IS NULL
         ORDER BY pv.name`,
        [activeDispatchId],
      );
    } else if (runIds.length > 0) {
      dispatchItemsRes = await this.db.query(
        `SELECT
           ddi.id,
           dd.dispatch_id,
           dd.delivery_run_id,
           dd.status AS dispatch_status,
           ddi.product_variant_id,
           pv.name AS variant_name,
           pv.unit_value,
           pv.unit_type::text AS unit_type,
           p.product_id,
           p.name AS product_name,
           p.is_returnable,
           COALESCE(ddi.planned_qty, 0)::numeric AS planned_qty,
           COALESCE(ddi.loaded_qty, 0)::numeric AS loaded_qty,
           COALESCE(ddi.delivered_qty, 0)::numeric AS delivered_qty,
           COALESCE(ddi.returned_qty, 0)::numeric AS returned_qty,
           COALESCE(ddi.damaged_qty, 0)::numeric AS damaged_qty,
           COALESCE(ddi.extra_sold_qty, 0)::numeric AS extra_sold_qty,
           COALESCE(ddi.unit::text, pv.unit_type::text, 'PCS') AS unit
         FROM delivery_runs dr
         JOIN delivery_dispatch dd ON dd.delivery_run_id = dr.run_id
         JOIN delivery_dispatch_items ddi ON ddi.dispatch_id = dd.dispatch_id
         LEFT JOIN product_variants pv ON pv.variant_id = ddi.product_variant_id
         LEFT JOIN products p ON p.product_id = pv.product_id
         WHERE dr.run_id = ANY($1)
           AND ddi.deleted_at IS NULL
         ORDER BY pv.name`,
        [runIds],
      );
    }

    const isContainerName = (name: string) => {
      const lower = (name || '').toLowerCase();
      return lower.includes('empty bottle') || lower.includes('glass bottle') || lower.includes('container return') || lower.includes('milk bottel');
    };

    const productMap: Record<string, any> = {};

    // 6. Build the per-variant ledger. delivery_dispatch_items is the physical truth
    //    of what the warehouse handed over (EXTRA loads included); order_items is the
    //    demand it has to cover. Every quantity below is one or the other, never a mix.
    for (const dItem of dispatchItemsRes || []) {
      const vName = dItem.variant_name || dItem.product_name || 'Product Item';
      if (isContainerName(vName)) continue;

      const vId = String(dItem.product_variant_id);
      const liveInfo = livePlannedMap[vId];
      const orderedQty = liveInfo ? liveInfo.planned : 0;
      const plannedQty = Number(dItem.planned_qty || 0);
      const loadedQty = Number(dItem.loaded_qty || 0);
      const deliveredQty = Math.max(Number(dItem.delivered_qty || 0), liveInfo ? liveInfo.delivered : 0);
      const returnedQty = Number(dItem.returned_qty || 0);
      const damagedQty = Number(dItem.damaged_qty || 0);
      const extraQty = Math.max(0, loadedQty - orderedQty);
      const shortageQty = Math.max(0, orderedQty - loadedQty);
      const remainingQty = Math.max(0, orderedQty - deliveredQty);
      const inBasketQty = Math.max(0, loadedQty - deliveredQty - returnedQty - damagedQty);

      productMap[vId] = {
        variant_id: vId,
        product_id: dItem.product_id,
        name: vName,
        unit: `${dItem.unit_value || ''}${dItem.unit_type || dItem.unit || ''}`,
        product_image: dItem.product_image || null,
        image_url: dItem.product_image || null,

        // Explicit dispatch-vs-orders ledger
        ordered_qty: orderedQty,
        planned_qty: plannedQty,
        loaded_qty: loadedQty,
        extra_qty: extraQty,
        delivered_qty: deliveredQty,
        returned_qty: returnedQty,
        damaged_qty: damagedQty,
        remaining_qty: remainingQty,
        in_basket_qty: inBasketQty,
        shortage_qty: shortageQty,
        is_sufficient: loadedQty >= orderedQty,
        is_extra_only: orderedQty === 0 && loadedQty > 0,

        // Legacy keys the delivery app already renders
        planned: orderedQty > 0 ? orderedQty : plannedQty,
        loaded: loadedQty,
        delivered: deliveredQty,
        pending: remainingQty,
        emergency: extraQty,
        extra_load: extraQty,
        returned: returnedQty,
        damaged: damagedQty,
        current_basket: inBasketQty,
      };
    }

    // 7. A variant the orders require but the dispatch never loaded is a shortage,
    //    not an omission — surface it so the partner can see why pickup is blocked.
    for (const [vId, oInfo] of Object.entries(livePlannedMap)) {
      if (isContainerName(oInfo.name)) continue;
      if (productMap[vId]) continue;

      const orderedQty = oInfo.planned;
      const deliveredQty = oInfo.delivered;

      productMap[vId] = {
        variant_id: vId,
        product_id: oInfo.product_id,
        name: oInfo.name,
        unit: oInfo.unit,

        ordered_qty: orderedQty,
        planned_qty: 0,
        loaded_qty: 0,
        extra_qty: 0,
        delivered_qty: deliveredQty,
        returned_qty: 0,
        damaged_qty: 0,
        remaining_qty: Math.max(0, orderedQty - deliveredQty),
        in_basket_qty: 0,
        shortage_qty: orderedQty,
        is_sufficient: orderedQty === 0,
        is_extra_only: false,

        planned: orderedQty,
        loaded: 0,
        delivered: deliveredQty,
        pending: Math.max(0, orderedQty - deliveredQty),
        emergency: 0,
        extra_load: 0,
        returned: 0,
        damaged: 0,
        current_basket: 0,
      };
    }

    const productBreakdown = Object.values(productMap) as any[];

    // Sufficiency is only meaningful for variants the assigned orders actually
    // require. An EXTRA-only load carries no demand, so it can never make the
    // dispatch insufficient — that is what used to block the confirm button
    // after the warehouse added extra stock.
    const requiredItems = productBreakdown.filter((p) => p.ordered_qty > 0);
    const shortageItems = requiredItems.filter((p) => !p.is_sufficient);
    const isSufficientForOrders = shortageItems.length === 0;

    const runStatus = activeRun?.status || 'planned';
    const isPickupConfirmed = isDispatchHandedOver(dispatchStatus);

    let totalOrdered = 0;
    let totalPlanned = 0;
    let totalLoaded = 0;
    let totalExtra = 0;
    let totalShortage = 0;
    let deliveredCount = 0;
    let returnedCount = 0;
    let damagedCount = 0;

    for (const p of productBreakdown) {
      totalOrdered += p.ordered_qty;
      totalPlanned += p.planned_qty;
      totalLoaded += p.loaded_qty;
      totalExtra += p.extra_qty;
      totalShortage += p.shortage_qty;
      deliveredCount += p.delivered_qty;
      returnedCount += p.returned_qty;
      damagedCount += p.damaged_qty;
    }

    const currentBasket = Math.max(0, totalLoaded - deliveredCount - returnedCount - damagedCount);
    const finalDispatchId = activeDispatchId || dispatchItemsRes[0]?.dispatch_id || null;

    const canConfirmPickup =
      !!finalDispatchId && !isPickupConfirmed && isSufficientForOrders && totalLoaded > 0;

    const pickupAction = !finalDispatchId
      ? 'unavailable'
      : isPickupConfirmed
        ? 'confirmed'
        : canConfirmPickup
          ? 'confirm'
          : 'blocked';

    return {
      basket_id: basket.id,
      dispatch_id: finalDispatchId,
      has_dispatch: !!finalDispatchId,
      delivery_partner_id: partnerId,
      delivery_run_id: activeRunId || basket.delivery_run_id,
      date: basket.delivery_date,
      status: basket.status,
      dispatch_status: dispatchStatus,
      run_status: runStatus,
      pickup_confirmed: isPickupConfirmed,
      can_confirm_pickup: canConfirmPickup,
      pickup_action: pickupAction,
      is_sufficient_for_orders: isSufficientForOrders,
      insufficient_items: shortageItems.map((p) => ({
        variant_id: p.variant_id,
        name: p.name,
        ordered_qty: p.ordered_qty,
        loaded_qty: p.loaded_qty,
        shortage_qty: p.shortage_qty,
      })),
      total_ordered: totalOrdered,
      total_planned: totalPlanned,
      total_loaded: totalLoaded,
      total_extra: totalExtra,
      total_shortage: totalShortage,
      total_returned: returnedCount,
      total_in_bag_now: currentBasket,
      customer_items_count: totalOrdered,
      emergency_items_count: totalExtra,
      delivered_count: deliveredCount,
      pending_count: Math.max(0, totalOrdered - deliveredCount),
      returned_count: returnedCount,
      damaged_count: damagedCount,
      cancelled_count: 0,
      current_basket: currentBasket,
      product_breakdown: productBreakdown,
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
   * Generates container status summary strictly for the active run_id from
   * delivery_container_reconciliation, which is now the sole record of what a
   * run collected.
   */
  async getContainerSummary(partnerId: string, runId?: string): Promise<any> {
    const basket = await this.getOrCreateActiveBasket(partnerId, runId);
    const activeRunId = runId || basket.delivery_run_id;

    // Auto-discover returnable containers from orders in this run if not already present
    if (activeRunId) {
      try {
        const runContainers = await this.db.query(
          `SELECT DISTINCT pv.container_id, COALESCE(c.name, 'Glass Bottle') AS container_name
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.order_id
           JOIN product_variants pv ON pv.variant_id = oi.variant_id
           LEFT JOIN products p ON p.product_id = pv.product_id
           LEFT JOIN containers c ON (c.container_id = pv.container_id OR c.id::text = pv.container_id)
           WHERE (o.delivery_run_id = $1 OR o.delivery_run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1))
             AND (COALESCE(c.is_returnable, p.is_returnable, false) = true OR pv.container_id IS NOT NULL)`,
          [activeRunId],
        );

        for (const rc of runContainers || []) {
          const cid = rc.container_id || 'CONT-001';
          const existing = await this.db.query(
            `SELECT id FROM delivery_container_reconciliation
             WHERE (run_id = $1 OR run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1))
               AND container_id = $2 AND deleted_at IS NULL LIMIT 1`,
            [activeRunId, cid],
          );

          if (!existing || existing.length === 0) {
            await this.db.query(
              `INSERT INTO delivery_container_reconciliation (
                 warehouse_id, run_id, container_id,
                 collected_quantity, submitted_quantity,
                 damaged_quantity, lost_quantity,
                 status, collection_notes, submitted_by,
                 created_at, updated_at
               ) VALUES (
                 (SELECT COALESCE(w.warehouse_id, 'WH-MAIN') FROM delivery_runs dr LEFT JOIN warehouses w ON w.branch_id = dr.branch_id AND w.is_active = true AND w.deleted_at IS NULL WHERE dr.id::text = $1 OR dr.run_id = $1 LIMIT 1),
                 $1, $2,
                 0, 0,
                 0, 0,
                 'pending', 'Auto-tracked container for delivery run', $3,
                 NOW(), NOW()
               )`,
              [activeRunId, cid, partnerId],
            );
          }
        }
      } catch (_) { }
    }

    // Summary metrics come straight from delivery_container_reconciliation.
    const summaryRows = await this.db.query(
      `SELECT
         COALESCE(SUM(collected_quantity), 0)::int AS total_collected,
         COALESCE(SUM(submitted_quantity), 0)::int AS total_submitted,
         COALESCE(SUM(damaged_quantity), 0)::int AS total_damaged,
         COALESCE(SUM(lost_quantity), 0)::int AS total_lost,
         COALESCE(SUM(GREATEST(0, collected_quantity - submitted_quantity - damaged_quantity - lost_quantity)), 0)::int AS total_remaining,
         COUNT(*)::int AS container_types_count
       FROM delivery_container_reconciliation
       WHERE (run_id = $1 OR run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $1 OR run_id = $1))
         AND deleted_at IS NULL`,
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
       WHERE (dcr.run_id = $1 OR dcr.run_id IN (SELECT dr.run_id FROM delivery_runs dr WHERE dr.id::text = $1 OR dr.run_id = $1))
         AND dcr.deleted_at IS NULL
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

    // 1. Refresh the reconciliation rows for this run before submitting
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
       WHERE (run_id = $3 OR run_id IN (SELECT run_id FROM delivery_runs WHERE id::text = $3 OR run_id = $3))
         AND deleted_at IS NULL
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
      `SELECT dd.dispatch_id FROM delivery_dispatch dd
       LEFT JOIN delivery_runs dr ON (dd.delivery_run_id = dr.run_id OR dd.delivery_run_id = dr.id::text)
       WHERE (dd.delivery_run_id = $1 OR dr.run_id = $1 OR dr.id::text = $1 OR dr.delivery_partner_id = $2)
         AND dd.status != 'cancelled'`,
      [activeRunId, partnerId],
    );
    const dispatchIds = (dispatchRes || []).map((d: any) => d.dispatch_id);

    // 2. Update delivery_dispatch_items: set returned_qty = (loaded_qty - delivered_qty - damaged_qty).
    await this.db.query(
      `UPDATE delivery_dispatch_items ddi
       SET
         returned_qty = GREATEST(0, ddi.loaded_qty - ddi.delivered_qty - ddi.damaged_qty),
         updated_at = NOW()
       FROM delivery_dispatch dd
       WHERE dd.dispatch_id = ddi.dispatch_id
         AND (dd.delivery_run_id = $1 OR dd.dispatch_id = ANY($2::varchar[]))
         AND ddi.deleted_at IS NULL`,
      [activeRunId, dispatchIds.length ? dispatchIds : ['NONE']],
    );

    // 3. Update delivery_dispatch status to 'return_pending'
    await this.db.query(
      `UPDATE delivery_dispatch
       SET status = 'return_pending', returned_at = NOW(), updated_at = NOW()
       WHERE (delivery_run_id = $1 OR dispatch_id = ANY($2::varchar[]))
         AND status != 'completed'`,
      [activeRunId, dispatchIds.length ? dispatchIds : ['NONE']],
    );

    // 4. Update delivery_baskets status to 'RETURNING' or 'CLOSED'
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

    // 5. Fetch refreshed summary
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
