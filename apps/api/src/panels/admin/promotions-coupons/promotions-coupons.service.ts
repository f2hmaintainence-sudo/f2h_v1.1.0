import {
  BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { generateId } from 'src/helpers/RandomHelper';
import { saveImageUpload } from 'src/helpers/ImageHelper';
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
  ) { }

  async onModuleInit() {
    try {
      // Ensure PROMO_FIRST_MILK is active if it exists
      await this.db.query(
        `UPDATE promotions
         SET status = 'active', updated_at = NOW()
         WHERE promotion_id = 'PROMO_FIRST_MILK' AND status = 'expired'`,
      );

      // Ensure active milk product variants are linked to PROMO_FIRST_MILK
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
    } catch (e) {
      console.error('[PromotionsCouponsService] onModuleInit activation failed', e);
    }
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

  // ── PUSH NOTIFICATION CAMPAIGNS ────────────────────────────────────────────

  async listPushCampaigns(status?: string) {
    const statusClause = status && status !== 'all' ? `AND status = '${status.replace(/'/g, "''")}'` : '';
    const rows = await this.db.query(
      `SELECT * FROM push_notification_campaigns
       WHERE deleted_at IS NULL ${statusClause}
       ORDER BY created_at DESC`,
    );
    return { status: true, data: rows || [] };
  }

  async getPushCampaign(campaignId: string) {
    const rows = await this.db.query(
      `SELECT * FROM push_notification_campaigns WHERE campaign_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [campaignId],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Campaign not found');
    return { status: true, data: rows[0] };
  }

  async createPushCampaign(body: any, adminId: string) {
    const {
      title,
      body: msgBody,
      image_url,
      category,
      target_audience,
      target_user_ids,
      schedule_type,
      scheduled_at,
      action_type,
      action_value,
      target_category_id,
      target_product_id,
      data_payload,
    } = body;
    if (!title?.trim()) throw new BadRequestException('Title is required');
    if (!msgBody?.trim()) throw new BadRequestException('Message body is required');

    let processedImageUrl = image_url?.trim() || null;
    if (processedImageUrl && processedImageUrl.startsWith('data:image')) {
      try {
        processedImageUrl = saveImageUpload(processedImageUrl, 'push_campaigns');
      } catch (err: any) {
        // Fallback or leave as-is if decoding error
      }
    }

    let parsedScheduledAt: string | null = null;
    if (scheduled_at && typeof scheduled_at === 'string' && scheduled_at.trim()) {
      const d = new Date(scheduled_at.trim());
      if (!isNaN(d.getTime())) {
        parsedScheduledAt = d.toISOString();
      }
    }

    const resolvedActionType = action_type || 'NONE';
    const resolvedActionValue = action_value?.trim() || null;
    const resolvedTargetCat = target_category_id?.trim() || (resolvedActionType === 'CATEGORY' ? resolvedActionValue : null);
    const resolvedTargetProd = target_product_id?.trim() || (resolvedActionType === 'PRODUCT' ? resolvedActionValue : null);

    const mergedPayload = {
      ...(typeof data_payload === 'object' && data_payload ? data_payload : {}),
      action_type: resolvedActionType,
      action_value: resolvedActionValue,
      category_id: resolvedTargetCat,
      product_id: resolvedTargetProd,
    };

    const rows = await this.db.query(
      `INSERT INTO push_notification_campaigns
         (title, body, image_url, category, target_audience, target_user_ids, schedule_type, scheduled_at, action_type, action_value, target_category_id, target_product_id, data_payload, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, 'draft', $14, $14)
       RETURNING *`,
      [
        title.trim(),
        msgBody.trim(),
        processedImageUrl,
        category?.trim() || 'promotional',
        target_audience || 'all_customers',
        target_user_ids && target_user_ids.length > 0 ? target_user_ids : null,
        schedule_type || 'immediate',
        parsedScheduledAt,
        resolvedActionType,
        resolvedActionValue,
        resolvedTargetCat,
        resolvedTargetProd,
        JSON.stringify(mergedPayload),
        adminId,
      ],
    );
    return { status: true, message: 'Campaign created as draft', data: rows[0] };
  }

  async updatePushCampaign(campaignId: string, body: any, adminId: string) {
    const existing = await this.getPushCampaign(campaignId);
    if (['sent', 'cancelled'].includes(existing.data.status)) {
      throw new BadRequestException('Cannot edit a campaign that is already sent or cancelled');
    }

    const {
      title,
      body: msgBody,
      image_url,
      category,
      target_audience,
      target_user_ids,
      schedule_type,
      scheduled_at,
      action_type,
      action_value,
      target_category_id,
      target_product_id,
      data_payload,
    } = body;

    let processedImageUrl: string | null | undefined = undefined;
    if (image_url !== undefined) {
      processedImageUrl = image_url?.trim() || null;
      if (processedImageUrl && processedImageUrl.startsWith('data:image')) {
        try {
          processedImageUrl = saveImageUpload(processedImageUrl, 'push_campaigns');
        } catch (err: any) {
          // ignore
        }
      }
    }

    let parsedScheduledAt: string | null | undefined = undefined;
    if (scheduled_at !== undefined) {
      if (scheduled_at && typeof scheduled_at === 'string' && scheduled_at.trim()) {
        const d = new Date(scheduled_at.trim());
        parsedScheduledAt = !isNaN(d.getTime()) ? d.toISOString() : null;
      } else {
        parsedScheduledAt = null;
      }
    }

    const resolvedActionType = action_type !== undefined ? (action_type || 'NONE') : (existing.data.action_type || 'NONE');
    const resolvedActionValue = action_value !== undefined ? (action_value?.trim() || null) : existing.data.action_value;
    const resolvedTargetCat = target_category_id !== undefined ? (target_category_id?.trim() || null) : existing.data.target_category_id;
    const resolvedTargetProd = target_product_id !== undefined ? (target_product_id?.trim() || null) : existing.data.target_product_id;

    const mergedPayload = {
      ...(typeof existing.data.data_payload === 'object' && existing.data.data_payload ? existing.data.data_payload : {}),
      ...(typeof data_payload === 'object' && data_payload ? data_payload : {}),
      action_type: resolvedActionType,
      action_value: resolvedActionValue,
      category_id: resolvedTargetCat,
      product_id: resolvedTargetProd,
    };

    const rows = await this.db.query(
      `UPDATE push_notification_campaigns SET
         title = COALESCE($1, title),
         body = COALESCE($2, body),
         image_url = CASE WHEN $3::boolean THEN $4 ELSE image_url END,
         category = COALESCE($5, category),
         target_audience = COALESCE($6, target_audience),
         target_user_ids = CASE WHEN $7::boolean THEN $8 ELSE target_user_ids END,
         schedule_type = COALESCE($9, schedule_type),
         scheduled_at = CASE WHEN $10::boolean THEN $11::timestamptz ELSE scheduled_at END,
         action_type = COALESCE($12, action_type),
         action_value = CASE WHEN $13::boolean THEN $14 ELSE action_value END,
         target_category_id = CASE WHEN $15::boolean THEN $16 ELSE target_category_id END,
         target_product_id = CASE WHEN $17::boolean THEN $18 ELSE target_product_id END,
         data_payload = COALESCE($19::jsonb, data_payload),
         status = 'draft',
         updated_by = $20,
         updated_at = NOW()
       WHERE campaign_id = $21 AND deleted_at IS NULL
       RETURNING *`,
      [
        title?.trim() || null,
        msgBody?.trim() || null,
        image_url !== undefined,
        processedImageUrl || null,
        category?.trim() || null,
        target_audience || null,
        target_user_ids !== undefined,
        Array.isArray(target_user_ids) && target_user_ids.length > 0 ? target_user_ids : null,
        schedule_type || null,
        scheduled_at !== undefined,
        parsedScheduledAt || null,
        action_type || null,
        action_value !== undefined,
        resolvedActionValue,
        target_category_id !== undefined,
        resolvedTargetCat,
        target_product_id !== undefined,
        resolvedTargetProd,
        JSON.stringify(mergedPayload),
        adminId,
        campaignId,
      ],
    );
    if (!rows || rows.length === 0) throw new NotFoundException('Campaign not found');
    return { status: true, message: 'Campaign updated', data: rows[0] };
  }

  async submitPushCampaignForApproval(campaignId: string, adminId: string) {
    const existing = await this.getPushCampaign(campaignId);
    if (!['draft', 'rejected'].includes(existing.data.status)) {
      throw new BadRequestException('Only draft or rejected campaigns can be submitted for approval');
    }
    const rows = await this.db.query(
      `UPDATE push_notification_campaigns SET status = 'pending_approval', updated_by = $1, updated_at = NOW()
       WHERE campaign_id = $2 AND deleted_at IS NULL RETURNING *`,
      [adminId, campaignId],
    );
    return { status: true, message: 'Campaign submitted for approval', data: rows?.[0] };
  }

  async approvePushCampaign(campaignId: string, adminId: string) {
    const existing = await this.getPushCampaign(campaignId);
    if (existing.data.status !== 'pending_approval') {
      throw new BadRequestException('Only pending_approval campaigns can be approved');
    }
    const rows = await this.db.query(
      `UPDATE push_notification_campaigns SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_by = $1, updated_at = NOW()
       WHERE campaign_id = $2 AND deleted_at IS NULL RETURNING *`,
      [adminId, campaignId],
    );
    return { status: true, message: 'Campaign approved', data: rows?.[0] };
  }

  async rejectPushCampaign(campaignId: string, reason: string, adminId: string) {
    const existing = await this.getPushCampaign(campaignId);
    if (existing.data.status !== 'pending_approval') {
      throw new BadRequestException('Only pending_approval campaigns can be rejected');
    }
    const rows = await this.db.query(
      `UPDATE push_notification_campaigns SET status = 'rejected', rejection_reason = $1, approved_by = $2, approved_at = NOW(), updated_by = $2, updated_at = NOW()
       WHERE campaign_id = $3 AND deleted_at IS NULL RETURNING *`,
      [reason || 'No reason provided', adminId, campaignId],
    );
    return { status: true, message: 'Campaign rejected', data: rows?.[0] };
  }

  async sendPushCampaign(campaignId: string, adminId: string, pushService: any) {
    const existing = await this.getPushCampaign(campaignId);
    const campaign = existing.data;
    if (campaign.status !== 'approved') {
      throw new BadRequestException('Campaign must be approved before sending');
    }

    // Resolve target user IDs
    let userIds: string[] = [];
    if (campaign.target_audience === 'specific_users' && campaign.target_user_ids?.length > 0) {
      userIds = campaign.target_user_ids;
    } else if (campaign.target_audience === 'all_customers') {
      const rows = await this.db.query(`SELECT customer_id AS user_id FROM customers WHERE deleted_at IS NULL`);
      userIds = (rows || []).map((r: any) => r.user_id).filter(Boolean);
    } else if (campaign.target_audience === 'all_delivery_partners') {
      const rows = await this.db.query(`SELECT delivery_partner_id AS user_id FROM delivery_partners WHERE deleted_at IS NULL`);
      userIds = (rows || []).map((r: any) => r.user_id).filter(Boolean);
    } else {
      // all_users
      const rows = await this.db.query(`SELECT user_id FROM users WHERE deleted_at IS NULL`);
      userIds = (rows || []).map((r: any) => r.user_id).filter(Boolean);
    }

    let sentCount = 0;
    let failedCount = 0;

    if (pushService && userIds.length > 0) {
      try {
        const result = await pushService.sendNotificationToUsers(userIds, {
          title: campaign.title,
          body: campaign.body,
          data: {
            campaign_id: campaign.campaign_id,
            image_url: campaign.image_url || '',
            category: campaign.category || 'promotional',
            action_type: campaign.action_type || 'NONE',
            action_value: campaign.action_value || '',
            category_id: campaign.target_category_id || '',
            product_id: campaign.target_product_id || '',
            ...(campaign.data_payload || {}),
          },
        });
        sentCount = userIds.length;
        if (!result.success) failedCount = userIds.length;
      } catch (e) {
        failedCount = userIds.length;
      }
    }

    await this.db.query(
      `UPDATE push_notification_campaigns SET status = 'sent', sent_at = NOW(), sent_count = $1, failed_count = $2, updated_by = $3, updated_at = NOW()
       WHERE campaign_id = $4`,
      [sentCount, failedCount, adminId, campaignId],
    );

    return { status: true, message: `Campaign sent to ${sentCount} users`, sentCount, failedCount };
  }

  async deletePushCampaign(campaignId: string, adminId: string) {
    await this.db.query(
      `UPDATE push_notification_campaigns SET deleted_at = NOW(), updated_by = $1, updated_at = NOW()
       WHERE campaign_id = $2 AND deleted_at IS NULL`,
      [adminId, campaignId],
    );
    return { status: true, message: 'Campaign deleted' };
  }
}
