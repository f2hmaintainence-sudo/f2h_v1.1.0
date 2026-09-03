// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play_integrity_test.dart
// Description : Tests for the Delivery app's Play Integrity layer.
//
//               The MethodChannel is faked, so these run on the host with no
//               device, no Play Services and no Google credential — which is
//               also the point of several of them: a build that cannot reach
//               Play Integrity must degrade, not crash.
// ============================================================================

import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:f2h_delivery/core/api/interceptors/integrity_interceptor.dart';
import 'package:f2h_delivery/core/security/integrity_protected_routes.dart';
import 'package:f2h_delivery/core/security/play_integrity_service.dart';

/// Records what the native side was asked for and replays a scripted answer.
class _FakeNativeIntegrity {
  _FakeNativeIntegrity(this.channel);

  final MethodChannel channel;

  final List<MethodCall> calls = <MethodCall>[];
  bool warmUpSucceeds = true;
  String? tokenToReturn = 'integrity-token';
  String? failRequestWithCode;
  bool channelMissing = false;
  int warmUpCount = 0;

  void install() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      calls.add(call);
      if (channelMissing) throw MissingPluginException('no implementation');
      switch (call.method) {
        case 'warmUp':
          warmUpCount++;
          if (!warmUpSucceeds) {
            throw PlatformException(code: 'PLAY_INTEGRITY_UNAVAILABLE');
          }
          return true;
        case 'requestToken':
          if (failRequestWithCode != null) {
            throw PlatformException(code: failRequestWithCode!);
          }
          return tokenToReturn;
        case 'isWarm':
          return warmUpSucceeds;
      }
      return null;
    });
  }

  void uninstall() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  }

  List<MethodCall> get tokenRequests =>
      calls.where((c) => c.method == 'requestToken').toList();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel(PlayIntegrityService.channelName);
  late _FakeNativeIntegrity native;
  late PlayIntegrityService service;

  setUp(() {
    native = _FakeNativeIntegrity(channel)..install();
    service = PlayIntegrityService(channel: channel);
  });

  tearDown(() => native.uninstall());

  // These assertions describe a build with NO Play Integrity configuration:
  // a debug run, a local build, an F-Droid-style sideload, or CI. When the
  // suite is run WITH --dart-define=F2H_CLOUD_PROJECT_NUMBER, the enabled
  // behaviour is covered by play_integrity_enabled_test.dart instead.
  final unconfigured = const String.fromEnvironment(
    'F2H_CLOUD_PROJECT_NUMBER',
    defaultValue: '',
  ).isEmpty;
  const configuredSkip =
      'covered by play_integrity_enabled_test.dart when F2H_CLOUD_PROJECT_NUMBER is set';

  // ── The canonical hash must match the NestJS implementation exactly ──────
  group('request hash', () {
    test('is sha256 of METHOD|path|nonce', () {
      const method = 'post';
      const path = '/api/v1/customer/wallet/topup';
      const nonce = 'nonce-abc-123';

      final expected =
          sha256.convert(utf8.encode('POST|$path|$nonce')).toString();

      expect(
        PlayIntegrityService.buildRequestHash(
          method: method,
          path: path,
          nonce: nonce,
        ),
        expected,
      );
    });

    test('changes when the path changes, so a token cannot be moved', () {
      const nonce = 'fixed-nonce';
      final a = PlayIntegrityService.buildRequestHash(
        method: 'POST',
        path: '/api/v1/customer/wallet/topup',
        nonce: nonce,
      );
      final b = PlayIntegrityService.buildRequestHash(
        method: 'POST',
        path: '/api/v1/customer/payment/create-order',
        nonce: nonce,
      );
      expect(a, isNot(b));
    });

    test('generates a distinct nonce every time', () {
      final nonces = List.generate(200, (_) => PlayIntegrityService.generateNonce());
      expect(nonces.toSet().length, 200);
    });
  });

  // ── Graceful degradation: never crash, never block ──────────────────────
  group('availability', () {
    test('is disabled on a build with no cloud project number', () {
      expect(service.isConfigured, isFalse);
      expect(service.isEnabled, isFalse);
    });

    test('warmUp resolves false instead of throwing when disabled', () async {
      await expectLater(service.warmUp(), completion(isFalse));
      expect(
        service.lastUnavailableReason,
        anyOf(
          IntegrityUnavailableReason.unsupportedPlatform,
          IntegrityUnavailableReason.notConfigured,
          IntegrityUnavailableReason.disabled,
        ),
      );
    });

    test('credentialsFor returns null instead of throwing when disabled', () async {
      final credentials = await service.credentialsFor(
        method: 'POST',
        path: '/api/v1/customer/wallet/topup',
      );
      expect(credentials, isNull);
    });

    test('never contacts the native channel when disabled', () async {
      await service.credentialsFor(
        method: 'POST',
        path: '/api/v1/customer/wallet/topup',
      );
      expect(native.calls, isEmpty);
    });
  }, skip: unconfigured ? false : configuredSkip);

  // ── The route allowlist ──────────────────────────────────────────────────
  group('protected routes', () {
    test('declares at least one protected route', () {
      expect(IntegrityProtectedRoutes.routeCount, greaterThan(0));
    });

    test('leaves read-only and browsing traffic alone', () {
      for (final path in _readOnlyPaths) {
        expect(
          IntegrityProtectedRoutes.requiresIntegrity('GET', path),
          isFalse,
          reason: '$path should not require an integrity token',
        );
      }
    });

    test('covers every sensitive operation', () {
      for (final entry in _protectedSamples.entries) {
        expect(
          IntegrityProtectedRoutes.requiresIntegrity(entry.value, entry.key),
          isTrue,
          reason: '${entry.value} ${entry.key} should require an integrity token',
        );
      }
    });

    test('does not match a protected path under a different method', () {
      for (final entry in _protectedSamples.entries) {
        final wrongMethod = entry.value == 'POST' ? 'GET' : 'GET';
        expect(
          IntegrityProtectedRoutes.requiresIntegrity(wrongMethod, entry.key),
          isFalse,
          reason: '$wrongMethod ${entry.key} should not require a token',
        );
      }
    });
  });

  // ── The Dio interceptor ─────────────────────────────────────────────────
  group('IntegrityInterceptor', () {
    late Dio dio;
    late List<RequestOptions> seen;

    setUp(() {
      seen = <RequestOptions>[];
      dio = Dio(BaseOptions(baseUrl: 'https://f2hfresh.com/api/v1'));
      dio.interceptors.add(
        IntegrityInterceptor(service: service, dioProvider: () => dio),
      );
      // Terminal interceptor: capture the request and answer 200 without a
      // network call.
      dio.interceptors.add(
        InterceptorsWrapper(onRequest: (options, handler) {
          seen.add(options);
          handler.resolve(
            Response<dynamic>(requestOptions: options, statusCode: 200, data: {}),
          );
        }),
      );
    });

    test('adds no integrity headers to a read-only request', () async {
      await dio.get(_sampleReadPath);
      expect(seen.single.headers.containsKey(IntegrityInterceptor.tokenHeader), isFalse);
      expect(seen.single.headers.containsKey(IntegrityInterceptor.nonceHeader), isFalse);
      expect(native.tokenRequests, isEmpty);
    });

    test('read-only requests still succeed with integrity unavailable', () async {
      final response = await dio.get(_sampleReadPath);
      expect(response.statusCode, 200);
    });

    test('marks a protected request as unavailable rather than failing it',
        () async {
      final response = await dio.post(_sampleProtectedPath, data: {'a': 1});
      expect(response.statusCode, 200);
      final headers = seen.single.headers;
      expect(headers.containsKey(IntegrityInterceptor.tokenHeader), isFalse);
      expect(headers[IntegrityInterceptor.unavailableHeader], isNotNull);
    }, skip: unconfigured ? false : configuredSkip);
  });
}

