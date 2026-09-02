import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { PricingService } from 'src/shared/services/pricing.service';
import {
  CreateDeveloperSubscriptionDto,
  DeveloperSubscriptionItemDto,
} from '../dto/create-developer-subscription.dto';
import { resolveImageUrl } from 'src/helpers/ImageHelper';

@Injectable()
export class CategoriesProductsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly Data: DataService,
    private readonly developer: DeveloperService,
    private readonly pricingService: PricingService,
  ) { }

  // ─────────────────────────────────────────────────────────────────────────
  // BANNERS: rows the admin panel manages in `product_banner`
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Active banners of the given types, ordered the way the admin arranged
   * them. Returns [] on any failure so callers can fall back to the bundled
   * banner images rather than showing the customer an empty carousel.
   */
  async getManagedBanners(
    bannerTypes: string[],
    isPopup: boolean,
  ): Promise<any[]> {
    try {
      let queryStr: string;
      let params: any[];

      if (isPopup) {
        queryStr = `SELECT pb.id, pb.title, pb.description, pb.discount_text, pb.action_type, pb.action_value,
                           pb.category_id, pb.cta_label, pb.background_color, pb.banner_type,
                           pb.is_popup, pb.display_order, pb.image_url, pb.image_path,
                           c.name AS category_name
                      FROM product_banner pb
                      LEFT JOIN categories c ON (c.category_id = pb.category_id OR c.id::text = pb.category_id)
                     WHERE pb.deleted_at IS NULL
                       AND (pb.is_active IS TRUE OR pb.is_active IS NULL OR pb.is_active::text = 'true' OR pb.is_active::text = '1')
                       AND (COALESCE(pb.is_popup, FALSE) = TRUE OR pb.banner_type = 'popup')
                     ORDER BY pb.display_order ASC, pb.id DESC`;
        params = [];
      } else if (bannerTypes && bannerTypes.length > 0) {
        // Filter strictly by the given banner_type values
        queryStr = `SELECT pb.id, pb.title, pb.description, pb.discount_text, pb.action_type, pb.action_value,
                           pb.category_id, pb.cta_label, pb.background_color, pb.banner_type,
                           pb.is_popup, pb.display_order, pb.image_url, pb.image_path,
                           c.name AS category_name
                      FROM product_banner pb
                      LEFT JOIN categories c ON (c.category_id = pb.category_id OR c.id::text = pb.category_id)
                      WHERE pb.deleted_at IS NULL
                        AND (pb.is_active IS TRUE OR pb.is_active IS NULL OR pb.is_active::text = 'true' OR pb.is_active::text = '1')
                        AND COALESCE(pb.is_popup, FALSE) = FALSE
                        AND pb.banner_type = ANY($1::text[])
                     ORDER BY pb.display_order ASC, pb.id DESC`;
        params = [bannerTypes];
      } else {
        queryStr = `SELECT pb.id, pb.title, pb.description, pb.discount_text, pb.action_type, pb.action_value,
                           pb.category_id, pb.cta_label, pb.background_color, pb.banner_type,
                           pb.is_popup, pb.display_order, pb.image_url, pb.image_path,
                           c.name AS category_name
                      FROM product_banner pb
                      LEFT JOIN categories c ON (c.category_id = pb.category_id OR c.id::text = pb.category_id)
                      WHERE pb.deleted_at IS NULL
                        AND (pb.is_active IS TRUE OR pb.is_active IS NULL OR pb.is_active::text = 'true' OR pb.is_active::text = '1')
                     ORDER BY pb.display_order ASC, pb.id DESC`;
        params = [];
      }

      const rows = await this.db.query(queryStr, params);
      return rows ?? [];
    } catch (error) {
      this.developer.error('getManagedBanners failed', { error, bannerTypes, isPopup });
      return [];
    }
  }

  /**
   * Returns only active `category_slide` banners with their category_id and category_name.
   */
  async getCategorySlideBanners(): Promise<any[]> {
    try {
      const rows = await this.db.query(
        `SELECT pb.id, pb.title, pb.description, pb.discount_text, pb.action_type, pb.action_value,
                pb.category_id, pb.cta_label, pb.background_color, pb.banner_type,
                pb.display_order, pb.image_url, pb.image_path,
                c.name AS category_name, c.category_id AS resolved_category_id
           FROM product_banner pb
           LEFT JOIN categories c ON (c.category_id = pb.category_id OR c.id::text = pb.category_id)
          WHERE pb.deleted_at IS NULL
            AND (pb.is_active IS TRUE OR pb.is_active IS NULL OR pb.is_active::text = 'true' OR pb.is_active::text = '1')
            AND pb.banner_type = 'category_slide'
            AND COALESCE(pb.is_popup, FALSE) = FALSE
          ORDER BY pb.display_order ASC, pb.id DESC`,
        [],
      );
      return rows ?? [];
    } catch (error) {
      this.developer.error('getCategorySlideBanners failed', { error });
      return [];
    }
  }

  /**
   * Returns only active `checkout_banner` banners.
   */
  async getCheckoutBanners(): Promise<any[]> {
    try {
      const rows = await this.db.query(
        `SELECT pb.id, pb.title, pb.description, pb.discount_text, pb.action_type, pb.action_value,
                pb.category_id, pb.cta_label, pb.background_color, pb.banner_type,
                pb.display_order, pb.image_url, pb.image_path,
                c.name AS category_name
           FROM product_banner pb
           LEFT JOIN categories c ON (c.category_id = pb.category_id OR c.id::text = pb.category_id)
          WHERE pb.deleted_at IS NULL
            AND (pb.is_active IS TRUE OR pb.is_active IS NULL OR pb.is_active::text = 'true' OR pb.is_active::text = '1')
            AND pb.banner_type = 'checkout_banner'
            AND COALESCE(pb.is_popup, FALSE) = FALSE
          ORDER BY pb.display_order ASC, pb.id DESC`,
        [],
      );
      return rows ?? [];
    } catch (error) {
      this.developer.error('getCheckoutBanners failed', { error });
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED: Build a map of product_id → { rating, reviews } from all ratings
  // ─────────────────────────────────────────────────────────────────────────
  private async buildRatingsMap(): Promise<Map<string, { rating: number; reviews: number }>> {
    const map = new Map<string, { rating: number; reviews: number }>();
    try {
      const rows = await this.db.query(
        `SELECT
           COALESCE(pv.product_id, cf.reference_id) AS product_id,
           COALESCE(AVG(cf.rating), 0) AS avg_rating,
           COUNT(*) AS review_count
         FROM customer_feedback cf
         LEFT JOIN product_variants pv ON pv.variant_id = cf.reference_id
         WHERE cf.reference_type = 'product' AND cf.rating IS NOT NULL
         GROUP BY COALESCE(pv.product_id, cf.reference_id)`,
      );
      for (const r of rows || []) {
        map.set(r.product_id, {
          rating: parseFloat(r.avg_rating),
          reviews: parseInt(r.review_count, 10),
        });
      }
    } catch (_e) {
      // Non-critical — return empty map; products will show 0 rating
    }
    return map;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESOLVE WAREHOUSE for a given branch
  // warehouses.branch_id is a direct FK; one active warehouse per branch.
  // Returns null when branch is unknown — callers fall back to all-warehouse
  // stock aggregation (safe, backward-compatible).
  // ─────────────────────────────────────────────────────────────────────────
  async resolveWarehouseId(branchId: string | null | undefined): Promise<string | null> {
    if (!branchId) return null;
    try {
      const rows = await this.db.query(
        `SELECT warehouse_id FROM warehouses WHERE branch_id = $1 AND is_active = true AND deleted_at IS NULL LIMIT 1`,
        [branchId],
      );
      return rows?.[0]?.warehouse_id ?? null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET CATEGORIES
  // Categories images → categories.image_path (categories/ folder)
  // ─────────────────────────────────────────────────────────────────────────
  async getCategories(backendUrl?: string) {
    const baseUrl =
      process.env.MOBILE_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:5001';

    try {
      const query = `
        SELECT DISTINCT
          c.category_id,
          c.name,
          c.slug,
          c.description,
          c.image_path
        FROM categories c
        JOIN products p ON (
          p.category_id = c.category_id 
          OR p.category_id = c.name 
          OR LOWER(p.category_id) = LOWER(c.name) 
          OR p.category_id = c.slug 
          OR LOWER(p.category_id) = LOWER(c.slug)
        )
        JOIN product_variants pv ON pv.product_id = p.product_id
        WHERE c.is_active = true
          AND (p.is_active = true OR p.is_active IS NULL)
          AND p.deleted_at IS NULL
          AND (pv.status = 'active' OR pv.status IS NULL)
        ORDER BY c.name ASC
      `;
      const rows = await this.db.query(query);

      const mappedData = (rows || []).map((cat: any) => ({
        ...cat,
        image_path: resolveImageUrl(cat.image_path, baseUrl),
      }));

      return { data: mappedData };
    } catch (e) {
      console.error('Error in getCategories service:', e);
      return { data: [] };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCTS (all active variants)
  // Variant images  → product_images.storage_key (variants/ folder, variant_id FK)
  // Product fallback → products.image_path (products/ folder)
  // ─────────────────────────────────────────────────────────────────────────
  async getProducts(customerId?: string | null, warehouseId?: string | null) {
    const baseUrl =
      process.env.MOBILE_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:5001';

    const ratingsMap = await this.buildRatingsMap();

    // stock_balances subquery — scoped to warehouse when known, otherwise global
    const stockSubquery = warehouseId
      ? `SELECT product_variant_id,
             COALESCE(SUM(available_quantity), 0) AS available_quantity,
             COALESCE(MIN(low_stock_threshold), 0) AS low_stock_threshold,
             BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
           FROM stock_balances
           WHERE warehouse_id = '${warehouseId.replace(/'/g, "''")}'`
      : `SELECT product_variant_id,
             COALESCE(SUM(available_quantity), 0) AS available_quantity,
             COALESCE(MIN(low_stock_threshold), 0) AS low_stock_threshold,
             BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
           FROM stock_balances`;

    try {
      // Variant images are loaded exclusively from product_images, joined on variant_id.
      // product_images must NOT be joined on product_id to avoid mixing product-level
      // records into the variant image slot.
      const query = `
        SELECT
          pv.variant_id,
          pv.product_id,
          pv.name AS variant_name,
          pv.price,
          pv.original_price,
          pv.discount,
          pv.unit_value,
          pv.unit_type,
          p.name AS product_name,
          p.slug,
          p.description,
          p.highlights,
          p.ingredients,
          p.legal_info,
          CASE
            WHEN COALESCE(p.is_out_of_stock, false) = true THEN
              (COALESCE(sb.is_out_of_stock, false) OR COALESCE(sb.available_quantity, 0) <= 0)
            ELSE
              false
          END AS is_out_of_stock,
          COALESCE(sb.available_quantity, 0) AS available_quantity,
          sb.low_stock_threshold,
          p.is_subscribable,
          p.is_one_time,
          pv.subscription_price,
          COALESCE(c.category_id, p.category_id) AS category_id,
          c.name AS category,
          c.name AS category_name,
          c.image_path AS product_image,
          (
            SELECT pi.storage_key FROM product_images pi
            WHERE pi.variant_id = pv.variant_id
              AND pi.deleted_at IS NULL
              AND pi.storage_key IS NOT NULL
              AND pi.storage_key <> ''
              AND (pi.is_primary = true OR pi.sort_order = 0)
            ORDER BY pi.is_primary DESC NULLS LAST, pi.sort_order ASC NULLS LAST LIMIT 1
          ) AS variant_image,
          (
            SELECT COALESCE(json_agg(pi.storage_key ORDER BY pi.is_primary DESC NULLS LAST, pi.sort_order ASC NULLS LAST, pi.id ASC), '[]'::json)
            FROM product_images pi
            WHERE pi.variant_id = pv.variant_id
              AND pi.deleted_at IS NULL
              AND pi.storage_key IS NOT NULL
              AND pi.storage_key <> ''
          ) AS variant_images
        FROM product_variants pv
        LEFT JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          ${stockSubquery}
          GROUP BY product_variant_id
        ) sb ON sb.product_variant_id = pv.variant_id
        WHERE (pv.status = 'active' OR pv.status IS NULL)
          AND (p.is_active = true OR p.is_active IS NULL)
          AND p.deleted_at IS NULL
      `;
      const rows = await this.db.query(query);

      const mappedData = (rows || []).map((item: any) => {
        const ratingInfo = ratingsMap.get(item.product_id) ?? { rating: 0.0, reviews: 0 };
        const rawVariantImages = Array.isArray(item.variant_images) ? item.variant_images : [];
        const variantImages = rawVariantImages.map((img: string) => resolveImageUrl(img, baseUrl)).filter(Boolean);
        const rawImage = item.variant_image || item.product_image;
        const primaryImage = resolveImageUrl(rawImage, baseUrl);
        const allImages = variantImages.length > 0
          ? variantImages
          : (primaryImage ? [primaryImage] : []);

        return {
          ...item,
          image_path: primaryImage,
          variant_images: allImages,
          images: allImages,
          rating: ratingInfo.rating,
          reviews: ratingInfo.reviews,
        };
      });

      const enrichedData = await this.pricingService.applyPricingToProductList(customerId || null, mappedData);

      return { data: enrichedData };
    } catch (e) {
      console.error('Error in getProducts service:', e);
      return { data: [] };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCTS BY CATEGORY ID
  // Same image rules as getProducts()
  // ─────────────────────────────────────────────────────────────────────────
  async getProductsByCategoryId(categoryId: string, customerId?: string | null, warehouseId?: string | null) {
    const baseUrl =
      process.env.MOBILE_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:5001';

    const ratingsMap = await this.buildRatingsMap();

    // stock_balances subquery — scoped to warehouse when known, otherwise global
    const stockSubquery = warehouseId
      ? `SELECT product_variant_id,
             COALESCE(SUM(available_quantity), 0) AS available_quantity,
             COALESCE(MIN(low_stock_threshold), 0) AS low_stock_threshold,
             BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
           FROM stock_balances
           WHERE warehouse_id = '${warehouseId.replace(/'/g, "''")}'`
      : `SELECT product_variant_id,
             COALESCE(SUM(available_quantity), 0) AS available_quantity,
             COALESCE(MIN(low_stock_threshold), 0) AS low_stock_threshold,
             BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
           FROM stock_balances`;

    try {
      const query = `
        SELECT
          pv.variant_id,
          pv.product_id,
          pv.name AS variant_name,
          pv.price,
          pv.original_price,
          pv.discount,
          pv.unit_value,
          pv.unit_type,
          p.name AS product_name,
          p.slug,
          p.description,
          p.highlights,
          p.ingredients,
          p.legal_info,
          CASE
            WHEN COALESCE(p.is_out_of_stock, false) = true THEN
              (COALESCE(sb.is_out_of_stock, false) OR COALESCE(sb.available_quantity, 0) <= 0)
            ELSE
              false
          END AS is_out_of_stock,
          COALESCE(sb.available_quantity, 0) AS available_quantity,
          sb.low_stock_threshold,
          p.is_subscribable,
          p.is_one_time,
          pv.subscription_price,
          COALESCE(c.category_id, p.category_id) AS category_id,
          c.name AS category,
          c.name AS category_name,
          c.image_path AS product_image,
          (
            SELECT pi.storage_key FROM product_images pi
            WHERE pi.variant_id = pv.variant_id
              AND pi.deleted_at IS NULL
              AND pi.storage_key IS NOT NULL
              AND pi.storage_key <> ''
              AND (pi.is_primary = true OR pi.sort_order = 0)
            ORDER BY pi.is_primary DESC NULLS LAST, pi.sort_order ASC NULLS LAST LIMIT 1
          ) AS variant_image,
          (
            SELECT COALESCE(json_agg(pi.storage_key ORDER BY pi.is_primary DESC NULLS LAST, pi.sort_order ASC NULLS LAST, pi.id ASC), '[]'::json)
            FROM product_images pi
            WHERE pi.variant_id = pv.variant_id
              AND pi.deleted_at IS NULL
              AND pi.storage_key IS NOT NULL
              AND pi.storage_key <> ''
          ) AS variant_images
        FROM product_variants pv
        LEFT JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          ${stockSubquery}
          GROUP BY product_variant_id
        ) sb ON sb.product_variant_id = pv.variant_id
        WHERE (pv.status = 'active' OR pv.status IS NULL)
          AND (p.is_active = true OR p.is_active IS NULL)
          AND p.deleted_at IS NULL
          AND (p.category_id = $1 OR c.category_id = $1 OR c.name = $1 OR LOWER(c.name) = LOWER($1) OR c.slug = $1 OR LOWER(c.slug) = LOWER($1))
      `;
      const rows = await this.db.query(query, [categoryId]);

      const mappedData = (rows || []).map((item: any) => {
        const ratingInfo = ratingsMap.get(item.product_id) ?? { rating: 0.0, reviews: 0 };
        const rawVariantImages = Array.isArray(item.variant_images) ? item.variant_images : [];
        const variantImages = rawVariantImages.map((img: string) => resolveImageUrl(img, baseUrl)).filter(Boolean);
        const rawImage = item.variant_image || item.product_image;
        const primaryImage = resolveImageUrl(rawImage, baseUrl);
        const allImages = variantImages.length > 0
          ? variantImages
          : (primaryImage ? [primaryImage] : []);

        return {
          ...item,
          image_path: primaryImage,
          variant_images: allImages,
          images: allImages,
          rating: ratingInfo.rating,
          reviews: ratingInfo.reviews,
        };
      });

      const enrichedData = await this.pricingService.applyPricingToProductList(customerId || null, mappedData);

      return { data: enrichedData };
    } catch (e) {
      console.error('Error in getProductsByCategoryId service:', e);
      return { data: [] };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCT REVIEWS
  // Accepts either product_id OR variant_id and resolves product_id
  // ─────────────────────────────────────────────────────────────────────────
  async getProductReviews(productIdOrVariantId: string) {
    try {
      let targetProductId = productIdOrVariantId;

      // If passed parameter is a variant_id, resolve its parent product_id
      const variantRows = await this.db.query(
        `SELECT product_id FROM product_variants WHERE variant_id = $1 LIMIT 1`,
        [productIdOrVariantId],
      );
      if (variantRows && variantRows.length > 0 && variantRows[0].product_id) {
        targetProductId = variantRows[0].product_id;
      }

      // Fetch all variant_ids for this product so we capture reviews attached to product or any of its variants
      const allVariantRows = await this.db.query(
        `SELECT variant_id FROM product_variants WHERE product_id = $1`,
        [targetProductId],
      );
      const allReferenceIds = Array.from(
        new Set([
          targetProductId,
          productIdOrVariantId,
          ...(allVariantRows || []).map((v: any) => v.variant_id),
        ].filter(Boolean)),
      );

      const rows = await this.db.query(
        `SELECT
           cf.rating,
           cf.feedback,
           cf.created_at,
           COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), 'Verified Customer') AS customer_name
         FROM customer_feedback cf
         LEFT JOIN users u ON u.user_id = cf.customer_id
         WHERE cf.reference_id = ANY($1::text[]) AND cf.reference_type = 'product'
         ORDER BY cf.created_at DESC`,
        [allReferenceIds],
      );
      return { status: true, data: rows || [] };
    } catch (e) {
      console.error('Error in getProductReviews service:', e);
      return { status: false, data: [], message: 'Failed to load reviews' };
    }
  }
}
