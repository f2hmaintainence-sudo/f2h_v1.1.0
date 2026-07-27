import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { CatalogShowAddService } from './showAdd.service';
import { saveImageUpload } from '../../../../../helpers/ImageHelper';
import { LocalStorageService } from '../../../../../shared/services/storage.service';

@Injectable()
export class CatalogSaveEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: CatalogShowAddService,
    private readonly storageService: LocalStorageService,
  ) { }

  private normalizeProductImage(value: any) {
    if (value === undefined || value === null || value === '') return undefined;

    if (typeof value !== 'string') {
      return undefined;
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
      return undefined;
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

  private async replacePrimaryProductImage(
    productId: string,
    productName: string,
    primaryImage: any,
    secondaryImage: any,
    primaryUrl?: string,
    secondaryUrl?: string,
    adminId: string = '1',
  ) {
    let fileUrl: string | null = null;

    if (primaryUrl && primaryUrl.trim()) {
      fileUrl = primaryUrl.trim();
    } else if (primaryImage?.url) {
      fileUrl = primaryImage.url;
    } else if (primaryImage?.dataUrl) {
      fileUrl = saveImageUpload(primaryImage.dataUrl, 'products');
    }

    if (fileUrl) {
      await this.dataService.query(
        `UPDATE products SET image_path = $1 WHERE product_id = $2`,
        [fileUrl, productId],
      );
    }
  }

  private async replaceVariantImages(
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
        if (typeof image === 'string') {
          if (image.startsWith('data:image')) {
            urlsToProcess.push(saveImageUpload(image, 'variants'));
          } else if (image.trim()) {
            urlsToProcess.push(image.trim());
          }
        } else if (image.url) {
          urlsToProcess.push(image.url);
        } else if (image.dataUrl) {
          const fileUrl = saveImageUpload(image.dataUrl, 'variants');
          urlsToProcess.push(fileUrl);
        }
      }
    }

    const finalUrls = Array.from(new Set(urlsToProcess)).slice(0, 5);

    if (finalUrls.length > 0) {
      await this.dataService.query(
        `DELETE FROM product_images WHERE variant_id = $1`,
        [variantId],
      );

      for (const [index, fileUrl] of finalUrls.entries()) {
        await this.dataService.insert('product_images', {
          product_id: productId,
          variant_id: variantId,
          url: fileUrl,
          storage_key: `variants/${fileUrl.split('/').pop()}`,
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

  async updateProduct(id: string, body: any, adminId: string) {
    try {
      if (!body || typeof body !== 'object') body = {};

      const fields = this.showAddService.catalogFields();
      const NUMBER_FIELDS = ['lift_days', 'gst_percentage'];
      const BOOLEAN_FIELDS = [
        'is_subscribable',
        'is_one_time',
        'is_returnable',
        'is_out_of_stock',
        'is_active',
      ];

      for (const field of fields) {
        let value = body[field.name];
        if (value === undefined) continue;

        if (typeof value === 'string') {
          value = value.trim();
        }

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
        } else if (BOOLEAN_FIELDS.includes(field.name)) {
          value =
            value === true || value === 'true' || value === 1 || value === '1';
        }

        body[field.name] = value;
      }

      if (!body.unit_type || String(body.unit_type).trim() === '') {
        body.unit_type = 'piece';
      }

      // 1. Validate using field definitions from showAdd
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        this.developer.error("validation.errors", validation.errors);
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 2. Unique check — slug (exclude self)
      if (body.slug) {
        const existing = await this.dataService.query('products', {
          select: ['id'],
          where: [
            { column: 'slug', operator: '=', value: String(body.slug).trim() },
            { column: 'id', operator: '!=', value: Number(id) },
          ],
          limit: 1,
        });
        if (existing?.data?.length) {
          this.developer.error("Slug already used by another product");
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { slug: 'Slug already used by another product' },
          });
        }
      }

      const productResult = await this.dataService.query('products', {
        select: ['product_id', 'name'],
        where: [{ column: 'id', operator: '=', value: Number(id) }],
        limit: 1,
      });
      const product = productResult?.data?.[0];

      if (!product?.product_id) {
        this.developer.error("Product not found");
        throw new BadRequestException('Product not found');
      }

      // 3. Build update data (whitelist)
      const allowedUpdateFields = [
        'name',
        'slug',
        'category_id',
        'description',
        'highlights',
        'ingredients',
        'legal_info',
        'is_subscribable',
        'is_one_time',
        'is_returnable',
        'is_out_of_stock',
        'packaging_type_id',
        'unit_type',
        'lift_days',
        'gst_percentage',
        'is_active',
      ];
      const updateData: Record<string, any> = {};
      const productImage = this.normalizeProductImage(body.product_image);

      for (const fieldName of allowedUpdateFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (typeof value === 'string') value = value.trim();
          updateData[fieldName] = value;
        }
      }

      const primaryUrl = body.primary_image_url || body.image_url;
      if (primaryUrl && primaryUrl.trim()) {
        updateData.image_url = primaryUrl.trim();
        updateData.image_path = primaryUrl.trim();
      }

      if (Object.keys(updateData).length === 0 && !productImage) {
        this.developer.error("No valid fields to update")
        throw new BadRequestException('No valid fields to update');
      }

      // 4. UPDATE
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();
        const result = await this.dataService.query('products', {
          update: updateData,
          where: [{ column: 'id', operator: '=', value: Number(id) }],
        });
        if (!result?.status) {
          throw new InternalServerErrorException('Database update failed');
        }
      }

      const secondaryUrl = body.secondary_image_url;
      const secondaryImage = body.secondary_image_file ? this.normalizeProductImage(body.secondary_image_file) : undefined;

      await this.replacePrimaryProductImage(
        product.product_id,
        updateData.name || product.name,
        productImage,
        secondaryImage,
        primaryUrl,
        secondaryUrl,
        adminId,
      );

      // 5. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'product_update',
        target_type: 'products',
        target_id: id,
        details: JSON.stringify({
          changes: [
            ...Object.keys(updateData),
            ...(productImage ? ['product_images.primary'] : []),
          ],
        }),
      });

      return {
        status: true,
        message: 'Product updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveCatalog edit error', { error, id });
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  async saveVariant(id: string, body: any, adminId: string) {
    try {
      // 1. Fetch products for dynamic dropdown validation
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

      // 2. Build product dropdown options
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

      // 3. Validate using dynamic fields
      const fields = this.showAddService.variantFields(productOptions, packagingOptions);

      if (!body || typeof body !== 'object') body = {};
      const NUMBER_FIELDS = [
        'price',
        'subscription_price',
        'unit_value',
        'manageable_qty',
        'sort_order',
      ];
      const BOOLEAN_FIELDS = ['is_out_of_stock'];

      for (const fieldName of NUMBER_FIELDS) {
        if (body[fieldName] !== undefined) {
          if (body[fieldName] === '' || body[fieldName] === null || body[fieldName] === 'null' || body[fieldName] === 'undefined') {
            body[fieldName] = null;
          } else {
            const num = Number(body[fieldName]);
            if (!isNaN(num)) body[fieldName] = num;
          }
        }
      }
      for (const fieldName of BOOLEAN_FIELDS) {
        if (body[fieldName] !== undefined) {
          body[fieldName] = body[fieldName] === true || body[fieldName] === 'true' || body[fieldName] === 1 || body[fieldName] === '1';
        }
      }

      // Toggle sends true/false — convert to text status ('active' / 'inactive')
      if (body.status !== undefined) {
        const isActive =
          body.status === true ||
          body.status === 'true' ||
          body.status === 1 ||
          body.status === '1' ||
          body.status === 'active';
        body.status = isActive ? 'active' : 'inactive';
      }

      const validation = this.formHelper.validateFields(fields, body);

      if (!validation.valid) {
        this.developer.error("Validation failed", validation.errors);
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 4. Unique SKU validation (exclude current record)
      if (body.sku) {
        const existing = await this.dataService.query('product_variants', {
          select: ['id', 'variant_id'],
          where: [
            { column: 'sku', operator: '=', value: String(body.sku).trim(), },
            { column: 'id', operator: '!=', value: Number(id), },
          ],
          limit: 1,
        });

        if (existing?.data?.length) {
          this.developer.error("SKU already used by another variant")
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: {
              sku: 'SKU already used by another variant',
            },
          });
        }
      }

      // Fetch existing variant for reference
      const existingVariantResult = await this.dataService.query('product_variants', {
        select: ['product_id', 'variant_id', 'name'],
        where: [{ column: 'id', operator: '=', value: Number(id) }],
        limit: 1,
      });

      if (!existingVariantResult?.data?.length) {
        this.developer.error("Product variant not found")
        throw new BadRequestException('Product variant not found');
      }

      const existingVariant = existingVariantResult.data[0];
      const variantImage = body.variant_image;

      // 5. Allowed fields whitelist
      const allowedUpdateFields = [
        'product_id',
        'name',
        'sku',
        'price',
        'subscription_price',
        'unit_value',
        'unit_type',
        'status',
        'manageable_qty',
        'sort_order',
        'is_out_of_stock',
        'packaging_type_id',
      ];

      // 6. Build update payload
      const updateData: Record<string, any> = {};

      for (const fieldName of allowedUpdateFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];

          if (typeof value === 'string') {
            value = value.trim();
          }

          if (
            [
              'price',
              'subscription_price',
              'unit_value',
              'manageable_qty',
              'sort_order',
            ].includes(fieldName)
          ) {
            if (
              value === '' ||
              value === null ||
              value === 'null' ||
              value === 'undefined'
            ) {
              value = null;
            } else {
              value = Number(value);

              if (Number.isNaN(value)) {
                throw new BadRequestException({
                  status: false,
                  message: 'Validation failed',
                  errors: {
                    [fieldName]: `${fieldName} must be a valid number`,
                  },
                });
              }

              if (
                ['price', 'subscription_price', 'unit_value'].includes(fieldName) &&
                value <= 0
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
            }
          }

          if (fieldName === 'is_out_of_stock') {
            value =
              value === true ||
              value === 'true' ||
              value === 1 ||
              value === '1';
          }

          if (fieldName === 'sku' && value === '') {
            value = null;
          }

          if (fieldName === 'unit_type' && value === '') {
            value = null;
          }

          if (fieldName === 'packaging_type_id' && value === '') {
            value = null;
          }

          updateData[fieldName] = value;
        }
      }

      // 7. Ensure at least one field exists
      if (Object.keys(updateData).length === 0 && variantImage === undefined) {
        throw new BadRequestException('No valid fields to update');
      }

      // 8. Updated timestamp
      updateData.updated_at = new Date().toISOString();

      // 9. Update DB
      if (Object.keys(updateData).length > 0) {
        const result = await this.dataService.query('product_variants', {
          update: updateData,
          where: [
            {
              column: 'id',
              operator: '=',
              value: Number(id),
            },
          ],
        });

        if (!result?.status) {
          throw new InternalServerErrorException('Database update failed');
        }
      }

      const primaryUrl = body.primary_image_url || body.image_url;
      const additionalUrls = body.additional_image_urls;

      if (variantImage !== undefined || primaryUrl || additionalUrls) {
        await this.replaceVariantImages(
          updateData.product_id || existingVariant.product_id,
          existingVariant.variant_id,
          updateData.name || existingVariant.name,
          variantImage,
          adminId,
          primaryUrl,
          additionalUrls,
        );
      }

      // 10. Sync stock_balances for all active warehouses
      await this.syncStockBalances(existingVariant.variant_id);

      // 11. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'product_variant_update',
        target_type: 'product_variants',
        target_id: existingVariant.variant_id,
        details: JSON.stringify({
          changes: [
            ...Object.keys(updateData),
            ...(variantImage !== undefined ? ['variant_image'] : [])
          ],
        }),
      });

      return {
        status: true,
        message: 'Product variant updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.developer.error('saveVariant edit error', {
        error,
        id,
        body,
      });

      throw new InternalServerErrorException(
        'Failed to update product variant',
      );
    }
  }

  /**
   * Creates or updates stock_balance records for the given variant_id
   * across all active warehouses. If a record doesn't exist, it is
   * created with zero quantities; if it already exists, only the
   * timestamp is touched.
   */
  private async syncStockBalances(variantId: string) {
    try {
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
          [
            { column: 'warehouse_id', operator: '=', value: wh.warehouse_id },
            { column: 'product_variant_id', operator: '=', value: variantId },
          ],
          {
            updated_at: new Date().toISOString(),
          },
        );
      }
    } catch (error) {
      this.developer.error('syncStockBalances error (non-critical)', { error, variantId });
    }
  }

  async saveCategory(id: string, body: any, adminId: string) {
    try {
      if (!body || typeof body !== 'object') body = {};
      if (body.sort_order !== undefined) {
        if (body.sort_order === '' || body.sort_order === null || body.sort_order === 'null' || body.sort_order === 'undefined') {
          body.sort_order = null;
        } else {
          const num = Number(body.sort_order);
          if (!isNaN(num)) body.sort_order = num;
        }
      }
      if (body.is_active !== undefined) {
        body.is_active = body.is_active === true || body.is_active === 'true' || body.is_active === 1 || body.is_active === '1';
      }

      // 1. Validate using field definitions from showAdd
      const fields = this.showAddService.categoryFields();
      const validation = this.formHelper.validateFields(fields, body);
      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // 2. Unique check — slug (exclude self)
      if (body.slug) {
        const existing = await this.dataService.query('categories', {
          select: ['id'],
          where: [
            { column: 'slug', operator: '=', value: String(body.slug).trim() },
            { column: 'id', operator: '!=', value: Number(id) },
          ],
          limit: 1,
        });
        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { slug: 'Slug already used by another category' },
          });
        }
      }

      // 3. Build update data (whitelist)
      const allowedUpdateFields = [
        'name',
        'slug',
        'parent_id',
        'description',
        'image',
        'image_path',
        'sort_order',
        'is_active',
      ];
      const updateData: Record<string, any> = {};
      for (const fieldName of allowedUpdateFields) {
        if (body[fieldName] !== undefined) {
          let value = body[fieldName];
          if (typeof value === 'string') value = value.trim();

          if (fieldName === 'image' || fieldName === 'image_path') {
            if (typeof value === 'string' && value.startsWith('data:image')) {
              const base64Data = value.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              const filename = `category-${Date.now()}.webp`;
              updateData['image_path'] = await this.storageService.uploadFile(
                buffer,
                filename,
                'categories',
              );
            } else if (value === null || value === '') {
              updateData['image_path'] = null;
            } else if (fieldName === 'image_path') {
              updateData['image_path'] = value;
            } else if (typeof value === 'string') {
              updateData['image_path'] = value;
            }
          } else {
            updateData[fieldName] = value;
          }
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      // 4. UPDATE
      updateData.updated_at = new Date().toISOString();
      const result = await this.dataService.query('categories', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });
      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      // 5. Audit log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'category_update',
        target_type: 'categories',
        target_id: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
      });

      return {
        status: true,
        message: 'Category updated successfully',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.developer.error('saveCategory edit error', { error, id });
      throw new InternalServerErrorException('Failed to update category');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE OFFER BANNER
  // ═══════════════════════════════════════════════════════════════

  async updateOffer(id: string, body: any, adminId: string) {
    try {
      const existing = await this.dataService.query('product_banner', {
        select: ['*'],
        where: [{ column: 'id', operator: '=', value: id }],
        limit: 1,
      });

      if (!existing?.data?.length) {
        throw new BadRequestException('Offer banner not found');
      }

      const updateData: Record<string, any> = {
        updated_by: adminId || null,
        updated_at: new Date().toISOString(),
      };

      if (body.title !== undefined) updateData.title = body.title.trim();
      if (body.description !== undefined) updateData.description = body.description?.trim() || null;
      if (body.banner_image && typeof body.banner_image === 'string' && body.banner_image.startsWith('data:image')) {
        updateData.image_url = saveImageUpload(body.banner_image, 'offers');
      } else if (body.image_url !== undefined && body.image_url.trim()) {
        updateData.image_url = body.image_url.trim();
      }
      if (body.action_type !== undefined) updateData.action_type = body.action_type;
      if (body.cta_label !== undefined) updateData.cta_label = body.cta_label.trim();
      if (body.discount_text !== undefined) updateData.discount_text = body.discount_text?.trim() || null;
      if (body.background_color !== undefined) updateData.background_color = body.background_color.trim();
      if (body.display_order !== undefined) updateData.display_order = Number(body.display_order);
      if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);

      const result = await this.dataService.query('product_banner', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: id }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      return {
        status: true,
        message: 'Offer banner updated successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) throw error;
      this.developer.error('updateOffer error', { error, id });
      throw new InternalServerErrorException('Failed to update offer banner');
    }
  }
}
