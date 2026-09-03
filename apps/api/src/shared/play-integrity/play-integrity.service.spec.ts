// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.service.spec.ts
// Description : Verdict-evaluation and lifecycle tests for PlayIntegrityService.
//
//               These exercise the decision layer directly with synthetic
//               `tokenPayloadExternal` payloads, so they assert the security
//               rules without reaching Google.
// ============================================================================

import { createHash } from 'crypto';
import { PlayIntegrityService } from './play-integrity.service';
import { loadPlayIntegrityConfig } from './play-integrity.config';
import {
  INTEGRITY_FAILURE,
  IntegrityTokenPayload,
} from './play-integrity.types';

const CUSTOMER_PACKAGE = 'com.f2h.customer';
const DELIVERY_PACKAGE = 'com.f2h.delivery';

const METHOD = 'POST';
const PATH = '/api/v1/customer/wallet/topup';
const NONCE = 'nonce-abc-123';

const requestHash = (method = METHOD, path = PATH, nonce = NONCE) =>
  createHash('sha256')
    .update(`${method.toUpperCase()}|${path}|${nonce}`, 'utf8')
    .digest('hex');

const buildPayload = (
  overrides: Partial<IntegrityTokenPayload> = {},
): IntegrityTokenPayload => ({
  requestDetails: {
    requestPackageName: CUSTOMER_PACKAGE,
    requestHash: requestHash(),
    timestampMillis: String(Date.now()),
  },
  appIntegrity: {
    appRecognitionVerdict: 'PLAY_RECOGNIZED',
    packageName: CUSTOMER_PACKAGE,
    certificateSha256Digest: ['digest-a'],
    versionCode: '22',
  },
  deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] },
  accountDetails: { appLicensingVerdict: 'LICENSED' },
  environmentDetails: { playProtectVerdict: 'NO_ISSUES' },
  ...overrides,
});

