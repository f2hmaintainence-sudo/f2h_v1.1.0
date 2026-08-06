import { Module } from '@nestjs/common';
import { HelpersModule } from '../../../../helpers/Helpers.module';
import { DatabaseService } from '../../../../shared/database/Database.service';
import { DeveloperService } from '../../../../shared/logger/Developer.service';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';

@Module({
  imports: [HelpersModule],
  controllers: [PackageController],
  providers: [PackageService,  DeveloperService],
  exports: [PackageService],
})
export class PackageModule {}
