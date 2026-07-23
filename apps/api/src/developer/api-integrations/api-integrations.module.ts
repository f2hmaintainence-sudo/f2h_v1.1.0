// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api-integrations.module.ts
// Description : NestJS Module for Developer API Integrations
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import { Module } from '@nestjs/common';
import { ApiIntegrationsController } from './api-integrations.controller';
import { ApiIntegrationsService } from './api-integrations.service';
import { SharedDatabaseModule } from '../../shared/database/Database.module';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [ApiIntegrationsController],
  providers: [ApiIntegrationsService],
  exports: [ApiIntegrationsService],
})
export class ApiIntegrationsModule {}
