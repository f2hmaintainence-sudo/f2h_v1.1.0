// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : google_auth_client.dart
// Description : Platform-aware Google Sign-In. Produces a credential the API
//               can verify with Google, and hides the fact that the browser
//               and the mobile plugins hand back different things.
// ============================================================================

import 'google_auth_client_io.dart'
    if (dart.library.js_interop) 'google_auth_client_web.dart'
    as impl;

/// What the client managed to obtain from Google.
///
/// Android and iOS return an `idToken` (and usually a `serverAuthCode`); the
/// browser only reliably yields an authorization `code`. The API accepts
/// either, so both are sent and the server uses whichever it can verify.
class GoogleCredential {
  final String? idToken;
  final String? serverAuthCode;

  const GoogleCredential({this.idToken, this.serverAuthCode});

  bool get isUsable =>
      (idToken != null && idToken!.isNotEmpty) ||
      (serverAuthCode != null && serverAuthCode!.isNotEmpty);
}

/// Thrown when the user dismisses the Google chooser.
///
/// Callers should treat this as "nothing happened" rather than as a failure —
/// showing an error for a deliberate dismissal is just noise.
class GoogleSignInCancelled implements Exception {
  const GoogleSignInCancelled();

  @override
  String toString() => 'Google sign-in cancelled';
}

/// Raised when Google completed but handed back nothing verifiable, which in
/// practice means the OAuth client is misconfigured for this platform.
class GoogleSignInUnavailable implements Exception {
  final String message;
  const GoogleSignInUnavailable(this.message);

  @override
  String toString() => message;
}

/// Opens the Google chooser and returns a verifiable credential.
///
/// Throws [GoogleSignInCancelled] if the user backs out.
Future<GoogleCredential> signInWithGoogleAccount() => impl.signInWithGoogle();

/// Clears the cached Google session so the next sign-in re-prompts.
Future<void> signOutGoogleAccount() => impl.signOutGoogle();
