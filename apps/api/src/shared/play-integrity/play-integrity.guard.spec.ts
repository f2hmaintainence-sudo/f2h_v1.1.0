// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.guard.spec.ts
// Description : Guard-level tests — routing of the decorator metadata, the
//               read-only pass-through, monitor mode, and the shape of the
//               error the client is allowed to see.
// ============================================================================

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlayIntegrityGuard } from './play-integrity.guard';
import {
  INTEGRITY_CLIENT_ERROR_CODE,
  INTEGRITY_NONCE_HEADER,
  INTEGRITY_TOKEN_HEADER,
} from './play-integrity.constants';
import { INTEGRITY_FAILURE } from './play-integrity.types';

const buildContext = (
  request: Record<string, any> = {},
): ExecutionContext =>
  ({
    getType: () => 'http',
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/api/v1/customer/wallet/topup',
        headers: {},
        ...request,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('PlayIntegrityGuard', () => {
  let reflector: Reflector;
  let integrity: {
    isEnabled: jest.Mock;
    isEnforcing: jest.Mock;
    verify: jest.Mock;
  };
  let developer: { warn: jest.Mock; info: jest.Mock; error: jest.Mock };
  let guard: PlayIntegrityGuard;

  beforeEach(() => {
    reflector = new Reflector();
    integrity = {
      isEnabled: jest.fn().mockReturnValue(true),
      isEnforcing: jest.fn().mockReturnValue(true),
      verify: jest.fn().mockResolvedValue({ ok: true }),
    };
    developer = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    guard = new PlayIntegrityGuard(
      reflector,
      integrity as any,
      developer as any,
    );
  });

  const withMetadata = (app: string | undefined) =>
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(app as any);

  // ── Test 4 / 8: read-only and unprotected routes are untouched ───────────
  it('allows a route with no @RequireIntegrity metadata without verifying', async () => {
    withMetadata(undefined);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(integrity.verify).not.toHaveBeenCalled();
  });

  // ── Test 13: debug/local builds are unaffected when the feature is off ──
  it('allows a protected route when the feature is disabled', async () => {
    withMetadata('customer');
    integrity.isEnabled.mockReturnValue(false);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(integrity.verify).not.toHaveBeenCalled();
  });

  // ── Test 2: valid token on a protected route ────────────────────────────
  it('allows a protected route when verification succeeds', async () => {
    withMetadata('customer');
    const context = buildContext({
      headers: {
        [INTEGRITY_TOKEN_HEADER]: 'token-value',
        [INTEGRITY_NONCE_HEADER]: 'nonce-value',
      },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(integrity.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'customer',
        token: 'token-value',
        nonce: 'nonce-value',
        method: 'POST',
        path: '/api/v1/customer/wallet/topup',
      }),
    );
  });

  it('passes the app declared by the decorator, not any client header', async () => {
    withMetadata('delivery');
    await guard.canActivate(
      buildContext({
        headers: {
          [INTEGRITY_TOKEN_HEADER]: 'token-value',
          [INTEGRITY_NONCE_HEADER]: 'nonce-value',
          // A hostile client claiming to be the customer app changes nothing.
          'x-role': 'C',
          'x-plt': 'ac',
        },
      }),
    );
    expect(integrity.verify).toHaveBeenCalledWith(
      expect.objectContaining({ app: 'delivery' }),
    );
  });

  it('strips the query string before hashing the path', async () => {
    withMetadata('delivery');
    await guard.canActivate(
      buildContext({
        originalUrl: '/api/v1/delivery-partner/basket/reconcile?run_id=R1',
        headers: {
          [INTEGRITY_TOKEN_HEADER]: 't',
          [INTEGRITY_NONCE_HEADER]: 'n',
        },
      }),
    );
    expect(integrity.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/v1/delivery-partner/basket/reconcile',
      }),
    );
  });

  // ── Test 3 / 7: missing or invalid token is rejected ────────────────────
  it('rejects a protected route when verification fails', async () => {
    withMetadata('customer');
    integrity.verify.mockResolvedValue({
      ok: false,
      reason: INTEGRITY_FAILURE.MISSING_TOKEN,
      detail: 'no token header',
    });
    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ── Never leak Google's verdict detail to the client ────────────────────
  it('returns a generic, non-revealing error to the client', async () => {
    withMetadata('customer');
    integrity.verify.mockResolvedValue({
      ok: false,
      reason: INTEGRITY_FAILURE.DEVICE_VERDICT,
      detail: 'missing MEETS_DEVICE_INTEGRITY',
      summary: { packageName: 'com.f2h.customer', appVerdict: 'PLAY_RECOGNIZED' },
    });

    let thrown: ForbiddenException | undefined;
    try {
      await guard.canActivate(buildContext());
    } catch (error) {
      thrown = error as ForbiddenException;
    }

    const body = JSON.stringify(thrown?.getResponse());
    expect(thrown?.getStatus()).toBe(403);
    expect(body).toContain(INTEGRITY_CLIENT_ERROR_CODE);
    expect(body).not.toContain('MEETS_DEVICE_INTEGRITY');
    expect(body).not.toContain('DEVICE_VERDICT');
    // …while the server-side log keeps the full reason.
    expect(developer.warn).toHaveBeenCalledWith(
      expect.stringContaining('Verification failed'),
      expect.objectContaining({ reason: INTEGRITY_FAILURE.DEVICE_VERDICT }),
    );
  });

  // ── Monitor mode: observe first, reject later ───────────────────────────
  it('logs but allows the request in monitor mode', async () => {
    withMetadata('customer');
    integrity.isEnforcing.mockReturnValue(false);
    integrity.verify.mockResolvedValue({
      ok: false,
      reason: INTEGRITY_FAILURE.APP_VERDICT,
    });
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(developer.warn).toHaveBeenCalledWith(
      expect.stringContaining('monitor mode'),
      expect.any(Object),
    );
  });

  it('ignores non-HTTP execution contexts', async () => {
    const wsContext = { getType: () => 'ws' } as unknown as ExecutionContext;
    await expect(guard.canActivate(wsContext)).resolves.toBe(true);
  });
});
