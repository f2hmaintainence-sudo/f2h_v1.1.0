import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

export type SubscriptionBillingCycle = 'weekly' | 'monthly' | 'custom';
export type FrequencyType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface CatalogSubscriptionConfig {
  pauses_allowed: boolean;
  skips_allowed: boolean;
  modifications_allowed: boolean;
  auto_renew_allowed: boolean;
  billing_cycles: SubscriptionBillingCycle[];
  default_billing_cycle: SubscriptionBillingCycle;
  min_subscription_days: number;
  max_pause_days_per_request: number;
  max_pauses_per_month: number;
  max_pauses_per_year: number;
  pause_notice_hours: number;
  modification_notice_hours: number;
  billing_cutoff_day: number;
  renewal_grace_days: number;
  trial_allowed: boolean;
  trial_days: number;
  admin_notes: string;
}

export interface SubscriptionGlobalConfig {
  id?: number;
  subscriptions_enabled: boolean;
  pauses_allowed: boolean;
  skips_allowed: boolean;
  modifications_allowed: boolean;
  auto_renew_allowed: boolean;
  daily_cutoff_time: string; // HH:mm format
  cutoff_timezone: string;
  minimum_start_notice_hours: number;
  reserve_inventory_for_subscriptions: boolean;
  auto_pause_on_payment_failure: boolean;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductSubscriptionRule {
  id?: number;
  product_id: number;
  subscription_allowed: boolean;
  subscription_only: boolean;
  min_quantity: number;
  max_quantity: number;
  quantity_step: number;
  default_quantity: number;
  default_frequency: FrequencyType;
  morning_slot_allowed: boolean;
  evening_slot_allowed: boolean;
  inventory_reserved: boolean;
  is_active: boolean;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionDeliverySlot {
  id?: number;
  code: string;
  name: string;
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  is_active: boolean;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductSubscriptionFrequency {
  id?: number;
  product_subscription_rule_id: number;
  frequency_type: FrequencyType;
  interval_days: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductSubscriptionSlotRule {
  id?: number;
  product_subscription_rule_id: number;
  delivery_slot_id: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_CONFIG: CatalogSubscriptionConfig = {
  pauses_allowed: true,
  skips_allowed: true,
  modifications_allowed: true,
  auto_renew_allowed: true,
  billing_cycles: ['monthly', 'weekly'],
  default_billing_cycle: 'monthly',
  min_subscription_days: 7,
  max_pause_days_per_request: 14,
  max_pauses_per_month: 2,
  max_pauses_per_year: 12,
  pause_notice_hours: 24,
  modification_notice_hours: 12,
  billing_cutoff_day: 25,
  renewal_grace_days: 3,
  trial_allowed: false,
  trial_days: 0,
  admin_notes: '',
};

const DEFAULT_GLOBAL_CONFIG: SubscriptionGlobalConfig = {
  subscriptions_enabled: true,
  pauses_allowed: true,
  skips_allowed: true,
  modifications_allowed: true,
  auto_renew_allowed: true,
  daily_cutoff_time: '23:59',
  cutoff_timezone: 'Asia/Kolkata',
  minimum_start_notice_hours: 12,
  reserve_inventory_for_subscriptions: true,
  auto_pause_on_payment_failure: true,
};

const DEFAULT_PRODUCT_RULE: ProductSubscriptionRule = {
  subscription_allowed: false,
  product_id: 0,
  subscription_only: false,
  min_quantity: 1,
  max_quantity: 10,
  quantity_step: 1,
  default_quantity: 1,
  default_frequency: 'monthly',
  morning_slot_allowed: true,
  evening_slot_allowed: false,
  inventory_reserved: true,
  is_active: true,
};

const BOOLEAN_FIELDS = [
  'pauses_allowed',
  'skips_allowed',
  'modifications_allowed',
  'auto_renew_allowed',
  'trial_allowed',
] as const;

const NUMBER_FIELDS = [
  'min_subscription_days',
  'max_pause_days_per_request',
  'max_pauses_per_month',
  'max_pauses_per_year',
  'pause_notice_hours',
  'modification_notice_hours',
  'billing_cutoff_day',
  'renewal_grace_days',
  'trial_days',
] as const;

const ALLOWED_CYCLES: SubscriptionBillingCycle[] = [
  'weekly',
  'monthly',
  'custom',
];

@Injectable()
export class CatalogSubscriptionConfigService {
  constructor(
    private readonly db: DatabaseService,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) {}

  async getConfig() {
    try {
      // await this.ensureTable();
      const row = await this.fetchConfigRow();

      return {
        status: true,
        data: row ? this.mapRow(row) : DEFAULT_CONFIG,
        message: 'Subscription configuration loaded',
      };
    } catch (error) {
      this.developer.error('CatalogSubscriptionConfigService.getConfig error', {
        error,
      });
      throw new InternalServerErrorException(
        'Failed to load subscription configuration',
      );
    }
  }

  async saveConfig(body: any, adminId: string) {
    try {
      // await this.ensureTable();
      const config = this.validateConfig(body);

      await this.db.query(
        `
        INSERT INTO catalog_subscription_config (
          config_key,
          pauses_allowed,
          skips_allowed,
          modifications_allowed,
          auto_renew_allowed,
          billing_cycles,
          default_billing_cycle,
          min_subscription_days,
          max_pause_days_per_request,
          max_pauses_per_month,
          max_pauses_per_year,
          pause_notice_hours,
          modification_notice_hours,
          billing_cutoff_day,
          renewal_grace_days,
          trial_allowed,
          trial_days,
          admin_notes,
          created_by,
          updated_by
        )
        VALUES (
          'default',
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $18
        )
        ON CONFLICT (config_key)
        DO UPDATE SET
          pauses_allowed = EXCLUDED.pauses_allowed,
          skips_allowed = EXCLUDED.skips_allowed,
          modifications_allowed = EXCLUDED.modifications_allowed,
          auto_renew_allowed = EXCLUDED.auto_renew_allowed,
          billing_cycles = EXCLUDED.billing_cycles,
          default_billing_cycle = EXCLUDED.default_billing_cycle,
          min_subscription_days = EXCLUDED.min_subscription_days,
          max_pause_days_per_request = EXCLUDED.max_pause_days_per_request,
          max_pauses_per_month = EXCLUDED.max_pauses_per_month,
          max_pauses_per_year = EXCLUDED.max_pauses_per_year,
          pause_notice_hours = EXCLUDED.pause_notice_hours,
          modification_notice_hours = EXCLUDED.modification_notice_hours,
          billing_cutoff_day = EXCLUDED.billing_cutoff_day,
          renewal_grace_days = EXCLUDED.renewal_grace_days,
          trial_allowed = EXCLUDED.trial_allowed,
          trial_days = EXCLUDED.trial_days,
          admin_notes = EXCLUDED.admin_notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
        `,
        [
          config.pauses_allowed,
          config.skips_allowed,
          config.modifications_allowed,
          config.auto_renew_allowed,
          JSON.stringify(config.billing_cycles),
          config.default_billing_cycle,
          config.min_subscription_days,
          config.max_pause_days_per_request,
          config.max_pauses_per_month,
          config.max_pauses_per_year,
          config.pause_notice_hours,
          config.modification_notice_hours,
          config.billing_cutoff_day,
          config.renewal_grace_days,
          config.trial_allowed,
          config.trial_days,
          config.admin_notes,
          adminId,
        ],
      );

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'catalog_subscription_config_update',
        target_type: 'catalog_subscription_config',
        target_id: 'default',
        details: JSON.stringify(config),
      });

      return {
        status: true,
        data: config,
        message: 'Subscription configuration saved',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('CatalogSubscriptionConfigService.saveConfig error', {
        error,
      });
      throw new InternalServerErrorException(
        'Failed to save subscription configuration',
      );
    }
  }

  // private async ensureTable() {
  //   await this.db.query(`
  //     CREATE TABLE IF NOT EXISTS catalog_subscription_config (
  //       id BIGSERIAL PRIMARY KEY,
  //       config_key VARCHAR(50) NOT NULL UNIQUE DEFAULT 'default',
  //       pauses_allowed BOOLEAN NOT NULL DEFAULT true,
  //       skips_allowed BOOLEAN NOT NULL DEFAULT true,
  //       modifications_allowed BOOLEAN NOT NULL DEFAULT true,
  //       auto_renew_allowed BOOLEAN NOT NULL DEFAULT true,
  //       billing_cycles JSONB NOT NULL DEFAULT '["monthly"]'::jsonb,
  //       default_billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  //       min_subscription_days INTEGER NOT NULL DEFAULT 7,
  //       max_pause_days_per_request INTEGER NOT NULL DEFAULT 14,
  //       max_pauses_per_month INTEGER NOT NULL DEFAULT 2,
  //       max_pauses_per_year INTEGER NOT NULL DEFAULT 12,
  //       pause_notice_hours INTEGER NOT NULL DEFAULT 24,
  //       modification_notice_hours INTEGER NOT NULL DEFAULT 12,
  //       billing_cutoff_day INTEGER NOT NULL DEFAULT 25,
  //       renewal_grace_days INTEGER NOT NULL DEFAULT 3,
  //       trial_allowed BOOLEAN NOT NULL DEFAULT false,
  //       trial_days INTEGER NOT NULL DEFAULT 0,
  //       admin_notes TEXT,
  //       created_by VARCHAR(30),
  //       updated_by VARCHAR(30),
  //       created_at TIMESTAMPTZ DEFAULT now(),
  //       updated_at TIMESTAMPTZ DEFAULT now()
  //     )
  //   `);
  // }

  private async fetchConfigRow() {
    const rows = await this.db.query<any>(
      `
      SELECT *
      FROM catalog_subscription_config
      WHERE config_key = $1
      LIMIT 1
      `,
      ['default'],
    );

    return rows[0] || null;
  }

  private mapRow(row: any): CatalogSubscriptionConfig {
    return {
      ...DEFAULT_CONFIG,
      ...row,
      billing_cycles: this.normalizeBillingCycles(row.billing_cycles),
      admin_notes: row.admin_notes || '',
    };
  }

  private validateConfig(body: any): CatalogSubscriptionConfig {
    const next: CatalogSubscriptionConfig = { ...DEFAULT_CONFIG };

    for (const field of BOOLEAN_FIELDS) {
      if (body?.[field] !== undefined) {
        next[field] = Boolean(body[field]);
      }
    }

    for (const field of NUMBER_FIELDS) {
      if (body?.[field] !== undefined) {
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < 0) {
          throw new BadRequestException({
            status: false,
            message: `${field} must be a positive number`,
          });
        }
        next[field] = Math.floor(value);
      }
    }

    next.billing_cycles = this.normalizeBillingCycles(body?.billing_cycles);

    if (body?.default_billing_cycle) {
      next.default_billing_cycle = body.default_billing_cycle;
    }

    if (!ALLOWED_CYCLES.includes(next.default_billing_cycle)) {
      throw new BadRequestException({
        status: false,
        message: 'Default billing cycle is invalid',
      });
    }

    if (!next.billing_cycles.includes(next.default_billing_cycle)) {
      next.billing_cycles.push(next.default_billing_cycle);
    }

    if (next.billing_cutoff_day < 1 || next.billing_cutoff_day > 31) {
      throw new BadRequestException({
        status: false,
        message: 'Billing cutoff day must be between 1 and 31',
      });
    }

    if (next.max_pauses_per_month > next.max_pauses_per_year) {
      throw new BadRequestException({
        status: false,
        message: 'Monthly pauses cannot exceed yearly pauses',
      });
    }

    if (!next.trial_allowed) {
      next.trial_days = 0;
    }

    next.admin_notes =
      typeof body?.admin_notes === 'string'
        ? body.admin_notes.trim().slice(0, 1000)
        : '';

    return next;
  }

  private normalizeBillingCycles(value: any): SubscriptionBillingCycle[] {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? this.parseBillingCycles(value)
        : DEFAULT_CONFIG.billing_cycles;

    const cycles = raw.filter((cycle: any): cycle is SubscriptionBillingCycle =>
      ALLOWED_CYCLES.includes(cycle),
    );

    return cycles.length ? Array.from(new Set(cycles)) : ['monthly'];
  }

  private parseBillingCycles(value: string): any[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // ==================== GLOBAL CONFIG METHODS ====================

  async getGlobalConfig() {
    try {
      const row = await this.fetchGlobalConfigRow();
      return {
        status: true,
        data: row ? this.mapGlobalConfigRow(row) : DEFAULT_GLOBAL_CONFIG,
        message: 'Global subscription configuration loaded',
      };
    } catch (error) {
      this.developer.error(
        'CatalogSubscriptionConfigService.getGlobalConfig error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to load global subscription configuration',
      );
    }
  }

  async saveGlobalConfig(body: any, adminId: string) {
    try {
      const config = this.validateGlobalConfig(body);

      await this.db.query(
        `
        INSERT INTO subscription_global_config (
          subscriptions_enabled,
          pauses_allowed,
          skips_allowed,
          modifications_allowed,
          auto_renew_allowed,
          daily_cutoff_time,
          cutoff_timezone,
          minimum_start_notice_hours,
          reserve_inventory_for_subscriptions,
          auto_pause_on_payment_failure,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::TIME, $7, $8, $9, $10, $11, $11)
        ON CONFLICT (id)
        DO UPDATE SET
          subscriptions_enabled = EXCLUDED.subscriptions_enabled,
          pauses_allowed = EXCLUDED.pauses_allowed,
          skips_allowed = EXCLUDED.skips_allowed,
          modifications_allowed = EXCLUDED.modifications_allowed,
          auto_renew_allowed = EXCLUDED.auto_renew_allowed,
          daily_cutoff_time = EXCLUDED.daily_cutoff_time,
          cutoff_timezone = EXCLUDED.cutoff_timezone,
          minimum_start_notice_hours = EXCLUDED.minimum_start_notice_hours,
          reserve_inventory_for_subscriptions = EXCLUDED.reserve_inventory_for_subscriptions,
          auto_pause_on_payment_failure = EXCLUDED.auto_pause_on_payment_failure,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        `,
        [
          config.subscriptions_enabled,
          config.pauses_allowed,
          config.skips_allowed,
          config.modifications_allowed,
          config.auto_renew_allowed,
          config.daily_cutoff_time,
          config.cutoff_timezone,
          config.minimum_start_notice_hours,
          config.reserve_inventory_for_subscriptions,
          config.auto_pause_on_payment_failure,
          adminId,
        ],
      );

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'subscription_global_config_update',
        target_type: 'subscription_global_config',
        target_id: '1',
        details: JSON.stringify(config),
      });

      return {
        status: true,
        data: config,
        message: 'Global subscription configuration saved',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error(
        'CatalogSubscriptionConfigService.saveGlobalConfig error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to save global subscription configuration',
      );
    }
  }

  // ==================== PRODUCT SUBSCRIPTION RULES ====================

  async getProductSubscriptionRules() {
    try {
      const rows = await this.db.query<ProductSubscriptionRule>(
        `
        SELECT * FROM product_subscription_rules
        WHERE deleted_at IS NULL
        ORDER BY product_id ASC
        `,
      );

      return {
        status: true,
        data: rows,
        message: 'Product subscription rules loaded',
      };
    } catch (error) {
      this.developer.error(
        'CatalogSubscriptionConfigService.getProductSubscriptionRules error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to load product subscription rules',
      );
    }
  }

  async getProductSubscriptionRule(productId: number) {
    try {
      const row = await this.db.query<ProductSubscriptionRule>(
        `
        SELECT * FROM product_subscription_rules
        WHERE product_id = $1 AND deleted_at IS NULL
        LIMIT 1
        `,
        [productId],
      );

      if (!row || row.length === 0) {
        return {
          status: true,
          data: { ...DEFAULT_PRODUCT_RULE, product_id: productId },
          message: 'Product subscription rule not found, returning defaults',
        };
      }

      return {
        status: true,
        data: row[0],
        message: 'Product subscription rule loaded',
      };
    } catch (error) {
      this.developer.error(
        'CatalogSubscriptionConfigService.getProductSubscriptionRule error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to load product subscription rule',
      );
    }
  }

  async saveProductSubscriptionRule(
    productId: number,
    body: any,
    adminId: string,
  ) {
    try {
      const rule = this.validateProductSubscriptionRule(body);

      const result = await this.db.query<any>(
        `
        INSERT INTO product_subscription_rules (
          product_id,
          subscription_allowed,
          subscription_only,
          min_quantity,
          max_quantity,
          quantity_step,
          default_quantity,
          default_frequency,
          morning_slot_allowed,
          evening_slot_allowed,
          inventory_reserved,
          is_active,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
        ON CONFLICT (product_id)
        DO UPDATE SET
          subscription_allowed = EXCLUDED.subscription_allowed,
          subscription_only = EXCLUDED.subscription_only,
          min_quantity = EXCLUDED.min_quantity,
          max_quantity = EXCLUDED.max_quantity,
          quantity_step = EXCLUDED.quantity_step,
          default_quantity = EXCLUDED.default_quantity,
          default_frequency = EXCLUDED.default_frequency,
          morning_slot_allowed = EXCLUDED.morning_slot_allowed,
          evening_slot_allowed = EXCLUDED.evening_slot_allowed,
          inventory_reserved = EXCLUDED.inventory_reserved,
          is_active = EXCLUDED.is_active,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING id
        `,
        [
          productId,
          rule.subscription_allowed,
          rule.subscription_only,
          rule.min_quantity,
          rule.max_quantity,
          rule.quantity_step,
          rule.default_quantity,
          rule.default_frequency,
          rule.morning_slot_allowed,
          rule.evening_slot_allowed,
          rule.inventory_reserved,
          rule.is_active,
          adminId,
        ],
      );

      const ruleId = result[0]?.id;

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'product_subscription_rule_update',
        target_type: 'product_subscription_rule',
        target_id: ruleId,
        details: JSON.stringify({ product_id: productId, ...rule }),
      });

      return {
        status: true,
        data: { id: ruleId, product_id: productId, ...rule },
        message: 'Product subscription rule saved',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error(
        'CatalogSubscriptionConfigService.saveProductSubscriptionRule error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to save product subscription rule',
      );
    }
  }

  // ==================== DELIVERY SLOTS ====================

  async getDeliverySlots() {
    try {
      const rows = await this.db.query<SubscriptionDeliverySlot>(
        `
        SELECT * FROM subscription_delivery_slots
        WHERE deleted_at IS NULL
        ORDER BY start_time ASC
        `,
      );

      return {
        status: true,
        data: rows,
        message: 'Delivery slots loaded',
      };
    } catch (error) {
      this.developer.error(
        'CatalogSubscriptionConfigService.getDeliverySlots error',
        { error },
      );
      throw new InternalServerErrorException('Failed to load delivery slots');
    }
  }

  async saveDeliverySlot(body: any, adminId: string) {
    try {
      const slot = this.validateDeliverySlot(body);

      const result = await this.db.query<any>(
        `
        INSERT INTO subscription_delivery_slots (
          code,
          name,
          start_time,
          end_time,
          is_active,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3::TIME, $4::TIME, $5, $6, $6)
        ON CONFLICT (code)
        DO UPDATE SET
          name = EXCLUDED.name,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          is_active = EXCLUDED.is_active,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING id
        `,
        [
          slot.code,
          slot.name,
          slot.start_time,
          slot.end_time,
          slot.is_active,
          adminId,
        ],
      );

      const slotId = result[0]?.id;

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'delivery_slot_create',
        target_type: 'subscription_delivery_slot',
        target_id: slotId,
        details: JSON.stringify(slot),
      });

      return {
        status: true,
        data: { id: slotId, ...slot },
        message: 'Delivery slot saved',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error(
        'CatalogSubscriptionConfigService.saveDeliverySlot error',
        { error },
      );
      throw new InternalServerErrorException('Failed to save delivery slot');
    }
  }

  // ==================== SUBSCRIPTION FREQUENCIES ====================

  async getProductFrequencies(productSubscriptionRuleId: number) {
    try {
      const rows = await this.db.query<ProductSubscriptionFrequency>(
        `
        SELECT * FROM product_subscription_frequencies
        WHERE product_subscription_rule_id = $1 AND deleted_at IS NULL
        ORDER BY frequency_type ASC
        `,
        [productSubscriptionRuleId],
      );

      return {
        status: true,
        data: rows,
        message: 'Product frequencies loaded',
      };
    } catch (error) {
      this.developer.error(
        'CatalogSubscriptionConfigService.getProductFrequencies error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to load product frequencies',
      );
    }
  }

  async saveProductFrequency(
    productSubscriptionRuleId: number,
    body: any,
    adminId: string,
  ) {
    try {
      const frequency = this.validateProductFrequency(body);

      const result = await this.db.query<any>(
        `
        INSERT INTO product_subscription_frequencies (
          product_subscription_rule_id,
          frequency_type,
          interval_days,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $4)
        ON CONFLICT (product_subscription_rule_id, frequency_type)
        DO UPDATE SET
          interval_days = EXCLUDED.interval_days,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING id
        `,
        [
          productSubscriptionRuleId,
          frequency.frequency_type,
          frequency.interval_days,
          adminId,
        ],
      );

      const frequencyId = result[0]?.id;

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'product_frequency_update',
        target_type: 'product_subscription_frequency',
        target_id: frequencyId,
        details: JSON.stringify(frequency),
      });

      return {
        status: true,
        data: { id: frequencyId, product_subscription_rule_id: productSubscriptionRuleId, ...frequency },
        message: 'Product frequency saved',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error(
        'CatalogSubscriptionConfigService.saveProductFrequency error',
        { error },
      );
      throw new InternalServerErrorException('Failed to save product frequency');
    }
  }