describe('PlayIntegrityService', () => {
  let service: PlayIntegrityService;
  let redis: { acquireLock: jest.Mock };
  let developer: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let db: { query: jest.Mock };

  const configure = (env: Record<string, string> = {}) => {
    service.setConfigForTesting(
      loadPlayIntegrityConfig({
        PLAY_INTEGRITY_ENABLED: 'true',
        PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER: '842214638527',
        PLAY_INTEGRITY_CUSTOMER_PACKAGE: CUSTOMER_PACKAGE,
        PLAY_INTEGRITY_DELIVERY_PACKAGE: DELIVERY_PACKAGE,
        ...env,
      } as NodeJS.ProcessEnv),
    );
  };

  beforeEach(() => {
    redis = { acquireLock: jest.fn().mockResolvedValue(true) };
    developer = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    db = { query: jest.fn().mockResolvedValue([]) };
    service = new PlayIntegrityService(db as any, developer as any, redis as any);
    configure();
  });

  const evaluateCustomer = (payload: IntegrityTokenPayload) =>
    service.evaluate(payload, {
      app: 'customer',
      token: 'opaque',
      nonce: NONCE,
      method: METHOD,
      path: PATH,
    });

  // ── Test 2 / 6: a genuine token from the right app is accepted ───────────
  it('accepts a fully valid customer verdict', () => {
    expect(evaluateCustomer(buildPayload()).ok).toBe(true);
  });

  it('accepts a fully valid delivery verdict on a delivery route', () => {
    const deliveryPath = '/api/v1/delivery-partner/orders/run/R1/handover';
    const payload = buildPayload({
      requestDetails: {
        requestPackageName: DELIVERY_PACKAGE,
        requestHash: requestHash(METHOD, deliveryPath, NONCE),
        timestampMillis: String(Date.now()),
      },
      appIntegrity: {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        packageName: DELIVERY_PACKAGE,
      },
    });
    const result = service.evaluate(payload, {
      app: 'delivery',
      token: 'opaque',
      nonce: NONCE,
      method: METHOD,
      path: deliveryPath,
    });
    expect(result.ok).toBe(true);
  });

  // ── Test 9: wrong application / package identity is rejected ─────────────
  it('rejects a delivery token presented on a customer route', () => {
    const payload = buildPayload({
      requestDetails: {
        requestPackageName: DELIVERY_PACKAGE,
        requestHash: requestHash(),
        timestampMillis: String(Date.now()),
      },
      appIntegrity: {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        packageName: DELIVERY_PACKAGE,
      },
    });
    const result = evaluateCustomer(payload);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(INTEGRITY_FAILURE.PACKAGE_MISMATCH);
  });

  it('rejects a payload that carries no package name at all', () => {
    const result = evaluateCustomer(
      buildPayload({
        requestDetails: {
          requestHash: requestHash(),
          timestampMillis: String(Date.now()),
        },
        appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
      }),
    );
    expect(result.reason).toBe(INTEGRITY_FAILURE.PACKAGE_MISMATCH);
  });

  // ── App / device / licensing / Play Protect verdicts ─────────────────────
  it('rejects a sideloaded or repackaged build', () => {
    const result = evaluateCustomer(
      buildPayload({
        appIntegrity: {
          appRecognitionVerdict: 'UNRECOGNIZED_VERSION',
          packageName: CUSTOMER_PACKAGE,
        },
      }),
    );
    expect(result.reason).toBe(INTEGRITY_FAILURE.APP_VERDICT);
  });

  it('rejects a device that does not meet device integrity', () => {
    const result = evaluateCustomer(
      buildPayload({
        deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_BASIC_INTEGRITY'] },
      }),
    );
    expect(result.reason).toBe(INTEGRITY_FAILURE.DEVICE_VERDICT);
  });

  it('accepts an emulator when virtual integrity is explicitly allowed', () => {
    configure({
      PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICTS: 'MEETS_VIRTUAL_INTEGRITY',
    });
    const result = evaluateCustomer(
      buildPayload({
        deviceIntegrity: {
          deviceRecognitionVerdict: ['MEETS_VIRTUAL_INTEGRITY'],
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects an unlicensed install', () => {
    const result = evaluateCustomer(
      buildPayload({ accountDetails: { appLicensingVerdict: 'UNLICENSED' } }),
    );
    expect(result.reason).toBe(INTEGRITY_FAILURE.LICENSING_VERDICT);
  });

  it('rejects a blocked Play Protect verdict when one is configured', () => {
    configure({ PLAY_INTEGRITY_BLOCKED_PLAY_PROTECT_VERDICTS: 'HIGH_RISK' });
    const result = evaluateCustomer(
      buildPayload({ environmentDetails: { playProtectVerdict: 'HIGH_RISK' } }),
    );
    expect(result.reason).toBe(INTEGRITY_FAILURE.PLAY_PROTECT_VERDICT);
  });

  it('rejects a certificate digest outside the configured allowlist', () => {
    configure({ PLAY_INTEGRITY_CUSTOMER_CERT_SHA256: 'expected-digest' });
    const result = evaluateCustomer(buildPayload());
    expect(result.reason).toBe(INTEGRITY_FAILURE.CERTIFICATE_MISMATCH);
  });

  // ── Test 10: token lifecycle — expiry, tampering, replay ─────────────────
  it('rejects a token older than the configured window', () => {
    const result = evaluateCustomer(
      buildPayload({
        requestDetails: {
          requestPackageName: CUSTOMER_PACKAGE,
          requestHash: requestHash(),
          timestampMillis: String(Date.now() - 10 * 60 * 1000),
        },
      }),
    );
    expect(result.reason).toBe(INTEGRITY_FAILURE.STALE_TOKEN);
  });

  it('rejects a token minted in the future beyond tolerated clock skew', () => {
    const result = evaluateCustomer(
      buildPayload({
        requestDetails: {
          requestPackageName: CUSTOMER_PACKAGE,
          requestHash: requestHash(),
          timestampMillis: String(Date.now() + 10 * 60 * 1000),
        },
      }),
    );
    expect(result.reason).toBe(INTEGRITY_FAILURE.STALE_TOKEN);
  });

  it('rejects a token lifted onto a different endpoint', () => {
    const result = service.evaluate(buildPayload(), {
      app: 'customer',
      token: 'opaque',
      nonce: NONCE,
      method: METHOD,
      // Same nonce and token, different route: the hash no longer matches.
      path: '/api/v1/customer/payment/create-order',
    });
    expect(result.reason).toBe(INTEGRITY_FAILURE.REQUEST_MISMATCH);
  });

  it('rejects a replayed token on its second use', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ tokenPayloadExternal: buildPayload() }),
      } as any);
    jest
      .spyOn(service as any, 'getAuth')
      .mockResolvedValue({ getAccessToken: async () => 'ya29.test' });

    redis.acquireLock
      .mockResolvedValueOnce(true) // first use wins the lock
      .mockResolvedValueOnce(false); // replay finds it already taken

    const input = {
      app: 'customer' as const,
      token: 'opaque-token',
      nonce: NONCE,
      method: METHOD,
      path: PATH,
    };
    await expect(service.verify(input)).resolves.toMatchObject({ ok: true });
    await expect(service.verify(input)).resolves.toMatchObject({
      ok: false,
      reason: INTEGRITY_FAILURE.REPLAYED_TOKEN,
    });

    fetchSpy.mockRestore();
  });

  // ── Test 3 / 7: a missing token is rejected before any Google call ───────
  it('rejects a missing token without calling Google', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any);
    const result = await service.verify({
      app: 'customer',
      token: '',
      nonce: NONCE,
      method: METHOD,
      path: PATH,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: INTEGRITY_FAILURE.MISSING_TOKEN,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects a request with a token but no nonce when binding is on', async () => {
    const result = await service.verify({
      app: 'customer',
      token: 'opaque',
      method: METHOD,
      path: PATH,
    });
    expect(result.reason).toBe(INTEGRITY_FAILURE.MISSING_NONCE);
  });

  it('rejects an invalid token that Google refuses to decode', async () => {
    configure({ PLAY_INTEGRITY_FAIL_OPEN_ON_UPSTREAM_ERROR: 'false' });
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Integrity token is invalid"}}',
    } as any);
    jest
      .spyOn(service as any, 'getAuth')
      .mockResolvedValue({ getAccessToken: async () => 'ya29.test' });

    const result = await service.verify({
      app: 'customer',
      token: 'garbage',
      nonce: NONCE,
      method: METHOD,
      path: PATH,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: INTEGRITY_FAILURE.DECODE_FAILED,
    });
    fetchSpy.mockRestore();
  });

  // ── Test 13: never punish a customer for a Google-side outage ────────────
  it('fails open when Google is unreachable and fail-open is configured', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as any)
      .mockRejectedValue(new Error('ETIMEDOUT'));
    jest
      .spyOn(service as any, 'getAuth')
      .mockResolvedValue({ getAccessToken: async () => 'ya29.test' });

    const result = await service.verify({
      app: 'customer',
      token: 'opaque',
      nonce: NONCE,
      method: METHOD,
      path: PATH,
    });
    expect(result.ok).toBe(true);
    expect(developer.error).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not block when Redis is unavailable for the replay check', async () => {
    redis.acquireLock.mockRejectedValue(new Error('redis down'));
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ tokenPayloadExternal: buildPayload() }),
    } as any);
    jest
      .spyOn(service as any, 'getAuth')
      .mockResolvedValue({ getAccessToken: async () => 'ya29.test' });

    const result = await service.verify({
      app: 'customer',
      token: 'opaque',
      nonce: NONCE,
      method: METHOD,
      path: PATH,
    });
    expect(result.ok).toBe(true);
    fetchSpy.mockRestore();
  });

  // ── The request hash must match what the Dart clients compute ───────────
  it('builds the canonical request hash as sha256(METHOD|path|nonce)', () => {
    expect(PlayIntegrityService.buildRequestHash('post', PATH, NONCE)).toBe(
      requestHash(),
    );
  });

  // ── Test 13: nothing is enabled without explicit configuration ──────────
  it('is disabled unless PLAY_INTEGRITY_ENABLED is set', () => {
    service.setConfigForTesting(loadPlayIntegrityConfig({} as NodeJS.ProcessEnv));
    expect(service.isEnabled()).toBe(false);
    expect(service.isEnforcing()).toBe(false);
  });

  it('reports monitor mode when enforcement is off', () => {
    configure({ PLAY_INTEGRITY_ENFORCE: 'false' });
    expect(service.isEnabled()).toBe(true);
    expect(service.isEnforcing()).toBe(false);
  });

  // ── No secret ever leaves the server ────────────────────────────────────
  it('never places the raw token in a failure result', async () => {
    const result = await service.verify({
      app: 'customer',
      token: 'super-secret-token-value',
      method: METHOD,
      path: PATH,
    });
    expect(JSON.stringify(result)).not.toContain('super-secret-token-value');
  });
});
