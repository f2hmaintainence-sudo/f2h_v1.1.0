import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper, FormResponse } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { CatalogShowAddService } from './showAdd.service';

@Injectable()
export class CatalogShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: CatalogShowAddService,
  ) { }

  async editProduct(id: string): Promise<FormResponse> {
    try {
      // =====================================================
      // FETCH PRODUCT
      // =====================================================

      const result = await this.dataService.query('products', {
        select: ['products.*'],

        where: [
          {
            column: 'products.id',
            operator: '=',
            value: Number(id),
          },
        ],

        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Product not found');
      }

      const product = result.data[0];

      const imageResult = await this.dataService.query('product_images', {
        select: ['url'],
        where: [
          {
            column: 'product_id',
            operator: '=',
            value: product.product_id,
          },
          {
            column: 'is_primary',
            operator: '=',
            value: true,
          },
          {
            column: 'deleted_at',
            operator: 'IS',
            value: null,
          },
        ],
        orderBy: 'sort_order',
        orderDirection: 'ASC',
        limit: 1,
      });

      const productImage = imageResult?.data?.[0]?.url || '';

      // =====================================================
      // FETCH CATEGORIES
      // =====================================================

      const categoriesResult = await this.dataService.query('categories', {
        select: ['id', 'category_id', 'name'],

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

      // =====================================================
      // CATEGORY OPTIONS
      // =====================================================

      const categoryOptions = [
        {
          value: '',
          label: 'Select Category',
        },

        ...(categoriesResult.data || []).map((cat: any) => ({
          value: String(cat.category_id),
          label: cat.name,
        })),
      ];

      // =====================================================
      // UNIT OPTIONS
      // MUST MATCH ENUM EXACTLY
      // =====================================================

      const unitOptions = [
        { label: 'Liter', value: 'ltr' },
        { label: 'Milliliter', value: 'ml' },
        { label: 'Kilogram', value: 'kg' },
        { label: 'Gram', value: 'gm' },
        { label: 'Piece', value: 'piece' },
        { label: 'Pack', value: 'pack' },
      ];

      // =====================================================
      // GENERATE FIELDS
      // =====================================================

      const fields = this.showAddService.catalogFields(
        categoryOptions,
        unitOptions,
      );

      // =====================================================
      // FORMAT DATA
      // =====================================================

      const formattedData = {
        ...product,

        category_id: String(product.category_id || ''),

        unit_type: String(product.unit_type || 'piece'),

        product_image: productImage,
      };

      // =====================================================
      // RESPONSE
      // =====================================================

      return this.formHelper.generateResponse({
        title: 'Edit Product',

        submitLabel: 'Update Product',

        fields,

        data: formattedData,

        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.developer.error('editProduct error', { error, id });

      throw new InternalServerErrorException(
        'Failed to load product edit form',
      );
    }
  }

  async getVariantEditForm(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('product_variants', {
        select: ['product_variants.*'],
        where: [
          // id is SERIAL (integer)
          { column: 'product_variants.id', operator: '=', value: Number(id) },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Product variant not found');
      }

      const variant = result.data[0];

      const productsResult = await this.dataService.query('products', {
        select: ['id', 'product_id', 'name', 'is_subscribable'],
        where: [
          { column: 'deleted_at', operator: 'IS', value: null },
          { column: 'is_active', operator: '=', value: true },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      const productOptions = [
        { value: '', label: 'Select Product', is_subscribable: false },
        ...(productsResult.data || []).map((product: any) => ({
          value: String(product.product_id),
          label: product.name,
          is_subscribable: product.is_subscribable === true || product.is_subscribable === 1 || product.is_subscribable === '1' || product.is_subscribable === 'true',
        })),
      ];

      // Fetch active packaging types
      const packagingTypesResult = await this.dataService.query('packaging_types', {
        select: ['id', 'name'],
        where: [
          { column: 'status', operator: '=', value: 'active' },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      const packagingOptions = [
        { value: '', label: 'No Returnable Packaging (Disposable)' },
        ...(packagingTypesResult.data || []).map((pkg: any) => ({
          value: String(pkg.id),
          label: pkg.name,
        })),
      ];

      let fields = this.showAddService.variantFields(productOptions, packagingOptions);

      // Hide Subscription Price if the variant's product does not allow subscription
      const parentProduct = (productsResult.data || []).find(
        (p: any) => String(p.product_id) === String(variant.product_id),
      );
      const isSubscribable = parentProduct && (parentProduct.is_subscribable === true || parentProduct.is_subscribable === 1 || parentProduct.is_subscribable === '1' || parentProduct.is_subscribable === 'true');
      if (!isSubscribable) {
        fields = fields.filter((f: any) => f.name !== 'subscription_price');
      }

      const imageResult = await this.dataService.query('product_images', {
        select: ['url'],
        where: [
          { column: 'variant_id', operator: '=', value: variant.variant_id },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
        orderBy: 'sort_order',
        orderDirection: 'ASC',
      });
      const variantImages = (imageResult?.data || []).map((img: any) => img.url);

      // product_id is VARCHAR — keep as string for the select field
      const formattedData = {
        ...variant,
        product_id: String(variant.product_id || ''),
        variant_image: variantImages,
        status: variant.status === 'active' || variant.status === true || variant.status === 1 || variant.status === '1',
      };

      return this.formHelper.generateResponse({
        title: 'Edit Product Variant',
        submitLabel: 'Update Variant',
        fields,
        data: formattedData,
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getVariantEditForm error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load variant edit form',
      );
    }
  }

  async getCategoryEditForm(id: string): Promise<FormResponse> {
    try {
      // 1. Fetch existing record
      const result = await this.dataService.query('categories', {
        select: ['categories.*'],
        where: [{ column: 'categories.id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Category not found');
      }

      const category = result.data[0];
      const formattedData = {
        ...category,
        image: category.image_path || '',
      };

      // 2. Use SAME fields from showAdd (no duplication)
      const fields = this.showAddService.categoryFields();

      // 3. Return form with pre-filled data
      return this.formHelper.generateResponse({
        title: 'Edit Category',
        submitLabel: 'Update Category',
        fields,
        script: '',
        data: formattedData,
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getCategoryEditForm error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load category edit form',
      );
    }
  }

  async getDeliverySlotEditForm(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('delivery_slots', {
        select: ['*'],
        where: [{ column: 'id', operator: '=', value: Number(id) }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Delivery slot not found');
      }

      const fields = this.showAddService.deliverySlotFields();

      return this.formHelper.generateResponse({
        title: 'Edit Delivery Slot',
        submitLabel: 'Update Slot',
        fields,
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getDeliverySlotEditForm error', { error, id });
      throw new InternalServerErrorException(
        'Failed to load delivery slot edit form',
      );
    }
  }
  async getProductRuleEditForm(productId: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('product_subscription_rules', {
        select: ['*'],
        where: [{ column: 'product_id', operator: '=', value: Number(productId) }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Product subscription rule not found');
      }

      const fields = this.showAddService.productRuleFields();

      // Disable product_id field in edit mode
      const updatedFields = fields.map(f => f.name === 'product_id' ? { ...f, disabled: true } : f);

      return this.formHelper.generateResponse({
        title: 'Edit Product Rule',
        submitLabel: 'Update Rule',
        fields: updatedFields,
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getProductRuleEditForm error', { error, productId });
      throw new InternalServerErrorException(
        'Failed to load product rule edit form',
      );
    }
  }

  async getOfferEditForm(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('product_banner', {
        select: ['*'],
        where: [{ column: 'id', operator: '=', value: id }],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Offer banner not found');
      }

      const formRes = await this.showAddService.getOffersForm();
      const rawImageUrl = result.data[0]?.image_url || '';
      const isUploadedFile = rawImageUrl.startsWith('/uploads/') || rawImageUrl.startsWith('uploads/');

      const offerData = {
        ...result.data[0],
        image_url: isUploadedFile ? '' : rawImageUrl,
        banner_image: rawImageUrl,
      };
      return this.formHelper.generateResponse({
        title: 'Edit Offer Banner',
        submitLabel: 'Update Offer',
        fields: formRes.fields,
        data: offerData,
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('getOfferEditForm error', { error, id });
      throw new InternalServerErrorException('Failed to load offer edit form');
    }
  }
}
