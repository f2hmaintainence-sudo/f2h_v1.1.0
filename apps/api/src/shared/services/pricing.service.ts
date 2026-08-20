import { Injectable, Optional,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/Database.service';
import { DeveloperService } from '../logger/Developer.service';

export interface SpecialPriceRule {
  specialPrice: number;
  discountPercentage: number;
}

export interface CalculatedPrice {
  original_price: number;
  price: number;
  subscription_price: number;
  discount_percentage: number;
  discount_amount: number;
  final_price: number;
  final_subscription_price: number;
  has_special_price: boolean;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly developer?: DeveloperService,
  ) { }

  /**
   * WORKFLOW STEP 1 — Load customer special price rules from DB.
   * Returns a Map<product_variant_id, SpecialPriceRule>.
   */
  async getSpecialPricesMap(customerId?: string | null): Promise<Map<string, SpecialPriceRule>> {
    const specialPricesMap = new Map<string, SpecialPriceRule>();

    // STEP 1a: Validate customerId
    if (!customerId) {
      this.logger.log('[PRICING FLOW] STEP 1a: No customerId provided -> returning empty map (no special prices)');
      this.developer?.debug('[PricingService] getSpecialPricesMap called without customerId', { customerId: null });
      return specialPricesMap;
    }

    this.logger.log(`[PRICING FLOW] STEP 1a: CustomerId received = "${customerId}"`);

    try {
      // STEP 1b: Query DB for this customer's special price rules
      this.logger.log(`[PRICING FLOW] STEP 1b: Querying customer_special_prices for customer "${customerId}"...`);
      this.developer?.debug('[PricingService] Fetching special prices for customer', { customerId });

      const res: any = await this.db.query(
        `SELECT csp.product_variant_id, 
                COALESCE(csp.discount_percentage, csp.discount, 0) AS discount_percentage,
                COALESCE(csp.special_price, 0) AS special_price 
         FROM customer_special_prices csp
         LEFT JOIN customers c ON (c.customer_id = csp.customer_id)
         LEFT JOIN users u ON (u.user_id = csp.customer_id)
         WHERE (
           csp.customer_id = $1 
           OR c.customer_id = $1 
           OR u.user_id = $1
         )
           AND csp.deleted_at IS NULL 
           AND (csp.discount_percentage > 0 OR csp.discount > 0 OR csp.special_price > 0)`,
        [customerId],
      );
      const rows = Array.isArray(res) ? res : (res?.rows || []);

      // STEP 1c: Build map from DB rows
      if (rows.length === 0) {
        this.logger.log(`[PRICING FLOW] STEP 1c: No special price rules found in DB for customer "${customerId}"`);
      } else {
        this.logger.log(`[PRICING FLOW] STEP 1c: Found ${rows.length} rule(s) in DB for customer "${customerId}"`);
        for (const row of rows) {
          const variantId = row.product_variant_id;
          const discountPct = Number(row.discount_percentage || 0);
          const specialPriceVal = Number(row.special_price || 0);
          if (variantId && (discountPct > 0 || specialPriceVal > 0)) {
            specialPricesMap.set(variantId, {
              specialPrice: specialPriceVal,
              discountPercentage: discountPct,
            });
            this.logger.log(`[PRICING FLOW]          -> variantId="${variantId}", special_price=Rs.${specialPriceVal}, discount_percentage=${discountPct}%`);
          }
        }
      }
    } catch (e: any) {
      console.error(`[PRICING FLOW] STEP 1 ERROR: Failed to fetch special prices for customer "${customerId}":`, e?.message || e);
      this.developer?.error('[PricingService] Error fetching customer special prices', { customerId, error: e?.message || e });
    }

    return specialPricesMap;
  }

  /**
   * WORKFLOW STEP 2 — Calculate final prices for a single variant dynamically.
   */
  calculateVariantPrice(variant: any, ruleInput: SpecialPriceRule | number = 0): CalculatedPrice {
    const variantId = variant?.variant_id || variant?.id || 'unknown';
    const price = Number(variant?.price || 0);
    const rawOriginalPrice = variant?.original_price != null ? Number(variant.original_price) : 0;
    const originalPrice = rawOriginalPrice > 0 ? rawOriginalPrice : price;

    const rawSubPrice = variant?.subscription_price != null ? Number(variant.subscription_price) : 0;
    const isSubscribable = variant?.is_subscribable !== false && variant?.is_subscribable !== 0 && (rawSubPrice > 0 || variant?.is_subscribable === true || variant?.is_subscribable === 1);
    const subscriptionPrice = (isSubscribable && rawSubPrice > 0) ? rawSubPrice : price;

    const rule: SpecialPriceRule = typeof ruleInput === 'number'
      ? { specialPrice: 0, discountPercentage: ruleInput }
      : (ruleInput || { specialPrice: 0, discountPercentage: 0 });

    if (rule.specialPrice > 0 || rule.discountPercentage > 0) {
      let finalSubPrice = subscriptionPrice;
      let discountPercentage = rule.discountPercentage;

      if (rule.specialPrice > 0) {
        finalSubPrice = rule.specialPrice;
        if (subscriptionPrice > 0) {
          discountPercentage = Math.round(((subscriptionPrice - finalSubPrice) / subscriptionPrice) * 10000) / 100;
        }
      } else if (rule.discountPercentage > 0) {
        finalSubPrice = Math.max(0, Math.round(subscriptionPrice * (1 - (rule.discountPercentage / 100.0)) * 100) / 100);
      }

      const discountAmount = Math.max(0, Math.round((subscriptionPrice - finalSubPrice) * 100) / 100);

      this.logger.log(
        `[PricingService] Special price applied directly to variant ${JSON.stringify({
          variantId,
          specialPrice: finalSubPrice,
          discountPercentage,
          discountAmount,
          price,
          finalPrice: price,
          subscriptionPrice,
          finalSubPrice,
        })}`
      );

      return {
        original_price: originalPrice,
        price: price,
        subscription_price: subscriptionPrice,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount,
        final_price: price,
        final_subscription_price: finalSubPrice,
        has_special_price: true,
      };
    }

    const finalSubPrice = isSubscribable && rawSubPrice > 0 ? subscriptionPrice : price;

    return {
      original_price: originalPrice,
      price: price,
      subscription_price: subscriptionPrice,
      discount_percentage: 0,
      discount_amount: 0,
      final_price: price,
      final_subscription_price: finalSubPrice,
      has_special_price: false,
    };
  }

  /**
   * WORKFLOW STEP 3 & 4 — Apply pricing to product list and return enriched list.
   */
  async applyPricingToProductList(customerId: string | null, products: any[]): Promise<any[]> {
    if (!products || products.length === 0) return [];

    const specialPricesMap = await this.getSpecialPricesMap(customerId);

    return products.map((prod) => {
      const copy = { ...prod };
      const variantId = copy.variant_id || copy.id;
      if (variantId && specialPricesMap.has(variantId)) {
        const pricing = this.calculateVariantPrice(copy, specialPricesMap.get(variantId));
        Object.assign(copy, pricing);
      }
      if (copy.variants && Array.isArray(copy.variants)) {
        copy.variants = copy.variants.map((v: any) => {
          const vId = v.variant_id || v.id;
          const rule = specialPricesMap.get(vId);
          const pricing = this.calculateVariantPrice(v, rule);
          return { ...v, ...pricing };
        });
      }
      if (copy.allVariants && Array.isArray(copy.allVariants)) {
        copy.allVariants = copy.allVariants.map((v: any) => {
          const vId = v.variant_id || v.id;
          const rule = specialPricesMap.get(vId);
          const pricing = this.calculateVariantPrice(v, rule);
          return { ...v, ...pricing };
        });
      }
      return copy;
    });
  }
}
