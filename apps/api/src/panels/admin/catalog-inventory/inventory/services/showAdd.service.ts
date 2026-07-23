import { Injectable } from '@nestjs/common';
import { FieldDef, FormHelper, FormResponse } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';

@Injectable()
export class InventoryShowAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) {}

  async showMovement(): Promise<FormResponse> {
    try {
      const [variantOptions, warehouseOptions] = await Promise.all([
        this.getVariantOptions(),
        this.getWarehouseOptions(),
      ]);

      return this.formHelper.generateResponse({
        title: 'Add Stock Movement',
        submitLabel: 'Save Movement',
        fields: this.movementFields(variantOptions, warehouseOptions),
        script: '',
      });
    } catch (error) {
      this.developer.error('showMovement error', { error });
      throw new Error('Failed to load inventory form');
    }
  }

  // ─── Options Loaders ────────────────────────────────────────────────────────

  async getVariantOptions() {
    const result = await this.dataService.query('product_variants', {
      select: [
        'product_variants.id',
        'product_variants.name',
        'products.name AS product_name',
        'products.id AS product_id',
      ],
      joins: [
        {
          type: 'left',
          table: 'products',
          on: [['product_variants.product_id', 'products.id']],
        },
      ],
      where: [
        { column: 'product_variants.deleted_at', operator: 'IS', value: null },
        { column: 'product_variants.status', operator: '=', value: 'active' },
      ],
      orderBy: 'products.name',
      orderDirection: 'ASC',
    });

    return [
      { value: '', label: 'Select Product Variant' },
      ...(result?.data || []).map((v: any) => ({
        value: String(v.id),
        label: `${v.product_name ?? 'Unknown'} — ${v.name}`,
        // carry product_id so the handler can populate it
        meta: { product_id: String(v.product_id) },
      })),
    ];
  }

  async getWarehouseOptions() {
    const result = await this.dataService.query('warehouses', {
      select: ['warehouse_id', 'name', 'code'],
      where: [
        { column: 'deleted_at', operator: 'IS', value: null },
        { column: 'status', operator: '=', value: 'active' },
      ],
      orderBy: 'name',
      orderDirection: 'ASC',
    });

    return [
      { value: '', label: 'Select Warehouse' },
      ...(result?.data || []).map((w: any) => ({
        value: String(w.warehouse_id),
        label: `${w.name} (${w.code})`,
      })),
    ];
  }

  // ─── Field Definitions ───────────────────────────────────────────────────────

  movementFields(
    variantOptions: any[] = [],
    warehouseOptions: any[] = [],
  ): FieldDef[] {
    return [
      // ── Core identifiers ──────────────────────────────────────────────────
      {
        name: 'warehouse_id',
        label: 'Warehouse',
        type: 'select',
        required: true,
        width: 'half',
        options: warehouseOptions,
      },
      {
        name: 'variant_id',
        label: 'Product Variant',
        type: 'select',
        required: true,
        width: 'half',
        options: variantOptions,
      },

      // ── Movement classification ───────────────────────────────────────────
      //
      //  movement_type  = WHY  (purchase | sale | adjustment | return | transfer)
      //  direction      = computed from movement_type in the save handler:
      //                     in-types  → +1   (purchase, return, adjustment_in)
      //                     out-types → -1   (sale, adjustment_out, transfer)
      //
      {
        name: 'movement_type',
        label: 'Movement Type',
        type: 'select',
        required: true,
        width: 'half',
        defaultValue: 'purchase',
        options: [
          // ── Stock IN (direction = +1) ──
          { value: 'purchase',       label: '📦 Purchase (Stock In)' },
          { value: 'return_in',      label: '↩️  Customer Return (Stock In)' },
          { value: 'transfer_in',    label: '🔄 Transfer In' },
          { value: 'adjustment_in',  label: '✏️  Adjustment (Stock In)' },
          // ── Stock OUT (direction = -1) ──
          { value: 'sale',           label: '🛒 Sale (Stock Out)' },
          { value: 'return_out',     label: '↪️  Return to Supplier (Stock Out)' },
          { value: 'transfer_out',   label: '🔄 Transfer Out' },
          { value: 'adjustment_out', label: '✏️  Adjustment (Stock Out)' },
          { value: 'damage',         label: '⚠️  Damage / Loss (Stock Out)' },
        ],
      },
      {
        name: 'quantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        width: 'half',
        placeholder: '0',
        defaultValue: 1,
        validation: { min: 0.01, max: 999999 },
        // Always positive — direction is derived from movement_type
      },

      // ── Costing (optional but recommended) ───────────────────────────────
      {
        name: 'unit_cost',
        label: 'Unit Cost',
        type: 'number',
        required: false,
        width: 'half',
        placeholder: '0.00',
        validation: { min: 0, max: 9999999 },
      },

      // ── Reference / audit ────────────────────────────────────────────────
      {
        name: 'reference_type',
        label: 'Reference Type',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'purchase_order, sales_order, manual…',
        validation: { maxLength: 50 },
      },
      {
        name: 'reference_id',
        label: 'Reference ID',
        type: 'text',
        required: false,
        width: 'half',
        placeholder: 'PO-001, SO-123…',
        validation: { maxLength: 100 },
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
        width: 'full',
        placeholder: 'Additional details about this movement',
        validation: { maxLength: 1000 },
      },
    ];
  }

  // ─── Direction Helper (use this in your Save handler) ───────────────────────

  /**
   * Maps movement_type → direction stored in DB.
   *   +1  stock increases
   *   -1  stock decreases
   */
  static directionFor(movementType: string): 1 | -1 {
    const inTypes = new Set([
      'purchase',
      'return_in',
      'transfer_in',
      'adjustment_in',
    ]);
    return inTypes.has(movementType) ? 1 : -1;
  }
}