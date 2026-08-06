import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { FormHelper } from '../../../../../helpers/FormHelper';
import { DataService } from '../../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { WarehouseShowAddService } from './showAdd.service';

@Injectable()
export class WarehouseSaveEditService {

  constructor(
    private readonly formHelper: FormHelper,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
    private readonly showAddService: WarehouseShowAddService,
  ) { }

  // =====================================================
  // UPDATE TRANSFER
  // =====================================================

  async updateTransfer(id: string, body: any, adminId: string) {
    try {
      // Check if transfer exists and is in pending status
      const transferResult = await this.dataService.query('stock_transfers', {
        select: ['id', 'transfer_status'],
        where: [
          { column: 'id', operator: '=', value: Number(id) },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!transferResult?.data?.length) {
        throw new BadRequestException('Transfer not found');
      }

      const transfer = transferResult.data[0];

      if (transfer.transfer_status !== 'pending') {
        throw new BadRequestException(
          'Only pending transfers can be edited'
        );
      }

      // Validate form fields
      const validation = await this.formHelper.validateFields(
        body,
        [
          { name: 'from_warehouse_id', required: true },
          { name: 'to_warehouse_id', required: true },
          { name: 'product_id', required: true },
          { name: 'quantity', required: true, type: 'number' },
          { name: 'uom', required: true },
          { name: 'transfer_type', required: true },
          { name: 'expected_at', required: true },
        ]
      );

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Check if from and to warehouses are different
      if (body.from_warehouse_id === body.to_warehouse_id) {
        throw new BadRequestException({
          status: false,
          message: 'Source and destination warehouses cannot be the same',
        });
      }

      // Update transfer record
      const updateData = {
        from_warehouse_id: body.from_warehouse_id,
        to_warehouse_id: body.to_warehouse_id,
        product_id: body.product_id,
        variant_id: body.variant_id || null,
        batch_id: body.batch_id || null,
        uom: body.uom,
        quantity: parseFloat(body.quantity),
        transfer_type: body.transfer_type,
        reason_code: body.reason_code || null,
        notes: body.notes || null,
        expected_at: new Date(body.expected_at).toISOString(),
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      };

      const result = await this.dataService.query(
        'stock_transfers',
        {
          update: updateData,
          where: [
            { column: 'id', operator: '=', value: Number(id) },
          ],
        }
      );

      if (!result?.status) {
        throw new InternalServerErrorException(
          'Failed to update transfer',
        );
      }

      return {
        status: true,
        message: 'Transfer updated successfully',
        data: {
          id: Number(id),
          status: 'pending',
        },
      };

    } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof InternalServerErrorException) {
        throw error;
      }

      this.developer.error('updateTransfer error', { error, id, body });
      
      throw new InternalServerErrorException(
        'Failed to update transfer',
      );
    }
  }

  // =====================================================
  // UPDATE WAREHOUSE
  // =====================================================

