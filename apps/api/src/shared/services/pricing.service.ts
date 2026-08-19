import { Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/Database.service';
import { DeveloperService } from '../logger/Developer.service';

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
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly developer?: DeveloperService,
  ) { }

  /**
   * WORKFLOW STEP 1 — Load customer special price rules from DB.
   * Returns a Map<product_variant_id, discount_percentage>.
   */
  async getSpecialPricesMap(customerId?: string | null): Promise<Map<string, number>> {
    const specialPricesMap = new Map<string, number>();

    // STEP 1a: Validate customerId
    if (!customerId) {
      console.log('[PRICING FLOW] STEP 1a: No customerId provided -> returning empty map (no special prices)');
      this.developer?.debug('[PricingService] getSpecialPricesMap called without customerId', { customerId: null });
      return specialPricesMap;
    }

    console.log(`[PRICING FLOW] STEP 1a: CustomerId received = "${customerId}"`);

    try {
      // STEP 1b: Query DB for this customer's special price rules
      console.log(`[PRICING FLOW] STEP 1b: Querying customer_special_prices for customer "${customerId}"...`);
      this.developer?.debug('[PricingService] Fetching special prices for customer', { customerId });

      const res: any = await this.db.query(
        `SELECT csp.product_variant_id, csp.special_price 
         FROM customer_special_prices csp
         LEFT JOIN customers c ON (c.customer_id = csp.customer_id)
         LEFT JOIN users u ON (u.user_id = csp.customer_id)
         WHERE (
           csp.customer_id = $1 
           OR c.customer_id = $1 
           OR u.user_id = $1
         )
           AND csp.deleted_at IS NULL AND csp.special_price > 0`,
        [customerId],
      );
      const rows = Array.isArray(res) ? res : (res?.rows || []);

      // STEP 1c: Build map from DB rows
      if (rows.length === 0) {
        console.log(`[PRICING FLOW] STEP 1c: No special price rules found in DB for customer "${customerId}"`);
      } else {
        console.log(`[PRICING FLOW] STEP 1c: Found ${rows.length} rule(s) in DB for customer "${customerId}"`);
        for (const row of rows) {
          const variantId = row.product_variant_id;
          const specialPrice = Number(row.special_price || 0);
          if (variantId && specialPrice > 0) {
            specialPricesMap.set(variantId, specialPrice);
            console.log(`[PRICING FLOW]          -> variantId="${variantId}", special_price=Rs.${specialPrice}`);
          }
        }
      }

      const mapEntries = Array.from(specialPricesMap.entries()).map(([vId, sp]) => `${vId}:Rs.${sp}`);
      console.log(`[PRICING FLOW] STEP 1c: Special prices map built = [${mapEntries.join(', ') || 'empty'}]`);
      this.developer?.debug('[PricingService] Special prices loaded', {
        customerId,
        count: specialPricesMap.size,
        entries: mapEntries,
      });
    } catch (e) {
      console.error(`[PRICING FLOW] STEP 1 ERROR: Failed to fetch special prices for customer "${customerId}":`, e?.message || e);
      this.developer?.error('[PricingService] Error fetching customer special prices', { customerId, error: e?.message || e });
    }

    return specialPricesMap;
  }

  /**
   * WORKFLOW STEP 2 — Calculate final prices for a single variant.
   * Special price applies directly to final_subscription_price.
   */
  calculateVariantPrice(variant: any, specialPrice: number = 0): CalculatedPrice {
    const variantId = variant?.variant_id || variant?.id || 'unknown';
    const price = Number(variant?.price || 0);
    const rawOriginalPrice = variant?.original_price != null ? Number(variant.original_price) : 0;
    const originalPrice = rawOriginalPrice > 0 ? rawOriginalPrice : price;

    const rawSubPrice = variant?.subscription_price != null ? Number(variant.subscription_price) : 0;
    const isSubscribable = variant?.is_subscribable !== false && variant?.is_subscribable !== 0 && (rawSubPrice > 0 || variant?.is_subscribable === true || variant?.is_subscribable === 1);
    const subscriptionPrice = (isSubscribable && rawSubPrice > 0) ? rawSubPrice : price;

    const storedSpecialPrice = Number(specialPrice || 0);

    if (storedSpecialPrice > 0) {
      // Stored special price applies directly as final subscription price
      const finalPrice = price; // one-time price is NEVER modified
      const finalSubPrice = storedSpecialPrice;
      const discountAmount = subscriptionPrice > storedSpecialPrice ? Math.round((subscriptionPrice - storedSpecialPrice) * 100) / 100 : 0;
      const discountPercentage = subscriptionPrice > 0 && subscriptionPrice > storedSpecialPrice
        ? Math.round(((subscriptionPrice - storedSpecialPrice) / subscriptionPrice) * 100 * 100) / 100
        : 0;

      const result: CalculatedPrice = {
        original_price: originalPrice,
        price: price,
        subscription_price: subscriptionPrice,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount,
        final_price: finalPrice,
        final_subscription_price: finalSubPrice,
        has_special_price: true,
      };

      console.log(
        `[PRICING FLOW] STEP 2: SPECIAL PRICE applied to variant "${variantId}" | ` +
        `MRP=Rs.${originalPrice} | One-time=Rs.${price} (unchanged) | ` +
        `Sub=Rs.${subscriptionPrice} -> Direct Special Price=Rs.${finalSubPrice} | ` +
        `has_special_price=true | -> API sends: { final_price: ${finalPrice}, final_subscription_price: ${finalSubPrice} }`
      );
      this.developer?.debug('[PricingService] Special price applied directly to variant', {
        variantId, specialPrice: storedSpecialPrice, discountPercentage, discountAmount,
        price, finalPrice, subscriptionPrice, finalSubPrice,
      });

      return result;
    } else {
      // No special price — standard pricing
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
  }

  /**
   * WORKFLOW STEP 3 — Apply pricing to a full product list.
   * WORKFLOW STEP 4 — Return enriched list (this is the JSON sent to the customer app).
   */
  async applyPricingToProductList(customerId: string | null, products: any[]): Promise<any[]> {
    if (!products || products.length === 0) return [];

    console.log(`[PRICING FLOW] =============================================`);
    console.log(`[PRICING FLOW] START applyPricingToProductList`);
    console.log(`[PRICING FLOW]   customerId   : "${customerId}"`);
    console.log(`[PRICING FLOW]   productCount : ${products.length}`);
    this.developer?.debug('[PricingService] applyPricingToProductList started', { customerId, productCount: products.length });

    // STEP 1 & 1b: Load special prices map
    const specialPricesMap = await this.getSpecialPricesMap(customerId);

    console.log(`[PRICING FLOW] STEP 3: Iterating ${products.length} variant(s) to apply pricing...`);
    let specialPricesAppliedCount = 0;
    let standardPricingCount = 0;

    const result = products.map((prod) => {
      const copy = { ...prod };
      if (copy.variants && Array.isArray(copy.variants)) {
        copy.variants = copy.variants.map((v: any) => {
          const variantId = v.variant_id || v.id;
          const specialPrice = specialPricesMap.get(variantId) || 0;
          if (specialPrice > 0) specialPricesAppliedCount++;
          else standardPricingCount++;
          const pricing = this.calculateVariantPrice(v, specialPrice);
          return { ...v, ...pricing };
        });
      }
      if (copy.allVariants && Array.isArray(copy.allVariants)) {
        copy.allVariants = copy.allVariants.map((v: any) => {
          const variantId = v.variant_id || v.id;
          const specialPrice = specialPricesMap.get(variantId) || 0;
          const pricing = this.calculateVariantPrice(v, specialPrice);
          return { ...v, ...pricing };
        });
      }
      return copy;
    });

    // STEP 4: Log result summary — this data gets serialized to JSON and sent to the app
    console.log(`[PRICING FLOW] STEP 4: Pricing complete`);
    console.log(`[PRICING FLOW]   -> ${specialPricesAppliedCount} variant(s) received SPECIAL subscription price`);
    console.log(`[PRICING FLOW]   -> ${standardPricingCount} variant(s) received standard price`);
    console.log(`[PRICING FLOW] =============================================`);
    this.developer?.debug('[PricingService] applyPricingToProductList finished', { customerId, specialPricesAppliedCount });

    return result;
  }
}
