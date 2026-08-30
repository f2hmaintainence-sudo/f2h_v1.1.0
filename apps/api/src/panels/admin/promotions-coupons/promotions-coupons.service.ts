import {
  BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { generateId } from 'src/helpers/RandomHelper';
import {
  AddPromotionProductsDto,
  CreateCouponDto,
  CreatePromotionDto,
  SetCouponStatusDto,
  SetPromotionStatusDto,
  UpdateCouponDto,
  UpdatePromotionDto,
} from './promotions-coupons.dto';

@Injectable()
export class PromotionsCouponsService implements OnModuleInit {
  constructor(
    private readonly db: DatabaseService,
    private readonly Data: DataService,
  ) {}

  async onModuleInit() {
    // Deprecated: First order 50% off promotion is removed.
  }

  private async bootstrapFirstMilkPromotion() {
    // 1. Ensure PROMO_FIRST_MILK exists
    await this.db.query(
      `INSERT INTO promotions (
         promotion_id, name, description, promotion_type, discount_value,
         max_discount_amount, minimum_order_amount, status, first_order_only,
         usage_limit, usage_limit_per_customer, auto_apply, allow_subscription_orders,
         stackable, apply_to_all_products, created_at, updated_at
       ) VALUES (
         'PROMO_FIRST_MILK', 'First Milk Order - 50% Off', '50% off on your first fresh milk purchase',
         'percentage', 50.00, NULL, 0, 'active', true,
         NULL, 1, true, false, false, false, NOW(), NOW()
       )
       ON CONFLICT (promotion_id) DO UPDATE SET
         name = EXCLUDED.name,
         promotion_type = EXCLUDED.promotion_type,
         discount_value = EXCLUDED.discount_value,
         first_order_only = true,
         auto_apply = true,
         allow_subscription_orders = false,
         apply_to_all_products = false,
         updated_at = NOW()`,
    );

    // 2. Link all active Milk product variants
    const milkVariants = await this.db.query(
      `SELECT pv.variant_id
       FROM product_variants pv
       JOIN products p ON p.product_id = pv.product_id
       WHERE LOWER(p.name) LIKE '%milk%' AND pv.deleted_at IS NULL AND p.deleted_at IS NULL`,
    );

    for (const row of milkVariants || []) {
      await this.db.query(
        `INSERT INTO promotion_products (promotion_id, product_variant_id, created_at)
         VALUES ('PROMO_FIRST_MILK', $1, NOW())
         ON CONFLICT (promotion_id, product_variant_id) DO NOTHING`,
        [row.variant_id],
      );
    }

    // 3. Ensure MILK50 coupon exists and links to PROMO_FIRST_MILK
    await this.db.query(
      `INSERT INTO coupons (
         coupon_id, promotion_id, code, name, description, status,
         usage_limit, usage_limit_per_customer, created_at, updated_at
       ) VALUES (
         'CPN_FIRST_MILK_50', 'PROMO_FIRST_MILK', 'MILK50', 'First Milk Order - 50% Off',
         '50% off on your first fresh milk purchase', 'active',
         10000, 1, NOW(), NOW()
       )
       ON CONFLICT (code) DO UPDATE SET
         promotion_id = 'PROMO_FIRST_MILK',
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         status = 'active',
         usage_limit_per_customer = 1,
         updated_at = NOW()`,
    );
  }

  // ── PROMOTIONS ───────────────────────────────────────────────────────────────

  async listPromotions(includeDeleted = false) {
    const rows = await this.db.query(
      `SELECT
         p.*,
         COALESCE(
           (SELECT COUNT(*) FROM promotion_redemptions pr WHERE pr.promotion_id = p.promotion_id),
           0
         )::int AS total_redemptions,
         COALESCE(
           (SELECT json_agg(
              json_build_object(
                'variant_id', pv.variant_id,
                'variant_name', pv.name,
                'product_name', prod.name,
                'product_id', pv.product_id,
                'price', pv.price,
                'category_id', prod.category_id,
                'category_name', cat.name
              )
            )
            FROM promotion_products pp
            JOIN product_variants pv ON pv.variant_id = pp.product_variant_id
            LEFT JOIN products prod ON prod.product_id = pv.product_id
            LEFT JOIN categories cat ON cat.category_id = prod.category_id
            WHERE pp.promotion_id = p.promotion_id AND pv.deleted_at IS NULL
           ),
           '[]'::json
         ) AS targeted_products,
         COALESCE(
           (SELECT ARRAY_AGG(pp.product_variant_id) FROM promotion_products pp WHERE pp.promotion_id = p.promotion_id),
           ARRAY[]::text[]
         ) AS product_variant_ids
       FROM promotions p
       WHERE ${includeDeleted ? 'TRUE' : 'p.deleted_at IS NULL'}
       ORDER BY p.created_at DESC`,
      [],
    );
    return { status: true, promotions: rows || [], data: rows || [] };
  }


  async getPromotion(promotionId: string) {
    const rows = await this.db.query(
      `SELECT
         p.*,
         COALESCE(
           (SELECT COUNT(*) FROM promotion_redemptions pr WHERE pr.promotion_id = p.promotion_id),
           0
         )::int AS total_redemptions,
         COALESCE(
           (SELECT json_agg(
              json_build_object(
                'variant_id', pv.variant_id,
                'variant_name', pv.name,
                'product_name', prod.name,
                'product_id', pv.product_id,
                'price', pv.price,
                'category_id', prod.category_id,
                'category_name', cat.name
              )
            )
            FROM promotion_products pp
            JOIN product_variants pv ON pv.variant_id = pp.product_variant_id
            LEFT JOIN products prod ON prod.product_id = pv.product_id
            LEFT JOIN categories cat ON cat.category_id = prod.category_id
            WHERE pp.promotion_id = p.promotion_id AND pv.deleted_at IS NULL
           ),
           '[]'::json
         ) AS targeted_products,
         COALESCE(
           (SELECT ARRAY_AGG(pp.product_variant_id) FROM promotion_products pp WHERE pp.promotion_id = p.promotion_id),
           ARRAY[]::text[]
         ) AS product_variant_ids
       FROM promotions p
       WHERE p.promotion_id = $1 AND p.deleted_at IS NULL`,
      [promotionId],
    );
    const promo = rows?.[0];
    if (!promo) throw new NotFoundException(`Promotion ${promotionId} not found`);
    return { status: true, promotion: promo, data: promo };
  }

  async createPromotion(dto: CreatePromotionDto, adminId: string) {
    const promotionId = generateId('PRMO', 20);
    const now = new Date();

    await this.Data.insert('promotions', {
      promotion_id: promotionId,
      name: dto.name,
      description: dto.description ?? null,
      promotion_type: dto.promotion_type,
      discount_value: dto.discount_value,
      max_discount_amount: dto.max_discount_amount ?? null,
      minimum_order_amount: dto.minimum_order_amount ?? 0,
      status: dto.status ?? 'active',
      start_at: dto.start_at ?? null,
      end_at: dto.end_at ?? null,
      first_order_only: dto.first_order_only ?? false,
      usage_limit: dto.usage_limit ?? null,
      usage_limit_per_customer: dto.usage_limit_per_customer ?? 1,
      auto_apply: dto.auto_apply ?? true,
      allow_subscription_orders: dto.allow_subscription_orders ?? false,
      stackable: dto.stackable ?? false,
      apply_to_all_products: dto.apply_to_all_products ?? false,
      created_by: adminId,
      updated_by: adminId,
      created_at: now,
      updated_at: now,
    });

    return { status: true, message: 'Promotion created', promotion_id: promotionId };
  }

  async updatePromotion(promotionId: string, dto: UpdatePromotionDto, adminId: string) {
    const existing = await this.db.query(
      `SELECT id FROM promotions WHERE promotion_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [promotionId],
    );
    if (!existing?.[0]) throw new NotFoundException(`Promotion ${promotionId} not found`);

    const updates: Record<string, any> = { updated_by: adminId, updated_at: new Date() };
    const fields = [
      'name', 'description', 'promotion_type', 'discount_value', 'max_discount_amount',
      'minimum_order_amount', 'status', 'first_order_only', 'usage_limit', 'usage_limit_per_customer',
      'auto_apply', 'allow_subscription_orders', 'stackable', 'apply_to_all_products',
      'start_at', 'end_at',
    ];
    for (const f of fields) {
      if ((dto as any)[f] !== undefined) updates[f] = (dto as any)[f];
    }

    await this.Data.update('promotions', updates, [
      { column: 'promotion_id', operator: '=', value: promotionId },
    ]);
    return { status: true, message: 'Promotion updated' };
  }

  async setPromotionStatus(promotionId: string, dto: SetPromotionStatusDto, adminId: string) {
    const existing = await this.db.query(
      `SELECT id FROM promotions WHERE promotion_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [promotionId],
    );
    if (!existing?.[0]) throw new NotFoundException(`Promotion ${promotionId} not found`);

    await this.Data.update('promotions', { status: dto.status, updated_by: adminId, updated_at: new Date() }, [
      { column: 'promotion_id', operator: '=', value: promotionId },
    ]);
    return { status: true, message: `Promotion status set to ${dto.status}` };
  }

  async deletePromotion(promotionId: string, adminId: string) {
    await this.Data.update('promotions', { deleted_at: new Date(), updated_by: adminId }, [
      { column: 'promotion_id', operator: '=', value: promotionId },
      { column: 'deleted_at', operator: 'IS', value: null },
    ]);
    return { status: true, message: 'Promotion deleted' };
  }

  // ── PROMOTION PRODUCTS ───────────────────────────────────────────────────────

  async addPromotionProducts(promotionId: string, dto: AddPromotionProductsDto) {
    const existing = await this.db.query(
      `SELECT id FROM promotions WHERE promotion_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [promotionId],
    );
    if (!existing?.[0]) throw new NotFoundException(`Promotion ${promotionId} not found`);

    const variantIdSet = new Set<string>();

    if (dto.variant_ids && Array.isArray(dto.variant_ids)) {
      for (const vid of dto.variant_ids) {
        if (vid && vid.trim()) variantIdSet.add(vid.trim());
      }
    }

    if (dto.product_ids && Array.isArray(dto.product_ids) && dto.product_ids.length > 0) {
      const prodVariants = await this.db.query(
        `SELECT pv.variant_id FROM product_variants pv WHERE pv.product_id = ANY($1) AND pv.deleted_at IS NULL`,
        [dto.product_ids],
      );
      for (const r of prodVariants || []) {
        if (r.variant_id) variantIdSet.add(r.variant_id);
      }
    }

    if (dto.category_ids && Array.isArray(dto.category_ids) && dto.category_ids.length > 0) {
      const catVariants = await this.db.query(
        `SELECT pv.variant_id
         FROM product_variants pv
         JOIN products p ON p.product_id = pv.product_id
         WHERE p.category_id = ANY($1) AND pv.deleted_at IS NULL AND p.deleted_at IS NULL`,
        [dto.category_ids],
      );
      for (const r of catVariants || []) {
        if (r.variant_id) variantIdSet.add(r.variant_id);
      }
    }

    const now = new Date();
    let inserted = 0;
    for (const variantId of variantIdSet) {
      try {
        await this.db.query(
          `INSERT INTO promotion_products (promotion_id, product_variant_id, created_at)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [promotionId, variantId, now],
        );
        inserted++;
      } catch (_) { /* skip invalid variants */ }
    }
    return { status: true, message: `${inserted} product variant(s) linked to promotion` };
  }

  async removePromotionProduct(promotionId: string, variantId: string) {
    if (variantId === 'all' || variantId === 'ALL') {
      await this.db.query(
        `DELETE FROM promotion_products WHERE promotion_id = $1`,
        [promotionId],
      );
      return { status: true, message: 'All variants removed from promotion' };
    }

    await this.db.query(
      `DELETE FROM promotion_products WHERE promotion_id = $1 AND product_variant_id = $2`,
      [promotionId, variantId],
    );
    return { status: true, message: 'Product removed from promotion' };
  }

  async getPromotionRedemptions(promotionId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const rows = await this.db.query(
      `SELECT pr.*, u.first_name, u.last_name, u.phone
       FROM promotion_redemptions pr
       LEFT JOIN users u ON u.user_id = pr.customer_id
       WHERE pr.promotion_id = $1
       ORDER BY pr.redeemed_at DESC
       LIMIT $2 OFFSET $3`,
      [promotionId, limit, offset],
    );
    const count = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM promotion_redemptions WHERE promotion_id = $1`,
      [promotionId],
    );
    return {
      status: true,
      redemptions: rows || [],
      data: rows || [],
      total: Number(count?.[0]?.cnt ?? 0),
      page,
      limit,
    };
  }

  // ── COUPONS ──────────────────────────────────────────────────────────────────

  async listCoupons() {
    const rows = await this.db.query(
      `SELECT c.*,
         p.name AS promotion_name, p.promotion_type, p.discount_value, p.status AS promo_status,
         (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.coupon_id)::int AS total_redemptions
       FROM coupons c
       JOIN promotions p ON p.promotion_id = c.promotion_id
       WHERE c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [],
    );
    return { status: true, coupons: rows || [], data: rows || [] };
  }


  async getCoupon(couponId: string) {
    const rows = await this.db.query(
      `SELECT c.*,
         p.name AS promotion_name, p.promotion_type, p.discount_value,
         p.max_discount_amount, p.minimum_order_amount, p.status AS promo_status,
         (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.coupon_id)::int AS total_redemptions
       FROM coupons c
       JOIN promotions p ON p.promotion_id = c.promotion_id
       WHERE c.coupon_id = $1 AND c.deleted_at IS NULL`,
      [couponId],
    );
    const coupon = rows?.[0];
    if (!coupon) throw new NotFoundException(`Coupon ${couponId} not found`);
    return { status: true, coupon };
  }

  async createCoupon(dto: CreateCouponDto, adminId: string) {
    // Validate parent promotion exists
    const promo = await this.db.query(
      `SELECT id FROM promotions WHERE promotion_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [dto.promotion_id],
    );
    if (!promo?.[0]) throw new NotFoundException(`Promotion ${dto.promotion_id} not found`);

    // Check code uniqueness
    const existing = await this.db.query(
      `SELECT id FROM coupons WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL LIMIT 1`,
      [dto.code],
    );
    if (existing?.[0]) throw new ConflictException(`Coupon code '${dto.code}' already exists`);

    const couponId = generateId('CPN', 20);
    const now = new Date();

    await this.Data.insert('coupons', {
      coupon_id: couponId,
      promotion_id: dto.promotion_id,
      code: dto.code.toUpperCase(),
      name: dto.name ?? null,
      description: dto.description ?? null,
      status: dto.status ?? 'active',
      usage_limit: dto.usage_limit ?? null,
      usage_limit_per_customer: dto.usage_limit_per_customer ?? 1,
      used_count: 0,
      start_at: dto.start_at ?? null,
      end_at: dto.end_at ?? null,
      created_by: adminId,
      updated_by: adminId,
      created_at: now,
      updated_at: now,
    });

    return { status: true, message: 'Coupon created', coupon_id: couponId };
  }

  async updateCoupon(couponId: string, dto: UpdateCouponDto, adminId: string) {
    const existing = await this.db.query(
      `SELECT id FROM coupons WHERE coupon_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [couponId],
    );
    if (!existing?.[0]) throw new NotFoundException(`Coupon ${couponId} not found`);

    const updates: Record<string, any> = { updated_by: adminId, updated_at: new Date() };
    const fields = ['promotion_id', 'name', 'description', 'status', 'usage_limit', 'usage_limit_per_customer', 'start_at', 'end_at'];
    for (const f of fields) {
      if ((dto as any)[f] !== undefined) updates[f] = (dto as any)[f];
    }

    await this.Data.update('coupons', updates, [
      { column: 'coupon_id', operator: '=', value: couponId },
    ]);
    return { status: true, message: 'Coupon updated' };
  }

  async setCouponStatus(couponId: string, dto: SetCouponStatusDto, adminId: string) {
    const existing = await this.db.query(
      `SELECT id FROM coupons WHERE coupon_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [couponId],
    );
    if (!existing?.[0]) throw new NotFoundException(`Coupon ${couponId} not found`);

    await this.Data.update('coupons', { status: dto.status, updated_by: adminId, updated_at: new Date() }, [
      { column: 'coupon_id', operator: '=', value: couponId },
    ]);
    return { status: true, message: `Coupon status set to ${dto.status}` };
  }

  async deleteCoupon(couponId: string, adminId: string) {
    await this.Data.update('coupons', { deleted_at: new Date(), updated_by: adminId }, [
      { column: 'coupon_id', operator: '=', value: couponId },
      { column: 'deleted_at', operator: 'IS', value: null },
    ]);
    return { status: true, message: 'Coupon deleted' };
  }

  async getCouponRedemptions(couponId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const rows = await this.db.query(
      `SELECT cr.*, u.first_name, u.last_name, u.phone
       FROM coupon_redemptions cr
       LEFT JOIN users u ON u.user_id = cr.customer_id
       WHERE cr.coupon_id = $1
       ORDER BY cr.redeemed_at DESC
       LIMIT $2 OFFSET $3`,
      [couponId, limit, offset],
    );
    const count = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_id = $1`,
      [couponId],
    );
    return {
      status: true,
      redemptions: rows || [],
      data: rows || [],
      total: Number(count?.[0]?.cnt ?? 0),
      page,
      limit,
    };
  }
}
