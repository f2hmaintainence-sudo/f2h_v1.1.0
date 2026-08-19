// Browser implementation of [signInWithGoogle].
//
// Google Identity Services does not hand `signIn()` an id_token on the web, so
// the authorization-code flow is used instead: the page obtains a one-time code
// and the API exchanges it for a verified identity using the client secret.

import 'package:google_sign_in/google_sign_in.dart';
import 'package:google_sign_in_platform_interface/google_sign_in_platform_interface.dart';
import 'package:google_sign_in_web/google_sign_in_web.dart';

import 'package:f2h_delivery/core/auth/google_auth_client.dart';
import 'package:f2h_delivery/core/config/app_config.dart';

const List<String> _scopes = <String>['email', 'profile'];

Future<GoogleCredential> signInWithGoogle() async {
  final clientId = AppConfig.googleServerClientId.trim();
  final plugin = GoogleSignInPlatform.instance;

  if (plugin is! GoogleSignInPlugin) {
    throw const GoogleSignInUnavailable(
      'Google Sign-In is not available in this browser.',
    );
  }

  // The code client only exists once the plugin has been initialised with a
  // non-empty scope list, and nothing else in the app triggers that.
  await plugin.initWithParams(
    SignInInitParameters(
      clientId: clientId.isEmpty ? null : clientId,
      scopes: _scopes,
    ),
  );

  // Must run inside the tap handler — the popup needs user activation.
  final String? code = await plugin.requestServerAuthCode();
  if (code != null && code.isNotEmpty) {
    return GoogleCredential(serverAuthCode: code);
  }

  // The user closed the consent popup.
  throw const GoogleSignInCancelled();
}

Future<void> signOutGoogle() async {
  try {
    await GoogleSignIn(scopes: _scopes).signOut();
  } catch (_) {}
}
