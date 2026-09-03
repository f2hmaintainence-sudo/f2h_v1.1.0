// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : integrity_protected_routes.dart
// Description : The one place that decides which Delivery-Partner requests
//               carry a Play Integrity token.
//
//               Deliberately a short allowlist, not a denylist. Only actions
//               that mutate delivery or inventory state are covered. The
//               dashboard, today's run listing, basket/container summaries,
//               attendance, leaderboard, profile reads, notifications and
//               location pings stay untouched: a partner on a bike refreshes
//               those constantly and none of them move money or stock.
//
//               Each entry must correspond to an endpoint carrying
//               @RequireIntegrity('delivery') on the API.
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

  /// The API exposes each of these under both `delivery-partner/…` and the
  /// shorter `delivery/…` alias, so the patterns accept either prefix.
  static final List<_ProtectedRoute> _routes = <_ProtectedRoute>[
    // ── Run lifecycle & delivery status ──
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/orders/run/[^/]+/start$')),
    _ProtectedRoute(
      'PATCH',
      RegExp(r'/delivery(-partner)?/orders/run/[^/]+/address/[^/]+/deliver$'),
    ),
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/orders/run/[^/]+/handover$')),
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/orders/mark-out-for-delivery$')),
    _ProtectedRoute('PATCH', RegExp(r'/delivery(-partner)?/orders/[^/]+/status$')),
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/orders/[^/]+/upload-proof$')),

    // ── Pickup / collection confirmation ──
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/orders/pickup-items/confirm$')),

    // ── Stock return & container reconciliation ──
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/basket/reconcile$')),
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/basket/products/return-hub$')),
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/basket/containers/submit-hub$')),
    _ProtectedRoute('POST', RegExp(r'/delivery(-partner)?/basket/containers/submit-all$')),
  ];

  /// [path] must already have the query string removed.
  static bool requiresIntegrity(String method, String path) =>
      _routes.any((route) => route.matches(method, path));

  @visibleForTesting
  static int get routeCount => _routes.length;
}
