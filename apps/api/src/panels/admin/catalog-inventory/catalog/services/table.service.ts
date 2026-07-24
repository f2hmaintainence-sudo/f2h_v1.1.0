import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  TableHelper,
  TableSet,
  ReqSet,
  JoinDef,
  CustomDef,
} from '../../../../../helpers/TableHelper';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

function extractFilters(query: any) {
  const columns: Record<string, string[]> = {};
  const dateRange: Record<string, any> = {};
  for (const [key, val] of Object.entries(query || {})) {
    if (key.startsWith('col_')) {
      columns[key.substring(4)] = Array.isArray(val)
        ? val.map(String)
        : [String(val)];
    } else if (key.startsWith('date_')) {
      const match = key.match(/^date_(.+)_(from|to)$/);
      if (match) {
        if (!dateRange[match[1]]) dateRange[match[1]] = {};
        dateRange[match[1]][match[2]] = val;
      }
    }
  }
  return { columns, dateRange };
}

function formatActivePill(val: any): string {
  const isTrue = val === true || val === 1 || val === '1' || val === 'true';
  if (isTrue) {
    return `<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="3"/></svg>Active</span>`;
  }
  return `<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #ffedd5; color: #c2410c; border: 1px solid #fdba74; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;"><circle cx="12" cy="12" r="8" fill="#ea580c"/></svg>Inactive</span>`;
}

function formatAllowedPill(val: any): string {
  const isTrue = val === true || val === 1 || val === '1' || val === 'true';
  if (isTrue) {
    return `<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="3"/></svg>Allowed</span>`;
  }
  return `<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #ffedd5; color: #c2410c; border: 1px solid #fdba74; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;"><circle cx="12" cy="12" r="8" fill="#ea580c"/></svg>Not Allowed</span>`;
}

function formatStatusPill(val: any): string {
  const isActive = String(val).toLowerCase() === 'active';
  if (isActive) {
    return `<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="#dcfce7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4" stroke="#ffffff" stroke-width="3"/></svg>Active</span>`;
  }
  return `<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px; padding: 2.5px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #ffedd5; color: #c2410c; border: 1px solid #fdba74; line-height: 1.3;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;"><circle cx="12" cy="12" r="8" fill="#ea580c"/></svg>Inactive</span>`;
}

function formatTableImageHtml(rawSrc: any, altText: string = 'Media'): string {
  if (!rawSrc || typeof rawSrc !== 'string' || rawSrc.trim() === '') {
    return `<div style="width:42px;height:42px;border-radius:10px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;font-weight:700;border:1px solid #e2e8f0;">No Img</div>`;
  }

  let src = rawSrc.trim();
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';

  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image')) {
    // Already absolute HTTP/HTTPS or Base64 URL
  } else if (src.startsWith('/uploads/')) {
    src = `${backendUrl}${src}`;
  } else {
    src = `${backendUrl}/uploads/${src}`;
  }

  return `<img src="${src}" alt="${altText}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80';" style="width:42px;height:42px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,0.05);" />`;
}

@Injectable()
export class CatalogTableService {
  constructor(
    private readonly tableHelper: TableHelper,
    private readonly developer: DeveloperService,
  ) { }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTS TABLE
  // ═══════════════════════════════════════════════════════════════

