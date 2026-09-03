// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play-integrity.constants.ts
// Description : Wire names shared by the API and both Flutter clients.
// ============================================================================

/** Opaque Play Integrity token minted on-device. */
export const INTEGRITY_TOKEN_HEADER = 'x-integrity-token';

/** Per-request nonce the client folded into the Standard API request hash. */
export const INTEGRITY_NONCE_HEADER = 'x-integrity-nonce';

/**
 * Sent by the client when the device genuinely could not produce a token
 * (Play Services missing, Play Store unavailable, network down). Carries only
 * a short reason code — it is advisory for logging and is never trusted as a
 * reason to skip verification.
 */
export const INTEGRITY_UNAVAILABLE_HEADER = 'x-integrity-unavailable';

/** Single generic message returned to clients. Details stay in the logs. */
export const INTEGRITY_CLIENT_MESSAGE =
  'This action could not be verified as coming from a genuine F2H app installed from Google Play. Please update or reinstall the app from the Play Store and try again.';

/** Stable error code the apps branch on. */
export const INTEGRITY_CLIENT_ERROR_CODE = 'APP_INTEGRITY_REQUIRED';
