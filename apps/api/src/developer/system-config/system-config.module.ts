// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : system-config.module.ts
// Description : NestJS Module for Developer System Configurations
// ============================================================================

import { Module } from '@nestjs/common';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { DatabaseService } from '../../shared/database/Database.service';
import { DeveloperService } from '../../shared/logger/Developer.service';

@Module({
  controllers: [SystemConfigController],
  providers: [DatabaseService, DeveloperService, SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
