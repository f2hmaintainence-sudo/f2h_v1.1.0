// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : play_integrity_enabled_test.dart
// Description : Play Integrity behaviour with the feature switched ON.
//
//               Requires the same build-time define the shipped app uses:
//
//                 flutter test test/play_integrity_enabled_test.dart \
//                   --dart-define=F2H_CLOUD_PROJECT_NUMBER=842214638527
//
//               Without it the whole group is skipped rather than failing,
//               so a plain `flutter test` still passes on a machine that has
//               no Play Integrity configuration.
//
//               The MethodChannel is faked, so no device, no Play Services
//               and no Google credential are involved.
// ============================================================================

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:f2h_delivery/core/api/interceptors/integrity_interceptor.dart';
import 'package:f2h_delivery/core/security/play_integrity_service.dart';

class _FakeNativeIntegrity {
  _FakeNativeIntegrity(this.channel);

  final MethodChannel channel;
  final List<MethodCall> calls = <MethodCall>[];

  bool warmUpSucceeds = true;
  int warmUpCount = 0;
  int tokenCount = 0;
  String? failNextRequestWithCode;

  void install() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      calls.add(call);
      switch (call.method) {
        case 'warmUp':
          warmUpCount++;
          if (!warmUpSucceeds) {
            throw PlatformException(code: 'PLAY_INTEGRITY_UNAVAILABLE');
          }
          return true;
        case 'requestToken':
          final failure = failNextRequestWithCode;
          if (failure != null) {
            failNextRequestWithCode = null;
            throw PlatformException(code: failure);
          }
          tokenCount++;
          // A distinct value per call, so "tokens are never reused" is testable.
          return 'integrity-token-$tokenCount';
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

  String hashOfRequest(int index) =>
      tokenRequests[index].arguments['requestHash'] as String;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel(PlayIntegrityService.channelName);
  late _FakeNativeIntegrity native;
  late PlayIntegrityService service;

  // The service only engages on Android; the host running these tests is not.
  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    native = _FakeNativeIntegrity(channel)..install();
    service = PlayIntegrityService(channel: channel);
  });

  tearDown(() {
    native.uninstall();
    debugDefaultTargetPlatformOverride = null;
  });

  final configured = const String.fromEnvironment(
    'F2H_CLOUD_PROJECT_NUMBER',
    defaultValue: '',
  ).isNotEmpty;

  const skipReason =
      'pass --dart-define=F2H_CLOUD_PROJECT_NUMBER=<project number> to run';

  group('with Play Integrity enabled', () {
    test('reports itself enabled', () {
      expect(service.isSupported, isTrue);
      expect(service.isConfigured, isTrue);
      expect(service.isEnabled, isTrue);
    });

    // ── Obtains a valid token ────────────────────────────────────────────
    test('warms up once and mints a token bound to the request', () async {
      const method = 'POST';
      const path = '/api/v1/f2h/protected';

      final credentials =
          await service.credentialsFor(method: method, path: path);

      expect(credentials, isNotNull);
      expect(credentials!.token, isNotEmpty);
      expect(credentials.nonce, isNotEmpty);
      expect(native.warmUpCount, 1);
      expect(native.tokenRequests, hasLength(1));

      // The hash handed to Play is exactly what the API will recompute.
      expect(
        native.hashOfRequest(0),
        PlayIntegrityService.buildRequestHash(
          method: method,
          path: path,
          nonce: credentials.nonce,
        ),
      );
    });

    test('passes the configured cloud project number to the native warm-up',
        () async {
      await service.warmUp();
      final warmUp = native.calls.firstWhere((c) => c.method == 'warmUp');
      expect(warmUp.arguments['cloudProjectNumber'], isNotEmpty);
    });

    // ── Tokens are never reused ──────────────────────────────────────────
    test('mints a fresh token and nonce for every request', () async {
      final first = await service.credentialsFor(
        method: 'POST',
        path: '/api/v1/f2h/protected',
      );
      final second = await service.credentialsFor(
        method: 'POST',
        path: '/api/v1/f2h/protected',
      );

      expect(first!.token, isNot(second!.token));
      expect(first.nonce, isNot(second.nonce));
      expect(native.hashOfRequest(0), isNot(native.hashOfRequest(1)));
      // The provider itself is reused: that is the only permitted caching.
      expect(native.warmUpCount, 1);
    });

    // ── Provider expiry is recovered from, once ──────────────────────────
    test('re-warms and retries when the native provider has expired', () async {
      await service.warmUp();
      native.failNextRequestWithCode = 'PLAY_INTEGRITY_NOT_WARMED';

      final credentials = await service.credentialsFor(
        method: 'POST',
        path: '/api/v1/f2h/protected',
      );

      expect(credentials, isNotNull);
      expect(native.warmUpCount, 2, reason: 'should have re-prepared once');
      expect(native.tokenRequests, hasLength(2));
    });

    test('gives up quietly when the re-warm also fails', () async {
      await service.warmUp();
      native.failNextRequestWithCode = 'PLAY_INTEGRITY_NOT_WARMED';
      native.warmUpSucceeds = false;

      final credentials = await service.credentialsFor(
        method: 'POST',
        path: '/api/v1/f2h/protected',
      );

      expect(credentials, isNull);
      expect(service.lastUnavailableReason, isNotNull);
    });

    test('returns null when Play Services cannot warm up at all', () async {
      native.warmUpSucceeds = false;
      final credentials = await service.credentialsFor(
        method: 'POST',
        path: '/api/v1/f2h/protected',
      );
      expect(credentials, isNull);
      expect(
        service.lastUnavailableReason,
        IntegrityUnavailableReason.playUnavailable,
      );
    });
  }, skip: configured ? false : skipReason);

  group('IntegrityInterceptor with Play Integrity enabled', () {
    late Dio dio;
    late _ScriptedAdapter adapter;

    setUp(() {
      adapter = _ScriptedAdapter();
      dio = Dio(BaseOptions(baseUrl: 'https://f2hfresh.com/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          IntegrityInterceptor(service: service, dioProvider: () => dio),
        );
    });

    // ── Sensitive request succeeds and carries the token ─────────────────
    test('attaches token and nonce to a protected request', () async {
      final response = await dio.post(_protectedPath, data: {'a': 1});

      expect(response.statusCode, 200);
      final headers = adapter.sentHeaders.single;
      expect(headers[IntegrityInterceptor.tokenHeader], isNotEmpty);
      expect(headers[IntegrityInterceptor.nonceHeader], isNotEmpty);
      expect(headers.containsKey(IntegrityInterceptor.unavailableHeader), isFalse);
    });

    // ── Read-only traffic pays nothing, even when fully enabled ──────────
    test('requests no token for a read-only call', () async {
      final response = await dio.get(_readPath);

      expect(response.statusCode, 200);
      expect(native.tokenRequests, isEmpty);
      expect(
        adapter.sentHeaders.single.containsKey(IntegrityInterceptor.tokenHeader),
        isFalse,
      );
    });

    // ── Rejected token: one retry with a fresh one ───────────────────────
    test('retries once with a fresh token after an integrity rejection',
        () async {
      adapter.statuses = <int>[403, 200];

      final response = await dio.post(_protectedPath, data: {'a': 1});

      expect(response.statusCode, 200);
      expect(adapter.seen, hasLength(2));
      // One token per HTTP attempt: the retry does not mint a spare.
      expect(native.tokenRequests, hasLength(2));
      expect(
        native.hashOfRequest(0),
        isNot(native.hashOfRequest(1)),
        reason: 'the retry must not replay the rejected token',
      );
      expect(
        adapter.sentHeaders[0][IntegrityInterceptor.tokenHeader],
        isNot(adapter.sentHeaders[1][IntegrityInterceptor.tokenHeader]),
        reason: 'the rejected token must not be sent again',
      );
    });

    test('surfaces the error when the retry is rejected too', () async {
      adapter.statuses = <int>[403, 403];

      await expectLater(
        dio.post(_protectedPath, data: {'a': 1}),
        throwsA(isA<DioException>()),
      );
      // Exactly one retry: no loop.
      expect(adapter.seen, hasLength(2));
      expect(native.tokenRequests, hasLength(2));
    });

    test('does not retry a 403 that is not an integrity rejection', () async {
      // An RBAC failure, not an integrity one.
      adapter.statuses = <int>[403];
      adapter.integrityErrorBody = false;

      await expectLater(
        dio.post(_protectedPath, data: {'a': 1}),
        throwsA(isA<DioException>()),
      );
      expect(adapter.seen, hasLength(1),
          reason: 'RBAC failures must not be retried');
    });

    test('does not retry a read-only route that returns 403', () async {
      adapter.statuses = <int>[403];

      await expectLater(dio.get(_readPath), throwsA(isA<DioException>()));
      expect(adapter.seen, hasLength(1));
      expect(native.tokenRequests, isEmpty);
    });

    // ── Degradation while enabled ────────────────────────────────────────
    test('still sends a protected request when the token cannot be minted',
        () async {
      native.warmUpSucceeds = false;

      final response = await dio.post(_protectedPath, data: {'a': 1});

      expect(response.statusCode, 200);
      expect(
        adapter.sentHeaders.single[IntegrityInterceptor.unavailableHeader],
        IntegrityUnavailableReason.playUnavailable,
      );
    });
  }, skip: configured ? false : skipReason);
}

/// Answers each request with the next scripted status code, so a 403 travels
/// back through the real interceptor chain exactly as it does in the app.
class _ScriptedAdapter implements HttpClientAdapter {
  final List<RequestOptions> seen = <RequestOptions>[];

  /// dio.fetch reuses the same RequestOptions instance across a retry, so the
  /// headers have to be copied at send time to compare attempt-by-attempt.
  final List<Map<String, dynamic>> sentHeaders = <Map<String, dynamic>>[];

  List<int> statuses = <int>[];
  bool integrityErrorBody = true;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    seen.add(options);
    sentHeaders.add(Map<String, dynamic>.from(options.headers));
    final status = statuses.isEmpty ? 200 : statuses.removeAt(0);
    final body = status == 403
        ? jsonEncode({
            'statusCode': 403,
            'error': 'Forbidden',
            if (integrityErrorBody)
              'code': IntegrityInterceptor.integrityErrorCode,
            'message': integrityErrorBody
                ? 'could not be verified'
                : 'Insufficient role',
          })
        : jsonEncode({'ok': true});
    return ResponseBody.fromString(
      body,
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const String _protectedPath = '/delivery-partner/basket/reconcile';
const String _readPath = '/delivery-partner/orders/today';