  async getProductsTable(query: any) {
    try {
      const conditions: any[] = [];

      // Filter by category
      if (query.category_id) {
        conditions.push({
          column: 'products.category_id',
          operator: '=',
          value: query.category_id,
        });
      }

      // Filter by active status
      if (query.is_active !== undefined) {
        conditions.push({
          column: 'products.is_active',
          operator: '=',
          value: query.is_active === 'true',
        });
      }

      if (query.is_subscribable !== undefined) {
        conditions.push({
          column: 'products.is_subscribable',
          operator: '=',
          value: query.is_subscribable === 'true',
        });
      }

      // Always exclude soft-deleted products
      conditions.push({
        column: 'products.deleted_at',
        operator: 'IS',
        value: null,
      });

      const reqSet: ReqSet = {
        key: 'products',
        table: 'products',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'products.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['products.id', true],
          product: ['products.product_id', true],
          product_category: ['categories.name AS product_category', true],
          product_name: ['products.name AS product_name', true],
          name: ['products.name AS name', false],
          url: ['COALESCE(products.image_url, (SELECT url FROM product_images WHERE product_images.product_id = products.product_id ORDER BY is_primary DESC, id ASC LIMIT 1)) AS url', false],
          image: ['COALESCE(products.image_url, (SELECT url FROM product_images WHERE product_images.product_id = products.product_id ORDER BY is_primary DESC, id ASC LIMIT 1)) AS image', true],
          batch_product: ['products.batch_product', false],
          gst: ['products.gst_percentage', true],
          subscribable: ['products.is_subscribable AS subscribable', true],
          one_time: ['products.is_one_time AS one_time', true],
          returnable: ['products.is_returnable AS returnable', true],
          active: ['products.is_active AS active', true],
          is_subscribable: ['products.is_subscribable AS is_subscribable', false],
          is_one_time: ['products.is_one_time AS is_one_time', false],
          is_returnable: ['products.is_returnable AS is_returnable', false],
          is_active: ['products.is_active AS is_active', false],
          category_name: ['categories.name AS category_name', false],
          created_at: ['products.created_at', true],
        },
        joins: [
          {
            type: 'left',
            table: 'categories',
            on: [['products.category_id', 'categories.category_id']],
          }
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'image',
            renderHtml: true,
            callback: (row) => formatTableImageHtml(row.image || row.url, row.product_name || 'Product'),
          },
          {
            type: 'compute',
            column: 'subscribable',
            renderHtml: true,
            callback: (row) => formatAllowedPill(row.subscribable ?? row.is_subscribable),
          },
          {
            type: 'compute',
            column: 'one_time',
            renderHtml: true,
            callback: (row) => formatAllowedPill(row.one_time ?? row.is_one_time),
          },
          {
            type: 'compute',
            column: 'returnable',
            renderHtml: true,
            callback: (row) => formatAllowedPill(row.returnable ?? row.is_returnable),
          },
          {
            type: 'compute',
            column: 'active',
            renderHtml: true,
            callback: (row) => formatActivePill(row.active ?? row.is_active),
          },
          {
            type: 'compute',
            column: 'created_at',
            callback: (row) => {
              if (!row.created_at) return '';

              return new Date(row.created_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
            },
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getProductsTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve products table',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT VARIANTS TABLE
  // ═══════════════════════════════════════════════════════════════

  async getProductVariantsTable(query: any) {
    try {
      const conditions: any[] = [];

      // Filter by product
      if (query.product_id) {
        conditions.push({
          column: 'product_variants.product_id',
          operator: '=',
          value: query.product_id,
        });
      }

      // Filter by active status (matches actual 'status' column values: 'active' / 'false')
      if (query.is_active !== undefined) {
        conditions.push({
          column: 'product_variants.status',
          operator: '=',
          value: query.is_active === 'true' ? 'active' : 'false',
        });
      }

      // Always exclude soft-deleted variants
      conditions.push({
        column: 'product_variants.deleted_at',
        operator: 'IS',
        value: null,
      });
      conditions.push({
        column: 'products.deleted_at',
        operator: 'IS',
        value: null,
      });

      const reqSet: ReqSet = {
        key: 'product_variants',
        table: 'product_variants',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'product_variants.created_at': 'DESC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['product_variants.id', true],
          variant_id: ['product_variants.variant_id', true],
          product_name: ['products.name AS product_name', true],
          variant_name: ['product_variants.name', true],
          product_image: ['COALESCE(product_variants.image_url, (SELECT url FROM product_images WHERE product_images.variant_id = product_variants.variant_id ORDER BY is_primary DESC, id ASC LIMIT 1), products.image_url) AS product_image', true],
          unit_value: ['product_variants.unit_value', true],
          unit_type: ['product_variants.unit_type', true],
          price: ['product_variants.price', true],
          subscription_price: ['product_variants.subscription_price', true],
          is_subscribable: ['products.is_subscribable', false],
          manageable_qty: ['product_variants.manageable_qty', true],
          status: ['product_variants.status', true],
          fulfillment_mode: ['product_variants.fulfillment_mode', true],
        },
        joins: [

          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
          {
            type: 'left',
            table: 'product_images',
            on: [['product_variants.variant_id', 'product_images.variant_id']],
          },
        ],
        conditions,
        custom: [
          {
            type: 'compute',
            column: 'product_image',
            renderHtml: true,
            callback: (row) => formatTableImageHtml(row.url || row.product_image, row.variant_name || 'Variant'),
          },
          {
            type: 'compute',
            column: 'price',
            callback: (row) => (row.price ? `₹${row.price}` : 'N/A'),
          },
          {
            type: 'compute',
            column: 'subscription_price',
            callback: (row) => {
              const isSubscribable = row.is_subscribable === true || row.is_subscribable === 1 || row.is_subscribable === '1' || row.is_subscribable === 'true';
              if (!isSubscribable) {
                return '—';
              }
              return row.subscription_price !== null && row.subscription_price !== undefined && row.subscription_price !== '' ? `₹${row.subscription_price}` : '—';
            },
          },
          {
            type: 'compute',
            column: 'status',
            renderHtml: true,
            callback: (row) => formatStatusPill(row.status),
          }
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getProductVariantsTable error', { error });
      throw new InternalServerErrorException(
        'Failed to retrieve product variants table',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES TABLE
  // ═══════════════════════════════════════════════════════════════

  async getCategoriesTable(query: any) {
    try {
      const conditions: any[] = [];

      // Active filter
      if (query.is_active !== undefined) {
        conditions.push({
          column: 'categories.is_active',
          operator: '=',
          value: query.is_active === 'true',
        });
      }

      // Exclude deleted
      conditions.push({
        column: 'categories.deleted_at',
        operator: 'IS',
        value: null,
      });

      const reqSet: ReqSet = {
        key: 'categories',
        table: 'categories',
        actions: 'ved',
        act: 'id',

        filters: {
          search: query.search || '',

          dateRange: extractFilters(query).dateRange,

          columns: extractFilters(query).columns,

          sort: query.sortBy
            ? {
              [query.sortBy]: query.sortDir || 'ASC',
            }
            : {
              'categories.sort_order': 'ASC',
            },

          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          // Keep visible TRUE so actions work
          id: ['categories.id', true],

          category_id: ['categories.category_id', true],

          image_path: ['categories.image_path', true],

          name: ['categories.name', true],

          slug: ['categories.slug', true],

          description: ['categories.description', true],

          parent_id: ['categories.parent_id', true],

          sort_order: ['categories.sort_order', true],

          active: ['categories.is_active AS active', true],

          is_active: ['categories.is_active AS is_active', false],

          created_at: ['categories.created_at', true],
        },

        joins: [],

        conditions,

        custom: [
          {
            type: 'compute',
            column: 'image_path',
            renderHtml: true,
            callback: (row) => formatTableImageHtml(row.image_path, row.name || 'Category'),
          },
          {
            type: 'compute',
            column: 'parent_id',

            callback: (row) => {
              if (!row.parent_id) {
                return 'Root Category';
              }

              return row.parent_id;
            },
          },

          {
            type: 'compute',
            column: 'active',
            renderHtml: true,
            callback: (row) => formatActivePill(row.active ?? row.is_active),
          },

          {
            type: 'compute',
            column: 'created_at',

            callback: (row) => {
              if (!row.created_at) return '';

              return new Date(row.created_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
            },
          },
        ],

        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getCategoriesTable error', { error });

      throw new InternalServerErrorException(
        'Failed to retrieve categories table',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PRODUCT OFFERS / BANNERS TABLE
  // ═══════════════════════════════════════════════════════════════

  async getOffersTable(query: any) {
    try {
      const reqSet: ReqSet = {
        key: 'product_banner',
        table: 'product_banner',
        actions: 'ved',
        act: 'id',
        filters: {
          search: query.search || '',
          dateRange: extractFilters(query).dateRange,
          columns: extractFilters(query).columns,
          sort: query.sortBy
            ? { [query.sortBy]: query.sortDir || 'ASC' }
            : { 'product_banner.display_order': 'ASC' },
          pagination: {
            type: 'offset',
            page: parseInt(query.page) || 1,
            limit: parseInt(query.limit) || 10,
          },
        },
      };

      const set: TableSet = {
        columns: {
          id: ['product_banner.id', true],
          title: ['product_banner.title', true],
          discount_text: ['product_banner.discount_text', true],
          action_type: ['product_banner.action_type', true],
          cta_label: ['product_banner.cta_label', true],
          display_order: ['product_banner.display_order', true],
          is_active: ['product_banner.is_active', true],
          image_url: ['product_banner.image_url', true],
          created_at: ['product_banner.created_at', true],
        },
        joins: [],
        conditions: [],
        custom: [
          {
            type: 'compute',
            column: 'image_url',
            renderHtml: true,
            callback: (row) => formatTableImageHtml(row.image_url, row.title || 'Offer Banner'),
          },
          {
            type: 'compute',
            column: 'is_active',
            renderHtml: true,
            callback: (row) => formatActivePill(row.is_active),
          },
          {
            type: 'compute',
            column: 'created_at',
            callback: (row) => {
              if (!row.created_at) return '';
              return new Date(row.created_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
            },
          },
        ],
        req_set: reqSet,
      };

      return await this.tableHelper.generateResponse(set);
    } catch (error) {
      this.developer.error('getOffersTable error', { error });
      throw new InternalServerErrorException('Failed to retrieve offers table');
    }
  }
}
