// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.guard.ts
// Description : Global guard enforcing `@RequireIntegrity()`.
//
//               Registered in AppModule after JwtAuthGuard and RolesGuard, so
//               authentication and role checks decide first and an unauthorised
//               caller still gets 401/403 rather than an integrity error. On a
//               route with no `@RequireIntegrity()` metadata this guard returns
//               immediately, which is every browsing, catalog and read-only
//               endpoint in the API.
//
//               Failures are logged with a machine-readable reason and the
//               verdict summary. The client is told only that the app could not
//               be verified — Google's decoded payload never leaves the server.
// ============================================================================

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DeveloperService } from '../logger/Developer.service';
import {
  INTEGRITY_CLIENT_ERROR_CODE,
  INTEGRITY_CLIENT_MESSAGE,
  INTEGRITY_NONCE_HEADER,
  INTEGRITY_TOKEN_HEADER,
  INTEGRITY_UNAVAILABLE_HEADER,
} from './play-integrity.constants';
import { PlayIntegrityService } from './play-integrity.service';
import { REQUIRE_INTEGRITY_KEY } from './decorators/require-integrity.decorator';
import { IntegrityAppId } from './play-integrity.types';

@Injectable()
export class PlayIntegrityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly integrity: PlayIntegrityService,
    private readonly developer: DeveloperService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const app = this.reflector.getAllAndOverride<IntegrityAppId>(
      REQUIRE_INTEGRITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Not a protected route — no token requested, nothing logged, no latency.
    if (!app) return true;

    if (!this.integrity.isEnabled()) return true;

    const request = context.switchToHttp().getRequest();
    const headers = request.headers || {};
    const token = this.firstHeader(headers[INTEGRITY_TOKEN_HEADER]);
    const nonce = this.firstHeader(headers[INTEGRITY_NONCE_HEADER]);
    const unavailable = this.firstHeader(headers[INTEGRITY_UNAVAILABLE_HEADER]);

    const result = await this.integrity.verify({
      app,
      token: token || '',
      nonce,
      method: request.method,
      path: this.resolvePath(request),
    });

    if (result.ok) return true;

    const context_ = {
      app,
      reason: result.reason,
      detail: result.detail,
      route: `${request.method} ${this.resolvePath(request)}`,
      userId: request.user?.user_id,
      clientReportedUnavailable: unavailable || undefined,
      verdict: result.summary,
    };

    if (!this.integrity.isEnforcing()) {
      // Monitor mode: surface the verdict, let the customer through. This is
      // how a rollout is observed before it starts rejecting real traffic.
      this.developer.warn(
        '[PlayIntegrity] Verification failed (monitor mode, request allowed)',
        context_,
      );
      return true;
    }

    this.developer.warn('[PlayIntegrity] Verification failed', context_);

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: INTEGRITY_CLIENT_ERROR_CODE,
      message: INTEGRITY_CLIENT_MESSAGE,
    });
  }

  private firstHeader(value: unknown): string | undefined {
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value.trim() || undefined;
    return undefined;
  }

  /** Request path without the query string, matching what the client hashed. */
  private resolvePath(request: any): string {
    const raw: string = request.originalUrl || request.url || '';
    const cut = raw.indexOf('?');
    return cut === -1 ? raw : raw.slice(0, cut);
  }
}
