// Android / iOS / desktop implementation of [signInWithGoogle].

import 'package:google_sign_in/google_sign_in.dart';

import 'package:f2h_delivery/core/auth/google_auth_client.dart';
import 'package:f2h_delivery/core/config/app_config.dart';

const List<String> _scopes = <String>['email', 'profile'];

/// Built per call rather than held in a field: [AppConfig] is hydrated from the
/// server after start-up, so a long-lived instance can capture an empty client
/// id and then fail every sign-in for the rest of the session.
GoogleSignIn _client() {
  final serverClientId = AppConfig.googleServerClientId.trim();
  return GoogleSignIn(
    scopes: _scopes,
    serverClientId: serverClientId.isEmpty ? null : serverClientId,
  );
}

Future<GoogleCredential> signInWithGoogle() async {
  final google = _client();

  // Drop any cached grant so the account chooser always appears and a stale
  // token never gets replayed.
  try {
    await google.signOut();
  } catch (_) {}

  final account = await google.signIn();
  if (account == null) throw const GoogleSignInCancelled();

  final auth = await account.authentication;
  final credential = GoogleCredential(
    idToken: auth.idToken,
    serverAuthCode: account.serverAuthCode,
  );

  if (!credential.isUsable) {
    throw const GoogleSignInUnavailable(
      'Google did not return a sign-in token. Check that the app is registered '
      'with the correct SHA-1 / bundle id and server client id.',
    );
  }
  return credential;
}

Future<void> signOutGoogle() async {
  try {
    await _client().signOut();
  } catch (_) {}
}
