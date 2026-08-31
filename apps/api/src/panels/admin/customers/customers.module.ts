import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerTableService } from './services/table.service';
import { CustomerShowAddService } from './services/showAdd.service';
import { CustomerSaveAddService } from './services/saveAdd.service';
import { CustomerShowEditService } from './services/showEdit.service';
import { CustomerSaveEditService } from './services/saveEdit.service';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DataService } from 'src/shared/database/Data.service';
import { DatabaseService } from 'src/shared/database/Database.service';
import { DeveloperService } from 'src/shared/logger/Developer.service';
import { FieldEncryptionModule } from '../../../encryption/field-encryption.module';

import { PushNotificationService } from '../../../shared/pushNotifications/pushNotification.service';

@Module({
  imports: [HelpersModule, FieldEncryptionModule],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomerTableService,
    CustomerShowAddService,
    CustomerSaveAddService,
    CustomerShowEditService,
    CustomerSaveEditService,
    DatabaseService,
    DeveloperService,
    PushNotificationService,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