  // ==================== SLOT RULES ====================

  async getProductSlotRules(productSubscriptionRuleId: number) {
    try {
      const rows = await this.db.query<any>(
        `
        SELECT psr.*, sds.code, sds.name, sds.start_time, sds.end_time
        FROM product_subscription_slot_rules psr
        JOIN subscription_delivery_slots sds ON psr.delivery_slot_id = sds.id
        WHERE psr.product_subscription_rule_id = $1 AND psr.deleted_at IS NULL
        `,
        [productSubscriptionRuleId],
      );

      return {
        status: true,
        data: rows,
        message: 'Product slot rules loaded',
      };
    } catch (error) {
      this.developer.error(
        'CatalogSubscriptionConfigService.getProductSlotRules error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to load product slot rules',
      );
    }
  }

  async saveProductSlotRule(
    productSubscriptionRuleId: number,
    deliverySlotId: number,
    adminId: string,
  ) {
    try {
      if (!deliverySlotId || deliverySlotId <= 0) {
        throw new BadRequestException({
          status: false,
          message: 'Valid delivery slot ID is required',
        });
      }

      const result = await this.db.query<any>(
        `
        INSERT INTO product_subscription_slot_rules (
          product_subscription_rule_id,
          delivery_slot_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (product_subscription_rule_id, delivery_slot_id)
        DO NOTHING
        RETURNING id
        `,
        [productSubscriptionRuleId, deliverySlotId, adminId],
      );

      if (result.length === 0) {
        return {
          status: true,
          data: null,
          message: 'Slot rule already exists',
        };
      }

      const slotRuleId = result[0]?.id;

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'product_slot_rule_create',
        target_type: 'product_subscription_slot_rule',
        target_id: slotRuleId,
        details: JSON.stringify({
          product_subscription_rule_id: productSubscriptionRuleId,
          delivery_slot_id: deliverySlotId,
        }),
      });

