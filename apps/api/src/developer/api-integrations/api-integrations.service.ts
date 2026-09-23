// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api-integrations.service.ts
// Description : Service for managing developer API integrations configs & DLT templates
//
// ============================================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/Database.service';
import { DeveloperService } from '../../shared/logger/Developer.service';

@Injectable()
export class ApiIntegrationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) { }

  async getConfigsByCategory(category: string) {
    try {
      const sql = `
        SELECT id, category, config_key, name, provider, is_active, config_data, created_at, updated_at
        FROM api_integrations_config
        WHERE category = $1
        ORDER BY created_at ASC;
      `;
      const rows = await this.db.query(sql, [category]);
      return { status: true, data: Array.isArray(rows) ? rows : [] };
    } catch (error) {
      this.developer.error(`Error fetching configs for ${category}`, { error });
      return { status: false, message: 'Failed to fetch configurations', data: [] };
    }
  }

  /**
   * Fields whose stored value must survive an empty form input.
   *
   * The admin modals render secrets as blank password boxes, so "I did not
   * retype the key" and "I want the key cleared" arrive as the same empty
   * string. Treating blank as no-change is the safer reading — clearing one is
   * done by deleting the config.
   */
  private static readonly SECRET_FIELDS = [
    'private_api_key',
    'webhook_secret',
    'smtp_pass',
    'api_secret',
    'auth_token',
    'private_key',
  ];

  /** Drops keys the caller left blank so a merge cannot erase a stored secret. */
  private stripBlankSecrets(config: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(config)) {
      const isBlank = value === '' || value === null || value === undefined;
      if (isBlank && ApiIntegrationsService.SECRET_FIELDS.includes(key)) continue;
      cleaned[key] = value;
    }
    return cleaned;
  }

  async saveConfig(category: string, body: any) {
    try {
      let { id, config_key, name, provider, is_active, ...restConfig } = body;

      // If user pasted a full URL or query string into the SMS auth_token field, extract the clean key
      if (category === 'sms' && restConfig.auth_token) {
        const raw = String(restConfig.auth_token).trim();
        const match = raw.match(/(?:authkey|apikey|api_key)=([^&]+)/);
        if (match) {
          restConfig.auth_token = match[1];
        }
      }

      const configDataJson = JSON.stringify(this.stripBlankSecrets(restConfig));

      // For payment-gateway, allow only one payment gateway configuration in the system
      if (category === 'payment-gateway' && !id) {
        const existing = await this.db.query(
          `SELECT id FROM api_integrations_config WHERE category = 'payment-gateway' AND deleted_at IS NULL LIMIT 1`,
        );
        if (existing && existing.length > 0) {
          id = existing[0].id;
        }
      }

      if (id) {
        // `||` merges rather than replaces. A wholesale assignment here deleted
        // every field the modal has no input for — editing the Razorpay row from
        // the panel silently dropped mode, currency, theme_color, company_name
        // and company_description.
        const sql = `
          UPDATE api_integrations_config
          SET config_key = $1, name = $2, provider = $3, is_active = $4,
              config_data = config_data || $5::jsonb, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6 AND category = $7
          RETURNING *;
        `;
        const rows = await this.db.query(sql, [
          config_key,
          name,
          provider || category,
          is_active !== undefined ? is_active : true,
          configDataJson,
          id,
          category,
        ]);

        if (category === 'payment-gateway' && (is_active === true || is_active === undefined)) {
          await this.db.query(
            `UPDATE api_integrations_config SET is_active = false WHERE category = 'payment-gateway' AND id != $1`,
            [id],
          );
        }

        return { status: true, message: 'Configuration updated successfully', data: rows[0] };
      } else {
        const sql = `
          INSERT INTO api_integrations_config (category, config_key, name, provider, is_active, config_data)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          RETURNING *;
        `;
        const rows = await this.db.query(sql, [
          category,
          config_key,
          name,
          provider || category,
          is_active !== undefined ? is_active : true,
          configDataJson,
        ]);

        if (category === 'payment-gateway' && (is_active === true || is_active === undefined) && rows[0]?.id) {
          await this.db.query(
            `UPDATE api_integrations_config SET is_active = false WHERE category = 'payment-gateway' AND id != $1`,
            [rows[0].id],
          );
        }

        return { status: true, message: 'Configuration saved successfully', data: rows[0] };
      }
    } catch (error: any) {
      this.developer.error(`Error saving config for ${category}`, { error, body });
      return { status: false, message: error?.message || 'Failed to save configuration' };
    }
  }

  async deleteConfig(category: string, id: string) {
    try {
      const sql = `DELETE FROM api_integrations_config WHERE id = $1 AND category = $2 RETURNING id;`;
      const rows = await this.db.query(sql, [id, category]);
      if (!rows || rows.length === 0) {
        throw new NotFoundException('Configuration not found');
      }
      return { status: true, message: 'Configuration deleted successfully' };
    } catch (error: any) {
      this.developer.error(`Error deleting config ${id}`, { error });
      return { status: false, message: error?.message || 'Failed to delete configuration' };
    }
  }

  // ── Public Client App Configuration ──
  async getClientAppConfig() {
    try {
      const sql = `
        SELECT category, config_key, provider, config_data
        FROM api_integrations_config
        WHERE is_active = true AND category IN ('firebase', 'oauth', 'maps', 'payment-gateway', 'general');
      `;
      const rows: any[] = await this.db.query(sql);
      const dbConfigs: Record<string, any> = {};

      if (Array.isArray(rows)) {
        for (const row of rows) {
          dbConfigs[`${row.category}:${row.config_key}`] = row.config_data || {};
        }
      }

      // Default fallback values, used only when the table has no row. These are
      // the `f2h-fresh` project's Android values; the retired `f2hfresh-65beb`
      // credentials that used to sit here were removed with the project. No iOS
      // app exists in the project yet, so iOS is left empty rather than pointed
      // at an app id that would fail at Firebase.initializeApp.
      const firebaseConfig = dbConfigs['firebase:client'] || {
        apiKey: process.env.FIREBASE_ANDROID_API_KEY || 'AIzaSyAM1WRkJSfx4PTbuIkl4w4A09mCSH777js',
        appId: process.env.FIREBASE_ANDROID_APP_ID || '1:842214638527:android:1800c0a5729eb74823d70a',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '842214638527',
        projectId: process.env.FIREBASE_PROJECT_ID || 'f2h-fresh',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'f2h-fresh.firebasestorage.app',
        iosApiKey: process.env.FIREBASE_IOS_API_KEY || '',
        iosAppId: process.env.FIREBASE_IOS_APP_ID || '',
        iosBundleId: process.env.FIREBASE_IOS_BUNDLE_ID || 'com.f2h.customer',
      };

      const googleOauth = dbConfigs['oauth:google'] || {
        serverClientId: process.env.GOOGLE_CLIENT_ID || '',
        webClientId: process.env.GOOGLE_CLIENT_ID || '',
      };

      const mapsConfig = dbConfigs['maps:google_maps'] || {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      };

      const razorpayConfig = dbConfigs['payment-gateway:razorpay'] || {
        keyId: process.env.RAZORPAY_KEY_ID || '',
      };

      return {
        status: true,
        data: {
          firebase: firebaseConfig,
          google_oauth: googleOauth,
          google_maps: mapsConfig,
          razorpay: razorpayConfig,
          min_order_amount: 100.0,
          free_delivery_threshold: 500.0,
          support_phone: '+919876543210',
          support_email: 'support@f2hfresh.com',
          maintenance_mode: false,
        },
      };
    } catch (error: any) {
      this.developer.error('Error fetching client app config', { error });
      return {
        status: false,
        message: 'Failed to fetch client app configuration',
        data: {},
      };
    }
  }

  // ── DLT / Message Templates by Category (e.g. sms/templates) ──
  async getTemplatesByCategory(category: string) {
    try {
      const sql = `
        SELECT id, category, config_key, name, provider, is_active, config_data, created_at, updated_at
        FROM api_integrations_config
        WHERE (category = $1 OR category = $2) AND deleted_at IS NULL
        ORDER BY created_at ASC;
      `;
      const rows = await this.db.query(sql, [`${category}-template`, `${category}_template`]);
      const list = (Array.isArray(rows) ? rows : []).map((r: any) => {
        const data = typeof r.config_data === 'string' ? JSON.parse(r.config_data) : (r.config_data || {});
        return {
          id: r.id,
          template_key: r.config_key,
          name: r.name,
          dlt_template_id: data.dlt_template_id || '',
          dlt_sender_id: data.dlt_sender_id || r.provider || '',
          placeholders: Array.isArray(data.placeholders)
            ? data.placeholders
            : typeof data.placeholders === 'string'
              ? data.placeholders.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [],
          body: data.body || '',
          is_active: r.is_active,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
      return { status: true, data: list };
    } catch (error) {
      this.developer.error(`Error fetching templates for ${category}`, { error });
      return { status: false, message: 'Failed to fetch templates', data: [] };
    }
  }

  async saveTemplate(category: string, body: any) {
    try {
      const { id, template_key, name, dlt_template_id, dlt_sender_id, placeholders, body: templateBody } = body;
      const templateCategory = `${category}-template`;

      const placeholdersArray = Array.isArray(placeholders)
        ? placeholders
        : typeof placeholders === 'string'
          ? placeholders.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

      const configData = {
        dlt_template_id: dlt_template_id || '',
        dlt_sender_id: dlt_sender_id || '',
        placeholders: placeholdersArray,
        body: templateBody || '',
      };
      const configDataJson = JSON.stringify(configData);

      if (id) {
        const sql = `
          UPDATE api_integrations_config
          SET config_key = $1,
              name = $2,
              provider = $3,
              config_data = $4::jsonb,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 AND (category = $6 OR category = $7)
          RETURNING *;
        `;
        const rows = await this.db.query(sql, [
          template_key,
          name,
          dlt_sender_id || 'DLT',
          configDataJson,
          id,
          templateCategory,
          `${category}_template`,
        ]);

        if (!rows || rows.length === 0) {
          throw new NotFoundException('Template not found');
        }

        const r = rows[0];
        const data = typeof r.config_data === 'string' ? JSON.parse(r.config_data) : (r.config_data || {});
        return {
          status: true,
          message: 'Template updated successfully',
          data: {
            id: r.id,
            template_key: r.config_key,
            name: r.name,
            dlt_template_id: data.dlt_template_id || '',
            dlt_sender_id: data.dlt_sender_id || r.provider || '',
            placeholders: data.placeholders || [],
            body: data.body || '',
            is_active: r.is_active,
            created_at: r.created_at,
            updated_at: r.updated_at,
          },
        };
      } else {
        const sql = `
          INSERT INTO api_integrations_config (category, config_key, name, provider, is_active, config_data)
          VALUES ($1, $2, $3, $4, true, $5::jsonb)
          RETURNING *;
        `;
        const rows = await this.db.query(sql, [
          templateCategory,
          template_key,
          name,
          dlt_sender_id || 'DLT',
          configDataJson,
        ]);

        const r = rows[0];
        const data = typeof r.config_data === 'string' ? JSON.parse(r.config_data) : (r.config_data || {});
        return {
          status: true,
          message: 'Template created successfully',
          data: {
            id: r.id,
            template_key: r.config_key,
            name: r.name,
            dlt_template_id: data.dlt_template_id || '',
            dlt_sender_id: data.dlt_sender_id || r.provider || '',
            placeholders: data.placeholders || [],
            body: data.body || '',
            is_active: r.is_active,
            created_at: r.created_at,
            updated_at: r.updated_at,
          },
        };
      }
    } catch (error: any) {
      this.developer.error(`Error saving template for ${category}`, { error, body });
      return { status: false, message: error?.message || 'Failed to save template' };
    }
  }

  async deleteTemplate(category: string, id: string) {
    try {
      const sql = `
        DELETE FROM api_integrations_config
        WHERE id = $1 AND (category = $2 OR category = $3)
        RETURNING id;
      `;
      const rows = await this.db.query(sql, [
        id,
        `${category}-template`,
        `${category}_template`,
      ]);
      if (!rows || rows.length === 0) {
        throw new NotFoundException('Template not found');
      }
      return { status: true, message: 'Template deleted successfully' };
    } catch (error: any) {
      this.developer.error(`Error deleting template ${id}`, { error });
      return { status: false, message: error?.message || 'Failed to delete template' };
    }
  }
}
