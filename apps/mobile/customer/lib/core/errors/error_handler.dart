import 'package:dio/dio.dart';

/// Extracts a user-friendly error message from any exception.
///
/// For [DioException], reads the `message` field from the server's
/// JSON response body (e.g. `{ "message": "Insufficient balance" }`).
/// Falls back to a generic message if unavailable.
String extractErrorMessage(Object error, {String fallback = 'Something went wrong. Please try again.'}) {
  final errorStr = error.toString();

  // 1. Handle DioException specifically
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      return data['message'].toString();
    }
    
    // Check if it's a network/connectivity/timeout issue
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.connectionError ||
        errorStr.contains('SocketException') ||
        errorStr.contains('No route to host') ||
        errorStr.contains('Connection timed out') ||
        errorStr.contains('HandshakeException')) {
      return 'Connection failed. Please check your internet connection and try again.';
    }
    return fallback;
  }

  // 2. Handle generic Exception/Error wrapping a network exception
  if (errorStr.contains('DioException') ||
      errorStr.contains('SocketException') ||
      errorStr.contains('No route to host') ||
      errorStr.contains('Connection timed out') ||
      errorStr.contains('HandshakeException') ||
      errorStr.toLowerCase().contains('connection error')) {
    return 'Connection failed. Please check your internet connection and try again.';
  }

  // 3. Handle JSON / Parsing / Type errors to avoid exposing raw stack/type details to user
  if (errorStr.contains('TypeError') ||
      errorStr.contains('Null') ||
      errorStr.contains('FormatException') ||
      errorStr.contains('NoSuchMethodError') ||
      errorStr.contains('subtype of') ||
      errorStr.contains('Error parsing')) {
    return 'Data loading error. Please try again.';
  }

  // 4. Strip common exception prefixes if any
  String cleanMsg = errorStr;
  if (cleanMsg.startsWith('Exception: ')) {
    cleanMsg = cleanMsg.substring('Exception: '.length);
  }

  return cleanMsg.isNotEmpty ? cleanMsg : fallback;
}
