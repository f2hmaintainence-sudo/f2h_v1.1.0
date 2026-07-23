import { Injectable } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { AuditLoggerService } from './audit-logger.service';

/**
 * Security Alert Service
 * Sends email alerts for all critical security events
 */
@Injectable()
export class SecurityAlertsService {
  constructor(
    private readonly mailService: MailService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Alert: Failed OTP Attempt
   * Sent after each failed OTP verification (not on every attempt, but batched)
   */
  async alertFailedOtpAttempt(data: {
    email: string;
    phone: string;
    attemptNumber: number;
    ipAddress: string;
  }): Promise<void> {
    const { email, phone, attemptNumber, ipAddress } = data;

    console.log(
      `[SecurityAlerts] Sending failed OTP attempt alert to ${email}`,
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { background: white; margin: 20px auto; padding: 30px; max-width: 600px; border-radius: 8px; }
          .header { border-bottom: 3px solid #d9534f; padding-bottom: 15px; margin-bottom: 20px; }
          .alert-box { background: #fcf8e3; border-left: 4px solid #f0ad4e; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .btn { background: #5bc0de; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
          .time { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #d9534f; margin: 0;">⚠️ Failed OTP Verification Attempt</h2>
          </div>

          <p>Hi there,</p>

          <p>We detected <strong>${attemptNumber} failed</strong> attempts to verify an OTP for your account.</p>

          <div class="alert-box">
            <strong>Failed Attempt Details:</strong><br>
            Phone: ${phone.replace(/(\d{2})(\d)(?=(\d{2})\d*)/g, '$1XXXXX')}<br>
            IP Address: ${ipAddress}<br>
            Time: ${new Date().toLocaleString()}<br>
            Attempts: ${attemptNumber}/${attemptNumber === 3 ? '3 (Account locked for 30 minutes)' : '5'}
          </div>

          <p><strong>⚠️ Important:</strong> If this wasn't you:</p>
          <ul>
            <li>Your account may be compromised</li>
            <li>Change your password immediately</li>
            <li>Review your security settings</li>
            <li>Contact us if you suspect unauthorized access</li>
          </ul>

          <p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/account/security" class="btn">
              Secure Your Account
            </a>
          </p>

          <p class="time">This is an automated security alert. If you have questions, contact support.</p>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: email,
        subject: `⚠️ Failed OTP Verification Attempts - Action Required`,
        html: html,
      });
    } catch (error) {
      console.error('[SecurityAlerts] Failed to send OTP alert email:', error);
    }
  }

  /**
   * Alert: Account Locked (too many failed attempts)
   */
  async alertAccountLocked(data: {
    email: string;
    userId: string;
    ipAddress: string;
    reason: 'LOGIN_ATTEMPTS' | 'OTP_ATTEMPTS';
  }): Promise<void> {
    const { email, userId, ipAddress, reason } = data;

    console.log(`[SecurityAlerts] Sending account locked alert to ${email}`);

    const reasonText =
      reason === 'LOGIN_ATTEMPTS'
        ? '5 failed login attempts detected from'
        : '3 failed OTP verification attempts detected from';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { background: white; margin: 20px auto; padding: 30px; max-width: 600px; border-radius: 8px; }
          .header { border-bottom: 3px solid #d9534f; padding-bottom: 15px; margin-bottom: 20px; }
          .danger-box { background: #f2dede; border: 1px solid #ebccd1; border-left: 4px solid #d9534f; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .btn { background: #5bc0de; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 10px; }
          .btn-danger { background: #d9534f; }
          .time { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #d9534f; margin: 0;">🔒 Your Account Has Been Locked</h2>
          </div>

          <p>Hi there,</p>

          <div class="danger-box">
            <strong>Your account has been temporarily locked for security.</strong><br><br>
            Reason: ${reasonText} IP address ${ipAddress}<br>
            Time: ${new Date().toLocaleString()}<br>
            Lock Duration: 30 minutes
          </div>

          <p><strong>What does this mean?</strong></p>
          <ul>
            <li>Your account is locked to prevent unauthorized access</li>
            <li>You cannot log in for the next 30 minutes</li>
            <li>The lock will automatically expire after 30 minutes</li>
          </ul>

          <p><strong>What should you do?</strong></p>
          <ul>
            <li>If this was you, don't worry - try again after 30 minutes</li>
            <li>If this wasn't you, change your password immediately:</li>
          </ul>

          <p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/forgot-password" class="btn btn-danger">
              Reset Password Now
            </a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/account/security" class="btn">
              Review Security Settings
            </a>
          </p>

          <p style="color: #d9534f;"><strong>⚠️ Important:</strong> Never share your password with anyone. Support will never ask for your password.</p>

          <p class="time">This is an automated security alert. If you have questions, contact support.</p>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: email,
        subject: `🔒 Your Account Has Been Locked - Immediate Action Required`,
        html: html,
      });
    } catch (error) {
      console.error(
        '[SecurityAlerts] Failed to send account locked alert:',
        error,
      );
    }
  }

  /**
   * Alert: Password Changed Successfully
   * Confirmation email sent after password change
   */
  async alertPasswordChangedSuccessfully(data: {
    email: string;
    ipAddress: string;
  }): Promise<void> {
    const { email, ipAddress } = data;

    console.log(
      `[SecurityAlerts] Sending password change confirmation to ${email}`,
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { background: white; margin: 20px auto; padding: 30px; max-width: 600px; border-radius: 8px; }
          .header { border-bottom: 3px solid #5cb85c; padding-bottom: 15px; margin-bottom: 20px; }
          .success-box { background: #dff0d8; border: 1px solid #d6e9c6; border-left: 4px solid #5cb85c; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .btn { background: #5bc0de; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
          .time { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #5cb85c; margin: 0;">✅ Password Changed Successfully</h2>
          </div>

          <p>Hi there,</p>

          <div class="success-box">
            <strong>Your password has been successfully changed.</strong><br><br>
            Changed from IP: ${ipAddress}<br>
            Time: ${new Date().toLocaleString()}
          </div>

          <p><strong>Details of the change:</strong></p>
          <ul>
            <li>Your new password is now active</li>
            <li>All previous sessions have been terminated</li>
            <li>You will need to log in again with your new password</li>
          </ul>

          <p><strong>⚠️ If you didn't make this change:</strong></p>
          <ul>
            <li>Your account may be compromised</li>
            <li>Log in immediately and change your password again</li>
            <li>Review your connected devices and revoke any you don't recognize</li>
            <li>Enable two-factor authentication for additional security</li>
          </ul>

          <p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/account/security" class="btn">
              Review Security Settings
            </a>
          </p>

          <p class="time">This is an automated confirmation email. If you have questions, contact support.</p>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: email,
        subject: `✅ Your Password Has Been Changed`,
        html: html,
      });
    } catch (error) {
      console.error(
        '[SecurityAlerts] Failed to send password change confirmation:',
        error,
      );
    }
  }

  /**
   * Alert: Suspicious Login Detected
   * Sent when login from unusual location/device/time
   */
  async alertSuspiciousLoginDetected(data: {
    email: string;
    deviceName: string;
    ipAddress: string;
    location?: string;
  }): Promise<void> {
    const { email, deviceName, ipAddress, location } = data;

    console.log(`[SecurityAlerts] Sending suspicious login alert to ${email}`);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { background: white; margin: 20px auto; padding: 30px; max-width: 600px; border-radius: 8px; }
          .header { border-bottom: 3px solid #f0ad4e; padding-bottom: 15px; margin-bottom: 20px; }
          .warning-box { background: #fcf8e3; border: 1px solid #faebcc; border-left: 4px solid #f0ad4e; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .btn { background: #5bc0de; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 10px; }
          .btn-danger { background: #d9534f; }
          .time { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #f0ad4e; margin: 0;">⚠️ Unusual Login Activity Detected</h2>
          </div>

          <p>Hi there,</p>

          <div class="warning-box">
            <strong>We detected a login to your account from a new device or unusual location.</strong><br><br>
            Device: ${deviceName}<br>
            IP Address: ${ipAddress}<br>
            ${location ? `Location: ${location}<br>` : ''}
            Time: ${new Date().toLocaleString()}
          </div>

          <p><strong>🔍 Is this you?</strong></p>
          <ul>
            <li><strong>Yes:</strong> Ignore this email. We've added this device to your trusted devices.</li>
            <li><strong>No:</strong> Click the button below to secure your account immediately.</li>
          </ul>

          <p style="color: #d9534f;"><strong>If this wasn't you:</strong></p>
          <ul>
            <li>Your account may have been compromised</li>
            <li>Change your password immediately</li>
            <li>Review all connected devices and revoke suspicious ones</li>
            <li>Enable stronger security measures (2FA, Security Keys)</li>
          </ul>

          <p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/account/devices" class="btn">
              Review Devices
            </a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/forgot-password" class="btn btn-danger">
              Secure Account Now
            </a>
          </p>

          <p class="time">This is an automated security alert. If you have questions, contact support.</p>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: email,
        subject: `⚠️ Unusual Login Activity Detected - Review Now`,
        html: html,
      });
    } catch (error) {
      console.error(
        '[SecurityAlerts] Failed to send suspicious login alert:',
        error,
      );
    }
  }

  /**
   * Alert: OAuth Login Success
   * Notification that account was accessed via OAuth provider
   */
  async alertOAuthLoginSuccess(data: {
    email: string;
    provider: string; // 'google', 'github', 'facebook', 'twitter'
    ipAddress: string;
  }): Promise<void> {
    const { email, provider, ipAddress } = data;

    console.log(`[SecurityAlerts] Sending OAuth login alert to ${email}`);

    const providerName =
      {
        google: 'Google',
        github: 'GitHub',
        facebook: 'Facebook',
        twitter: 'Twitter/X',
      }[provider] || provider;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { background: white; margin: 20px auto; padding: 30px; max-width: 600px; border-radius: 8px; }
          .header { border-bottom: 3px solid #5cb85c; padding-bottom: 15px; margin-bottom: 20px; }
          .info-box { background: #d9edf7; border: 1px solid #bce8f1; border-left: 4px solid #5bc0de; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .btn { background: #5bc0de; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
          .time { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #5cb85c; margin: 0;">✅ Login via ${providerName}</h2>
          </div>

          <p>Hi there,</p>

          <div class="info-box">
            <strong>Your account was accessed via ${providerName} login.</strong><br><br>
            Provider: ${providerName}<br>
            IP Address: ${ipAddress}<br>
            Time: ${new Date().toLocaleString()}
          </div>

          <p><strong>Account Access:</strong></p>
          <ul>
            <li>Your ${providerName} account is linked to your f2hfresh.com account</li>
            <li>No password was entered</li>
            <li>Authentication verified by ${providerName}</li>
          </ul>

          <p><strong>If this wasn't you:</strong></p>
          <ul>
            <li>Your ${providerName} account may be compromised</li>
            <li>Change your ${providerName} password immediately</li>
            <li>Consider disconnecting OAuth providers from your f2hfresh account</li>
          </ul>

          <p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/account/connected-apps" class="btn">
              Manage Connected Apps
            </a>
          </p>

          <p class="time">This is an automated notification. If you have questions, contact support.</p>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: email,
        subject: `✅ Login via ${providerName} - f2hfresh.com`,
        html: html,
      });
    } catch (error) {
      console.error(
        '[SecurityAlerts] Failed to send OAuth login alert:',
        error,
      );
    }
  }

  /**
   * Alert: Permission/Role Change
   * Sent when user's permissions are modified
   */
  async alertPermissionChanged(data: {
    email: string;
    action: string; // 'ADMIN_ADDED', 'ADMIN_REMOVED', etc
    changedBy: string;
  }): Promise<void> {
    const { email, action, changedBy } = data;

    console.log(`[SecurityAlerts] Sending permission change alert to ${email}`);

    const actionText =
      {
        ADMIN_ADDED: 'You have been promoted to Administrator',
        ADMIN_REMOVED: 'Your administrator privileges have been revoked',
        MOD_ADDED: 'You have been promoted to Moderator',
        MOD_REMOVED: 'Your moderator privileges have been revoked',
      }[action] || action;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { background: white; margin: 20px auto; padding: 30px; max-width: 600px; border-radius: 8px; }
          .header { border-bottom: 3px solid #5bc0de; padding-bottom: 15px; margin-bottom: 20px; }
          .info-box { background: #d9edf7; border: 1px solid #bce8f1; border-left: 4px solid #5bc0de; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .time { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #5bc0de; margin: 0;">📝 Your Permissions Have Changed</h2>
          </div>

          <p>Hi there,</p>

          <div class="info-box">
            <strong>${actionText}</strong><br><br>
            Changed by: ${changedBy}<br>
            Time: ${new Date().toLocaleString()}
          </div>

          <p><strong>What does this mean?</strong></p>
          <ul>
            <li>Your account permissions have been updated</li>
            <li>You may now have access to new features or admin panels</li>
            <li>Or some of your privileges have been restricted</li>
          </ul>

          <p><strong>If you didn't expect this change:</strong></p>
          <ul>
            <li>Contact your account administrator</li>
            <li>Report any suspicious activity</li>
          </ul>

          <p class="time">This is an automated notification. If you have questions, contact support.</p>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: email,
        subject: `📝 Your Account Permissions Have Changed`,
        html: html,
      });
    } catch (error) {
      console.error(
        '[SecurityAlerts] Failed to send permission change alert:',
        error,
      );
    }
  }
}
