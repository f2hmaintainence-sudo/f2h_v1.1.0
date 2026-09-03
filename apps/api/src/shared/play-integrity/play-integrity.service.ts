// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.service.ts
// Description : Server-side verification of Google Play Integrity tokens.
//
//               The token is opaque to the client and is NEVER trusted as a
//               verdict. It is handed to Google's managed decrypt endpoint
//               (`playintegrity.googleapis.com/v1/{package}:decodeIntegrityToken`)
//               with a service-account credential that only ever exists on the
//               server, and the decoded payload is then evaluated against the
//               package identity and verdicts configured for this deployment.
//
//               Credential precedence mirrors the Firebase/Razorpay services
//               already in this codebase: the `api_integrations_config` row
//               first, then env-provided JSON/path, then Application Default
//               Credentials. No credential is ever hardcoded, returned to a
//               client, or written to a log.
// ============================================================================

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import { GoogleAuth } from 'google-auth-library';
import { DatabaseService } from '../database/Database.service';
import { DeveloperService } from '../logger/Developer.service';
import { RedisService } from '../redis/redis.service';
import {
  loadPlayIntegrityConfig,
  PlayIntegrityConfig,
} from './play-integrity.config';
import {
  INTEGRITY_FAILURE,
  IntegrityAppId,
  IntegrityCheckResult,
  IntegrityTokenPayload,
} from './play-integrity.types';

const PLAY_INTEGRITY_SCOPE = 'https://www.googleapis.com/auth/playintegrity';
const PLAY_INTEGRITY_HOST = 'https://playintegrity.googleapis.com';
const CONFIG_KEY = 'play-integrity:service-account';
/** Google's own upper bound on how long a decoded verdict stays meaningful. */
const MAX_SUPPORTED_TOKEN_AGE_SECONDS = 3600;

interface ServiceAccountCredential {
  client_email: string;
  private_key: string;
  project_id?: string;
}

export interface VerifyIntegrityInput {
  app: IntegrityAppId;
  token: string;
  /** Opaque per-request nonce echoed by the client in `X-Integrity-Nonce`. */
  nonce?: string;
  /** Uppercased HTTP method of the request being protected. */
  method?: string;
  /** Request path without query string, e.g. `/api/v1/customer/wallet/topup`. */
  path?: string;
}

@Injectable()
export class PlayIntegrityService implements OnModuleInit {
  private config: PlayIntegrityConfig = loadPlayIntegrityConfig();
  private auth: GoogleAuth | null = null;
  private authResolved = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly developer: DeveloperService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.config = loadPlayIntegrityConfig();
    if (!this.config.enabled) {
      this.developer.info(
        '[PlayIntegrity] Disabled (PLAY_INTEGRITY_ENABLED is not set) — protected routes fall back to JWT/RBAC only',
      );
      return;
    }
    this.developer.info('[PlayIntegrity] Enabled', {
      enforce: this.config.enforce,
      customerPackage: this.config.apps.customer.packageName,
      deliveryPackage: this.config.apps.delivery.packageName,
    });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  isEnforcing(): boolean {
    return this.config.enabled && this.config.enforce;
  }

  getConfig(): PlayIntegrityConfig {
    return this.config;
  }

