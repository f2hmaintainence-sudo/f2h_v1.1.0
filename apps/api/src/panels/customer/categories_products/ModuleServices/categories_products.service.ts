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
    const response = await this.Data.query('product_variants', {
      select: [
        'product_variants.variant_id',
        'product_variants.product_id',
        'product_variants.name AS variant_name',
        'product_variants.price',
        'product_variants.unit_value',
        'product_variants.unit_type',
        'products.name AS product_name',
        'products.slug',
        'products.description',
        'products.is_subscribable',
        'products.is_one_time',
        'product_variants.subscription_price',
        'categories.name AS category',
        'product_variants.image_url AS variant_image',
        'products.image_url AS product_image',
        'product_images.url AS gallery_image'
      ],
      joins: [
        {
          type: 'left',
          table: 'products',
          on: [
            ['product_variants.product_id', 'products.product_id']
          ]
        },
        {
          type: 'left',
          table: 'product_images',
          on: [
            ['product_variants.variant_id', 'product_images.variant_id']
          ]
        },
        {
          type: 'left',
          table: 'categories',
          on: [
            ['products.category_id', 'categories.category_id']
          ]
        }
      ],
      where: [
        {
          column: 'product_variants.status',
          operator: '=',
          value: 'active',
        },
        {
          column: 'products.is_active',
          operator: '=',
          value: true,
        }
      ],
    });

    if (!response.status) {
      console.error('DATABASE ERROR IN getProducts:', response);
    }

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
    // Fetch aggregated ratings/reviews for products
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
    } catch (e) {
      console.error('Error fetching product ratings in getProducts:', e);
    }

    // Map the relative paths to full absolute URLs for the mobile/frontend app
    const mappedData = (response.data || []).map((item: any) => {
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
  }

  async getProductsByCategoryId(categoryId: string) {
    const response = await this.Data.query('product_variants', {
      select: [
        'product_variants.variant_id',
        'product_variants.product_id',
        'product_variants.name AS variant_name',
        'product_variants.price',
        'product_variants.unit_value',
        'product_variants.unit_type',
        'products.name AS product_name',
        'products.slug',
        'products.description',
        'products.is_subscribable',
        'products.is_one_time',
        'product_variants.subscription_price',
        'categories.name AS category',
        'product_variants.image_url AS variant_image',
        'products.image_url AS product_image',
        'product_images.url AS gallery_image'
      ],
      joins: [
        {
          type: 'left',
          table: 'products',
          on: [
            ['product_variants.product_id', 'products.product_id']
          ]
        },
        {
          type: 'left',
          table: 'product_images',
          on: [
            ['product_variants.variant_id', 'product_images.variant_id']
          ]
        },
        {
          type: 'left',
          table: 'categories',
          on: [
            ['products.category_id', 'categories.category_id']
          ]
        }
      ],
      where: [
        {
          column: 'product_variants.status',
          operator: '=',
          value: 'active',
        },
        {
          column: 'products.is_active',
          operator: '=',
          value: true,
        },
        {
          column: 'products.category_id',
          operator: '=',
          value: categoryId,
        }
      ],
    });

    if (!response.status) {
      console.error('DATABASE ERROR IN getProductsByCategoryId:', response);
    }

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
    // Fetch aggregated ratings/reviews for products
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
    } catch (e) {
      console.error('Error fetching product ratings in getProductsByCategoryId:', e);
    }

    // Map the relative paths to full absolute URLs for the mobile/frontend app
    const mappedData = (response.data || []).map((item: any) => {
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
