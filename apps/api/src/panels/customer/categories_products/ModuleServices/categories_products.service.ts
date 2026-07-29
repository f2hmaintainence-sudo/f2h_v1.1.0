import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
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
  ) { }

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED: Build a map of product_id → { rating, reviews } from all ratings
  // ─────────────────────────────────────────────────────────────────────────
  private async buildRatingsMap(): Promise<Map<string, { rating: number; reviews: number }>> {
    const map = new Map<string, { rating: number; reviews: number }>();
    try {
      const rows = await this.db.query(
        `SELECT
           reference_id AS product_id,
           COALESCE(AVG(rating), 0) AS avg_rating,
           COUNT(*) AS review_count
         FROM customer_feedback
         WHERE reference_type = 'product' AND rating IS NOT NULL
         GROUP BY reference_id`,
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
  // GET CATEGORIES
  // Categories images → categories.image_path (categories/ folder)
  // ─────────────────────────────────────────────────────────────────────────
  async getCategories(backendUrl?: string) {
    const response = await this.Data.query('categories', {
      select: [
        'category_id',
        'name',
        'slug',
        'description',
        'image_path',
      ],
      where: [
        {
          column: 'is_active',
          value: true,
        },
      ],
    });

    if (!response.status) {
      console.error('DATABASE ERROR IN getCategories:', response);
    }

    const baseUrl =
      process.env.MOBILE_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:5001';

    const mappedData = (response.data || []).map((cat: any) => ({
      ...cat,
      // Category images live in categories/ folder, read from categories.image_path
      image_path: resolveImageUrl(cat.image_path, baseUrl),
    }));

    return { data: mappedData };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCTS (all active variants)
  // Variant images  → product_images.url (variants/ folder, variant_id FK)
  // Product fallback → products.image_path (products/ folder)
  // ─────────────────────────────────────────────────────────────────────────
  async getProducts() {
    const baseUrl =
      process.env.MOBILE_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:5001';

    const ratingsMap = await this.buildRatingsMap();

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
          pv.unit_value,
          pv.unit_type,
          p.name AS product_name,
          p.slug,
          p.description,
          p.highlights,
          p.ingredients,
          p.legal_info,
          (COALESCE(p.is_out_of_stock, false) OR COALESCE(sb.is_out_of_stock, false) OR COALESCE(sb.available_quantity, 0) <= 0) AS is_out_of_stock,
          COALESCE(sb.available_quantity, 0) AS available_quantity,
          sb.low_stock_threshold,
          p.is_subscribable,
          p.is_one_time,
          pv.subscription_price,
          c.name AS category,
          p.image_path AS product_image,
          (
            SELECT pi.url FROM product_images pi
            WHERE pi.variant_id = pv.variant_id
              AND pi.deleted_at IS NULL
            ORDER BY pi.is_primary DESC LIMIT 1
          ) AS variant_image
        FROM product_variants pv
        LEFT JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          SELECT
            product_variant_id,
            COALESCE(SUM(available_quantity), 0) AS available_quantity,
            COALESCE(MIN(low_stock_threshold), 0) AS low_stock_threshold,
            BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
          FROM stock_balances
          GROUP BY product_variant_id
        ) sb ON sb.product_variant_id = pv.variant_id
        LEFT JOIN LATERAL (
          SELECT url FROM product_images pi2
          WHERE pi2.variant_id = pv.variant_id AND pi2.deleted_at IS NULL
          ORDER BY pi2.is_primary DESC NULLS LAST, pi2.id ASC
          LIMIT 1
        ) pi ON true
        WHERE (pv.status = 'active' OR pv.status IS NULL)
          AND (p.is_active = true OR p.is_active IS NULL)
          AND p.deleted_at IS NULL
      `;
      const rows = await this.db.query(query);

      const mappedData = (rows || []).map((item: any) => {
        const ratingInfo = ratingsMap.get(item.product_id) ?? { rating: 0.0, reviews: 0 };
        // Variant image takes precedence; fall back to product image
        const rawImage = item.variant_image || item.product_image;
        return {
          ...item,
          image_path: resolveImageUrl(rawImage, baseUrl),
          rating: ratingInfo.rating,
          reviews: ratingInfo.reviews,
        };
      });

      return { data: mappedData };
    } catch (e) {
      console.error('Error in getProducts service:', e);
      return { data: [] };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCTS BY CATEGORY ID
  // Same image rules as getProducts()
  // ─────────────────────────────────────────────────────────────────────────
  async getProductsByCategoryId(categoryId: string) {
    const baseUrl =
      process.env.MOBILE_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:5001';

    const ratingsMap = await this.buildRatingsMap();

    try {
      const query = `
        SELECT
          pv.variant_id,
          pv.product_id,
          pv.name AS variant_name,
          pv.price,
          pv.unit_value,
          pv.unit_type,
          p.name AS product_name,
          p.slug,
          p.description,
          p.highlights,
          p.ingredients,
          p.legal_info,
          (COALESCE(p.is_out_of_stock, false) OR COALESCE(sb.is_out_of_stock, false) OR COALESCE(sb.available_quantity, 0) <= 0) AS is_out_of_stock,
          COALESCE(sb.available_quantity, 0) AS available_quantity,
          sb.low_stock_threshold,
          p.is_subscribable,
          p.is_one_time,
          pv.subscription_price,
          c.name AS category,
          p.image_path AS product_image,
          (
            SELECT pi.url FROM product_images pi
            WHERE pi.variant_id = pv.variant_id
              AND pi.deleted_at IS NULL
            ORDER BY pi.is_primary DESC LIMIT 1
          ) AS variant_image
        FROM product_variants pv
        LEFT JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN (
          SELECT
            product_variant_id,
            COALESCE(SUM(available_quantity), 0) AS available_quantity,
            COALESCE(MIN(low_stock_threshold), 0) AS low_stock_threshold,
            BOOL_AND(COALESCE(is_out_of_stock, false)) AS is_out_of_stock
          FROM stock_balances
          GROUP BY product_variant_id
        ) sb ON sb.product_variant_id = pv.variant_id
        LEFT JOIN LATERAL (
          SELECT url FROM product_images pi2
          WHERE pi2.variant_id = pv.variant_id AND pi2.deleted_at IS NULL
          ORDER BY pi2.is_primary DESC NULLS LAST, pi2.id ASC
          LIMIT 1
        ) pi ON true
        WHERE (pv.status = 'active' OR pv.status IS NULL)
          AND (p.is_active = true OR p.is_active IS NULL)
          AND p.deleted_at IS NULL
          AND (p.category_id = $1 OR c.category_id = $1 OR c.name = $1 OR LOWER(c.name) = LOWER($1) OR c.slug = $1 OR LOWER(c.slug) = LOWER($1))
      `;
      const rows = await this.db.query(query, [categoryId]);

      const mappedData = (rows || []).map((item: any) => {
        const ratingInfo = ratingsMap.get(item.product_id) ?? { rating: 0.0, reviews: 0 };
        const rawImage = item.variant_image || item.product_image;
        return {
          ...item,
          image_path: resolveImageUrl(rawImage, baseUrl),
          rating: ratingInfo.rating,
          reviews: ratingInfo.reviews,
        };
      });

      return { data: mappedData };
    } catch (e) {
      console.error('Error in getProductsByCategoryId service:', e);
      return { data: [] };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET PRODUCT REVIEWS
  // ─────────────────────────────────────────────────────────────────────────
  async getProductReviews(productId: string) {
    try {
      const rows = await this.db.query(
        `SELECT
           cf.rating,
           cf.feedback,
           cf.created_at,
           TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS customer_name
         FROM customer_feedback cf
         LEFT JOIN customers c ON c.customer_id = cf.customer_id
         WHERE cf.reference_id = $1 AND cf.reference_type = 'product'
         ORDER BY cf.created_at DESC`,
        [productId],
      );
      return { status: true, data: rows || [] };
    } catch (e) {
      console.error('Error in getProductReviews service:', e);
      return { status: false, data: [], message: 'Failed to load reviews' };
    }
  }
}
