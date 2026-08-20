import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { RedisService } from '../../../shared/redis/redis.service';
import * as bcrypt from 'bcrypt';
import { UpdateCompanyProfileDto } from './company-profile.dto';
import {
  buildEditableCompanyProfile,
  buildTelephoneUrl,
  buildWhatsAppUrl,
  CompanyProfileRecord,
  formatCompanyAddress,
  parseSiteSettings,
  SiteSettingRow,
} from '../../../shared/company-profile/company-profile';

const COMPANY_PROFILE_COLUMNS = `
  id, name, legal_name, gst_number, pan_number, email, phone,
  secondary_phone, whatsapp, address, city, state, pincode, logo_url,
  website, instagram_url, facebook_url, youtube_url, created_at, updated_at
`;

const COMPANY_PROFILE_LOCK = 'admin-company-profile-singleton';

@Injectable()
export class ProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly redisService: RedisService,
  ) {}

  async getCompanyProfile() {
    try {
      const [profiles, settingRows] = await Promise.all([
        this.db.query<CompanyProfileRecord>(`
          SELECT ${COMPANY_PROFILE_COLUMNS}
          FROM company_profile
          ORDER BY created_at ASC NULLS LAST, id ASC
          LIMIT 1
        `),
        this.db.query<SiteSettingRow>(
          'SELECT key, value FROM site_settings ORDER BY key ASC',
        ),
      ]);
      const data = buildEditableCompanyProfile(
        profiles[0],
        parseSiteSettings(settingRows),
      );
      return { status: true, data, message: 'Company profile fetched' };
    } catch (error) {
      this.developer.error('getCompanyProfile error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve company profile',
      );
    }
  }

  async updateCompanyProfile(body: UpdateCompanyProfileDto) {
    try {
      const values = [
        body.name,
        body.legal_name ?? '',
        body.gst_number ?? '',
        body.pan_number ?? '',
        body.email ?? '',
        body.phone ?? '',
        body.secondary_phone ?? '',
        body.whatsapp ?? '',
        body.address ?? '',
        body.city ?? '',
        body.state ?? '',
        body.pincode ?? '',
        body.logo_url ?? '',
        body.website ?? '',
        body.instagram_url ?? '',
        body.facebook_url ?? '',
        body.youtube_url ?? '',
      ];

      const saved = await this.db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          COMPANY_PROFILE_LOCK,
        ]);
        const existing = await client.query(`
          SELECT id
          FROM company_profile
          ORDER BY created_at ASC NULLS LAST, id ASC
          LIMIT 1
        `);

        let savedResult;
        if (existing.rows.length > 0) {
          savedResult = await client.query(
            `UPDATE company_profile
                SET name = $1, legal_name = $2, gst_number = $3,
                    pan_number = $4, email = $5, phone = $6,
                    secondary_phone = $7, whatsapp = $8, address = $9,
                    city = $10, state = $11, pincode = $12, logo_url = $13,
                    website = $14, instagram_url = $15, facebook_url = $16,
                    youtube_url = $17, updated_at = NOW()
              WHERE id = $18
              RETURNING ${COMPANY_PROFILE_COLUMNS}`,
            [...values, existing.rows[0].id],
          );
        } else {
          savedResult = await client.query(
            `INSERT INTO company_profile (
                name, legal_name, gst_number, pan_number, email, phone,
                secondary_phone, whatsapp, address, city, state, pincode,
                logo_url, website, instagram_url, facebook_url, youtube_url
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15, $16, $17
              )
              RETURNING ${COMPANY_PROFILE_COLUMNS}`,
            values,
          );
        }

        const profile = savedResult.rows[0] as CompanyProfileRecord;
        const legacySettings: Array<[string, string]> = [
          ['company_name', String(profile.name ?? '')],
          ['logo_url', String(profile.logo_url ?? '')],
          ['website', String(profile.website ?? '')],
          ['email', String(profile.email ?? '')],
          ['phone', String(profile.phone ?? '')],
          ['phone_url', buildTelephoneUrl(profile.phone)],
          ['secondary_phone', String(profile.secondary_phone ?? '')],
          ['secondary_phone_url', buildTelephoneUrl(profile.secondary_phone)],
          ['whatsapp', String(profile.whatsapp ?? '')],
          ['whatsapp_url', buildWhatsAppUrl(profile.whatsapp)],
          ['address', formatCompanyAddress(profile)],
          ['city', String(profile.city ?? '')],
          ['state', String(profile.state ?? '')],
          ['pincode', String(profile.pincode ?? '')],
          ['instagram_url', String(profile.instagram_url ?? '')],
          ['facebook_url', String(profile.facebook_url ?? '')],
          ['youtube_url', String(profile.youtube_url ?? '')],
        ];
        const placeholders = legacySettings
          .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2}, NOW())`)
          .join(', ');
        await client.query(
          `INSERT INTO site_settings (key, value, updated_at)
           VALUES ${placeholders}
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = NOW()`,
          legacySettings.flat(),
        );

        return profile;
      });

      return {
        status: true,
        data: buildEditableCompanyProfile(saved, {}),
        message: 'Company profile updated',
      };
    } catch (error) {
      this.developer.error('updateCompanyProfile error', { error });
      throw new InternalServerErrorException(
        'Failed to update company profile',
      );
    }
  }

  async getAdminUsers(query: any) {
    try {
      const { page = 1, limit = 50 } = query;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const sql = `
        SELECT u.user_id, u.email, u.first_name, u.last_name, u.phone, u.account_status, u.created_at,
          ARRAY_AGG(r.name) AS roles
        FROM users u
        JOIN role_assignments ra ON ra.user_id = u.user_id AND ra.is_active = 1 AND ra.deleted_at IS NULL
        JOIN roles r ON UPPER(r.role_id) = UPPER(ra.role_id)
        WHERE UPPER(ra.role_id) = 'ADMIN'
        GROUP BY u.user_id, u.email, u.first_name, u.last_name, u.phone, u.account_status, u.created_at
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const rows = await this.db.query(sql, [parseInt(limit, 10), offset]);
      return { status: true, data: rows, message: 'Admin users fetched' };
    } catch (error) {
      this.developer.error('getAdminUsers error', { error });
      throw new InternalServerErrorException('Failed to retrieve admin users');
    }
  }

  async getRoles() {
    try {
      const rows = await this.db.query('SELECT * FROM roles ORDER BY name ASC');
      return { status: true, data: rows, message: 'Roles fetched' };
    } catch (error) {
      this.developer.error('getRoles error', { error });
      throw new InternalServerErrorException('Failed to retrieve roles');
    }
  }

  async getNotificationSettings() {
    try {
      const rows = await this.db.query(
        'SELECT * FROM notification_settings WHERE is_active = true ORDER BY setting_key ASC',
      );
      return {
        status: true,
        data: rows,
        message: 'Notification settings fetched',
      };
    } catch (error) {
      this.developer.error('getNotificationSettings error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  async updateNotificationSettings(body: any) {
    try {
      const { setting_key, setting_value, admin_id } = body;
      await this.db.query(
        `INSERT INTO notification_settings (setting_key, setting_value, updated_by) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2::jsonb, updated_by = $3, updated_at = NOW()`,
        [setting_key, JSON.stringify(setting_value), admin_id],
      );
      return { status: true, message: 'Notification setting updated' };
    } catch (error) {
      this.developer.error('updateNotificationSettings error', { error });
      throw new InternalServerErrorException('Failed');
    }
  }

  // ── My Profile (logged-in admin) ──────────────────────
  async getMyProfile(userId: string) {
    try {
      let rows: any[] = [];
      try {
        const sql = `
          SELECT
            u.user_id,
            u.email,
            u.user_name,
            COALESCE(u.first_name, u.user_name) AS first_name,
            COALESCE(u.last_name, '') AS last_name,
            COALESCE(u.phone, '') AS phone,
            u.role_id,
            u.account_status,
            u.created_at AS user_created_at
          FROM users u
          WHERE u.user_id = $1 OR u.email = $1
          LIMIT 1
        `;
        rows = await this.db.query(sql, [userId]);
      } catch (err) {
        console.warn('[getMyProfile] Primary query failed:', err);
      }

      if (!rows.length) return { status: false, message: 'User not found' };
      return { status: true, data: rows[0], message: 'Profile fetched' };
    } catch (error) {
      this.developer.error('getMyProfile error', { error });
      throw new InternalServerErrorException('Failed to retrieve profile');
    }
  }

  async updateMyProfile(userId: string, body: any) {
    try {
      const {
        first_name,
        last_name,
        phone,
        email,
        gender,
        date_of_birth,
        marital_status,
        bio,
        department,
        designation,
        education,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        alt_phone,
        branch_id,
      } = body;

      // 1) Update users table
      await this.db.query(
        `UPDATE users
         SET first_name = $2, last_name = $3, phone = $4, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, first_name, last_name, phone],
      );

      // 2) Upsert management_staff
      const existing = await this.db.query(
        `SELECT management_id FROM management_staff WHERE user_id = $1`,
        [userId],
      );

      if (existing.length > 0) {
        await this.db.query(
          `UPDATE management_staff
           SET gender = $2, date_of_birth = $3, marital_status = $4, bio = $5,
               department = $6, designation = $7, education = $8,
               address_line1 = $9, address_line2 = $10, city = $11, state = $12,
               postal_code = $13, alt_phone = $14, branch_id = $15,
               phone = $16, user_name = $17, updated_at = NOW()
           WHERE user_id = $1`,
          [
            userId,
            gender,
            date_of_birth || null,
            marital_status,
            bio,
            department,
            designation,
            education,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            alt_phone,
            branch_id || null,
            phone,
            [first_name, last_name].filter(Boolean).join(' '),
          ],
        );
      } else {
        // Generate a management_id and next sequence id for management_staff
        const mgmtId = `MGMT-${userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;
        const maxIdRes = await this.db.query(
          `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM management_staff`,
        );
        const nextId = parseInt(maxIdRes[0]?.next_id ?? 1, 10);

        await this.db.query(
          `INSERT INTO management_staff
             (id, management_id, user_id, role_id, user_name, branch_id,
              gender, date_of_birth, marital_status, bio,
              department, designation, education,
              address_line1, address_line2, city, state, postal_code,
              alt_phone, phone)
           VALUES ($1,$2,$3,'ADMIN',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [
            nextId,
            mgmtId,
            userId,
            [first_name, last_name].filter(Boolean).join(' '),
            branch_id || null,
            gender,
            date_of_birth || null,
            marital_status,
            bio,
            department,
            designation,
            education,
            address_line1,
            address_line2,
            city,
            state,
            postal_code,
            alt_phone,
            phone,
          ],
        );
      }

      return { status: true, message: 'Profile updated successfully' };
    } catch (error) {
      this.developer.error('updateMyProfile error', { error });
      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  async updateEmail(userId: string, body: any) {
    try {
      const email = String(body?.email ?? '')
        .toLowerCase()
        .trim();
      const verificationToken = String(body?.verification_token ?? '').trim();

      if (!email || !verificationToken) {
        throw new BadRequestException(
          'Email and verification token are required',
        );
      }

      // Verify OTP token from Redis
      const key = `otp_verified:${verificationToken}`;
      let stored = await this.redisService.fetch(key);
      if (!stored) {
        // Fallback check for hashed key if any client hashed the token
        const hashedToken = require('crypto')
          .createHash('sha256')
          .update(verificationToken)
          .digest('hex');
        stored = await this.redisService.fetch(
          `customer_auth_otp_verified:${hashedToken}`,
        );
      }
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;

      const targetEmail = (
        parsed?.email ||
        parsed?.contact ||
        parsed?.phone ||
        ''
      )
        .toLowerCase()
        .trim();
      if (!parsed || targetEmail !== email) {
        throw new BadRequestException('Invalid or expired verification token');
      }

      // Check if email is already in use by another user
      const users = await this.db.query(
        'SELECT user_id FROM users WHERE email = $1 AND user_id != $2 LIMIT 1',
        [email, userId],
      );
      if (users.length > 0) {
        throw new BadRequestException(
          'Email already registered by another account',
        );
      }

      // Mark OTP as consumed in auth_otp_challenges
      await this.redisService.forget(key);
      await this.db.query(
        `UPDATE auth_otp_challenges
         SET consumed_at = now()
         WHERE id = (
           SELECT id FROM auth_otp_challenges
           WHERE contact = $1 AND purpose = 'email_change' AND verified_at IS NOT NULL
           ORDER BY created_at DESC LIMIT 1
         )`,
        [email],
      );

      // Update email
      await this.db.query(
        'UPDATE users SET email = $1, updated_at = NOW() WHERE user_id = $2',
        [email, userId],
      );

      return { status: true, message: 'Email updated successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.developer.error('updateEmail error', { error });
      throw new InternalServerErrorException('Failed to update email');
    }
  }

  async changePassword(userId: string, body: any) {
    try {
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) {
        throw new BadRequestException(
          'Current password and new password are required',
        );
      }

      // 1) Verify current password matches
      const user = await this.db.query(
        'SELECT password FROM users WHERE user_id = $1',
        [userId],
      );
      if (!user.length) {
        throw new UnauthorizedException('User not found');
      }

      const matchesCurrent = await bcrypt.compare(
        currentPassword,
        user[0].password,
      );
      if (!matchesCurrent) {
        throw new BadRequestException('Incorrect current password');
      }

      // 2) Validate new password strength
      const strengthRegex =
        /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
      if (newPassword.length < 8 || !strengthRegex.test(newPassword)) {
        throw new BadRequestException(
          'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
        );
      }

      // 3) Check reuse of current password
      const reuseOfCurrent = await bcrypt.compare(
        newPassword,
        user[0].password,
      );
      if (reuseOfCurrent) {
        throw new BadRequestException(
          'Cannot reuse your current password. Please choose a different password.',
        );
      }

      // 4) Check history reuse (last 5 passwords)
      const history = await this.db.query(
        'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
        [userId],
      );
      for (const h of history) {
        if (await bcrypt.compare(newPassword, h.password_hash)) {
          throw new BadRequestException(
            'Cannot reuse last 5 passwords. Please choose a new password.',
          );
        }
      }

      // 5) Hash and update password
      const hashed = await bcrypt.hash(newPassword, 10);
      await this.db.query(
        'UPDATE users SET password = $2, updated_at = NOW() WHERE user_id = $1',
        [userId, hashed],
      );

      // 6) Record password history
      await this.db.query(
        'INSERT INTO password_history (user_id, password_hash, created_at) VALUES ($1, $2, NOW())',
        [userId, hashed],
      );

      return { status: true, message: 'Password updated successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.developer.error('changePassword error', { error });
      throw new InternalServerErrorException('Failed to update password');
    }
  }
}
