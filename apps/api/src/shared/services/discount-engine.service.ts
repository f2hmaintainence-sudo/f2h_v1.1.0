import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/Database.service';
import { generateId } from 'src/helpers/RandomHelper';

// ─── Result Types ────────────────────────────────────────────────────────────

export interface ItemDiscountResult {
  variant_id: string;
  original_price: number;
  unit_price: number;
  promotion_id: string | null;
  coupon_id: string | null;
  discount_amount: number;
  coupon_amount: number;
  final_price: number;
  item_line_total: number;
}

export interface DiscountSummary {
  promotion_discount: number;
  coupon_discount: number;
  total_discount: number;
  coupon_id: string | null;
  coupon_valid: boolean;
  coupon_message: string | null;
}

export interface DiscountResolutionInput {
  customer_id: string;
  order_source: 'one-time' | 'subscription';
  coupon_code?: string | null;
  items: Array<{
    variant_id: string;
    unit_price: number;
    original_price: number;
    quantity: number;
  }>;
}

export interface DiscountResolution {
  item_results: ItemDiscountResult[];
  summary: DiscountSummary;
}

// ─── Internal Promotion Row ───────────────────────────────────────────────────

interface PromotionRow {
  promotion_id: string;
  promotion_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  max_discount_amount: number | null;
  minimum_order_amount: number;
  first_order_only: boolean;
  usage_limit: number | null;
  usage_limit_per_customer: number;
  auto_apply: boolean;
  allow_subscription_orders: boolean;
  stackable: boolean;
  apply_to_all_products: boolean;
  start_at: Date | null;
  end_at: Date | null;
  status: string;
  product_variant_ids: string[];
  global_redemption_count: number;
  customer_redemption_count: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class DiscountEngineService {
  constructor(private readonly db: DatabaseService) {}

  // ── Full resolution for checkout ──────────────────────────────────────────

  async resolveDiscounts(input: DiscountResolutionInput): Promise<DiscountResolution> {
    const { customer_id, order_source, coupon_code, items } = input;
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

    // 1. Load eligible auto-apply promotions
    const promotions = await this.loadEligiblePromotions(customer_id, order_source, subtotal);

    // 2. Build initial item results
    const itemResults: ItemDiscountResult[] = items.map((item) => ({
      variant_id: item.variant_id,
      original_price: item.original_price,
      unit_price: item.unit_price,
      promotion_id: null,
      coupon_id: null,
      discount_amount: 0,
      coupon_amount: 0,
      final_price: item.unit_price,
      item_line_total: item.unit_price * item.quantity,
    }));

    // 3. Per-item: find best promotion
    for (const result of itemResults) {
      const best = this.findBestPromotion(result.variant_id, promotions, result.unit_price);
      if (best) {
        const discountPerUnit = this.calcPromotionDiscount(best, result.unit_price);
        const item = items.find((i) => i.variant_id === result.variant_id)!;
        result.promotion_id = best.promotion_id;
        result.discount_amount = discountPerUnit;
        result.final_price = Math.max(0, result.unit_price - discountPerUnit);
        result.item_line_total = result.final_price * item.quantity;
      }
    }

    // 4. Resolve coupon if provided
    let resolvedCouponId: string | null = null;
    let couponValid = false;
    let couponMessage: string | null = null;
    let couponPromo: PromotionRow | null = null;
    let couponRow: any = null;

    if (coupon_code) {
      const couponResult = await this.validateCouponInternal(coupon_code, customer_id, subtotal);
      couponValid = couponResult.valid;
      couponMessage = couponResult.message;
      couponRow = couponResult.coupon;
      couponPromo = couponResult.promotion;
    }

    // 5. Apply coupon if valid
    if (couponValid && couponRow && couponPromo) {
      resolvedCouponId = couponRow.coupon_id;
      for (const result of itemResults) {
        const item = items.find((i) => i.variant_id === result.variant_id)!;

        const couponAppliesToItem =
          couponPromo.apply_to_all_products ||
          couponPromo.product_variant_ids.length === 0 ||
          couponPromo.product_variant_ids.includes(result.variant_id);

        if (!couponAppliesToItem) continue;

        const promoApplied = result.promotion_id !== null;
        const promoIsStackable = promoApplied
          ? (promotions.find((p) => p.promotion_id === result.promotion_id)?.stackable ?? false)
          : true;

        const couponDiscountPerUnit = this.calcPromotionDiscount(couponPromo, result.unit_price);

        if (promoApplied && !promoIsStackable && !couponPromo.stackable) {
          // Non-stackable: pick the better discount
          if (couponDiscountPerUnit > result.discount_amount) {
            result.promotion_id = null;
            result.discount_amount = 0;
            result.coupon_id = resolvedCouponId;
            result.coupon_amount = couponDiscountPerUnit;
          }
          // else keep promo, coupon not applied on this item
        } else {
          // Stackable: apply coupon on top
          result.coupon_id = resolvedCouponId;
          result.coupon_amount = couponDiscountPerUnit;
        }

        result.final_price = Math.max(0, result.unit_price - result.discount_amount - result.coupon_amount);
        result.item_line_total = result.final_price * item.quantity;
      }
    }

    // 6. Build summary
    const promoTotal = itemResults.reduce((s, r) => {
      const qty = items.find((i) => i.variant_id === r.variant_id)!.quantity;
      return s + r.discount_amount * qty;
    }, 0);
    const couponTotal = itemResults.reduce((s, r) => {
      const qty = items.find((i) => i.variant_id === r.variant_id)!.quantity;
      return s + r.coupon_amount * qty;
    }, 0);

    return {
      item_results: itemResults,
      summary: {
        promotion_discount: Math.round(promoTotal * 100) / 100,
        coupon_discount: Math.round(couponTotal * 100) / 100,
        total_discount: Math.round((promoTotal + couponTotal) * 100) / 100,
        coupon_id: resolvedCouponId,
        coupon_valid: couponValid,
        coupon_message: couponMessage,
      },
    };
  }

  // ── Preview (same as resolveDiscounts — no side effects) ─────────────────

  async previewDiscounts(input: DiscountResolutionInput): Promise<DiscountResolution> {
    return this.resolveDiscounts(input);
  }

  // ── Coupon validation for /validate-coupon endpoint ───────────────────────

  async validateCouponCode(
    couponCode: string,
    customerId: string,
    subtotal: number,
  ): Promise<{ valid: boolean; message: string; discount_preview?: number }> {
    const result = await this.validateCouponInternal(couponCode, customerId, subtotal);
    if (!result.valid) {
      return { valid: false, message: result.message };
    }
    const preview = result.promotion ? this.calcPromotionDiscount(result.promotion, subtotal) : 0;
    return { valid: true, message: result.message, discount_preview: preview };
  }

  // ── Record redemptions (call AFTER order insert, pass a PoolClient for tx safety) ──

  async recordRedemptions(
    client: any,
    orderId: string,
    customerId: string,
    itemResults: ItemDiscountResult[],
    items: Array<{ variant_id: string; quantity: number }>,
    couponId: string | null,
    couponPromotionId: string | null,
    couponDiscountTotal: number,
  ): Promise<void> {
    const now = new Date();

    // Group promotion discounts by promotion_id
    const promoMap = new Map<string, number>();
    for (const r of itemResults) {
      if (!r.promotion_id || r.discount_amount <= 0) continue;
      const qty = items.find((i) => i.variant_id === r.variant_id)?.quantity ?? 1;
      promoMap.set(r.promotion_id, (promoMap.get(r.promotion_id) ?? 0) + r.discount_amount * qty);
    }

    // Insert promotion_redemptions — ON CONFLICT DO NOTHING for concurrency safety
    for (const [promotionId, discountAmount] of promoMap.entries()) {
      const redemptionId = generateId('PRRD', 20);
      await client.query(
        `INSERT INTO promotion_redemptions
           (redemption_id, promotion_id, customer_id, order_id, discount_amount, redeemed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (promotion_id, customer_id, order_id) DO NOTHING`,
        [redemptionId, promotionId, customerId, orderId, discountAmount, now],
      );
    }

    // Insert coupon_redemption
    if (couponId && couponPromotionId && couponDiscountTotal > 0) {
      const redemptionId = generateId('CPRD', 20);
      await client.query(
        `INSERT INTO coupon_redemptions
           (redemption_id, coupon_id, promotion_id, customer_id, order_id, discount_amount, redeemed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (coupon_id, customer_id, order_id) DO NOTHING`,
        [redemptionId, couponId, couponPromotionId, customerId, orderId, couponDiscountTotal, now],
      );
      // Increment used_count
      await client.query(
        `UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE coupon_id = $1`,
        [couponId],
      );
    }
  }

  // ── Get coupon's parent promotion_id ─────────────────────────────────────

  async getCouponPromotionId(couponCode: string): Promise<string | null> {
    const rows = await this.db.query(
      `SELECT c.coupon_id, c.promotion_id FROM coupons c
       WHERE UPPER(c.code) = UPPER($1) AND c.deleted_at IS NULL LIMIT 1`,
      [couponCode],
    );
    return rows?.[0]?.promotion_id ?? null;
  }

  async getCouponIdByCode(couponCode: string): Promise<string | null> {
    const rows = await this.db.query(
      `SELECT coupon_id FROM coupons WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL LIMIT 1`,
      [couponCode],
    );
    return rows?.[0]?.coupon_id ?? null;
  }

  // ── PRIVATE: Load eligible auto-apply promotions ──────────────────────────

  private async loadEligiblePromotions(
    customerId: string,
    orderSource: 'one-time' | 'subscription',
    subtotal: number,
  ): Promise<PromotionRow[]> {
    const now = new Date();

    const rows = await this.db.query(
      `SELECT
         p.promotion_id,
         p.promotion_type,
         p.discount_value::float AS discount_value,
         p.max_discount_amount::float AS max_discount_amount,
         p.minimum_order_amount::float AS minimum_order_amount,
         p.first_order_only,
         p.usage_limit,
         p.usage_limit_per_customer,
         p.auto_apply,
         p.allow_subscription_orders,
         p.stackable,
         p.apply_to_all_products,
         p.start_at,
         p.end_at,
         p.status,
         COALESCE(
           (SELECT COUNT(*) FROM promotion_redemptions pr WHERE pr.promotion_id = p.promotion_id),
           0
         )::int AS global_redemption_count,
         COALESCE(
           (SELECT COUNT(*) FROM promotion_redemptions pr
            WHERE pr.promotion_id = p.promotion_id AND pr.customer_id = $1),
           0
         )::int AS customer_redemption_count,
         COALESCE(
           (SELECT ARRAY_AGG(pp.product_variant_id) FROM promotion_products pp WHERE pp.promotion_id = p.promotion_id),
           ARRAY[]::text[]
         ) AS product_variant_ids
       FROM promotions p
       WHERE p.status = 'active'
         AND p.auto_apply = true
         AND p.deleted_at IS NULL
         AND (p.start_at IS NULL OR p.start_at <= $2)
         AND (p.end_at IS NULL OR p.end_at >= $2)`,
      [customerId, now],
    );

    const promotions: PromotionRow[] = (rows || []).map((r: any) => ({
      ...r,
      discount_value: Number(r.discount_value),
      max_discount_amount: r.max_discount_amount != null ? Number(r.max_discount_amount) : null,
      minimum_order_amount: Number(r.minimum_order_amount || 0),
      product_variant_ids: r.product_variant_ids || [],
    }));

    const eligible: PromotionRow[] = [];
    for (const p of promotions) {
      // Minimum order
      if (p.minimum_order_amount > 0 && subtotal < p.minimum_order_amount) continue;

      // Subscription check
      if (orderSource === 'subscription' && !p.allow_subscription_orders) continue;

      // Per-customer usage limit
      if (p.customer_redemption_count >= p.usage_limit_per_customer) continue;

      // Global usage limit
      if (p.usage_limit != null && p.global_redemption_count >= p.usage_limit) continue;

      // First order only (checks prior purchases of promotion's specific products)
      if (p.first_order_only) {
        const hasPrior = await this.customerHasPriorPurchaseOfVariants(
          customerId,
          p.product_variant_ids,
        );
        if (hasPrior) continue;
      }

      eligible.push(p);
    }

    return eligible;
  }

  // ── PRIVATE: Check prior successful purchases of specific variants ─────────

  private async customerHasPriorPurchaseOfVariants(
    customerId: string,
    variantIds: string[],
  ): Promise<boolean> {
    if (variantIds.length === 0) return false;

    const rows = await this.db.query(
      `SELECT 1
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE o.customer_id = $1
         AND oi.variant_id = ANY($2::text[])
         AND o.status NOT IN ('cancelled', 'failed', 'rejected')
         AND o.deleted_at IS NULL
       LIMIT 1`,
      [customerId, variantIds],
    );
    return (rows || []).length > 0;
  }

  // ── PRIVATE: Find best promotion for a variant ────────────────────────────

  private findBestPromotion(
    variantId: string,
    promotions: PromotionRow[],
    unitPrice: number,
  ): PromotionRow | null {
    let best: PromotionRow | null = null;
    let bestDiscount = 0;

    for (const p of promotions) {
      const applies =
        p.apply_to_all_products ||
        p.product_variant_ids.length === 0 ||
        p.product_variant_ids.includes(variantId);
      if (!applies) continue;

      const discount = this.calcPromotionDiscount(p, unitPrice);
      if (discount > bestDiscount) {
        bestDiscount = discount;
        best = p;
      }
    }

    return best;
  }

  // ── PRIVATE: Calculate discount per unit ─────────────────────────────────

  private calcPromotionDiscount(promo: PromotionRow, unitPrice: number): number {
    if (unitPrice <= 0) return 0;

    let discount = 0;
    if (promo.promotion_type === 'percentage') {
      discount = (unitPrice * promo.discount_value) / 100;
    } else {
      discount = promo.discount_value;
    }

    if (promo.max_discount_amount != null) {
      discount = Math.min(discount, promo.max_discount_amount);
    }

    return Math.min(Math.round(discount * 100) / 100, unitPrice);
  }

  // ── PRIVATE: Validate coupon ──────────────────────────────────────────────

  private async validateCouponInternal(
    couponCode: string,
    customerId: string,
    subtotal: number,
  ): Promise<{ valid: boolean; message: string; coupon: any | null; promotion: PromotionRow | null }> {
    const now = new Date();

    const rows = await this.db.query(
      `SELECT
         c.coupon_id, c.promotion_id, c.code,
         c.status AS coupon_status,
         c.usage_limit AS coupon_usage_limit,
         c.usage_limit_per_customer AS coupon_upc,
         c.used_count,
         c.start_at AS coupon_start, c.end_at AS coupon_end,
         p.promotion_type, p.discount_value::float AS discount_value,
         p.max_discount_amount::float AS max_discount_amount,
         p.minimum_order_amount::float AS minimum_order_amount,
         p.status AS promo_status,
         p.start_at AS promo_start, p.end_at AS promo_end,
         p.apply_to_all_products, p.stackable,
         p.allow_subscription_orders, p.first_order_only,
         p.usage_limit_per_customer AS promo_upc,
         COALESCE(
           (SELECT ARRAY_AGG(pp.product_variant_id) FROM promotion_products pp WHERE pp.promotion_id = p.promotion_id),
           ARRAY[]::text[]
         ) AS product_variant_ids
       FROM coupons c
       JOIN promotions p ON p.promotion_id = c.promotion_id
       WHERE UPPER(c.code) = UPPER($1)
         AND c.deleted_at IS NULL AND p.deleted_at IS NULL
       LIMIT 1`,
      [couponCode],
    );

    const row = rows?.[0];
    if (!row) return { valid: false, message: 'Invalid coupon code', coupon: null, promotion: null };

    if (row.coupon_status !== 'active')
      return { valid: false, message: 'This coupon is not active', coupon: null, promotion: null };

    if (row.promo_status !== 'active')
      return { valid: false, message: 'This coupon is no longer valid', coupon: null, promotion: null };

    if (row.coupon_start && new Date(row.coupon_start) > now)
      return { valid: false, message: 'This coupon is not yet valid', coupon: null, promotion: null };

    if (row.coupon_end && new Date(row.coupon_end) < now)
      return { valid: false, message: 'This coupon has expired', coupon: null, promotion: null };

    if (row.promo_start && new Date(row.promo_start) > now)
      return { valid: false, message: 'This coupon is not yet valid', coupon: null, promotion: null };

    if (row.promo_end && new Date(row.promo_end) < now)
      return { valid: false, message: 'This coupon has expired', coupon: null, promotion: null };

    if (row.coupon_usage_limit != null && row.used_count >= row.coupon_usage_limit)
      return { valid: false, message: 'This coupon has reached its usage limit', coupon: null, promotion: null };

    // Per-customer usage
    const usedRows = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = $1 AND customer_id = $2`,
      [row.coupon_id, customerId],
    );
    const customerUsed = Number(usedRows?.[0]?.cnt ?? 0);
    const perCustLimit = Number(row.coupon_upc ?? 1);
    if (customerUsed >= perCustLimit)
      return { valid: false, message: 'You have already used this coupon', coupon: null, promotion: null };

    // Minimum order
    const minAmount = Number(row.minimum_order_amount || 0);
    if (minAmount > 0 && subtotal < minAmount)
      return {
        valid: false,
        message: `Minimum order amount of ₹${minAmount.toFixed(0)} required`,
        coupon: null,
        promotion: null,
      };

    const promoRow: PromotionRow = {
      promotion_id: row.promotion_id,
      promotion_type: row.promotion_type,
      discount_value: Number(row.discount_value),
      max_discount_amount: row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
      minimum_order_amount: minAmount,
      first_order_only: row.first_order_only,
      usage_limit: row.coupon_usage_limit,
      usage_limit_per_customer: Number(row.promo_upc ?? 1),
      auto_apply: false,
      allow_subscription_orders: row.allow_subscription_orders,
      stackable: row.stackable,
      apply_to_all_products: row.apply_to_all_products,
      start_at: row.promo_start,
      end_at: row.promo_end,
      status: row.promo_status,
      product_variant_ids: row.product_variant_ids || [],
      global_redemption_count: 0,
      customer_redemption_count: 0,
    };

    return { valid: true, message: 'Coupon applied successfully', coupon: row, promotion: promoRow };
  }
}
