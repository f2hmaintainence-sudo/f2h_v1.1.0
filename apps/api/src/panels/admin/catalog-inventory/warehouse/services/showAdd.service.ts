import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FieldDef,
  FormHelper,
  FormResponse,
} from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

@Injectable()
export class WarehouseShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) { }

  // =====================================================
  // DIRECTION MAP — single source of truth
  // Used by SaveAdd, SaveEdit services via static call
  // =====================================================
  private static readonly IN_TYPES = new Set([
    'stock_in',
    'return',
    'transfer_in',
    'adjustment_in',
  ]);

  private static readonly OUT_TYPES = new Set([
    'stock_out',
    'transfer_out',
    'damage',
    'expiry',
    'adjustment_out',
  ]);

  static directionFor(movementType: string): 1 | -1 {
    if (WarehouseShowAddService.IN_TYPES.has(movementType)) return 1;
    if (WarehouseShowAddService.OUT_TYPES.has(movementType)) return -1;

    throw new BadRequestException({
      status: false,
      message: 'Invalid movement_type',
      errors: { movement_type: `Unknown movement type: ${movementType}` },
    });
  }

  // =====================================================
  // SHOW WAREHOUSE FORM
  // =====================================================
  async showTransfer(): Promise<FormResponse> {
    try {
      // Get warehouses for dropdown
      const warehousesResult = await this.dataService.query('warehouses', {
        select: ['id', 'name', 'warehouse_type'],
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
        order: { name: 'ASC' },
      });

      // Get products for dropdown
      const warehouses = warehousesResult?.data || [];
      let products: any[] = [];

      try {
        const productsResult = await this.dataService.query('products', {
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
          order: { name: 'ASC' },
        });

        products = productsResult?.data || [];

        this.developer.log('Products fetched for transfer form', {
          productsCount: products.length,
          products: products.slice(0, 3) // Log first 3 products for debugging
        });
      } catch (error) {
        this.developer.error('Failed to fetch products for transfer form', { error });
        throw new BadRequestException('Failed to load products for transfer form');
      }

      const fields: FieldDef[] = [
        {
          name: 'from_warehouse_id',
          label: 'From Warehouse',
          type: 'select',
          required: true,
          width: 'half',
          options: warehouses.map((w: any) => ({
            value: w.id,
            label: `${w.name} (${w.warehouse_type})`,
          })),
        },
        {
          name: 'to_warehouse_id',
          label: 'To Warehouse',
          type: 'select',
          required: true,
          width: 'half',
          options: warehouses.map((w: any) => ({
            value: w.id,
            label: `${w.name} (${w.warehouse_type})`,
          })),
        },
        {
          name: 'product_id',
          label: 'Product',
          type: 'select',
          required: true,
          width: 'half',
          options: products.map((p: any) => ({
            value: p.id,
            label: p.name,
          })),
        },
        {
          name: 'quantity',
          label: 'Quantity',
          type: 'number',
          width: 'half',
          required: true,
        },
        {
          name: 'uom',
          label: 'Unit of Measure',
          type: 'select',
          required: true,
          width: 'half',
          options: [
            { value: 'units', label: 'Units' },
            { value: 'kg', label: 'Kilograms' },
            { value: 'lbs', label: 'Pounds' },
            { value: 'liters', label: 'Liters' },
            { value: 'gallons', label: 'Gallons' },
            { value: 'boxes', label: 'Boxes' },
            { value: 'pallets', label: 'Pallets' },
          ],
        },
        {
          name: 'expected_at',
          label: 'Expected Delivery Date',
          type: 'date',
          required: true,
          width: 'half',
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          required: false,
        },
        {
          name: 'transfer_type',
          label: 'Transfer Type',
          type: 'select',
          required: true,
          width: 'half',
          options: [
            { value: 'stock_replenishment', label: 'Stock Replenishment' },
            { value: 'order_fulfillment', label: 'Order Fulfillment' },
            { value: 'seasonal_adjustment', label: 'Seasonal Adjustment' },
            { value: 'emergency_transfer', label: 'Emergency Transfer' },
            { value: 'return_to_vendor', label: 'Return to Vendor' },
          ],
        },
        {
          name: 'reason_code',
          label: 'Reason Code',
          type: 'select',
          required: false,
          options: [
            { value: 'low_stock', label: 'Low Stock' },
            { value: 'overstock', label: 'Overstock' },
            { value: 'damage', label: 'Damage' },
            { value: 'expiry', label: 'Expiry' },
            { value: 'quality_issue', label: 'Quality Issue' },
            { value: 'customer_request', label: 'Customer Request' },
            { value: 'other', label: 'Other' },
          ],
        },

      ];

      return this.formHelper.generateResponse({
        title: 'Create Warehouse Transfer',
        fields,
        submitLabel: 'Create Transfer',
        script: '',
      });
    } catch (error) {
      this.developer.error('showTransfer error', { error });
      throw new BadRequestException('Failed to load transfer form');
    }
  }

  async showWarehouse(): Promise<FormResponse> {
    return this.formHelper.generateResponse({
      title: 'Add Warehouse',
      submitLabel: 'Add Warehouse',
      fields: this.warehouseFields(),
      script: '',
    });
  }

  // =====================================================
  // SHOW STOCK MOVEMENT FORM
  // =====================================================
  async showStockMovement(): Promise<FormResponse> {
    try {
      const [
        warehousesResult,
        productsResult,
        variantsResult,
        batchesResult,
      ] = await Promise.all([
        this.dataService.query('warehouses', {
          select: ['warehouse_id', 'name'],
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
          ],
          orderBy: 'name',
          orderDirection: 'ASC',
        }),
        this.dataService.query('product_variants', {
          select: ['variant_id', 'name', 'product_id'],
          where: [
            { column: 'deleted_at', operator: 'IS', value: null },
          ],
          orderBy: 'name',
          orderDirection: 'ASC',
        }),
        this.dataService.query('product_batches', {
          select: ['id', 'batch_id', 'available_quantity'],
          where: [
            { column: 'deleted_at', operator: 'IS', value: null },
            { column: 'status', operator: 'NOT IN', value: ['expired', 'blocked', 'damaged'] },
          ],
          orderBy: 'batch_id',
          orderDirection: 'ASC',
        }),
      ]);

      const warehouseOptions = [
        { value: '', label: 'Select Warehouse' },
        ...(warehousesResult.data || []).map((w: any) => ({
          value: String(w.warehouse_id),
          label: `${w.name} (${w.warehouse_id})`,
        })),
      ];

      const seenProducts = new Set<string>();
      const productOptions = [
        { value: '', label: 'Select Product' },
        ...(productsResult.data || [])
          .filter((p: any) => {
            const id = String(p.product_id ?? p.id);
            if (!id || id === 'undefined' || seenProducts.has(id)) return false;
            seenProducts.add(id);
            return true;
          })
          .map((p: any) => ({
            value: String(p.product_id ?? p.id),
            label: p.name,
          })),
      ];

      const seenVariants = new Set<string>();
      const variantOptions = [
        { value: '', label: 'Select Variant' },
        ...(variantsResult.data || [])
          .filter((v: any) => {
            const id = String(v.variant_id ?? v.id);
            if (!id || id === 'undefined' || seenVariants.has(id)) return false;
            seenVariants.add(id);
            return true;
          })
          .map((v: any) => ({
            value: String(v.variant_id ?? v.id),
            label: v.name,
          })),
      ];

      const batchOptions = [
        { value: '', label: 'Select Batch (Optional)' },
        ...(batchesResult.data || []).map((b: any) => ({
          value: String(b.batch_id),
          label: `${b.batch_id} (Qty: ${b.available_quantity})`,
        })),
      ];

      return this.formHelper.generateResponse({
        title: 'Add Stock Movement',
        submitLabel: 'Save Movement',
        fields: this.stockMovementFields(
          warehouseOptions,
          batchOptions,
          productOptions,
          variantOptions,
        ),
        script: '',
      });
    } catch (error) {
      this.developer.error('showStockMovement error', { error });
      throw new Error('Failed to load stock movement form');
    }
  }

  // =====================================================
  // WAREHOUSE FIELDS
  // =====================================================
  warehouseFields(branchOptions: any[] = []): FieldDef[] {
    return [
      {
        name: 'name',
        label: 'Warehouse Name',
        type: 'text',
        required: true,
        width: 'full',
        group: 'Basic Identity',
        validation: { minLength: 2, maxLength: 200 },
      },
      {
        name: 'code',
        label: 'Warehouse Code',
        type: 'text',
        required: true,
        width: 'half',
        group: 'Basic Identity',
        validation: { minLength: 2, maxLength: 50 },
        placeholder: 'e.g., WH-001',
      },
      {
        name: 'branch_id',
        label: 'Belongs to Branch',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Basic Identity',
        options: [
          { value: '', label: 'Select Branch (Optional)' },
          ...branchOptions,
        ],
      },
      {
        name: 'warehouse_type',
        label: 'Warehouse Type',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Basic Identity',
        options: [
          { value: 'cold_storage', label: 'Cold Storage' },
          { value: 'dry_storage', label: 'Dry Storage' },
          { value: 'temperature_controlled', label: 'Temperature Controlled' },
          { value: 'refrigerated', label: 'Refrigerated' },
          { value: 'general', label: 'General' },
        ],
      },
      {
        name: 'address_line_1',
        label: 'Address Line 1',
        type: 'text',
        required: false,
        width: 'full',
        group: 'Address & Location',
        validation: { maxLength: 255 },
      },
      {
        name: 'address_line_2',
        label: 'Address Line 2',
        type: 'text',
        required: false,
        width: 'full',
        group: 'Address & Location',
        validation: { maxLength: 255 },
      },
      {
        name: 'city',
        label: 'City',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Address & Location',
        validation: { maxLength: 100 },
      },
      {
        name: 'state',
        label: 'State',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Address & Location',
        validation: { maxLength: 100 },
      },
      {
        name: 'country',
        label: 'Country',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Address & Location',
        validation: { maxLength: 100 },
        defaultValue: 'India',
      },
      {
        name: 'pincode',
        label: 'Pincode',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Address & Location',
        validation: { maxLength: 20 },
      },
      {
        name: 'latitude',
        label: 'Latitude',
        type: 'number',
        required: false,
        width: 'half',
        group: 'Address & Location',
        placeholder: 'e.g., 28.6139',
      },
      {
        name: 'longitude',
        label: 'Longitude',
        type: 'number',
        required: false,
        width: 'half',
        group: 'Address & Location',
        placeholder: 'e.g., 77.2090',
      },
      {
        name: 'manager_name',
        label: 'Manager Name',
        type: 'text',
        required: false,
        width: 'full',
        group: 'Operational Details',
        validation: { maxLength: 150 },
      },
      {
        name: 'manager_phone',
        label: 'Manager Phone',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Operational Details',
        validation: { maxLength: 20 },
      },
      {
        name: 'manager_email',
        label: 'Manager Email',
        type: 'email',
        required: false,
        width: 'half',
        group: 'Operational Details',
        validation: { maxLength: 150 },
      },
      {
        name: 'capacity',
        label: 'Storage Capacity',
        type: 'number',
        required: false,
        width: 'half',
        group: 'Operational Details',
        placeholder: 'e.g., 10000',
      },
      {
        name: 'capacity_unit',
        label: 'Capacity Unit',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Operational Details',
        defaultValue: 'ltr',
        options: [
          { value: 'ltr', label: 'Liters' },
          { value: 'kg', label: 'Kilograms' },
          { value: 'cbm', label: 'Cubic Meters' },
          { value: 'units', label: 'Units' },
          { value: 'pallets', label: 'Pallets' },
        ],
      },
      {
        name: 'temperature_type',
        label: 'Temperature Type',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Operational Details',
        options: [
          { value: 'ambient', label: 'Ambient (20-25°C)' },
          { value: 'cool', label: 'Cool (10-15°C)' },
          { value: 'chilled', label: 'Chilled (2-8°C)' },
          { value: 'frozen', label: 'Frozen (-18°C or below)' },
          { value: 'variable', label: 'Variable Temperature' },
        ],
      },
      {
        name: 'is_active',
        label: 'Active',
        type: 'toggle',
        required: false,
        width: 'half',
        group: 'Status & Notes',
        defaultValue: true,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        group: 'Status & Notes',
        validation: { maxLength: 1000 },
      },
    ];
  }

  // =====================================================
  // STOCK MOVEMENT FIELDS
  // direction field REMOVED — server derives it from movement_type
  // adjustment split into adjustment_in / adjustment_out for clarity
  // =====================================================
  stockMovementFields(
    warehouseOptions: any[] = [],
    batchOptions: any[] = [],
    productOptions: any[] = [],
    variantOptions: any[] = [],
  ): FieldDef[] {
    return [
      {
        name: 'movement_type',
        label: 'Movement Type',
        type: 'radio',
        required: true,
        width: 'half',
        group: 'Movement Core',
        options: [
          { value: 'stock_in',  label: 'Stock In' },
          { value: 'stock_out', label: 'Stock Out' },
        ],
      },
      {
        name: 'warehouse_id',
        label: 'Warehouse',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Movement Core',
        options: warehouseOptions,
      },
      {
        name: 'product_id',
        label: 'Product',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Item Details',
        options: productOptions,
      },
      {
        name: 'variant_id',
        label: 'Variant',
        type: 'select',
        required: true,
        width: 'half',
        group: 'Item Details',
        options: variantOptions,
      },
      {
        name: 'batch_id',
        label: 'Batch (Optional)',
        type: 'select',
        required: false,
        width: 'half',
        group: 'Item Details',
        options: batchOptions,
      },
      {
        name: 'quantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        width: 'half',
        group: 'Item Details',
        placeholder: 'Enter Quantity',
        validation: { min: 0.01, max: 999999 },
      },
      {
        name: 'unit_cost',
        label: 'Unit Cost (Optional)',
        type: 'number',
        required: false,
        width: 'half',
        group: 'Reference & Finance',
        placeholder: '0.00',
        validation: { min: 0 },
      },
      {
        name: 'reference_type',
        label: 'Reference Type',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Reference & Finance',
        placeholder: 'e.g. purchase_order, sales_order',
        validation: { maxLength: 50 },
      },
      {
        name: 'reference_id',
        label: 'Reference ID',
        type: 'text',
        required: false,
        width: 'half',
        group: 'Reference & Finance',
        placeholder: 'e.g. PO-001, SO-123',
        validation: { maxLength: 100 },
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        group: 'Additional Info',
        validation: { maxLength: 1000 },
      },
    ];
  }

  // =====================================================
  // SHOW INTAKE FORM
  // =====================================================
  async showIntake(): Promise<FormResponse> {
    try {
      const [vendorsRes, warehousesRes, productsRes, variantsRes] = await Promise.all([
        this.dataService.query('vendors', {
          select: ['vendor_id', 'name'],
          where: [{ column: 'deleted_at', operator: 'IS', value: null }],
          orderBy: 'name',
        }),
        this.dataService.query('warehouses', {
          select: ['warehouse_id', 'name'],
          where: [{ column: 'deleted_at', operator: 'IS', value: null }],
          orderBy: 'name',
        }),
        this.dataService.query('products', {
          select: ['product_id', 'name'],
          where: [{ column: 'deleted_at', operator: 'IS', value: null }],
          orderBy: 'name',
        }),
        this.dataService.query('product_variants', {
          select: ['id', 'name', 'product_id'],
          where: [{ column: 'deleted_at', operator: 'IS', value: null }],
          orderBy: 'name',
        }),
      ]);

      const fields: FieldDef[] = [
        // {
        //   name: 'vendor_id',
        //   label: 'Vendor',
        //   type: 'select',
        //   required: false,
        //   width: 'half',
        //   group: 'Identity',
        //   options: (vendorsRes.data || []).map((v: any) => ({ value: v.vendor_id, label: v.name })),
        // },
        {
          name: 'warehouse_id',
          label: 'Warehouse',
          type: 'select',
          required: true,
          width: 'half',
          group: 'Identity',
          options: (warehousesRes.data || []).map((w: any) => ({ value: w.warehouse_id, label: w.name })),
        },
        {
          name: 'product_id',
          label: 'Product',
          type: 'select',
          required: true,
          width: 'half',
          group: 'Item Details',
          options: (productsRes.data || []).map((p: any) => ({ value: p.product_id, label: p.name })),
        },
        {
          name: 'variant_id',
          label: 'Variant',
          type: 'select',
          required: true,
          width: 'half',
          group: 'Item Details',
          options: (variantsRes.data || []).map((v: any) => ({ value: v.id, label: v.name })),
        },
        {
          name: 'quantity',
          label: 'Quantity',
          type: 'number',
          required: true,
          width: 'half',
          group: 'Item Details',
        },
        {
          name: 'unit_type',
          label: 'Unit Type',
          type: 'select',
          required: true,
          width: 'half',
          group: 'Item Details',
          options: [
            { value: 'liters', label: 'Liters' },
            { value: 'kg', label: 'Kilograms' },
            { value: 'units', label: 'Units' },
          ],
        },
        {
          name: 'fat_percentage',
          label: 'Fat %',
          type: 'number',
          width: 'half',
          group: 'Quality Info',
        },
        {
          name: 'snf_percentage',
          label: 'SNF %',
          type: 'number',
          width: 'half',
          group: 'Quality Info',
        },
        {
          name: 'temperature',
          label: 'Temperature (°C)',
          type: 'number',
          width: 'half',
          group: 'Quality Info',
        },
        {
          name: 'quality_status',
          label: 'Quality Status',
          type: 'select',
          required: true,
          width: 'half',
          group: 'Quality Info',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'passed', label: 'Passed' },
            { value: 'failed', label: 'Failed' },
          ],
        },
        {
          name: 'intake_status',
          label: 'Intake Status',
          type: 'select',
          required: true,
          width: 'half',
          group: 'Quality Info',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'completed', label: 'Completed' },
            { value: 'rejected', label: 'Rejected' },
          ],
        },
        {
          name: 'vehicle_number',
          label: 'Vehicle Number',
          type: 'text',
          width: 'half',
          group: 'Logistics',
        },
        {
          name: 'received_at',
          label: 'Received At',
          type: 'date',
          width: 'half',
          group: 'Logistics',
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          width: 'full',
          group: 'Logistics',
        },
      ];

      return this.formHelper.generateResponse({
        title: 'New Vendor Intake',
        fields,
        submitLabel: 'Save Intake',
        script: '',
      });
    } catch (error) {
      this.developer.error('showIntake error', { error });
      throw new BadRequestException('Failed to load intake form');
    }
  }
}