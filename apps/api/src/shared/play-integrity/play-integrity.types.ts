// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.types.ts
// Description : Shapes for the Google Play Integrity API verdict payload and
//               the internal result the guard acts on.
//
//               The verdict shape mirrors `tokenPayloadExternal` returned by
//               playintegrity.googleapis.com v1 `:decodeIntegrityToken`.
//               Every field is optional: Google omits whole blocks when the
//               caller has not opted into that signal, and a missing block
//               must fail closed rather than throw.
// ============================================================================

/**
 * Which F2H application a route expects. Declared on the server by
 * `@RequireIntegrity()` — never taken from a client header, so a delivery
 * build cannot present its token to a customer-only endpoint.
 */
export type IntegrityAppId = 'customer' | 'delivery';

export interface IntegrityRequestDetails {
  requestPackageName?: string;
  requestHash?: string;
  nonce?: string;
  timestampMillis?: string | number;
}

export interface IntegrityAppDetails {
  appRecognitionVerdict?: string;
  packageName?: string;
  certificateSha256Digest?: string[];
  versionCode?: string | number;
}

export interface IntegrityDeviceDetails {
  deviceRecognitionVerdict?: string[];
}

export interface IntegrityAccountDetails {
  appLicensingVerdict?: string;
}

export interface IntegrityEnvironmentDetails {
  playProtectVerdict?: string;
  appAccessRiskVerdict?: Record<string, unknown>;
}

export interface IntegrityTokenPayload {
  requestDetails?: IntegrityRequestDetails;
  appIntegrity?: IntegrityAppDetails;
  deviceIntegrity?: IntegrityDeviceDetails;
  accountDetails?: IntegrityAccountDetails;
  environmentDetails?: IntegrityEnvironmentDetails;
}

/**
 * Stable machine-readable reasons. These are what gets logged; the client only
 * ever sees a generic message, because the specific reason tells an attacker
 * exactly which signal to forge next.
 */
export const INTEGRITY_FAILURE = {
  NOT_CONFIGURED: 'INTEGRITY_NOT_CONFIGURED',
  MISSING_TOKEN: 'INTEGRITY_MISSING_TOKEN',
  MISSING_NONCE: 'INTEGRITY_MISSING_NONCE',
  DECODE_FAILED: 'INTEGRITY_DECODE_FAILED',
  EMPTY_PAYLOAD: 'INTEGRITY_EMPTY_PAYLOAD',
  PACKAGE_MISMATCH: 'INTEGRITY_PACKAGE_MISMATCH',
  CERTIFICATE_MISMATCH: 'INTEGRITY_CERTIFICATE_MISMATCH',
  APP_VERDICT: 'INTEGRITY_APP_VERDICT_REJECTED',
  DEVICE_VERDICT: 'INTEGRITY_DEVICE_VERDICT_REJECTED',
  LICENSING_VERDICT: 'INTEGRITY_LICENSING_VERDICT_REJECTED',
  PLAY_PROTECT_VERDICT: 'INTEGRITY_PLAY_PROTECT_REJECTED',
  STALE_TOKEN: 'INTEGRITY_TOKEN_EXPIRED',
  REQUEST_MISMATCH: 'INTEGRITY_REQUEST_MISMATCH',
  REPLAYED_TOKEN: 'INTEGRITY_TOKEN_REPLAYED',
} as const;

export type IntegrityFailureReason =
  (typeof INTEGRITY_FAILURE)[keyof typeof INTEGRITY_FAILURE];

export interface IntegrityCheckResult {
  ok: boolean;
  /** Only set when `ok` is false. Never returned to the client verbatim. */
  reason?: IntegrityFailureReason;
  /** Short, non-sensitive detail for server logs only. */
  detail?: string;
  /** Verdict summary kept for logging/telemetry — carries no raw token. */
  summary?: {
    packageName?: string;
    appVerdict?: string;
    deviceVerdicts?: string[];
    licensingVerdict?: string;
    playProtectVerdict?: string;
  };
}
