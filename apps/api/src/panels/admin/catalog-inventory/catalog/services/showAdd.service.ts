import { Injectable } from '@nestjs/common';
import {
  FormHelper,
  FormResponse,
  FieldDef,
} from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

@Injectable()
export class CatalogShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) { }

  async showProduct(): Promise<FormResponse> {
    try {
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
      // MUST MATCH POSTGRES ENUM EXACTLY
      // =====================================================

      const unitOptions = [
        { label: 'Liter', value: 'ltr' },
        { label: 'Milliliter', value: 'ml' },
        { label: 'Kilogram', value: 'kg' },
        { label: 'Gram', value: 'gm' },
        { label: 'Piece', value: 'piece' },
        { label: 'Pack', value: 'pack' },
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

      // Fetch active containers
      const containersResult = await this.dataService.query('containers', {
        select: ['container_id', 'name', 'quantity'],
        where: [
          { column: 'status', operator: '=', value: 'active' },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      }).catch(() => ({ data: [] }));

      const containerOptions = [
        { value: '', label: 'Select Container (Optional)' },
        ...(containersResult.data || []).map((c: any) => ({
          value: String(c.container_id),
          label: `${c.name} (${c.container_id})`,
        })),
      ];

      // =====================================================
      // GENERATE FIELDS
      // =====================================================

      const fields = this.catalogFields(categoryOptions, packagingOptions, containerOptions);

      // =====================================================
      // RESPONSE
      // =====================================================

      return this.formHelper.generateResponse({
        title: 'Add Product',
        submitLabel: 'Add Product',
        fields,
        script: '',
      });
    } catch (error) {
      this.developer.error('getCatalogForm error', { error });

      throw new Error('Failed to load product form');
    }
  }

  async getVariantForm(): Promise<FormResponse> {
    try {
      // Fetch products
      const productsResult = await this.dataService.query('products', {
        select: ['id', 'product_id', 'name', 'is_subscribable'],
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
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      // Build dropdown options
      const productOptions = [
        { value: '', label: 'Select Product', is_subscribable: false },
        ...(productsResult.data || []).map((product: any) => ({
          value: String(product.product_id),
          label: product.name,
          is_subscribable: product.is_subscribable === true || product.is_subscribable === 1 || product.is_subscribable === '1' || product.is_subscribable === 'true',
        })),
      ];

      const packagingOptions = [
        { value: '', label: 'No Returnable Packaging (Disposable)' },
        ...(packagingTypesResult.data || []).map((pkg: any) => ({
          value: String(pkg.id),
          label: pkg.name,
        })),
      ];

      // Fetch active containers
      const containersResult = await this.dataService.query('containers', {
        select: ['container_id', 'name', 'quantity'],
        where: [
          { column: 'status', operator: '=', value: 'active' },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      }).catch(() => ({ data: [] }));

      const containerOptions = [
        { value: '', label: 'Select Container (Optional)' },
        ...(containersResult.data || []).map((c: any) => ({
          value: String(c.container_id),
          label: `${c.name} (${c.container_id})`,
        })),
      ];

      const fields = this.variantFields(productOptions, packagingOptions, containerOptions);

      return this.formHelper.generateResponse({
        title: 'Add Product Variant',
        submitLabel: 'Add Variant',
        fields,
        script: '',
      });
    } catch (error) {
      this.developer.error('getVariantForm error', { error });
      throw new Error('Failed to load variant form');
    }
  }

  async getCategoryForm(): Promise<FormResponse> {
    try {
      const categoriesResult = await this.dataService.query('categories', {
        select: ['id', 'category_id', 'name'],
        where: [{ column: 'deleted_at', operator: 'IS', value: null }],
        order: { name: 'ASC' },
      });

      const parentOptions = (categoriesResult?.data || []).map((cat: any) => ({
        value: String(cat.category_id || cat.id),
        label: cat.name,
      }));

      const fields = this.categoryFields(parentOptions);
      return this.formHelper.generateResponse({
        title: 'Add Category',
        submitLabel: 'Add Category',
        fields,
        script: '',
      });
    } catch (error) {
      this.developer.error('getCategoryForm error', { error });
      throw new Error('Failed to load category form');
    }
  }

  /** Shared field definitions — used by both showAdd and showEdit */
  catalogFields(
    categoryOptions: any[] = [],
    packagingOptions: any[] = [],
    containerOptions: any[] = [],
  ): FieldDef[] {
    return [
      { name: 'name', label: 'Product Name', type: 'text', required: true, width: 'half', group: 'Basic Identity', placeholder: 'Enter product name', validation: { minLength: 2, maxLength: 200 }, },
      { name: 'category_id', label: 'Category', type: 'select', required: true, width: 'half', group: 'Basic Identity', options: categoryOptions, },
      { name: 'description', label: 'Description', type: 'textarea', required: false, width: 'half', group: 'Content & Media', placeholder: 'Enter product description', validation: { maxLength: 5000 }, },
      { name: 'highlights', label: 'Highlights', type: 'textarea', required: false, width: 'half', group: 'Content & Media', placeholder: 'Key product highlights', validation: { maxLength: 2000 }, },
      { name: 'ingredients', label: 'Ingredients', type: 'textarea', required: false, width: 'half', group: 'Content & Media', placeholder: 'Product ingredients', validation: { maxLength: 2000 }, },
      { name: 'legal_info', label: 'Legal Information', type: 'textarea', required: false, width: 'half', group: 'Content & Media', placeholder: 'Legal disclaimers and information', validation: { maxLength: 2000 }, },
      { name: 'is_subscribable', label: 'Subscribable', type: 'toggle', required: false, width: 'third', group: 'Permissions', defaultValue: false, },
      { name: 'is_out_of_stock', label: 'Out of Stock', type: 'toggle', required: false, width: 'third', group: 'Permissions', defaultValue: false, },
      { name: 'is_active', label: 'Active', type: 'toggle', required: false, width: 'third', group: 'Permissions', defaultValue: true, },
    ];
  }

  /** Variant field definitions */
  variantFields(
    productOptions: any[] = [],
    packagingOptions: any[] = [],
    containerOptions: any[] = [],
  ): FieldDef[] {
    return [
      { name: 'product_id', label: 'Product', type: 'select', required: true, width: 'third', group: 'Core Details', options: productOptions, },
      { name: 'name', label: 'Variant Name', type: 'text', required: true, width: 'third', group: 'Core Details', placeholder: 'Enter variant name (e.g., 500ml Bottle, 1kg Pack)', validation: { minLength: 2, maxLength: 200 }, },
      { name: 'sku', label: 'SKU', type: 'text', required: false, width: 'third', group: 'Core Details', placeholder: 'e.g. PROD-001-V1', validation: { maxLength: 100 }, },
      { name: 'primary_image_url', label: 'Primary Image URL (Mandatory - Min 1)', type: 'text', required: false, width: 'half', group: 'Variant Images (Min 1 Mandatory, Max 5)', placeholder: 'https://images.unsplash.com/... or /uploads/...', validation: { maxLength: 1000 }, },
      { name: 'variant_image', label: 'Upload Primary Image (Image 1)', type: 'file', required: false, width: 'half', group: 'Variant Images (Min 1 Mandatory, Max 5)', accept: 'image/png,image/jpeg,image/webp', crop: true, aspectRatio: 1, cropWidth: 800, cropHeight: 800 },
      { name: 'variant_image_2', label: 'Upload Image 2 (Optional)', type: 'file', required: false, width: 'half', group: 'Variant Images (Min 1 Mandatory, Max 5)', accept: 'image/png,image/jpeg,image/webp', crop: true, aspectRatio: 1, cropWidth: 800, cropHeight: 800 },
      { name: 'variant_image_3', label: 'Upload Image 3 (Optional)', type: 'file', required: false, width: 'half', group: 'Variant Images (Min 1 Mandatory, Max 5)', accept: 'image/png,image/jpeg,image/webp', crop: true, aspectRatio: 1, cropWidth: 800, cropHeight: 800 },
      { name: 'variant_image_4', label: 'Upload Image 4 (Optional)', type: 'file', required: false, width: 'half', group: 'Variant Images (Min 1 Mandatory, Max 5)', accept: 'image/png,image/jpeg,image/webp', crop: true, aspectRatio: 1, cropWidth: 800, cropHeight: 800 },
      { name: 'variant_image_5', label: 'Upload Image 5 (Optional)', type: 'file', required: false, width: 'half', group: 'Variant Images (Min 1 Mandatory, Max 5)', accept: 'image/png,image/jpeg,image/webp', crop: true, aspectRatio: 1, cropWidth: 800, cropHeight: 800 },
      { name: 'additional_image_urls', label: 'Additional Image URLs (Optional - Up to 4 more URLs separated by comma/newline)', type: 'textarea', required: false, width: 'full', group: 'Variant Images (Min 1 Mandatory, Max 5)', placeholder: 'https://images.unsplash.com/...\nhttps://images.unsplash.com/...', validation: { maxLength: 4000 }, },
      { name: 'original_price', label: 'Original Price (MRP)', type: 'number', required: false, width: 'third', group: 'Pricing & Value', placeholder: '0.00', validation: { min: 0.01, max: 999999 }, },
      { name: 'price', label: 'Selling Price (Price)', type: 'number', required: true, width: 'third', group: 'Pricing & Value', placeholder: '0.00', validation: { min: 0.01, max: 999999, message: 'Price must be greater than 0' }, },
      { name: 'discount_percent', label: 'Discount % (Auto-calculated)', type: 'number', required: false, width: 'third', group: 'Pricing & Value', placeholder: '0%', disabled: true },
      { name: 'subscription_price', label: 'Subscription Price', type: 'number', required: false, width: 'half', group: 'Pricing & Value', placeholder: '0.00', validation: { min: 0.01, max: 999999, message: 'Subscription price must be greater than 0' }, },
      { name: 'unit_type', label: 'Unit Type', type: 'select', required: false, width: 'half', group: 'Pricing & Value', options: [{ value: 'ltr', label: 'Liters' }, { value: 'ml', label: 'Milliliters' }, { value: 'kg', label: 'Kilograms' }, { value: 'gm', label: 'Grams' }, { value: 'piece', label: 'Pieces' }, { value: 'pack', label: 'Pack' },], },
      { name: 'unit_value', label: 'Unit Value', type: 'number', required: false, width: 'half', group: 'Pricing & Value', placeholder: 'e.g., 500 for 500ml', validation: { min: 0.01, max: 99999, message: 'Unit value must be greater than 0' }, },
      { name: 'manageable_qty', label: 'Manageable Quantity', type: 'number', required: false, width: 'third', group: 'Management', defaultValue: 0, placeholder: '0', validation: { min: 0, max: 99999 }, },
      { name: 'sort_order', label: 'Sort Order', type: 'number', required: false, width: 'third', group: 'Management', defaultValue: 0, placeholder: '0', validation: { min: 0, max: 9999 }, },
      { name: 'container_id', label: 'Associated Container', type: 'select', required: false, width: 'third', group: 'Management', options: containerOptions, },
      { name: 'status', label: 'Status', type: 'toggle', required: false, width: 'third', group: 'Management', defaultValue: true, toggleOptions: { onLabel: 'Active', offLabel: 'Inactive', pill: true }, },
    ];
  }

  /** Category field definitions */
  categoryFields(parentOptions: any[] = []): FieldDef[] {
    return [
      { name: 'name', label: 'Category Name', type: 'text', required: true, width: 'half', group: 'Identity', placeholder: 'Enter category name', validation: { minLength: 2, maxLength: 100 }, },
      { name: 'parent_id', label: 'Parent Category', type: 'select', required: false, width: 'half', group: 'Identity', options: parentOptions, },
      { name: 'description', label: 'Description', type: 'textarea', required: false, width: 'full', group: 'Additional Info', placeholder: 'Enter category description', validation: { maxLength: 1000 }, },
      { name: 'image_url', label: 'Category Image URL (Mandatory - Min 1)', type: 'text', required: false, width: 'half', group: 'Additional Info', placeholder: 'https://images.unsplash.com/... or /uploads/...', validation: { maxLength: 1000 }, },
      { name: 'image', label: 'Or Upload Category Image', type: 'file', required: false, width: 'half', group: 'Additional Info', accept: 'image/png,image/jpeg,image/webp', crop: true, aspectRatio: 1, cropWidth: 800, cropHeight: 800 },
      { name: 'sort_order', label: 'Sort Order', type: 'number', required: false, width: 'half', group: 'Configuration', defaultValue: 0, placeholder: '0', validation: { min: 0, max: 9999 }, },
      { name: 'is_active', label: 'Active', type: 'toggle', required: false, width: 'half', group: 'Configuration', defaultValue: true, },
    ];
  }

  async getDeliverySlotForm(): Promise<FormResponse> {
    try {
      const fields = this.deliverySlotFields();
      return this.formHelper.generateResponse({
        title: 'Add Delivery Slot',
        submitLabel: 'Create Slot',
        fields,
        script: '',
      });
    } catch (error) {
      this.developer.error('getDeliverySlotForm error', { error });
      throw new Error('Failed to load delivery slot form');
    }
  }

  /** Delivery Slot field definitions */
  deliverySlotFields(): FieldDef[] {
    return [
      {
        name: 'code',
        label: 'Internal Code',
        type: 'text',
        required: true,
        width: 'full',
        group: 'Basic Identity',
        placeholder: 'e.g., MORNING_PRIME',
        validation: { minLength: 2, maxLength: 50 },
      },
      {
        name: 'name',
        label: 'Display Name',
        type: 'text',
        required: true,
        width: 'full',
        group: 'Basic Identity',
        placeholder: 'e.g., Morning Delivery (8AM - 12PM)',
        validation: { minLength: 2, maxLength: 100 },
      },
      {
        name: 'start_time',
        label: 'Start Time',
        type: 'time',
        required: true,
        width: 'half',
        group: 'Delivery Window',
      },
      {
        name: 'end_time',
        label: 'End Time',
        type: 'time',
        required: true,
        width: 'half',
        group: 'Delivery Window',
      },
      {
        name: 'is_active',
        label: 'Is Active',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Status',
        defaultValue: true,
      },
    ];
  }

  async getProductRuleForm(): Promise<FormResponse> {
    try {
      const fields = this.productRuleFields();
      return this.formHelper.generateResponse({
        title: 'Add Product Rule',
        submitLabel: 'Create Rule',
        fields,
        script: '',
      });
    } catch (error) {
      this.developer.error('getProductRuleForm error', { error });
      throw new Error('Failed to load product rule form');
    }
  }

  /** Product Rule field definitions */
  productRuleFields(): FieldDef[] {
    return [
      {
        name: 'product_id',
        label: 'Product ID',
        type: 'number',
        required: true,
        width: 'full',
        group: 'Product Identity',
        placeholder: 'e.g., 1001',
      },
      {
        name: 'subscription_allowed',
        label: 'Allow Subscription',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Permissions & Status',
        defaultValue: true,
      },
      {
        name: 'subscription_only',
        label: 'Subscription Only',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Permissions & Status',
        defaultValue: false,
      },
      {
        name: 'inventory_reserved',
        label: 'Reserve Stock',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Permissions & Status',
        defaultValue: true,
      },
      {
        name: 'is_active',
        label: 'Active Status',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Permissions & Status',
        defaultValue: true,
      },
      {
        name: 'min_quantity',
        label: 'Min Quantity',
        type: 'number',
        required: true,
        width: 'half',
        group: 'Quantity Rules',
        defaultValue: 1,
      },
      {
        name: 'max_quantity',
        label: 'Max Quantity',
        type: 'number',
        required: true,
        width: 'half',
        group: 'Quantity Rules',
        defaultValue: 10,
      },
      {
        name: 'quantity_step',
        label: 'Step Value',
        type: 'number',
        required: true,
        width: 'half',
        group: 'Quantity Rules',
        defaultValue: 1,
      },
      {
        name: 'default_quantity',
        label: 'Default Quantity',
        type: 'number',
        required: true,
        width: 'half',
        group: 'Quantity Rules',
        defaultValue: 1,
      },
      {
        name: 'default_frequency',
        label: 'Default Frequency',
        type: 'select',
        required: true,
        width: 'full',
        group: 'Scheduling',
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'biweekly', label: 'Biweekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'custom', label: 'Custom' },
        ],
        defaultValue: 'monthly',
      },
      {
        name: 'morning_slot_allowed',
        label: 'Morning Slot',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Scheduling',
        defaultValue: true,
      },
      {
        name: 'evening_slot_allowed',
        label: 'Evening Slot',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Scheduling',
        defaultValue: false,
      },
    ];
  }

  async getOffersForm(): Promise<FormResponse> {
    const [catRes, prodRes] = await Promise.all([
      this.dataService.query('categories', {
        select: ['category_id', 'name'],
        where: [
          { column: 'deleted_at', operator: 'IS', value: null },
          { column: 'is_active', operator: '=', value: true },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
      }),
      this.dataService.query('products', {
        select: ['product_id', 'name'],
        where: [
          { column: 'deleted_at', operator: 'IS', value: null },
          { column: 'is_active', operator: '=', value: true },
        ],
        orderBy: 'name',
        orderDirection: 'ASC',
        limit: 100,
      }),
    ]);

    const categoryOptions = [
      { value: '', label: '— Select Category —' },
      ...(catRes.data || []).map((c: any) => ({
        value: String(c.category_id),
        label: c.name,
      })),
    ];

    const productOptions = [
      { value: '', label: '— Select Product —' },
      ...(prodRes.data || []).map((p: any) => ({
        value: String(p.product_id),
        label: p.name,
      })),
    ];

    const fields: FieldDef[] = [
      {
        name: 'title',
        label: 'Banner Title',
        type: 'text',
        required: true,
        placeholder: 'e.g. Fresh Organic Harvest Sale',
        width: 'half',
        group: 'Offer Details',
      },
      {
        name: 'discount_text',
        label: 'Discount / Badge Text',
        type: 'text',
        required: false,
        placeholder: 'e.g. 30% OFF or FREE Shipping',
        width: 'half',
        group: 'Offer Details',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        required: false,
        placeholder: 'Brief summary of the promotional offer...',
        width: 'full',
        group: 'Offer Details',
      },
      {
        name: 'image_url',
        label: 'Banner Image URL (Mandatory - Min 1)',
        type: 'text',
        required: false,
        placeholder: 'https://images.unsplash.com/... or /uploads/...',
        width: 'half',
        group: 'Banner Image (URL or Upload)',
        validation: { maxLength: 1000 },
      },
      {
        name: 'banner_image',
        label: 'Or Upload Banner Image',
        type: 'file',
        required: false,
        width: 'half',
        group: 'Banner Image (URL or Upload)',
        accept: 'image/png,image/jpeg,image/webp',
        crop: true,
        aspectRatio: 16 / 9,
        cropWidth: 1200,
        cropHeight: 675,
      },
      {
        name: 'action_type',
        label: 'Action Target Type',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Navigation & CTA Redirection',
        options: [
          { value: 'CATEGORY', label: 'Store Category (Redirection)' },
          { value: 'PRODUCT', label: 'Single Product (Redirection)' },
          { value: 'EXTERNAL', label: 'External Web Link' },
        ],
        defaultValue: 'CATEGORY',
      },
      {
        name: 'category_id',
        label: 'Redirection Category (If Category Target)',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Navigation & CTA Redirection',
        options: categoryOptions,
      },
      {
        name: 'action_value',
        label: 'Redirection Product (If Product Target)',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Navigation & CTA Redirection',
        options: productOptions,
      },
      {
        name: 'cta_label',
        label: 'Button Label',
        type: 'text',
        required: true,
        placeholder: 'Shop Now',
        width: 'half',
        group: 'Navigation & CTA Redirection',
        defaultValue: 'Shop Now',
      },
      {
        name: 'background_color',
        label: 'Banner Accent Color',
        type: 'text',
        required: false,
        placeholder: '#16a34a',
        width: 'half',
        group: 'Styling & Ordering',
        defaultValue: '#16a34a',
      },
      {
        name: 'display_order',
        label: 'Display Sequence Order',
        type: 'number',
        required: false,
        placeholder: '0',
        width: 'half',
        group: 'Styling & Ordering',
        defaultValue: 0,
      },
      {
        name: 'is_active',
        label: 'Active Status',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Styling & Ordering',
        defaultValue: true,
      },
    ];

    return this.formHelper.generateResponse({
      title: 'Create Offer Banner',
      submitLabel: 'Save Offer',
      fields,
      script: '',
    });
  }
}