  async updateWarehouse(id: string, body: any, adminId: string) {
    try {
      const fields = this.showAddService.warehouseFields();
      const validation = this.formHelper.validateFields(fields, body);

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // Unique code check excluding current record
      if (body.code) {
        const existing = await this.dataService.query('warehouses', {
          select: ['id'],
          where: [
            { column: 'code', operator: '=', value: String(body.code).trim() },
            { column: 'id', operator: '!=', value: Number(id) },
            { column: 'deleted_at', operator: 'IS', value: null },
          ],
          limit: 1,
        });

        if (existing?.data?.length) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { code: 'Warehouse code already exists' },
          });
        }
      }

      const updateData: Record<string, any> = {};

      for (const field of fields) {
        if (body[field.name] !== undefined) {
          const value = typeof body[field.name] === 'string'
            ? body[field.name].trim()
            : body[field.name];
          updateData[field.name] = value === '' ? null : value;
        }
      }

      // Boolean
      updateData.is_active =
        updateData.is_active === true || updateData.is_active === 'true';

      // Numerics
      if (updateData.capacity != null) updateData.capacity = parseFloat(updateData.capacity);
      if (updateData.latitude != null) updateData.latitude = parseFloat(updateData.latitude);
      if (updateData.longitude != null) updateData.longitude = parseFloat(updateData.longitude);

      updateData.updated_by = adminId;
      updateData.updated_at = new Date().toISOString();

      const result = await this.dataService.query('warehouses', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      return { status: true, message: 'Warehouse updated successfully' };

    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) throw error;

      this.developer.error('updateWarehouse error', { error, id, body });
      throw new InternalServerErrorException('Failed to update warehouse');
    }
  }

  // =====================================================
  // UPDATE STOCK MOVEMENT (metadata only)
  // quantity / direction / movement_type are immutable
  // =====================================================

  async updateStockMovement(id: string, body: any, adminId: string) {
    try {
      const existingResult = await this.dataService.query('stock_movements', {
        select: ['id'],
        where: [
          { column: 'id', operator: '=', value: Number(id) },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!existingResult?.data?.length) {
        throw new BadRequestException('Stock movement not found');
      }

      const updateData: Record<string, any> = {};

      if (body.notes !== undefined) updateData.notes = String(body.notes).trim() || null;
      if (body.reference_type !== undefined) updateData.reference_type = String(body.reference_type).trim() || null;
      if (body.reference_id !== undefined) updateData.reference_id = String(body.reference_id).trim() || null;

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No editable fields provided');
      }

      updateData.updated_by = adminId;
      updateData.updated_at = new Date().toISOString();

      const result = await this.dataService.query('stock_movements', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Database update failed');
      }

      return { status: true, message: 'Stock movement updated successfully' };

    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) throw error;

      this.developer.error('updateStockMovement error', { error, id, body });
      throw new InternalServerErrorException('Failed to update stock movement');
    }
  }

  // =====================================================
  // REVERSE AND CORRECT MOVEMENT
  // Call this when quantity needs to change
  // =====================================================

  async reverseAndCorrectMovement(
    id: string,
    body: { quantity: number; notes?: string; movement_type?: string },
    adminId: string,
  ) {
    try {

      // =====================================================
      // LOAD ORIGINAL MOVEMENT
      // =====================================================
      const existingResult = await this.dataService.query('stock_movements', {
        select: ['*'],
        where: [
          { column: 'id', operator: '=', value: Number(id) },
          { column: 'deleted_at', operator: 'IS', value: null },
        ],
        limit: 1,
      });

      if (!existingResult?.data?.length) {
        throw new BadRequestException('Stock movement not found');
      }

      const original = existingResult.data[0];

      // =====================================================
      // VALIDATE NEW QUANTITY
      // =====================================================
      const newQuantity = Number(body.quantity);
      if (!newQuantity || newQuantity <= 0 || !isFinite(newQuantity)) {
        throw new BadRequestException('Quantity must be a positive number');
      }

      // =====================================================
      // LOAD CURRENT STOCK BALANCE
      // =====================================================
      const balanceResult = await this.dataService.query('stock_balances', {
        select: ['id', 'quantity'],
        where: [
          { column: 'warehouse_id', operator: '=', value: original.warehouse_id },
          { column: 'variant_id', operator: '=', value: original.variant_id },
        ],
        limit: 1,
      });

      if (!balanceResult?.data?.length) {
        throw new BadRequestException('Stock balance record not found for this warehouse/variant');
      }

      const currentBalance = balanceResult.data[0];
      const currentQty = Number(currentBalance.quantity ?? 0);

      // =====================================================
      // STEP 1 — REVERSE original movement
      // =====================================================
      const reverseDirection = original.direction === 1 ? -1 : 1;
      const qtyAfterReversal = currentQty + reverseDirection * Number(original.quantity);

      if (qtyAfterReversal < 0) {
        throw new BadRequestException(
          `Cannot reverse: would result in negative stock (${qtyAfterReversal})`,
        );
      }

      const reversalId = `MOV-REV-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      await this.dataService.insert('stock_movements', {
        movement_id: reversalId,
        warehouse_id: original.warehouse_id,
        batch_id: original.batch_id ?? null,
        product_id: original.product_id,
        variant_id: original.variant_id,
        movement_type: 'reversal',
        direction: reverseDirection,
        quantity: Number(original.quantity),
        quantity_before: currentQty,
        quantity_after: qtyAfterReversal,
        reference_type: 'reversal',
        reference_id: String(original.movement_id),
        notes: `Reversal of ${original.movement_id}`,
        created_by: adminId,
        updated_by: adminId,
      });

      // =====================================================
      // STEP 2 — CREATE corrected movement
      // =====================================================
      const resolvedMovementType = body.movement_type ?? original.movement_type;
      const newDirection = WarehouseShowAddService.directionFor(resolvedMovementType);

      if (newDirection === -1 && newQuantity > qtyAfterReversal) {
        throw new BadRequestException(
          `Insufficient stock after reversal. Available: ${qtyAfterReversal}, Requested: ${newQuantity}`,
        );
      }

      const qtyAfterCorrection = qtyAfterReversal + newDirection * newQuantity;
      const correctionId = `MOV-COR-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      await this.dataService.insert('stock_movements', {
        movement_id: correctionId,
        warehouse_id: original.warehouse_id,
        batch_id: original.batch_id ?? null,
        product_id: original.product_id,
        variant_id: original.variant_id,
        movement_type: resolvedMovementType,
        direction: newDirection,
        quantity: newQuantity,
        quantity_before: qtyAfterReversal,
        quantity_after: qtyAfterCorrection,
        reference_type: 'correction',
        reference_id: String(original.movement_id),
        notes: body.notes ?? `Correction of ${original.movement_id}`,
        created_by: adminId,
        updated_by: adminId,
      });

      // =====================================================
      // STEP 3 — SOFT DELETE original movement
      // =====================================================
      await this.dataService.query('stock_movements', {
        update: {
          deleted_at: new Date().toISOString(),
          updated_by: adminId,
        },
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      // =====================================================
      // STEP 4 — UPDATE STOCK BALANCE
      // =====================================================
      await this.dataService.query('stock_balances', {
        update: {
          quantity: qtyAfterCorrection,
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        where: [{ column: 'id', operator: '=', value: currentBalance.id }],
      });

      return {
        status: true,
        message: 'Stock movement corrected successfully',
        reversal_id: reversalId,
        correction_id: correctionId,
        quantity_before: currentQty,
        quantity_after: qtyAfterCorrection,
      };

    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) throw error;

      this.developer.error('reverseAndCorrectMovement error', { error, id, body });
      throw new InternalServerErrorException('Failed to correct stock movement');
    }
  }

  // =====================================================
  // SAVE CORRECTION (validates then calls reverseAndCorrect)
  // POST /warehouse/stock-movement/:id/correct
  // =====================================================
  async saveCorrectMovement(id: string, body: any, adminId: string) {
    try {
      // Validate required fields
      if (!body.quantity || Number(body.quantity) <= 0) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: { quantity: 'Corrected quantity must be a positive number' },
        });
      }

      if (!body.notes?.trim()) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: { notes: 'Reason for correction is required' },
        });
      }

      if (!body.movement_type) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: { movement_type: 'Corrected movement type is required' },
        });
      }

      // Delegate to the correction logic
      return await this.reverseAndCorrectMovement(
        id,
        {
          quantity: Number(body.quantity),
          movement_type: String(body.movement_type).trim(),
          notes: String(body.notes).trim(),
        },
        adminId,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) throw error;

      this.developer.error('saveCorrectMovement error', { error, id, body });
      throw new InternalServerErrorException('Failed to save correction');
    }
  }

  // =====================================================
  // UPDATE INTAKE
  // =====================================================
  async updateIntake(id: string, body: any, adminId: string) {
    try {
      const existing = await this.dataService.query('vendor_intakes', {
        where: [{ column: 'id', operator: '=', value: Number(id) }],
        limit: 1,
      });

      if (!existing?.data?.length) {
        throw new BadRequestException('Intake not found');
      }

      const updateData = {
        vendor_id: String(body.vendor_id),
        warehouse_id: String(body.warehouse_id),
        product_id: String(body.product_id),
        variant_id: body.variant_id ? Number(body.variant_id) : null,
        quantity: parseFloat(body.quantity),
        unit_type: body.unit_type,
        fat_percentage: body.fat_percentage ? parseFloat(body.fat_percentage) : null,
        snf_percentage: body.snf_percentage ? parseFloat(body.snf_percentage) : null,
        temperature: body.temperature ? parseFloat(body.temperature) : null,
        quality_status: body.quality_status || 'pending',
        intake_status: body.intake_status || 'pending',
        vehicle_number: body.vehicle_number || null,
        received_at: body.received_at ? new Date(body.received_at).toISOString() : new Date().toISOString(),
        notes: body.notes || null,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      };

      const result = await this.dataService.query('vendor_intakes', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to update vendor intake');
      }

      return {
        status: true,
        message: 'Vendor intake updated successfully',
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.developer.error('updateIntake error', { error, id, body });
      throw new InternalServerErrorException('Failed to update vendor intake');
    }
  }
}