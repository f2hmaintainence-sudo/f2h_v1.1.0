import { Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';

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
  ) {}

  /**
   * Fetches customer special price discounts (as percentage) from DB for a given customer.
   * Returns a Map<product_variant_id, discount_percentage>.
   *
   * WORKFLOW STEP 1: Load customer special price rules from DB.
   */
  async getSpecialPricesMap(customerId?: string | null): Promise<Map<string, number>> {
    const specialPricesMap = new Map<string, number>();

    // ── STEP 1a: Validate customerId ──────────────────────────────────────────
    if (!customerId) {
      console.log('[PRICING FLOW] STEP 1a: ❌ No customerId provided → returning empty map (no special prices)');
      this.developer?.debug('[PricingService] getSpecialPricesMap called without customerId', { customerId: null });
      return specialPricesMap;
    }

    console.log(`[PRICING FLOW] STEP 1a: ✅ CustomerId received = "${customerId}"`);

    try {
      // ── STEP 1b: Query DB ───────────────────────────────────────────────────
      console.log(`[PRICING FLOW] STEP 1b: 🔍 Querying customer_special_prices for customer "${customerId}"...`);
      this.developer?.debug('[PricingService] Fetching special prices for customer', { customerId });

      const res: any = await this.db.query(
        `SELECT csp.product_variant_id, 
                COALESCE(csp.discount_percentage, csp.discount, 0) AS discount_percentage,
                csp.special_price 
         FROM customer_special_prices csp
         LEFT JOIN customers c ON (c.customer_id = csp.customer_id OR c.id::text = csp.customer_id)
         WHERE (
           csp.customer_id = $1 
           OR LOWER(csp.customer_id) = LOWER($1) 
           OR c.customer_id = $1 
           OR c.id::text = $1 
         )
           AND csp.deleted_at IS NULL 
           AND (csp.discount_percentage > 0 OR csp.discount > 0 OR csp.special_price > 0)`,
        [customerId],
      );
      const rows = Array.isArray(res) ? res : (res?.rows || []);

      // ── STEP 1c: Build special prices map ───────────────────────────────────
      if (rows.length === 0) {
        console.log(`[PRICING FLOW] STEP 1c: ⚠️  No special price rules found for customer "${customerId}" in DB`);
      } else {
        console.log(`[PRICING FLOW] STEP 1c: ✅ Found ${rows.length} rule(s) in DB for customer "${customerId}"`);
        for (const row of rows) {
          const variantId = row.product_variant_id;
          const discountPct = Number(row.discount_percentage || 0);
          if (variantId && discountPct > 0) {
            specialPricesMap.set(variantId, discountPct);
            console.log(`[PRICING FLOW]          → variantId="${variantId}", discount_percentage=${discountPct}%`);
          }
        }
      }

      const mapEntries = Array.from(specialPricesMap.entries()).map(([vId, disc]) => `${vId}:${disc}%`);
      console.log(`[PRICING FLOW] STEP 1c: 🗺️  Special prices map built: [${mapEntries.join(', ') || 'empty'}]`);
      this.developer?.debug('[PricingService] Special prices loaded', {
        customerId,
        count: specialPricesMap.size,
        entries: mapEntries,
      });
    } catch (e: any) {
      console.error(`[PRICING FLOW] STEP 1 ERROR: ❌ Failed to fetch special prices for customer "${customerId}":`, e?.message || e);
      this.developer?.error('[PricingService] Error fetching customer special prices', { customerId, error: e?.message || e });
    }

    return specialPricesMap;
  }

  /**
   * Calculates pricing breakdown for a single variant dynamically from stored discount.
   *
   * WORKFLOW STEP 2: Apply special discount directly to get final_subscription_price.
   */
  calculateVariantPrice(variant: any, discountPercentageInput: number = 0): CalculatedPrice {
    const variantId = variant?.variant_id || variant?.id || 'unknown';
    const price = Number(variant?.price || 0);
    const rawOriginalPrice = variant?.original_price != null ? Number(variant.original_price) : 0;
    const originalPrice = rawOriginalPrice > 0 ? rawOriginalPrice : price;

    const rawSubPrice = variant?.subscription_price != null ? Number(variant.subscription_price) : 0;
    // Only apply subscription pricing if the variant is a subscription product
    const isSubscribable = variant?.is_subscribable === true || variant?.is_subscribable === 1;
    const subscriptionPrice = (isSubscribable && rawSubPrice > 0) ? rawSubPrice : price;

    const storedDiscount = Number(discountPercentageInput || 0);

    // ── STEP 2: Calculate prices ─────────────────────────────────────────────
    if (storedDiscount > 0 && isSubscribable && rawSubPrice > 0) {
      // Special discount dynamically overrides subscription price — never one-time price
      const finalPrice = price; // one-time price stays unchanged
      const finalSubPrice = Math.max(
        0,
        Math.round(subscriptionPrice * (1 - (storedDiscount / 100.0)) * 100) / 100,
      );
      const discountAmount = Math.max(0, Math.round((subscriptionPrice - finalSubPrice) * 100) / 100);

      const result: CalculatedPrice = {
        original_price: originalPrice,
        price: price,
        subscription_price: subscriptionPrice,
        discount_percentage: storedDiscount,
        discount_amount: discountAmount,
        final_price: finalPrice,
        final_subscription_price: finalSubPrice,
        has_special_price: true,
      };

      console.log(
        `[PRICING FLOW] STEP 2: 🏷️  SPECIAL PRICE applied to variant "${variantId}"\n` +
        `             MRP           : ₹${originalPrice}\n` +
        `             One-time price: ₹${price} (unchanged)\n` +
        `             Sub price     : ₹${subscriptionPrice} → Discount: ${storedDiscount}% → Dynamic Special Price: ₹${finalSubPrice}\n` +
        `             has_special_price: true\n` +
        `             → Sending to app: { final_price: ${finalPrice}, final_subscription_price: ${finalSubPrice} }`
      );
      this.developer?.debug('[PricingService] Special subscription price applied to variant', {
        variantId, discountPercentage: storedDiscount, discountAmount,
        price, finalPrice, subscriptionPrice, finalSubPrice,
      });

      return result;
    } else {
      // No special price — return standard pricing
      const finalSubPrice = isSubscribable && rawSubPrice > 0 ? subscriptionPrice : price;

      if (storedDiscount > 0) {
        // discount was provided but variant is NOT subscribable or has no sub price
        console.log(
          `[PRICING FLOW] STEP 2: ⚠️  Special discount ${storedDiscount}% found for variant "${variantId}" but NOT applied:\n` +
          `             isSubscribable=${isSubscribable}, rawSubPrice=${rawSubPrice}\n` +
          `             → Returning standard prices (no special price)`
        );
      }

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
   * Applies pricing calculation to a product list with variants.
   *
   * WORKFLOW STEP 3: Iterate over all product variants and apply special pricing.
   * WORKFLOW STEP 4: Return enriched product list (sent as API JSON response to app).
   */
  async applyPricingToProductList(customerId: string | null, products: any[]): Promise<any[]> {
    if (!products || products.length === 0) return [];
    
    console.log(`\n[PRICING FLOW] ════════════════════════════════════════════`);
    console.log(`[PRICING FLOW] START: applyPricingToProductList`);
    console.log(`[PRICING FLOW]   customerId   : "${customerId}"`);
    console.log(`[PRICING FLOW]   productCount : ${products.length}`);
    console.log(`[PRICING FLOW] ════════════════════════════════════════════`);
    this.developer?.debug('[PricingService] applyPricingToProductList started', { customerId, productCount: products.length });
    
    // STEP 1: Load special prices map from DB
    const specialPricesMap = await this.getSpecialPricesMap(customerId);
    
    console.log(`[PRICING FLOW] STEP 3: 🔄 Iterating over ${products.length} product variant(s) to apply pricing...`);
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

    console.log(`[PRICING FLOW] STEP 4: ✅ Pricing complete`);
    console.log(`[PRICING FLOW]   → ${specialPricesAppliedCount} variant(s) got SPECIAL subscription price`);
    console.log(`[PRICING FLOW]   → ${standardPricingCount} variant(s) got standard price`);
    console.log(`[PRICING FLOW] ════════════════════════════════════════════\n`);
    this.developer?.debug('[PricingService] applyPricingToProductList finished', { customerId, specialPricesAppliedCount });

    return result;
  }
}
