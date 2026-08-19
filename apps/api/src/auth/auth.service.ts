import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import {
  RedisService,
  CACHE_KEYS,
  CACHE_TTL,
} from 'src/shared/redis/redis.service';
import { EncryptionService } from './encryption.service';
import { MailService } from 'src/mail/mail.service';
import { TokenRevocationService } from './token-revocation.service';
import { AuditLoggerService } from './audit-logger.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { SecurityAlertsService } from './security-alerts.service';
import { PasswordSecurityService } from './password-security.service';
import { NotificationService } from 'src/notifications/notification.service';
import * as crypto from 'crypto';
import { generateId } from 'src/helpers/RandomHelper';
import { ROLE } from './decorators/roles.decorator';
import { RegisterDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { FieldEncryptionService } from 'src/encryption/field-encryption.service';

/**
 * Converts a `jsonwebtoken` style duration ('15m', '30d', '3600') to seconds, so the
 * Redis session registry can be given exactly the refresh token's lifetime instead of
 * a hardcoded constant that drifts from it.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhdw]?)$/i.exec(String(value).trim());
  if (!match) {
    throw new Error(`Unsupported token duration: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplier: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  return amount * multiplier[unit];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly DataBase: DatabaseService,
    private readonly Data: DataService,
    private readonly redisService: RedisService,
    private readonly encryptionService: EncryptionService,
    private readonly mailService: MailService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly auditLogger: AuditLoggerService,
    private readonly otpRateLimitService: OtpRateLimitService,
    private readonly deviceFingerprintService: DeviceFingerprintService,
    private readonly securityAlerts: SecurityAlertsService,
    private readonly passwordSecurity: PasswordSecurityService,
    private readonly notificationService: NotificationService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly developer: DeveloperService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Checks is_active in the satellite table corresponding to which app (clientRole) the user is logging into.
   * - CUSTOMER app  → customers table        (customer_id = userId)
   * - DELIVERY app  → delivery_partners table  (delivery_partner_id = userId)
   * - ADMIN panel   → management_staff table   (user_id = userId)
   */
  async checkSatelliteIsActive(userId: string, clientRole: string): Promise<boolean> {
    const appRole = (clientRole || '').toUpperCase().trim();

    try {
      if (appRole === 'CUSTOMER') {
        // Customer app: check customers table
        const rows = await this.DataBase.query(
          `SELECT is_active FROM customers WHERE customer_id = $1 LIMIT 1`,
          [userId],
        );
        if (rows && rows.length > 0) {
          const val = rows[0].is_active;
          if (val === false || val === 0 || val === 'false') return false;
        }
        return true;
      }

      if (['DELIVERY_PARTNER', 'DELIVERY_BOY', 'DELIVERY', 'D'].includes(appRole)) {
        // Delivery app: check delivery_partners table
        const rows = await this.DataBase.query(
          `SELECT is_active FROM delivery_partners WHERE delivery_partner_id = $1 LIMIT 1`,
          [userId],
        );
        if (rows && rows.length > 0) {
          const val = rows[0].is_active;
          if (val === false || val === 0 || val === 'false') return false;
        }
        return true;
      }

      if (appRole === 'ADMIN') {
        // Admin panel: check management_staff table
        const rows = await this.DataBase.query(
          `SELECT is_active FROM management_staff WHERE user_id = $1 LIMIT 1`,
          [userId],
        );
        if (rows && rows.length > 0) {
          const val = rows[0].is_active;
          if (val === false || val === 0 || val === 'false') return false;
        }
        return true;
      }

      return true;
    } catch (e) {
      this.developer.error('Error checking satellite is_active status:', e);
      return true;
    }
  }

  async validateUser(
    identifier: string,
    password: string,
    requestedRole?: string,
    ip?: string,
    userAgent?: string,
    fingerprintData?: any,
    fcmToken?: string,
  ) {
    const rawIdentifier = identifier.trim();
    const formattedIdentifier = rawIdentifier.toLowerCase();
    const selectCols = [
      'user_id',
      'email',
      'password',
      'locked_at',
      'max_logins',
      'user_name',
      'phone',
      'must_change_password',
      'role_id',
    ];

    let user: any = null;

    // 1. Search by email
    const emailMatch = await this.Data.query('users', {
      select: selectCols,
      where: [{ column: 'email', operator: '=', value: formattedIdentifier }],
      limit: 1,
    });
    if (emailMatch?.data?.length) {
      user = emailMatch.data[0];
    }

    // 2. Search by user_name
    if (!user) {
      const usernameMatch = await this.Data.query('users', {
        select: selectCols,
        where: [{ column: 'user_name', operator: '=', value: formattedIdentifier }],
        limit: 1,
      });
      if (usernameMatch?.data?.length) {
        user = usernameMatch.data[0];
      }
    }

    // 3. Search by phone
    if (!user) {
      const phoneMatch = await this.Data.query('users', {
        select: selectCols,
        where: [{ column: 'phone', operator: '=', value: rawIdentifier }],
        limit: 1,
      });
      if (phoneMatch?.data?.length) {
        user = phoneMatch.data[0];
      }
    }

    // 3b. Search by phone last 10 digits fallback
    if (!user) {
      const cleanPhoneInput = rawIdentifier.replace(/\D/g, '');
      if (cleanPhoneInput.length >= 10) {
        const last10 = cleanPhoneInput.slice(-10);
        const phoneMatchRes = await this.DataBase.query(
          `SELECT user_id, email, password, locked_at, max_logins, user_name, phone, must_change_password, role_id
           FROM users
           WHERE REGEXP_REPLACE(phone, '\\D', '', 'g') LIKE $1
           LIMIT 1`,
          [`%${last10}`]
        );
        if (phoneMatchRes?.length) {
          user = phoneMatchRes[0];
        }
      }
    }

    if (!user) {
      this.developer.debug('[Auth:validateUser] Login failed - user not found', {
        identifier: formattedIdentifier,
        ip: ip || 'unknown',
      });

      this.auditLogger.logLoginFailure({
        identifier: formattedIdentifier,
        ip: ip || 'unknown',
        reason: 'User not found',
        attempt: 1,
      });

      throw new UnauthorizedException('Invalid email/mobile or password');
    }

    // Role verification if requested
    if (requestedRole) {
      const uRole = (user.role_id || '').toUpperCase();
      const rRole = requestedRole.toUpperCase();
      if (uRole !== rRole) {
        this.auditLogger.logLoginFailure({
          identifier: formattedIdentifier,
          ip: ip || 'unknown',
          reason: `Invalid role: ${uRole} (expected ${rRole}).`,
          attempt: 1,
        });

        throw new UnauthorizedException('Invalid email/mobile or password');
      }
    }

    // Check lock status
    // if (user.locked_at) {
    //   const lockoutDuration = 30 * 60 * 1000; // 30 minutes
    //   if (
    //     new Date().getTime() - new Date(user.locked_at).getTime() <
    //     lockoutDuration
    //   ) {
    //     const remainingTime = Math.ceil(
    //       (lockoutDuration -
    //         (new Date().getTime() - new Date(user.locked_at).getTime())) /
    //       60000,
    //     );

    //     this.auditLogger.logAccountLockout({
    //       userId: user.user_id,
    //       email: user.email,
    //       ip: ip || 'unknown',
    //       reason: 'Account locked - multiple failed attempts',
    //     });

    //     throw new ForbiddenException(
    //       `Account is locked due to multiple failed login attempts. Please try again in ${remainingTime} minutes.`,
    //     );
    //   } else {
    //     // Unlock account after lockout duration has passed
    //     await this.Data.update(
    //       'users',
    //       { locked_at: null },
    //       [{ column: 'user_id', operator: '=', value: user.user_id }],
    //     );
    //   }
    // }

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      const newAttempts = (user.max_logins || 0) + 1;

      if (newAttempts >= 5) {
        await this.Data.update(
          'users',
          { locked_at: new Date(), max_logins: newAttempts },
          [{ column: 'user_id', operator: '=', value: user.user_id }],
        );

        await this.securityAlerts.alertAccountLocked({
          userId: user.user_id,
          email: user.email || '',
          ipAddress: ip || 'unknown',
          reason: 'LOGIN_ATTEMPTS',
        });

        throw new ForbiddenException(
          'Account has been locked due to multiple failed login attempts. Please try again in 30 minutes.',
        );
      } else {
        await this.Data.update(
          'users',
          { max_logins: newAttempts },
          [{ column: 'user_id', operator: '=', value: user.user_id }],
        );

        this.auditLogger.logLoginFailure({
          identifier: formattedIdentifier,
          email: user.email,
          ip: ip || 'unknown',
          reason: 'Incorrect password',
          attempt: newAttempts,
        });

        throw new UnauthorizedException('Invalid email/mobile or password');
      }
    }

    // Success: clear login attempts database field
    if (user.max_logins > 0) {
      await this.Data.update(
        'users',
        { max_logins: 0 },
        [{ column: 'user_id', operator: '=', value: user.user_id }],
      );
    }

    if (fcmToken) {
      await this.updateFcmToken(user.user_id, fcmToken);
    }

    return user;
  }

  /*===============================================================================================
    Registration Flow:
   ================================================================================================*/


  async register(body: RegisterDto) {
    const now = new Date();
    const email = body.email ? body.email.toLowerCase().trim() : null;
    const phone = body.phone ? body.phone.trim() : null;
    const roleId = (body.role || 'CUSTOMER').toUpperCase();

    this.developer.debug('register', body);
    if (!email && !phone) {
      throw new BadRequestException('Email and phone is required');
    }

    // Validate referral code if provided
    let referrerId: string | null = null;
    if (body.referral_code && body.referral_code.trim().length > 0) {
      const referrer = await this.findReferrer(body.referral_code);
      if (referrer) {
        referrerId = referrer.customer_id || referrer.user_id || null;
      }
    }

    // Parse name fields (first_name, last_name, user_name, full_name/name)
    let firstName = (body.first_name || '').trim();
    let lastName = (body.last_name || '').trim();

    if (!firstName) {
      const fullName = (
        (body as any).full_name ||
        body.name ||
        (body as any).fullName ||
        ''
      ).trim();

      if (fullName) {
        const parts = fullName.split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || lastName;
      } else if (body.user_name) {
        firstName = body.user_name.trim();
      } else if (email) {
        firstName = email.split('@')[0];
      } else {
        firstName = 'User';
      }
    }

    const userName = (
      body.user_name ||
      (firstName + (lastName ? ` ${lastName}` : '')) ||
      email?.split('@')[0] ||
      phone ||
      'user'
    ).trim();

    // Check existing users via indexed SQL query
    let existingUser: any = null;
    if (email) {
      const emailRes = await this.Data.query('users', {
        select: ['user_id', 'email', 'phone', 'password', 'role_id'],
        where: [{ column: 'email', operator: '=', value: email.toLowerCase().trim() }],
        limit: 1,
      });
      existingUser = emailRes?.data?.[0];
    }
    if (!existingUser && phone) {
      const phoneRes = await this.Data.query('users', {
        select: ['user_id', 'email', 'phone', 'password', 'role_id'],
        where: [{ column: 'phone', operator: '=', value: phone.trim() }],
        limit: 1,
      });
      existingUser = phoneRes?.data?.[0];
    }

    // Only skip duplicate registration if user is already fully registered WITH a set name/user_name and matching role
    const isFullyRegistered =
      existingUser &&
      (existingUser.first_name || existingUser.user_name) &&
      existingUser.password &&
      !existingUser.password.startsWith('temp_') &&
      existingUser.role_id === roleId;

    if (isFullyRegistered) {
      this.developer.debug(`[AuthService:register] User ${existingUser.user_id} already registered. Skipping duplicate OTP consumption.`);
      return {
        message: 'Registration successful',
        userId: existingUser.user_id,
      };
    }

    // Verify OTP for registrations
    if (roleId === 'CUSTOMER' || roleId === 'DELIVERY_PARTNER') {
      if (!body.verification_token) {
        throw new BadRequestException('Verification token is required');
      }
      await this.consumeVerifiedOtp(body.verification_token, email || phone!, 'registration');
    }

    const userId = existingUser ? existingUser.user_id : generateId('USER', 10);
    const hashedPassword = body.password
      ? await bcrypt.hash(body.password, 12)
      : crypto.randomUUID();

    await this.Data.executeTransaction(async (transaction) => {
      if (existingUser) {
        // Update placeholder user created during OTP verification
        const incomingFcmToken = body.fcm_token || (body as any).fcmToken;
        this.developer.debug('userUpdatePayload', body);
        const userUpdatePayload: any = {
          email,
          phone,
          user_name: userName,
          first_name: firstName,
          last_name: lastName,
          password: hashedPassword,
          role_id: roleId,
          updated_at: now,
        };
        if (incomingFcmToken) {
          userUpdatePayload.fcm_token = incomingFcmToken;
        }

        await this.Data.update(
          'users',
          userUpdatePayload,
          [{ column: 'user_id', operator: '=', value: userId }],
          { transaction },
        );
      } else {
        const incomingFcmToken = body.fcm_token || (body as any).fcmToken;
        const userInsertPayload: any = {
          user_id: userId,
          email,
          phone,
          user_name: userName,
          first_name: firstName,
          last_name: lastName,
          password: hashedPassword,
          role_id: roleId,
          created_at: now,
          updated_at: now,
        };
        if (incomingFcmToken) {
          userInsertPayload.fcm_token = incomingFcmToken;
        }

        const userResult = await this.Data.insert(
          'users',
          userInsertPayload,
          { transaction },
        );

        if (!userResult?.status) {
          throw new InternalServerErrorException('Failed to create user');
        }
      }

      // Customer specific initialization
      if (roleId === 'CUSTOMER') {
        const existingCust = await this.Data.query('customers', {
          where: [{ column: 'customer_id', operator: '=', value: userId }],
          limit: 1,
        });

        const custFirstName = firstName || userName || 'Customer';
        const generatedRefCode = await this.generateUniqueRefCode(
          custFirstName,
          phone || undefined,
        );

        if (existingCust?.data?.length > 0) {
          // Update only valid customers table columns (no first_name/last_name/phone/email/mobile)
          const custPayload: any = {
            updated_at: now,
          };
          if (referrerId) {
            custPayload.referred_by = referrerId;
          }
          await this.Data.update(
            'customers',
            custPayload,
            [{ column: 'customer_id', operator: '=', value: userId }],
            { transaction },
          );
        } else {
          // Insert only valid customers table columns (no first_name/last_name/phone/email/mobile)
          const custPayload: any = {
            customer_id: userId,
            referral_code: generatedRefCode,
            referral_status: 'locked',
            branch_id: body.branch_id || null,
            created_at: now,
            updated_at: now,
          };
          if (referrerId) {
            custPayload.referred_by = referrerId;
          }
          await this.Data.insert('customers', custPayload, { transaction });
        }

        // Also store referral_code in users table for unified lookup
        await this.Data.update(
          'users',
          { referral_code: generatedRefCode, updated_at: now },
          [{ column: 'user_id', operator: '=', value: userId }],
          { transaction },
        );

        // Insert row into referrals table if user registered with a referral code
        if (referrerId) {
          try {
            const referId = generateId('REF', 8);
            const refCode = body.referral_code ? body.referral_code.trim().toUpperCase() : 'F2HREF';
            const refereeName = [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || body.name || 'Customer';
            const refereePhone = body.phone || (body as any).contact_number || '';

            // Check if referring user is a DP via PostgreSQL
            const dpReferrerRows = await this.DataBase.query(
              `SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1 LIMIT 1`,
              [referrerId],
            );
            const isDpRef = dpReferrerRows?.length > 0;

            await this.Data.insert(
              'referrals',
              {
                refer_id: referId,
                referrer_customer_id: referrerId,
                referred_customer_id: userId,
                referrer_user_id: referrerId,
                referred_user_id: userId,
                referral_code: refCode,
                referrer_reward_amount: isDpRef ? 75.00 : 50.00,
                referred_reward_amount: isDpRef ? 0.00 : 50.00,
                reward_amount: isDpRef ? '75.00' : '50.00',
                status: 'pending',
                remarks: isDpRef ? 'DP referral registered - ₹75 for DP on 1st delivered order' : 'Referral registered - pending first delivered order',
                created_at: now,
                updated_at: now,
              },
              { transaction },
            );
          } catch (refErr) {
            console.error('[AuthService] Failed to insert referral record:', refErr);
          }
        }
      }

      // Delivery Partner specific initialization
      if (roleId === 'DELIVERY_PARTNER') {
        let selectedBranchId = body.branch_id;
        const branchesRes = await this.Data.query('branches', {
          where: [{ column: 'is_active', operator: '=', value: true }],
        });
        const branches = branchesRes?.data ?? [];

        if (!selectedBranchId && body.latitude !== undefined && body.longitude !== undefined) {
          const lat = parseFloat(String(body.latitude));
          const lng = parseFloat(String(body.longitude));

          if (!isNaN(lat) && !isNaN(lng)) {
            for (const branch of branches) {
              const bLat = parseFloat(branch.lat);
              const bLng = parseFloat(branch.lng);
              const radius = parseFloat(branch.delivery_radius_km) || 5;
              if (!isNaN(bLat) && !isNaN(bLng)) {
                const distanceKm = this.getHaversineDistance(lat, lng, bLat, bLng);
                if (distanceKm <= radius) {
                  selectedBranchId = branch.branch_id;
                  break;
                }
              }
            }
          }
        }

        if (!selectedBranchId && branches.length > 0) {
          selectedBranchId = branches[0].branch_id;
        }

        const existingDp = await this.Data.query('delivery_partners', {
          where: [{ column: 'delivery_partner_id', operator: '=', value: userId }],
          limit: 1,
        });

        if (existingDp?.data?.length > 0) {
          // Update only valid delivery_partners columns (no full_name, phone, email)
          await this.Data.update(
            'delivery_partners',
            {
              user_id: userId,
              branch_id: selectedBranchId || existingDp.data[0].branch_id || null,
              current_lat: body.latitude !== undefined && body.latitude !== null ? Number(body.latitude) : null,
              current_lng: body.longitude !== undefined && body.longitude !== null ? Number(body.longitude) : null,
              referred_by: referrerId,
              updated_at: now,
            },
            [{ column: 'delivery_partner_id', operator: '=', value: userId }],
            { transaction },
          );
        } else {
          // Insert only valid delivery_partners columns (no full_name, phone, email)
          await this.Data.insert(
            'delivery_partners',
            {
              delivery_partner_id: userId,
              user_id: userId,
              branch_id: selectedBranchId || null,
              is_active: false,
              is_verified: false,
              is_available: true,
              vehicle_type: 'BIKE',
              vehicle_number: 'N/A',
              current_lat: body.latitude !== undefined && body.latitude !== null ? Number(body.latitude) : null,
              current_lng: body.longitude !== undefined && body.longitude !== null ? Number(body.longitude) : null,
              referred_by: referrerId,
              created_at: now,
              updated_at: now,
            },
            { transaction },
          );
        }

        // Ensure active role assignment exists in role_assignments table (PostgreSQL $1 placeholders)
        const existingRaRows = await this.DataBase.query(
          `SELECT id FROM role_assignments WHERE user_id = $1 AND role_id = $2 LIMIT 1`,
          [userId, roleId]
        );

        if (!existingRaRows?.length) {
          await this.Data.insert(
            'role_assignments',
            {
              id: Date.now() + Math.floor(Math.random() * 1000),
              user_id: userId,
              role_id: roleId,
              is_active: 1,
              created_at: now,
              updated_at: now,
            },
            { transaction },
          );
        }

        // Insert referral row when DP signed up with a referral code
        if (referrerId) {
          try {
            const referId = generateId('REF', 8);
            const refCode = body.referral_code ? body.referral_code.trim().toUpperCase() : 'F2HREF';
            const refereeName = [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || body.name || 'Delivery Partner';
            const refereePhone = body.phone || (body as any).contact_number || '';

            // Check if referring user is a DP via PostgreSQL
            const dpReferrerRows = await this.DataBase.query(
              `SELECT delivery_partner_id FROM delivery_partners WHERE delivery_partner_id = $1 LIMIT 1`,
              [referrerId],
            );
            const isDpRef = dpReferrerRows?.length > 0;

            await this.Data.insert(
              'referrals',
              {
                refer_id: referId,
                referrer_customer_id: referrerId,
                referred_customer_id: userId,
                referral_code: refCode,
                referrer_reward_amount: isDpRef ? 75.00 : 50.00,
                referred_reward_amount: isDpRef ? 0.00 : 50.00,
                status: 'pending',
                remarks: isDpRef ? 'DP referral registered - ₹75 for DP on 1st delivered order' : 'Referral registered - pending first delivered order',
                created_at: now,
                updated_at: now,
              },
              { transaction },
            );
          } catch (refErr) {
            console.error('[AuthService] Failed to insert DP referral record:', refErr);
          }
        }
      }
    });

    if (email) {
      try {
        const name = (firstName || userName || 'User').trim();
        await this.mailService.sendWelcomeEmail(email, name);
      } catch (err) {
        this.developer.error(`Failed to send welcome email to ${email}`, { err });
      }
    }

    try {
      const name = (body.first_name || body.user_name || 'User').trim();
      await this.notificationService.sendNotification({
        recipientIds: [userId],
        title: 'Welcome to F2H Fresh! 🎉',
        message: `Hi ${name}, welcome to F2H Fresh! Your account has been created successfully.`,
        type: 'success',
      });
    } catch (err) {
      this.developer.error(`Failed to send welcome notification to user ${userId}`, { err });
    }

    return {
      message: 'Registration successful',
      userId,
    };
  }

  async findReferrer(code: string): Promise<any> {
    if (!code || !code.trim()) return null;
    const cleanCode = code.trim().toUpperCase();

    const generalInviteCodes = ['APP INVITE', 'APPINVITE', 'APP-INVITE', 'INVITE', 'APP', 'APP_INVITE', 'F2HREF'];
    if (generalInviteCodes.includes(cleanCode)) {
      return {
        user_id: 'APP_INVITE_GENERAL',
        customer_id: 'APP_INVITE_GENERAL',
      };
    }

    // 1. Search by referral_code in customers (only valid columns: referral_code, customer_id)
    const noHyphen = cleanCode.replace(/-/g, '');
    const withHyphen = noHyphen.startsWith('F2H') && noHyphen.length > 3 ? 'F2H-' + noHyphen.substring(3) : cleanCode;
    const variations = Array.from(new Set([cleanCode, noHyphen, withHyphen]));

    for (const vCode of variations) {
      const res = await this.Data.query('customers', {
        where: [{ column: 'referral_code', operator: '=', value: vCode }],
        limit: 1,
      });
      if (res?.data?.length) return res.data[0];
    }

    // 2. Search by customer_id in customers
    const custByIdRes = await this.Data.query('customers', {
      where: [{ column: 'customer_id', operator: '=', value: code.trim() }],
      limit: 1,
    });
    if (custByIdRes?.data?.length) return custByIdRes.data[0];

    // 3. Search by referral_code, user_id, phone, email in users
    for (const field of ['referral_code', 'user_id', 'phone', 'email']) {
      const res = await this.Data.query('users', {
        where: [{ column: field, operator: '=', value: code.trim() }],
        limit: 1,
      });
      if (res?.data?.length) return res.data[0];
    }

    // 4. Fallback for phone-suffix referral codes — search users by phone last digits
    const digitsOnly = cleanCode.replace(/\D/g, '');
    if (digitsOnly.length >= 3) {
      const lastDigits = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : digitsOnly;
      const phoneMatch = await this.DataBase.query(
        `SELECT user_id, referral_code FROM users WHERE phone LIKE $1 LIMIT 1`,
        [`%${lastDigits}`]
      );
      if (phoneMatch?.length) return phoneMatch[0];
    }

    // 5. Create a placeholder customer row for legacy referral codes not yet in the system
    if (cleanCode.length >= 3 && cleanCode.startsWith('F2H')) {
      const newCustId = `USER_${cleanCode}`;

      const existing = await this.Data.query('customers', {
        where: [{ column: 'customer_id', operator: '=', value: newCustId }],
        limit: 1,
      });
      if (existing?.data?.length) return existing.data[0];

      const custData = {
        customer_id: newCustId,
        referral_code: cleanCode,
        referral_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      try {
        await this.Data.insert('customers', custData);
      } catch (error) {
        // The caller only needs the referral code back; a duplicate customer row is
        // the expected failure here. Anything else should still be visible.
        this.developer.warn('Customer row creation during referral setup failed', {
          customerId: newCustId,
          error,
        });
      }
      return custData;
    }

    return null;
  }
  private getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c; // Earth radius in km
  }

  /*===============================================================================================
    OTP flow and helpers:
   ================================================================================================*/

  async requestMobileOtp(body: SendOtpDto) {
    const { phone, email, purpose } = body;
    if (!phone && !email) {
      throw new BadRequestException('Phone number or email is required');
    }

    if (purpose === 'registration' || !purpose) {
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        const existingEmailUser = await this.Data.query('users', {
          select: ['user_id', 'email', 'password', 'account_status'],
          where: [{ column: 'email', operator: '=', value: normalizedEmail }],
          limit: 1,
        });
        const found = existingEmailUser?.data?.[0];
        if (found && found.password && !found.password.startsWith('temp_') && found.account_status !== 'pending_verification') {
          throw new ConflictException('Email address is already registered. Please sign in instead.');
        }
      }

      if (phone) {
        const trimmedPhone = phone.trim();
        const existingPhoneUser = await this.Data.query('users', {
          select: ['user_id', 'phone', 'password', 'account_status'],
          where: [{ column: 'phone', operator: '=', value: trimmedPhone }],
          limit: 1,
        });
        const found = existingPhoneUser?.data?.[0];
        if (found && found.password && !found.password.startsWith('temp_') && found.account_status !== 'pending_verification') {
          throw new ConflictException('Phone number is already registered. Please sign in instead.');
        }
      }
    }


    const identifier = phone || email!;
    const rateCheck = await this.otpRateLimitService.checkRequestLimit(identifier);
    if (!rateCheck.allowed) {
      throw new BadRequestException(rateCheck.reason);
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const redisKey = CACHE_KEYS.AUTH_MOBILE_OTP(identifier);
    await this.redisService.put(redisKey, otp, CACHE_TTL.FIFTEEN_MINUTES);

    // Opens the resend cooldown and advances the lockout tiers. Without this the
    // limiter read state that nothing ever wrote, so it never triggered.
    await this.otpRateLimitService.recordRequestAttempt(identifier);

    if (email) {
      // Awaited, not fire-and-forget: the previous version reported "OTP sent"
      // even when SMTP rejected the credentials, so a misconfigured mailbox was
      // indistinguishable from a delivered code.
      try {
        await this.mailService.sendRegistrationOtp(email, otp);
      } catch (err) {
        this.developer.error(`Failed to send registration OTP email to ${email}`, { err });
        throw new ServiceUnavailableException(
          'We could not send the verification email right now. Please try again shortly.',
        );
      }
      return {
        message: 'OTP sent to your email',
        ttl: CACHE_TTL.FIFTEEN_MINUTES,
        resend_available_in: this.otpRateLimitService.resendCooldownSeconds,
      };
    }

    return {
      message: 'OTP sent to your phone',
      ttl: CACHE_TTL.FIFTEEN_MINUTES,
      resend_available_in: this.otpRateLimitService.resendCooldownSeconds,
    };
  }

  async verifyMobileOtp(body: VerifyOtpDto, ip?: string) {
    const { phone, email, otp } = body;
    if (!phone && !email) {
      throw new BadRequestException('Phone number or email is required');
    }

    const identifier = phone || email!;
    const redisKey = CACHE_KEYS.AUTH_MOBILE_OTP(identifier);
    const storedOtp = await this.redisService.fetch(redisKey);

    if (!storedOtp || String(storedOtp) !== otp) {
      // Recorded so repeated wrong guesses trip the 5-failure lockout. Nothing
      // was counting these before, which left the code brute-forceable within
      // its 15-minute window.
      await this.otpRateLimitService.recordVerificationAttempt(identifier, false, ip);
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.otpRateLimitService.recordVerificationAttempt(identifier, true, ip);

    let user: any = null;
    if (phone) {
      const phoneRes = await this.Data.query('users', {
        select: ['user_id', 'email', 'phone', 'role_id'],
        where: [{ column: 'phone', operator: '=', value: phone.trim() }],
        limit: 1,
      });
      user = phoneRes?.data?.[0];
    } else if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRes = await this.Data.query('users', {
        select: ['user_id', 'email', 'phone', 'role_id'],
        where: [{ column: 'email', operator: '=', value: normalizedEmail }],
        limit: 1,
      });
      user = emailRes?.data?.[0];
    }

    const incomingFcmToken = body.fcm_token || (body as any).fcmToken;

    if (!user) {
      const userId = generateId('USER', 20);
      const temporaryPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
      const now = new Date();

      const userInsertData: any = {
        user_id: userId,
        phone: phone || null,
        email: email || null,
        password: hashedPassword,
        role_id: 'CUSTOMER',
        created_at: now,
        updated_at: now,
      };
      if (incomingFcmToken) {
        userInsertData.fcm_token = incomingFcmToken;
      }

      await this.Data.insert('users', userInsertData);

      try {
        const cleanName = (email ? email.split('@')[0] : 'USR').replace(/[^a-zA-Z]/g, '').toUpperCase();
        const prefix = cleanName.length >= 3 ? cleanName.slice(0, 3) : 'USR';
        const phoneDigits = (phone || '').replace(/\D/g, '');
        const suffix = phoneDigits.length >= 3 ? phoneDigits.slice(-3) : Math.floor(100 + Math.random() * 900).toString();
        const generatedRefCode = `F2H${prefix}${suffix}`;

        // Insert only valid customers table columns (no first_name/last_name/phone/email/mobile)
        const customerInsertData: any = {
          customer_id: userId,
          referral_code: generatedRefCode,
          referral_status: 'locked',
          created_at: now,
          updated_at: now,
        };
        await this.Data.insert('customers', customerInsertData);

        // Store referral_code in users table for unified lookup
        await this.Data.update(
          'users',
          { referral_code: generatedRefCode, updated_at: now },
          [{ column: 'user_id', operator: '=', value: userId }],
        );
      } catch (custErr) {
        console.error('[AuthService] Auto customer record creation failed during OTP verify:', custErr);
      }

      user = {
        user_id: userId,
        phone: phone || null,
        email: email || null,
        role_id: 'CUSTOMER',
      };
    } else {
      const isSatelliteActive = await this.checkSatelliteIsActive(user.user_id, user.role_id || 'CUSTOMER');
      if (!isSatelliteActive) {
        throw new UnauthorizedException('Your account is inactive. Please contact support.');
      }
      if (incomingFcmToken) {
        await this.updateFcmToken(user.user_id, incomingFcmToken);
      }
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationKey = `otp_verified:${verificationToken}`;
    await this.redisService.put(
      verificationKey,
      JSON.stringify({
        phone: phone || null,
        email: email || null,
        purpose: (body as any).purpose || 'registration',
      }),
      CACHE_TTL.FIFTEEN_MINUTES,
    );

    await this.redisService.forget(redisKey);
    await this.otpRateLimitService.resetLimits(identifier);

    return {
      message: 'OTP verified successfully',
      verification_token: verificationToken,
      user,
    };
  }

  async consumeVerifiedOtp(token: string, identifier: string, purpose?: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const verificationKey = `otp_verified:${token}`;
    const data = await this.redisService.fetch(verificationKey);

    if (!data) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    let parsed: any;
    try {
      parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      throw new BadRequestException('Invalid verification token format');
    }

    const normalizedContact = (identifier || '').toLowerCase().trim();
    const storedEmail = (parsed.email || '').toLowerCase().trim();
    const storedPhone = (parsed.phone || '').trim();

    const matchesEmail = storedEmail && storedEmail === normalizedContact;
    const matchesPhone = storedPhone && storedPhone === normalizedContact;

    if (!matchesEmail && !matchesPhone) {
      this.logger.log(
        `[AuthService:consumeVerifiedOtp] Verification token mismatch. Stored email: "${storedEmail}", stored phone: "${storedPhone}", expected contact: "${normalizedContact}"`,
      );
      throw new BadRequestException('Verification token does not match contact');
    }

    await this.redisService.forget(verificationKey);
    return true;
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    if (!fcmToken || fcmToken === 'fcmToken' || fcmToken === 'fcmtoken' || fcmToken === 'null' || fcmToken === 'undefined') return;

    const now = new Date();
    try {
      await this.Data.update('users', { fcm_token: fcmToken, updated_at: now }, [
        { column: 'user_id', operator: '=', value: userId },
      ]);
    } catch (err) {
      console.error('[AuthService:updateFcmToken] Failed to update fcm_token in users table:', err);
    }
  }

  /*===============================================================================================
    Session verification and lookup:
   ================================================================================================*/

  private hashValue(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private async storeDeviceSession(data: {
    userId: string;
    refreshJti: string;
    refreshToken: string;
    deviceId?: string | null;
    fcmToken?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await this.DataBase.query(
      `INSERT INTO device_sessions
       (id, user_id, refresh_jti, refresh_token_hash, device_id, fcm_token,
        ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '100 years')`,
      [
        crypto.randomUUID(),
        data.userId,
        data.refreshJti,
        this.hashValue(data.refreshToken),
        data.deviceId || null,
        data.fcmToken || null,
        data.ipAddress || null,
        data.userAgent || null,
      ],
    );
  }

  private async revokeStoredSession(refreshJti: string) {
    await this.DataBase.query(
      `UPDATE device_sessions SET revoked_at = now()
       WHERE refresh_jti = $1 AND revoked_at IS NULL`,
      [refreshJti],
    );
  }

  async verifyAndValidateRefreshToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const { jti, sub: user_id, email } = decoded;
      const userPrefix = user_id
        ? `f2h_user_jwt_${user_id}`
        : `f2h_user_jwt_email_${email}`;

      try {
        const sessionData = await this.redisService.fetch(userPrefix);
        if (!sessionData) {
          throw new UnauthorizedException('Token has been revoked');
        }

        const parsed = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        const sessionExists = parsed.sessions?.some((session: any) => session.refreshJti === jti);

        if (!sessionExists) {
          throw new UnauthorizedException('Token has been revoked');
        }

        const storedSessions = await this.DataBase.query(
          `SELECT id FROM device_sessions
           WHERE refresh_jti = $1 AND refresh_token_hash = $2
             AND revoked_at IS NULL
           LIMIT 1`,
          [jti, this.hashValue(token)],
        );
        if (!storedSessions.length) {
          throw new UnauthorizedException('Token has been revoked');
        }
      } catch (parseError) {
        throw new UnauthorizedException('Token validation failed - token revoked or invalid');
      }

      return { email, user_id };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }


  async generateTokens(
    payload: { user_id: string; email: string | null; role_id: string; device_id?: string | null },
    meta: { fcmToken?: string; ipAddress?: string; userAgent?: string } = {},
  ) {
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessTokenExpiry = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    ) as SignOptions['expiresIn'];
    const refreshTokenExpiry = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '30d',
    ) as SignOptions['expiresIn'];
    const refreshTokenLifetimeSeconds = parseDurationToSeconds(String(refreshTokenExpiry));
    const accessTokenLifetimeSeconds = parseDurationToSeconds(String(accessTokenExpiry));

    const accessToken = this.jwtService.sign(
      {
        sub: payload.user_id,
        email: payload.email,
        role: payload.role_id,
        jti: accessJti,
        device_id: payload.device_id,
      },
      { expiresIn: accessTokenExpiry },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: payload.user_id,
        jti: refreshJti,
        access_jti: accessJti,
        device_id: payload.device_id,
      },
      { expiresIn: refreshTokenExpiry },
    );

    const userPrefix = payload.user_id
      ? `f2h_user_jwt_${payload.user_id}`
      : `f2h_user_jwt_email_${payload.email}`;

    // Save session in Redis
    try {
      const now = Date.now();

      const existing = await this.redisService.fetch(userPrefix);
      const sessionData = existing
        ? typeof existing === 'string'
          ? JSON.parse(existing)
          : existing
        : { sessions: [] };

      // Add new paired session
      sessionData.sessions.push({
        accessJti,
        refreshJti,
        createdAt: now,
        lastUsed: now,
        accessTokenExpiresAt: now + accessTokenLifetimeSeconds * 1000,
        refreshTokenExpiresAt: now + refreshTokenLifetimeSeconds * 1000,
      });

      // Drop sessions whose refresh token has already expired, then cap the list.
      sessionData.sessions = sessionData.sessions
        .filter((session: any) => (session.refreshTokenExpiresAt ?? 0) > now)
        .slice(-100);

      // The registry outlives the longest refresh token by a small margin and no
      // more: a 100-year TTL made every leaked token a permanent credential.
      await this.redisService.put(
        userPrefix,
        JSON.stringify(sessionData),
        refreshTokenLifetimeSeconds,
      );

      await this.storeDeviceSession({
        userId: payload.user_id,
        refreshJti,
        refreshToken,
        deviceId: payload.device_id,
        fcmToken: meta.fcmToken,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      this.auditLogger.logTokenOperation({
        operation: 'GENERATED',
        userId: payload.user_id,
        email: payload.email || undefined,
        jtis: { access: accessJti, refresh: refreshJti },
        ip: meta.ipAddress,
      });
    } catch (error) {
      console.error(
        `[Auth:generateTokens] ❌ Critical: Failed to store session data:`,
        error,
      );
    }

    return { accessToken, refreshToken };
  }


  async refreshTokens(refreshToken: string) {
    const validated = await this.verifyAndValidateRefreshToken(refreshToken);
    const decoded = this.jwtService.verify(refreshToken);
    const oldRefreshJti = decoded.jti;
    const userId = validated.user_id;

    await this.revokeStoredSession(oldRefreshJti);

    const newTokens = await this.generateTokens({
      email: validated.email,
      user_id: validated.user_id,
      role_id: decoded.role || 'CUSTOMER',
      device_id: decoded.device_id,
    });

    // Revoke from Redis session list
    try {
      const userPrefix = `f2h_user_jwt_${userId}`;
      const sessionData = await this.redisService.fetch(userPrefix);

      if (sessionData) {
        const parsed = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        const oldSessionIndex = parsed.sessions.findIndex((session: any) => session.refreshJti === oldRefreshJti);

        if (oldSessionIndex !== -1) {
          parsed.sessions = parsed.sessions.filter((_s: any, idx: number) => idx !== oldSessionIndex);
          await this.redisService.put(
            userPrefix,
            JSON.stringify(parsed),
            parseDurationToSeconds(
              this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
            ),
          );
        }
      }
    } catch (error) {
      console.error('[Auth:refreshTokens] Error revoking old session in Redis:', error);
    }

    return newTokens;
  }

  async findUserByEmail(email: string) {
    const userResult = await this.Data.query('users', {
      select: ['user_id', 'email', 'role_id'],
      where: [{ column: 'email', operator: '=', value: email.toLowerCase().trim() }],
      limit: 1,
    });
    return userResult?.data?.[0] || null;
  }

  async findUserById(userId: string) {
    const userResult = await this.Data.query('users', {
      select: ['user_id', 'email', 'role_id'],
      where: [{ column: 'user_id', operator: '=', value: userId }],
    });
    const user = userResult?.data?.[0];
    return user || null;
  }

  async getUsersByRole(roleId: string) {
    if (!roleId) {
      throw new UnauthorizedException('Role ID query parameter is required');
    }

    const users = await this.Data.query('users', {
      select: ['user_id'],
      where: [
        { column: 'role_id', operator: '=', value: roleId },
        { column: 'deleted_at', operator: 'IS', value: null },
      ],
    });
    return {
      success: true,
      role: roleId,
      user_ids: (users?.data || []).map((u: any) => u.user_id),
    };
  }

  /*===============================================================================================
    Forgot Password & Reset Password Flow:
   ================================================================================================*/

  async forgotPassword(identifierInput: string, clientRole?: string) {
    if (!identifierInput || !identifierInput.trim()) {
      throw new BadRequestException('Email or phone number is required');
    }

    const rawIdentifier = identifierInput.trim();
    const formattedIdentifier = rawIdentifier.toLowerCase();
    const selectCols = ['user_id', 'email', 'phone', 'user_name', 'role_id'];
    let user: any = null;

    const emailRes = await this.Data.query('users', {
      select: selectCols,
      where: [{ column: 'email', operator: '=', value: formattedIdentifier }],
      limit: 1,
    });
    if (emailRes?.data?.length) user = emailRes.data[0];

    if (!user) {
      const phoneRes = await this.Data.query('users', {
        select: selectCols,
        where: [{ column: 'phone', operator: '=', value: rawIdentifier }],
        limit: 1,
      });
      if (phoneRes?.data?.length) user = phoneRes.data[0];
    }

    if (!user) {
      const usernameRes = await this.Data.query('users', {
        select: selectCols,
        where: [{ column: 'user_name', operator: '=', value: formattedIdentifier }],
        limit: 1,
      });
      if (usernameRes?.data?.length) user = usernameRes.data[0];
    }

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    // Role validation if clientRole is supplied
    if (clientRole) {
      const uRole = (user.role_id || '').toUpperCase().trim();
      const cRole = clientRole.toUpperCase().trim();
      let isAllowed = false;
      switch (cRole) {
        case 'CUSTOMER':
          // All registered users can reset password on Customer app
          isAllowed = true;
          break;
        case 'DELIVERY_PARTNER':
          isAllowed = ['DELIVERY_PARTNER', 'ADMIN', 'SUPER_ADMIN'].includes(uRole);
          break;
        case 'ADMIN':
          isAllowed = !['CUSTOMER', 'DELIVERY_PARTNER'].includes(uRole);
          break;
        default:
          isAllowed = true;
      }


      if (!isAllowed) {
        throw new NotFoundException('User does not exist');
      }
    }

    // Rate limit check & OTP generation
    const targetKey = (user.email || user.phone || formattedIdentifier).toLowerCase().trim();
    const rateCheck = await this.otpRateLimitService.checkRequestLimit(targetKey);
    if (!rateCheck.allowed) {
      throw new BadRequestException(rateCheck.reason);
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const redisKey = CACHE_KEYS.AUTH_MOBILE_OTP(targetKey);
    await this.redisService.put(redisKey, otp, CACHE_TTL.FIFTEEN_MINUTES);

    await this.otpRateLimitService.recordRequestAttempt(targetKey);

    if (user.email) {
      try {
        await this.mailService.sendForgotPasswordOtp(user.email, otp);
      } catch (err) {
        this.developer.error(`Failed to send forgot password OTP email to ${user.email}`, { err });
        throw new ServiceUnavailableException(
          'We could not send the reset email right now. Please try again shortly.',
        );
      }
    }

    // The OTP is deliberately absent from this response. It used to be included
    // "for debug", which let anyone request a reset code for any account and read
    // it straight out of the HTTP response.
    return {
      message: user.email
        ? 'Password reset OTP sent to your email'
        : 'Password reset OTP sent to your phone',
      ttl: CACHE_TTL.FIFTEEN_MINUTES,
      resend_available_in: this.otpRateLimitService.resendCooldownSeconds,
    };
  }

  async resetPassword(body: {
    email?: string;
    phone?: string;
    identifier?: string;
    token?: string;
    otp?: string;
    newPassword?: string;
    password?: string;
  }) {
    const rawIdentifier = body.email || body.phone || body.identifier;
    const inputToken = body.token || body.otp;
    const newPassword = body.newPassword || body.password;

    if (!rawIdentifier || !inputToken || !newPassword) {
      throw new BadRequestException('Identifier, OTP/token, and new password are required');
    }

    const targetKey = rawIdentifier.toLowerCase().trim();
    let isVerified = false;

    // 1. Check if inputToken is a verification token generated by verifyMobileOtp (otp_verified:<token>)
    const verificationKey = `otp_verified:${inputToken.trim()}`;
    const verifiedData = await this.redisService.fetch(verificationKey);

    if (verifiedData) {
      isVerified = true;
      await this.redisService.forget(verificationKey);
    } else {
      // 2. Check if inputToken is direct 6-digit OTP in Redis
      const redisKey = CACHE_KEYS.AUTH_MOBILE_OTP(targetKey);
      const storedOtp = await this.redisService.fetch(redisKey);

      if (storedOtp && String(storedOtp).trim() === String(inputToken).trim()) {
        isVerified = true;
        await this.redisService.forget(redisKey);
      }
    }

    if (!isVerified) {
      throw new UnauthorizedException('Invalid or expired OTP / reset token');
    }

    const formattedIdentifier = targetKey;
    const selectCols = ['user_id', 'email', 'phone', 'user_name'];
    let user: any = null;

    const emailRes = await this.Data.query('users', {
      select: selectCols,
      where: [{ column: 'email', operator: '=', value: formattedIdentifier }],
      limit: 1,
    });
    if (emailRes?.data?.length) user = emailRes.data[0];

    if (!user) {
      const phoneRes = await this.Data.query('users', {
        select: selectCols,
        where: [{ column: 'phone', operator: '=', value: rawIdentifier }],
        limit: 1,
      });
      if (phoneRes?.data?.length) user = phoneRes.data[0];
    }

    if (!user) {
      const usernameRes = await this.Data.query('users', {
        select: selectCols,
        where: [{ column: 'user_name', operator: '=', value: formattedIdentifier }],
        limit: 1,
      });
      if (usernameRes?.data?.length) user = usernameRes.data[0];
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.Data.update(
      'users',
      {
        password: hashedPassword,
        must_change_password: 0,
        updated_at: new Date(),
      },
      [{ column: 'user_id', operator: '=', value: user.user_id }],
    );

    if (user.email) {
      this.mailService.sendPasswordChangedAlert(user.email).catch((err) => {
        this.developer.error(`Failed to send password changed alert to ${user.email}`, { err });
      });
    }

    return { message: 'Password reset successful' };
  }

  /**
   * Signs a user in from an identity Google has already verified.
   *
   * The caller (`AuthController`) is responsible for that verification — this
   * method must never be handed an email that came from a request body, or
   * anyone could mint a session for any account.
   *
   * @param identity Signature-verified Google profile.
   * @param options  `fcmToken` for push, and `role` used *only* when creating a
   *                 brand-new account. Existing users keep their stored role.
   */
  async googleLogin(
    identity: { email: string; name?: string; googleId: string },
    options: { fcmToken?: string; role?: string } = {},
  ) {
    const email = identity.email?.toLowerCase().trim();
    if (!email) throw new BadRequestException('Email is required for Google Sign-In');

    // Roles are never accepted from a client. Anything outside this list — most
    // importantly ADMIN and SUPER_ADMIN — falls back to a plain customer.
    const SELF_SERVICE_ROLES: string[] = [ROLE.CUSTOMER, ROLE.DELIVERY_PARTNER];
    const requestedRole = options.role?.toUpperCase().trim();
    const signupRole =
      requestedRole && SELF_SERVICE_ROLES.includes(requestedRole) ? requestedRole : ROLE.CUSTOMER;

    const allUsersResult = await this.Data.query('users', {
      where: [{ column: 'email', operator: '=', value: email.toLowerCase().trim() }],
      limit: 1,
    });
    let user = allUsersResult?.data?.[0];

    if (!user) {
      const userId = `USER${Date.now().toString(36).toUpperCase()}`;
      const roleId = signupRole;
      await this.Data.insert('users', {
        user_id: userId,
        email: email.toLowerCase().trim(),
        first_name: identity.name || email.split('@')[0],
        role_id: roleId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      if (roleId === ROLE.CUSTOMER) {
        try {
          const now = new Date();
          const activeBranchRes = await this.Data.query('branches', {
            select: ['branch_id'],
            where: [{ column: 'is_active', operator: '=', value: true }],
            limit: 1,
          });
          const targetBranchId = activeBranchRes?.data?.[0]?.branch_id || null;

          await this.Data.insert('customers', {
            customer_id: userId,
            first_name: identity.name || email.split('@')[0],
            last_name: '',
            mobile: null,
            phone: null,
            email: email.toLowerCase().trim(),
            branch_id: targetBranchId,
            created_at: now,
            updated_at: now,
          });
        } catch (custErr) {
          console.error('[AuthService] Auto customer record creation failed during Google login:', custErr);
        }
      }

      user = { user_id: userId, email: email.toLowerCase().trim(), role_id: roleId };
    } else {
      const isSatelliteActive = await this.checkSatelliteIsActive(user.user_id, user.role_id || 'CUSTOMER');
      if (!isSatelliteActive) {
        throw new UnauthorizedException('Your account is inactive. Please contact support.');
      }
    }

    if (options.fcmToken) {
      await this.updateFcmToken(user.user_id, options.fcmToken);
    }

    const { accessToken, refreshToken } = await this.generateTokens({
      user_id: user.user_id,
      email: user.email,
      role_id: user.role_id,
    });

    return {
      message: 'Google login successful',
      user: { user_id: user.user_id, email: user.email, role_id: user.role_id },
      accessToken,
      refreshToken,
    };
  }

  private async generateUniqueRefCode(firstName?: string | null, phone?: string | null): Promise<string> {
    const cleanName = (firstName || 'USR').replace(/[^a-zA-Z]/g, '').toUpperCase();
    const prefix = cleanName.length >= 3 ? cleanName.slice(0, 3) : 'USR';
    const phoneDigits = (phone || '').replace(/\D/g, '');
    const suffix = phoneDigits.length >= 3 ? phoneDigits.slice(-3) : Math.floor(100 + Math.random() * 900).toString();

    let code = `F2H${prefix}${suffix}`;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      try {
        const checkRes: any = await this.DataBase.query(
          `SELECT customer_id FROM customers WHERE UPPER(referral_code) = $1 LIMIT 1`,
          [code.toUpperCase()],
        );
        const rows = Array.isArray(checkRes) ? checkRes : (checkRes?.rows || []);
        if (rows.length === 0) {
          isUnique = true;
        } else {
          attempts++;
          const extra = Math.floor(10 + Math.random() * 90).toString();
          code = `F2H${prefix}${suffix}${extra}`;
        }
      } catch (_) {
        break;
      }
    }
    return code;
  }
}
