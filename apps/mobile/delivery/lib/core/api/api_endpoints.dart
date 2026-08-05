// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api_endpoints.dart
// Description : Versioned API endpoint definitions for F2H Delivery App.
//               All paths resolve under /api/v1/ via the baseUrl prefix.
//
// ============================================================================

import 'package:flutter/foundation.dart';

class ApiEndpoints {
  ApiEndpoints._();

  
  // ---------------------------------------------------------------------------
  // Base URL — reads compile-time env var, falls back to local dev address.
  // Override at build time:
  //   flutter run --dart-define=F2H_API_BASE_URL=https://api.f2hfresh.com
  // ---------------------------------------------------------------------------
  static const String _envBaseUrl = String.fromEnvironment('F2H_API_BASE_URL');
  static String get _devBaseUrl {
    if (kReleaseMode && _envBaseUrl.isEmpty) {
      return 'https://f2hfresh.com';
    }
    return 'http://192.168.1.16:5001';
  }

  static String get host => _envBaseUrl.isNotEmpty ? _envBaseUrl : _devBaseUrl;

  static String get apiBaseUrl => '$host/api/v1';
  static String get baseUrl => apiBaseUrl;

  // ---------------------------------------------------------------------------
  // Auth & Session
  // ---------------------------------------------------------------------------
  static const String _auth            = '/auth';
  static const String csrfToken        = '/csrf/token';
  static const String login            = '$_auth/login';
  static const String register         = '$_auth/register';
  static const String sendOtp          = '$_auth/send-otp';
  static const String verifyOtp        = '$_auth/verify-otp';
  static const String refreshToken     = '$_auth/refresh';
  static const String logout           = '$_auth/logout';
  static const String sessionInfo      = '$_auth/session-info';
  static const String googleAuth       = '$_auth/google';
  static const String sendEmailOtp     = '$_auth/send-email-otp';
  static const String verifyEmailOtp   = '$_auth/verify-email-otp';
  static const String forgotPassword   = '$_auth/forgot-password';
  static const String resetPassword    = '$_auth/reset-password';

  // ---------------------------------------------------------------------------
  // Delivery Partner Location & SOS
  // ---------------------------------------------------------------------------
  static const String locationUpdate   = '/delivery-partner/location/update';
  static const String sos              = '/delivery-partner/location/sos';
  static const String clearSos         = '/delivery-partner/location/clear-sos';

  // ---------------------------------------------------------------------------
  // Profile & Onboarding
  // ---------------------------------------------------------------------------
  static const String profile          = '/DeliveryPartner/auth/profile';
  static const String uploadDoc        = '/DeliveryPartner/auth/upload-doc';
  static const String updateKyc        = '/DeliveryPartner/auth/update-kyc';

  static const String profilePersonal   = '/DeliveryPartner/profile/personal';
  static const String profilePhoto      = '/DeliveryPartner/profile/personal/photo';
  static const String profileDocs       = '/DeliveryPartner/profile/documents';
  static String profileDocItem(String id) => '/DeliveryPartner/profile/documents/$id';
  static const String profileVehicles   = '/DeliveryPartner/profile/vehicles';
  static String profileVehicleItem(String id) => '/DeliveryPartner/profile/vehicles/$id';
  static const String profileBank       = '/DeliveryPartner/profile/bank-accounts';
  static String profileBankItem(String id) => '/DeliveryPartner/profile/bank-accounts/$id';
  static const String profilePrefs      = '/DeliveryPartner/profile/preferences';
  static const String profileActivity   = '/DeliveryPartner/profile/activity';
  static const String profileChangePass = '/DeliveryPartner/profile/security/change-password';
  static const String profileLogoutAll  = '/DeliveryPartner/profile/security/logout-all';
  static const String profileAttendance = '/DeliveryPartner/profile/attendance';
  static const String profileAttendanceDayDetails = '/DeliveryPartner/profile/attendance/day-details';
  static const String profileLeaderboard = '/DeliveryPartner/profile/leaderboard';

  static const String profileLeaveRequests = '/DeliveryPartner/profile/leave-requests';
  static String profileLeaveRequestItem(String id) => '/DeliveryPartner/profile/leave-requests/$id';

  // ---------------------------------------------------------------------------
  // Pickup & Delivery Operations
  // ---------------------------------------------------------------------------
  static const String pickupItems            = '/delivery/orders/pickup-items';
  static const String confirmPickup          = '/delivery/orders/pickup-items/confirm';
  static const String todayDeliveries        = '/delivery/orders/today';
  static const String todayRun               = '/delivery/orders/run/today';
  static const String markOutForDelivery     = '/delivery/orders/mark-out-for-delivery';
  static String startRun(String runId) => '/delivery/orders/run/$runId/start';
  static String markStopDelivered(String runId, String addressId) =>
      '/delivery/orders/run/$runId/address/$addressId/deliver';
  static String handoverRun(String runId) => '/delivery/orders/run/$runId/handover';
  static const String updateOrderStatus = '/delivery/orders';
  static const String supportTickets = '/support-tickets';
}
