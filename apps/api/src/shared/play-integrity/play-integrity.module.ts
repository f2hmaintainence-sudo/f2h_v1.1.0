// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.module.ts
// Description : Global module exposing Play Integrity verification.
//
//               Global for the same reason PaymentGatewayModule is: the guard
//               is registered once in AppModule and must be constructible
//               without every feature module importing this one.
// ============================================================================

import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PlayIntegrityGuard } from './play-integrity.guard';
import { PlayIntegrityService } from './play-integrity.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [PlayIntegrityService, PlayIntegrityGuard],
  exports: [PlayIntegrityService, PlayIntegrityGuard],
})
export class PlayIntegrityModule {}

export * from './play-integrity.constants';
export * from './play-integrity.types';
export * from './decorators/require-integrity.decorator';
