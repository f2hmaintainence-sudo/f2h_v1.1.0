import { Module } from '@nestjs/common';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { FieldEncryptionModule } from '../../../../encryption/field-encryption.module';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsSaveEditService } from './services/saveEdit.service';
import { SubscriptionsSaveAddService } from './services/saveAdd.service';
import { SubscriptionsShowEditService } from './services/showEdit.service';
import { SubscriptionsShowAddService } from './services/showAdd.service';
import { SubscriptionsTableService } from './services/table.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatusModule } from './status/subscription-status.module';

@Module({
  imports: [HelpersModule, FieldEncryptionModule, SubscriptionStatusModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionsTableService,
    SubscriptionsShowAddService,
    SubscriptionsSaveAddService,
    SubscriptionsShowEditService,
    SubscriptionsSaveEditService,
    DatabaseService,
    DeveloperService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
