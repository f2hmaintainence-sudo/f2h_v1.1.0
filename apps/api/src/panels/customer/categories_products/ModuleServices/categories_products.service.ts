import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DataService } from 'src/shared/database/Data.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import {
  CreateDeveloperSubscriptionDto,
  DeveloperSubscriptionItemDto,
} from '../dto/create-developer-subscription.dto';

const ROUTE_CAPACITY = 120;
const DEFAULT_BRANCH_ID = 'ALL';

function normalizeImagePath(imagePath: string | null | undefined, baseUrl: string): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  let cleanPath = imagePath.replace(/^\/+/, '');
  if (cleanPath.startsWith('uploads/')) {
    cleanPath = cleanPath.substring('uploads/'.length);
  }
  cleanPath = cleanPath.replace(/^\/+/, '');
  return `${baseUrl}/uploads/${cleanPath}`;
}

@Injectable()
export class CategoriesProductsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly Data: DataService,
    private readonly developer: DeveloperService,
  ) { }

  async getCategories(backendUrl?: string) {
    const response = await this.Data.query('categories', {
      select: [
        'category_id',
        'name',
        'slug',
        'description',
        'image_path'
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

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // Map the relative paths to full absolute URLs for the mobile/frontend app
    const mappedData = (response.data || []).map((cat: any) => ({
      ...cat,
      image_path: normalizeImagePath(cat.image_path, baseUrl),
    }));

    return { data: mappedData };
  }

  async getProducts() {
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
          p.is_subscribable,
          p.is_one_time,
          pv.subscription_price,
          c.name AS category,
          pv.image_url AS variant_image,
          p.image_url AS product_image,
          pi.image_path AS gallery_image
        FROM product_variants pv
        LEFT JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN product_images pi ON pv.variant_id = pi.product_id OR p.product_id = pi.product_id
        WHERE (pv.status = 'active' OR pv.status IS NULL) AND (p.is_active = true OR p.is_active IS NULL)
      `;
      const rows = await this.db.query(query);

      const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';

      let ratingsMap = new Map<string, any>();
      try {
        const ratingRows = await this.db.query(
          `SELECT 
             reference_id AS product_id,
             COALESCE(AVG(rating), 0) AS avg_rating,
             COUNT(*) AS review_count
           FROM customer_feedback
           WHERE reference_type = 'product' AND rating IS NOT NULL
           GROUP BY reference_id`
        );
        ratingsMap = new Map<string, any>(
          (ratingRows || []).map((r: any) => [r.product_id, {
            rating: parseFloat(r.avg_rating),
            reviews: parseInt(r.review_count, 10),
          }])
        );
      } catch (e) {}

      const mappedData = (rows || []).map((item: any) => {
        const ratingInfo = ratingsMap.get(item.product_id) ?? { rating: 0.0, reviews: 0 };
        const rawImage = item.variant_image || item.product_image || item.gallery_image;
        return {
          ...item,
          image_path: normalizeImagePath(rawImage, baseUrl),
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

  async getProductsByCategoryId(categoryId: string) {
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
          p.is_subscribable,
          p.is_one_time,
          pv.subscription_price,
          c.name AS category,
          pv.image_url AS variant_image,
          p.image_url AS product_image,
          pi.image_path AS gallery_image
        FROM product_variants pv
        LEFT JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN product_images pi ON pv.variant_id = pi.product_id OR p.product_id = pi.product_id
        WHERE (pv.status = 'active' OR pv.status IS NULL) 
          AND (p.is_active = true OR p.is_active IS NULL)
          AND (p.category_id = $1 OR c.category_id = $1)
      `;
      const rows = await this.db.query(query, [categoryId]);

      const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';

      let ratingsMap = new Map<string, any>();
      try {
        const ratingRows = await this.db.query(
          `SELECT 
             reference_id AS product_id,
             COALESCE(AVG(rating), 0) AS avg_rating,
             COUNT(*) AS review_count
           FROM customer_feedback
           WHERE reference_type = 'product' AND rating IS NOT NULL
           GROUP BY reference_id`
        );
        ratingsMap = new Map<string, any>(
          (ratingRows || []).map((r: any) => [r.product_id, {
            rating: parseFloat(r.avg_rating),
            reviews: parseInt(r.review_count, 10),
          }])
        );
      } catch (e) {}

      const mappedData = (rows || []).map((item: any) => {
        const ratingInfo = ratingsMap.get(item.product_id) ?? { rating: 0.0, reviews: 0 };
        const rawImage = item.variant_image || item.product_image || item.gallery_image;
        return {
          ...item,
          image_path: normalizeImagePath(rawImage, baseUrl),
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

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  // Fetches review feed list for a specific product ID
  async getProductReviews(productId: string) {
    try {
      const rows = await this.db.query(
        `SELECT 
           cf.rating,
           cf.feedback,
           cf.created_at,
           c.full_name AS customer_name
         FROM customer_feedback cf
         LEFT JOIN customers c ON c.customer_id = cf.customer_id
         WHERE cf.reference_id = $1 AND cf.reference_type = 'product'
         ORDER BY cf.created_at DESC`,
        [productId]
      );
      return { status: true, data: rows || [] };
    } catch (e) {
      console.error('Error in getProductReviews service:', e);
      return { status: false, data: [], message: 'Failed to load reviews' };
    }
  }
}
