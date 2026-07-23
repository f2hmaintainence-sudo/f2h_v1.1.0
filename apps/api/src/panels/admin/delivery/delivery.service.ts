import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { NotificationService } from 'src/notifications/notification.service';
import { PushNotificationService } from 'src/shared/pushNotifications/pushNotification.service';

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
  ) { }

  private async notifyPartner(partnerId: string, title: string, messageBody: string): Promise<void> {
    try {
      const boyRows = await this.db.query(
        `SELECT delivery_partner_id, user_id FROM delivery_partners WHERE delivery_partner_id = $1 OR user_id = $1 OR id::text = $1`,
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
          db.user_id,
          db.is_verified,
          db.full_name,
          db.phone,
          db.email,
          db.branch_id,
          b.branch_name,
          db.is_active,
          db.is_available,
          db.daily_salary,
          db.max_daily_orders,
          db.current_lat,
          db.current_lng,
          db.last_location_at,
          (
            SELECT COUNT(*)::int FROM orders o
            WHERE o.delivery_partner_id = db.delivery_partner_id
              AND o.scheduled_date = CURRENT_DATE
              AND o.status NOT IN ('cancelled', 'failed')
          ) AS today_assigned,
          (
            SELECT COUNT(*)::int FROM orders o
            WHERE o.delivery_partner_id = db.delivery_partner_id
              AND o.scheduled_date = CURRENT_DATE
              AND o.status = 'delivered'
          ) AS today_delivered,
          db.created_at
        FROM delivery_partners db
        LEFT JOIN branches b ON b.branch_id = db.branch_id
        ${whereClause}
        ORDER BY db.is_active DESC, db.full_name ASC
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
        RETURNING delivery_partner_id, full_name, is_active, is_available, branch_id, daily_salary
      `;

      const rows = await this.db.query(sql, params);

      if (!rows || rows.length === 0) {
        return { status: false, message: 'Delivery partner not found' };
      }

      // Dispatch Mobile Push & In-App notification to the partner
      if (body.is_active !== undefined) {
        const title = 'Account Status Updated';
        const msg = `Your account access status has been set to ${body.is_active ? 'Active' : 'Inactive'} by the Admin.`;
        await this.notifyPartner(partnerId, title, msg);
      } else if (body.branch_id !== undefined || body.daily_salary !== undefined) {
        const title = 'Profile Details Updated';
        const msg = `Your assigned branch or daily salary details have been updated by the Admin.`;
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
        WHERE db.delivery_partner_id = $1 OR db.user_id = $1 OR db.id::text = $1
      `;
      const boyRows = await this.db.query(boySql, [partnerId]);
      const partnerObj = boyRows[0] ?? null;

      const targetId = partnerObj?.delivery_partner_id || partnerObj?.user_id || partnerId;
      const userId = partnerObj?.user_id || targetId;
      const boyId = partnerObj?.delivery_partner_id || targetId;

      const docsSql = `
        SELECT *
        FROM user_documents
        WHERE delivery_partner_id = $1 OR delivery_partner_id = $2
        ORDER BY created_at DESC
      `;
      const docRows = await this.db.query(docsSql, [boyId, userId]);

      const vehiclesSql = `
        SELECT *
        FROM user_vehicles
        WHERE delivery_partner_id = $1 OR delivery_partner_id = $2
        ORDER BY created_at DESC
      `;
      const vehicleRows = await this.db.query(vehiclesSql, [boyId, userId]);

      const bankSql = `
        SELECT *
        FROM user_bank_accounts
        WHERE delivery_partner_id = $1 OR delivery_partner_id = $2
        ORDER BY created_at DESC
      `;
      const bankRows = await this.db.query(bankSql, [boyId, userId]);

      return {
        status: true,
        data: {
          partner: partnerObj,
          documents: docRows || [],
          vehicles: vehicleRows || [],
          bank_accounts: bankRows || [],
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
      if (body.document_id !== undefined && body.document_status) {
        await this.db.query(
          `UPDATE user_documents SET verification_status = $1, rejection_reason = $2, verified_at = NOW() WHERE id = $3`,
          [body.document_status, body.rejection_reason || null, body.document_id],
        );
        const title = `Identity Document ${body.document_status === 'verified' ? 'Approved ✅' : 'Rejected ❌'}`;
        const msg = body.document_status === 'verified'
          ? `Your uploaded identity document (ID: #${body.document_id}) has been successfully verified.`
          : `Your identity document (ID: #${body.document_id}) was rejected${body.rejection_reason ? `: ${body.rejection_reason}` : '. Please upload a valid document.'}`;
        await this.notifyPartner(partnerId, title, msg);
      }

      if (body.vehicle_id !== undefined && body.vehicle_status) {
        await this.db.query(
          `UPDATE user_vehicles SET verification_status = $1, verified_at = NOW() WHERE id = $2`,
          [body.vehicle_status, body.vehicle_id],
        );
        const title = `Vehicle Details ${body.vehicle_status === 'verified' ? 'Approved ✅' : 'Rejected ❌'}`;
        const msg = body.vehicle_status === 'verified'
          ? `Your uploaded vehicle details and documents have been verified.`
          : `Your uploaded vehicle documents were marked as rejected. Please check and upload valid documents.`;
        await this.notifyPartner(partnerId, title, msg);
      }

      if (body.bank_account_id !== undefined && body.bank_status) {
        await this.db.query(
          `UPDATE user_bank_accounts SET verification_status = $1, verified_at = NOW() WHERE id = $2`,
          [body.bank_status, body.bank_account_id],
        );
        const title = `Bank Account Details ${body.bank_status === 'verified' ? 'Approved ✅' : 'Rejected ❌'}`;
        const msg = body.bank_status === 'verified'
          ? `Your bank account and cheque details have been verified successfully.`
          : `Your bank account details were marked as not approved. Please verify account number and IFSC.`;
        await this.notifyPartner(partnerId, title, msg);
      }

      if (body.is_verified !== undefined) {
        const boySql = `
          UPDATE delivery_partners
          SET is_verified = $1, updated_at = NOW()
          WHERE delivery_partner_id = $2 OR user_id = $2 OR id::text = $2
          RETURNING delivery_partner_id, full_name, is_verified, is_active
        `;
        const rows = await this.db.query(boySql, [body.is_verified, partnerId]);

        if (body.is_verified === true) {
          const boyId = rows[0]?.delivery_partner_id || partnerId;
          const boyRows = await this.db.query(`SELECT user_id FROM delivery_partners WHERE delivery_partner_id = $1`, [boyId]);
          const userId = boyRows[0]?.user_id || boyId;

          await this.db.query(
            `UPDATE user_documents SET verification_status = 'verified', verified_at = NOW() WHERE (delivery_partner_id = $1 OR delivery_partner_id = $2) AND verification_status = 'pending'`,
            [boyId, userId],
          );
          await this.db.query(
            `UPDATE user_vehicles SET verification_status = 'verified', verified_at = NOW() WHERE (delivery_partner_id = $1 OR delivery_partner_id = $2) AND verification_status = 'pending'`,
            [boyId, userId],
          );
          await this.db.query(
            `UPDATE user_bank_accounts SET verification_status = 'verified', verified_at = NOW() WHERE (delivery_partner_id = $1 OR delivery_partner_id = $2) AND verification_status = 'pending'`,
            [boyId, userId],
          );
        }

        const title = body.is_verified ? 'KYC Fully Verified 🎉' : 'KYC Status Update ⚠️';
        const msg = body.is_verified
          ? 'Congratulations! Your profile and KYC verification have been approved. You are now ready for delivery runs!'
          : 'Your overall KYC verification status has been marked as pending/unverified by Admin. Please check your document proofs.';
        await this.notifyPartner(partnerId, title, msg);

        return {
          status: true,
          data: rows[0] ?? { delivery_partner_id: partnerId, is_verified: body.is_verified },
          message: `Delivery partner marked as ${body.is_verified ? 'Verified' : 'Not Verified'}`,
        };
      }

      return {
        status: true,
        message: 'Verification item updated successfully',
      };
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
          o.delivered_at,
          db.full_name AS partner_name,
          db.phone AS partner_phone
        FROM orders o
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = o.delivery_partner_id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE o.status
            WHEN 'pending' THEN 1
            WHEN 'placed' THEN 2
            WHEN 'confirmed' THEN 3
            WHEN 'packed' THEN 4
            WHEN 'out_for_delivery' THEN 5
            WHEN 'delivered' THEN 6
            WHEN 'cancelled' THEN 7
            WHEN 'failed' THEN 8
          END ASC,
          o.created_at ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(parseInt(limit, 10), offset);

      const rows = await this.db.query(sql, params);

      return {
        status: true,
        data: rows,
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

  async updateDeliveryStatus(orderId: string, status: string, notes?: string) {
    try {
      const validStatuses = ['confirmed', 'packed', 'out_for_delivery', 'delivered', 'failed'];
      if (!validStatuses.includes(status)) {
        return { status: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` };
      }

      const updateFields: string[] = [
        `status = $2`,
        `updated_at = NOW()`,
      ];
      const params: any[] = [orderId, status];

      if (status === 'delivered') {
        updateFields.push(`delivered_at = NOW()`);
      }

      const sql = `
        UPDATE orders
        SET ${updateFields.join(', ')}
        WHERE order_id = $1
        RETURNING order_id, status
      `;

      const rows = await this.db.query(sql, params);

      return {
        status: true,
        data: rows[0] ?? null,
        message: `Order ${orderId} status updated to ${status}`,
      };
    } catch (error) {
      this.developer.error('updateDeliveryStatus error', { error });
      throw new InternalServerErrorException('Failed to update delivery status');
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
          db.full_name AS partner_name
        FROM orders o
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = o.delivery_partner_id
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
        `SELECT delivery_partner_id, full_name, user_id FROM delivery_partners 
         WHERE delivery_partner_id = $1 OR user_id = $1 OR id::text = $1 LIMIT 1`,
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
        where.push(`(dlr.delivery_partner_id = $${params.length} OR db.id::text = $${params.length})`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const sql = `
        SELECT
          dlr.*,
          db.full_name AS partner_name,
          db.phone AS partner_phone
        FROM delivery_leave_requests dlr
        LEFT JOIN delivery_partners db ON db.delivery_partner_id = dlr.delivery_partner_id
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
}
