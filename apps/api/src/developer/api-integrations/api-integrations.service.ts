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

  async saveConfig(category: string, body: any) {
    try {
      const { id, config_key, name, provider, is_active, ...restConfig } = body;
      const configDataJson = JSON.stringify(restConfig);

      if (id) {
        const sql = `
          UPDATE api_integrations_config
          SET config_key = $1, name = $2, provider = $3, is_active = $4, config_data = $5::jsonb, updated_at = CURRENT_TIMESTAMP
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

  // ── SMS DLT Templates ──
  async getSmsTemplates() {
    try {
      const sql = `
        SELECT id, template_key, name, dlt_template_id, dlt_sender_id, placeholders, body, is_active, created_at, updated_at
        FROM sms_dlt_templates
        ORDER BY created_at ASC;
      `;
      const rows = await this.db.query(sql);
      return { status: true, data: Array.isArray(rows) ? rows : [] };
    } catch (error) {
      this.developer.error('Error fetching SMS DLT templates', { error });
      return { status: false, message: 'Failed to fetch templates', data: [] };
    }
  }

  async saveSmsTemplate(body: any) {
    try {
      const { id, template_key, name, dlt_template_id, dlt_sender_id, placeholders, body: templateBody, is_active } = body;

      const parsedPlaceholders = Array.isArray(placeholders)
        ? placeholders
        : typeof placeholders === 'string'
          ? placeholders.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

      if (id) {
        const sql = `
          UPDATE sms_dlt_templates
          SET template_key = $1, name = $2, dlt_template_id = $3, dlt_sender_id = $4, placeholders = $5, body = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
          RETURNING *;
        `;
        const rows = await this.db.query(sql, [
          template_key,
          name,
          dlt_template_id || null,
          dlt_sender_id || null,
          parsedPlaceholders,
          templateBody,
          is_active !== undefined ? is_active : true,
          id,
        ]);
        return { status: true, message: 'Template updated successfully', data: rows[0] };
      } else {
        const sql = `
          INSERT INTO sms_dlt_templates (template_key, name, dlt_template_id, dlt_sender_id, placeholders, body, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *;
        `;
        const rows = await this.db.query(sql, [
          template_key,
          name,
          dlt_template_id || null,
          dlt_sender_id || null,
          parsedPlaceholders,
          templateBody,
          is_active !== undefined ? is_active : true,
        ]);
        return { status: true, message: 'Template created successfully', data: rows[0] };
      }
    } catch (error: any) {
      this.developer.error('Error saving SMS DLT template', { error, body });
      return { status: false, message: error?.message || 'Failed to save template' };
    }
  }

  async deleteSmsTemplate(id: string) {
    try {
      const sql = `DELETE FROM sms_dlt_templates WHERE id = $1 RETURNING id;`;
      const rows = await this.db.query(sql, [id]);
      if (!rows || rows.length === 0) {
        throw new NotFoundException('Template not found');
      }
      return { status: true, message: 'Template deleted successfully' };
    } catch (error: any) {
      this.developer.error(`Error deleting template ${id}`, { error });
      return { status: false, message: error?.message || 'Failed to delete template' };
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
}
