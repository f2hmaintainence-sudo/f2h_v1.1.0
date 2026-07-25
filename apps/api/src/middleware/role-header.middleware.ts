// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : role-header.middleware.ts
// Description : Maps compact request header codes to full internal values.
//               X-Role (C/D/A) → x-role (CUSTOMER/DELIVERY_BOY/ADMIN)
//               X-Plt  (ac/ic/ad/id) → x-app-platform (android_customer etc.)
//               X-Ver  (semver) → x-app-version
//               X-Csrf (uuid)   → x-csrf-token
//               This ensures zero breaking changes to downstream guards and
//               services while keeping the wire-format as small as possible.
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RoleHeaderMiddleware implements NestMiddleware {
  /** Single-char code → full CUSTOMER/DELIVERY_BOY/ADMIN role string */
  private static readonly ROLE_MAP: Record<string, string> = {
    C: 'CUSTOMER',
    D: 'DELIVERY_PARTNER',
    A: 'ADMIN',
  };

  /** Two-char code → full platform string expected by downstream services */
  private static readonly PLT_MAP: Record<string, string> = {
    ac: 'android_customer',
    ic: 'ios_customer',
    ad: 'android_delivery',
    id: 'ios_delivery',
    wc: 'web_customer',
    wd: 'web_delivery',
  };

  use(req: Request, _res: Response, next: NextFunction): void {
    const role = (req.headers['x-role'] as string | undefined)?.trim();
    const plt = (req.headers['x-plt'] as string | undefined)?.trim();
    const ver = (req.headers['x-ver'] as string | undefined)?.trim();
    const csrf = (req.headers['x-csrf'] as string | undefined)?.trim();

    // Expand compact role code → full role string consumed by JwtStrategy / AuthController
    if (role) {
      req.headers['x-role'] =
        RoleHeaderMiddleware.ROLE_MAP[role.toUpperCase()] ?? role;
    }

    // Expand compact platform code → full platform string
    if (plt) {
      req.headers['x-app-platform'] =
        RoleHeaderMiddleware.PLT_MAP[plt.toLowerCase()] ?? plt;
    }

    // Pass version through as-is (already a semver string)
    if (ver) {
      req.headers['x-app-version'] = ver;
    }

    // Expand compact CSRF header → canonical header name for CsrfService
    if (csrf) {
      req.headers['x-csrf-token'] = csrf;
    }

    next();
  }
}
