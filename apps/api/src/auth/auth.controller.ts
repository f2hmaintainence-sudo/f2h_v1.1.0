import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService, parseDurationToSeconds } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/shared/redis/redis.service';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { AuditLoggerService } from './audit-logger.service';
import { RegisterDto, LoginDto, SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { Roles, ROLE } from './decorators/roles.decorator';
import { GoogleOAuthService } from './google-oauth.service';
import { Throttle } from '@nestjs/throttler';
import { DatabaseService } from 'src/shared/database/Database.service';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly deviceFingerprintService: DeviceFingerprintService,
    private readonly auditLogger: AuditLoggerService,
    private readonly db: DatabaseService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) { }

  @Public()
  @Post('login')
  @Throttle({ short: { limit: 10, ttl: 60_000 }, medium: { limit: 30, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {

    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';
    // 1. Extract x-role strictly from header (ignore any role sent in request body)
    const rawClientRole = req.headers['x-role'];
    const clientRole = typeof rawClientRole === 'string' ? rawClientRole.trim().toUpperCase() : '';

    if (!clientRole || !['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN'].includes(clientRole)) {
      this.logger.log(
        `[AuthController:login] Login rejected: Missing or invalid x-role header: "${rawClientRole}"`,
      );
      throw new UnauthorizedException('Missing or invalid x-role header');
    }

    this.logger.log(
      `[AuthController:login] Attempting login with identifier: ${body.identifier}, clientRole: ${clientRole}`,
    );

    const fcmToken = body.fcm_token || (body as any).fcmToken;

    // 2. Validate user credentials
    const user = await this.authService.validateUser(
      body.identifier,
      body.password,
      undefined,
      ip,
      userAgent,
      body.fingerprintData,
      fcmToken,
    );

    const userRole = (user.role_id || '').toUpperCase().trim();

    // 3. Validate client role against user role
    let isRoleAllowed = false;
    switch (clientRole) {
      case 'CUSTOMER':
        // Customer App: All registered users (CUSTOMER, DELIVERY_PARTNER, ADMIN, SUPER_ADMIN, etc.) can log in to shop
        isRoleAllowed = true;
        break;

      case 'DELIVERY_PARTNER':
        // Delivery Partner App: allow DELIVERY_PARTNER, ADMIN, SUPER_ADMIN
        isRoleAllowed = ['DELIVERY_PARTNER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);
        break;

      case 'ADMIN':
        // Admin Panel: allow all internal roles except CUSTOMER and DELIVERY_PARTNER
        isRoleAllowed = !['CUSTOMER', 'DELIVERY_PARTNER'].includes(userRole);
        break;
    }

    if (!isRoleAllowed) {
      this.logger.log(
        `[AuthController:login] Client Role: ${clientRole}, Resolved User Role: ${userRole}, Result: FAILED - Unauthorized role`,
      );
      throw new UnauthorizedException(`Unauthorized role for ${clientRole} application`);
    }

    // 4. Check is_active in the satellite table for the app being accessed (not the user's role table)
    const isSatelliteActive = await this.authService.checkSatelliteIsActive(user.user_id, clientRole);
    if (!isSatelliteActive) {
      this.logger.log(
        `[AuthController:login] User ID: ${user.user_id}, App: ${clientRole}, UserRole: ${userRole}, Result: FAILED - Inactive account in satellite table`,
      );
      throw new UnauthorizedException('Your account is inactive. Please contact support.');
    }


    const incomingFcmToken = body.fcm_token || (body as any).fcmToken;
    if (incomingFcmToken) {
      await this.authService.updateFcmToken(user.user_id, incomingFcmToken);
    }

    let deviceId: string | null = null;
    if (body.fingerprintData && userAgent) {
      try {
        deviceId = this.deviceFingerprintService.generateDeviceId({
          userAgent,
          acceptLanguage: body.fingerprintData.acceptLanguage || 'unknown',
          acceptEncoding: body.fingerprintData.acceptEncoding || 'unknown',
          screenResolution: body.fingerprintData.screenResolution || 'unknown',
          timezone: body.fingerprintData.timezone || 'unknown',
          platform: body.fingerprintData.platform || 'unknown',
          plugins: body.fingerprintData.plugins || [],
          canvas: body.fingerprintData.canvas || 'unknown',
        });
      } catch {
        deviceId = null;
      }
    }

    const { accessToken, refreshToken } = await this.authService.generateTokens(
      {
        user_id: user.user_id,
        email: user.email,
        role_id: user.role_id,
        device_id: deviceId,
      },
      {
        fcmToken: body.fcm_token,
        ipAddress: ip,
        userAgent,
      },
    );

    this.setCookies(res, accessToken, refreshToken);

    return {
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        email: user.email,
        role_id: user.role_id,
      },
      accessToken,
      refreshToken,
    };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const regResult = await this.authService.register(body);
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const userId = regResult.userId;
    const roleId = body.role || 'CUSTOMER';

    const { accessToken, refreshToken } = await this.authService.generateTokens(
      {
        user_id: userId,
        email: body.email || null,
        role_id: roleId,
      },
      {
        fcmToken: body.fcm_token,
        ipAddress: ip,
        userAgent,
      },
    );

    this.setCookies(res, accessToken, refreshToken);

    return {
      message: 'Registration successful',
      user: {
        user_id: userId,
        email: body.email,
        role_id: roleId,
      },
      accessToken,
      refreshToken,
      token: accessToken,
    };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: { email?: string; phone?: string; identifier?: string },
    @Req() req: Request,
  ) {
    const rawClientRole = req.headers['x-role'];
    const clientRole = typeof rawClientRole === 'string' ? rawClientRole.trim().toUpperCase() : undefined;
    const identifier = body.email || body.phone || body.identifier || '';
    return this.authService.forgotPassword(identifier, clientRole);
  }

  @Public()
  @Post('forgot-password-sms')
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPasswordSms(
    @Body() body: { phone?: string; identifier?: string },
    @Req() req: Request,
  ) {
    const rawClientRole = req.headers['x-role'];
    const clientRole = typeof rawClientRole === 'string' ? rawClientRole.trim().toUpperCase() : undefined;
    const identifier = body.phone || body.identifier || '';
    return this.authService.forgotPassword(identifier, clientRole);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body()
    body: {
      email?: string;
      phone?: string;
      identifier?: string;
      token?: string;
      otp?: string;
      newPassword?: string;
      password?: string;
    },
  ) {
    return this.authService.resetPassword(body);
  }

  @Public()
  @Post('send-otp')
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: SendOtpDto & { purpose?: string }, @Req() req: Request) {
    if (body.purpose === 'forgot_password') {
      const rawClientRole = req.headers['x-role'];
      const clientRole = typeof rawClientRole === 'string' ? rawClientRole.trim().toUpperCase() : undefined;
      const identifier = body.phone || body.email || '';
      return this.authService.forgotPassword(identifier, clientRole);
    }
    return this.authService.requestMobileOtp(body);
  }

  @Public()
  @Post('send-email-otp')
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async sendEmailOtp(
    @Body() body: { email?: string; phone?: string; purpose?: string },
    @Req() req: Request,
  ) {
    if (body.purpose === 'forgot_password') {
      const rawClientRole = req.headers['x-role'];
      const clientRole = typeof rawClientRole === 'string' ? rawClientRole.trim().toUpperCase() : undefined;
      const identifier = body.email || body.phone || '';
      return this.authService.forgotPassword(identifier, clientRole);
    }
    return this.authService.requestMobileOtp({ email: body.email, phone: body.phone });
  }

  @Public()
  @Post('verify-otp')
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: Request) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    return this.authService.verifyMobileOtp(body, ip);
  }

  @Public()
  @Post('verify-email-otp')
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(@Body() body: { email?: string; phone?: string; otp: string; purpose?: string }, @Req() req: Request) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const purpose = (body.purpose as 'registration' | 'forgot_password' | 'email_change') || 'registration';
    return this.authService.verifyMobileOtp({ email: body.email, phone: body.phone, otp: body.otp, purpose }, ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined;
    const token = req.cookies?.access_token || bearerToken;
    if (token) {
      try {
        const decoded = this.jwtService.decode(token) as any;
        const userId = decoded?.sub || decoded?.user_id;
        if (userId) {
          await this.redisService.forget(`f2h_user_jwt_${userId}`);
        }
      } catch (e) {
        // Ignore decode errors on explicit logout
      }
    }
    this.clearCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'Tokens refreshed successfully' };
  }

  @Get('session-info')
  @HttpCode(HttpStatus.OK)
  async getSessionInfo(@Req() req: Request) {
    return { message: 'Session is active' };
  }

  @Post('fcm-token')
  @HttpCode(HttpStatus.OK)
  async saveFcmToken(@Req() req: Request, @Body() body: { fcm_token?: string; fcmToken?: string }) {
    const token = body.fcm_token || body.fcmToken;
    if (!token) {
      return { success: false, message: 'No FCM token provided' };
    }
    const authHeader = req.headers['authorization'];
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined;
    const accessToken = req.cookies?.access_token || bearerToken;
    let userId: string | null = null;
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as any;
        userId = decoded?.sub || decoded?.user_id;
      } catch {
        // A token that will not decode simply means "not authenticated" here; the
        // caller already handles userId being null.
        userId = null;
      }
    }
    if (userId) {
      await this.authService.updateFcmToken(userId, token);
      return { success: true, message: 'FCM token updated successfully' };
    }
    return { success: false, message: 'User not authenticated' };
  }

  @Post('update-fcm-token')
  @HttpCode(HttpStatus.OK)
  async updateFcmTokenEndpoint(@Req() req: Request, @Body() body: { fcm_token?: string; fcmToken?: string }) {
    return this.saveFcmToken(req, body);
  }

  @Get('get-users-by-role')
  @Roles(ROLE.ADMIN, ROLE.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getUsersByRole(@Query('role') role: string) {
    return this.authService.getUsersByRole(role);
  }

  /**
   * Google Sign-In.
   *
   * Accepts whichever credential the client platform can produce — an
   * `id_token` (Android/iOS) or an authorization `code` (web GIS) — and
   * verifies it with Google before any session is issued. The caller's own
   * `email`, `name` and `role` are deliberately ignored: everything identifying
   * comes back signed from Google, and the role is capped to the self-service
   * set so a crafted request can never create an admin.
   */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body() body: { id_token?: string; code?: string; fcm_token?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.completeGoogleLogin(
      { idToken: body?.id_token, code: body?.code },
      body?.fcm_token,
      req,
      res,
    );
  }

  /**
   * Legacy GET entry point kept for already-released mobile builds, which send
   * the authorization code as a query parameter.
   */
  @Public()
  @Get('google/callback')
  @HttpCode(HttpStatus.OK)
  async googleAuthCallback(
    @Query('code') code: string,
    @Query('id_token') idToken: string,
    @Query('fcm_token') fcmToken: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.completeGoogleLogin({ idToken, code }, fcmToken, req, res);
  }

  private async completeGoogleLogin(
    credential: { idToken?: string; code?: string },
    fcmToken: string | undefined,
    req: Request,
    res: Response,
  ) {
    const identity = await this.googleOAuthService.verify(credential);
    const result = await this.authService.googleLogin(identity, {
      fcmToken,
      // The client declares which app it is via the same header it already
      // sends at login; AuthService still clamps it to a safe role.
      role: (req.headers['x-role'] as string | undefined)?.trim(),
    });
    this.setCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Public()
  @Get('public/branches')
  @HttpCode(HttpStatus.OK)
  async getPublicBranches() {
    try {
      const rows = await this.db.query(`
        SELECT branch_id, branch_name, city, state,
               lat, lng, delivery_radius_km
        FROM branches
        WHERE is_active = true
        ORDER BY branch_name ASC
      `, []);
      return { status: true, data: rows };
    } catch {
      return { status: false, data: [] };
    }
  }

  @Public()
  @Get('public/site-settings')
  @HttpCode(HttpStatus.OK)
  async getPublicSiteSettings() {
    try {
      const rows: { key: string; value: string }[] = await this.db.query(
        'SELECT key, value FROM site_settings ORDER BY key ASC', []
      );
      const data: Record<string, any> = {};
      for (const row of rows) {
        try { data[row.key] = JSON.parse(row.value); } catch { data[row.key] = row.value; }
      }
      return { status: true, data };
    } catch {
      return { status: false, data: {} };
    }
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    // Cookie lifetimes track the tokens they carry. A 100-year cookie kept a leaked
    // session alive on the client long after the token itself should have died.
    const accessMaxAge =
      parseDurationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN || '15m') * 1000;
    const refreshMaxAge =
      parseDurationToSeconds(process.env.JWT_REFRESH_EXPIRES_IN || '30d') * 1000;

    res.cookie('access_token', accessToken, {
      maxAge: accessMaxAge,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.cookie('refresh_token', refreshToken, {
      maxAge: refreshMaxAge,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  private clearCookies(res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }
}
