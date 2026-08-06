import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { WarehouseTableService } from './services/table.service';
import { WarehouseShowAddService } from './services/showAdd.service';
import { WarehouseSaveAddService } from './services/saveAdd.service';
import { WarehouseShowEditService } from './services/showEdit.service';
import { WarehouseSaveEditService } from './services/saveEdit.service';
import { WarehouseDispatchService } from './services/warehouse-dispatch.service';
import { StockMovementCoreService } from '../inventory/services/stock-movement-core.service';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Module({
  imports: [HelpersModule],
  controllers: [WarehouseController],
  providers: [
    WarehouseService,
    WarehouseTableService,
    WarehouseShowAddService,
    WarehouseSaveAddService,
    WarehouseShowEditService,
    WarehouseSaveEditService,
    WarehouseDispatchService,
    StockMovementCoreService,
    DeveloperService],
  exports: [WarehouseService, WarehouseDispatchService, StockMovementCoreService],
})
export class WarehouseModule {}
