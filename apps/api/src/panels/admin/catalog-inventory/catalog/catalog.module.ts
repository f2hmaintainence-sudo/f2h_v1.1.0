import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './services/catalog.service';
import { CatalogTableService } from './services/table.service';
import { CatalogShowAddService } from './services/showAdd.service';
import { CatalogSaveAddService } from './services/saveAdd.service';
import { CatalogShowEditService } from './services/showEdit.service';
import { CatalogSaveEditService } from './services/saveEdit.service';
import { CatalogSubscriptionConfigService } from './services/subscriptionConfig.service';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { FieldEncryptionModule } from '../../../../encryption/field-encryption.module';
import { LocalStorageService } from '../../../../shared/services/storage.service';
import { AdminAuthModule } from 'src/panels/admin/auth/auth.module';

import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';

@Module({
  imports: [HelpersModule, FieldEncryptionModule, AdminAuthModule],
  controllers: [CatalogController, ContainersController],
  providers: [
    CatalogService,
    CatalogTableService,
    CatalogShowAddService,
    CatalogSaveAddService,
    CatalogShowEditService,
    CatalogSaveEditService,
    CatalogSubscriptionConfigService,
    ContainersService,
    
    DeveloperService,
    LocalStorageService],
})
export class CatalogModule { }
