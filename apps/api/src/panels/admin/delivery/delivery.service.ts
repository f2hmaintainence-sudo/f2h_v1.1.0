import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { NotificationService } from 'src/notifications/notification.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';

import { FirstOrderDetectorService } from '../../customer/referral/services/first-order-detector.service';
import { ReferralRewardEngineService } from '../../customer/referral/services/referral-reward-engine.service';
import { RedisService } from 'src/shared/redis/redis.service';

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

@Injectable()
export class DeliveryManagementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly notificationService: NotificationService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly firstOrderDetector: FirstOrderDetectorService,
    private readonly referralRewardEngine: ReferralRewardEngineService,
    private readonly redisService: RedisService,
  ) { }

  async notifyPartner(partnerId: string, title: string, messageBody: string): Promise<void> {
    try {
      const boyRows = await this.db.query(
        `SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1 OR user_id = $1`,
        [partnerId],
      );
      if (!boyRows || boyRows.length === 0) return;
      const targetBoy = boyRows[0];
      const userId = targetBoy.user_id || targetBoy.delivery_partner_id || partnerId;

      // 1. Send In-App & Database Notification
      try {
        await this.notificationService.sendNotification({
          title,
          message: messageBody,
          type: 'info',
          priority: 'high',
          recipientIds: [userId],
          senderId: 'admin',
        });
      } catch (err) {
        this.developer.error(`[notifyPartner] In-app notification error for ${userId}:`, { err });
      }

      // 2. Send FCM Mobile Push Notification
      try {
        await this.pushNotificationService.sendNotificationToUsers([userId], {
          title,
          body: messageBody,
        });
      } catch (err) {
        this.developer.error(`[notifyPartner] Mobile push notification error for ${userId}:`, { err });
      }
    } catch (error) {
      this.developer.error(`[notifyPartner] Failed to notify partner ${partnerId}:`, { error });
    }
  }

  // ────────────────────────────────────────────────

  // Delivery Partners
  // ────────────────────────────────────────────────
  async getDeliveryPartners(query: any) {
    try {
      const { branch_id, status, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [];
      const where: string[] = [];

      if (branch_id) {
        params.push(branch_id);
        where.push(`db.branch_id = $${params.length}`);
      }
      if (status === 'active') {
        where.push(`db.is_active = true`);
      } else if (status === 'inactive') {
        where.push(`db.is_active = false`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT
          db.delivery_partner_id,
          db.delivery_partner_id AS user_id,
          db.is_verified,
          COALESCE(u.first_name || ' ' || u.last_name, u.user_name, 'Delivery Partner') AS full_name,
          u.phone,
          u.email,
          db.branch_id,
          b.branch_name,
          db.is_active,
          db.is_available,
          CASE WHEN (to_jsonb(db)->>'is_online') IS NOT NULL THEN ((to_jsonb(db)->>'is_online')::boolean) ELSE db.is_available END AS is_online,
          db.daily_salary,
          db.max_daily_orders,
          db.current_lat,
          db.current_lng,
          db.last_location_at,
          (
            SELECT COUNT(*)::int FROM orders o
            WHERE o.delivery_partner_id = db.delivery_partner_id
              AND (o.scheduled_date = CURRENT_DATE OR o.created_at::date = CURRENT_DATE)
              AND o.status NOT IN ('cancelled', 'failed')
          ) AS today_assigned,
          (
            SELECT COUNT(*)::int FROM orders o
            WHERE o.delivery_partner_id = db.delivery_partner_id
              AND (o.scheduled_date = CURRENT_DATE OR o.created_at::date = CURRENT_DATE)
              AND o.status = 'delivered'
          ) AS today_delivered,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'order_id', o.order_id,
                  'status', o.status,
                  'total_amount', o.total_amount,
                  'delivery_slot', o.delivery_slot
                )
              )
              FROM orders o
              WHERE o.delivery_partner_id = db.delivery_partner_id
                AND (o.scheduled_date = CURRENT_DATE OR o.created_at::date = CURRENT_DATE)
            ), '[]'::json
          ) AS assigned_orders,
          db.created_at
        FROM delivery_partners db
        LEFT JOIN users u ON u.user_id = db.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = db.branch_id
        ${whereClause}
        ORDER BY db.is_active DESC, u.first_name ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(parseInt(limit, 10), offset);
      const rows = await this.db.query(sql, params);

      // Count total
      const countParams = params.slice(0, -2);
      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM delivery_partners db
        ${whereClause}
      `;
      const countRows = await this.db.query(countSql, countParams);

      return {
        status: true,
        data: rows,
        total: countRows[0]?.total ?? 0,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        message: 'Delivery partners fetched',
      };
    } catch (error) {
      this.developer.error('getDeliveryPartners error', { error });
      throw new InternalServerErrorException('Failed to retrieve delivery partners');
    }
  }

  async getPartnerDetails(partnerId: string) {
    try {
      const sql = `
        SELECT
          db.*,
          b.branch_name
        FROM delivery_partners db
        LEFT JOIN branches b ON b.branch_id = db.branch_id
        WHERE db.delivery_partner_id = $1
      `;
      const rows = await this.db.query(sql, [partnerId]);

      return {
        status: true,
        data: rows[0] ?? null,
        message: rows[0] ? 'Partner details fetched' : 'Partner not found',
      };
    } catch (error) {
      this.developer.error('getPartnerDetails error', { error });
      throw new InternalServerErrorException('Failed to retrieve partner details');
    }
  }

  async getPartnerStats(partnerId: string, days: number) {
    try {
      const sql = `
        SELECT
          COUNT(*)::int                                           AS total_orders,
          COUNT(*) FILTER (WHERE status = 'delivered')::int      AS delivered,
          COUNT(*) FILTER (WHERE status = 'failed')::int         AS failed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int      AS cancelled,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'delivered')::numeric /
            NULLIF(COUNT(*) FILTER (WHERE status NOT IN ('cancelled')), 0) * 100,
            1
          )::numeric                                              AS delivery_rate,
          COUNT(DISTINCT scheduled_date)::int                     AS active_days,
          COUNT(DISTINCT customer_id)::int                        AS unique_customers
        FROM orders
        WHERE delivery_partner_id = $1
          AND scheduled_date >= CURRENT_DATE - ($2 || ' days')::interval
      `;
      const rows = await this.db.query(sql, [partnerId, days]);

      return {
        status: true,
        data: rows[0] ?? {},
        message: 'Partner stats fetched',
      };
    } catch (error) {
      this.developer.error('getPartnerStats error', { error });
      throw new InternalServerErrorException('Failed to retrieve partner stats');
    }
  }

  async updatePartnerStatus(partnerId: string, body: { is_active?: boolean; is_available?: boolean; branch_id?: string; daily_salary?: number }) {
    try {
      const updateFields: string[] = [];
      const params: any[] = [];

      if (body.is_active !== undefined) {
        params.push(body.is_active);
        updateFields.push(`is_active = $${params.length}`);
      }
      if (body.is_available !== undefined) {
        params.push(body.is_available);
        updateFields.push(`is_available = $${params.length}`);
      }
      if (body.branch_id !== undefined) {
        params.push(body.branch_id);
        updateFields.push(`branch_id = $${params.length}`);
      }
      if (body.daily_salary !== undefined && body.daily_salary !== null) {
        params.push(body.daily_salary);
        updateFields.push(`daily_salary = $${params.length}`);
      }

      if (updateFields.length === 0) {
        return { status: false, message: 'No status fields provided for update' };
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(partnerId);

      const sql = `
        UPDATE delivery_partners
        SET ${updateFields.join(', ')}
        WHERE delivery_partner_id = $${params.length}
        RETURNING delivery_partner_id, is_active, is_available, branch_id, daily_salary
      `;

      const rows = await this.db.query(sql, params);

      if (!rows || rows.length === 0) {
        return { status: false, message: 'Delivery partner not found' };
      }

      // Dispatch Mobile Push & In-App notification to the partner
      if (body.is_active !== undefined) {
        const title = body.is_active ? '🎉 Account Activated!' : 'Account Status Updated';
        const msg = body.is_active
          ? 'Congratulations! Your Delivery Partner account has been activated by Admin. You can now log in, accept delivery runs, and start delivering orders.'
          : 'Your Delivery Partner account status has been set to Inactive by Admin.';
        await this.notifyPartner(partnerId, title, msg);
      }

      if (body.branch_id !== undefined) {
        let branchName = 'Unassigned';
        if (body.branch_id) {
          const branchRows = await this.db.query(
            `SELECT branch_name FROM branches WHERE branch_id = $1 OR id::text = $1 LIMIT 1`,
            [body.branch_id],
          );
          if (branchRows && branchRows.length > 0 && branchRows[0].branch_name) {
            branchName = branchRows[0].branch_name;
          }
        }
        const title = '🏢 Branch Reassigned';
        const msg = body.branch_id
          ? `Your assigned delivery branch has been updated to ${branchName}.`
          : `Your assigned delivery branch has been updated by the Admin.`;
        await this.notifyPartner(partnerId, title, msg);
      } else if (body.daily_salary !== undefined && body.is_active === undefined) {
        const title = 'Profile Details Updated';
        const msg = `Your daily salary details have been updated by the Admin.`;
        await this.notifyPartner(partnerId, title, msg);
      }

      return {
        status: true,
        data: rows[0],
        message: `Delivery partner status updated successfully`,
      };
    } catch (error) {
      this.developer.error('updatePartnerStatus error', { error });
      throw new InternalServerErrorException('Failed to update delivery partner status');
    }
  }

  async getPartnerDocuments(partnerId: string) {
    try {
      const boySql = `
        SELECT
          db.*,
          b.branch_name
        FROM delivery_partners db
        LEFT JOIN branches b ON b.branch_id = db.branch_id
        WHERE db.delivery_partner_id = $1 OR db.user_id = $1
      `;
      const boyRows = await this.db.query(boySql, [partnerId]);
      const partnerObj = boyRows[0] ?? null;

      const targetId = partnerObj?.delivery_partner_id || partnerObj?.user_id || partnerId;
      const userId = partnerObj?.user_id || targetId;
      const boyId = partnerObj?.delivery_partner_id || targetId;

      const docsList: any[] = [];
      if (partnerObj?.aadhaar_url) {
        docsList.push({ id: 1, document_type: 'aadhaar', document_url: partnerObj.aadhaar_url, verification_status: partnerObj.is_verified ? 'verified' : 'pending' });
      }
      if (partnerObj?.id_proof_url) {
        docsList.push({ id: 2, document_type: 'id_proof', document_url: partnerObj.id_proof_url, verification_status: partnerObj.is_verified ? 'verified' : 'pending' });
      }
      if (partnerObj?.profile_photo_url) {
        docsList.push({ id: 3, document_type: 'profile_photo', document_url: partnerObj.profile_photo_url, verification_status: partnerObj.is_verified ? 'verified' : 'pending' });
      }

      const vehicleList: any[] = partnerObj?.vehicle_type ? [{
        id: 1,
        vehicle_type: partnerObj.vehicle_type,
        vehicle_number: partnerObj.vehicle_number,
        verification_status: partnerObj.is_verified ? 'verified' : 'pending',
      }] : [];

      const bankList: any[] = partnerObj?.bank_account_number ? [{
        id: 1,
        bank_account_number: partnerObj.bank_account_number,
        bank_ifsc: partnerObj.bank_ifsc,
        bank_name: partnerObj.bank_name,
        account_holder_name: partnerObj.account_holder_name,
        verification_status: partnerObj.is_verified ? 'verified' : 'pending',
      }] : [];

      return {
        status: true,
        data: {
          partner: partnerObj,
          documents: docsList,
          vehicles: vehicleList,
          bank_accounts: bankList,
        },
        message: 'Partner documents and verification details fetched',
      };
    } catch (error) {
      this.developer.error('getPartnerDocuments error', { error });
      throw new InternalServerErrorException('Failed to retrieve partner documents');
    }
  }

  async updatePartnerVerification(partnerId: string, body: {
    is_verified?: boolean;
    document_id?: number;
    document_status?: string;
    rejection_reason?: string;
    vehicle_id?: number;
    vehicle_status?: string;
    bank_account_id?: number;
    bank_status?: string;
  }) {
    try {
      if (body.is_verified !== undefined) {
        const boySql = `
          UPDATE delivery_partners
          SET is_verified = $1, updated_at = NOW()
          WHERE delivery_partner_id = $2 OR user_id = $2 OR id::text = $2
          RETURNING delivery_partner_id, is_verified, is_active
        `;
        await this.db.query(boySql, [body.is_verified, partnerId]);

        const title = body.is_verified ? 'KYC Fully Verified 🎉' : 'KYC Status Update ⚠️';
        const msg = body.is_verified
          ? 'Congratulations! Your profile and KYC verification have been approved. You are now ready for delivery runs!'
          : 'Your overall KYC verification status has been marked as pending/unverified by Admin. Please check your document proofs.';
        await this.notifyPartner(partnerId, title, msg);

        return {
          status: true,
          message: `Partner verification status updated to ${body.is_verified}`,
        };
      }

      return { status: true, message: 'Verification details updated successfully' };
    } catch (error) {
      this.developer.error('updatePartnerVerification error', { error });
      throw new InternalServerErrorException('Failed to update verification details');
    }
  }

  // ────────────────────────────────────────────────
  // Delivery Tracking
  // ────────────────────────────────────────────────
  async getDeliveryTracking(query: any) {
    try {
      const date = query.date || todayIST();
      const { branch_id, status, partner_id, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [date];
      const where: string[] = ['o.scheduled_date = $1'];

      if (branch_id) {
        params.push(branch_id);
        where.push(`o.branch_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        where.push(`o.status = $${params.length}`);
      }
      if (partner_id) {
        params.push(partner_id);
        where.push(`o.delivery_partner_id = $${params.length}`);
      }

      const sql = `
        SELECT
          o.order_id,
          o.customer_id,
          o.customer_name,
          o.status,
          o.order_source,
          o.delivery_slot,
          o.address_line,
          o.contact_number,
          o.total_amount,
          o.delivery_partner_id,
          o.assignment_method,
          o.assigned_at,
          o.scheduled_date,
          o.created_at,
          o.branch_id,
          b.branch_name,
          COALESCE(NULLIF(TRIM(db.full_name), ''), NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.user_name) AS partner_name,
          COALESCE(NULLIF(TRIM(db.phone), ''), NULLIF(TRIM(u.phone), ''), NULLIF(TRIM(db.email), ''), NULLIF(TRIM(u.email), ''), '—') AS partner_phone,
          ca.latitude  AS lat,
          ca.longitude AS lng,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', oi.id,
                  'product_name', COALESCE(p.name, 'Fresh Item'),
                  'variant_name', pv.name,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'final_price', COALESCE(oi.final_price, oi.unit_price * oi.quantity)
                )
              )
              FROM order_items oi
              LEFT JOIN product_variants pv ON pv.variant_id = oi.variant_id
              LEFT JOIN products p ON p.product_id = pv.product_id
              WHERE oi.order_id = o.order_id
            ), '[]'::json
          ) AS items
        FROM orders o
        LEFT JOIN delivery_partners db ON (db.delivery_partner_id = o.delivery_partner_id OR db.user_id = o.delivery_partner_id)
        LEFT JOIN users u ON u.user_id = o.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = o.branch_id
        LEFT JOIN customer_addresses ca ON ca.address_id::text = o.address_id::text
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE o.status
            WHEN 'placed' THEN 1
            WHEN 'confirmed' THEN 2
            WHEN 'assigned' THEN 3
            WHEN 'packed' THEN 4
            WHEN 'out_for_delivery' THEN 5
            WHEN 'delivered' THEN 6
            WHEN 'cancelled' THEN 7
            WHEN 'failed' THEN 8
            ELSE 9
          END ASC,
          o.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      let mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      try {
        const keyRes = await this.db.query(
          `SELECT config_data FROM api_integrations_config WHERE category = 'maps' AND is_active = true LIMIT 1`
        );
        if (keyRes?.[0]?.config_data?.apiKey) {
          mapsApiKey = keyRes[0].config_data.apiKey;
        }
      } catch {
        // Deliberately tolerated: the caller has a valid fallback for this failure.
      }

      return {
        status: true,
        data: rows,
        mapsApiKey,
        date,
        message: 'Delivery tracking fetched',
      };
    } catch (error) {
      this.developer.error('getDeliveryTracking error', { error });
      throw new InternalServerErrorException('Failed to retrieve delivery tracking');
    }
  }

  async getTrackingSummary(date?: string) {
    try {
      const targetDate = date || todayIST();

      const sql = `
        SELECT
          COUNT(*)::int                                              AS total_orders,
          COUNT(*) FILTER (WHERE delivery_partner_id IS NOT NULL)::int AS assigned,
          COUNT(*) FILTER (WHERE delivery_partner_id IS NULL AND status != 'cancelled')::int AS unassigned,
          COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int   AS in_transit,
          COUNT(*) FILTER (WHERE status = 'delivered')::int          AS delivered,
          COUNT(*) FILTER (WHERE status = 'failed')::int             AS failed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int          AS cancelled,
          COUNT(DISTINCT delivery_partner_id)::int                   AS active_partners
        FROM orders
        WHERE scheduled_date = $1
      `;
      const rows = await this.db.query(sql, [targetDate]);

      return {
        status: true,
        data: rows[0] ?? {},
        date: targetDate,
        message: 'Tracking summary fetched',
      };
    } catch (error) {
      this.developer.error('getTrackingSummary error', { error });
      throw new InternalServerErrorException('Failed to retrieve tracking summary');
    }
  }

  /**
   * Returns the last-known GPS position for all delivery partners that have
   * ever sent a location update. Used by the admin tracking page on initial
   * load so every partner marker appears on the map before WebSocket takes over.
   */
  async getLivePartnerPositions(branchId?: string) {
    try {
      const params: any[] = [];
      const where: string[] = [
        'dp.current_lat IS NOT NULL',
        'dp.current_lng IS NOT NULL',
      ];

      if (branchId) {
        params.push(branchId);
        where.push(`dp.branch_id = $${params.length}`);
      }

      const sql = `
        SELECT
          dp.delivery_partner_id,
          COALESCE(u.first_name || ' ' || u.last_name, u.user_name, 'Delivery Partner') AS full_name,
          dp.branch_id,
          b.branch_name,
          dp.current_lat,
          dp.current_lng,
          dp.last_location_at,
          dp.is_online,
          dp.is_available,
          dp.is_active
        FROM delivery_partners dp
        LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = dp.branch_id
        WHERE ${where.join(' AND ')}
        ORDER BY dp.last_location_at DESC NULLS LAST
      `;

      const rows = await this.db.query(sql, params);

      // Enrich with latest live location data from Redis cache (0 DB/external API cost)
      for (const row of rows) {
        try {
          const key = `delivery_partner_location:${row.delivery_partner_id}`;
          const redisLoc: any = await this.redisService.fetch(key);
          if (redisLoc) {
            if (redisLoc.latitude) row.current_lat = redisLoc.latitude;
            if (redisLoc.longitude) row.current_lng = redisLoc.longitude;
            if (redisLoc.battery != null) row.battery = redisLoc.battery;
            if (redisLoc.speed != null) row.speed = redisLoc.speed;
            if (redisLoc.updatedAt) row.last_location_at = redisLoc.updatedAt;
          }
        } catch {
          // Deliberately tolerated: the caller has a valid fallback for this failure.
        }
      }

      return {
        status: true,
        data: rows,
        message: 'Live partner positions fetched',
      };
    } catch (error) {
      this.developer.error('getLivePartnerPositions error', { error });
      throw new InternalServerErrorException('Failed to retrieve live partner positions');
    }
  }

  async updateDeliveryStatus(orderId: string, status: string, notes?: string) {
    try {
      const normStatus = String(status || '').toLowerCase().replace(/[\s_-]+/g, '_');
      const validStatuses = ['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'failed'];
      if (!validStatuses.includes(normStatus)) {
        return { status: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` };
      }

      const updateFields: string[] = [
        `status = $2`,
        `updated_at = NOW()`,
      ];
      const params: any[] = [orderId, normStatus];

      // Note: delivered_at column does not exist on orders table; status update only.

      const sql = `
        UPDATE orders
        SET ${updateFields.join(', ')}
        WHERE order_id = $1 OR id::text = $1
        RETURNING order_id, customer_id, status
      `;

      const rows = await this.db.query(sql, params);
      const updatedOrder = rows?.[0];

      if (status === 'delivered' && updatedOrder?.customer_id) {
        try {
          await this.firstOrderDetector.detectAndMarkFirstOrder(updatedOrder.customer_id, orderId);
          await this.firstOrderDetector.unlockReferralCode(updatedOrder.customer_id);
          await this.referralRewardEngine.processReferralReward(updatedOrder.customer_id, orderId);
        } catch (refErr) {
          this.developer.error('DeliveryManagementService: Failed to process referral reward', refErr);
        }
      }

      await this.broadcastOrderUpdate(updatedOrder?.order_id || orderId);

      return {
        status: true,
        data: updatedOrder ?? null,
        message: `Order ${orderId} status updated to ${status}`,
      };
    } catch (error) {
      this.developer.error('updateDeliveryStatus error', { error });
      throw new InternalServerErrorException('Failed to update delivery status');
    }
  }

  async broadcastOrderUpdate(orderId: string) {
    try {
      const sql = `
        SELECT
          o.order_id,
          o.customer_id,
          o.customer_name,
          o.status,
          o.order_source,
          o.delivery_slot,
          o.address_line,
          o.contact_number,
          o.total_amount,
          o.delivery_partner_id,
          o.assignment_method,
          o.assigned_at,
          o.scheduled_date,
          o.created_at,
          o.branch_id,
          b.branch_name,
          COALESCE(NULLIF(TRIM(db.full_name), ''), NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.user_name) AS partner_name,
          COALESCE(NULLIF(TRIM(db.phone), ''), NULLIF(TRIM(u.phone), '')) AS partner_phone
        FROM orders o
        LEFT JOIN delivery_partners db ON (db.delivery_partner_id = o.delivery_partner_id OR db.user_id = o.delivery_partner_id)
        LEFT JOIN users u ON u.user_id = o.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = o.branch_id
        WHERE o.order_id = $1 OR o.id::text = $1
        LIMIT 1
      `;
      const rows = await this.db.query(sql, [orderId]);
      if (rows && rows.length > 0) {
        const orderData = rows[0];
        const gateway = this.notificationService.getGateway();
        if (gateway && typeof gateway.emitOrderStatusChanged === 'function') {
          gateway.emitOrderStatusChanged(orderData);
        }
      }
    } catch (err) {
      this.developer.error('broadcastOrderUpdate error', { err });
    }
  }

  async assignPartnerToOrder(orderId: string, partnerId: string) {
    try {
      const sql = `
        UPDATE orders
        SET delivery_partner_id = $1,
            assignment_method   = 'manual',
            assigned_at         = NOW(),
            updated_at          = NOW()
        WHERE order_id = $2
        RETURNING order_id, status, delivery_partner_id, assigned_at
      `;
      const rows = await this.db.query(sql, [partnerId, orderId]);
      await this.broadcastOrderUpdate(orderId);

      return {
        status: true,
        data: rows?.[0] ?? null,
        message: `Delivery partner assigned to order ${orderId}`,
      };
    } catch (error) {
      this.developer.error('assignPartnerToOrder error', { error });
      throw new InternalServerErrorException('Failed to assign partner to order');
    }
  }

  async getMissedDeliveries(query: any) {
    try {
      const { days = 7, branch_id, page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params: any[] = [days];
      const where: string[] = [
        `o.scheduled_date >= CURRENT_DATE - ($1 || ' days')::interval`,
        `o.scheduled_date < CURRENT_DATE`,
        `o.status IN ('failed', 'pending', 'placed')`,
      ];

      if (branch_id) {
        params.push(branch_id);
        where.push(`o.branch_id = $${params.length}`);
      }

      const sql = `
        SELECT
          o.order_id,
          o.customer_id,
          o.customer_name,
          o.status,
          o.scheduled_date,
          o.total_amount,
          o.address_line,
          o.contact_number,
          o.delivery_partner_id,
          COALESCE(u.first_name || ' ' || u.last_name, u.user_name) AS partner_name
        FROM orders o
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = o.delivery_partner_id
        LEFT JOIN users u ON u.user_id = o.delivery_partner_id
        WHERE ${where.join(' AND ')}
        ORDER BY o.scheduled_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      return {
        status: true,
        data: rows,
        message: 'Missed deliveries fetched',
      };
    } catch (error) {
      this.developer.error('getMissedDeliveries error', { error });
      throw new InternalServerErrorException('Failed to retrieve missed deliveries');
    }
  }

  // ─── Leave Requests Admin Management ────────────────────────────────────────

  async recordPartnerLeave(dto: {
    delivery_partner_id: string;
    leave_date: string;
    end_date?: string;
    leave_type?: string;
    half_day_shift?: string;
    reason?: string;
  }, adminId: string) {
    try {
      const startDate = new Date(dto.leave_date);
      const endDate = dto.end_date ? new Date(dto.end_date) : startDate;
      if (endDate < startDate) {
        throw new BadRequestException('End date cannot be before start date');
      }

      const dbRes = await this.db.query(
        `SELECT dp.delivery_partner_id, COALESCE(u.first_name || ' ' || u.last_name, u.user_name, 'Delivery Partner') AS full_name
         FROM delivery_partners dp
         LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
         WHERE dp.delivery_partner_id = $1 OR dp.id::text = $1 LIMIT 1`,
        [dto.delivery_partner_id],
      );
      if (!dbRes || dbRes.length === 0) {
        throw new BadRequestException('Delivery boy not found');
      }
      const deliveryPartnerId = dbRes[0].delivery_partner_id;

      const leaveStartStr = dto.leave_date;
      const leaveEndStr = dto.end_date || dto.leave_date;

      // Check for overlapping pending/approved request
      const existing = await this.db.query(
        `SELECT id, leave_date, end_date FROM delivery_leave_requests
         WHERE delivery_partner_id = $1
           AND status IN ('pending', 'approved')
           AND NOT (end_date < $2::date OR leave_date > $3::date)
         LIMIT 1`,
        [deliveryPartnerId, leaveStartStr, leaveEndStr],
      );
      if (existing?.length) {
        throw new BadRequestException(`An overlapping leave request (from ${existing[0].leave_date} to ${existing[0].end_date}) already exists`);
      }

      // Insert leave request range
      const result = await this.db.query(
        `INSERT INTO delivery_leave_requests (delivery_partner_id, leave_date, end_date, leave_type, half_day_shift, reason, status, admin_remarks, notified_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, NOW(), NOW(), NOW()) RETURNING *`,
        [
          deliveryPartnerId,
          leaveStartStr,
          leaveEndStr,
          dto.leave_type || 'full_day',
          dto.half_day_shift || null,
          dto.reason || 'Recorded by admin',
          `Approved by admin: ${adminId}`,
        ],
      );
      const insertedRequests = [result[0]];

      await this.db.query(
        `UPDATE orders SET delivery_partner_id = NULL, delivery_run_id = NULL, assignment_method = NULL, updated_at = NOW()
         WHERE delivery_partner_id = $1 AND scheduled_date >= $2::date AND scheduled_date <= $3::date AND status NOT IN ('delivered', 'cancelled', 'failed')`,
        [deliveryPartnerId, dto.leave_date, dto.end_date || dto.leave_date],
      );

      const durationStr = (dto.end_date && dto.end_date !== dto.leave_date) ? `${dto.leave_date} to ${dto.end_date}` : dto.leave_date;
      await this.notifyPartner(deliveryPartnerId, '📅 Leave Approved by Admin', `Your leave for ${durationStr} has been marked as approved. Any assigned runs have been released.`);

      return { success: true, message: 'Leave recorded and approved successfully', data: insertedRequests };
    } catch (error) {
      this.developer.error('recordPartnerLeave error', { error });
      throw error;
    }
  }

  async getAdminLeaveRequests(query: any) {
    try {
      const { status, delivery_partner_id } = query;
      const params: any[] = [];
      const where: string[] = [];

      if (status) {
        params.push(status);
        where.push(`dlr.status = $${params.length}`);
      }
      if (delivery_partner_id) {
        params.push(delivery_partner_id);
        where.push(`dlr.delivery_partner_id = $${params.length}`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT
          dlr.*,
          COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.user_name, 'Delivery Partner') AS partner_name,
          u.phone AS partner_phone
        FROM delivery_leave_requests dlr
        LEFT JOIN delivery_partners dp ON dp.delivery_partner_id = dlr.delivery_partner_id
        LEFT JOIN users u ON u.user_id = dp.user_id
        ${whereClause}
        ORDER BY dlr.leave_date DESC, dlr.created_at DESC
      `;

      const rows = await this.db.query(sql, params);
      return { success: true, data: rows };
    } catch (error) {
      this.developer.error('getAdminLeaveRequests error', { error });
      throw new InternalServerErrorException('Failed to retrieve leave requests');
    }
  }

  async updateLeaveStatus(id: string, body: { status: string; admin_remarks?: string }, adminId: string) {
    try {
      const existing = await this.db.query(
        `SELECT * FROM delivery_leave_requests WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (!existing || existing.length === 0) {
        throw new BadRequestException('Leave request not found');
      }
      const request = existing[0];

      // Update leave request status
      const result = await this.db.query(
        `UPDATE delivery_leave_requests
         SET status = $1, admin_remarks = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [body.status, body.admin_remarks || `Updated by admin: ${adminId}`, id],
      );

      // If status is changed to approved, release orders during this leave period
      if (body.status === 'approved') {
        await this.db.query(
          `UPDATE orders
           SET delivery_partner_id = NULL,
               delivery_run_id = NULL,
               assignment_method = NULL,
               updated_at = NOW()
           WHERE delivery_partner_id = $1
             AND scheduled_date >= $2::date
             AND scheduled_date <= $3::date
             AND status NOT IN ('delivered', 'cancelled', 'failed')`,
          [request.delivery_partner_id, request.leave_date, request.end_date],
        );

        // Notify partner
        await this.notifyPartner(
          request.delivery_partner_id,
          '📅 Leave Approved',
          `Your leave request has been approved by the manager.`,
        );
      } else if (body.status === 'rejected') {
        await this.notifyPartner(
          request.delivery_partner_id,
          '❌ Leave Rejected',
          `Your leave request has been rejected. Remarks: ${body.admin_remarks || 'None'}`,
        );
      }

      return { success: true, message: `Leave request status updated to ${body.status}`, data: result[0] };
    } catch (error) {
      this.developer.error('updateLeaveStatus error', { error });
      throw error;
    }
  }

  async getPartnerPortfolio(id: string) {
    try {
      const partnerRows = await this.db.query(
        `SELECT dp.*,
                b.branch_name,
                COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.user_name, 'Delivery Partner') AS full_name,
                COALESCE(u.phone, '') AS phone,
                COALESCE(u.email, '') AS email,
                u.profile_image_url AS profile_image
         FROM delivery_partners dp
         LEFT JOIN branches b ON b.branch_id = dp.branch_id
         LEFT JOIN users u ON u.user_id = dp.user_id
         WHERE dp.delivery_partner_id = $1 OR dp.user_id = $1`,
        [id],
      );

      if (!partnerRows || partnerRows.length === 0) {
        throw new BadRequestException('Delivery partner not found');
      }

      const partner = partnerRows[0];
      const partnerId = partner.delivery_partner_id;

      const orders = await this.db.query(
        `SELECT o.order_id, o.customer_id, COALESCE(cu.first_name || ' ' || cu.last_name, cu.user_name) as customer_name, o.total_amount, o.status, o.delivery_slot, o.created_at, o.scheduled_date
         FROM orders o
         LEFT JOIN users cu ON cu.user_id = o.customer_id
         WHERE o.delivery_partner_id = $1 OR o.delivery_partner_id = $2
         ORDER BY o.created_at DESC
         LIMIT 20`,
        [partnerId, partner.user_id || partnerId],
      ).catch(() => []);

      const docs = await this.db.query(
        `SELECT * FROM delivery_partner_documents WHERE delivery_partner_id = $1 OR delivery_partner_id = $2`,
        [partnerId, partner.user_id || partnerId],
      ).catch(() => []);

      const banks = await this.db.query(
        `SELECT * FROM delivery_partner_bank_accounts WHERE delivery_partner_id = $1 OR delivery_partner_id = $2`,
        [partnerId, partner.user_id || partnerId],
      ).catch(() => []);

      const vehicles = await this.db.query(
        `SELECT * FROM delivery_partner_vehicles WHERE delivery_partner_id = $1 OR delivery_partner_id = $2`,
        [partnerId, partner.user_id || partnerId],
      ).catch(() => []);

      const completedOrders = (orders || []).filter((o: any) => o.status === 'delivered');
      const totalDelivered = completedOrders.length;
      const totalAssigned = (orders || []).length;

      return {
        status: true,
        data: {
          partner: {
            ...partner,
            full_name: partner.full_name || 'Delivery Partner',
            phone: partner.phone || 'N/A',
            email: partner.email || 'N/A',
            daily_salary: Number(partner.daily_salary || 0),
            average_rating: Number(partner.average_rating || 5.0),
            total_deliveries: Number(partner.total_deliveries || totalDelivered),
          },
          stats: {
            total_assigned: totalAssigned,
            total_delivered: totalDelivered,
            active_runs: Number(partner.total_runs || 0),
            daily_salary: Number(partner.daily_salary || 0),
            rating: Number(partner.average_rating || 5.0),
            is_active: partner.is_active || false,
            is_verified: partner.is_verified || false,
          },
          orders: orders || [],
          documents: docs || [],
          bank_accounts: banks || [],
          vehicles: vehicles || [],
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getPartnerPortfolio error', { error, id });
      throw new InternalServerErrorException('Failed to fetch delivery partner portfolio');
    }
  }
}
