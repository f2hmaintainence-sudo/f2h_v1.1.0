// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : razorpay.service.ts
// Description : Razorpay gateway client. Credentials are resolved from the
//               `api_integrations_config` table (Admin → Developer → API
//               Integrations → Payment Gateway) with env vars as fallback, so
//               keys can be rotated without a redeploy.
//
// ============================================================================

import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/Database.service';
import { DeveloperService } from '../logger/Developer.service';

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';
const CONFIG_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 20_000;

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: 'test' | 'live';
  currency: string;
  themeColor: string;
  companyName: string;
  companyDescription: string;
  merchantId: string;
  isActive: boolean;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
  notes: Record<string, any>;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string | null;
  method: string | null;
  captured: boolean;
  email?: string;
  contact?: string;
  error_code?: string | null;
  error_description?: string | null;
  notes?: Record<string, any>;
}

@Injectable()
export class RazorpayService {
  private configCache: { value: RazorpayConfig; expiresAt: number } | null =
    null;

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Configuration
  // ──────────────────────────────────────────────────────────────────────────

  /** Drop the cached credentials — called whenever an admin saves the config. */
  invalidateConfigCache(): void {
    this.configCache = null;
  }

  async getConfig(forceRefresh = false): Promise<RazorpayConfig> {
    if (
      !forceRefresh &&
      this.configCache &&
      this.configCache.expiresAt > Date.now()
    ) {
      return this.configCache.value;
    }

    let row: any = null;
    try {
      const rows = await this.db.query(
        `SELECT is_active, config_data
           FROM api_integrations_config
          WHERE category = 'payment-gateway'
            AND (config_key = 'razorpay' OR LOWER(provider) = 'razorpay')
            AND deleted_at IS NULL
          ORDER BY is_active DESC, updated_at DESC
          LIMIT 1`,
      );
      row = rows?.[0] || null;
    } catch (error) {
      this.developer.error('Razorpay config lookup failed', { error });
    }

    const data = row?.config_data || {};

    // The admin modal writes `public_api_key` / `private_api_key`; older rows
    // and env fallbacks use `key_id` / `key_secret`. Accept either shape.
    const config: RazorpayConfig = {
      keyId:
        data.public_api_key ||
        data.key_id ||
        data.keyId ||
        process.env.RAZORPAY_KEY_ID ||
        '',
      keySecret:
        data.private_api_key ||
        data.key_secret ||
        data.keySecret ||
        process.env.RAZORPAY_KEY_SECRET ||
        '',
      webhookSecret:
        data.webhook_secret ||
        data.webhookSecret ||
        process.env.RAZORPAY_WEBHOOK_SECRET ||
        '',
      mode:
        (data.mode || '').toLowerCase() === 'live'
          ? 'live'
          : String(data.public_api_key || data.key_id || '').startsWith(
                'rzp_live',
              )
            ? 'live'
            : 'test',
      currency: data.currency || 'INR',
      themeColor: data.theme_color || '#16A34A',
      companyName: data.company_name || 'F2H Fresh',
      companyDescription:
        data.company_description || 'Farm to Home — Fresh Everyday',
      merchantId: data.merchant_id || '',
      isActive: row ? row.is_active !== false : false,
    };

    this.configCache = {
      value: config,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
    };
    return config;
  }

