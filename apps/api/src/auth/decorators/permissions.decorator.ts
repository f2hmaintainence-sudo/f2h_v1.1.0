// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : permissions.decorator.ts
// Description : Decorator for tagging routes with granular RBAC permissions
//
// ============================================================================

import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restricts a controller or handler to users possessing at least one of the specified
 * granular permission keys (e.g. 'system.roles', 'dashboard.view', 'staff.manage').
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const Permissions = RequirePermissions;
