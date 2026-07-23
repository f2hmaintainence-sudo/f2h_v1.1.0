import { Module } from '@nestjs/common';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { FieldEncryptionModule } from '../../../../encryption/field-encryption.module';
import { DataService } from '../../../../shared/database/Data.service';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { PdfModule } from '../../../../common/pdf/pdf.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersTableService } from './services/table.service';

@Module({
  imports: [HelpersModule, FieldEncryptionModule, PdfModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersTableService,
    DeveloperService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
