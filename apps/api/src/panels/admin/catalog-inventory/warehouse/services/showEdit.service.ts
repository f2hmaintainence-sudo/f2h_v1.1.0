import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FieldDef, FormHelper, FormResponse } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { WarehouseShowAddService } from './showAdd.service';

@Injectable()
export class WarehouseShowEditService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: WarehouseShowAddService,
  ) { }

  // =====================================================
  // EDIT TRANSFER FORM
  // =====================================================
  async editTransfer(id: string): Promise<FormResponse> {
    try {
      // Get transfer data
      const transferResult = await this.dataService.query('stock_transfers', {
        select: ['stock_transfers.*'],
        where: [
          { column: 'stock_transfers.id', operator: '=', value: Number(id) },
          { column: 'stock_transfers.deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!transferResult?.data?.length) {
        throw new BadRequestException('Transfer not found');
      }

      const transfer = transferResult.data[0];

      // Get warehouses for dropdown
      const warehousesResult = await this.dataService.query('warehouses', {
        select: ['id', 'name', 'warehouse_type'],
        where: [
          { column: 'deleted_at', operator: 'IS', value: null },
          { column: 'is_active', operator: '=', value: true },
        ],
        order: { name: 'ASC' },
      });

      // Get products for dropdown
      const productsResult = await this.dataService.query('products', {
        select: ['id', 'name'],
        where: [
          { column: 'deleted_at', operator: 'IS', value: null },
          { column: 'is_active', operator: '=', value: true },
        ],
        order: { name: 'ASC' },
      });

      const warehouses = warehousesResult?.data || [];
      const products = productsResult?.data || [];

      const fields: FieldDef[] = [
        {
          name: 'from_warehouse_id',
          label: 'From Warehouse',
          type: 'select',
          required: true,
          disabled: transfer.transfer_status !== 'pending',
        },
        {
          name: 'to_warehouse_id',
          label: 'To Warehouse',
          type: 'select',
          required: true,
          disabled: transfer.transfer_status !== 'pending',
        },
        {
          name: 'product_id',
          label: 'Product',
          type: 'select',
          required: true,
          disabled: transfer.transfer_status !== 'pending',
        },
        {
          name: 'quantity',
          label: 'Quantity',
          type: 'number',
          required: true,
          disabled: transfer.transfer_status !== 'pending',
        },
        {
          name: 'uom',
          label: 'Unit of Measure',
          type: 'select',
          required: true,
          disabled: transfer.transfer_status !== 'pending',
        },
        {
          name: 'transfer_type',
          label: 'Transfer Type',
          type: 'select',
          required: true,
          disabled: transfer.transfer_status !== 'pending',
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
        {
          name: 'expected_at',
          label: 'Expected Delivery Date',
          type: 'date',
          required: true,
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          required: false,
        },
      ];

      return this.formHelper.generateResponse({
        title: 'Edit Warehouse Transfer',
        fields,
        submitLabel: 'Update Transfer',
        script: '',
      });
    } catch (error) {
      this.developer.error('editTransfer error', { error, id });
      throw new BadRequestException('Failed to load transfer form');
    }
  }

  // =====================================================
  // EDIT WAREHOUSE FORM
  // =====================================================
  async editWarehouse(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('warehouses', {
        select: ['warehouses.*'],
        where: [
          { column: 'warehouses.id', operator: '=', value: Number(id) },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Warehouse not found');
      }

      return this.formHelper.generateResponse({
        title: 'Edit Warehouse',
        submitLabel: 'Update Warehouse',
        fields: this.showAddService.warehouseFields(),
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('editWarehouse error', { error, id });
      throw new InternalServerErrorException('Failed to load warehouse edit form');
    }
  }

  // =====================================================
  // EDIT STOCK MOVEMENT — metadata only
  // =====================================================
  async editStockMovement(id: string): Promise<FormResponse> {
    try {
      const result = await this.dataService.query('stock_movements', {
        select: [
          'stock_movements.*',
          'products.name AS product_name',
          'product_variants.name AS variant_name',
        ],
        joins: [
          {
            type: 'left',
            table: 'product_variants',
            on: [['stock_movements.product_variant_id', 'product_variants.variant_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
        ],
        where: [
          { column: 'stock_movements.id', operator: '=', value: Number(id) },
          { column: 'stock_movements.deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!result?.data?.length) {
        throw new BadRequestException('Stock movement not found');
      }

      return this.formHelper.generateResponse({
        title: 'Edit Stock Movement',
        submitLabel: 'Save Changes',
        fields: this.stockMovementEditFields(),
        data: result.data[0],
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('editStockMovement error', { error, id });
      throw new InternalServerErrorException('Failed to load stock movement edit form');
    }
  }

  // =====================================================
  // CORRECT MOVEMENT FORM
  // =====================================================
  async correctStockMovement(id: string): Promise<FormResponse> {
    try {
      // Fix: removed unused balanceResult from Promise.all
      // Movement must load first so we have warehouse_id + variant_id for balance query
      const movementResult = await this.dataService.query('stock_movements', {
        select: [
          'stock_movements.*',
          'products.name AS product_name',
          'product_variants.name AS variant_name',
        ],
        joins: [
          {
            type: 'left',
            table: 'product_variants',
            on: [['stock_movements.product_variant_id', 'product_variants.variant_id']],
          },
          {
            type: 'left',
            table: 'products',
            on: [['product_variants.product_id', 'products.product_id']],
          },
        ],
        where: [
          { column: 'stock_movements.id', operator: '=', value: Number(id) },
          { column: 'stock_movements.deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!movementResult?.data?.length) {
        throw new BadRequestException('Stock movement not found');
      }

      const movement = movementResult.data[0];

      // Now load balance using ids from movement
      const balanceResult = await this.dataService.query('stock_balances', {
        select: ['available_quantity AS quantity'],
        where: [
          { column: 'warehouse_id', operator: '=', value: movement.warehouse_id },
          { column: 'product_variant_id', operator: '=', value: movement.product_variant_id || movement.variant_id },
        ],
        limit: 1,
      });

      const currentBalance = Number(balanceResult?.data?.[0]?.quantity ?? 0);

      return this.formHelper.generateResponse({
        title: 'Correct Stock Movement',
        submitLabel: 'Submit Correction',
        fields: this.correctMovementFields(movement, currentBalance),
        data: {
          movement_type: movement.movement_type,
          quantity: movement.quantity,
        },
        script: '',
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('correctStockMovement error', { error, id });
      throw new InternalServerErrorException('Failed to load correction form');
    }
  }

  // =====================================================
  // FIELDS — edit form (metadata only)
  // Fix: 'display' replaced with 'html' to match FieldDef type
  // =====================================================
  stockMovementEditFields(): FieldDef[] {
    return [
      // ── Locked fields (read-only) ────────────────────
      {
        name: 'movement_id',
        label: 'Movement ID',
        type: 'html',
        required: false,
        width: 'half',
      },
      {
        name: 'movement_type',
        label: 'Movement Type',
        type: 'html',
        required: false,
        width: 'half',
      },
      {
        name: 'warehouse_id',
        label: 'Warehouse',
        type: 'html',
        required: false,
        width: 'half',
      },
      {
        name: 'product_name',
        label: 'Product',
        type: 'html',
        required: false,
        width: 'half',
      },
      {
        name: 'variant_name',
        label: 'Variant',
        type: 'html',
        required: false,
        width: 'half',
      },
      {
        name: 'quantity',
        label: 'Quantity',
        type: 'html',
        required: false,
        width: 'half',
      },
      {
        name: 'quantity_before',
        label: 'Stock Before',
        type: 'html',
        required: false,
        width: 'half',
      },
      {
        name: 'quantity_after',
        label: 'Stock After',
        type: 'html',
        required: false,
        width: 'half',
      },

      // ── Editable fields ──────────────────────────────
      {
        name: 'reference_type',
        label: 'Reference Type',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'e.g. purchase_order, sales_order',
        validation: { maxLength: 50 },
      },
      {
        name: 'reference_id',
        label: 'Reference ID',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'e.g. PO-001',
        validation: { maxLength: 100 },
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        placeholder: 'Additional notes',
        validation: { maxLength: 1000 },
      },
    ];
  }

  // =====================================================
  // FIELDS — correction form
  // Fix: 'display' replaced with 'html' to match FieldDef type
  // =====================================================
  correctMovementFields(movement: any, currentBalance: number): FieldDef[] {
    const directionLabel = movement.direction === 1 ? 'Stock In (+)' : 'Stock Out (-)';

    return [
      // ── Original values (read-only) ──────────────────
      {
        name: '_original_movement_id',
        label: 'Movement ID',
        type: 'html',
        required: false,
        width: 'half',
        defaultValue: movement.movement_id,
      },
      {
        name: '_product_name',
        label: 'Product',
        type: 'html',
        required: false,
        width: 'half',
        defaultValue: movement.product_name ?? 'N/A',
      },
      {
        name: '_variant_name',
        label: 'Variant',
        type: 'html',
        required: false,
        width: 'half',
        defaultValue: movement.variant_name ?? 'N/A',
      },
      {
        name: '_original_direction',
        label: 'Original Direction',
        type: 'html',
        required: false,
        width: 'half',
        defaultValue: directionLabel,
      },
      {
        name: '_original_quantity',
        label: 'Original Quantity',
        type: 'html',
        required: false,
        width: 'half',
        defaultValue: String(movement.quantity),
      },
      {
        name: '_current_balance',
        label: 'Current Stock Balance',
        type: 'html',
        required: false,
        width: 'half',
        defaultValue: String(currentBalance),
      },

      // ── Corrected values (editable) ──────────────────
      {
        name: 'movement_type',
        label: 'Corrected Movement Type',
        type: 'select',
        required: true,
        width: 'half',
        options: [
          { value: 'stock_in', label: 'Stock In' },
          { value: 'stock_out', label: 'Stock Out' },
          { value: 'transfer_in', label: 'Transfer In' },
          { value: 'transfer_out', label: 'Transfer Out' },
          { value: 'return', label: 'Return (Stock In)' },
          { value: 'damage', label: 'Damage (Stock Out)' },
          { value: 'expiry', label: 'Expiry (Stock Out)' },
          { value: 'adjustment_in', label: 'Adjustment In' },
          { value: 'adjustment_out', label: 'Adjustment Out' },
        ],
      },
      {
        name: 'quantity',
        label: 'Corrected Quantity',
        type: 'number',
        required: true,
        width: 'half',
        placeholder: 'Enter correct quantity',
        validation: { min: 0.01, max: 999999 },
      },
      {
        name: 'notes',
        label: 'Reason for Correction',
        type: 'textarea',
        required: true,
        width: 'full',
        placeholder: 'Explain why this correction is needed',
        validation: { maxLength: 1000 },
      },
    ];
  }

  // =====================================================
  // EDIT INTAKE FORM
  // =====================================================
  async editIntake(id: string): Promise<FormResponse> {
    try {
      const intakeRes = await this.dataService.query('vendor_intakes', {
        where: [{ column: 'id', operator: '=', value: Number(id) }],
        limit: 1,
      });

      if (!intakeRes?.data?.length) {
        throw new BadRequestException('Intake not found');
      }

      const intake = intakeRes.data[0];

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

      const formRes = await this.showAddService.showIntake();
      formRes.data = intake;
      formRes.title = 'Edit Vendor Intake';
      formRes.submitLabel = 'Update Intake';

      return formRes;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('editIntake error', { error, id });
      throw new InternalServerErrorException('Failed to load intake edit form');
    }
  }
}