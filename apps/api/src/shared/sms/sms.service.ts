// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : sms.service.ts
// Description : Service for sending SMS OTPs via Fast2SMS / DLT Gateways
//               configured in api_integrations_config or environment variables.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/Database.service';
import { DeveloperService } from '../logger/Developer.service';

export interface SmsConfig {
  endpoint_url?: string;
  auth_token?: string;
  sender_id?: string;
  route_channel?: string;
  provider?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  /**
   * Cleans an API key or auth token if it contains parameter wrappers or URLs
   */
  public cleanApiKey(rawKey?: string): string {
    if (!rawKey) return '';
    const trimmed = rawKey.trim();
    if (trimmed.includes('authkey=')) {
      const match = trimmed.match(/authkey=([^&]+)/);
      if (match) return match[1];
    }
    if (trimmed.includes('apikey=')) {
      const match = trimmed.match(/apikey=([^&]+)/);
      if (match) return match[1];
    }
    if (trimmed.includes('api_key=')) {
      const match = trimmed.match(/api_key=([^&]+)/);
      if (match) return match[1];
    }
    return trimmed;
  }

  /**
   * Renders OTP message template with dynamic variables
   */
  public renderOtpMessage(
    templateBody: string | undefined,
    otp: string,
    expiryMinutes = 15,
  ): string {
    if (!templateBody || !templateBody.trim()) {
      return `Your OTP is ${otp}. Valid for ${expiryMinutes} minutes. Do not share this OTP with anyone.`;
    }
    return templateBody
      .replace(/\{#var#\}|\{#otp#\}|\{\{var\}\}|\{\{otp\}\}|\{var\}|\{otp\}/gi, otp)
      .replace(/\{#expiry#\}|\{\{expiry\}\}|\{expiry\}/gi, String(expiryMinutes));
  }

  /**
   * Resolves SMS Gateway settings from `api_integrations_config`,
   * falling back to environment variables.
   */
  private async resolveSmsConfig(): Promise<SmsConfig> {
    try {
      const rows = await this.db.query(
        `SELECT provider, config_data
           FROM api_integrations_config
          WHERE category = 'sms'
            AND is_active = true
            AND deleted_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 1`,
      );

      if (rows && rows.length > 0) {
        const raw = rows[0].config_data;
        const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
        return {
          endpoint_url: cfg.endpoint_url || process.env.FAST2SMS_ENDPOINT,
          auth_token: this.cleanApiKey(cfg.auth_token || process.env.FAST2SMS_API_KEY),
          sender_id: cfg.sender_id || 'F2HFRESH',
          route_channel: cfg.route_channel || process.env.FAST2SMS_ROUTE || 'otp',
          provider: rows[0].provider,
        };
      }
    } catch (err) {
      this.logger.warn(`Failed to read SMS configuration from database: ${err}`);
    }

    return {
      endpoint_url: process.env.FAST2SMS_ENDPOINT || 'https://www.fast2sms.com/dev/bulkV2',
      auth_token: this.cleanApiKey(process.env.FAST2SMS_API_KEY || ''),
      sender_id: 'F2HFRESH',
      route_channel: process.env.FAST2SMS_ROUTE || 'otp',
      provider: 'Fast2SMS',
    };
  }

  /**
   * Resolves SMS template by key (e.g. CUSTOMER_LOGIN_OTP or ASSOCIATE_LOGIN_OTP)
   */
  async getTemplate(templateKey: string): Promise<any | null> {
    try {
      const rows = await this.db.query(
        `SELECT config_key, name, provider, config_data
           FROM api_integrations_config
          WHERE category IN ('sms-template', 'sms_template')
            AND (config_key = $1 OR is_active = true)
            AND deleted_at IS NULL
          ORDER BY (CASE WHEN config_key = $1 THEN 0 ELSE 1 END) ASC, updated_at DESC
          LIMIT 1`,
        [templateKey],
      );
      if (rows && rows.length > 0) {
        const raw = rows[0].config_data;
        const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
        return {
          template_key: rows[0].config_key,
          name: rows[0].name,
          provider: rows[0].provider,
          ...cfg,
        };
      }
    } catch (err) {
      this.logger.warn(`Failed to read SMS template ${templateKey}: ${err}`);
    }
    return null;
  }

  /**
   * Normalizes a phone string to 10 digits for Indian mobile numbers.
   */
  public normalizePhone(rawPhone: string): string {
    const cleaned = (rawPhone || '').replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return cleaned.slice(2);
    }
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      return cleaned.slice(1);
    }
    return cleaned;
  }

  /**
   * Sends an OTP SMS to the given phone number.
   * Catches errors gracefully and logs fallback info so auth flows do not break.
   */
  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      this.logger.warn(`Cannot send SMS to invalid phone number: ${phone}`);
      return false;
    }

    const config = await this.resolveSmsConfig();
    const apiKey = this.cleanApiKey(config.auth_token);
    const endpoint = config.endpoint_url;

    this.logger.log(`[SMS] Sending OTP to ${normalizedPhone} via ${config.provider || 'Gateway'}...`);

    if (!apiKey || apiKey === '2' || apiKey.length < 5) {
      // Missing or placeholder API key — log clearly for dev/staging
      this.logger.warn(
        `[SMS] No active SMS API key configured. OTP for ${normalizedPhone} is: ${otp} (or master test OTP: 123456)`,
      );
      return true;
    }

    // Resolve template once for either gateway
    const template =
      (await this.getTemplate('CUSTOMER_LOGIN_OTP')) ||
      (await this.getTemplate('ASSOCIATE_LOGIN_OTP'));

    const dltTemplateId = template?.dlt_template_id;
    const senderId = template?.dlt_sender_id || config.sender_id || 'DIGKPM';
    const messageText = this.renderOtpMessage(template?.body, otp, 15);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // 1. Fast2SMS standard API
      if (endpoint?.includes('fast2sms.com')) {
        const routeChannel = (config.route_channel || '').toLowerCase();
        let route = 'otp';
        if (routeChannel.includes('dlt')) {
          route = 'dlt';
        } else if (routeChannel.includes('otp')) {
          route = 'otp';
        } else {
          route = 'q';
        }

        const body: Record<string, any> = {
          route,
          numbers: normalizedPhone,
        };

        if (route === 'dlt') {
          if (dltTemplateId) {
            body.message = dltTemplateId;
            body.sender_id = senderId;
            body.variables_values = otp;
          } else {
            body.route = 'otp';
            body.variables_values = otp;
          }
        } else if (route === 'otp') {
          body.variables_values = otp;
        } else {
          body.message = messageText;
          body.language = 'english';
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const data: any = await res.json().catch(() => ({}));
        clearTimeout(timeoutId);

        if (res.ok && data.return === true) {
          this.logger.log(`[SMS] OTP successfully sent to ${normalizedPhone}`);
          return true;
        } else {
          this.logger.warn(
            `[SMS] Gateway responded with failure: ${JSON.stringify(data)}. Fallback OTP is: ${otp}`,
          );
          return false;
        }
      }

      // 2. Custom REST Gateway (e.g. miyahosting / MSG91 / instantalerts / generic URL endpoint)
      if (endpoint) {
        const url = new URL(endpoint);

        // Check route channel: '4' for transactional/alerts, '1' for promotional
        let routeVal = '4';
        const channel = (config.route_channel || '').toLowerCase();
        if (channel.includes('promo')) {
          routeVal = '1';
        } else if (/^\d+$/.test(channel)) {
          routeVal = channel;
        }

        const isMiyahostingOrMsg91 =
          endpoint.includes('sendhttp.php') ||
          endpoint.includes('miyahosting') ||
          endpoint.includes('msg91');

        if (isMiyahostingOrMsg91) {
          // Standard sendhttp.php / MSG91 parameters
          url.searchParams.set('authkey', apiKey);
          url.searchParams.set('sender', senderId);
          url.searchParams.set('mobiles', `91${normalizedPhone}`);
          url.searchParams.set('country', '91');
          url.searchParams.set('message', messageText);
          url.searchParams.set('route', routeVal);
          url.searchParams.set('response', 'json');
          if (dltTemplateId) {
            url.searchParams.set('DLT_TE_ID', dltTemplateId);
            url.searchParams.set('dlt_te_id', dltTemplateId);
            url.searchParams.set('template_id', dltTemplateId);
          }
        } else {
          // Generic Custom REST Gateway: populate standard parameters
          url.searchParams.set('apikey', apiKey);
          url.searchParams.set('authkey', apiKey);
          url.searchParams.set('sender', senderId);
          url.searchParams.set('mobileno', normalizedPhone);
          url.searchParams.set('mobiles', `91${normalizedPhone}`);
          url.searchParams.set('country', '91');
          url.searchParams.set('msg', messageText);
          url.searchParams.set('message', messageText);
          url.searchParams.set('route', routeVal);
          url.searchParams.set('response', 'json');
          if (dltTemplateId) {
            url.searchParams.set('DLT_TE_ID', dltTemplateId);
            url.searchParams.set('dlt_te_id', dltTemplateId);
            url.searchParams.set('template_id', dltTemplateId);
          }
        }

        const res = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseText = (await res.text().catch(() => '')).trim();
        const lower = responseText.toLowerCase();

        const isFailure =
          !res.ok ||
          lower.includes('authentication failure') ||
          lower.includes('parameter are missing') ||
          lower.includes('invalid') ||
          lower.includes('insufficient') ||
          lower.includes('error');

        if (!isFailure && responseText.length > 0) {
          this.logger.log(
            `[SMS] Custom gateway accepted SMS to ${normalizedPhone}: ${responseText}`,
          );
          return true;
        } else {
          this.logger.warn(
            `[SMS] Custom gateway rejected SMS to ${normalizedPhone} (status: ${res.status}): ${responseText}. Fallback OTP: ${otp}`,
          );
          return false;
        }
      }

      clearTimeout(timeoutId);
      return false;
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.developer.error(`[SMS] Failed to send OTP to ${normalizedPhone}`, {
        err: err?.message,
        fallbackOtp: otp,
      });
      console.warn(`[SMS] Delivery failed for ${normalizedPhone}. OTP is: ${otp} (or master test OTP: 123456)`);
      return false;
    }
  }
}