      return {
        status: true,
        data: { id: slotRuleId, product_subscription_rule_id: productSubscriptionRuleId, delivery_slot_id: deliverySlotId },
        message: 'Product slot rule saved',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error(
        'CatalogSubscriptionConfigService.saveProductSlotRule error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to save product slot rule',
      );
    }
  }

  async removeProductSlotRule(
    productSubscriptionRuleId: number,
    deliverySlotId: number,
    adminId: string,
  ) {
    try {
      await this.db.query(
        `
        UPDATE product_subscription_slot_rules
        SET deleted_at = NOW(), updated_by = $3
        WHERE product_subscription_rule_id = $1 AND delivery_slot_id = $2
        `,
        [productSubscriptionRuleId, deliverySlotId, adminId],
      );

      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'product_slot_rule_delete',
        target_type: 'product_subscription_slot_rule',
        target_id: `${productSubscriptionRuleId}-${deliverySlotId}`,
        details: JSON.stringify({
          product_subscription_rule_id: productSubscriptionRuleId,
          delivery_slot_id: deliverySlotId,
        }),
      });

      return {
        status: true,
        message: 'Product slot rule removed',
      };
    } catch (error) {
      this.developer.error(
        'CatalogSubscriptionConfigService.removeProductSlotRule error',
        { error },
      );
      throw new InternalServerErrorException(
        'Failed to remove product slot rule',
      );
    }
  }

  // ==================== VALIDATION HELPERS ====================

  private validateGlobalConfig(body: any): SubscriptionGlobalConfig {
    const config = { ...DEFAULT_GLOBAL_CONFIG };

    // Validate booleans
    if (body?.subscriptions_enabled !== undefined) {
      config.subscriptions_enabled = Boolean(body.subscriptions_enabled);
    }
    if (body?.pauses_allowed !== undefined) {
      config.pauses_allowed = Boolean(body.pauses_allowed);
    }
    if (body?.skips_allowed !== undefined) {
      config.skips_allowed = Boolean(body.skips_allowed);
    }
    if (body?.modifications_allowed !== undefined) {
      config.modifications_allowed = Boolean(body.modifications_allowed);
    }
    if (body?.auto_renew_allowed !== undefined) {
      config.auto_renew_allowed = Boolean(body.auto_renew_allowed);
    }
    if (body?.reserve_inventory_for_subscriptions !== undefined) {
      config.reserve_inventory_for_subscriptions = Boolean(
        body.reserve_inventory_for_subscriptions,
      );
    }
    if (body?.auto_pause_on_payment_failure !== undefined) {
      config.auto_pause_on_payment_failure = Boolean(
        body.auto_pause_on_payment_failure,
      );
    }

    // Validate cutoff time (HH:mm format)
    if (body?.daily_cutoff_time) {
      const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(body.daily_cutoff_time)) {
        throw new BadRequestException({
          status: false,
          message: 'Invalid cutoff time format. Use HH:mm',
        });
      }
      config.daily_cutoff_time = body.daily_cutoff_time;
    }

    if (body?.cutoff_timezone) {
      config.cutoff_timezone = body.cutoff_timezone;
    }

    // Validate notice hours
    if (body?.minimum_start_notice_hours !== undefined) {
      const hours = Number(body.minimum_start_notice_hours);
      if (!Number.isFinite(hours) || hours < 0) {
        throw new BadRequestException({
          status: false,
          message: 'Minimum start notice hours must be a positive number',
        });
      }
      config.minimum_start_notice_hours = Math.floor(hours);
    }

    return config;
  }

  private validateProductSubscriptionRule(
    body: any,
  ): Omit<ProductSubscriptionRule, 'product_id' | 'id'> {
    const rule = { ...DEFAULT_PRODUCT_RULE };

    // Validate booleans
    if (body?.subscription_allowed !== undefined) {
      rule.subscription_allowed = Boolean(body.subscription_allowed);
    }
    if (body?.subscription_only !== undefined) {
      rule.subscription_only = Boolean(body.subscription_only);
    }
    if (body?.morning_slot_allowed !== undefined) {
      rule.morning_slot_allowed = Boolean(body.morning_slot_allowed);
    }
    if (body?.evening_slot_allowed !== undefined) {
      rule.evening_slot_allowed = Boolean(body.evening_slot_allowed);
    }
    if (body?.inventory_reserved !== undefined) {
      rule.inventory_reserved = Boolean(body.inventory_reserved);
    }
    if (body?.is_active !== undefined) {
      rule.is_active = Boolean(body.is_active);
    }

    // Validate quantities
    if (body?.min_quantity !== undefined) {
      const val = Number(body.min_quantity);
      if (!Number.isFinite(val) || val < 1) {
        throw new BadRequestException({
          status: false,
          message: 'Min quantity must be at least 1',
        });
      }
      rule.min_quantity = Math.floor(val);
    }

    if (body?.max_quantity !== undefined) {
      const val = Number(body.max_quantity);
      if (!Number.isFinite(val) || val < 1) {
        throw new BadRequestException({
          status: false,
          message: 'Max quantity must be at least 1',
        });
      }
      rule.max_quantity = Math.floor(val);
    }

    if (body?.quantity_step !== undefined) {
      const val = Number(body.quantity_step);
      if (!Number.isFinite(val) || val < 1) {
        throw new BadRequestException({
          status: false,
          message: 'Quantity step must be at least 1',
        });
      }
      rule.quantity_step = Math.floor(val);
    }

    if (body?.default_quantity !== undefined) {
      const val = Number(body.default_quantity);
      if (!Number.isFinite(val) || val < 1) {
        throw new BadRequestException({
          status: false,
          message: 'Default quantity must be at least 1',
        });
      }
      rule.default_quantity = Math.floor(val);
    }

    // Validate relationships
    if (rule.min_quantity > rule.max_quantity) {
      throw new BadRequestException({
        status: false,
        message: 'Min quantity cannot exceed max quantity',
      });
    }

    if (rule.default_quantity < rule.min_quantity || rule.default_quantity > rule.max_quantity) {
      throw new BadRequestException({
        status: false,
        message: 'Default quantity must be between min and max quantity',
      });
    }

    // Validate default frequency
    const validFrequencies: FrequencyType[] = [
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'custom',
    ];
    if (body?.default_frequency) {
      if (!validFrequencies.includes(body.default_frequency)) {
        throw new BadRequestException({
          status: false,
          message: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`,
        });
      }
      rule.default_frequency = body.default_frequency;
    }

    return rule;
  }

  private validateDeliverySlot(body: any): Omit<SubscriptionDeliverySlot, 'id'> {
    if (!body?.code || typeof body.code !== 'string') {
      throw new BadRequestException({
        status: false,
        message: 'Slot code is required and must be a string',
      });
    }

    if (!body?.name || typeof body.name !== 'string') {
      throw new BadRequestException({
        status: false,
        message: 'Slot name is required and must be a string',
      });
    }

    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!body?.start_time || !timePattern.test(body.start_time)) {
      throw new BadRequestException({
        status: false,
        message: 'Valid start time is required (HH:mm format)',
      });
    }

    if (!body?.end_time || !timePattern.test(body.end_time)) {
      throw new BadRequestException({
        status: false,
        message: 'Valid end time is required (HH:mm format)',
      });
    }

    if (body.start_time >= body.end_time) {
      throw new BadRequestException({
        status: false,
        message: 'End time must be after start time',
      });
    }

    return {
      code: body.code.toUpperCase().trim(),
      name: body.name.trim(),
      start_time: body.start_time,
      end_time: body.end_time,
      is_active: body?.is_active !== false,
    };
  }

  private validateProductFrequency(body: any): Omit<ProductSubscriptionFrequency, 'id' | 'product_subscription_rule_id'> {
    const validFrequencies: FrequencyType[] = [
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'custom',
    ];

    if (!body?.frequency_type || !validFrequencies.includes(body.frequency_type)) {
      throw new BadRequestException({
        status: false,
        message: `Invalid frequency type. Must be one of: ${validFrequencies.join(', ')}`,
      });
    }

    let intervalDays = 1;
    if (body?.interval_days !== undefined) {
      const val = Number(body.interval_days);
      if (!Number.isFinite(val) || val < 1) {
        throw new BadRequestException({
          status: false,
          message: 'Interval days must be at least 1',
        });
      }
      intervalDays = Math.floor(val);
    }

    return {
      frequency_type: body.frequency_type,
      interval_days: intervalDays,
    };
  }

  // ==================== HELPER METHODS ====================

  private async fetchGlobalConfigRow() {
    const rows = await this.db.query<SubscriptionGlobalConfig>(
      `
      SELECT * FROM subscription_global_config
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
    );

    return rows[0] || null;
  }

  private mapGlobalConfigRow(row: any): SubscriptionGlobalConfig {
    return {
      ...DEFAULT_GLOBAL_CONFIG,
      ...row,
    };
  }
}
