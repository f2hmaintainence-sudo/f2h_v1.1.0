import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
          db.*,
          u.email AS user_email,
          u.last_login_at,
          u.settings,
          u.account_status,
          b.branch_name
        FROM delivery_partners db
        LEFT JOIN users u ON u.user_id = db.delivery_partner_id
        LEFT JOIN branches b ON b.branch_id = db.branch_id
        WHERE db.delivery_partner_id = $1
        LIMIT 1`,
        [deliveryPartnerId],
      );

      if (!result?.length) {
        throw new NotFoundException('Delivery partner profile not found');
      }
      return result[0];
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching personal info for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async updatePersonalInfo(deliveryPartnerId: string, dto: UpdatePersonalDto) {
    try {
      // Update delivery_partners table
      const deliveryPartnerUpdates: Record<string, any> = {};
      if (dto.full_name !== undefined) deliveryPartnerUpdates.full_name = dto.full_name;
      if (dto.email !== undefined) deliveryPartnerUpdates.email = dto.email;
      if (dto.emergency_contact !== undefined) deliveryPartnerUpdates.emergency_contact = dto.emergency_contact;
      if (dto.emergency_contact_number !== undefined) deliveryPartnerUpdates.emergency_contact_number = dto.emergency_contact_number;
      if (dto.date_of_birth !== undefined) deliveryPartnerUpdates.date_of_birth = dto.date_of_birth;
      if (dto.gender !== undefined) deliveryPartnerUpdates.gender = dto.gender;
      if (dto.residential_address !== undefined) deliveryPartnerUpdates.residential_address = dto.residential_address;
      deliveryPartnerUpdates.updated_at = new Date();

      // Update users table (for shared fields: name, email)
      const userUpdates: Record<string, any> = {};
      if (dto.full_name !== undefined) userUpdates.user_name = dto.full_name;
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

      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      const fileUrl = `uploads/profile-photos/${filename}`;

      // Update both tables
      await this.Data.update(
        'delivery_partners',
        { profile_photo_url: fileUrl, updated_at: new Date() },
        [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
      );
      await this.Data.update(
        'users',
        { profile: fileUrl, updated_at: new Date() },
        [{ column: 'user_id', operator: '=', value: deliveryPartnerId }],
      );

      return { success: true, url: fileUrl };
    } catch (error) {
      this.developerService.error(`[Profile] Error uploading profile photo for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  // ─── Documents ──────────────────────────────────────────────────────────────

  async getDocuments(deliveryPartnerId: string) {
    try {
      const result = await this.Data.query('user_documents', {
        where: [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
        orderBy: [{ column: 'created_at', direction: 'DESC' }],
      });
      return result?.data || [];
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching documents for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async createDocument(deliveryPartnerId: string, dto: CreateDocumentDto, files?: { front_image?: any; back_image?: any }) {
    try {
                  this.developerService.info('document dto',  {
  dto
});
      const docData: Record<string, any> = {
        delivery_partner_id: deliveryPartnerId,
        document_type: dto.document_type,
        document_number: dto.document_number,
        issue_date: dto.issue_date || null,
        expiry_date: dto.expiry_date || null,
        verification_status: 'pending',
        is_primary: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Handle file uploads
      if (files?.front_image) {
        docData.front_image = await this.saveDocumentFile(deliveryPartnerId, 'front', files.front_image);
      }
      if (files?.back_image) {
        docData.back_image = await this.saveDocumentFile(deliveryPartnerId, 'back', files.back_image);
      }

      await this.Data.insert('user_documents', docData);
      return { success: true, message: 'Document added successfully. Pending admin verification.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error creating document for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async updateDocument(deliveryPartnerId: string, docId: string, dto: UpdateDocumentDto, files?: { front_image?: any; back_image?: any }) {
    try {
      // Verify ownership
      const existing = await this.Data.query('user_documents', {
        where: [
          { column: 'id', operator: '=', value: docId },
          { column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId },
        ],
        limit: 1,
      });
      if (!existing?.data?.length) throw new NotFoundException('Document not found');

      const updates: Record<string, any> = { updated_at: new Date(), verification_status: 'pending' };
      if (dto.document_number !== undefined) updates.document_number = dto.document_number;
      if (dto.issue_date !== undefined) updates.issue_date = dto.issue_date;
      if (dto.expiry_date !== undefined) updates.expiry_date = dto.expiry_date;

      if (files?.front_image) {
        updates.front_image = await this.saveDocumentFile(deliveryPartnerId, 'front', files.front_image);
      }
      if (files?.back_image) {
        updates.back_image = await this.saveDocumentFile(deliveryPartnerId, 'back', files.back_image);
      }

      await this.Data.update('user_documents', updates, [
        { column: 'id', operator: '=', value: docId },
      ]);

      return { success: true, message: 'Document updated. Re-submitted for verification.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error updating document id ${docId} for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async deleteDocument(deliveryPartnerId: string, docId: string) {
    try {
      const existing = await this.Data.query('user_documents', {
        where: [
          { column: 'id', operator: '=', value: docId },
          { column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId },
        ],
        limit: 1,
      });
      if (!existing?.data?.length) throw new NotFoundException('Document not found');

      await this.db.query('DELETE FROM user_documents WHERE id = $1 AND delivery_partner_id = $2', [docId, deliveryPartnerId]);
      return { success: true, message: 'Document deleted' };
    } catch (error) {
      this.developerService.error(`[Profile] Error deleting document id ${docId} for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  // ─── Vehicles ───────────────────────────────────────────────────────────────

  async getVehicles(deliveryPartnerId: string) {
    try {
      const result = await this.Data.query('user_vehicles', {
        where: [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
        orderBy: [{ column: 'created_at', direction: 'DESC' }],
      });
      return result?.data || [];
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching vehicles for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async createVehicle(deliveryPartnerId: string, dto: CreateVehicleDto, files?: { rc_front_image?: any; rc_back_image?: any; insurance_image?: any }) {
    try {
      // If marking as primary, unset others
      if (dto.is_primary) {
        await this.db.query(
          'UPDATE user_vehicles SET is_primary = false WHERE delivery_partner_id = $1',
          [deliveryPartnerId],
        );
      }

      const vehicleData: Record<string, any> = {
        delivery_partner_id: deliveryPartnerId,
        vehicle_type: dto.vehicle_type,
        registration_number: dto.registration_number,
        brand: dto.brand || null,
        model: dto.model || null,
        color: dto.color || null,
        rc_number: dto.rc_number || null,
        insurance_number: dto.insurance_number || null,
        insurance_expiry: dto.insurance_expiry || null,
        verification_status: 'pending',
        is_primary: dto.is_primary !== false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (files?.rc_front_image) vehicleData.rc_front_image = await this.saveDocumentFile(deliveryPartnerId, 'rc_front', files.rc_front_image);
      if (files?.rc_back_image) vehicleData.rc_back_image = await this.saveDocumentFile(deliveryPartnerId, 'rc_back', files.rc_back_image);
      if (files?.insurance_image) vehicleData.insurance_image = await this.saveDocumentFile(deliveryPartnerId, 'insurance', files.insurance_image);

      // Also update delivery_partners table with primary vehicle info
      await this.Data.update('delivery_partners', {
        vehicle_type: dto.vehicle_type,
        vehicle_number: dto.registration_number,
        updated_at: new Date(),
      }, [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }]);

      await this.Data.insert('user_vehicles', vehicleData);
      return { success: true, message: 'Vehicle added successfully. Pending admin verification.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error creating vehicle for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async updateVehicle(deliveryPartnerId: string, vehicleId: string, dto: UpdateVehicleDto, files?: { rc_front_image?: any; rc_back_image?: any; insurance_image?: any }) {
    try {
      const existing = await this.Data.query('user_vehicles', {
        where: [
          { column: 'id', operator: '=', value: vehicleId },
          { column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId },
        ],
        limit: 1,
      });
      if (!existing?.data?.length) throw new NotFoundException('Vehicle not found');

      if (dto.is_primary) {
        await this.db.query(
          'UPDATE user_vehicles SET is_primary = false WHERE delivery_partner_id = $1 AND id != $2',
          [deliveryPartnerId, vehicleId],
        );
      }

      const updates: Record<string, any> = { updated_at: new Date(), verification_status: 'pending' };
      if (dto.vehicle_type !== undefined) updates.vehicle_type = dto.vehicle_type;
      if (dto.registration_number !== undefined) updates.registration_number = dto.registration_number;
      if (dto.brand !== undefined) updates.brand = dto.brand;
      if (dto.model !== undefined) updates.model = dto.model;
      if (dto.color !== undefined) updates.color = dto.color;
      if (dto.rc_number !== undefined) updates.rc_number = dto.rc_number;
      if (dto.insurance_number !== undefined) updates.insurance_number = dto.insurance_number;
      if (dto.insurance_expiry !== undefined) updates.insurance_expiry = dto.insurance_expiry;
      if (dto.is_primary !== undefined) updates.is_primary = dto.is_primary;

      if (files?.rc_front_image) updates.rc_front_image = await this.saveDocumentFile(deliveryPartnerId, 'rc_front', files.rc_front_image);
      if (files?.rc_back_image) updates.rc_back_image = await this.saveDocumentFile(deliveryPartnerId, 'rc_back', files.rc_back_image);
      if (files?.insurance_image) updates.insurance_image = await this.saveDocumentFile(deliveryPartnerId, 'insurance', files.insurance_image);

      await this.Data.update('user_vehicles', updates, [{ column: 'id', operator: '=', value: vehicleId }]);

      // Sync primary vehicle to delivery_partners
      if (dto.is_primary || existing.data[0].is_primary) {
        await this.Data.update('delivery_partners', {
          vehicle_type: dto.vehicle_type || existing.data[0].vehicle_type,
          vehicle_number: dto.registration_number || existing.data[0].registration_number,
          updated_at: new Date(),
        }, [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }]);
      }

      return { success: true, message: 'Vehicle updated. Re-submitted for verification.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error updating vehicle id ${vehicleId} for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async deleteVehicle(deliveryPartnerId: string, vehicleId: string) {
    try {
      const existing = await this.Data.query('user_vehicles', {
        where: [
          { column: 'id', operator: '=', value: vehicleId },
          { column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId },
        ],
        limit: 1,
      });
      if (!existing?.data?.length) throw new NotFoundException('Vehicle not found');

      await this.db.query('DELETE FROM user_vehicles WHERE id = $1 AND delivery_partner_id = $2', [vehicleId, deliveryPartnerId]);
      return { success: true, message: 'Vehicle removed' };
    } catch (error) {
      this.developerService.error(`[Profile] Error deleting vehicle id ${vehicleId} for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  // ─── Bank Accounts ─────────────────────────────────────────────────────────

  async getBankAccounts(deliveryPartnerId: string) {
    try {
      const result = await this.Data.query('user_bank_accounts', {
        where: [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }],
        orderBy: [{ column: 'created_at', direction: 'DESC' }],
      });
      return result?.data || [];
    } catch (error) {
      this.developerService.error(`[Profile] Error fetching bank accounts for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
  }

  async createBankAccount(deliveryPartnerId: string, dto: CreateBankAccountDto, file?: any) {
    try {
      if (dto.is_primary) {
        await this.db.query(
          'UPDATE user_bank_accounts SET is_primary = false WHERE delivery_partner_id = $1',
          [deliveryPartnerId],
        );
      }

      const bankData: Record<string, any> = {
        delivery_partner_id: deliveryPartnerId,
        account_holder_name: dto.account_holder_name,
        bank_name: dto.bank_name,
        account_number: dto.account_number,
        ifsc_code: dto.ifsc_code,
        branch_name: dto.branch_name || null,
        upi_id: dto.upi_id || null,
        verification_status: 'pending',
        is_primary: dto.is_primary !== false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (file) {
        bankData.cancelled_cheque_image = await this.saveDocumentFile(deliveryPartnerId, 'cheque', file);
      }

      // Also update delivery_partners legacy bank columns
      await this.Data.update('delivery_partners', {
        bank_account_number: dto.account_number,
        bank_ifsc: dto.ifsc_code,
        bank_name: dto.bank_name,
        account_holder_name: dto.account_holder_name,
        updated_at: new Date(),
      }, [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }]);

      await this.Data.insert('user_bank_accounts', bankData);
      return { success: true, message: 'Bank account added. Pending admin verification.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error creating bank account for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async updateBankAccount(deliveryPartnerId: string, bankId: string, dto: UpdateBankAccountDto, file?: any) {
    try {
      const existing = await this.Data.query('user_bank_accounts', {
        where: [
          { column: 'id', operator: '=', value: bankId },
          { column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId },
        ],
        limit: 1,
      });
      if (!existing?.data?.length) throw new NotFoundException('Bank account not found');

      if (dto.is_primary) {
        await this.db.query(
          'UPDATE user_bank_accounts SET is_primary = false WHERE delivery_partner_id = $1 AND id != $2',
          [deliveryPartnerId, bankId],
        );
      }

      const updates: Record<string, any> = { updated_at: new Date(), verification_status: 'pending' };
      if (dto.account_holder_name !== undefined) updates.account_holder_name = dto.account_holder_name;
      if (dto.bank_name !== undefined) updates.bank_name = dto.bank_name;
      if (dto.account_number !== undefined) updates.account_number = dto.account_number;
      if (dto.ifsc_code !== undefined) updates.ifsc_code = dto.ifsc_code;
      if (dto.branch_name !== undefined) updates.branch_name = dto.branch_name;
      if (dto.upi_id !== undefined) updates.upi_id = dto.upi_id;
      if (dto.is_primary !== undefined) updates.is_primary = dto.is_primary;

      if (file) {
        updates.cancelled_cheque_image = await this.saveDocumentFile(deliveryPartnerId, 'cheque', file);
      }

      await this.Data.update('user_bank_accounts', updates, [{ column: 'id', operator: '=', value: bankId }]);

      // Sync primary bank to delivery_partners
      if (dto.is_primary || existing.data[0].is_primary) {
        await this.Data.update('delivery_partners', {
          bank_account_number: dto.account_number || existing.data[0].account_number,
          bank_ifsc: dto.ifsc_code || existing.data[0].ifsc_code,
          bank_name: dto.bank_name || existing.data[0].bank_name,
          account_holder_name: dto.account_holder_name || existing.data[0].account_holder_name,
          updated_at: new Date(),
        }, [{ column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId }]);
      }

      return { success: true, message: 'Bank account updated. Re-submitted for verification.' };
    } catch (error) {
      this.developerService.error(`[Profile] Error updating bank account id ${bankId} for deliveryPartnerId: ${deliveryPartnerId}`, { error, dto });
      throw error;
    }
  }

  async deleteBankAccount(deliveryPartnerId: string, bankId: string) {
    try {
      const existing = await this.Data.query('user_bank_accounts', {
        where: [
          { column: 'id', operator: '=', value: bankId },
          { column: 'delivery_partner_id', operator: '=', value: deliveryPartnerId },
        ],
        limit: 1,
      });
      if (!existing?.data?.length) throw new NotFoundException('Bank account not found');

      await this.db.query('DELETE FROM user_bank_accounts WHERE id = $1 AND delivery_partner_id = $2', [bankId, deliveryPartnerId]);
      return { success: true, message: 'Bank account removed' };
    } catch (error) {
      this.developerService.error(`[Profile] Error deleting bank account id ${bankId} for deliveryPartnerId: ${deliveryPartnerId}`, { error });
      throw error;
    }
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
      // Clear all refresh tokens and sessions
      await this.Data.update('users', {
        refreshToken: null,
        refreshTokenJti: null,
        session_token: null,
        updated_at: new Date(),
      }, [{ column: 'user_id', operator: '=', value: deliveryPartnerId }]);

      // Deactivate all device sessions
      try {
        await this.db.query(
          'UPDATE user_devices SET is_current = false, is_active = false WHERE user_id = $1',
          [deliveryPartnerId],
        );
      } catch { /* user_devices may not have is_active column */ }

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
           db.full_name,
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
         JOIN delivery_partners db ON db.delivery_partner_id = dr.delivery_partner_id
         WHERE EXTRACT(YEAR FROM dr.run_date) = $1
           AND EXTRACT(MONTH FROM dr.run_date) = $2
           AND dr.status NOT IN ('cancelled')
         GROUP BY dr.delivery_partner_id, db.full_name
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
        full_name: r.full_name,
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
           COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS customer_name,
           c.phone AS customer_phone,
           COALESCE(ca.flat_no, '') || ' ' || COALESCE(ca.building_name, '') || ' ' || COALESCE(ca.street, '') || ' ' || COALESCE(ca.area, '') AS customer_address,
           dl.status AS log_status,
           COALESCE(dl.bottles_collected, 0) as bottles_collected,
           COALESCE(dl.cash_collected, 0) as cash_collected,
           COALESCE(dl.remarks, '') as remarks,
           dl.proof_photo_url,
           dl.delivery_time,
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
         JOIN customers c ON c.customer_id = o.customer_id
         LEFT JOIN customer_addresses ca ON (ca.address_id = o.address_id OR ca.id::text = o.address_id)
         LEFT JOIN delivery_logs dl ON dl.order_id = o.order_id
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

      // Get delivery boy name for notification
      const dpResult = await this.db.query(
        `SELECT full_name FROM delivery_partners WHERE delivery_partner_id = $1 LIMIT 1`,
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
}
