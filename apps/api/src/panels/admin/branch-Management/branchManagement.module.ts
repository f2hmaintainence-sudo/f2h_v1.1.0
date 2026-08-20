import { Module } from '@nestjs/common';
import { BranchController } from './controllers/branch.controller';
import { BranchManagementService } from './ModuleServices/branchManagement.service';
import { CustomerTableService, StaffsTableService } from './services/table.service';
import { BranchShowAddService, StaffsShowAddService } from './services/showAdd.service';
import { BranchSaveAddService, StaffsSaveAddService } from './services/saveAdd.service';
import { BranchShowEditService, StaffsShowEditService } from './services/showEdit.service';
import { BranchSaveEditService, StaffsSaveEditService } from './services/saveEdit.service';
import { SectorService } from './ModuleServices/sector.service';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { FieldEncryptionModule } from '../../../encryption/field-encryption.module';
import { IdGeneratorService } from 'src/shared/services/idGenerator.service';
import { ZoneController } from './controllers/zone.controller';
import { CustomerController } from './controllers/customer.controller';
import { MigrationController } from './controllers/migration.controller';
import { DeliveryProofController } from './controllers/delivery-proof.controller';
import { DeliveryProofService } from './services/delivery-proof.service';
import { DeliveryRunsAdminController } from './controllers/delivery-runs.admin.controller';
import { StaffsrController } from './controllers/staff.controller';
import { BranchConfigController } from './branch-config.controller';
import { BranchConfigService } from './branch-config.service';
import { RedisModule } from 'src/shared/redis/redis.module';
import { DeliveryManagementModule } from '../delivery/delivery.module';

@Module({
  imports: [HelpersModule, FieldEncryptionModule, RedisModule, DeliveryManagementModule],
  controllers: [
    BranchController,
    ZoneController,
    CustomerController,
    MigrationController,
    DeliveryProofController,

    DeliveryRunsAdminController,
    StaffsrController,
    BranchConfigController,
    // NOTE: BranchBoundariesController removed — it was a duplicate of BranchController on api/branch
  ],
  providers: [
    BranchManagementService,
    CustomerTableService,
    StaffsTableService,
    BranchShowAddService,
    StaffsShowAddService,
    BranchSaveAddService,
    StaffsSaveAddService,
    BranchShowEditService,
    StaffsShowEditService,
    BranchSaveEditService,
    StaffsSaveEditService,
    SectorService,
    DeliveryProofService,
    BranchConfigService,
    DeveloperService,
    IdGeneratorService],
  exports: [BranchManagementService, BranchConfigService],
})
export class BranchManagementModule { }