  /** Credentials usable for a live API call (active row + both keys present). */
  async getActiveConfig(): Promise<RazorpayConfig> {
    const config = await this.getConfig();
    if (!config.isActive) {
      throw new ServiceUnavailableException(
        'Online payments are currently disabled. Please use another payment method.',
      );
    }
    if (!config.keyId || !config.keySecret) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured. Please contact support.',
      );
    }
    return config;
  }

  /** Public (client-safe) subset — never exposes the secret. */
  async getPublicConfig() {
    const config = await this.getConfig();
    return {
      keyId: config.keyId,
      mode: config.mode,
      currency: config.currency,
      themeColor: config.themeColor,
      companyName: config.companyName,
      companyDescription: config.companyDescription,
      enabled: config.isActive && !!config.keyId && !!config.keySecret,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  HTTP plumbing
  // ──────────────────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, any>,
    configOverride?: { keyId: string; keySecret: string },
  ): Promise<T> {
    const creds = configOverride || (await this.getActiveConfig());
    const auth = Buffer.from(
      `${creds.keyId}:${creds.keySecret}`,
      'utf8',
    ).toString('base64');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }

      if (!response.ok) {
        const description =
          payload?.error?.description ||
          payload?.error?.reason ||
          `Razorpay request failed with status ${response.status}`;
        this.developer.error('Razorpay API error', {
          path,
          status: response.status,
          error: payload?.error,
        });
        // 4xx from Razorpay is nearly always a bad request on our side
        // (invalid amount, unknown id); surface it as such.
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestException(description);
        }
        throw new ServiceUnavailableException(description);
      }

      return payload as T;
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      if (error?.name === 'AbortError') {
        throw new ServiceUnavailableException(
          'Payment gateway timed out. Please try again.',
        );
      }
      this.developer.error('Razorpay request failed', {
        path,
        error: error?.message,
      });
      throw new ServiceUnavailableException(
        'Unable to reach the payment gateway. Please try again.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Orders & payments
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * @param amount rupees (converted to paise here — Razorpay is integer-paise only)
   */
  async createOrder(params: {
    amount: number;
    receipt: string;
    notes?: Record<string, any>;
    currency?: string;
  }): Promise<RazorpayOrder> {
    const amountInPaise = Math.round(Number(params.amount) * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }
    if (amountInPaise < 100) {
      throw new BadRequestException('Minimum online payment amount is ₹1');
    }

    const config = await this.getActiveConfig();

    return this.request<RazorpayOrder>('POST', '/orders', {
      amount: amountInPaise,
      currency: params.currency || config.currency || 'INR',
      // Razorpay caps receipt at 40 chars
      receipt: params.receipt.slice(0, 40),
      notes: params.notes || {},
      payment_capture: 1,
    });
  }

  async fetchOrder(orderId: string): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>(
      'GET',
      `/orders/${encodeURIComponent(orderId)}`,
    );
  }

  async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(
      'GET',
      `/payments/${encodeURIComponent(paymentId)}`,
    );
  }

  async capturePayment(
    paymentId: string,
    amount: number,
    currency = 'INR',
  ): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(
      'POST',
      `/payments/${encodeURIComponent(paymentId)}/capture`,
      { amount: Math.round(amount * 100), currency },
    );
  }

  async refundPayment(params: {
    paymentId: string;
    amount?: number;
    notes?: Record<string, any>;
    speed?: 'normal' | 'optimum';
  }): Promise<any> {
    const body: Record<string, any> = {
      speed: params.speed || 'normal',
      notes: params.notes || {},
    };
    if (params.amount !== undefined) {
      body.amount = Math.round(Number(params.amount) * 100);
    }
    return this.request<any>(
      'POST',
      `/payments/${encodeURIComponent(params.paymentId)}/refund`,
      body,
    );
  }

  /**
   * Generates a dynamic single-use UPI QR code for an order/delivery amount.
   * @param params.amount Amount in rupees
   */
  async createQrCode(params: {
    amount: number;
    name?: string;
    description?: string;
    notes?: Record<string, any>;
  }): Promise<{
    id: string;
    image_url: string;
    qr_data?: string;
    payment_amount: number;
    status: string;
  }> {
    const config = await this.getActiveConfig();
    const amountInPaise = Math.round(Number(params.amount) * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      throw new BadRequestException('Invalid payment amount for QR code');
    }

    return this.request<any>('POST', '/payments/qr_codes', {
      type: 'upi_qr',
      name: (params.name || config.companyName || 'F2H Fresh').slice(0, 40),
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: amountInPaise,
      description: (params.description || 'Payment for Order').slice(0, 255),
      notes: params.notes || {},
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Signature verification
  // ──────────────────────────────────────────────────────────────────────────

  /** HMAC-SHA256 of `order_id|payment_id` keyed with the API secret. */
  async verifyCheckoutSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<boolean> {
    const { keySecret } = await this.getActiveConfig();
    if (!params.orderId || !params.paymentId || !params.signature) {
      return false;
    }
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');
    return this.safeCompare(expected, params.signature);
  }

  /** HMAC-SHA256 of the raw webhook body keyed with the webhook secret. */
  async verifyWebhookSignature(
    rawBody: string,
    signature: string,
  ): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.webhookSecret || !signature || !rawBody) {
      return false;
    }
    const expected = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return this.safeCompare(expected, signature);
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Admin diagnostics
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Validates a key pair against the live Razorpay API. Accepts explicit
   * credentials so the admin UI can test keys before they are saved.
   */
  async testConnection(credentials?: {
    keyId?: string;
    keySecret?: string;
  }): Promise<{ status: boolean; message: string; mode?: string }> {
    let keyId = credentials?.keyId;
    let keySecret = credentials?.keySecret;

    if (!keyId || !keySecret) {
      const config = await this.getConfig(true);
      keyId = keyId || config.keyId;
      keySecret = keySecret || config.keySecret;
    }

    if (!keyId || !keySecret) {
      return {
        status: false,
        message: 'Key ID and Key Secret are both required to test the gateway.',
      };
    }

    try {
      // Listing a single order is the cheapest authenticated read; it neither
      // creates nor mutates anything on the merchant account.
      await this.request<any>('GET', '/orders?count=1', undefined, {
        keyId,
        keySecret,
      });
      return {
        status: true,
        message: 'Connection successful — credentials are valid.',
        mode: keyId.startsWith('rzp_live') ? 'live' : 'test',
      };
    } catch (error: any) {
      return {
        status: false,
        message:
          error?.response?.message ||
          error?.message ||
          'Razorpay rejected these credentials.',
      };
    }
  }
}
