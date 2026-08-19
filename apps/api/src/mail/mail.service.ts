import { Injectable,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { DatabaseService } from 'src/shared/database/Database.service';
import {
  forgotPasswordOtpTemplate,
  passwordChangedTemplate,
  registrationOtpTemplate,
  welcomeEmailTemplate,
} from './auth-email.templates';

/** SMTP settings, whatever their source. */
interface SmtpSettings {
  host: string;
  port: number;
  /** True for implicit TLS (port 465); false means STARTTLS. */
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName: string;
}

const CONFIG_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /** Cached alongside the settings that built it, so a rotation rebuilds it. */
  private cached: {
    transporter: nodemailer.Transporter;
    settings: SmtpSettings;
    expiresAt: number;
  } | null = null;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Resolves SMTP settings from `api_integrations_config` (Admin → Developer →
   * API Integrations → Email), falling back to the INFO_MAIL_* environment
   * variables when no row is configured.
   *
   * The database is checked first so credentials can be rotated from the admin
   * panel without a redeploy — the same precedence Razorpay and Firebase use.
   */
  private async resolveSettings(): Promise<SmtpSettings> {
    let data: Record<string, any> = {};
    try {
      const rows = await this.db.query(
        `SELECT config_data
           FROM api_integrations_config
          WHERE category = 'email'
            AND is_active = true
            AND deleted_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 1`,
      );
      data = rows?.[0]?.config_data || {};
      if (typeof data === 'string') data = JSON.parse(data);
    } catch (error) {
      this.logger.warn(
        `SMTP config lookup failed, falling back to environment: ${String(error)}`,
      );
    }

    // The admin modal writes snake_case; env vars are the fallback.
    const encryption = String(
      data.encryption_type || process.env.INFO_MAIL_ENCRYPTION || 'STARTTLS',
    ).toUpperCase();
    const user = data.smtp_user || process.env.INFO_MAIL_USERNAME || '';

    return {
      host: data.smtp_host || process.env.INFO_MAIL_HOST || '',
      port: Number(data.smtp_port || process.env.INFO_MAIL_PORT || 587),
      secure: encryption === 'SSL' || encryption === 'TLS',
      user,
      pass: data.smtp_pass || process.env.INFO_MAIL_PASSWORD || '',
      fromAddress: data.from_address || user,
      fromName: data.from_name || 'F2H Fresh',
    };
  }

  /** Returns a transporter for the current settings, rebuilding it on change. */
  private async getTransporter(): Promise<{
    transporter: nodemailer.Transporter;
    settings: SmtpSettings;
  }> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached;

    const settings = await this.resolveSettings();
    if (!settings.host || !settings.user) {
      throw new Error(
        'SMTP is not configured — add an Email integration in Admin → Developer → API Integrations',
      );
    }

    // Reuse the existing connection pool when nothing actually changed; only a
    // real credential change should tear it down.
    const unchanged =
      this.cached &&
      JSON.stringify(this.cached.settings) === JSON.stringify(settings);

    const transporter = unchanged
      ? this.cached!.transporter
      : nodemailer.createTransport({
          host: settings.host,
          port: settings.port,
          secure: settings.secure,
          requireTLS: !settings.secure, // force STARTTLS on port 587
          auth: { user: settings.user, pass: settings.pass },
          tls: {
            rejectUnauthorized: false, // allow self-signed certs on shared hosting
          },
        });

    if (!unchanged) this.cached?.transporter.close?.();

    this.cached = { transporter, settings, expiresAt: Date.now() + CONFIG_TTL_MS };
    return this.cached;
  }

  /** Drops the cache so the next send re-reads the table. */
  invalidateConfigCache() {
    this.cached?.transporter.close?.();
    this.cached = null;
  }


  async sendOtp(email: string, otp: string) {
    await this.sendAuthTemplate(email, forgotPasswordOtpTemplate(otp));
  }

  async sendRegistrationOtp(email: string, otp: string) {
    await this.sendAuthTemplate(email, registrationOtpTemplate(otp));
  }

  async sendForgotPasswordOtp(email: string, otp: string) {
    await this.sendAuthTemplate(email, forgotPasswordOtpTemplate(otp));
  }

  async sendWelcomeEmail(email: string, name: string) {
    await this.sendAuthTemplate(email, welcomeEmailTemplate(name));
  }

  async sendPasswordChangedAlert(email: string) {
    await this.sendAuthTemplate(email, passwordChangedTemplate());
  }

  /**
   * Send a generic email with custom subject and HTML content
   * Used for security alerts, notifications, etc.
   */
  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    try {
      this.logger.log(`[MailService] Sending email to ${options.to}...`);
      const { transporter, settings } = await this.getTransporter();
      const info = await transporter.sendMail({
        from: `"${settings.fromName}" <${settings.fromAddress}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
      });
      this.logger.log(
        '[MailService] Email sent successfully. Message ID:',
        info.messageId,
      );
      return info;
    } catch (error) {
      console.error('[MailService] CRITICAL: Failed to send email:', error);
      throw error;
    }
  }

  private async sendAuthTemplate(
    to: string,
    template: { subject: string; text: string; html: string },
  ) {
    return this.sendMail({ to, ...template });
  }
}