  /** Test seam — lets a spec drive the evaluator without touching the env. */
  setConfigForTesting(config: PlayIntegrityConfig): void {
    this.config = config;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Public entry point
  // ──────────────────────────────────────────────────────────────────────────

  async verify(input: VerifyIntegrityInput): Promise<IntegrityCheckResult> {
    const expected = this.config.apps[input.app];
    if (!expected?.packageName) {
      return {
        ok: false,
        reason: INTEGRITY_FAILURE.NOT_CONFIGURED,
        detail: `no package configured for app "${input.app}"`,
      };
    }

    if (!input.token || input.token.trim() === '') {
      return { ok: false, reason: INTEGRITY_FAILURE.MISSING_TOKEN };
    }

    if (this.config.bindRequest && !input.nonce) {
      return { ok: false, reason: INTEGRITY_FAILURE.MISSING_NONCE };
    }

    let payload: IntegrityTokenPayload;
    try {
      payload = await this.decodeToken(expected.packageName, input.token);
    } catch (error: any) {
      // A Google-side failure must not become a customer-side failure unless
      // the deployment has explicitly asked for a hard fail.
      const detail = this.describeUpstreamError(error);
      this.developer.error('[PlayIntegrity] Token decode failed', {
        app: input.app,
        detail,
      });
      if (this.config.failOpenOnUpstreamError) {
        return {
          ok: true,
          detail: `upstream unavailable, failing open: ${detail}`,
        };
      }
      return {
        ok: false,
        reason: INTEGRITY_FAILURE.DECODE_FAILED,
        detail,
      };
    }

    const evaluated = this.evaluate(payload, input);
    if (!evaluated.ok) return evaluated;

    // Replay guard runs last: a token that failed evaluation should not consume
    // its one-and-only use, or a network retry after a genuine verdict failure
    // would report the wrong reason.
    const fresh = await this.consumeToken(input.token);
    if (!fresh) {
      return {
        ...evaluated,
        ok: false,
        reason: INTEGRITY_FAILURE.REPLAYED_TOKEN,
        detail: 'token already spent within its validity window',
      };
    }

    return evaluated;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Verdict evaluation — pure, so it is directly unit-testable
  // ──────────────────────────────────────────────────────────────────────────

  evaluate(
    payload: IntegrityTokenPayload,
    input: VerifyIntegrityInput,
  ): IntegrityCheckResult {
    const expected = this.config.apps[input.app];
    const request = payload?.requestDetails;
    const app = payload?.appIntegrity;
    const device = payload?.deviceIntegrity;
    const account = payload?.accountDetails;
    const environment = payload?.environmentDetails;

    const summary = {
      packageName: app?.packageName || request?.requestPackageName,
      appVerdict: app?.appRecognitionVerdict,
      deviceVerdicts: device?.deviceRecognitionVerdict,
      licensingVerdict: account?.appLicensingVerdict,
      playProtectVerdict: environment?.playProtectVerdict,
    };

    if (!request && !app && !device) {
      return {
        ok: false,
        reason: INTEGRITY_FAILURE.EMPTY_PAYLOAD,
        detail: 'decoded payload carried no verdict blocks',
        summary,
      };
    }

    // 1. Application identity. Both the package the token was requested for and
    //    the package Play recognised must be this app — a customer token
    //    presented to a delivery-partner route fails here.
    const requestPackage = request?.requestPackageName;
    if (requestPackage && requestPackage !== expected.packageName) {
      return {
        ok: false,
        reason: INTEGRITY_FAILURE.PACKAGE_MISMATCH,
        detail: `requestPackageName ${requestPackage} != ${expected.packageName}`,
        summary,
      };
    }
    if (app?.packageName && app.packageName !== expected.packageName) {
      return {
        ok: false,
        reason: INTEGRITY_FAILURE.PACKAGE_MISMATCH,
        detail: `appIntegrity.packageName ${app.packageName} != ${expected.packageName}`,
        summary,
      };
    }
    if (!requestPackage && !app?.packageName) {
      return {
        ok: false,
        reason: INTEGRITY_FAILURE.PACKAGE_MISMATCH,
        detail: 'payload carried no package name',
        summary,
      };
    }

    // 2. Signing certificate, when the deployment pins one.
    if (expected.certificateSha256Digests.length) {
      const presented = app?.certificateSha256Digest || [];
      const matches = presented.some((digest) =>
        expected.certificateSha256Digests.includes(digest),
      );
      if (!matches) {
        return {
          ok: false,
          reason: INTEGRITY_FAILURE.CERTIFICATE_MISMATCH,
          detail: 'no presented certificate digest is allowlisted',
          summary,
        };
      }
    }

    // 3. App integrity — was this binary installed from Play, unmodified.
    if (this.config.allowedAppVerdicts.length) {
      const verdict = app?.appRecognitionVerdict || '';
      if (!this.config.allowedAppVerdicts.includes(verdict)) {
        return {
          ok: false,
          reason: INTEGRITY_FAILURE.APP_VERDICT,
          detail: `appRecognitionVerdict=${verdict || 'ABSENT'}`,
          summary,
        };
      }
    }

    // 4. Device / virtual integrity.
    if (this.config.requiredDeviceVerdicts.length) {
      const verdicts = device?.deviceRecognitionVerdict || [];
      const missing = this.config.requiredDeviceVerdicts.filter(
        (required) => !verdicts.includes(required),
      );
      if (missing.length) {
        return {
          ok: false,
          reason: INTEGRITY_FAILURE.DEVICE_VERDICT,
          detail: `missing ${missing.join(',')}`,
          summary,
        };
      }
    }

    // 5. Play licensing — is this account entitled to the app.
    if (this.config.allowedLicensingVerdicts.length) {
      const verdict = account?.appLicensingVerdict || '';
      if (!this.config.allowedLicensingVerdicts.includes(verdict)) {
        return {
          ok: false,
          reason: INTEGRITY_FAILURE.LICENSING_VERDICT,
          detail: `appLicensingVerdict=${verdict || 'ABSENT'}`,
          summary,
        };
      }
    }

    // 6. Play Protect status, when the deployment blocks specific values.
    if (this.config.blockedPlayProtectVerdicts.length) {
      const verdict = environment?.playProtectVerdict || '';
      if (verdict && this.config.blockedPlayProtectVerdicts.includes(verdict)) {
        return {
          ok: false,
          reason: INTEGRITY_FAILURE.PLAY_PROTECT_VERDICT,
          detail: `playProtectVerdict=${verdict}`,
          summary,
        };
      }
    }

    // 7. Freshness. Google mints `timestampMillis` when the token is created;
    //    anything older than the configured window is treated as expired.
    const staleness = this.checkFreshness(request?.timestampMillis);
    if (staleness) {
      return { ok: false, ...staleness, summary };
    }

    // 8. Request binding. The client hashes method|path|nonce into the Standard
    //    API's requestHash, so a token minted for a cheap protected route
    //    cannot be lifted onto an expensive one.
    if (this.config.bindRequest) {
      const expectedHash = PlayIntegrityService.buildRequestHash(
        input.method || '',
        input.path || '',
        input.nonce || '',
      );
      const presentedHash = request?.requestHash || '';
      if (!presentedHash || presentedHash !== expectedHash) {
        return {
          ok: false,
          reason: INTEGRITY_FAILURE.REQUEST_MISMATCH,
          detail: presentedHash
            ? 'requestHash does not match this method/path/nonce'
            : 'payload carried no requestHash',
          summary,
        };
      }
    }

    return { ok: true, summary };
  }

  /**
   * Canonical request hash, computed identically by both Flutter clients.
   * Kept static so the spec and the Dart side stay provably in step.
   */
  static buildRequestHash(method: string, path: string, nonce: string): string {
    const canonical = `${method.toUpperCase()}|${path}|${nonce}`;
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  private checkFreshness(
    timestampMillis: string | number | undefined,
  ): Pick<IntegrityCheckResult, 'reason' | 'detail'> | null {
    if (timestampMillis === undefined || timestampMillis === null) {
      return {
        reason: INTEGRITY_FAILURE.STALE_TOKEN,
        detail: 'payload carried no timestampMillis',
      };
    }
    const issuedAt = Number(timestampMillis);
    if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
      return {
        reason: INTEGRITY_FAILURE.STALE_TOKEN,
        detail: 'timestampMillis is not a number',
      };
    }
    const ageSeconds = (Date.now() - issuedAt) / 1000;
    const maxAge = Math.min(
      this.config.maxTokenAgeSeconds,
      MAX_SUPPORTED_TOKEN_AGE_SECONDS,
    );
    // A small negative age is normal clock skew between the device and this host.
    if (ageSeconds < -60) {
      return {
        reason: INTEGRITY_FAILURE.STALE_TOKEN,
        detail: 'timestampMillis is in the future',
      };
    }
    if (ageSeconds > maxAge) {
      return {
        reason: INTEGRITY_FAILURE.STALE_TOKEN,
        detail: `token age ${Math.round(ageSeconds)}s exceeds ${maxAge}s`,
      };
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Replay protection
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Marks a token as spent. Only a digest is stored — the token itself never
   * reaches Redis or a log. Returns false when the digest was already present.
   *
   * If Redis is unavailable this returns true: losing the cache must not lock
   * every customer out of checkout.
   */
  private async consumeToken(token: string): Promise<boolean> {
    if (!this.config.replayProtection) return true;
    const digest = createHash('sha256').update(token, 'utf8').digest('hex');
    const ttl = Math.min(
      this.config.maxTokenAgeSeconds,
      MAX_SUPPORTED_TOKEN_AGE_SECONDS,
    );
    try {
      return await this.redis.acquireLock(`play-integrity:token:${digest}`, ttl);
    } catch (error: any) {
      this.developer.warn(
        '[PlayIntegrity] Replay store unavailable, skipping replay check',
        { error: error?.message || String(error) },
      );
      return true;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Google managed decryption
  // ──────────────────────────────────────────────────────────────────────────

  private async decodeToken(
    packageName: string,
    token: string,
  ): Promise<IntegrityTokenPayload> {
    const auth = await this.getAuth();
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      throw new Error('could not mint a Google access token');
    }

    const url = `${PLAY_INTEGRITY_HOST}/v1/${encodeURIComponent(
      packageName,
    )}:decodeIntegrityToken`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ integrity_token: token }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // Truncated: Google echoes nothing sensitive here, but the body can be
      // large and there is no reason to keep more than the shape of the error.
      throw new Error(
        `decodeIntegrityToken returned ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    const json = (await response.json()) as {
      tokenPayloadExternal?: IntegrityTokenPayload;
    };
    return json?.tokenPayloadExternal || {};
  }

  private async getAuth(): Promise<GoogleAuth> {
    if (this.auth && this.authResolved) return this.auth;

    const credential = await this.resolveServiceAccount();
    this.auth = credential
      ? new GoogleAuth({
          credentials: {
            client_email: credential.client_email,
            private_key: credential.private_key,
          },
          projectId: credential.project_id,
          scopes: [PLAY_INTEGRITY_SCOPE],
        })
      : // No explicit credential: fall back to Application Default Credentials
        // (workload identity, GOOGLE_APPLICATION_CREDENTIALS, metadata server).
        new GoogleAuth({ scopes: [PLAY_INTEGRITY_SCOPE] });
    this.authResolved = true;
    return this.auth;
  }

  /** Drops the cached credential — call after rotating the service account. */
  invalidateCredentialCache(): void {
    this.auth = null;
    this.authResolved = false;
  }

  private async resolveServiceAccount(): Promise<ServiceAccountCredential | null> {
    // 1. The integrations table the admin panel already writes to.
    try {
      const rows = await this.db.query(
        `SELECT config_data
           FROM api_integrations_config
          WHERE config_key = $1
            AND is_active = true
            AND deleted_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 1`,
        [CONFIG_KEY],
      );
      const raw = rows?.[0]?.config_data;
      const parsed = this.coerceCredential(raw);
      if (parsed) {
        this.developer.info(
          '[PlayIntegrity] Service account loaded from api_integrations_config',
        );
        return parsed;
      }
    } catch (error: any) {
      this.developer.warn(
        '[PlayIntegrity] api_integrations_config lookup failed',
        { error: error?.message || String(error) },
      );
    }

    // 2. Inline JSON (raw or base64) from the server environment.
    const inline = process.env.PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON;
    if (inline && inline.trim()) {
      const decoded = inline.trim().startsWith('{')
        ? inline
        : Buffer.from(inline, 'base64').toString('utf8');
      const parsed = this.coerceCredential(decoded);
      if (parsed) {
        this.developer.info(
          '[PlayIntegrity] Service account loaded from PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON',
        );
        return parsed;
      }
    }

    // 3. A file path on the server, the same shape as FIREBASE_SERVICE_ACCOUNT_PATH.
    const path = process.env.PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH;
    if (path && path.trim() && fs.existsSync(path.trim())) {
      try {
        const parsed = this.coerceCredential(
          fs.readFileSync(path.trim(), 'utf8'),
        );
        if (parsed) {
          this.developer.info(
            `[PlayIntegrity] Service account loaded from ${path.trim()}`,
          );
          return parsed;
        }
      } catch (error: any) {
        this.developer.warn(
          '[PlayIntegrity] Could not read PLAY_INTEGRITY_SERVICE_ACCOUNT_PATH',
          { error: error?.message || String(error) },
        );
      }
    }

    // 4. Application Default Credentials.
    return null;
  }

  private coerceCredential(raw: unknown): ServiceAccountCredential | null {
    if (!raw) return null;
    let value: any = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!value?.client_email || !value?.private_key) return null;
    return {
      client_email: String(value.client_email),
      // Values pasted through a UI or a .env commonly carry escaped newlines.
      private_key: String(value.private_key).replace(/\\n/g, '\n'),
      project_id: value.project_id ? String(value.project_id) : undefined,
    };
  }

  private describeUpstreamError(error: any): string {
    const message = error?.message || String(error);
    return message.slice(0, 300);
  }
}
