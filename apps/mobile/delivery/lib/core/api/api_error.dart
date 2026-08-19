// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : api_error.dart
// Description : Turns a DioException into something worth showing a partner.
//
//               Call sites used to read `e.response?.data['message']` directly.
//               That works only when the body is a JSON object: an nginx 502
//               page, a gateway timeout, or any plain-text error made the index
//               operator throw NoSuchMethodError *inside the catch block*, so
//               the real failure was replaced by a crash and the partner saw a
//               generic message with no clue what went wrong.
// ============================================================================

import 'package:dio/dio.dart';

/// Best available message for [error], falling back to [fallback].
///
/// Handles the shapes the API actually returns: `{message: "..."}`,
/// `{message: ["...", "..."]}` from class-validator, and `{error: "..."}`.
String apiErrorMessage(Object? error, String fallback) {
  if (error is! DioException) return fallback;

  final data = error.response?.data;
  if (data is Map) {
    final message = data['message'];
    if (message is List && message.isNotEmpty) {
      return message.map((e) => e.toString()).join('\n');
    }
    if (message != null && message.toString().trim().isNotEmpty) {
      return message.toString();
    }
    final alt = data['error'];
    if (alt != null && alt.toString().trim().isNotEmpty) return alt.toString();
  }

  // Connection-level problems never carry a body, and "null" helps nobody.
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return 'The server took too long to respond. Please try again.';
    case DioExceptionType.connectionError:
      return 'Cannot reach the server. Check your connection.';
    default:
      break;
  }

  final status = error.response?.statusCode;
  if (status == 401) return 'Your session has expired. Please sign in again.';
  if (status == 403) return 'You do not have access to this.';
  if (status != null && status >= 500) {
    return 'The server had a problem. Please try again shortly.';
  }
  return fallback;
}
