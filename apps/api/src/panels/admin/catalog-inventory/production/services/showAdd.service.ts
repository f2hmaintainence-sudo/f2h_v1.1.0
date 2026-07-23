import { Injectable } from '@nestjs/common';
import {
  FieldDef,
  FormHelper,
  FormResponse,
} from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

@Injectable()
export class ProductionShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) {}

  async showProduction(): Promise<FormResponse> {
    try {
      const [warehouseOptions, productOptions, variantOptions] =
        await Promise.all([
          this.getWarehouseOptions(),
          this.getProductOptions(),
          this.getVariantOptions(),
        ]);

      return this.formHelper.generateResponse({
        title: 'Add Production Batch',
        submitLabel: 'Add Batch',
        fields: this.productionFields(
          warehouseOptions,
          productOptions,
          variantOptions,
        ),
        script: '',
      });
    } catch (error) {
      this.developer.error('showProduction error', { error });
      throw new Error('Failed to load production form');
    }
  }

  async showPlanning(): Promise<FormResponse> {
    try {
      const [warehouseOptions, productOptions, variantOptions] =
        await Promise.all([
          this.getWarehouseOptions(),
          this.getProductOptions(),
          this.getVariantOptions(),
        ]);

      return this.formHelper.generateResponse({
        title: 'Create Production Plan',
        submitLabel: 'Create Plan',
        fields: this.planningFields(
          warehouseOptions,
          productOptions,
          variantOptions,
        ),
        script: '',
      });
    } catch (error) {
      this.developer.error('showPlanning error', { error });
      throw new Error('Failed to load planning form');
    }
  }

  productionFields(
    warehouseOptions: any[] = [],
    productOptions: any[] = [],
    variantOptions: any[] = [],
  ): FieldDef[] {
    return [
      {
        name: 'warehouse_id',
        label: 'Warehouse',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Batch Identity',
        options: warehouseOptions,
      },
      {
        name: 'batch_id',
        label: 'Batch ID',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Batch Identity',
        placeholder: 'Leave blank to auto-generate',
        validation: { maxLength: 100 },
      },
      {
        name: 'product_id',
        label: 'Product',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Product & Quality',
        options: productOptions,
      },
      {
        name: 'variant_id',
        label: 'Product Variant',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Product & Quality',
        options: variantOptions,
      },
      {
        name: 'manufactured_at',
        label: 'Manufactured At',
        type: 'date',
        required: true,
        width: 'half',
        group: 'Product & Quality',
      },
      {
        name: 'expiry_at',
        label: 'Expiry At',
        type: 'date',
        required: false,
        width: 'half',
        group: 'Product & Quality',
      },
      {
        name: 'quantity',
        label: 'Total Quantity',
        type: 'number',
        required: true,
        width: 'half',
        group: 'Inventory Tracking',
        defaultValue: 0,
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'available_quantity',
        label: 'Available Qty',
        type: 'number',
        required: false,
        width: 'half',
        group: 'Inventory Tracking',
        defaultValue: 0,
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'damaged_quantity',
        label: 'Damaged Qty',
        type: 'number',
        required: false,
        width: 'half',
        group: 'Inventory Tracking',
        defaultValue: 0,
        validation: { min: 0, max: 999999 },
      },
      {
        name: 'status',
        label: 'Inventory Status',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Inventory Tracking',
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
      {
        name: 'notes',
        label: 'Batch Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        group: 'Additional Info',
        validation: { maxLength: 1000 },
      },
    ];
  }

  planningFields(
    warehouseOptions: any[] = [],
    productOptions: any[] = [],
    variantOptions: any[] = [],
  ): FieldDef[] {
    return [
      {
        name: 'planned_date',
        label: 'Planned Date',
        type: 'date',
        required: true,
        width: 'half',
        group: 'Plan Schedule',
      },
      {
        name: 'warehouse_id',
        label: 'Warehouse',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Plan Schedule',
        options: warehouseOptions,
      },
      {
        name: 'product_id',
        label: 'Product',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Production Target',
        options: productOptions,
      },
      {
        name: 'variant_id',
        label: 'Product Variant',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Production Target',
        options: variantOptions,
      },
      {
        name: 'planned_quantity',
        label: 'Planned Quantity',
        type: 'number',
        required: true,
        width: 'half',
        group: 'Production Target',
        defaultValue: 0,
        validation: { min: 0.01 },
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Plan Schedule',
        defaultValue: 'normal',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'normal', label: 'Normal' },
          { value: 'high', label: 'High' },
        ],
      },
      {
        name: 'notes',
        label: 'Planning Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        group: 'Plan Details',
        validation: { maxLength: 1000 },
      },
    ];
  }

  private async getWarehouseOptions() {
    const result = await this.dataService.query('warehouses', {
      select: ['warehouse_id', 'name'],
      where: [
        { column: 'warehouses.deleted_at', operator: 'IS', value: null },
      ],
      orderBy: 'name',
      orderDirection: 'ASC',
    });

    return [
      { value: '', label: 'Select Warehouse' },
      ...(result?.data || []).map((warehouse: any) => ({
        value: String(warehouse.warehouse_id),
        label: warehouse.name || warehouse.warehouse_id,
      })),
    ];
  }

  private async getProductOptions() {
    const result = await this.dataService.query('products', {
      select: ['product_id', 'name'],
      where: [
        { column: 'products.deleted_at', operator: 'IS', value: null },
        // { column: 'products.status', operator: '=', value: 'active' },
      ],
      orderBy: 'name',
      orderDirection: 'ASC',
    });

    return [
      { value: '', label: 'Select Product' },
      ...(result?.data || []).map((product: any) => ({
        value: String(product.product_id),
        label: product.name || product.product_id,
      })),
    ];
  }

  private async getVariantOptions() {
    const result = await this.dataService.query('product_variants', {
      select: [
        'product_variants.id',
        'product_variants.name',
        'products.name AS product_name',
      ],
      joins: [
        {
          type: 'left',
          table: 'products',
          on: [['product_variants.product_id', 'products.product_id']],
        },
      ],
      where: [
        { column: 'product_variants.deleted_at', operator: 'IS', value: null },
        // { column: 'product_variants.status', operator: '=', value: 'active' },
      ],
      orderBy: 'products.name',
      orderDirection: 'ASC',
    });

    return [
      { value: '', label: 'Select Variant (optional)' },
      ...(result?.data || []).map((variant: any) => ({
        value: String(variant.id),
        label: `${variant.product_name || 'Product'} - ${variant.name}`,
      })),
    ];
  }
}
