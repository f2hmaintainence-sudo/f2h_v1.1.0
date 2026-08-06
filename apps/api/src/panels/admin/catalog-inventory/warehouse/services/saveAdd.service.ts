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
export class WarehouseSaveAddService {

  constructor(

    private readonly formHelper: FormHelper,

    private readonly dataService: DataService,

    private readonly developer: DeveloperService,

    private readonly showAddService: WarehouseShowAddService,

  ) { }

  // =====================================================
  // SAVE TRANSFER
  // =====================================================

 async saveTransfer(body: any, adminId: string) {
  try {

    // =====================================================
    // VALIDATION
    // All IDs are VARCHAR in DB — validate as text, not number
    // =====================================================

    const validation = this.formHelper.validateFields(
      [
        { name: 'from_warehouse_id', required: true, type: 'text' },  // ✅ was 'number'
        { name: 'to_warehouse_id',   required: true, type: 'text' },  // ✅ was 'number'
        { name: 'product_id',        required: true, type: 'text' },  // ✅ was 'number'
        { name: 'quantity',          required: true, type: 'number' },
        { name: 'uom',               required: true, type: 'text' },
        { name: 'transfer_type',     required: true, type: 'text' },
        { name: 'expected_at',       required: true, type: 'date' },
      ],
      body
    );

    if (!validation.valid) {
      throw new BadRequestException({
        status: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    // =====================================================
    // SAME WAREHOUSE CHECK
    // Compare as strings (VARCHAR), no parseInt needed
    // =====================================================

    if (
      String(body.from_warehouse_id).trim() ===
      String(body.to_warehouse_id).trim()
    ) {
      throw new BadRequestException({
        status: false,
        message: 'Source and destination warehouses cannot be the same',
      });
    }

    // =====================================================
    // GENERATE TRANSFER ID
    // =====================================================

    const transferId =
      'TRF-' +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 7).toUpperCase();

    // =====================================================
    // BUILD TRANSFER RECORD
    // Store IDs as strings to match VARCHAR(50) columns
    // =====================================================

    const transferData = {
      transfer_id:         transferId,
      from_warehouse_id:   String(body.from_warehouse_id).trim(),  // ✅ keep as string
      to_warehouse_id:     String(body.to_warehouse_id).trim(),    // ✅ keep as string
      product_id:          String(body.product_id).trim(),         // ✅ keep as string
      variant_id:          body.variant_id   ? String(body.variant_id).trim()  : null,
      batch_id:            body.batch_id     ? String(body.batch_id).trim()    : null,
      uom:                 body.uom,
      quantity:            parseFloat(body.quantity),
      quantity_dispatched: null,
      quantity_received:   null,
      transfer_type:       body.transfer_type,
      reason_code:         body.reason_code  || null,
      transfer_status:     'pending',
      notes:               body.notes        || null,
      created_by:          adminId,
      updated_by:          adminId,
      expected_at:         new Date(body.expected_at).toISOString(),
      created_at:          new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    };

    // =====================================================
    // INSERT
    // =====================================================

    const result = await this.dataService.query('stock_transfers', {
      insert: transferData,
    });

    if (!result?.status) {
      throw new InternalServerErrorException('Failed to create transfer');
    }

    return {
      status: true,
      message: 'Transfer created successfully',
      data: {
        id:          result.data?.id,
        transfer_id: transferId,
        status:      'pending',
      },
    };

  } catch (error) {
    if (
      error instanceof BadRequestException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    this.developer.error('saveTransfer error', { error, body });
    throw new InternalServerErrorException('Failed to create transfer');
  }
}

  // =====================================================
  // SAVE WAREHOUSE
  // =====================================================

  async saveWarehouse(
    body: any,
    adminId: string,
  ) {

    try {

      const fields =
        this.showAddService.warehouseFields();

      const validation =
        this.formHelper.validateFields(
          fields,
          body,
        );

      if (!validation.valid) {

        throw new BadRequestException({
          status: false,

          message: 'Validation failed',

          errors: validation.errors,
        });
      }

      // =====================================================
      // UNIQUE CODE VALIDATION
      // =====================================================

      if (body.code) {

        const existing =
          await this.dataService.query(
            'warehouses',
            {
              select: ['id'],

              where: [
                {
                  column: 'code',

                  operator: '=',

                  value: String(
                    body.code,
                  ).trim(),
                },

                {
                  column: 'deleted_at',

                  operator: 'IS',

                  value: null,
                },
              ],

              limit: 1,
            },
          );

        if (existing?.data?.length) {

          throw new BadRequestException({
            status: false,

            message:
              'Validation failed',

            errors: {
              code:
                'Warehouse code already exists',
            },
          });
        }
      }

      // =====================================================
      // ALLOWED COLUMNS
      // =====================================================

      const WAREHOUSE_COLUMNS = [

        'name', 'code','warehouse_type','address_line_1','address_line_2','city','state','country',
        'pincode','latitude','longitude','manager_name','manager_phone','manager_email','capacity','capacity_unit','temperature_type','is_active','notes',
      ];

      const insertData =
        this.pickFields(
          WAREHOUSE_COLUMNS,
          body,
        );

      // =====================================================
      // GENERATE warehouse_id
      // =====================================================

      const timestamp =
        Date.now()
          .toString(36)
          .toUpperCase();

      const random =
        Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();

      insertData.warehouse_id =
        `WH-${timestamp}${random}`;

      // =====================================================
      // BOOLEANS
      // =====================================================

      insertData.is_active =
        insertData.is_active === undefined
          ? true
          : insertData.is_active ===
          true ||
          insertData.is_active ===
          'true';

      // =====================================================
      // NUMERIC CONVERSIONS
      // =====================================================

      if (
        insertData.capacity !== undefined &&
        insertData.capacity !== null
      ) {
        insertData.capacity =
          parseFloat(
            insertData.capacity,
          );
      }

      if (
        insertData.latitude !== undefined &&
        insertData.latitude !== null
      ) {
        insertData.latitude =
          parseFloat(
            insertData.latitude,
          );
      }

      if (
        insertData.longitude !== undefined &&
        insertData.longitude !== null
      ) {
        insertData.longitude =
          parseFloat(
            insertData.longitude,
          );
      }

      // =====================================================
      // AUDIT FIELDS
      // =====================================================

      insertData.created_by =
        adminId;

      insertData.updated_by =
        adminId;

      // =====================================================
      // INSERT
      // =====================================================

      const result =
        await this.dataService.insert(
          'warehouses',
          insertData,
        );

      if (!result?.status) {

        throw new InternalServerErrorException(
          result?.message ||
          'Database insert failed',
        );
      }

      return {

        status: true,

        message:
          'Warehouse created successfully',

        id:
          result.data?.id ??
          result.id,
      };

    } catch (error) {

      if (
        error instanceof
        BadRequestException ||
        error instanceof
        InternalServerErrorException
      ) {
        throw error;
      }

      this.developer.error('saveWarehouse error', {error,body,},);

      throw new InternalServerErrorException(
        'Failed to create warehouse',
      );
    }
  }

  // =====================================================
  // SAVE STOCK MOVEMENT
  // =====================================================

  // =====================================================
  // DIRECTION MAP — derived from movement_type
  // Never trust direction from client
  // =====================================================
  private static readonly DIRECTION_MAP: Record<string, 1 | -1> = {
    stock_in:  1,
    stock_out: -1,
  };

  private getDirection(movementType: string): 1 | -1 {
    const direction = WarehouseSaveAddService.DIRECTION_MAP[movementType];
    if (!direction) {
      throw new BadRequestException({
        status: false,
        message: 'Invalid movement_type',
        errors: { movement_type: `Unknown movement type: ${movementType}` },
      });
    }
    return direction;
  }

  // =====================================================
  // SAVE STOCK MOVEMENT
  // =====================================================
  async saveStockMovement(body: any, adminId: string) {
    try {

      // =====================================================
      // VALIDATE FIELDS
      // =====================================================
      const fields = this.showAddService.stockMovementFields(); // no args needed — options only affect UI
      const validation = this.formHelper.validateFields(fields, body);

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      // =====================================================
      // REQUIRED FIELD CHECKS
      // =====================================================
      const requiredFields = ['movement_type', 'warehouse_id', 'product_id','variant_id', 'quantity'];
      for (const field of requiredFields) {
        if (!body[field] && body[field] !== 0) {
          throw new BadRequestException({
            status: false,
            message: 'Validation failed',
            errors: { [field]: `${field} is required` },
          });
        }
      }
        const vatiantId = String(body.variant_id).trim();
        const warehouseId = String(body.warehouse_id).trim();
        const productId = String(body.product_id).trim();
        const batchId = body.batch_id ? String(body.batch_id).trim() : null;
        const movemenType = String(body.movement_type).trim();
        const unityPrice = body.unit_cost ? Number(body.unit_cost):0;

      // =====================================================
      // DERIVE DIRECTION FROM movement_type (never from client)
      // =====================================================
      const direction = WarehouseShowAddService.directionFor(String(body.movement_type).trim());

      // =====================================================
      // VALIDATE QUANTITY
      // =====================================================
      const quantity = Number(body.quantity);
      if (!quantity || quantity <= 0 || !isFinite(quantity)) {
        throw new BadRequestException({
          status: false,
          message: 'Quantity must be a positive number',
        });
      }

      // =====================================================
      // LOAD BATCH (optional — batch_id may be null)
      // =====================================================
      let batch: any = null;

      if (batchId) {
        const batchResult = await this.dataService.query('product_batches', {
          select: ['id', 'batch_id', 'available_quantity', 'status'],
          where: [
            { column: 'batch_id', operator: '=', value: batchId },
            { column: 'deleted_at', operator: 'IS', value: null },
          ],
          limit: 1,
        });

        if (!batchResult?.data?.length) {
          throw new BadRequestException({ status: false, message: 'Batch not found' });
        }

        batch = batchResult.data[0];

        const blockedStatuses = ['expired', 'blocked', 'damaged'];
        if (blockedStatuses.includes(batch.status)) {
          throw new BadRequestException({
            status: false,
            message: `Cannot use ${batch.status} batch`,
          });
        }
      }

      // =====================================================
      // LOAD CURRENT STOCK BALANCE (warehouse + variant level)
      // =====================================================
      const balanceResult = await this.dataService.query('stock_balances', {
        select: ['id', 'available_quantity'],
        where: [
          { column: 'warehouse_id', operator: '=', value: warehouseId },
          { column: 'product_variant_id', operator: '=', value: vatiantId },
        ],
        limit: 1,
      });

      const currentBalance = balanceResult?.data?.[0];
      const quantityBefore = Number(currentBalance?.available_quantity ?? 0);

      // =====================================================
      // STOCK OUT GUARD
      // =====================================================
      if (direction === -1 && quantity > quantityBefore) {
        throw new BadRequestException({
          status: false,
          message: `Insufficient stock. Available: ${quantityBefore}, Requested: ${quantity}`,
        });
      }

      const quantityAfter = quantityBefore + direction * quantity;

      // =====================================================
      // GENERATE MOVEMENT ID
      // =====================================================
      const movementId = `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // =====================================================
      // BUILD INSERT DATA
      // =====================================================
      const insertData: Record<string, any> = {
        movement_id: movementId,
        warehouse_id: warehouseId,
        batch_id:batchId, 
        product_variant_id: vatiantId,
        movement_type: movemenType,
        direction,                          // ← server-derived, not from client
        quantity,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        unit_cost:unityPrice,
        reference_type: body.reference_type?.trim() || null,
        reference_id: body.reference_id?.trim() || null,
        notes: body.notes?.trim() || null,
        created_by: adminId,
        updated_by: adminId,
      };

      // =====================================================
      // INSERT STOCK MOVEMENT
      // =====================================================
      const result = await this.dataService.insert('stock_movements', insertData);

      if (!result?.status) {
        this.developer.error('Stock movement insert failed', { result, insertData });
        throw new InternalServerErrorException(result?.message || 'Database insert failed');
      }

      // =====================================================
      // UPDATE STOCK BALANCE (upsert warehouse + variant)
      // =====================================================
      if (currentBalance?.id) {
        // Row exists — update it
        const result = await this.dataService.query('stock_balances', {
          update: {
            available_quantity: quantityAfter,
            updated_by: adminId,
            updated_at: new Date().toISOString(),
          },
          where: [
            { column: 'product_variant_id', operator: '=', value: vatiantId },
            { column: 'warehouse_id', operator: '=', value: warehouseId },
          ],
        });

        if (!result?.status) {
          this.developer.error('Stock Balance Update failed', result);
          throw new InternalServerErrorException(result?.message || 'Database update failed');
        }

      } else {
        // No row yet — insert initial balance
        const result = await this.dataService.insert('stock_balances', {
          warehouse_id: warehouseId,
          product_variant_id: vatiantId,
          available_quantity: quantityAfter,
          created_by: adminId,
          updated_by: adminId,
        });
        if (!result?.status) {
          this.developer.error('Stock Balance Create failed', result);
          throw new InternalServerErrorException(result?.message || 'Database create failed');
        }
      }

      // =====================================================
      // UPDATE BATCH QUANTITY (if batch was provided)
      // =====================================================
      if (batch) {
        const batchBefore = Number(batch.available_quantity ?? 0);
        const batchAfter = batchBefore + direction * quantity;

        const result = await this.dataService.query('product_batches', {
          update: {
            available_quantity: batchAfter,
            updated_by: adminId,
            updated_at: new Date().toISOString(),
          },
          where: [{ column: 'batch_id', operator: '=', value: body.batch_id }],
        });
        if (!result?.status) {
          this.developer.error('Batch Product Update failed', result);
          throw new InternalServerErrorException(result?.message || 'Database update failed');
        }
      }

      return {
        status: true,
        message: 'Stock movement created successfully',
        id: result.data?.id ?? result.id,
        movement_id: movementId,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
      };

    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.developer.error('saveStockMovement error', { error, body });
      throw new InternalServerErrorException('Failed to create stock movement');
    }
  }

  // =====================================================
  // PICK FIELDS HELPER
  // =====================================================

  private pickFields(
    fields: string[],
    body: any,
  ) {

    const data: Record<
      string,
      any
    > = {};

    for (const field of fields) {

      if (
        body[field] !== undefined
      ) {

        const value =
          typeof body[field] ===
            'string'
            ? body[field].trim()
            : body[field];

        data[field] =
          value === ''
            ? null
            : value;
      }
    }

    return data;
  }

  // =====================================================
  // SAVE INTAKE
  // =====================================================
  async saveIntake(body: any, adminId: string) {
    try {
      const validation = this.formHelper.validateFields(
        [
          { name: 'vendor_id', required: false, type: 'text' },
          { name: 'warehouse_id', required: true, type: 'text' },
          { name: 'product_id', required: true, type: 'text' },
          { name: 'quantity', required: true, type: 'number' },
          { name: 'unit_type', required: true, type: 'text' },
        ],
        body
      );

      if (!validation.valid) {
        throw new BadRequestException({
          status: false,
          message: 'Validation failed',
          errors: validation.errors,
        });
      }

      const intakeId = 'INT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

      const insertData = {
        intake_id: intakeId,
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
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await this.dataService.query('vendor_intakes', {
        insert: insertData,
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to save vendor intake');
      }

      return {
        status: true,
        message: 'Vendor intake saved successfully',
        data: { id: result.data?.id, intake_id: intakeId },
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.developer.error('saveIntake error', { error, body });
      throw new InternalServerErrorException('Failed to save vendor intake');
    }
  }
}