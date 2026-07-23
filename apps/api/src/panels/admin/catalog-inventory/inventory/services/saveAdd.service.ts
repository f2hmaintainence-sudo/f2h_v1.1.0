import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { InventoryShowAddService } from './showAdd.service';

@Injectable()
export class InventorySaveAddService {
  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: InventoryShowAddService,
  ) {}

  async saveMovement(body: any, adminId: string) {
    try {
      const variantOptions = await this.showAddService.getVariantOptions();
      const warehouseOptions = await this.showAddService.getWarehouseOptions();
      const fields = this.showAddService.movementFields(
        variantOptions,
        warehouseOptions,
      );
      const validation = this.formHelper.validateFields(fields, body);

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const variantId = Number(body.variant_id);
      const warehouseId = String(body.warehouse_id);
      const quantity = Number(body.quantity);
      const movementType = String(body.movement_type || '').trim();
      const direction = InventoryShowAddService.directionFor(movementType);

      if (!variantId || Number.isNaN(variantId)) {
        throw new BadRequestException('Invalid product variant');
      }

      if (!warehouseId) {
        throw new BadRequestException('Invalid warehouse');
      }

      if (Number.isNaN(quantity) || quantity <= 0) {
        throw new BadRequestException('Invalid quantity');
      }

      // 1. Get Variant Details
      const variantResult = await this.dataService.query('product_variants', {
        select: ['id', 'variant_id', 'product_id', 'manageable_qty'],
        where: [{ column: 'id', operator: '=', value: variantId }],
        limit: 1,
      });

      if (!variantResult?.data?.length) {
        throw new BadRequestException('Product variant not found');
      }

      const variant = variantResult.data[0];
      const productVariantId = variant.variant_id; // The string variant_id
      const productId = variant.product_id;

      // 2. Get Current Balance for this Warehouse
      const balanceResult = await this.dataService.query('stock_balances', {
        select: ['quantity'],
        where: [
          { column: 'warehouse_id', operator: '=', value: warehouseId },
          { column: 'variant_id', operator: '=', value: productVariantId },
        ],
        limit: 1,
      });

      const quantityBefore = balanceResult?.data?.length
        ? Number(balanceResult.data[0].quantity || 0)
        : 0;
      const quantityAfter = quantityBefore + direction * quantity;

      if (quantityAfter < 0 && direction === -1) {
        throw new BadRequestException('Insufficient stock in selected warehouse');
      }

      // 3. Insert Stock Movement
      const movementId = `MV-${Date.now()}`;
      const insertData = {
        movement_id: movementId,
        warehouse_id: warehouseId,
        product_id: productId,
        variant_id: variantId, // bigint
        movement_type: movementType,
        direction: direction,
        quantity: quantity,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        unit_cost: body.unit_cost ? Number(body.unit_cost) : null,
        reference_type: body.reference_type ? String(body.reference_type).trim() : null,
        reference_id: body.reference_id ? String(body.reference_id).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        created_by: adminId,
      };

      const movementResult = await this.dataService.insert(
        'stock_movements',
        insertData,
      );

      if (!movementResult?.status) {
        throw new InternalServerErrorException('Failed to record stock movement');
      }

      // 4. Update or Insert Stock Balance
      if (balanceResult?.data?.length) {
        await this.dataService.query('stock_balances', {
          update: {
            quantity: quantityAfter,
            updated_by: adminId,
            updated_at: new Date().toISOString(),
          },
          where: [
            { column: 'warehouse_id', operator: '=', value: warehouseId },
            { column: 'variant_id', operator: '=', value: productVariantId },
          ],
        });
      } else {
        await this.dataService.insert('stock_balances', {
          warehouse_id: warehouseId,
          product_id: productId,
          variant_id: productVariantId,
          quantity: quantityAfter,
          created_by: adminId,
        });
      }

      // 5. Update Global manageable_qty in product_variants
      const newGlobalQty = Number(variant.manageable_qty || 0) + direction * quantity;
      await this.dataService.query('product_variants', {
        update: {
          manageable_qty: newGlobalQty,
          is_out_of_stock: newGlobalQty <= 0,
          updated_at: new Date().toISOString(),
        },
        where: [{ column: 'id', operator: '=', value: variantId }],
      });

      // 6. Audit Log
      await this.dataService.insert('admin_audit_logs', {
        admin_id: adminId,
        action: 'stock_movement_create',
        target_type: 'stock_movements',
        target_id: movementResult.data?.id ?? movementResult.id ?? 'new',
        details: JSON.stringify({
          movement_id: movementId,
          warehouse_id: warehouseId,
          variant_id: variantId,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
        }),
      });

      return {
        status: true,
        message: 'Stock movement recorded successfully',
        id: movementResult.data?.id ?? movementResult.id,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.developer.error('saveMovement error', { error, body });
      throw new InternalServerErrorException('Failed to record stock movement');
    }
  }
}
