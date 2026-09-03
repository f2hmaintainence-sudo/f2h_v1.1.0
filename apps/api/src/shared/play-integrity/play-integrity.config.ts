// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.config.ts
// Description : Resolves Play Integrity settings from the environment.
//
//               Only *settings* live here. The Google service-account
//               credential is resolved separately by the service, using the
//               same precedence the rest of the API already uses for
//               third-party secrets: `api_integrations_config` row first,
//               then an env-provided path/JSON. Nothing is hardcoded.
// ============================================================================

import { IntegrityAppId } from './play-integrity.types';

export interface PlayIntegrityAppConfig {
  /** Android applicationId the token must have been minted for. */
  packageName: string;
  /**
   * Optional allowlist of signing-certificate SHA-256 digests, base64url with
   * no padding — exactly the encoding Google returns in
   * `appIntegrity.certificateSha256Digest`. Empty means "do not check", which
   * is safe because `appRecognitionVerdict = PLAY_RECOGNIZED` already implies
   * Play signed the binary.
   */
  certificateSha256Digests: string[];
}

export interface PlayIntegrityConfig {
  /** Master switch. When false the guard is a no-op and logs nothing. */
  enabled: boolean;
  /**
   * Monitor mode. When false, failures are logged but the request proceeds.
   * Lets the verdicts be observed in production before they start rejecting
   * real customers.
   */
  enforce: boolean;
  /** Google Cloud project number that Play Integrity responses are linked to. */
  cloudProjectNumber: string;
  apps: Record<IntegrityAppId, PlayIntegrityAppConfig>;
  /** Accepted values of `appIntegrity.appRecognitionVerdict`. */
  allowedAppVerdicts: string[];
  /** Values that must ALL appear in `deviceIntegrity.deviceRecognitionVerdict`. */
  requiredDeviceVerdicts: string[];
  /** Accepted values of `accountDetails.appLicensingVerdict`, empty = skip. */
  allowedLicensingVerdicts: string[];
  /** Values of `environmentDetails.playProtectVerdict` that are rejected. */
  blockedPlayProtectVerdicts: string[];
  /** Maximum age of `requestDetails.timestampMillis`, in seconds. */
  maxTokenAgeSeconds: number;
  /** Bind the token to the exact method+path+nonce of the request. */
  bindRequest: boolean;
  /** Reject a token that has already been spent (needs Redis). */
  replayProtection: boolean;
  /**
   * When Google itself is unreachable (outage, quota, network), allow the
   * request through rather than blocking legitimate customers. Defaults to
   * true; a hard-fail posture is one env var away.
   */
  failOpenOnUpstreamError: boolean;
}

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const list = (value: string | undefined, fallback: string[]): string[] => {
  if (value === undefined) return fallback;
  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  // An explicitly empty value is a deliberate "check nothing", not a typo.
  return value.trim() === '' ? [] : parsed;
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function loadPlayIntegrityConfig(
  env: NodeJS.ProcessEnv = process.env,
): PlayIntegrityConfig {
  return {
    enabled: bool(env.PLAY_INTEGRITY_ENABLED, false),
    enforce: bool(env.PLAY_INTEGRITY_ENFORCE, true),
    cloudProjectNumber: (env.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER || '').trim(),
    apps: {
      customer: {
        packageName: (
          env.PLAY_INTEGRITY_CUSTOMER_PACKAGE || 'com.f2h.customer'
        ).trim(),
        certificateSha256Digests: list(
          env.PLAY_INTEGRITY_CUSTOMER_CERT_SHA256,
          [],
        ),
      },
      delivery: {
        packageName: (
          env.PLAY_INTEGRITY_DELIVERY_PACKAGE || 'com.f2h.delivery'
        ).trim(),
        certificateSha256Digests: list(
          env.PLAY_INTEGRITY_DELIVERY_CERT_SHA256,
          [],
        ),
      },
    },
    allowedAppVerdicts: list(env.PLAY_INTEGRITY_ALLOWED_APP_VERDICTS, [
      'PLAY_RECOGNIZED',
    ]),
    requiredDeviceVerdicts: list(env.PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICTS, [
      'MEETS_DEVICE_INTEGRITY',
    ]),
    allowedLicensingVerdicts: list(
      env.PLAY_INTEGRITY_ALLOWED_LICENSING_VERDICTS,
      ['LICENSED'],
    ),
    blockedPlayProtectVerdicts: list(
      env.PLAY_INTEGRITY_BLOCKED_PLAY_PROTECT_VERDICTS,
      [],
    ),
    maxTokenAgeSeconds: int(env.PLAY_INTEGRITY_MAX_TOKEN_AGE_SECONDS, 300),
    bindRequest: bool(env.PLAY_INTEGRITY_BIND_REQUEST, true),
    replayProtection: bool(env.PLAY_INTEGRITY_REPLAY_PROTECTION, true),
    failOpenOnUpstreamError: bool(
      env.PLAY_INTEGRITY_FAIL_OPEN_ON_UPSTREAM_ERROR,
      true,
    ),
  };
}
