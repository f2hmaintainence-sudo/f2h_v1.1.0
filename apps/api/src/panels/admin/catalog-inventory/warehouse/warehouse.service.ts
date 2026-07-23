import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { WarehouseTableService } from './services/table.service';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { StockMovementCoreService } from '../inventory/services/stock-movement-core.service';

@Injectable()
export class WarehouseService {
  constructor(
    private readonly tableService: WarehouseTableService,
    private readonly dataService: DataService,
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly stockCore: StockMovementCoreService,
  ) {}

  // =====================================================
  // WAREHOUSE TABLE
  // =====================================================

  async getWarehouseTable(query: any) {
    return this.tableService.getWarehouseTable(query);
  }

  async getActiveWarehouses() {
    try {
      const res = await this.dataService.query('warehouses', {
        select: ['id', 'warehouse_id', 'name'],
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
      return { status: true, data: res?.data || [] };
    } catch (error) {
      this.developer.error('getActiveWarehouses error', { error });
      throw new InternalServerErrorException('Failed to retrieve active warehouses');
    }
  }
  // =====================================================
  // STACK TABLE
  // =====================================================

  async getStockTable(query: any) {
    return this.tableService.getStockTable(query);
  }
  // =====================================================
  // STOCK MOVEMENT TABLE
  // =====================================================

  async getStockMovementTable(query: any) {
    return this.tableService.getStockMovementTable(query);
  }

  // =====================================================
  // STOCK TRANSFERS
  // =====================================================

  async getTransferTable(query: any) {
    return this.tableService.getTransferTable(query);
  }

  async approveTransfer(id: string, adminId: string) {
    try {
      // Get transfer details first
      const transfers = await this.db.query(
        `SELECT * FROM stock_transfers WHERE id = $1`,
        [Number(id)],
      );

      if (!transfers[0]) {
        throw new BadRequestException('Transfer not found');
      }

      const transfer = transfers[0];

      if (transfer.transfer_status !== 'pending') {
        throw new BadRequestException(
          `Cannot approve transfer in status: ${transfer.transfer_status}`,
        );
      }

      await this.db.query(
        `UPDATE stock_transfers
         SET transfer_status = 'approved',
             approved_by = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [Number(id), adminId],
      );

      return {
        status: true,
        message: 'Transfer approved successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.developer.error('approveTransfer error', { error, id });
      throw new InternalServerErrorException('Failed to approve transfer');
    }
  }

  async dispatchTransfer(id: string, quantity: number, adminId: string) {
    try {
      // Get transfer details
      const transfers = await this.db.query(
        `SELECT * FROM stock_transfers WHERE id = $1`,
        [Number(id)],
      );

      if (!transfers[0]) {
        throw new BadRequestException('Transfer not found');
      }

      const transfer = transfers[0];

      if (!['approved', 'pending'].includes(transfer.transfer_status)) {
        throw new BadRequestException(
          `Cannot dispatch transfer in status: ${transfer.transfer_status}`,
        );
      }

      const dispatchQty = quantity || Number(transfer.quantity);

      // Use transactional stock movement for dispatch
      return await this.stockCore.executeWarehouseTransfer(
        transfer.transfer_id,
        transfer.from_warehouse_id,
        transfer.to_warehouse_id,
        transfer.product_variant_id,
        dispatchQty,
        adminId,
        'dispatch',
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof InternalServerErrorException) throw error;
      this.developer.error('dispatchTransfer error', { error, id });
      throw new InternalServerErrorException('Failed to dispatch transfer');
    }
  }

  async receiveTransfer(id: string, quantity: number, adminId: string) {
    try {
      // Get transfer details
      const transfers = await this.db.query(
        `SELECT * FROM stock_transfers WHERE id = $1`,
        [Number(id)],
      );

      if (!transfers[0]) {
        throw new BadRequestException('Transfer not found');
      }

      const transfer = transfers[0];

      if (!['dispatched', 'partially_received'].includes(transfer.transfer_status)) {
        throw new BadRequestException(
          `Cannot receive transfer in status: ${transfer.transfer_status}`,
        );
      }

      const receiveQty = quantity || Number(transfer.quantity_dispatched);

      // Use transactional stock movement for receive
      return await this.stockCore.executeWarehouseTransfer(
        transfer.transfer_id,
        transfer.from_warehouse_id,
        transfer.to_warehouse_id,
        transfer.product_variant_id,
        receiveQty,
        adminId,
        'receive',
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof InternalServerErrorException) throw error;
      this.developer.error('receiveTransfer error', { error, id });
      throw new InternalServerErrorException('Failed to receive transfer');
    }
  }

  // =====================================================
  // SOFT DELETE WAREHOUSE
  // =====================================================

  async softDeleteWarehouse(id: string, adminId: string) {
    try {
      const result = await this.dataService.query('warehouses', {
        update: {
          deleted_at: new Date().toISOString(),
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        where: [
          { column: 'id', operator: '=', value: Number(id) },
        ],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete warehouse');
      }

      return { status: true, message: 'Warehouse deleted successfully' };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.developer.error('softDeleteWarehouse error', { error, id });
      throw new InternalServerErrorException('Failed to delete warehouse');
    }
  }

  // =====================================================
  // VENDOR INTAKES
  // =====================================================

  async getIntakeTable(query: any) {
    return this.tableService.getIntakeTable(query);
  }

  async softDeleteIntake(id: string, adminId: string) {
    try {
      const result = await this.dataService.query('vendor_intakes', {
        update: {
          deleted_at: new Date().toISOString(),
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        where: [
          { column: 'id', operator: '=', value: Number(id) },
        ],
      });

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete intake');
      }

      return { status: true, message: 'Intake deleted successfully' };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.developer.error('softDeleteIntake error', { error, id });
      throw new InternalServerErrorException('Failed to delete intake');
    }
  }
}