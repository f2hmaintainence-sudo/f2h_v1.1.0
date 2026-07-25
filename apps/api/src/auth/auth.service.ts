import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
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
import { RegisterDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { FieldEncryptionService } from 'src/encryption/field-encryption.service';

@Injectable()
export class AuthService {
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
  ) { }

  /*===============================================================================================
    Login & Validation Flow:
   ================================================================================================*/

  async validateUser(
    identifier: string,
    password: string,
    requestedRole?: string,
    ip?: string,
    userAgent?: string,
    fingerprintData?: any,
  ) {
    const formattedIdentifier = identifier.toLowerCase().trim();

    const allUsersResult = await this.Data.query('users', {
      select: [
        'user_id',
        'email',
        'password',
        'locked_at',
        'max_logins',
        'user_name',
        'phone',
        'must_change_password',
        'role_id',
      ],
    });
    const allUsers = allUsersResult?.data ?? [];

    let user = allUsers.find(
      (u: any) =>
        u.email && u.email.toLowerCase().trim() === formattedIdentifier,
    );
    if (!user) {
      user = allUsers.find(
        (u: any) =>
          u.user_name &&
          u.user_name.toLowerCase().trim() === formattedIdentifier,
      );
    }
    if (!user) {
      user = allUsers.find(
        (u: any) => u.phone && u.phone.trim() === identifier.trim(),
      );
    }

    if (!user) {
      this.developer.debug('[Auth:validateUser] Login failed - user not found', {
        identifier: formattedIdentifier,
        ip: ip || 'unknown',
        totalUsersChecked: allUsers.length,
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
    if (user.locked_at) {
      const lockoutDuration = 30 * 60 * 1000; // 30 minutes
      if (
        new Date().getTime() - new Date(user.locked_at).getTime() <
        lockoutDuration
      ) {
        const remainingTime = Math.ceil(
          (lockoutDuration -
            (new Date().getTime() - new Date(user.locked_at).getTime())) /
          60000,
        );

        this.auditLogger.logAccountLockout({
          userId: user.user_id,
          email: user.email,
          ip: ip || 'unknown',
          reason: 'Account locked - multiple failed attempts',
        });

        throw new ForbiddenException(
          `Account is locked due to multiple failed login attempts. Please try again in ${remainingTime} minutes.`,
        );
      } else {
        // Unlock account after lockout duration has passed
        await this.Data.update(
          'users',
          { locked_at: null },
          [{ column: 'user_id', operator: '=', value: user.user_id }],
        );
      }
    }

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
    console.log("data ", body);
    if (!email && !phone) {
      throw new BadRequestException('Email and phone is required');
    }

    // Verify OTP for customer registrations first
    if (roleId === 'CUSTOMER') {
      if (!body.verification_token) {
        throw new BadRequestException('Verification token is required');
      }
      await this.consumeVerifiedOtp(body.verification_token, email || phone!, 'registration');
    }

    // Check existing users
    const allUsersResult = await this.Data.query('users', {
      select: ['user_id', 'email', 'phone'],
    });
    const existingUsers = allUsersResult?.data ?? [];

    let existingUser: any = null;
    if (email) {
      existingUser = existingUsers.find((u: any) => u.email && u.email.toLowerCase().trim() === email);
    }
    if (!existingUser && phone) {
      existingUser = existingUsers.find((u: any) => u.phone && u.phone.trim() === phone);
    }

    // If user exists and no verification token was supplied, reject duplicate registration
    if (existingUser && !body.verification_token) {
      if (email && existingUser.email?.toLowerCase().trim() === email) {
        throw new BadRequestException('Email already registered');
      }
      if (phone && existingUser.phone?.trim() === phone) {
        throw new BadRequestException('Phone already registered');
      }
    }

    const userId = existingUser ? existingUser.user_id : generateId('USER', 10);
    const hashedPassword = body.password
      ? await bcrypt.hash(body.password, 12)
      : crypto.randomUUID();

    await this.Data.executeTransaction(async (transaction) => {
      if (existingUser) {
        // Update placeholder user created during OTP verification
        await this.Data.update(
          'users',
          {
            email,
            phone,
            user_name: body.user_name || email?.split('@')[0] || phone,
            first_name: body.first_name || '',
            last_name: body.last_name || '',
            fcm_token: body.fcm_token,
            password: hashedPassword,
            role_id: roleId,
            updated_at: now,
          },
          [{ column: 'user_id', operator: '=', value: userId }],
          { transaction },
        );
      } else {
        const userResult = await this.Data.insert(
          'users',
          {
            user_id: userId,
            email,
            phone,
            user_name: body.user_name || email?.split('@')[0] || phone,
            first_name: body.first_name || '',
            last_name: body.last_name || '',
            fcm_token: body.fcm_token,
            password: hashedPassword,
            role_id: roleId,
            created_at: now,
            updated_at: now,
          },
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

        if (existingCust?.data?.length > 0) {
          await this.Data.update(
            'customers',
            {
              first_name: body.first_name || body.user_name || 'Customer',
              last_name: body.last_name || '',
              mobile: phone || '',
              email: email || null,
              updated_at: now,
            },
            [{ column: 'customer_id', operator: '=', value: userId }],
            { transaction },
          );
        } else {
          await this.Data.insert(
            'customers',
            {
              customer_id: userId,
              first_name: body.first_name || body.user_name || 'Customer',
              last_name: body.last_name || '',
              phone: phone || '',
              email: email || null,
              created_at: now,
              updated_at: now,
            },
            { transaction },
          );
        }
      }

      // Delivery Partner specific initialization
      if (roleId === 'DELIVERY_PARTNER' || roleId === 'DELIVERY_BOY') {
        let selectedBranchId = body.branch_id;
        if (!selectedBranchId && body.latitude !== undefined && body.longitude !== undefined) {
          const branchesRes = await this.Data.query('branches', {
            where: [{ column: 'is_active', operator: '=', value: true }],
          });
          const branches = branchesRes?.data ?? [];
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

        const existingDp = await this.Data.query('delivery_partners', {
          where: [{ column: 'delivery_partner_id', operator: '=', value: userId }],
          limit: 1,
        });

        if (existingDp?.data?.length > 0) {
          await this.Data.update(
            'delivery_partners',
            {
              full_name: `${body.first_name || ''} ${body.last_name || ''}`.trim() || body.user_name || 'Partner',
              phone: phone || '',
              email: email || null,
              branch_id: selectedBranchId || 'BRANCH_DEFAULT',
              updated_at: now,
            },
            [{ column: 'delivery_partner_id', operator: '=', value: userId }],
            { transaction },
          );
        } else {
          await this.Data.insert(
            'delivery_partners',
            {
              delivery_partner_id: userId,
              full_name: `${body.first_name || ''} ${body.last_name || ''}`.trim() || body.user_name || 'Partner',
              phone: phone || '',
              email: email || null,
              branch_id: selectedBranchId || 'BRANCHd8c0WDGS76ii',
              is_active: 1,
              is_verified: 0,
              vehicle_type: 'BIKE',
              vehicle_number: 'N/A',
              created_at: now,
              updated_at: now,
            },
            { transaction },
          );
        }
      }
    });

    if (email) {
      try {
        const name = (body.first_name || body.user_name || 'User').trim();
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
    const { phone, email } = body;
    if (!phone && !email) {
      throw new BadRequestException('Phone number or email is required');
    }

    const identifier = phone || email!;
    const rateCheck = await this.otpRateLimitService.checkRequestLimit(identifier);
    if (!rateCheck.allowed) {
      throw new BadRequestException(rateCheck.reason);
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const redisKey = CACHE_KEYS.AUTH_MOBILE_OTP(identifier);
    await this.redisService.put(redisKey, otp, CACHE_TTL.FIFTEEN_MINUTES);

    this.developer.debug(`[AuthService] Generated OTP for ${identifier}: ${otp}`);

    if (email) {
      try {
        await this.mailService.sendRegistrationOtp(email, otp);
      } catch (err) {
        this.developer.error(`Failed to send registration OTP email to ${email}`, { err });
      }
      return {
        message: 'OTP sent to your email',
        ttl: CACHE_TTL.FIFTEEN_MINUTES,
        otp, // Return for debug
      };
    }

    return {
      message: 'OTP sent to your phone',
      ttl: CACHE_TTL.FIFTEEN_MINUTES,
      otp, // Return for debug
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
      throw new UnauthorizedException('Invalid OTP');
    }

    const allUsersForOtp = await this.Data.query('users', {
      select: ['user_id', 'email', 'phone', 'role_id'],
    });

    let user: any = null;
    if (phone) {
      user = (allUsersForOtp?.data ?? []).find(
        (u: any) => u.phone && u.phone.trim() === phone.trim(),
      );
    } else if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      user = (allUsersForOtp?.data ?? []).find(
        (u: any) => u.email && u.email.toLowerCase().trim() === normalizedEmail,
      );
    }

    if (!user) {
      const userId = generateId('USER', 32);
      const temporaryPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
      const now = new Date();

      await this.Data.insert('users', {
        user_id: userId,
        phone: phone || null,
        email: email || null,
        password: hashedPassword,
        role_id: 'CUSTOMER',
        created_at: now,
        updated_at: now,
      });

      try {
        const cleanName = (email ? email.split('@')[0] : 'USR').replace(/[^a-zA-Z]/g, '').toUpperCase();
        const prefix = cleanName.length >= 3 ? cleanName.slice(0, 3) : 'USR';
        const phoneDigits = (phone || '').replace(/\D/g, '');
        const suffix = phoneDigits.length >= 3 ? phoneDigits.slice(-3) : Math.floor(100 + Math.random() * 900).toString();
        const generatedRefCode = `F2H${prefix}${suffix}`;

        await this.Data.insert('customers', {
          customer_id: userId,
          first_name: email ? email.split('@')[0] : 'Customer',
          last_name: '',
          mobile: phone || ('NO_PHONE_' + userId),
          phone: phone || ('NO_PHONE_' + userId),
          email: email || null,
          branch_id: 'BRANCH_DEFAULT',
          referral_code: generatedRefCode,
          referral_status: 'locked',
          created_at: now,
          updated_at: now,
        });
      } catch (custErr) {
        console.error('[AuthService] Auto customer record creation failed during OTP verify:', custErr);
      }

      user = {
        user_id: userId,
        phone: phone || null,
        email: email || null,
        role_id: 'CUSTOMER',
      };
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationKey = `otp_verified:${verificationToken}`;
    await this.redisService.put(
      verificationKey,
      JSON.stringify({
        phone: phone || null,
        email: email || null,
        purpose: 'registration',
      }),
      CACHE_TTL.FIFTEEN_MINUTES,
    );

    await this.redisService.forget(redisKey);

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
      console.log(
        `[AuthService:consumeVerifiedOtp] Verification token mismatch. Stored email: "${storedEmail}", stored phone: "${storedPhone}", expected contact: "${normalizedContact}"`,
      );
      throw new BadRequestException('Verification token does not match contact');
    }

    await this.redisService.forget(verificationKey);
    return true;
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    return this.Data.update('users', { fcm_token: fcmToken }, [
      { column: 'user_id', operator: '=', value: userId },
    ]);
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, now() + interval '100 years')`,
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
       WHERE refresh_jti = ? AND revoked_at IS NULL`,
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
           WHERE refresh_jti = ? AND refresh_token_hash = ?
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

    const accessTokenExpiry = '100y';
    const refreshTokenExpiry = '100y';

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
      const hundredYearsMs = 100 * 365 * 24 * 60 * 60 * 1000;
      const hundredYearsSeconds = 100 * 365 * 24 * 60 * 60;

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
        accessTokenExpiresAt: now + hundredYearsMs,
        refreshTokenExpiresAt: now + hundredYearsMs,
      });

      // Keep active sessions (up to 100 active sessions per user)
      sessionData.sessions = sessionData.sessions.slice(-100);

      await this.redisService.put(
        userPrefix,
        JSON.stringify(sessionData),
        hundredYearsSeconds,
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
            90 * 24 * 60 * 60,
          );
        }
      }
    } catch (error) {
      console.error('[Auth:refreshTokens] Error revoking old session in Redis:', error);
    }

    return newTokens;
  }

  async findUserByEmail(email: string) {
    const allResult = await this.Data.query('users', {
      select: ['user_id', 'email', 'role_id'],
    });
    const user = (allResult?.data ?? []).find(
      (u: any) =>
        u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim(),
    );
    return user || null;
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

    const formattedIdentifier = identifierInput.toLowerCase().trim();

    // Find user in database by email, phone, or username
    const allUsersResult = await this.Data.query('users', {
      select: ['user_id', 'email', 'phone', 'user_name', 'role_id'],
    });
    const allUsers = allUsersResult?.data ?? [];

    let user = allUsers.find(
      (u: any) => u.email && u.email.toLowerCase().trim() === formattedIdentifier,
    );
    if (!user) {
      user = allUsers.find(
        (u: any) => u.phone && u.phone.trim() === identifierInput.trim(),
      );
    }
    if (!user) {
      user = allUsers.find(
        (u: any) => u.user_name && u.user_name.toLowerCase().trim() === formattedIdentifier,
      );
    }

    if (!user) {
      throw new NotFoundException('User with provided email or phone not found');
    }

    // Role validation if clientRole is supplied
    if (clientRole) {
      const uRole = (user.role_id || '').toUpperCase().trim();
      const cRole = clientRole.toUpperCase().trim();
      let isAllowed = false;
      switch (cRole) {
        case 'CUSTOMER':
          isAllowed = uRole === 'CUSTOMER';
          break;
        case 'DELIVERY_BOY':
        case 'DELIVERY_PARTNER':
          isAllowed = uRole === 'DELIVERY_BOY' || uRole === 'DELIVERY_PARTNER';
          break;
        case 'ADMIN':
          isAllowed = !['CUSTOMER', 'DELIVERY_BOY', 'DELIVERY_PARTNER'].includes(uRole);
          break;
        default:
          isAllowed = true;
      }

      if (!isAllowed) {
        throw new ForbiddenException(`Account is not authorized for ${cRole} application`);
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

    this.developer.debug(`[AuthService:forgotPassword] Generated OTP for ${targetKey}: ${otp}`);

    if (user.email) {
      try {
        await this.mailService.sendForgotPasswordOtp(user.email, otp);
      } catch (err) {
        this.developer.error(`Failed to send forgot password OTP email to ${user.email}`, { err });
      }
    }

    return {
      message: user.email
        ? 'Password reset OTP sent to your email'
        : 'Password reset OTP sent to your phone',
      ttl: CACHE_TTL.FIFTEEN_MINUTES,
      otp,
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

    const allUsersResult = await this.Data.query('users', {
      select: ['user_id', 'email', 'phone', 'user_name'],
    });
    const allUsers = allUsersResult?.data ?? [];

    let user = allUsers.find(
      (u: any) => u.email && u.email.toLowerCase().trim() === targetKey,
    );
    if (!user) {
      user = allUsers.find(
        (u: any) => u.phone && u.phone.trim() === rawIdentifier.trim(),
      );
    }
    if (!user) {
      user = allUsers.find(
        (u: any) => u.user_name && u.user_name.toLowerCase().trim() === targetKey,
      );
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
      try {
        await this.mailService.sendPasswordChangedAlert(user.email);
      } catch (err) {
        this.developer.error(`Failed to send password changed alert to ${user.email}`, { err });
      }
    }

    return { message: 'Password reset successful' };
  }

  async googleLogin(body: { id_token?: string; email?: string; name?: string; fcm_token?: string; role?: string }) {
    const email = body.email;
    if (!email) throw new BadRequestException('Email is required for Google Sign-In');

    const allUsersResult = await this.Data.query('users', {
      where: [{ column: 'email', operator: '=', value: email.toLowerCase().trim() }],
      limit: 1,
    });
    let user = allUsersResult?.data?.[0];

    if (!user) {
      const userId = `USER${Date.now().toString(36).toUpperCase()}`;
      const roleId = body.role || 'CUSTOMER';
      await this.Data.insert('users', {
        user_id: userId,
        email: email.toLowerCase().trim(),
        first_name: body.name || email.split('@')[0],
        role_id: roleId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      if (roleId === 'CUSTOMER') {
        try {
          const now = new Date();
          await this.Data.insert('customers', {
            customer_id: userId,
            first_name: body.name || email.split('@')[0],
            last_name: '',
            mobile: 'NO_PHONE_' + userId,
            phone: 'NO_PHONE_' + userId,
            email: email.toLowerCase().trim(),
            branch_id: 'BRANCH_DEFAULT',
            created_at: now,
            updated_at: now,
          });
        } catch (custErr) {
          console.error('[AuthService] Auto customer record creation failed during Google login:', custErr);
        }
      }

      user = { user_id: userId, email: email.toLowerCase().trim(), role_id: roleId };
    }

    if (body.fcm_token) {
      await this.updateFcmToken(user.user_id, body.fcm_token);
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
