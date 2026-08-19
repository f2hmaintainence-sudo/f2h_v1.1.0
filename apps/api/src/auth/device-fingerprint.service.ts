import { Injectable,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DataService } from 'src/shared/database/Data.service';
import { MailService } from 'src/mail/mail.service';
import { AuditLoggerService } from './audit-logger.service';

/**
 * Device Fingerprinting Service
 * Tracks user devices for security monitoring and unusual login detection
 *
 * Features:
 * - Generates unique device fingerprints based on browser/hardware characteristics
 * - Detects new device logins and sends email alerts
 * - Allows users to manage and revoke trusted devices
 * - Risk scoring based on device trust level
 */
@Injectable()
export class DeviceFingerprintService {
  private readonly logger = new Logger(DeviceFingerprintService.name);

  private readonly MAX_DEVICES_PER_USER = 10; // hard safety cap

  constructor(
    private readonly Data: DataService,
    private readonly mailService: MailService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Generate device ID from request headers and fingerprint data
   */
  generateDeviceId(fingerprintData: {
    userAgent: string;
    acceptLanguage?: string;
    acceptEncoding?: string;
    screenResolution?: string;
    timezone?: string;
    platform?: string;
    plugins?: string[];
    canvas?: string;
  }): string {
    // Combine all fingerprint components
    const components = [
      fingerprintData.userAgent || 'unknown',
      fingerprintData.acceptLanguage || 'unknown',
      fingerprintData.acceptEncoding || 'unknown',
      fingerprintData.screenResolution || 'unknown',
      fingerprintData.timezone || 'unknown',
      fingerprintData.platform || 'unknown',
      fingerprintData.plugins?.join(',') || 'none',
      fingerprintData.canvas || 'none',
    ].join('|');

    // Generate SHA-256 hash for device ID
    return crypto.createHash('sha256').update(components).digest('hex');
  }

  /**
   * Parse user agent to extract device details
   */
  parseUserAgent(userAgent: string): {
    browser: string;
    browserVersion: string;
    os: string;
    device: string;
  } {
    const ua = userAgent || 'Unknown';

    // Detect browser
    let browser = 'Unknown';
    let browserVersion = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      browser = 'Chrome';
      const match = ua.match(/Chrome\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
      const match = ua.match(/Firefox\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Safari';
      const match = ua.match(/Version\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Edg')) {
      browser = 'Edge';
      const match = ua.match(/Edg\/([0-9.]+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }

    // Detect OS
    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad'))
      os = 'iOS';

    // Detect device type
    let device = 'Desktop';
    if (ua.includes('Mobile')) device = 'Mobile';
    else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

    return { browser, browserVersion, os, device };
  }

  /**
   * Generate human-readable device name
   */
  generateDeviceName(userAgent: string, ipAddress: string): string {
    const parsed = this.parseUserAgent(userAgent);
    return `${parsed.browser} on ${parsed.os} - ${parsed.device}`;
  }

  /**
   * Check if device is trusted for this user
   */
  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    try {
      const result = await this.Data.query('user_devices', {
        select: ['id', 'is_active'],
        where: [
          { column: 'user_id', operator: '=', value: userId },
          { column: 'device_id', operator: '=', value: deviceId },
        ],
      });

      const device = result?.data?.[0];
      return device && device.is_active === 1;
    } catch (error) {
      console.error('[DeviceFingerprint] Error checking device trust:', error);
      return false;
    }
  }

  /**
   * Register or update device for user
   */
  async registerDevice(data: {
    userId: string;
    deviceId: string;
    deviceName?: string;
    userAgent: string;
    ipAddress: string;
    fingerprint: any;
  }): Promise<{
    isNew: boolean;
    isInitialDevice: boolean;
    deviceRecordId: number;
  }> {
    const { userId, deviceId, deviceName, userAgent, ipAddress, fingerprint } =
      data;

    this.logger.log(
      `[DeviceFingerprint:registerDevice] START - userId: ${userId}, deviceId: ${deviceId?.substring(0, 8)}...`,
    );

    try {
      // Determine configured max logins (fallback to safety cap)
      let allowedMaxLogins = this.MAX_DEVICES_PER_USER;
      try {
        const userResult = await this.Data.query('users', {
          select: ['max_logins'],
          where: [{ column: 'user_id', operator: '=', value: userId }],
          limit: 1,
        });
        const v = Number(userResult?.data?.[0]?.max_logins);
        if (Number.isFinite(v) && v > 0) {
          allowedMaxLogins = Math.max(
            1,
            Math.min(this.MAX_DEVICES_PER_USER, v),
          );
        }
      } catch {
        // ignore
      }

      // Check if device already exists
      this.logger.log(
        `[DeviceFingerprint] Querying existing device for user ${userId}`,
      );
      const existingResult = await this.Data.query('user_devices', {
        select: ['id', 'last_used', 'is_active'],
        where: [
          { column: 'user_id', operator: '=', value: userId },
          { column: 'device_id', operator: '=', value: deviceId },
        ],
      });

      this.logger.log(
        `[DeviceFingerprint] Query result:`,
        existingResult?.data?.length > 0 ? 'Device found' : 'Device not found',
      );

      const existingDevice = existingResult?.data?.[0];

      if (existingDevice) {
        // Update last used timestamp
        this.logger.log(
          `[DeviceFingerprint] Updating existing device ID: ${existingDevice.id}`,
        );
        const updateResult = await this.Data.update(
          'user_devices',
          {
            last_used: new Date(),
            ip_address: ipAddress,
            is_active: 1,
            revoked_at: null,
          },
          [{ column: 'id', operator: '=', value: existingDevice.id }],
        );

        this.logger.log(
          `[DeviceFingerprint] ✅ Updated existing device ${deviceId.substring(0, 8)}... for user ${userId}`,
        );
        return {
          isNew: false,
          isInitialDevice: false,
          deviceRecordId: existingDevice.id,
        };
      }

      // 🔍 Check total device count for this user (including inactive devices)
      this.logger.log(
        `[DeviceFingerprint] Checking total device count for user ${userId}`,
      );
      const userDevicesResult = await this.Data.query('user_devices', {
        select: ['id'],
        where: [{ column: 'user_id', operator: '=', value: userId }],
      });

      const totalDeviceCount = userDevicesResult?.data?.length || 0;
      const isInitialDevice = totalDeviceCount === 0; // First device for this user

      this.logger.log(
        `[DeviceFingerprint] Total devices for user: ${totalDeviceCount}, isInitialDevice: ${isInitialDevice}`,
      );

      // Check active device limit
      this.logger.log(
        `[DeviceFingerprint] Checking active device count for user ${userId}`,
      );
      const activeDevicesResult = await this.Data.query('user_devices', {
        select: ['id'],
        where: [
          { column: 'user_id', operator: '=', value: userId },
          { column: 'is_active', operator: '=', value: 1 },
        ],
      });

      const activeDeviceCount = activeDevicesResult?.data?.length || 0;
      this.logger.log(
        `[DeviceFingerprint] Current active devices: ${activeDeviceCount}/${allowedMaxLogins}`,
      );

      if (activeDeviceCount >= allowedMaxLogins) {
        // Auto-revoke oldest active device (make room)
        this.logger.log(
          `[DeviceFingerprint] Device limit reached, revoking oldest device...`,
        );
        await this.revokeOldestDevice(userId);
      }

      // Parse user agent for device info
      const parsed = this.parseUserAgent(userAgent);
      this.logger.log(`[DeviceFingerprint] Parsed user agent:`, parsed);

      // Create new device record
      this.logger.log(
        `[DeviceFingerprint] Creating NEW device record for user ${userId}`,
      );
      const insertResult = await this.Data.query('user_devices', {
        insert: {
          user_id: userId,
          device_id: deviceId,
          device_name:
            deviceName || `Device ${new Date().toLocaleDateString()}`,
          device_info: JSON.stringify({
            ...parsed,
            fingerprint: fingerprint,
            firstSeenIp: ipAddress,
          }),
          ip_address: ipAddress,
          is_active: 1,
          created_at: new Date(),
          last_used: new Date(),
        },
      });

      const deviceRecordId = insertResult?.data?.insertId;
      this.logger.log(
        `[DeviceFingerprint] ✅ REGISTERED NEW device - recordId: ${deviceRecordId}, deviceId: ${deviceId.substring(0, 8)}... for user ${userId}`,
      );

      if (isInitialDevice) {
        this.logger.log(
          `[DeviceFingerprint] 🎉 This is the INITIAL DEVICE for user ${userId} - no emails will be sent`,
        );
      } else {
        this.logger.log(
          `[DeviceFingerprint] ⚠️ This is a NEW DEVICE for user ${userId} - security emails will be sent`,
        );
      }

      return { isNew: true, isInitialDevice, deviceRecordId };
    } catch (error) {
      console.error(
        '[DeviceFingerprint:registerDevice] ❌ ERROR:',
        error instanceof Error ? error.message : error,
      );
      console.error('[DeviceFingerprint:registerDevice] Full error:', error);
      throw error;
    }
  }

  /**
   * Send email alert for new device login
   */
  async sendNewDeviceAlert(data: {
    userId: string;
    email: string;
    deviceName: string;
    ipAddress: string;
    location?: string;
    timestamp: Date;
  }): Promise<void> {
    const { userId, email, deviceName, ipAddress, location, timestamp } = data;

    try {
      const subject = '🔐 New Device Login Detected - f2hfresh.com';
      const loginTime = timestamp.toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .device-info { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .info-label { font-weight: bold; color: #666; }
            .info-value { color: #333; }
            .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .btn-secondary { background: #6c757d; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 New Device Login</h1>
            </div>
            <div class="content">
              <div class="alert-box">
                <strong>⚠️ Security Alert:</strong> We detected a login from a new device.
              </div>
              
              <p>Hi there,</p>
              <p>A login to your f2hfresh.com account was just detected from a device we haven't seen before.</p>
              
              <div class="device-info">
                <h3 style="margin-top: 0;">Login Details</h3>
                <div class="info-row">
                  <span class="info-label">Device:</span>
                  <span class="info-value">${deviceName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">IP Address:</span>
                  <span class="info-value">${ipAddress}</span>
                </div>
                ${
                  location
                    ? `
                <div class="info-row">
                  <span class="info-label">Location:</span>
                  <span class="info-value">${location}</span>
                </div>
                `
                    : ''
                }
                <div class="info-row">
                  <span class="info-label">Time:</span>
                  <span class="info-value">${loginTime}</span>
                </div>
              </div>
              
              <h3>Was this you?</h3>
              <p>If you recognize this login, you can safely ignore this email. This device is now trusted.</p>
              
              <p><strong>If you don't recognize this activity:</strong></p>
              <ol>
                <li>Change your password immediately</li>
                <li>Review your trusted devices</li>
                <li>Revoke access for unrecognized devices</li>
                <li>Enable two-factor authentication</li>
              </ol>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/account/security" class="btn">
                  Review Security Settings
                </a>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/account/devices" class="btn btn-secondary">
                  Manage Devices
                </a>
              </div>
              
              <div class="footer">
                <p>This is an automated security notification from f2hfresh.com</p>
                <p>If you didn't attempt to log in, please contact support immediately.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.mailService.sendMail({
        to: email,
        subject,
        html: htmlContent,
      });

      // Log the alert
      this.auditLogger.logSuspiciousActivity({
        activity: 'NEW_DEVICE_LOGIN',
        details: {
          deviceName,
          ipAddress,
          location,
          timestamp: timestamp.toISOString(),
        },
        userId,
        email,
        ip: ipAddress,
        severity: 'MEDIUM',
      });

      this.logger.log(`[DeviceFingerprint] Sent new device alert to ${email}`);
    } catch (error) {
      console.error(
        '[DeviceFingerprint] Error sending new device alert:',
        error,
      );
      // Don't throw - email failure shouldn't break login
    }
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<any[]> {
    try {
      const result = await this.Data.query('user_devices', {
        select: ['*'],
        where: [{ column: 'user_id', operator: '=', value: userId }],
        orderBy: [{ column: 'last_used', direction: 'DESC' }],
      });

      return result?.data || [];
    } catch (error) {
      console.error('[DeviceFingerprint] Error fetching user devices:', error);
      return [];
    }
  }

  /**
   * Revoke a device by ID
   */
  async revokeDevice(userId: string, deviceRecordId: number): Promise<boolean> {
    try {
      await this.Data.update(
        'user_devices',
        { is_active: 0, revoked_at: new Date() },
        [
          { column: 'id', operator: '=', value: deviceRecordId },
          { column: 'user_id', operator: '=', value: userId },
        ],
      );

      this.logger.log(
        `[DeviceFingerprint] Revoked device ${deviceRecordId} for user ${userId}`,
      );

      // Log the revocation
      this.auditLogger.logSuspiciousActivity({
        activity: 'DEVICE_REVOKED',
        details: { deviceRecordId },
        userId,
        severity: 'LOW',
      });

      return true;
    } catch (error) {
      console.error('[DeviceFingerprint] Error revoking device:', error);
      return false;
    }
  }

  /**
   * Revoke oldest device to make room for new one
   */
  private async revokeOldestDevice(userId: string): Promise<void> {
    try {
      const devicesResult = await this.Data.query('user_devices', {
        select: ['id'],
        where: [
          { column: 'user_id', operator: '=', value: userId },
          { column: 'is_active', operator: '=', value: 1 },
        ],
        orderBy: [{ column: 'last_used', direction: 'ASC' }],
        limit: 1,
      });

      const oldestDevice = devicesResult?.data?.[0];

      if (oldestDevice) {
        await this.revokeDevice(userId, oldestDevice.id);
        this.logger.log(
          `[DeviceFingerprint] Auto-revoked oldest device for user ${userId}`,
        );
      }
    } catch (error) {
      console.error('[DeviceFingerprint] Error revoking oldest device:', error);
    }
  }

  /**
   * Calculate device trust score (0-100)
   */
  calculateTrustScore(device: any): number {
    let score = 0;

    // Age of device (older = more trusted)
    const ageInDays = device.created_at
      ? Math.floor(
          (Date.now() - new Date(device.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;
    score += Math.min(ageInDays * 2, 40); // Max 40 points for age

    // Frequency of use
    const daysSinceLastUse = device.last_used
      ? Math.floor(
          (Date.now() - new Date(device.last_used).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;
    if (daysSinceLastUse < 1) score += 30;
    else if (daysSinceLastUse < 7) score += 20;
    else if (daysSinceLastUse < 30) score += 10;

    // Is active
    if (device.is_active === 1) score += 20;

    // Has device info
    if (device.device_info) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Risk assessment for login attempt
   */
  async assessLoginRisk(data: {
    userId: string;
    deviceId: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskScore: number;
    factors: string[];
    requiresVerification: boolean;
  }> {
    const { userId, deviceId, ipAddress, userAgent } = data;
    let riskScore = 0;
    const factors: string[] = [];

    try {
      // Check if device is known
      const isKnown = await this.isDeviceTrusted(userId, deviceId);
      if (!isKnown) {
        riskScore += 40;
        factors.push('New/unknown device');
      }

      // Check for rapid IP changes (would need session history)
      // TODO: Implement IP change detection

      // Check user agent anomalies
      const devices = await this.getUserDevices(userId);
      const knownUserAgents = devices.map((d) =>
        d.device_info ? JSON.parse(d.device_info).browser : null,
      );
      const currentBrowser = this.parseUserAgent(userAgent).browser;

      if (
        knownUserAgents.length > 0 &&
        !knownUserAgents.includes(currentBrowser)
      ) {
        riskScore += 20;
        factors.push('Different browser than usual');
      }

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (riskScore >= 70) riskLevel = 'CRITICAL';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 30) riskLevel = 'MEDIUM';
      else riskLevel = 'LOW';

      return {
        riskLevel,
        riskScore,
        factors,
        requiresVerification: riskScore >= 40, // Require additional verification for medium+ risk
      };
    } catch (error) {
      console.error('[DeviceFingerprint] Error assessing login risk:', error);
      return {
        riskLevel: 'LOW',
        riskScore: 0,
        factors: [],
        requiresVerification: false,
      };
    }
  }
}
