import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { NotificationService } from 'src/notifications/notification.service';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import {
  UpdatePersonalDto,
  CreateDocumentDto,
  UpdateDocumentDto,
  CreateVehicleDto,
  UpdateVehicleDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
  UpdatePreferencesDto,
  ChangePasswordDto,
  CreateLeaveRequestDto,
} from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly Data: DataService,
    private readonly db: DatabaseService,
    private readonly developerService: DeveloperService,
    private readonly notificationService: NotificationService,
  ) { }

  // ─── Personal Info ──────────────────────────────────────────────────────────

  async getPersonalInfo(deliveryPartnerId: string) {
    try {
      // JOIN delivery_partners + users to get combined personal info
      const result = await this.db.query(
        `SELECT
          dp.*,
          u.email,
          u.phone,
          u.first_name,
          u.last_name,
          u.first_name || ' ' || u.last_name AS full_name,
          u.referral_code,
          u.profile_image_url,
          u.last_login_at,
          u.account_status,
          b.branch_name
        FROM delivery_partners dp
        LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = dp.branch_id
        WHERE dp.delivery_partner_id = $1
        LIMIT 1`,
        [deliveryPartnerId],
      );

      if (!result?.length) {
        throw new NotFoundException('Delivery partner profile not found');
      }

      const profile = result[0];
      const partnerUserId = profile.user_id || deliveryPartnerId;

      // Query referral earnings & count for delivery partner (75 rupees per referral)
      let referralEarnings = 0;
      let referralCount = 0;
      try {
        const refRes = await this.db.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN referrer_reward_amount > 0 THEN referrer_reward_amount ELSE 75.00 END), 0)::numeric AS referral_earnings,
             COUNT(*)::int AS referral_count
           FROM referrals
           WHERE referrer_customer_id = $1
             AND LOWER(status) IN ('rewarded', 'completed', 'active', 'success', 'credited')`,
          [deliveryPartnerId],
        );
        referralEarnings = parseFloat(refRes?.[0]?.referral_earnings || '0');
        referralCount = parseInt(refRes?.[0]?.referral_count || '0', 10);
      } catch (err) {
        this.developerService.error('[Profile] Failed to query referral stats', { error: err });
      }

      let referralCode = profile.referral_code;
      if (!referralCode || !referralCode.trim()) {
        // Fallback: generate referral code from user name + phone
        const cleanName = (profile.first_name || profile.last_name || 'DP').replace(/[^a-zA-Z]/g, '').toUpperCase();
        const prefix = cleanName.length >= 3 ? cleanName.slice(0, 3) : 'DP';
        const cleanPhone = (profile.phone || '').replace(/\D/g, '');
        const phoneSuffix = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '7500';
        referralCode = `F2HDR-${prefix}${phoneSuffix}`;
      }

      let branchName = profile.branch_name;
      if (!branchName && profile.branch_id) {
        try {
          const [branchMatch] = await this.db.query(
            `SELECT branch_name FROM branches WHERE branch_id = $1 OR id::text = $1 LIMIT 1`,
            [profile.branch_id],
          );
          if (branchMatch?.branch_name) {
            branchName = branchMatch.branch_name;
          }
        } catch {
          // Deliberately tolerated: the caller has a valid fallback for this failure.
        }
      }

      return {
        ...profile,
        branch_name: branchName || profile.branch_name || null,
        referral_code: referralCode,
        referral_earnings: referralEarnings,
        referral_count: referralCount,
        reward_per_referral: 75.00,
      };
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching personal info for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async updatePersonalInfo(deliveryPartnerId: string, dto: UpdatePersonalDto) {
    try {
      // Update delivery_partners table — only valid columns (no full_name, phone, email)
      const deliveryPartnerUpdates: Record<string, any> = {};
      if (dto.emergency_contact !== undefined) deliveryPartnerUpdates.emergency_contact = dto.emergency_contact;
      if (dto.emergency_contact_number !== undefined) deliveryPartnerUpdates.emergency_contact_number = dto.emergency_contact_number;
      if (dto.date_of_birth !== undefined) deliveryPartnerUpdates.date_of_birth = dto.date_of_birth;
      if (dto.gender !== undefined) deliveryPartnerUpdates.gender = dto.gender;
      if (dto.residential_address !== undefined) deliveryPartnerUpdates.residential_address = dto.residential_address;
      deliveryPartnerUpdates.updated_at = new Date();

      // Update users table for shared identity fields (first_name, last_name, email)
      const userUpdates: Record<string, any> = {};
      if (dto.full_name !== undefined) {
        const parts = dto.full_name.trim().split(/\s+/);
        userUpdates.first_name = parts[0] || '';
        userUpdates.last_name = parts.slice(1).join(' ') || '';
        userUpdates.user_name = dto.full_name.trim();
      }
      if ((dto as any).first_name !== undefined) userUpdates.first_name = (dto as any).first_name;
      if ((dto as any).last_name !== undefined) userUpdates.last_name = (dto as any).last_name;
      if (dto.email !== undefined) userUpdates.email = dto.email;
      userUpdates.updated_at = new Date();

      // Update both tables
      if (Object.keys(deliveryPartnerUpdates).length > 1) {
        await this.Data.update('delivery_partners', deliveryPartnerUpdates, [
          { column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId },
        ]);
      }

      if (Object.keys(userUpdates).length > 1) {
        await this.Data.update('users', userUpdates, [
          { column: 'user_id', operator: '=', value: deliveryPartnerId },
        ]);
      }

      return { success: true, message: 'Personal information updated successfully' };
    } catch (error) {
      this.developerService.error(`[Profile] Error updating personal info for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async uploadProfilePhoto(deliveryPartnerId: string, file: any): Promise<{ success: boolean; url: string }> {
    try {
      if (!file) throw new BadRequestException('No file provided');

      const docDir = path.join(process.cwd(), 'uploads', 'profile-photos');
      if (!fs.existsSync(docDir)) {
        fs.mkdirSync(docDir, { recursive: true });
      }

      const ext = path.extname(file.originalname || 'photo.jpg') || '.jpg';
      const filename = `${deliveryPartnerId}_profile_${Date.now()}${ext}`;
      const filePath = path.join(docDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      const fileUrl = `uploads/profile-photos/${filename}`;

      // Update delivery_partners.profile_photo_url
      await this.Data.update(
        'delivery_partners',
        { profile_photo_url: fileUrl, updated_at: new Date() },
        [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
      );
      // Update users.profile_image_url for unified identity
      await this.Data.update(
        'users',
        { profile_image_url: fileUrl, updated_at: new Date() },
        [{ column: 'user_id', operator: '=', value: deliveryPartnerId }],
      );

      return { success: true, url: fileUrl };
    } catch (error) {
      this.developerService.error(`[Profile] Error uploading profile photo for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  // ─── Documents ──────────────────────────────────────────────────────────────

  // ─── Documents ──────────────────────────────────────────────────────────────

  async getDocuments(deliveryPartnerId: string) {
    try {
      const res = await this.Data.query('delivery_partners', {
        where: [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
        limit: 1,
      });
      const partner = res?.data?.[0];
      const docs: any[] = [];
      if (partner?.aadhaar_url) docs.push({ id: 1, document_type: 'aadhaar', document_url: partner.aadhaar_url, verification_status: partner.is_verified ? 'verified' : 'pending' });
      if (partner?.id_proof_url) docs.push({ id: 2, document_type: 'id_proof', document_url: partner.id_proof_url, verification_status: partner.is_verified ? 'verified' : 'pending' });
      if (partner?.profile_photo_url) docs.push({ id: 3, document_type: 'profile_photo', document_url: partner.profile_photo_url, verification_status: partner.is_verified ? 'verified' : 'pending' });
      return docs;
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching documents for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async createDocument(deliveryPartnerId: string, dto: CreateDocumentDto, files?: { front_image?: any; back_image?: any }) {
    try {
      const updates: Record<string, any> = { updated_at: new Date() };
      if (files?.front_image) {
        updates.aadhaar_url = await this.saveDocumentFile(deliveryPartnerId, 'front', files.front_image);
      }
      if (files?.back_image) {
        updates.id_proof_url = await this.saveDocumentFile(deliveryPartnerId, 'back', files.back_image);
      }
      await this.Data.update('delivery_partners', updates, [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }]);
      return { success: true, message: 'Document added successfully. Pending admin verification.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error creating document for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async updateDocument(deliveryPartnerId: string, docId: string, dto: UpdateDocumentDto, files?: { front_image?: any; back_image?: any }) {
    return this.createDocument(deliveryPartnerId, dto as any, files);
  }

  async deleteDocument(deliveryPartnerId: string, docId: string) {
    return { success: true, message: 'Document deleted' };
  }

  // ─── Vehicles ───────────────────────────────────────────────────────────────

  async getVehicles(deliveryPartnerId: string) {
    try {
      const res = await this.Data.query('delivery_partners', {
        where: [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
        limit: 1,
      });
      const partner = res?.data?.[0];
      if (!partner?.vehicle_type) return [];
      return [{
        id: 1,
        vehicle_type: partner.vehicle_type,
        registration_number: partner.vehicle_number,
        is_primary: true,
        verification_status: partner.is_verified ? 'verified' : 'pending',
      }];
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching vehicles for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async createVehicle(deliveryPartnerId: string, dto: CreateVehicleDto, files?: { rc_front_image?: any; rc_back_image?: any; insurance_image?: any }) {
    try {
      await this.Data.update('delivery_partners', {
        vehicle_type: dto.vehicle_type,
        vehicle_number: dto.registration_number,
        updated_at: new Date(),
      }, [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }]);
      return { success: true, message: 'Vehicle details updated successfully.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error creating vehicle for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async updateVehicle(deliveryPartnerId: string, vehicleId: string, dto: UpdateVehicleDto, files?: { rc_front_image?: any; rc_back_image?: any; insurance_image?: any }) {
    return this.createVehicle(deliveryPartnerId, dto as any, files);
  }

  async deleteVehicle(deliveryPartnerId: string, vehicleId: string) {
    return { success: true, message: 'Vehicle removed' };
  }

  // ─── Bank Accounts ─────────────────────────────────────────────────────────

  async getBankAccounts(deliveryPartnerId: string) {
    try {
      const res = await this.Data.query('delivery_partners', {
        where: [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
        limit: 1,
      });
      const partner = res?.data?.[0];
      if (!partner?.bank_account_number) return [];
      return [{
        id: 1,
        account_holder_name: partner.account_holder_name,
        bank_name: partner.bank_name,
        account_number: partner.bank_account_number,
        ifsc_code: partner.bank_ifsc,
        is_primary: true,
        verification_status: partner.is_verified ? 'verified' : 'pending',
      }];
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching bank accounts for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async createBankAccount(deliveryPartnerId: string, dto: CreateBankAccountDto, file?: any) {
    try {
      await this.Data.update('delivery_partners', {
        bank_account_number: dto.account_number,
        bank_ifsc: dto.ifsc_code,
        bank_name: dto.bank_name,
        account_holder_name: dto.account_holder_name,
        updated_at: new Date(),
      }, [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }]);
      return { success: true, message: 'Bank account updated successfully.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error creating bank account for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async updateBankAccount(deliveryPartnerId: string, bankId: string, dto: UpdateBankAccountDto, file?: any) {
    return this.createBankAccount(deliveryPartnerId, dto as any, file);
  }

  async deleteBankAccount(deliveryPartnerId: string, bankId: string) {
    return { success: true, message: 'Bank account removed' };
  }

  // ─── Preferences ────────────────────────────────────────────────────────────

  async getPreferences(deliveryPartnerId: string) {
    try {
      const result = await this.Data.query('users', {
        where: [{ column: 'user_id', operator: '=', value: deliveryPartnerId }],
        select: ['settings'],
        limit: 1,
      });

      const settings = result?.data?.[0]?.settings;
      let parsed: Record<string, any> = {};
      if (settings) {
        try { parsed = typeof settings === 'string' ? JSON.parse(settings) : settings; } catch { /* ignore */ }
      }

      return {
        push_notifications: parsed.push_notifications ?? true,
        email_notifications: parsed.email_notifications ?? true,
        sms_notifications: parsed.sms_notifications ?? true,
        promotional_notifications: parsed.promotional_notifications ?? false,
        language_preference: parsed.language_preference ?? 'en',
      };
    } catch (error) {
      this.developerService.error(`[Profile] Error getting preferences for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async updatePreferences(deliveryPartnerId: string, dto: UpdatePreferencesDto) {
    try {
      // Get existing settings
      const result = await this.Data.query('users', {
        where: [{ column: 'user_id', operator: '=', value: deliveryPartnerId }],
        select: ['settings'],
        limit: 1,
      });

      let existing: Record<string, any> = {};
      const settings = result?.data?.[0]?.settings;
      if (settings) {
        try { existing = typeof settings === 'string' ? JSON.parse(settings) : settings; } catch { /* ignore */ }
      }

      // Merge preferences
      const merged = { ...existing };
      if (dto.push_notifications !== undefined) merged.push_notifications = dto.push_notifications;
      if (dto.email_notifications !== undefined) merged.email_notifications = dto.email_notifications;
      if (dto.sms_notifications !== undefined) merged.sms_notifications = dto.sms_notifications;
      if (dto.promotional_notifications !== undefined) merged.promotional_notifications = dto.promotional_notifications;
      if (dto.language_preference !== undefined) merged.language_preference = dto.language_preference;

      await this.Data.update('users', {
        settings: JSON.stringify(merged),
        updated_at: new Date(),
      }, [{ column: 'user_id', operator: '=', value: deliveryPartnerId }]);

      return { success: true, message: 'Preferences updated', preferences: merged };
    } catch (error) {
      this.developerService.error(`[Profile] Error updating preferences for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  // ─── Activity ───────────────────────────────────────────────────────────────

  async getActivity(deliveryPartnerId: string) {
    try {
      const result = await this.db.query(
        `SELECT
          ud.last_used AS last_active,
          ud.device_name
        FROM users u
        LEFT JOIN user_devices ud ON ud.user_id = u.user_id AND ud.is_active = 1
        WHERE u.user_id = $1
        LIMIT 1`,
        [deliveryPartnerId],
      );

      const row = result?.[0];
      return {
        last_login: row?.last_login_at || null,
        last_active: row?.last_active || row?.device_last_active || null,
        device_name: row?.device_name || 'Unknown',
        app_version: row?.app_version || '2.5.0',
        os: row?.os || 'Android',
      };
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching activity details for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  // ─── Security ───────────────────────────────────────────────────────────────

  async changePassword(deliveryPartnerId: string, dto: ChangePasswordDto) {
    try {
      if (dto.new_password !== dto.confirm_password) {
        throw new BadRequestException('New password and confirm password do not match');
      }
      if (dto.new_password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }

      // Get current password hash
      const userResult = await this.Data.query('users', {
        where: [{ column: 'user_id', operator: '=', value: deliveryPartnerId }],
        select: ['password'],
        limit: 1,
      });
      const user = userResult?.data?.[0];
      if (!user) throw new NotFoundException('User not found');

      // Verify current password
      const isMatch = await bcrypt.compare(dto.current_password, user.password);
      if (!isMatch) throw new BadRequestException('Current password is incorrect');

      // Hash new password
      const hashedPassword = await bcrypt.hash(dto.new_password, 12);

      await this.Data.update('users', {
        password: hashedPassword,
        password_changed_at: new Date(),
        updated_at: new Date(),
      }, [{ column: 'user_id', operator: '=', value: deliveryPartnerId }]);

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      this.developerService.error(`[Profile] Error changing password for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async logoutAllDevices(deliveryPartnerId: string) {
    try {
      // Deactivate all device sessions in DB
      try {
        await this.db.query(
          `UPDATE device_sessions SET revoked_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [deliveryPartnerId],
        );
      } catch { /* device_sessions may be empty */ }

      // Deactivate user_devices
      try {
        await this.db.query(
          'UPDATE user_devices SET is_current = false WHERE user_id = $1',
          [deliveryPartnerId],
        );
      } catch { /* user_devices may not exist */ }

      return { success: true, message: 'Logged out from all devices' };
    } catch (error) {
      this.developerService.error(`[Profile] Error logging out all devices for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  // ─── Attendance & Leaderboard (from delivery_runs) ─────────────────────────

  async getAttendance(deliveryPartnerId: string, year: number, month: number) {
    try {
      const result = await this.db.query(
        `SELECT
           EXTRACT(DAY FROM run_date)::int AS day,
           status
         FROM delivery_runs
         WHERE delivery_partner_id = $1
           AND EXTRACT(YEAR FROM run_date) = $2
           AND EXTRACT(MONTH FROM run_date) = $3
         ORDER BY run_date`,
        [deliveryPartnerId, year, month],
      );

      const daysInMonth = new Date(year, month, 0).getDate();

      // Build per-day attendance map (a day can have multiple runs, pick best status)
      const dayMap: Record<number, string> = {};
      for (const row of (result || [])) {
        const day = row.day;
        const status = row.status;
        // Priority: completed > in_progress > partial > assigned > planned > cancelled
        const priority = { completed: 6, in_progress: 5, partial: 4, assigned: 3, planned: 2, cancelled: 1 };
        const existing = dayMap[day];
        if (!existing || (priority[status] || 0) > (priority[existing] || 0)) {
          dayMap[day] = status;
        }
      }

      const attendance: { day: number; status: string; run_status: string | null }[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const status = dayMap[d] || null;
        let attendanceStatus: string;
        if (!status) {
          attendanceStatus = 'off';
        } else if (status === 'completed' || status === 'in_progress') {
          attendanceStatus = 'present';
        } else if (status === 'cancelled') {
          attendanceStatus = 'absent';
        } else {
          attendanceStatus = 'partial'; // partial, assigned, planned
        }
        attendance.push({ day: d, status: attendanceStatus, run_status: status });
      }

      // Summary counts
      const present = attendance.filter(a => a.status === 'present').length;
      const absent = attendance.filter(a => a.status === 'absent').length;
      const partial = attendance.filter(a => a.status === 'partial').length;

      return {
        year,
        month,
        days_in_month: daysInMonth,
        summary: { present, absent, partial },
        attendance,
      };
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching attendance for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async getLeaderboard(deliveryPartnerId: string, year: number, month: number) {
    try {
      // Aggregate all delivery boys for the given month
      const result = await this.db.query(
        `SELECT
           dr.delivery_partner_id,
           -- Was \`db.full_name\`: no such alias exists, so every request to
           -- this endpoint failed with "missing FROM-clause entry for table db".
           dp.full_name,
           -- Selected because the mapper below falls back to them when a
           -- partner row has no full_name; they were referenced but never read.
           u.first_name,
           u.last_name,
           COUNT(DISTINCT dr.run_date) AS active_days,
           SUM(dr.completed_addresses) AS total_completed,
           SUM(dr.total_addresses) AS total_assigned,
           ROUND(
             CASE WHEN SUM(dr.total_addresses) > 0
               THEN SUM(dr.completed_addresses)::numeric / SUM(dr.total_addresses) * 100
               ELSE 0
             END, 1
           ) AS delivery_rate
         FROM delivery_runs dr
         JOIN delivery_partners dp ON dp.delivery_partner_id = dr.delivery_partner_id
         LEFT JOIN users u ON u.user_id = dr.delivery_partner_id
         WHERE EXTRACT(YEAR FROM dr.run_date) = $1
           AND EXTRACT(MONTH FROM dr.run_date) = $2
           AND dr.status NOT IN ('cancelled')
         GROUP BY dr.delivery_partner_id, dp.full_name, u.first_name, u.last_name
         ORDER BY total_completed DESC, delivery_rate DESC`,
        [year, month],
      );

      const riders = result || [];
      const totalRiders = riders.length;

      // Find current user's rank
      let rank = 0;
      let myStats: any = null;
      for (let i = 0; i < riders.length; i++) {
        if (riders[i].delivery_partner_id === deliveryPartnerId) {
          rank = i + 1;
          myStats = riders[i];
          break;
        }
      }

      // Top 10 riders
      const topRiders = riders.slice(0, 10).map((r, i) => ({
        rank: i + 1,
        delivery_partner_id: r.delivery_partner_id,
        full_name: r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Rider',
        active_days: parseInt(r.active_days) || 0,
        total_completed: parseInt(r.total_completed) || 0,
        total_assigned: parseInt(r.total_assigned) || 0,
        delivery_rate: parseFloat(r.delivery_rate) || 0,
        is_me: r.delivery_partner_id === deliveryPartnerId,
      }));

      return {
        year,
        month,
        rank: rank || null,
        total_riders: totalRiders,
        my_stats: myStats ? {
          active_days: parseInt(myStats.active_days) || 0,
          total_completed: parseInt(myStats.total_completed) || 0,
          total_assigned: parseInt(myStats.total_assigned) || 0,
          delivery_rate: parseFloat(myStats.delivery_rate) || 0,
        } : null,
        top_riders: topRiders,
      };
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching leaderboard for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async getAttendanceDayDetails(deliveryPartnerId: string, dateStr: string) {
    try {
      const statsResult = await this.db.query(
        `SELECT
           COUNT(*) as assigned,
           COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered,
           COUNT(CASE WHEN o.status = 'failed' THEN 1 END) as failed,
           COUNT(CASE WHEN o.status NOT IN ('delivered', 'failed', 'cancelled') THEN 1 END) as not_delivered,
           COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled
         FROM orders o
         WHERE o.delivery_partner_id = $1
           AND DATE(o.scheduled_date AT TIME ZONE 'Asia/Kolkata') = $2::date`,
        [deliveryPartnerId, dateStr],
      );

      const summary = statsResult[0] || { assigned: 0, delivered: 0, failed: 0, not_delivered: 0, cancelled: 0 };

      const stats = {
        assigned: parseInt(summary.assigned || '0', 10),
        delivered: parseInt(summary.delivered || '0', 10),
        failed: parseInt(summary.failed || '0', 10),
        not_delivered: parseInt(summary.not_delivered || '0', 10),
        cancelled: parseInt(summary.cancelled || '0', 10),
      };

      const logsResult = await this.db.query(
        `SELECT
           o.order_id,
           o.status as order_status,
           o.payment_mode,
           o.payment_status,
           o.total_amount,
           o.delivery_slot as slot,
           cu.first_name || ' ' || cu.last_name AS customer_name,
           cu.phone AS customer_phone,
           COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address,
           o.status AS log_status,
           -- Per-order container collection is no longer recorded; the
           -- reconciliation table tracks it per run, not per order.
           0 AS bottles_collected,
           CASE WHEN o.payment_mode = 'cod' AND o.payment_status = 'paid' THEN o.total_amount ELSE 0 END AS cash_collected,
           COALESCE(o.special_instructions, '') AS remarks,
           o.delivery_image AS proof_photo_url,
           CASE WHEN o.status = 'delivered' THEN o.updated_at ELSE NULL END AS delivery_time,
           (
             SELECT json_agg(json_build_object(
               'product_name', pv.name,
               'quantity', oi.quantity,
               'final_price', oi.final_price,
               'unit_value', pv.unit_value,
               'unit_type', pv.unit_type
             ))
             FROM order_items oi
             JOIN product_variants pv ON pv.variant_id = oi.variant_id
             WHERE oi.order_id = o.order_id
           ) as items
         FROM orders o
         JOIN users cu ON cu.user_id = o.customer_id
         LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
         WHERE o.delivery_partner_id = $1
           AND DATE(o.scheduled_date AT TIME ZONE 'Asia/Kolkata') = $2::date
         ORDER BY o.run_sequence ASC NULLS LAST, o.created_at ASC`,
        [deliveryPartnerId, dateStr],
      );

      return {
        success: true,
        date: dateStr,
        summary: stats,
        logs: logsResult || [],
      };
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching day details for deliveryPartnerId: ${deliveryPartnerId} on date: ${dateStr}`, { error });
      throw error;
    }
  }

  // ─── Leave Requests ─────────────────────────────────────────────────────────

  async createLeaveRequest(deliveryPartnerId: string, dto: CreateLeaveRequestDto) {
    this.developerService.error('[LeaveRequest] createLeaveRequest payload received:', { dto, deliveryPartnerId });
    try {
      // Validate leave dates are in the future
      const startDate = new Date(dto.leave_date);
      const endDate = dto.end_date ? new Date(dto.end_date) : startDate;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate <= today) {
        throw new BadRequestException('Leave date must be a future date');
      }
      if (endDate < startDate) {
        throw new BadRequestException('End date cannot be before start date');
      }

      // Get delivery partner name from users table (full_name not in delivery_partners)
      const dpResult = await this.db.query(
        `SELECT u.first_name || ' ' || u.last_name AS full_name
         FROM users u WHERE u.user_id = $1 LIMIT 1`,
        [deliveryPartnerId],
      );
      const dpName = dpResult?.[0]?.full_name || 'A delivery partner';

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
        `INSERT INTO delivery_leave_requests
           (delivery_partner_id, leave_date, end_date, leave_type, half_day_shift, reason, status, notified_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW(), NOW())
         RETURNING *`,
        [
          deliveryPartnerId,
          leaveStartStr,
          leaveEndStr,
          dto.leave_type || 'full_day',
          dto.half_day_shift || null,
          dto.reason || null,
        ],
      );
      const leaveRequest = result[0];

      // Notify all admin users (role = 'admin')
      try {
        const admins = await this.db.query(
          `SELECT u.user_id FROM users u
           JOIN role_assignments ra ON ra.user_id = u.user_id
           WHERE UPPER(ra.role_id) = 'ADMIN'
             AND u.account_status = 'active'`,
          [],
        );
        const adminIds: string[] = (admins || []).map((a: any) => a.user_id);
        if (adminIds.length > 0) {
          const durationStr = dto.end_date && dto.end_date !== dto.leave_date
            ? `${dto.leave_date} to ${dto.end_date}`
            : dto.leave_date;
          const shiftStr = dto.leave_type === 'half_day' && dto.half_day_shift
            ? `half day (${dto.half_day_shift})`
            : dto.leave_type || 'full day';

          await this.notificationService.sendNotification({
            title: `📅 Leave Request — ${dpName}`,
            message: `${dpName} has requested ${shiftStr} leave on ${durationStr}${dto.reason ? ` — Reason: ${dto.reason}` : ''}.`,
            type: 'info',
            priority: 'medium',
            recipientIds: adminIds,
            senderId: deliveryPartnerId,
          });
        }
      } catch (notifErr) {
        // Notification failure should not block the request submission
        this.developerService.error('[LeaveRequest] Failed to send admin notification', { notifErr });
      }

      return { success: true, message: 'Leave request submitted successfully', data: leaveRequest };
    } catch (error) {
      this.developerService.error(`[LeaveRequest] Error creating leave request for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async getLeaveRequests(deliveryPartnerId: string) {
    try {
      const result = await this.db.query(
        `SELECT * FROM delivery_leave_requests
         WHERE delivery_partner_id = $1
         ORDER BY leave_date DESC, created_at DESC`,
        [deliveryPartnerId],
      );
      return result || [];
    } catch (error) {
      this.developerService.error(`[LeaveRequest] Error fetching leave requests for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async cancelLeaveRequest(deliveryPartnerId: string, id: string) {
    try {
      const existing = await this.db.query(
        `SELECT id, status FROM delivery_leave_requests
         WHERE id = $1 AND delivery_partner_id = $2 LIMIT 1`,
        [id, deliveryPartnerId],
      );
      if (!existing?.length) {
        throw new NotFoundException('Leave request not found');
      }
      if (existing[0].status !== 'pending') {
        throw new BadRequestException(`Cannot cancel a leave request that is already '${existing[0].status}'`);
      }
      await this.db.query(
        `UPDATE delivery_leave_requests
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1`,
        [id],
      );
      return { success: true, message: 'Leave request cancelled successfully' };
    } catch (error) {
      this.developerService.error(`[LeaveRequest] Error cancelling leave request id: ${id}`, { error });
      throw error;
    }
  }

  // ─── File Upload Helper ─────────────────────────────────────────────────────

  private async saveDocumentFile(deliveryPartnerId: string, prefix: string, file: any): Promise<string> {
    const docDir = path.join(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }

    const ext = path.extname(file.originalname || 'doc.jpg') || '.jpg';
    const filename = `${deliveryPartnerId}_${prefix}_${Date.now()}${ext}`;
    const filePath = path.join(docDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return `uploads/documents/${filename}`;
  }

  /**
   * Delivery Partner Referral Dashboard.
   * Returns referral code, ₹75 reward rate, stats, referred partners list, and physical offline payment history.
   */
  async getDeliveryPartnerReferrals(deliveryPartnerId: string) {
    try {
      const [partnerUser] = await this.db.query(
        `SELECT u.user_id, u.first_name, u.last_name, u.phone, u.referral_code, dp.delivery_partner_id
         FROM delivery_partners dp
         LEFT JOIN users u ON u.user_id = dp.delivery_partner_id
         WHERE dp.delivery_partner_id = $1 OR dp.user_id = $1
         LIMIT 1`,
        [deliveryPartnerId],
      );

      if (!partnerUser) {
        throw new NotFoundException('Delivery partner not found');
      }

      let referralCode = partnerUser.referral_code;
      if (!referralCode || !referralCode.trim()) {
        const cleanName = (partnerUser.first_name || partnerUser.last_name || 'DP').replace(/[^a-zA-Z]/g, '').toUpperCase();
        const prefix = cleanName.length >= 3 ? cleanName.slice(0, 3) : 'DP';
        const cleanPhone = (partnerUser.phone || '').replace(/\D/g, '');
        const phoneSuffix = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '7500';
        referralCode = `F2HDR-${prefix}${phoneSuffix}`;
      }

      // Fetch all referral records
      const referrals = await this.db.query(
        `SELECT r.id, r.refer_id, r.referred_customer_id, r.status, r.created_at, r.rewarded_at,
                COALESCE(u.first_name || ' ' || COALESCE(u.last_name, ''), u.user_name, 'Referee') AS referee_name,
                u.phone AS referee_phone,
                dpb.status AS bonus_status,
                dpb.paid_at,
                dpb.payment_reference,
                dpb.remarks AS payment_remarks,
                COALESCE(dpb.paid_amount, dpb.amount, 75.00)::numeric AS bonus_amount
         FROM referrals r
         LEFT JOIN users u ON u.user_id = r.referred_customer_id
         LEFT JOIN delivery_partner_referral_bonuses dpb ON (dpb.refer_id = r.refer_id OR dpb.partner_id = $1)
         WHERE r.referrer_customer_id = $1 OR r.referrer_customer_id = $2
         ORDER BY r.created_at DESC`,
        [deliveryPartnerId, partnerUser.user_id || deliveryPartnerId],
      ).catch(() => []);

      // Fetch all bonus records directly
      const bonuses = await this.db.query(
        `SELECT dpb.*,
                COALESCE(dpb.paid_amount, dpb.amount, 75.00)::numeric AS paid_amount
         FROM delivery_partner_referral_bonuses dpb
         WHERE dpb.partner_id = $1 OR dpb.partner_id = $2
         ORDER BY dpb.created_at DESC`,
        [deliveryPartnerId, partnerUser.user_id || deliveryPartnerId],
      ).catch(() => []);

      const totalReferrals = Math.max(referrals.length, bonuses.length);
      const eligibleBonuses = bonuses.filter((b: any) => b.status === 'paid' || b.status === 'pending');
      const paidBonuses = bonuses.filter((b: any) => b.status === 'paid');
      const pendingBonuses = bonuses.filter((b: any) => b.status === 'pending');

      const eligibleCount = eligibleBonuses.length;
      const paidCount = paidBonuses.length;
      const pendingCount = Math.max(0, totalReferrals - eligibleCount);

      const totalEarned = eligibleCount * 75.00;
      const totalPaid = paidBonuses.reduce((acc: number, b: any) => acc + Number(b.paid_amount || b.amount || 75.00), 0);
      const outstandingAmount = pendingBonuses.reduce((acc: number, b: any) => acc + Number(b.amount || 75.00), 0);

      const paymentsHistory = paidBonuses.map((b: any) => ({
        id: b.id,
        bonus_id: b.bonus_id,
        amount: Number(b.paid_amount || b.amount || 75.00),
        paid_at: b.paid_at,
        payment_reference: b.payment_reference || 'Physical / Cash',
        remarks: b.remarks || 'Monthly offline referral payout',
        referee_name: b.referee_name || 'Delivery Partner / Customer',
      }));

      return {
        status: true,
        data: {
          referral_code: referralCode,
          reward_per_referral: 75.00,
          stats: {
            total_referrals: totalReferrals,
            eligible_referrals: eligibleCount,
            pending_referrals: pendingCount,
            total_earned: totalEarned,
            total_paid: totalPaid,
            outstanding_amount: outstandingAmount,
            reward_per_referral: 75.00,
          },
          referrals: (bonuses.length > 0 ? bonuses : referrals).map((r: any) => {
            const isEligible = r.status === 'rewarded' || r.status === 'completed' || r.status === 'paid' || r.status === 'pending' || r.bonus_id;
            const isPaid = r.status === 'paid' || r.bonus_status === 'paid';
            return {
              id: r.id,
              refer_id: r.refer_id || r.bonus_id,
              referee_name: r.referee_name || 'Partner Referee',
              referee_phone: r.referee_phone ? `${r.referee_phone.slice(0, 3)}****${r.referee_phone.slice(-3)}` : '******',
              created_at: r.created_at,
              status: isEligible ? 'eligible' : 'pending',
              reward_amount: 75.00,
              payment_status: isPaid ? 'paid' : (isEligible ? 'unpaid' : 'pending_activation'),
              paid_at: r.paid_at || null,
              payment_reference: r.payment_reference || null,
            };
          }),
          payments_history: paymentsHistory,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.developerService.error('[Profile] Error fetching referral dashboard', { error, deliveryPartnerId });
      throw new InternalServerErrorException('Failed to fetch referral dashboard');
    }
  }
}
