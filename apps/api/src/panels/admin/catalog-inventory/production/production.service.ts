import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ProductionTableService } from './services/table.service';
import { DataService } from '../../../../shared/database/Data.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';



@Injectable()
export class ProductionService {
  constructor(
    private readonly tableService: ProductionTableService,
    private readonly dataService: DataService,
    private readonly developer: DeveloperService,
  ) {}

  async getProductionTable(query: any) {
    return this.tableService.getProductionTable(query);
  }

  async getPlanningTable(query: any) {
    return this.tableService.getPlanningTable(query);
  }

  async updatePlanningStatus(id: string, status: string, adminId: string) {
    try {
      // 1. Get plan details
      const planResult = await this.dataService.query('production_plans', {
        where: [{ column: 'id', operator: '=', value: Number(id) }],
        limit: 1,
      });

      if (!planResult?.data?.length) {
        throw new InternalServerErrorException('Production plan not found');
      }

      const plan = planResult.data[0];

      // 2. Update status
      const updateData: any = {
        production_status: status,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      };

      if (status === 'in_progress' && !plan.started_at) {
        updateData.started_at = new Date().toISOString();
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.produced_quantity = plan.planned_quantity; // Assume full production for now
      }

      await this.dataService.query('production_plans', {
        update: updateData,
        where: [{ column: 'id', operator: '=', value: Number(id) }],
      });

      // 3. Automation if completed
      if (status === 'completed') {
        await this.handleProductionCompletion(plan, adminId);
      }

      return { status: true, message: `Production plan updated to ${status}` };
    } catch (error) {
      this.developer.error('updatePlanningStatus error', { error, id, status });
      throw new InternalServerErrorException('Failed to update production status');
    }
  }

  private async handleProductionCompletion(plan: any, adminId: string) {
    try {
      // A. Create Product Batch
      const batchId = `BATCH-${Date.now()}`;
      await this.dataService.insert('product_batches', {
        batch_id: batchId,
        warehouse_id: plan.warehouse_id,
        product_id: plan.product_id,
        variant_id: plan.variant_id,
        quantity: plan.planned_quantity,
        available_quantity: plan.planned_quantity,
        status: 'active',
        manufactured_at: new Date().toISOString(),
        created_by: adminId,
        updated_by: adminId,
      });

      // B. Create Stock IN for Finished Good
      await this.dataService.insert('stock_movements', {
        variant_id: plan.variant_id,
        warehouse_id: plan.warehouse_id,
        movement_type: 'in',
        quantity: plan.planned_quantity,
        reason: 'Production Completion',
        reference_type: 'production_plan',
        reference_id: String(plan.id),
        created_by: adminId,
      });

      // C. Consume Raw Material (Stock OUT for Raw Milk)
      // We need to find the Raw Milk variant. 
      // This is a simplified logic. Ideally, use a BOM table.
      const rawMilkResult = await this.dataService.query('product_variants', {
        select: ['id'],
        where: [{ column: 'name', operator: 'LIKE', value: '%Raw Milk%' }],
        limit: 1,
      });

      if (rawMilkResult?.data?.length) {
        const rawMilkId = rawMilkResult.data[0].id;
        const rawQty = plan.raw_material_required || (plan.planned_quantity * 1.05);

        await this.dataService.insert('stock_movements', {
          variant_id: rawMilkId,
          warehouse_id: plan.warehouse_id,
          movement_type: 'out',
          quantity: rawQty,
          reason: `Consumption for Production Plan ${plan.production_id}`,
          reference_type: 'production_plan',
          reference_id: String(plan.id),
          created_by: adminId,
        });
        
        // Update raw material consumed in plan
        await this.dataService.query('production_plans', {
            update: { raw_material_consumed: rawQty },
            where: [{ column: 'id', operator: '=', value: plan.id }],
        });
      }
    } catch (error) {
      this.developer.error('handleProductionCompletion error', { error, plan });
      // We don't throw here to avoid failing the status update, 
      // but in production we might want atomic transactions.
    }
  }

  async deleteProduction(id: string, adminId: string) {
    try {
      const result = await this.dataService.delete('product_batches', [
        { column: 'id', operator: '=', value: Number(id) },
      ]);

      if (!result?.status) {
        throw new InternalServerErrorException('Failed to delete production batch');
      }

      return { status: true, message: 'Production batch deleted successfully' };
    } catch (error) {
      this.developer.error('deleteProduction error', { error, id, adminId });
      throw new InternalServerErrorException('Failed to delete production batch');
    }
  }
}