const String _sampleReadPath = '/api/v1/delivery-partner/orders/today';
const String _sampleProtectedPath = '/api/v1/delivery-partner/orders/run/RUN1/start';

const List<String> _readOnlyPaths = <String>[
  '/api/v1/delivery-partner/orders/today',
  '/api/v1/delivery-partner/orders/run/today',
  '/api/v1/delivery-partner/orders/pickup-items',
  '/api/v1/delivery-partner/basket/active',
  '/api/v1/delivery-partner/basket/summary',
  '/api/v1/delivery-partner/basket/containers/summary',
  '/api/v1/delivery-partner/profile/personal',
  '/api/v1/delivery-partner/profile/attendance',
  '/api/v1/delivery-partner/profile/leaderboard',
  '/api/v1/notifications',
];

const Map<String, String> _protectedSamples = <String, String>{
  '/api/v1/delivery-partner/orders/run/RUN1/start': 'POST',
  '/api/v1/delivery-partner/orders/run/RUN1/address/ADDR1/deliver': 'PATCH',
  '/api/v1/delivery-partner/orders/run/RUN1/handover': 'POST',
  '/api/v1/delivery-partner/orders/mark-out-for-delivery': 'POST',
  '/api/v1/delivery-partner/orders/ORD1/status': 'PATCH',
  '/api/v1/delivery-partner/orders/ORD1/upload-proof': 'POST',
  '/api/v1/delivery-partner/orders/pickup-items/confirm': 'POST',
  '/api/v1/delivery-partner/basket/reconcile': 'POST',
  '/api/v1/delivery-partner/basket/products/return-hub': 'POST',
  '/api/v1/delivery-partner/basket/containers/submit-hub': 'POST',
  '/api/v1/delivery-partner/basket/containers/submit-all': 'POST',
  '/api/v1/delivery/basket/reconcile': 'POST',
};
