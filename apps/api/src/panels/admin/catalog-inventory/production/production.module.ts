import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { ProductionTableService } from './services/table.service';
import { ProductionShowAddService } from './services/showAdd.service';
import { ProductionSaveAddService } from './services/saveAdd.service';
import { ProductionShowEditService } from './services/showEdit.service';
import { ProductionSaveEditService } from './services/saveEdit.service';
import { BatchProductionService } from './services/batch-production.service';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';

@Module({
  imports: [HelpersModule],
  controllers: [ProductionController],
  providers: [
    ProductionService,
    ProductionTableService,
    ProductionShowAddService,
    ProductionSaveAddService,
    ProductionShowEditService,
    ProductionSaveEditService,
    BatchProductionService,
    DeveloperService,
  ],
  exports: [ProductionService, BatchProductionService],
})
export class ProductionModule {}
