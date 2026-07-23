import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { CatalogShowAddService } from './showAdd.service';
import { generateId } from '../../../../../helpers/RandomHelper';
import { saveImageUpload } from '../../../../../helpers/ImageHelper';
import { LocalStorageService } from '../../../../../shared/services/storage.service';

@Injectable()
export class CatalogSaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: CatalogShowAddService,
    private readonly storageService: LocalStorageService,
  ) { }

  private normalizeProductImage(value: any) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
      return { url: trimmed };
    }

    const allowed = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
    if (!allowed.test(trimmed)) {
      if (trimmed.includes('.') || trimmed.includes('/')) {
        return { url: trimmed };
      }
      return null;
    }

    const maxBytes = 5 * 1024 * 1024;
    const base64 = trimmed.split(',', 2)[1] || '';
    const approximateBytes = Math.floor((base64.length * 3) / 4);

    const mimeMatch = trimmed.match(
      /^data:(image\/(?:png|jpeg|jpg|webp));base64,/,
    );

    return {
      dataUrl: trimmed,
      mimeType: mimeMatch?.[1] || 'image/webp',
      fileSizeBytes: approximateBytes,
    };
  }

  private async savePrimaryProductImage(
    productId: string,
    productName: string,
    primaryImage: any,
    secondaryImage: any,
    primaryUrl?: string,
    secondaryUrl?: string,
    adminId: string = '1',
  ) {
    const urlsToProcess: string[] = [];

    if (primaryUrl && primaryUrl.trim()) {
      urlsToProcess.push(primaryUrl.trim());
    } else if (primaryImage?.url) {
      urlsToProcess.push(primaryImage.url);
    } else if (primaryImage?.dataUrl) {
      urlsToProcess.push(saveImageUpload(primaryImage.dataUrl, `products/${productId}`));
    }

    if (secondaryUrl && secondaryUrl.trim()) {
      urlsToProcess.push(secondaryUrl.trim());
    } else if (secondaryImage?.url) {
      urlsToProcess.push(secondaryImage.url);
    } else if (secondaryImage?.dataUrl) {
      urlsToProcess.push(saveImageUpload(secondaryImage.dataUrl, `products/${productId}`));
    }

    const finalUrls = Array.from(new Set(urlsToProcess)).slice(0, 2);

    if (finalUrls.length > 0) {
      const primaryUrlStr = finalUrls[0];
      await this.dataService.query(
        `UPDATE products SET image_url = $1, image_path = $1, images = $2::jsonb WHERE product_id = $3`,
        [primaryUrlStr, JSON.stringify(finalUrls), productId],
      );

      for (const [index, fileUrl] of finalUrls.entries()) {
        await this.dataService.insert('product_images', {
          product_id: productId,
          url: fileUrl,
          storage_key: `db/products/${productId}/image_${index}`,
          alt_text: String(productName || 'Product image').slice(0, 255),
          width: 800,
          height: 800,
          sort_order: index,
          is_primary: index === 0,
          created_by: String(adminId),
          updated_by: String(adminId),
        });
      }
    }
  }

  private async saveVariantImages(
    productId: string,
    variantId: string,
    variantName: string,
    images: any,
    adminId: string,
    primaryUrl?: string,
    additionalUrls?: string,
  ) {
    const urlsToProcess: string[] = [];

    if (primaryUrl && primaryUrl.trim()) {
      urlsToProcess.push(primaryUrl.trim());
    }

    if (additionalUrls && typeof additionalUrls === 'string') {
      const splitUrls = additionalUrls.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.length > 0);
      urlsToProcess.push(...splitUrls);
    }

    if (images) {
      const imageArray = Array.isArray(images) ? images : [images];
      for (const image of imageArray) {
        if (!image) continue;
        if (image.url) {
          urlsToProcess.push(image.url);
        } else if (image.dataUrl) {
          const fileUrl = saveImageUpload(image.dataUrl, `products/${productId}`);
          urlsToProcess.push(fileUrl);
        }
      }
    }

    // Filter duplicates and enforce max 5 images for variant
    const finalUrls = Array.from(new Set(urlsToProcess)).slice(0, 5);

    if (finalUrls.length > 0) {
      const firstImage = finalUrls[0];
      await this.dataService.query(
        `UPDATE product_variants SET image_url = $1, image_path = $1 WHERE variant_id = $2`,
        [firstImage, variantId],
      );

      for (const [index, fileUrl] of finalUrls.entries()) {
        await this.dataService.insert('product_images', {
          product_id: productId,
          variant_id: variantId,
          url: fileUrl,
          storage_key: `db/products/${productId}/variant_${index}`,
          alt_text: String(variantName || 'Variant image').slice(0, 255),
          width: 800,
          height: 800,
          sort_order: index,
          is_primary: index === 0,
          created_by: String(adminId),
          updated_by: String(adminId),
        });
      }
    }
  }

  async saveProduct(body: any, adminId: string) {
    try {
      // =====================================================
      // 1. FIELD DEFINITIONS
      // =====================================================

      const fields = this.showAddService.catalogFields();

      // =====================================================
      // 2. TYPE CONFIG
      // =====================================================

      const NUMBER_FIELDS = ['lift_days', 'gst_percentage'];

      const BOOLEAN_FIELDS = [
        'is_subscribable',
        'is_one_time',
        'is_returnable',
        'is_active',
      ];

      const DEFAULTS: Record<string, any> = {
        is_active: true,
        is_subscribable: false,
        is_one_time: true,
        is_returnable: false,
        gst_percentage: 0,
      };

      // =====================================================
      // 3. NORMALIZE INPUT FIRST
      // =====================================================

      const normalizedBody: Record<string, any> = {};

      for (const field of fields) {
        let value = body[field.name];

        // Skip undefined only
        if (value === undefined) continue;

        // Trim strings
        if (typeof value === 'string') {
          value = value.trim();
        }

        // -------------------------------------------------
        // NUMBER FIELDS
        // -------------------------------------------------

        if (NUMBER_FIELDS.includes(field.name)) {
          if (
            value === '' ||
            value === null ||
            value === 'null' ||
            value === 'undefined'
          ) {
            value = null;
          } else {
            value = Number(value);

            if (isNaN(value)) {
              throw new BadRequestException({
                status: false,
                message: 'Validation failed',
                errors: {
                  [field.name]: `${field.name} must be a valid number`,
                },
              });
            }
          }
        }

        // -------------------------------------------------
        // BOOLEAN FIELDS
        // -------------------------------------------------
        else if (BOOLEAN_FIELDS.includes(field.name)) {
          value =
            value === true || value === 'true' || value === 1 || value === '1';
        } else if (field.name === 'product_image') {
          value = this.normalizeProductImage(value);
        }

        normalizedBody[field.name] = value;
      }

      // =====================================================
      // 4. APPLY DEFAULTS
      // =====================================================

      const insertData: Record<string, any> = {
        ...DEFAULTS,
        ...normalizedBody,
      };
      const productImage = insertData.product_image;
      delete insertData.product_image;
      delete insertData.vendor_id;

      // =====================================================
      // 5. REQUIRED FIELD VALIDATION
      // =====================================================

      if (!insertData.name) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: {
            name: 'Name is required',
          },
        });
      }

      if (!insertData.slug) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: {
            slug: 'Slug is required',
          },
        });
      }

      if (!insertData.category_id) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: {
            category_id: 'Category is required',
          },
        });
      }

      // =====================================================
      // 6. FIELD VALIDATION
      // =====================================================

      const validation = this.formHelper.validateFields(fields, insertData);

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const allowedUnitTypes = ['kg', 'ltr', 'ml', 'gm', 'piece', 'pack'];
      if (
        insertData.unit_type !== undefined &&
        insertData.unit_type !== null &&
        !allowedUnitTypes.includes(insertData.unit_type)
      ) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: {
            unit_type: 'Invalid unit type',
          },
        });
      }

      // =====================================================
      // 7. UNIQUE SLUG CHECK
      // =====================================================

      const existing = await this.dataService.query('products', {
        select: ['id'],
        where: [
          {
            column: 'slug',
            operator: '=',
            value: insertData.slug,
          },
        ],
        limit: 1,
      });

      if (existing?.data?.length) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: {
            slug: 'Slug already exists',
          },
        });
      }

      // =====================================================
      // 8. AUDIT FIELDS
      // =====================================================

      // 7. System fields
      insertData.product_id = generateId('PRD', 12);

      insertData.created_by = Number(adminId);
      insertData.updated_by = Number(adminId);

      // =====================================================
      // 9. INSERT
      // =====================================================

      const result = await this.dataService.insert('products', insertData);

      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      const primaryUrl = body.primary_image_url || body.image_url;
      const secondaryUrl = body.secondary_image_url;
      const secondaryImage = body.secondary_image_file ? this.normalizeProductImage(body.secondary_image_file) : null;

      await this.savePrimaryProductImage(
        insertData.product_id,
        insertData.name,
        productImage,
        secondaryImage,
        primaryUrl,
        secondaryUrl,
        adminId,
      );

      // =====================================================
      // 10. AUDIT LOG
      // =====================================================

      const newId = result.data?.id ?? result.id ?? 'unknown';

      this.auditLog(adminId, newId, insertData).catch((err) =>
        this.developer.error('auditLog failed (non-critical)', { err }),
      );

      // =====================================================
      // 11. RESPONSE
      // =====================================================

      return {
        status: true,
        message: 'Product created successfully',
        id: newId,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.developer.error('saveCatalog error', {
        error,
        body,
      });

      throw new InternalServerErrorException('Failed to create product');
    }
  }

  // Separated so it never blocks the main response
  private async auditLog(
    adminId: string,
    targetId: string,
    data: Record<string, any>,
  ) {
    await this.dataService.insert('admin_audit_logs', {
      admin_id: adminId,
      action: 'product_create',
      target_type: 'products',
      target_id: targetId,
      details: JSON.stringify({
        table: 'products',
        key_fields: Object.keys(data).slice(0, 5),
      }),
    });
  }

  /**
   * Creates or updates stock_balance records for the given variant_id
   * across all active warehouses.
   */
  private async syncStockBalances(variantId: string) {
    try {
      // Fetch all active warehouses
      const warehouseResult = await this.dataService.query('warehouses', {
        select: ['warehouse_id'],
        where: [
          { column: 'deleted_at', operator: 'IS', value: null },
          { column: 'is_active', operator: '=', value: true },
        ],
      });

      const warehouses = warehouseResult?.data || [];

      for (const wh of warehouses) {
        await this.dataService.upsert(
          'stock_balances',
          // data (full row for insert)
          {
            warehouse_id: wh.warehouse_id,
            product_variant_id: variantId,
            available_quantity: 0,
            reserved_quantity: 0,
            dispatched_quantity: 0,
            damaged_quantity: 0,
            low_stock_threshold: 10,
            last_stock_update: new Date().toISOString(),
          },
          // conflict (unique key match)
          [
            { column: 'warehouse_id', operator: '=', value: wh.warehouse_id },
            { column: 'product_variant_id', operator: '=', value: variantId },
          ],
          // update (if already exists, just touch the timestamp)
          {
            updated_at: new Date().toISOString(),
          },
        );
      }
    } catch (error) {
      // Non-critical — don't fail the variant creation
      this.developer.error('syncStockBalances error (non-critical)', { error, variantId });
    }
  }

  private normalizeVariantField(fieldName: string, value: any) {
    if (fieldName === 'variant_image') {
      if (Array.isArray(value)) {
        return value.map((v: any) => this.normalizeProductImage(v)).filter(Boolean);
      }
      return this.normalizeProductImage(value);
    }

    const numericFields = [
      'price',
      'subscription_price',
      'unit_value',
      'manageable_qty',
      'sort_order',
    ];

    if (typeof value === 'string') {
      value = value.trim();
    }

    if (numericFields.includes(fieldName)) {
      if (
        value === '' ||
        value === null ||
        value === 'null' ||
        value === 'undefined'
      ) {
        return null;
      }

      const numberValue = Number(value);

      if (Number.isNaN(numberValue)) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: { [fieldName]: `${fieldName} must be a valid number` },
        });
      }

      if (
        ['price', 'subscription_price', 'unit_value'].includes(fieldName) &&
        numberValue <= 0
      ) {
        const labelMap: Record<string, string> = {
          price: 'Price',
          subscription_price: 'Subscription price',
          unit_value: 'Unit value',
        };
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: {
            [fieldName]: `${labelMap[fieldName] || fieldName} must be greater than 0`,
          },
        });
      }

      return numberValue;
    }

    if (fieldName === 'is_out_of_stock') {
      return value === true || value === 'true' || value === 1 || value === '1';
    }

    if (fieldName === 'status') {
      const isActive = value === true || value === 'true' || value === 1 || value === '1' || value === 'active';
      return isActive ? 'active' : 'inactive';
    }

    if (fieldName === 'sku' && value === '') {
      return null;
    }

    if (fieldName === 'unit_type' && value === '') {
      return null;
    }

    if (fieldName === 'packaging_type_id' && value === '') {
      return null;
    }

    return value;
  }

  async saveVariant(body: any, adminId: string) {
    try {

      // 1. Fetch products for dynamic dropdown
      const productsResult = await this.dataService.query('products', {
        select: ['id', 'product_id', 'name'],
        where: [
          { column: 'deleted_at', operator: 'IS', value: null },
          { column: 'is_active', operator: '=', value: true },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      // Fetch active packaging types
      const packagingTypesResult = await this.dataService.query('packaging_types', {
        select: ['id', 'name'],
        where: [
          { column: 'status', operator: '=', value: 'active' },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      const productOptions = [
        { value: '', label: 'Select Product' },
        ...(productsResult.data || []).map((product: any) => ({
          value: String(product.product_id),
          label: product.name,
        })),
      ];

      const packagingOptions = [
        { value: '', label: 'No Returnable Packaging (Disposable)' },
        ...(packagingTypesResult.data || []).map((pkg: any) => ({
          value: String(pkg.id),
          label: pkg.name,
        })),
      ];

      // 2. Validate using dynamic fields
      const fields = this.showAddService.variantFields(productOptions, packagingOptions);
      const validation = this.formHelper.validateFields(fields, body);

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 3. Unique SKU validation
      if (body.sku) {
        const existing = await this.dataService.query('product_variants', {
          select: ['id'],
          where: [
            {
              column: 'sku',
              operator: '=',
              value: String(body.sku).trim(),
            },
          ],
          limit: 1,
        });

        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'validation failed',
            errors: {
              sku: 'SKU already exists',
            },
          });
        }
      }

      // 4. Build insert payload
      const insertData: Record<string, any> = {};

      for (const field of fields) {
        if (body[field.name] !== undefined) {
          insertData[field.name] = this.normalizeVariantField(
            field.name,
            body[field.name],
          );
        }
      }

      // 5. Defaults
      insertData.variant_id = generateId('VRT', 12);
      insertData.status = insertData.status ?? 'active';
      insertData.manageable_qty = insertData.manageable_qty ?? 0;
      insertData.sort_order = insertData.sort_order ?? 0;
      insertData.is_out_of_stock = insertData.is_out_of_stock ?? false;

      const variantImage = insertData.variant_image;
      delete insertData.variant_image;

      // 6. Insert
      const result = await this.dataService.insert(
        'product_variants',
        insertData,
      );

      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      const primaryUrl = body.primary_image_url || body.image_url;
      const additionalUrls = body.additional_image_urls;

      await this.saveVariantImages(
        insertData.product_id,
        insertData.variant_id,
        insertData.name,
        variantImage,
        adminId,
        primaryUrl,
        additionalUrls,
      );

      // 7. Sync stock_balances for all active warehouses
      await this.syncStockBalances(insertData.variant_id);

      // 8. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'product_variant_create',
        target_type: 'product_variants',
        target_id: insertData.variant_id || 'new',
        details: JSON.stringify({
          table: 'product_variants',
          key_fields: Object.keys(insertData).slice(0, 5),
        }),
      });

      return {
        status: true,
        message: 'Product variant created successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.developer.error('saveVariant error', {
        error,
        body,
      });

      throw new InternalServerErrorException(
        'Failed to create product variant',
      );
    }
  }

  async saveCategory(body: any, adminId: string) {
    try {
      console.log('insertData', body);
      // 1. Fetch categories for dynamic parent dropdown
      const categoriesResult = await this.dataService.query('categories', {
        select: ['id', 'name'],
        where: [
          {
            column: 'deleted_at',
            operator: 'IS',
            value: null,
          },
          {
            column: 'is_active',
            operator: '=',
            value: true,
          },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      // 2. Build parent category options
      // const parentOptions = [
      //   {
      //     value: '',
      //     label: 'No Parent (Root Category)',
      //   },

      //   ...(categoriesResult.data || []).map((cat: any) => ({
      //     value: String(cat.id),
      //     label: cat.name,
      //   })),
      // ];

      // 3. Validate using dynamic fields
      const fields = this.showAddService.categoryFields();//(parentOptions)

      const validation = this.formHelper.validateFields(fields, body);

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 4. Unique slug validation
      if (body.slug) {
        const existing = await this.dataService.query('categories', {
          select: ['id'],
          where: [
            {
              column: 'slug',
              operator: '=',
              value: String(body.slug).trim(),
            },
          ],
          limit: 1,
        });

        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: {
              slug: 'Slug already exists',
            },
          });
        }
      }

      // 5. Build insert payload
      const insertData: Record<string, any> = {};

      for (const field of fields) {
        if (body[field.name] !== undefined) {
          let value = body[field.name];

          if (typeof value === 'string') {
            value = value.trim();
          }

          // Empty string → null
          if (value === '') {
            value = null;
          }

          if (field.name === 'image') {
            if (typeof value === 'string' && value.startsWith('data:image')) {
              const base64Data = value.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              const filename = `category-${Date.now()}.webp`;
              insertData['image_path'] = await this.storageService.uploadFile(buffer, filename, 'categories');
            } else if (typeof value === 'string' && value.includes('fakepath')) {
              // The frontend sent the raw input value instead of base64
              throw new BadRequestException({
                status: false,
                message: 'Validation failed',
                errors: { image: 'Please upload a valid image (must be processed by the cropper)' },
              });
            } else if (value === null) {
              insertData['image_path'] = null;
            }
            continue;
          }

          insertData[field.name] = value;
        }
      }

      // 6. Defaults
      if (insertData.is_active === undefined) {
        insertData.is_active = true;
      }

      if (!insertData.sort_order) {
        insertData.sort_order = 0;
      }

      // 7. System fields
      insertData.category_id = generateId('CAT', 12);

      if (insertData.image_path && insertData.image_path.startsWith('data:image')) {
        const base64 = insertData.image_path.split(',', 2)[1] || '';
        const approximateBytes = Math.floor((base64.length * 3) / 4);
        const maxBytes = 2 * 1024 * 1024; // 2MB
        if (approximateBytes > maxBytes) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { image_path: 'Category image must be 2MB or smaller' },
          });
        }
        insertData.image_path = saveImageUpload(insertData.image_path, 'categories');
      }

      insertData.created_by = adminId;
      insertData.updated_by = adminId;
      console.log('insertData', insertData);
      // 8. Insert
      const result = await this.dataService.insert('categories', insertData);

      if (!result.status) {
        throw new InternalServerErrorException(
          result.message || 'Database insert failed',
        );
      }

      // 9. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'category_create',
        target_type: 'categories',
        target_id: insertData.category_id || 'new',
        details: JSON.stringify({
          table: 'categories',
          key_fields: Object.keys(insertData).slice(0, 5),
        }),
      });

      return {
        status: true,
        message: 'Category created successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.developer.error('saveCategory error', {
        error,
        body,
      });

      throw new InternalServerErrorException('Failed to create category');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SAVE OFFER BANNER
  // ═══════════════════════════════════════════════════════════════

  async saveOffer(body: any, adminId: string) {
    try {
      if (!body?.title?.trim()) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: { title: 'Banner title is required' },
        });
      }

      let imageUrl = body.image_url?.trim() || '';
      if (body.banner_image && typeof body.banner_image === 'string' && body.banner_image.startsWith('data:image')) {
        imageUrl = saveImageUpload(body.banner_image, 'offers');
      }

      if (!imageUrl) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: { image_url: 'Banner image (URL or file upload) is required' },
        });
      }

      const insertData: Record<string, any> = {
        title: body.title.trim(),
        image_url: imageUrl,
        action_type: body.action_type || 'CATEGORY',
        cta_label: body.cta_label?.trim() || 'Shop Now',
        discount_text: body.discount_text?.trim() || null,
        background_color: body.background_color?.trim() || '#16a34a',
        display_order: body.display_order ? Number(body.display_order) : 0,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
        created_by: adminId || null,
        updated_by: adminId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (body.description !== undefined && body.description !== null) {
        insertData.description = body.description.trim() || null;
      }

      const result = await this.dataService.insert('product_banner', insertData);
      if (!result.status) {
        throw new InternalServerErrorException(result.message || 'Database insert failed');
      }

      return {
        status: true,
        message: 'Offer banner created successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('saveOffer error', { error, body });
      throw new InternalServerErrorException('Failed to create offer banner');
    }
  }
}
