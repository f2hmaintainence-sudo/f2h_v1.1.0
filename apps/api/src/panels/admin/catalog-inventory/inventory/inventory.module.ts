import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryTableService } from './services/table.service';
import { InventoryShowAddService } from './services/showAdd.service';
import { InventorySaveAddService } from './services/saveAdd.service';
import { InventoryShowEditService } from './services/showEdit.service';
import { InventorySaveEditService } from './services/saveEdit.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { InventoryDashboardService } from './services/inventory-dashboard.service';
import { StockMovementCoreService } from './services/stock-movement-core.service';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Module({
  imports: [HelpersModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryTableService,
    InventoryShowAddService,
    InventorySaveAddService,
    InventoryShowEditService,
    InventorySaveEditService,
    InventoryReportsService,
    InventoryDashboardService,
    StockMovementCoreService,
    DeveloperService],
  exports: [InventoryService, InventoryReportsService, InventoryDashboardService, StockMovementCoreService],
})
export class InventoryModule {}
