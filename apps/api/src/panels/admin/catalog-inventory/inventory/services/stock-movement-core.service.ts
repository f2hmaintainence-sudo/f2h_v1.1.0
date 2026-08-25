import { Injectable, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../../shared/logger/Developer.service';
import { PoolClient } from 'pg';

// ── Types ──

export interface StockMovementInput {
  warehouse_id: string;
  product_variant_id: string;
  movement_type: string;
  direction: 1 | -1;
  quantity: number;
  batch_id?: string;
  unit_cost?: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
}

export interface StockReservationInput {
  warehouse_id: string;
  product_variant_id: string;
  quantity: number;
}

// ── Service ──

@Injectable()
export class StockMovementCoreService {
  private readonly logger = new Logger(StockMovementCoreService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
  ) {}

  // ────────────────────────────────────────────────
  // Generate unique movement ID
  // ────────────────────────────────────────────────
  private generateMovementId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `MOV-${ts}-${rand}`;
  }

  // ────────────────────────────────────────────────
  // Ensure stock_balances row exists (UPSERT)
  // ────────────────────────────────────────────────
  async ensureStockBalance(
    client: PoolClient,
    warehouseId: string,
    productVariantId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO stock_balances (warehouse_id, product_variant_id, available_quantity, reserved_quantity, dispatched_quantity, damaged_quantity)
       VALUES ($1, $2, 0, 0, 0, 0)
       ON CONFLICT (warehouse_id, product_variant_id) DO NOTHING`,
      [warehouseId, productVariantId],
    );
  }

  // ────────────────────────────────────────────────
  // Get current stock with row lock
  // ────────────────────────────────────────────────
  async getLockedStockBalance(
    client: PoolClient,
    warehouseId: string,
    productVariantId: string,
  ): Promise<{
    available_quantity: number;
    reserved_quantity: number;
    dispatched_quantity: number;
    damaged_quantity: number;
  }> {
    await this.ensureStockBalance(client, warehouseId, productVariantId);

    const result = await client.query(
      `SELECT available_quantity, reserved_quantity, dispatched_quantity, damaged_quantity
       FROM stock_balances
       WHERE warehouse_id = $1 AND product_variant_id = $2
       FOR UPDATE`,
      [warehouseId, productVariantId],
    );

    const row = result.rows[0];
    return {
      available_quantity: Number(row.available_quantity),
      reserved_quantity: Number(row.reserved_quantity),
      dispatched_quantity: Number(row.dispatched_quantity),
      damaged_quantity: Number(row.damaged_quantity),
    };
  }

  // ────────────────────────────────────────────────
  // Record a stock movement (core atomic operation)
  // Must be called within a transaction (client)
  // ────────────────────────────────────────────────
  async recordStockMovement(
    client: PoolClient,
    input: StockMovementInput,
  ): Promise<{ movement_id: string; quantity_before: number; quantity_after: number }> {
    const {
      warehouse_id, product_variant_id, movement_type, direction,
      quantity, batch_id, unit_cost, reference_type, reference_id,
      notes, created_by,
    } = input;

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    // 1. Get locked current stock
    const stock = await this.getLockedStockBalance(client, warehouse_id, product_variant_id);
    const quantityBefore = stock.available_quantity;

    // 2. Validate — no negative available stock for OUT movements (except adjustments)
    if (direction === -1 && movement_type !== 'stock_adjustment') {
      if (stock.available_quantity < quantity) {
        const [varRes, whRes] = await Promise.all([
          client.query(
            `SELECT p.product_name, pv.variant_name, pv.unit_value, pv.unit_type
             FROM product_variants pv
             JOIN products p ON p.product_id = pv.product_id
             WHERE pv.product_variant_id = $1`,
            [product_variant_id],
          ),
          client.query(
            `SELECT warehouse_name FROM warehouses WHERE warehouse_id = $1`,
            [warehouse_id],
          ),
        ]);
        const pName = varRes.rows[0]
          ? `${varRes.rows[0].product_name} (${varRes.rows[0].variant_name || `${varRes.rows[0].unit_value || ''} ${varRes.rows[0].unit_type || ''}`.trim()})`
          : product_variant_id;
        const wName = whRes.rows[0]?.warehouse_name || warehouse_id;
        throw new BadRequestException(
          `Insufficient stock for "${pName}" at "${wName}". Available: ${stock.available_quantity}, Requested: ${quantity}`,
        );
      }
    }

    // 3. Compute quantity_after
    const quantityAfter = quantityBefore + (direction * quantity);

    // 4. Insert stock_movements
    const movementId = this.generateMovementId();
    await client.query(
      `INSERT INTO stock_movements
        (movement_id, warehouse_id, product_variant_id, batch_id, movement_type,
         direction, quantity, quantity_before, quantity_after,
         unit_cost, reference_type, reference_id, notes, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, NOW(), NOW())`,
      [
        movementId, warehouse_id, product_variant_id, batch_id || null,
        movement_type, direction, quantity, quantityBefore, quantityAfter,
        unit_cost || null, reference_type || null, reference_id || null,
        notes || null, created_by || 'system',
      ],
    );

    // 5. Update stock_balances available_quantity
    await client.query(
      `UPDATE stock_balances
       SET available_quantity = $3,
           last_stock_update = NOW(),
           updated_at = NOW()
       WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [warehouse_id, product_variant_id, Math.max(0, quantityAfter)],
    );

    // 6. Audit log
    try {
      await client.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          created_by || 'system',
          direction === 1 ? 'stock_in' : 'stock_out',
          'stock_movement',
          movementId,
          JSON.stringify({
            warehouse_id, product_variant_id, movement_type,
            quantity, quantity_before: quantityBefore, quantity_after: quantityAfter,
            reference_type, reference_id,
          }),
        ],
      );
    } catch {
      // Non-critical — don't fail the main operation for audit log failures
    }

    return { movement_id: movementId, quantity_before: quantityBefore, quantity_after: quantityAfter };
  }

  // ────────────────────────────────────────────────
  // Reserve stock (available → reserved)
  // ────────────────────────────────────────────────
  async reserveStock(
    client: PoolClient,
    warehouseId: string,
    productVariantId: string,
    qty: number,
  ): Promise<void> {
    const stock = await this.getLockedStockBalance(client, warehouseId, productVariantId);

    if (stock.available_quantity < qty) {
      throw new BadRequestException(
        `Cannot reserve ${qty}. Available: ${stock.available_quantity}`,
      );
    }

    await client.query(
      `UPDATE stock_balances
       SET available_quantity = available_quantity - $3,
           reserved_quantity = reserved_quantity + $3,
           last_stock_update = NOW(),
           updated_at = NOW()
       WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [warehouseId, productVariantId, qty],
    );
  }

  // ────────────────────────────────────────────────
  // Unreserve stock (reserved → available)
  // ────────────────────────────────────────────────
  async unreserveStock(
    client: PoolClient,
    warehouseId: string,
    productVariantId: string,
    qty: number,
  ): Promise<void> {
    await client.query(
      `UPDATE stock_balances
       SET available_quantity = available_quantity + $3,
           reserved_quantity = GREATEST(reserved_quantity - $3, 0),
           last_stock_update = NOW(),
           updated_at = NOW()
       WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [warehouseId, productVariantId, qty],
    );
  }

  // ────────────────────────────────────────────────
  // Confirm dispatch (reserved → dispatched + movement OUT)
  // ────────────────────────────────────────────────
  async confirmDispatch(
    client: PoolClient,
    warehouseId: string,
    productVariantId: string,
    qty: number,
    referenceType: string,
    referenceId: string,
    createdBy: string,
  ): Promise<{ movement_id: string }> {
    // Move from reserved to dispatched
    await client.query(
      `UPDATE stock_balances
       SET reserved_quantity = GREATEST(reserved_quantity - $3, 0),
           dispatched_quantity = dispatched_quantity + $3,
           last_stock_update = NOW(),
           updated_at = NOW()
       WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [warehouseId, productVariantId, qty],
    );

    // Create the OUT movement
    const result = await this.recordStockMovement(client, {
      warehouse_id: warehouseId,
      product_variant_id: productVariantId,
      movement_type: 'dispatch',
      direction: -1,
      quantity: qty,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: `Dispatch confirmed for ${referenceType} ${referenceId}`,
      created_by: createdBy,
    });

    return { movement_id: result.movement_id };
  }

  // ────────────────────────────────────────────────
  // Record delivery return (dispatched → available + movement IN)
  // ────────────────────────────────────────────────
  async recordReturn(
    client: PoolClient,
    warehouseId: string,
    productVariantId: string,
    qty: number,
    referenceType: string,
    referenceId: string,
    createdBy: string,
  ): Promise<{ movement_id: string }> {
    // Move from dispatched back to available
    await client.query(
      `UPDATE stock_balances
       SET dispatched_quantity = GREATEST(dispatched_quantity - $3, 0),
           available_quantity = available_quantity + $3,
           last_stock_update = NOW(),
           updated_at = NOW()
       WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [warehouseId, productVariantId, qty],
    );

    const result = await this.recordStockMovement(client, {
      warehouse_id: warehouseId,
      product_variant_id: productVariantId,
      movement_type: 'delivery_return',
      direction: 1,
      quantity: qty,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: `Return from ${referenceType} ${referenceId}`,
      created_by: createdBy,
    });

    return { movement_id: result.movement_id };
  }

  // ────────────────────────────────────────────────
  // Record damage (dispatched → damaged + movement OUT)
  // ────────────────────────────────────────────────
  async recordDamage(
    client: PoolClient,
    warehouseId: string,
    productVariantId: string,
    qty: number,
    referenceType: string,
    referenceId: string,
    createdBy: string,
  ): Promise<{ movement_id: string }> {
    await client.query(
      `UPDATE stock_balances
       SET dispatched_quantity = GREATEST(dispatched_quantity - $3, 0),
           damaged_quantity = damaged_quantity + $3,
           last_stock_update = NOW(),
           updated_at = NOW()
       WHERE warehouse_id = $1 AND product_variant_id = $2`,
      [warehouseId, productVariantId, qty],
    );

    const result = await this.recordStockMovement(client, {
      warehouse_id: warehouseId,
      product_variant_id: productVariantId,
      movement_type: 'damage',
      direction: -1,
      quantity: qty,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: `Damaged/wastage from ${referenceType} ${referenceId}`,
      created_by: createdBy,
    });

    return { movement_id: result.movement_id };
  }

  // ────────────────────────────────────────────────
  // Warehouse Transfer (convenience method wrapping transaction)
  // ────────────────────────────────────────────────
  async executeWarehouseTransfer(
    transferId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    productVariantId: string,
    quantity: number,
    adminId: string,
    action: 'dispatch' | 'receive',
  ): Promise<{ status: boolean; message: string }> {
    return this.db.transaction(async (client) => {
      if (action === 'dispatch') {
        // OUT from source warehouse
        await this.recordStockMovement(client, {
          warehouse_id: fromWarehouseId,
          product_variant_id: productVariantId,
          movement_type: 'stock_transfer',
          direction: -1,
          quantity,
          reference_type: 'stock_transfer',
          reference_id: transferId,
          notes: `Transfer OUT to warehouse ${toWarehouseId}`,
          created_by: adminId,
        });

        // Update transfer record
        await client.query(
          `UPDATE stock_transfers
           SET transfer_status = 'dispatched',
               quantity_dispatched = $2,
               dispatched_by = $3,
               dispatched_at = NOW(),
               updated_at = NOW()
           WHERE transfer_id = $1`,
          [transferId, quantity, adminId],
        );
      } else if (action === 'receive') {
        // IN to destination warehouse
        await this.recordStockMovement(client, {
          warehouse_id: toWarehouseId,
          product_variant_id: productVariantId,
          movement_type: 'stock_transfer',
          direction: 1,
          quantity,
          reference_type: 'stock_transfer',
          reference_id: transferId,
          notes: `Transfer IN from warehouse ${fromWarehouseId}`,
          created_by: adminId,
        });

        // Determine status based on received vs total
        const transferResult = await client.query(
          `SELECT quantity, quantity_received FROM stock_transfers WHERE transfer_id = $1`,
          [transferId],
        );
        const transfer = transferResult.rows[0];
        const totalReceived = Number(transfer?.quantity_received || 0) + quantity;
        const totalQuantity = Number(transfer?.quantity || 0);
        const newStatus = totalReceived >= totalQuantity ? 'completed' : 'partially_received';

        await client.query(
          `UPDATE stock_transfers
           SET transfer_status = $2,
               quantity_received = $3,
               received_by = $4,
               received_at = NOW(),
               updated_at = NOW()
           WHERE transfer_id = $1`,
          [transferId, newStatus, totalReceived, adminId],
        );
      }

      return { status: true, message: `Transfer ${action} completed` };
    });
  }
}
