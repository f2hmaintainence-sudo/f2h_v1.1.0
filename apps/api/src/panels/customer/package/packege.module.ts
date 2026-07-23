import { Module } from '@nestjs/common';
import { HelpersModule } from '../../../helpers/Helpers.module';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { DataService } from '../../../shared/database/Data.service';
import { PackageController } from './package.controller';

@Module({
  imports: [HelpersModule],
  controllers: [PackageController],
  providers: [DatabaseService, DeveloperService, DataService],
})
export class CustomerPackageModule {}

