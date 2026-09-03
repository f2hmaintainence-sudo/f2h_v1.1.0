// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : require-integrity.decorator.ts
// Description : Marks a controller or handler as requiring a verified Google
//               Play Integrity token from a specific F2H application.
//
//               Follows the same `SetMetadata` + `Reflector` shape as the
//               existing `@Public()` and `@Roles()` decorators, so the check
//               lives in one global guard instead of being repeated in every
//               controller. This is an ADDITIONAL layer: JWT authentication
//               and RBAC still run, and still run first.
//
// Usage:
//   @RequireIntegrity('customer')
//   @Post('topup')
//   walletTopup() { … }
// ============================================================================

import { SetMetadata } from '@nestjs/common';
import { IntegrityAppId } from '../play-integrity.types';

export const REQUIRE_INTEGRITY_KEY = 'requireIntegrity';

/**
 * @param app Which F2H application may satisfy this route. Declared on the
 *            server so a token minted by the delivery build can never be
 *            replayed against a customer-only endpoint, and vice versa.
 */
export const RequireIntegrity = (app: IntegrityAppId) =>
  SetMetadata(REQUIRE_INTEGRITY_KEY, app);
