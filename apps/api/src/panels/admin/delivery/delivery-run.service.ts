import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { NotificationService } from 'src/notifications/notification.service';
import { AuthService } from 'src/panels/admin/auth/auth.service';

function todayIST(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

interface RunAssignment {
  order_id: string;
  customer_id: string;
  address_id: string | null;
  customer_name: string | null;
  address_line: string | null;
  contact_number: string | null;
  order_lat: number | null;
  order_lng: number | null;
  total_amount: number;
  delivery_slot: string;
  branch_id: string | null;
}

interface PartnerInfo {
  id: string;
  name: string;
  branch_id: string;
  max_daily_orders: number;
  current_lat: number | null;
  current_lng: number | null;
  current_load: number;
}

import { FirstOrderDetectorService } from '../../customer/referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from '../../customer/referral/services/referral-reward-engine.service';

import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';

@Injectable()
export class DeliveryRunService {
  private readonly logger = new Logger(DeliveryRunService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private notificationService: NotificationService,
    private pushNotificationService: PushNotificationService,
    private authServices: AuthService,
    private firstOrderDetector: FirstOrderDetectorService,
    private referralRewardEngine: ReferralRewardEngineService,
  ) { }

  // ────────────────────────────────────────────────
  // Create Optimized Delivery Runs
  // ────────────────────────────────────────────────
  // Groups orders by branch + slot, clusters addresses,
  // then assigns to partners based on history, proximity, and load balance.
  async createOptimizedRuns(date?: string, branchId?: string, slot?: string) {
    const targetDate = date || todayIST();
    this.developer.debug('createOptimizedRuns parameters', { date, branchId, slot, targetDate });

    try {
      // Step 1: Get all unassigned orders
      const unassignedSql = `
        SELECT
          o.order_id,
          o.customer_id,
          o.branch_id,
          o.address_line,
          o.customer_name,
          o.contact_number,
          o.total_amount,
          o.delivery_slot,
          ca.address_id,
          ca.latitude AS order_lat,
          ca.longitude AS order_lng
        FROM orders o
        LEFT JOIN customer_addresses ca ON ca.address_id = o.address_id
        WHERE o.scheduled_date = $1
          AND o.delivery_partner_id IS NULL
          AND o.delivery_run_id IS NULL
          AND o.status IN ('confirmed','placed')
          ${branchId ? 'AND o.branch_id = $2' : ''}
          ${slot ? `AND o.delivery_slot = $${branchId ? 3 : 2}` : ''}
        ORDER BY o.branch_id, o.delivery_slot, o.created_at ASC
      `;

      const unassignedParams: any[] = [targetDate];
      if (branchId) unassignedParams.push(branchId);
      if (slot) unassignedParams.push(slot);
      const unassignedOrders: RunAssignment[] = await this.db.query(unassignedSql, unassignedParams);

      this.developer.debug('Unassigned orders fetched', {
        count: unassignedOrders.length,
        orderIds: unassignedOrders.map(o => o.order_id)
      });

      if (unassignedOrders.length === 0) {
        return {
          status: true,
          data: { runs_created: 0, total_assigned: 0, orders: [] },
          message: 'No unassigned orders found for this date',
        };
      }

      // Step 2: Get active delivery partners
      const partnersSql = `
        SELECT
          db.delivery_partner_id AS id,
          db.full_name AS name,
          db.branch_id,
          b.branch_name,
          db.max_daily_orders,
          db.current_lat,
          db.current_lng,
          COALESCE(
            (SELECT COUNT(*)::int FROM delivery_run_addresses dra
             JOIN delivery_runs dr ON dr.run_id = dra.run_id
             WHERE dr.delivery_partner_id = db.delivery_partner_id
               AND dr.run_date = $1),
            0
          ) AS current_load
        FROM delivery_partners db
         LEFT JOIN branches b ON b.branch_id = db.branch_id
         WHERE db.is_active = true
          AND db.is_available = true
          ${branchId ? 'AND db.branch_id = $2' : ''}
          AND NOT EXISTS (
            SELECT 1 FROM delivery_leave_requests dlr
            WHERE dlr.delivery_partner_id = db.delivery_partner_id
              AND dlr.status = 'approved'
              AND dlr.deleted_at IS NULL
              AND dlr.leave_date <= $1::date
              AND (dlr.end_date IS NULL OR dlr.end_date >= $1::date)
          )
        ORDER BY db.branch_id
      `;

      const partnersParams: any[] = [targetDate];
      if (branchId) partnersParams.push(branchId);
      const partners: PartnerInfo[] = await this.db.query(partnersSql, partnersParams);
      this.developer.debug('Active delivery partners fetched', {
        count: partners.length,
        partners: partners.map(p => ({ id: p.id, name: p.name, load: p.current_load }))
      });
      if (partners.length === 0) {
        return {
          status: false,
          data: { runs_created: 0, total_assigned: 0, orders: [] },
          message: 'No active delivery partners available',
        };
      }

      // Step 3: Get delivery history (address → preferred partner)
      const historySql = `
        SELECT DISTINCT
          o.address_id,
          o.delivery_partner_id,
          COUNT(*)::int AS delivery_count
        FROM orders o
        WHERE o.delivery_partner_id IS NOT NULL
          AND o.status = 'delivered'
          AND o.address_id IS NOT NULL
          ${branchId ? 'AND o.branch_id = $1' : ''}
        GROUP BY o.address_id, o.delivery_partner_id
        ORDER BY delivery_count DESC
      `;

      const historyParams: any[] = branchId ? [branchId] : [];
      const deliveryHistory = await this.db.query(historySql, historyParams);

      // Build address → partner preference map
      const addressPartnerMap = new Map<string, string>();
      for (const h of deliveryHistory) {
        if (h.address_id && !addressPartnerMap.has(h.address_id)) {
          addressPartnerMap.set(h.address_id, h.delivery_partner_id);
        }
      }

      // Step 4: Bulk-fetch order_items + product details for all orders (avoid N+1)
      const allOrderIds = unassignedOrders.map(o => o.order_id);
      const orderItemsSql = `
        SELECT
          oi.order_id,
          oi.variant_id AS product_variant_id,
          pv.name AS variant_name,
          p.name AS product_name,
          oi.quantity,
          pv.unit_type,
          pv.unit_value
        FROM order_items oi
        LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
        LEFT JOIN products p ON p.product_id = pv.product_id
        WHERE oi.order_id = ANY($1)
        ORDER BY oi.order_id, oi.created_at
      `;
      const orderItemsRows = await this.db.query(orderItemsSql, [allOrderIds]);

      // Build order_id → items_json map
      const orderItemsMap = new Map<string, any[]>();
      for (const item of orderItemsRows) {
        if (!orderItemsMap.has(item.order_id)) orderItemsMap.set(item.order_id, []);
        orderItemsMap.get(item.order_id)!.push({
          product_variant_id: item.product_variant_id,
          product_name: item.product_name || item.variant_name,
          variant_name: item.variant_name || '',
          quantity: Number(item.quantity),
          unit: item.unit_type || null,
          unit_value: item.unit_value ? Number(item.unit_value) : null,
        });
      }

      // Step 5: Group orders by branch + slot
      const orderGroups = new Map<string, RunAssignment[]>();
      for (const order of unassignedOrders) {
        const key = `${order.branch_id || '__global__'}::${order.delivery_slot || 'morning'}`;
        if (!orderGroups.has(key)) orderGroups.set(key, []);
        orderGroups.get(key)!.push(order);
      }

      // Step 6: For each group, create runs
      const partnerLoadMap = new Map<string, number>();
      for (const p of partners) {
        partnerLoadMap.set(p.id, p.current_load);
      }

      // Group partners by branch
      const branchPartners = new Map<string, PartnerInfo[]>();
      for (const p of partners) {
        const key = p.branch_id || '__global__';
        if (!branchPartners.has(key)) branchPartners.set(key, []);
        branchPartners.get(key)!.push(p);
      }

      const createdRuns: any[] = [];
      let totalAssigned = 0;
      const methodCounts = { auto_history: 0, auto_cluster: 0, auto_balanced: 0 };

      for (const [groupKey, orders] of orderGroups.entries()) {
        const [branchKey, slotName] = groupKey.split('::');
        const availablePartners = branchPartners.get(branchKey) || partners;

        // Cluster orders by proximity (simple greedy clustering)
        const clusters = this.clusterOrders(orders, availablePartners.length);

        for (const cluster of clusters) {
          // Find best partner for this cluster
          const { partnerId, method } = this.findBestPartner(
            cluster,
            availablePartners,
            partnerLoadMap,
            addressPartnerMap,
          );

          if (!partnerId) {
            this.logger.log(
              'No partner found',
              cluster.map(c => c.order_id),
            );
            continue;
          }

          // Group orders by address_id within this cluster
          const addressOrdersMap = new Map<string, RunAssignment[]>();
          for (const order of cluster) {
            const addrKey = order.address_id || order.order_id; // fallback for null address
            if (!addressOrdersMap.has(addrKey)) addressOrdersMap.set(addrKey, []);
            addressOrdersMap.get(addrKey)!.push(order);
          }

          // Build unique address representatives (one per address_id) for sequencing
          const uniqueAddresses: RunAssignment[] = [];
          for (const [, addrOrders] of addressOrdersMap.entries()) {
            uniqueAddresses.push(addrOrders[0]); // representative order per address
          }

          const branchIdVal = branchKey === '__global__' ? null : branchKey;

          // ── Check for existing run for same partner + branch + date + slot ──
          const existingRunRows = await this.db.query(
            `SELECT run_id, total_addresses
             FROM delivery_runs
             WHERE delivery_partner_id = $1
               AND run_date = $2
               AND delivery_slot = $3
               AND ($4::varchar IS NULL OR branch_id = $4)
               AND status NOT IN ('completed', 'cancelled')
             LIMIT 1`,
            [partnerId, targetDate, slotName, branchIdVal],
          );
          this.developer.debug('Check existing run result', {
            partnerId,
            branchIdVal,
            targetDate,
            slotName,
            existingCount: existingRunRows.length,
            existingRun: existingRunRows[0]
          });

          let runId: string;
          let runNumber: string;
          let isExistingRun = false;
          let currentMaxSeq = 0;
          let existingAddressIds = new Set<string>();

          if (existingRunRows.length > 0) {
            // ── Reuse existing run ──
            runId = existingRunRows[0].run_id;
            runNumber = runId;
            isExistingRun = true;

            // Get current max sequence_no for this run
            const seqRows = await this.db.query(
              `SELECT COALESCE(MAX(sequence_no), 0)::int AS max_seq
               FROM delivery_run_addresses WHERE run_id = $1`,
              [runId],
            );
            currentMaxSeq = seqRows[0]?.max_seq ?? 0;

            // Get addresses already in this run to skip duplicates
            const existingAddrRows = await this.db.query(
              `SELECT address_id FROM delivery_run_addresses WHERE run_id = $1`,
              [runId],
            );
            existingAddressIds = new Set(existingAddrRows.map((r: any) => r.address_id));
          } else {
            // ── Create new run ──
            const result = await this.db.query(
              `SELECT COUNT(*) + 1 AS next_no
               FROM delivery_runs
               WHERE run_date = $1 AND delivery_slot = $2`,
              [targetDate, slotName],
            );
            const nextNo = Number(result[0]?.next_no ?? 1);
            runNumber = `RUN-${targetDate.replace(/-/g, '')}-${slotName.substring(0, 3).toUpperCase()}-${String(nextNo).padStart(3, '0')}`;

            const runSql = `
              INSERT INTO delivery_runs
                (run_id, delivery_partner_id, branch_id, run_date, delivery_slot,
                 status, assignment_method, total_addresses, assigned_by)
              VALUES ($1, $2, $3, $4, $5, 'assigned', $6, $7, 'system')
              RETURNING id, run_id
            `;
            const runRows = await this.db.query(runSql, [
              runNumber, partnerId, branchIdVal, targetDate, slotName,
              method, uniqueAddresses.length,
            ]);
            runId = runRows[0]?.run_id;
            if (!runId) continue;
          }

          // Sort unique addresses by optimal sequence (nearest-neighbor)
          const sequencedAddresses = this.sequenceAddresses(uniqueAddresses);

          let newAddressCount = 0;

          // Insert UNIQUE run addresses + update orders + create delivery_logs
          for (let i = 0; i < sequencedAddresses.length; i++) {
            const representative = sequencedAddresses[i];
            const addrKey = representative.address_id || representative.order_id;
            const addrOrders = addressOrdersMap.get(addrKey)!;
            const orderIds = addrOrders.map(o => o.order_id);
            const customerId = addrOrders[0].customer_id;

            // Only insert address row if it doesn't already exist in this run
            if (!representative.address_id || !existingAddressIds.has(representative.address_id)) {
              currentMaxSeq++;
              newAddressCount++;
              await this.db.query(
                `INSERT INTO delivery_run_addresses
                  (run_id, address_id, sequence_no, customer_id, order_ids)
                VALUES ($1, $2, $3, $4, $5)`,
                [
                  runId, representative.address_id, currentMaxSeq,
                  customerId, JSON.stringify(orderIds),
                ],
              );
              existingAddressIds.add(representative.address_id!);
            } else {
              // Address already exists — append new order_ids to existing row
              await this.db.query(
                `UPDATE delivery_run_addresses
                 SET order_ids = (
                   SELECT jsonb_agg(DISTINCT val)::text
                   FROM jsonb_array_elements(COALESCE(order_ids::jsonb, '[]'::jsonb) || $2::text::jsonb) AS val
                 ),
                 updated_at = NOW()
                 WHERE run_id = $1 AND address_id = $3`,
                [runId, JSON.stringify(orderIds), representative.address_id],
              );
            }

            // Update all orders at this address with run reference
            for (const order of addrOrders) {
              this.developer.debug('Updating order assignment details', {
                orderId: order.order_id,
                partnerId,
                runId,
                sequence_no: currentMaxSeq
              });
              await this.db.query(
                `UPDATE orders SET
                  status = 'assigned',
                  delivery_partner_id = $2,
                  delivery_run_id = $3,
                  assignment_method = $4,
                  run_sequence = $5,
                  assigned_at = NOW(),
                  updated_at = NOW()
                WHERE order_id = $1
                  AND delivery_run_id IS NULL`,
                [order.order_id, partnerId, runId, method, currentMaxSeq],
              );

              try {
                await this.pushNotificationService.sendNotificationToUsers(
                  [order.customer_id],
                  {
                    title: 'Delivery Scheduled! 🚚',
                    body: `Your F2H Fresh order has been scheduled for ${slotName || 'today'} delivery.`,
                  },
                );
              } catch {
                // Deliberately tolerated: the caller has a valid fallback for this failure.
              }

              // Insert ONE delivery_log per order (prevent duplicates)
              const itemsJson = orderItemsMap.get(order.order_id) || [];
              this.developer.debug('Delivery log params', [
                runId,
                order.customer_id,
                order.order_id,
                order.address_id,
                partnerId,
                targetDate,
                slotName,
                JSON.stringify(itemsJson),
                order.order_lat,
                order.order_lng,
                currentMaxSeq,
              ]);
              await this.db.query(
                `INSERT INTO delivery_logs
                  (run_id, customer_id, order_id, address_id, delivery_partner_id,
                   delivery_date, slot, items_json, latitude, longitude, status)
                SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, 'pending'
                ON CONFLICT (order_id) WHERE deleted_at IS NULL DO NOTHING`,
                [
                  runId, order.customer_id, order.order_id,
                  order.address_id, partnerId,
                  targetDate, slotName, JSON.stringify(itemsJson),
                  order.order_lat, order.order_lng,
                ],
              );
            }
          }

          // Recalculate total_addresses on the run
          if (isExistingRun && newAddressCount > 0) {
            await this.db.query(
              `UPDATE delivery_runs
               SET total_addresses = (
                 SELECT COUNT(*)::int FROM delivery_run_addresses WHERE run_id = $1
               ),
               updated_at = NOW()
               WHERE run_id = $1`,
              [runId],
            );
          }

          const uniqueCount = uniqueAddresses.length;
          partnerLoadMap.set(partnerId, (partnerLoadMap.get(partnerId) ?? 0) + newAddressCount);
          methodCounts[method as keyof typeof methodCounts]++;
          totalAssigned += cluster.length;

          createdRuns.push({
            run_id: runId,
            run_number: runNumber,
            partner_id: partnerId,
            partner_name: availablePartners.find(p => p.id === partnerId)?.name,
            slot: slotName,
            unique_addresses: uniqueCount,
            new_addresses: newAddressCount,
            total_orders: cluster.length,
            reused_run: isExistingRun,
            method,
          });
        }
      }

      this.logger.log(
        `Created ${createdRuns.length} runs, assigned ${totalAssigned}/${unassignedOrders.length} orders for ${targetDate}`,
      );
      const adminUsersRes = await this.authServices.getUsersByRole('ADMIN');
      const adminUserIds = adminUsersRes.user_ids;

      const notification = await this.notificationService
        .sendNotification({
          title: 'Today runs created',
          message: `${createdRuns.length} delivery runs created with ${totalAssigned} orders`,
          type: 'info',
          priority: 'high',
          recipientIds: adminUserIds,
          senderId: 'system',
        });
      this.logger.log('notifications=========', notification);
      return {
        status: true,
        data: {
          runs_created: createdRuns.length,
          total_assigned: totalAssigned,
          total_unassigned: unassignedOrders.length,
          remaining: unassignedOrders.length - totalAssigned,
          methods: methodCounts,
          runs: createdRuns,
          partner_loads: Array.from(partnerLoadMap.entries()).map(([id, load]) => {
            const p = partners.find((p) => p.id === id);
            return { id, name: p?.name, load, max: p?.max_daily_orders };
          }),
        },

        message: `${createdRuns.length} delivery runs created with ${totalAssigned} orders`,
      };
    } catch (error) {
      this.developer.error('createOptimizedRuns error', { error });
      throw new InternalServerErrorException('Failed to create delivery runs');
    }
  }

  // ────────────────────────────────────────────────
  // Get Delivery Runs
  // ────────────────────────────────────────────────
  async getRuns(query: any) {
    try {
      const date = query.date || todayIST();
      await this.syncDispatchRequirementsForDate(date);
      const { partner_id, branch_id, status, slot, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const params: any[] = [date];
      const where: string[] = ['dr.run_date = $1'];

      if (partner_id) { params.push(partner_id); where.push(`dr.delivery_partner_id = $${params.length}`); }
      if (branch_id) { params.push(branch_id); where.push(`dr.branch_id = $${params.length}`); }
      if (status) { params.push(status); where.push(`dr.status = $${params.length}`); }
      if (slot) { params.push(slot); where.push(`dr.delivery_slot = $${params.length}`); }

      const sql = `
        SELECT
          dr.id, dr.run_id, dr.delivery_partner_id, dr.branch_id,
          dr.run_date, dr.delivery_slot, dr.status, dr.assignment_method,
          dr.total_addresses, dr.completed_addresses, dr.failed_addresses,
          dr.actual_start_time, dr.actual_end_time,
          db.full_name AS partner_name, db.phone AS partner_phone,
          b.branch_name,
          COALESCE(
            (SELECT SUM(o.total_amount) FROM orders o WHERE o.delivery_run_id = dr.run_id), 0
          )::numeric AS run_value
        FROM delivery_runs dr
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = dr.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = dr.branch_id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE dr.status
            WHEN 'in_progress' THEN 1 WHEN 'assigned' THEN 2 WHEN 'planned' THEN 3
            WHEN 'partial' THEN 4 WHEN 'completed' THEN 5 WHEN 'cancelled' THEN 6
          END ASC,
          dr.delivery_slot ASC, dr.created_at ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      // Count
      const countParams = params.slice(0, -2);
      const countRows = await this.db.query(
        `SELECT COUNT(*)::int AS total FROM delivery_runs dr WHERE ${where.join(' AND ')}`,
        countParams,
      );

      return {
        status: true,
        data: rows,
        total: countRows[0]?.total ?? 0,
        date,
        message: `${countRows[0]?.total} Delivery runs fetched`,
      };
    } catch (error) {
      this.developer.error('getRuns error', { error });
      throw new InternalServerErrorException('Failed to retrieve delivery runs');
    }
  }

  // ────────────────────────────────────────────────
  // Get Run Details
  // ────────────────────────────────────────────────
  async getRunDetails(runId: string) {
    try {
      const runSql = `
        SELECT
          dr.*, db.full_name AS partner_name, db.phone AS partner_phone,
          b.branch_name
        FROM delivery_runs dr
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = dr.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = dr.branch_id
        WHERE dr.id = $1
      `;
      const runRows = await this.db.query(runSql, [runId]);
      if (!runRows[0]) return { status: false, message: 'Run not found' };

      // Get addresses
      const addressesSql = `
        SELECT
          dra.*,
          o.total_amount, o.status AS order_status, o.delivery_slot,
          o.order_source
        FROM delivery_run_addresses dra
        LEFT JOIN orders o ON o.order_id = dra.order_id
        WHERE dra.run_id = $1
        ORDER BY dra.sequence_no ASC
      `;
      const addresses = await this.db.query(addressesSql, [runId]);

      // Get recent logs
      const logsSql = `
        SELECT * FROM delivery_logs
        WHERE run_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;
      const logs = await this.db.query(logsSql, [runId]);

      return {
        status: true,
        data: {
          run: runRows[0],
          addresses,
          logs,
        },
        message: 'Run details fetched',
      };
    } catch (error) {
      this.developer.error('getRunDetails error', { error });
      throw new InternalServerErrorException('Failed to retrieve run details');
    }
  }

  // ────────────────────────────────────────────────
  // Get Run Addresses
  // ────────────────────────────────────────────────
  async getRunAddresses(runId: string) {
    try {
      const sql = `
        SELECT
          dl.*,
          o.total_amount, o.status AS order_status, o.delivery_slot, o.customer_name,o.address_line,o.run_sequence
        FROM delivery_logs dl
        JOIN delivery_runs dr ON dr.run_id = dl.run_id
        LEFT JOIN orders o ON o.order_id = dl.order_id
        WHERE dr.id::varchar = $1 OR dr.run_id = $1
        ORDER BY o.run_sequence ASC, dl.created_at ASC
      `;
      const rows = await this.db.query(sql, [runId]);

      // Enrich items_json with live product and variant details
      const variantIds = new Set<string>();
      for (const row of rows) {
        let items: any[] = [];
        if (typeof row.items_json === 'string') {
          try { items = JSON.parse(row.items_json); } catch {
            // Deliberately tolerated: the caller has a valid fallback for this failure.
          }
        } else if (Array.isArray(row.items_json)) {
          items = row.items_json;
        }
        for (const item of items) {
          if (item.product_variant_id) {
            variantIds.add(item.product_variant_id);
          }
        }
      }

      if (variantIds.size > 0) {
        const liveDetails = await this.db.query(
          `SELECT pv.variant_id, pv.name AS variant_name, p.name AS product_name, pv.unit_type, pv.unit_value
           FROM product_variants pv
           LEFT JOIN products p ON p.product_id = pv.product_id
           WHERE pv.variant_id = ANY($1)`,
          [[...variantIds]]
        );

        const detailsMap = new Map<string, any>();
        for (const detail of liveDetails) {
          detailsMap.set(detail.variant_id, detail);
        }

        for (const row of rows) {
          let items: any[] = [];
          let isString = false;
          if (typeof row.items_json === 'string') {
            try {
              items = JSON.parse(row.items_json);
              isString = true;
            } catch {
              // Deliberately tolerated: the caller has a valid fallback for this failure.
            }
          } else if (Array.isArray(row.items_json)) {
            items = row.items_json;
          }

          const enrichedItems = items.map(item => {
            const detail = detailsMap.get(item.product_variant_id);
            if (detail) {
              return {
                ...item,
                product_name: detail.product_name || detail.variant_name || item.product_name,
                variant_name: detail.variant_name || item.variant_name,
                unit: detail.unit_type || item.unit,
                unit_value: detail.unit_value !== null ? Number(detail.unit_value) : item.unit_value,
              };
            }
            return item;
          });

          row.items_json = isString ? JSON.stringify(enrichedItems) : enrichedItems;
        }
      }

      return { status: true, data: rows, message: 'Run addresses fetched' };
    } catch (error) {
      this.developer.error('getRunAddresses error', { error });
      throw new InternalServerErrorException('Failed to retrieve run addresses');
    }
  }

  // ────────────────────────────────────────────────
  // Update Run Status
  // ────────────────────────────────────────────────
  async updateRunStatus(runId: string, newStatus: string, performedBy?: string) {
    try {
      const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled', 'partial'];
      if (!validStatuses.includes(newStatus)) {
        return { status: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` };
      }

      // Get current status
      const currentRow = await this.db.query(
        'SELECT status FROM delivery_runs WHERE id = $1', [runId],
      );
      const fromStatus = currentRow[0]?.status;

      const updateFields: string[] = ['status = $2', 'updated_at = NOW()'];
      const params: any[] = [runId, newStatus];

      if (newStatus === 'in_progress') {
        updateFields.push('actual_start_time = COALESCE(actual_start_time, NOW())');
      }
      if (newStatus === 'completed' || newStatus === 'partial') {
        updateFields.push('actual_end_time = NOW()');
        // Update completed/failed counts
        const countsSql = `
          SELECT
            COUNT(*) FILTER (WHERE status = 'delivered')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
          FROM delivery_run_addresses WHERE run_id = $1
        `;
        const counts = await this.db.query(countsSql, [runId]);
        if (counts[0]) {
          updateFields.push(`completed_addresses = ${counts[0].completed}`);
          updateFields.push(`failed_addresses = ${counts[0].failed}`);
        }
      }

      await this.db.query(
        `UPDATE delivery_runs SET ${updateFields.join(', ')} WHERE id = $1`,
        params,
      );

      // Log
      await this.db.query(
        `INSERT INTO delivery_logs (run_id, event_type, from_status, to_status, performed_by)
         VALUES ($1, 'status_change', $2, $3, $4)`,
        [runId, fromStatus, newStatus, performedBy || 'system'],
      );

      return { status: true, message: `Run status updated to ${newStatus}` };
    } catch (error) {
      this.developer.error('updateRunStatus error', { error });
      throw new InternalServerErrorException('Failed to update run status');
    }
  }

  // ────────────────────────────────────────────────
  // Update Address Status (within a run)
  // ────────────────────────────────────────────────
  async updateAddressStatus(
    addressId: string,
    newStatus: string,
    data?: { reason?: string; proof_url?: string; latitude?: number; longitude?: number },
    performedBy?: string,
  ) {
    try {
      const validStatuses = ['in_transit', 'arrived', 'delivered', 'failed', 'skipped', 'returned'];
      if (!validStatuses.includes(newStatus)) {
        return { status: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` };
      }

      const currentRow = await this.db.query(
        'SELECT run_id, status, order_id FROM delivery_run_addresses WHERE id = $1', [addressId],
      );
      if (!currentRow[0]) return { status: false, message: 'Address not found' };

      const fromStatus = currentRow[0].status;
      const runId = currentRow[0].run_id;
      const orderId = currentRow[0].order_id;

      const updateFields: string[] = ['status = $2', 'updated_at = NOW()'];
      const params: any[] = [addressId, newStatus];

      if (newStatus === 'delivered') {
        updateFields.push('delivered_at = NOW()');
      }
      if (newStatus === 'failed' && data?.reason) {
        params.push(data.reason);
        updateFields.push(`failed_reason = $${params.length}`);
      }
      if (data?.proof_url) {
        params.push(data.proof_url);
        updateFields.push(`proof_photo_url = $${params.length}`);
      }

      await this.db.query(
        `UPDATE delivery_run_addresses SET ${updateFields.join(', ')} WHERE id = $1`,
        params,
      );

      // Also update the order status
      if (newStatus === 'delivered') {
        await this.db.query(
          `UPDATE orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE order_id = $1`,
          [orderId],
        );

        // Process referral rewards only when order is delivered
        try {
          const ordRows = await this.db.query(`SELECT customer_id FROM orders WHERE order_id = $1 LIMIT 1`, [orderId]);
          const custId = ordRows?.[0]?.customer_id;
          if (custId) {
            await this.firstOrderDetector.detectAndMarkFirstOrder(custId, orderId);
            await this.firstOrderDetector.unlockReferralCode(custId);
            await this.referralRewardEngine.processReferralReward(custId, orderId);
          }
        } catch (refErr) {
          this.developer.error('DeliveryRunService: Failed to process referral reward on order delivery', refErr);
        }
      } else if (newStatus === 'failed') {
        await this.db.query(
          `UPDATE orders SET status = 'failed', updated_at = NOW() WHERE order_id = $1`,
          [orderId],
        );
      }

      // Log
      await this.db.query(
        `INSERT INTO delivery_logs
          (run_id, run_address_id, order_id, event_type, from_status, to_status,
           latitude, longitude, proof_url, reason, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          runId, addressId, orderId,
          `address_${newStatus}`, fromStatus, newStatus,
          data?.latitude ?? null, data?.longitude ?? null,
          data?.proof_url ?? null, data?.reason ?? null,
          performedBy || 'system',
        ],
      );

      // Update run counts
      await this.db.query(
        `UPDATE delivery_runs SET
          completed_addresses = (SELECT COUNT(*) FROM delivery_run_addresses WHERE run_id = $1 AND status = 'delivered'),
          failed_addresses = (SELECT COUNT(*) FROM delivery_run_addresses WHERE run_id = $1 AND status = 'failed'),
          updated_at = NOW()
        WHERE id = $1`,
        [runId],
      );

      return { status: true, message: `Address status updated to ${newStatus}` };
    } catch (error) {
      this.developer.error('updateAddressStatus error', { error });
      throw new InternalServerErrorException('Failed to update address status');
    }
  }

  // ────────────────────────────────────────────────
  // Reassign Run to Different Partner
  // ────────────────────────────────────────────────
  async reassignRun(runId: string, toPartnerId: string, reason?: string, adminId?: string) {
    try {
      const currentRun = await this.db.query(
        'SELECT delivery_partner_id, status FROM delivery_runs WHERE id = $1', [runId],
      );
      if (!currentRun[0]) return { status: false, message: 'Run not found' };

      const fromPartnerId = currentRun[0].delivery_partner_id;

      // Update run
      await this.db.query(
        `UPDATE delivery_runs SET
          delivery_partner_id = $2::uuid, assignment_method = 'manual', updated_at = NOW()
        WHERE id = $1`,
        [runId, toPartnerId],
      );

      // Update all orders in this run
      await this.db.query(
        `UPDATE orders SET
          delivery_partner_id = $2::uuid, assignment_method = 'manual',
          assigned_at = NOW(), updated_at = NOW()
        WHERE delivery_run_id = $1`,
        [runId, toPartnerId],
      );

      // Log reassignment
      await this.db.query(
        `INSERT INTO delivery_logs
          (run_id, event_type, from_partner_id, to_partner_id, reason, performed_by)
        VALUES ($1, 'reassignment', $2::uuid, $3::uuid, $4, $5)`,
        [runId, fromPartnerId, toPartnerId, reason, adminId || 'admin'],
      );

      return {
        status: true,
        message: `Run reassigned from partner ${fromPartnerId} to ${toPartnerId}`,
      };
    } catch (error) {
      this.developer.error('reassignRun error', { error });
      throw new InternalServerErrorException('Failed to reassign run');
    }
  }

  // ────────────────────────────────────────────────
  // Get Run Summary (aggregate stats for a date)
  // ────────────────────────────────────────────────
  async getRunSummary(date?: string) {
    try {
      const targetDate = date || todayIST();

      const sql = `
        SELECT
          COUNT(*)::int AS total_runs,
          COUNT(*) FILTER (WHERE status = 'planned')::int AS planned,
          COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'partial')::int AS partial,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
          COALESCE(SUM(total_addresses), 0)::int AS total_addresses,
          COALESCE(SUM(completed_addresses), 0)::int AS total_completed,
          COALESCE(SUM(failed_addresses), 0)::int AS total_failed,
          COUNT(DISTINCT delivery_partner_id)::int AS active_partners
        FROM delivery_runs
        WHERE run_date = $1
      `;
      const rows = await this.db.query(sql, [targetDate]);

      // Also get unassigned orders count
      const unassignedSql = `
        SELECT COUNT(*)::int AS unassigned
        FROM orders
        WHERE scheduled_date = $1
          AND delivery_run_id IS NULL
          AND delivery_partner_id IS NULL
          AND status NOT IN ('cancelled', 'failed', 'delivered')
      `;
      const unassignedRows = await this.db.query(unassignedSql, [targetDate]);

      return {
        status: true,
        data: {
          ...rows[0],
          unassigned: unassignedRows[0]?.unassigned ?? 0,
        },
        date: targetDate,
        message: 'Run summary fetched',
      };
    } catch (error) {
      this.developer.error('getRunSummary error', { error });
      throw new InternalServerErrorException('Failed to retrieve run summary');
    }
  }

  async checkPartnerAvailability(branchId?: string, date?: string) {
    try {
      const targetDate = date || todayIST();

      const sql = `
        SELECT
          b.branch_id,
          b.branch_name,
          COUNT(db.delivery_partner_id)::int AS total,
          COUNT(db.delivery_partner_id) FILTER (
            WHERE db.is_available = true
              AND NOT EXISTS (
                SELECT 1 FROM delivery_leave_requests dlr
                WHERE dlr.delivery_partner_id = db.delivery_partner_id
                  AND dlr.status = 'approved'
                  AND dlr.deleted_at IS NULL
                  AND dlr.leave_date <= $1::date
                  AND (dlr.end_date IS NULL OR dlr.end_date >= $1::date)
              )
          )::int AS available
        FROM branches b
        LEFT JOIN delivery_partners db ON db.branch_id = b.branch_id AND db.is_active = true
        WHERE b.is_active = true
          ${branchId ? 'AND b.branch_id = $2' : ''}
        GROUP BY b.branch_id, b.branch_name
      `;

      const params = branchId ? [targetDate, branchId] : [targetDate];
      const rows = await this.db.query(sql, params);

      let totalPartners = 0;
      let availablePartners = 0;
      const emptyBranches: string[] = [];

      for (const row of rows) {
        totalPartners += row.total;
        availablePartners += row.available;
        if (row.available === 0) {
          emptyBranches.push(row.branch_name);
        }
      }

      return {
        status: true,
        data: {
          total_partners: totalPartners,
          available_partners: availablePartners,
          has_empty_branch: emptyBranches.length > 0,
          empty_branches: emptyBranches,
          branches_detail: rows.map(r => ({
            branch_id: r.branch_id,
            branch_name: r.branch_name,
            total: r.total,
            available: r.available
          }))
        },
        message: 'Partner availability checked',
      };
    } catch (error) {
      this.developer.error('checkPartnerAvailability error', { error });
      throw new InternalServerErrorException('Failed to check partner availability');
    }
  }



  // ────────────────────────────────────────────────
  // Partner Run Summary (per-partner breakdown)
  // ────────────────────────────────────────────────
  async getPartnerRunSummary(date?: string) {
    try {
      const targetDate = date || todayIST();

      const sql = `
        SELECT
          db.delivery_partner_id AS partner_id,
          db.full_name AS partner_name,
          db.branch_id,
          b.branch_name,
          COUNT(dr.id)::int AS total_runs,
          COALESCE(SUM(dr.total_addresses), 0)::int AS total_addresses,
          COALESCE(SUM(dr.completed_addresses), 0)::int AS completed,
          COALESCE(SUM(dr.failed_addresses), 0)::int AS failed,
          COUNT(dr.id) FILTER (WHERE dr.status = 'in_progress')::int AS active_runs,
          COUNT(dr.id) FILTER (WHERE dr.status = 'completed')::int AS completed_runs,
          COUNT(dr.id) FILTER (WHERE dr.assignment_method = 'auto_history')::int AS history_runs,
          COUNT(dr.id) FILTER (WHERE dr.assignment_method = 'auto_cluster')::int AS cluster_runs,
          COUNT(dr.id) FILTER (WHERE dr.assignment_method = 'auto_balanced')::int AS balanced_runs,
          COUNT(dr.id) FILTER (WHERE dr.assignment_method = 'manual')::int AS manual_runs
        FROM delivery_partners db
        LEFT JOIN delivery_runs dr ON dr.delivery_partner_id = db.delivery_partner_id
          AND dr.run_date = $1
        LEFT JOIN branches b ON b.branch_id = db.branch_id
        WHERE db.is_active = true
        GROUP BY db.delivery_partner_id, db.full_name, db.branch_id, b.branch_name
        ORDER BY total_runs DESC
      `;

      const rows = await this.db.query(sql, [targetDate]);

      return {
        status: true,
        data: rows,
        date: targetDate,
        message: 'Partner run summary fetched',
      };
    } catch (error) {
      this.developer.error('getPartnerRunSummary error', { error });
      throw new InternalServerErrorException('Failed to retrieve partner run summary');
    }
  }

  // ════════════════════════════════════════════════
  // Private: Clustering & Sequencing Helpers
  // ════════════════════════════════════════════════

  private clusterOrders(orders: RunAssignment[], maxClusters: number): RunAssignment[][] {
    if (orders.length <= 8 || maxClusters <= 1) return [orders];

    // Simple greedy clustering: max ~15 addresses per run
    const maxPerCluster = Math.max(8, Math.ceil(orders.length / maxClusters));
    const clusters: RunAssignment[][] = [];
    const used = new Set<number>();

    // Group orders that have lat/lng by proximity
    const withCoords = orders.map((o, i) => ({ ...o, idx: i })).filter(o => o.order_lat && o.order_lng);
    const withoutCoords = orders.map((o, i) => ({ ...o, idx: i })).filter(o => !o.order_lat || !o.order_lng);

    // Greedy nearest-neighbor clustering for geo orders
    const geoUsed = new Set<number>();
    for (const seed of withCoords) {
      if (geoUsed.has(seed.idx)) continue;
      const cluster: RunAssignment[] = [seed];
      geoUsed.add(seed.idx);
      used.add(seed.idx);

      for (const candidate of withCoords) {
        if (geoUsed.has(candidate.idx) || cluster.length >= maxPerCluster) continue;
        const dist = this.haversineDistance(
          seed.order_lat!, seed.order_lng!,
          candidate.order_lat!, candidate.order_lng!,
        );
        if (dist <= 3) { // Within 3km
          cluster.push(candidate);
          geoUsed.add(candidate.idx);
          used.add(candidate.idx);
        }
      }

      if (cluster.length > 0) clusters.push(cluster);
    }

    // Add remaining non-geo orders distributed across clusters or as new cluster
    if (withoutCoords.length > 0) {
      if (clusters.length === 0) {
        // No geo clusters, just chunk evenly
        for (let i = 0; i < withoutCoords.length; i += maxPerCluster) {
          clusters.push(withoutCoords.slice(i, i + maxPerCluster));
        }
      } else {
        // Distribute to smallest clusters
        for (const o of withoutCoords) {
          const smallest = clusters.reduce((a, b) => a.length < b.length ? a : b);
          if (smallest.length < maxPerCluster) {
            smallest.push(o);
          } else {
            clusters.push([o]);
          }
        }
      }
    }

    return clusters;
  }

  private sequenceAddresses(orders: RunAssignment[]): RunAssignment[] {
    if (orders.length <= 2) return orders;

    // Nearest-neighbor heuristic for optimal delivery sequence
    const remaining = [...orders];
    const sequenced: RunAssignment[] = [remaining.shift()!];

    while (remaining.length > 0) {
      const last = sequenced[sequenced.length - 1];
      if (!last.order_lat || !last.order_lng) {
        sequenced.push(remaining.shift()!);
        continue;
      }

      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        if (!remaining[i].order_lat || !remaining[i].order_lng) continue;
        const dist = this.haversineDistance(
          last.order_lat, last.order_lng,
          remaining[i].order_lat!, remaining[i].order_lng!,
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      sequenced.push(remaining.splice(nearestIdx, 1)[0]);
    }

    return sequenced;
  }

  private findBestPartner(
    cluster: RunAssignment[],
    partners: PartnerInfo[],
    loadMap: Map<string, number>,
    historyMap: Map<string, string>,
  ): { partnerId: string | null; method: string } {

    let bestId: string | null = null;
    let bestMethod = 'auto_balanced';

    // History based
    const partnerVotes = new Map<string, number>();

    for (const order of cluster) {
      if (order.address_id && historyMap.has(order.address_id)) {
        const pid = historyMap.get(order.address_id)!;
        partnerVotes.set(pid, (partnerVotes.get(pid) ?? 0) + 1);
      }
    }

    if (partnerVotes.size > 0) {
      const sorted = [...partnerVotes.entries()].sort((a, b) => b[1] - a[1]);

      for (const [pid] of sorted) {
        const partner = partners.find(
          p => p.id === pid,
        );

        if (
          partner &&
          (loadMap.get(pid) ?? 0) + cluster.length <= partner.max_daily_orders
        ) {
          return {
            partnerId: pid,
            method: 'auto_history',
          };
        }
      }
    }

    // GPS proximity
    const center = this.getClusterCenter(cluster);

    if (center) {
      let minDistance = Number.MAX_VALUE;

      for (const partner of partners) {
        if (
          partner.current_lat &&
          partner.current_lng &&
          (loadMap.get(partner.id) ?? 0) + cluster.length <=
          partner.max_daily_orders
        ) {
          const distance = this.haversineDistance(
            center.lat,
            center.lng,
            partner.current_lat,
            partner.current_lng,
          );

          if (distance < minDistance) {
            minDistance = distance;
            bestId = partner.id;
            bestMethod = 'auto_cluster';
          }
        }
      }
    }

    // Load balanced
    if (!bestId) {
      let minLoad = Number.MAX_VALUE;

      for (const partner of partners) {
        const load =
          loadMap.get(partner.id) ?? 0;

        if (
          load + cluster.length <= partner.max_daily_orders &&
          load < minLoad
        ) {
          minLoad = load;
          bestId = partner.id;
          bestMethod = 'auto_balanced';
        }
      }
    }

    return {
      partnerId: bestId,
      method: bestMethod,
    };
  }

  private getClusterCenter(orders: RunAssignment[]): { lat: number; lng: number } | null {
    const withCoords = orders.filter(o => o.order_lat && o.order_lng);
    if (withCoords.length === 0) return null;
    const lat = withCoords.reduce((s, o) => s + o.order_lat!, 0) / withCoords.length;
    const lng = withCoords.reduce((s, o) => s + o.order_lng!, 0) / withCoords.length;
    return { lat, lng };
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // ────────────────────────────────────────────────
  // Get Delivery Logs with container tracking
  // ────────────────────────────────────────────────
  async getLogs(query: any) {
    try {
      const { run_id, delivery_partner_id, customer_id, date_from, date_to, status, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = [];

      if (run_id) {
        params.push(run_id);
        where.push(`dl.run_id = $${params.length}`);
      }
      if (delivery_partner_id) {
        params.push(delivery_partner_id);
        where.push(`dl.delivery_partner_id = $${params.length}`);
      }
      if (customer_id) {
        params.push(customer_id);
        where.push(`dl.customer_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`dl.status = $${params.length}`);
      }
      if (date_from) {
        params.push(date_from);
        where.push(`dl.delivery_date >= $${params.length}`);
      }
      if (date_to) {
        params.push(date_to);
        where.push(`dl.delivery_date <= $${params.length}`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT
          dl.*,
          dl.returned_containers,
          dl.damaged_containers,
          dl.lost_containers,
          dl.proof_photo_url,
          dl.delivery_time,
          db.full_name AS delivery_partner_name,
          o.total_amount AS order_total,
          o.status AS order_status
        FROM delivery_logs dl
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = dl.delivery_partner_id
        LEFT JOIN orders o ON o.order_id = dl.order_id
        ${whereClause}
        ORDER BY dl.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      const countSql = `SELECT COUNT(*)::int AS total FROM delivery_logs dl ${whereClause}`;
      const countRows = await this.db.query(countSql, params.slice(0, -2));

      return {
        status: true,
        data: rows,
        total: countRows[0]?.total ?? 0,
        message: 'Delivery logs fetched',
      };
    } catch (error) {
      this.developer.error('getLogs error', { error });
      throw new InternalServerErrorException('Failed to retrieve delivery logs');
    }
  }

  async syncDispatchRequirementsForDate(dateStr: string) {
    try {
      // Find all runs for this date
      const runs = await this.db.query(
        `SELECT run_id, delivery_partner_id, delivery_slot FROM delivery_runs WHERE run_date = $1`,
        [dateStr]
      );

      for (const run of runs) {
        // Find all delivery logs for this run
        const logs = await this.db.query(
          `SELECT items_json FROM delivery_logs WHERE run_id = $1`,
          [run.run_id]
        );

        const requirementsMap = new Map<string, { quantity: number; unit: string }>();

        for (const log of logs) {
          let items: any[] = [];
          if (typeof log.items_json === 'string') {
            try { items = JSON.parse(log.items_json); } catch {
              // Deliberately tolerated: the caller has a valid fallback for this failure.
            }
          } else if (Array.isArray(log.items_json)) {
            items = log.items_json;
          }

          for (const item of items) {
            if (!item.product_variant_id) continue;
            const qty = Number(item.quantity || 0);
            if (qty <= 0) continue;
            const unit = item.unit || 'pcs';

            if (!requirementsMap.has(item.product_variant_id)) {
              requirementsMap.set(item.product_variant_id, { quantity: 0, unit });
            }
            requirementsMap.get(item.product_variant_id)!.quantity += qty;
          }
        }

        // Now save to dispatch_requirements
        await this.db.transaction(async (client) => {
          // Delete existing for this run
          await client.query(
            `DELETE FROM dispatch_requirements WHERE run_id = $1`,
            [run.run_id]
          );

          // Insert new ones
          for (const [variantId, req] of requirementsMap.entries()) {
            await client.query(
              `INSERT INTO dispatch_requirements (
                run_id, run_date, delivery_slot, delivery_partner_id,
                product_variant_id, required_quantity, unit
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                run.run_id,
                dateStr,
                run.delivery_slot,
                run.delivery_partner_id,
                variantId,
                req.quantity,
                req.unit
              ]
            );
          }
        });
      }
    } catch (error) {
      this.developer.error('syncDispatchRequirementsForDate error', { error, date: dateStr });
    }
  }

  // ────────────────────────────────────────────────
  // Get Partner Addresses For Swap
  // ────────────────────────────────────────────────
  async getPartnerAddressesForSwap(partnerAId: string, partnerBId: string, date?: string) {
    try {
      const targetDate = date || todayIST();
      const partnerIds = [partnerAId, partnerBId];

      const sql = `
        SELECT
          dr.delivery_partner_id AS partner_id,
          dr.run_id,
          dr.delivery_slot,
          dr.status AS run_status,
          dra.id AS dra_id,
          dra.address_id,
          dra.sequence_no,
          dra.delivery_status,
          COALESCE(ca.address_line1 || ' ' || COALESCE(ca.address_line2, ''), ca.landmark, 'Customer Address') AS address_line,
          ca.contact_name,
          ca.contact_mobile,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), c.name, u.user_name, 'Customer') AS customer_name,
          (
            SELECT COUNT(*)::int FROM orders o
            WHERE o.delivery_run_id = dr.run_id
              AND o.address_id = dra.address_id
              AND o.deleted_at IS NULL
          ) AS order_count,
          (
            SELECT json_agg(json_build_object(
              'order_id', o.order_id,
              'total_amount', o.total_amount,
              'status', o.status
            )) FROM orders o
            WHERE o.delivery_run_id = dr.run_id
              AND o.address_id = dra.address_id
              AND o.deleted_at IS NULL
          ) AS orders
        FROM delivery_runs dr
        JOIN delivery_run_addresses dra ON dra.run_id = dr.run_id AND dra.deleted_at IS NULL
        LEFT JOIN customer_addresses ca ON ca.address_id = dra.address_id
        LEFT JOIN customers c ON c.customer_id = dra.customer_id
        LEFT JOIN users u ON u.user_id = dra.customer_id
        WHERE dr.run_date = $1
          AND dr.delivery_partner_id = ANY($2)
          AND dr.deleted_at IS NULL
          AND dr.status NOT IN ('completed', 'cancelled')
        ORDER BY dr.delivery_partner_id, dra.sequence_no ASC
      `;

      const rows = await this.db.query(sql, [targetDate, partnerIds]);

      const grouped: Record<string, { run_id: string; slot: string; run_status: string; addresses: any[] }> = {};
      for (const pid of partnerIds) {
        grouped[pid] = { run_id: '', slot: '', run_status: '', addresses: [] };
      }
      for (const row of rows) {
        const pid = row.partner_id;
        if (grouped[pid]) {
          if (!grouped[pid].run_id) {
            grouped[pid].run_id = row.run_id;
            grouped[pid].slot = row.delivery_slot;
            grouped[pid].run_status = row.run_status;
          }
          grouped[pid].addresses.push({
            dra_id: row.dra_id,
            address_id: row.address_id,
            sequence_no: row.sequence_no,
            delivery_status: row.delivery_status,
            address_line: row.address_line,
            contact_name: row.contact_name,
            contact_mobile: row.contact_mobile,
            customer_name: row.customer_name,
            order_count: row.order_count || 0,
            orders: row.orders || [],
          });
        }
      }

      return {
        status: true,
        data: {
          partner_a: { partner_id: partnerAId, ...grouped[partnerAId] },
          partner_b: { partner_id: partnerBId, ...grouped[partnerBId] },
          date: targetDate,
        },
        message: 'Partner addresses fetched for swap',
      };
    } catch (error) {
      this.developer.error('getPartnerAddressesForSwap error', { error });
      throw new InternalServerErrorException('Failed to fetch partner addresses');
    }
  }

  // ────────────────────────────────────────────────
  // Swap Addresses Between Two Delivery Runs
  // ────────────────────────────────────────────────
  async swapAddresses(body: {
    partner_a_id: string;
    partner_b_id: string;
    date?: string;
    swaps: Array<{
      address_id: string;
      from_run_id: string;
      to_run_id: string;
      order_ids: string[];
      to_partner_id: string;
    }>;
    admin_id?: string;
  }) {
    try {
      const { swaps, admin_id } = body;
      if (!swaps || swaps.length === 0) {
        return { status: false, message: 'No swaps provided' };
      }

      const affectedRunIds = new Set<string>();
      const partnerCreatedRuns = new Map<string, string>();

      for (const swap of swaps) {
        const { address_id, from_run_id, order_ids, to_partner_id } = swap;
        let targetRunId = (swap.to_run_id || '').trim();
        if (targetRunId === '--') targetRunId = '';

        if (from_run_id) {
          affectedRunIds.add(from_run_id);
        }

        // If target partner has no run_id specified or it's invalid, find or create a new delivery run
        if (!targetRunId && to_partner_id) {
          if (partnerCreatedRuns.has(to_partner_id)) {
            targetRunId = partnerCreatedRuns.get(to_partner_id)!;
          } else {
            let runDate = body.date || todayIST();
            let deliverySlot = 'morning';
            let branchId: string | null = null;

            if (from_run_id) {
              const [fromRun] = await this.db.query(
                `SELECT run_date, delivery_slot, branch_id FROM delivery_runs WHERE run_id = $1 LIMIT 1`,
                [from_run_id],
              );
              if (fromRun) {
                if (fromRun.run_date) {
                  runDate = typeof fromRun.run_date === 'string'
                    ? fromRun.run_date.split('T')[0]
                    : new Date(fromRun.run_date).toISOString().split('T')[0];
                }
                if (fromRun.delivery_slot) deliverySlot = fromRun.delivery_slot;
                if (fromRun.branch_id) branchId = fromRun.branch_id;
              }
            }

            const existingRuns = await this.db.query(
              `SELECT run_id FROM delivery_runs
               WHERE delivery_partner_id = $1
                 AND run_date = $2
                 AND delivery_slot = $3
                 AND status NOT IN ('completed', 'cancelled')
                 AND deleted_at IS NULL
               ORDER BY created_at DESC LIMIT 1`,
              [to_partner_id, runDate, deliverySlot],
            );

            if (existingRuns && existingRuns.length > 0 && existingRuns[0].run_id) {
              targetRunId = existingRuns[0].run_id;
            } else {
              const dateStr = runDate.replace(/-/g, '');
              const slotPrefix = (deliverySlot || 'MOR').substring(0, 3).toUpperCase();
              const nextRes = await this.db.query(
                `SELECT COALESCE(MAX(CAST(SPLIT_PART(run_id, '-', 4) AS INTEGER)), 0) + 1 AS next_no
                 FROM delivery_runs
                 WHERE run_date = $1 AND delivery_slot = $2`,
                [runDate, deliverySlot],
              );
              const nextNo = Number(nextRes?.[0]?.next_no ?? 1);
              targetRunId = `RUN-${dateStr}-${slotPrefix}-${String(nextNo).padStart(3, '0')}`;

              await this.db.query(
                `INSERT INTO delivery_runs
                   (run_id, delivery_partner_id, branch_id, run_date, delivery_slot,
                    status, assignment_method, total_addresses, assigned_by)
                 VALUES ($1, $2, $3, $4, $5, 'assigned', 'manual', 0, $6)`,
                [targetRunId, to_partner_id, branchId, runDate, deliverySlot, admin_id || 'system'],
              );
            }
            partnerCreatedRuns.set(to_partner_id, targetRunId);
          }
        }

        if (targetRunId) {
          affectedRunIds.add(targetRunId);

          const updateRes = await this.db.query(
            `UPDATE delivery_run_addresses
               SET run_id = $1, updated_at = NOW()
             WHERE run_id = $2 AND address_id = $3 AND deleted_at IS NULL`,
            [targetRunId, from_run_id, address_id],
          );

          if ((updateRes as any)?.rowCount === 0 || (Array.isArray(updateRes) && updateRes.length === 0)) {
            let customerId = 'UNKNOWN';
            if (order_ids && order_ids.length > 0) {
              const cRes = await this.db.query(`SELECT customer_id FROM orders WHERE order_id = $1 LIMIT 1`, [order_ids[0]]);
              if (cRes?.[0]?.customer_id) customerId = cRes[0].customer_id;
            }

            await this.db.query(
              `INSERT INTO delivery_run_addresses
                 (run_id, address_id, sequence_no, customer_id, order_ids)
               VALUES
                 ($1, $2, (SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM delivery_run_addresses WHERE run_id = $1 AND deleted_at IS NULL), $3, $4)`,
              [targetRunId, address_id, customerId, order_ids ? order_ids.join(',') : null],
            );
          }

          if (order_ids && order_ids.length > 0) {
            await this.db.query(
              `UPDATE orders
                 SET delivery_partner_id = $1,
                     delivery_run_id = $2,
                     assignment_method = 'manual',
                     updated_at = NOW()
               WHERE order_id = ANY($3)`,
              [to_partner_id, targetRunId, order_ids],
            );
          }
        }
      }

      for (const runId of affectedRunIds) {
        if (!runId) continue;
        await this.db.query(
          `UPDATE delivery_runs
             SET total_addresses = (
               SELECT COUNT(*)::int FROM delivery_run_addresses
               WHERE run_id = $1 AND deleted_at IS NULL
             ),
             updated_at = NOW()
           WHERE run_id = $1`,
          [runId],
        );
      }

      const partnerIds = [...new Set([body.partner_a_id, body.partner_b_id])].filter(Boolean);
      for (const pid of partnerIds) {
        try {
          await this.pushNotificationService.sendNotificationToUsers(
            [pid],
            {
              title: 'Delivery Run Updated 🔄',
              body: 'Your delivery run addresses have been updated by the admin.',
            },
          );
        } catch (_) {}
      }

      return {
        status: true,
        message: `${swaps.length} address swap(s) applied successfully`,
        data: { swaps_applied: swaps.length },
      };
    } catch (error) {
      this.developer.error('swapAddresses error', { error });
      throw new InternalServerErrorException('Failed to swap delivery addresses');
    }
  }
}


