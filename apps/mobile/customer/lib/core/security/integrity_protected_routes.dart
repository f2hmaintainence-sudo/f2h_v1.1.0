// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : integrity_protected_routes.dart
// Description : The one place that decides which Customer-app requests carry a
//               Play Integrity token.
//
//               Deliberately a short allowlist, not a denylist. Requesting a
//               token costs a round trip to Play Services and counts against
//               Google's quota, so browsing, catalog, home, banners, orders
//               history, addresses, notifications and every other read stay
//               completely untouched.
//
//               Each entry must correspond to an endpoint carrying
//               @RequireIntegrity('customer') on the API. A path listed here
//               but not decorated server-side just wastes a token; a path
//               decorated server-side but missing here fails the request.
// ============================================================================

import 'package:flutter/foundation.dart';

@immutable
class _ProtectedRoute {
  const _ProtectedRoute(this.method, this.pattern);

  final String method;
  final RegExp pattern;

  bool matches(String method, String path) =>
      this.method == method.toUpperCase() && pattern.hasMatch(path);
}

class IntegrityProtectedRoutes {
  IntegrityProtectedRoutes._();

  /// Matched against the API path only, e.g. /api/v1/customer/wallet/topup.
  /// Anchored at the end so /coupon/validate cannot be widened by a suffix.
  static final List<_ProtectedRoute> _routes = <_ProtectedRoute>[
    // ── Order placement & payment ──
    _ProtectedRoute('POST', RegExp(r'/customer/checkout/payment$')),
    _ProtectedRoute('POST', RegExp(r'/customer/payment/create-order$')),
    _ProtectedRoute('POST', RegExp(r'/customer/payment/verify$')),
    _ProtectedRoute('POST', RegExp(r'/customer/payment/pay-wallet$')),
    _ProtectedRoute('POST', RegExp(r'/customer/payment/pay-online-init$')),
    _ProtectedRoute('POST', RegExp(r'/customer/payment/verify-online$')),

    // ── Wallet ──
    _ProtectedRoute('POST', RegExp(r'/customer/wallet/topup$')),

    // ── Coupons ──
    _ProtectedRoute('POST', RegExp(r'/customer/coupon/validate$')),

    // ── Referral rewards ──
    _ProtectedRoute('POST', RegExp(r'/customer/referrals/add$')),

    // ── Subscriptions: creation and lifecycle ──
    _ProtectedRoute('POST', RegExp(r'/customer/subscriptions/checkout$')),
    _ProtectedRoute('POST', RegExp(r'/customer/subscriptions/[^/]+/pause$')),
    _ProtectedRoute('POST', RegExp(r'/customer/subscriptions/[^/]+/resume$')),
    _ProtectedRoute('POST', RegExp(r'/customer/subscriptions/[^/]+/cancel$')),
  ];

  /// [path] must already have the query string removed.
  static bool requiresIntegrity(String method, String path) =>
      _routes.any((route) => route.matches(method, path));

  @visibleForTesting
  static int get routeCount => _routes.length;
}
