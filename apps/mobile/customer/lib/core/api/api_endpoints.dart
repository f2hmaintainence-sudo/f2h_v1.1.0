// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : api_endpoints.dart
// Description : Versioned API endpoint definitions for the F2H Customer app.
//               All paths resolve under /api/v1/ via the baseUrl prefix.
//               Compact header values (C, D, ac, ic …) are sent by DioClient.
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
    if (kIsWeb) {
      return 'https://f2hfresh.com';
    }
     return 'http://192.168.1.6:5001';
  }

  /// Root host (scheme + host + port), no trailing slash.
  static String get host => _envBaseUrl.isNotEmpty ? _envBaseUrl : _devBaseUrl;

  /// Full versioned API prefix — all endpoints append to this.
  static String get apiBaseUrl => '$host/api/v1';
  static String get baseUrl => apiBaseUrl;

  // ---------------------------------------------------------------------------
  // Auth  →  /api/v1/auth/…
  // ---------------------------------------------------------------------------
  static const String _auth = '/auth';
  static const String csrfToken = '/csrf/token';
  static const String login = '$_auth/login';
  static const String register = '$_auth/register';
  static const String sendOtp = '$_auth/send-otp';
  static const String verifyOtp = '$_auth/verify-otp';
  static const String forgotPassword = '$_auth/forgot-password';
  static const String forgotPasswordSms = '$_auth/forgot-password-sms';
  static const String resetPassword = '$_auth/reset-password';
  static const String refreshToken = '$_auth/refresh';
  static const String logout = '$_auth/logout';
  static const String sessionInfo = '$_auth/session-info';
  static const String googleAuth = '$_auth/google';
  static const String googleAuthCallback = '$_auth/google/callback';

  // ---------------------------------------------------------------------------
  // Customer panel  →  /api/v1/customer/…
  // ---------------------------------------------------------------------------
  static const String _customer = '/customer';
  static const String customerBootstrap = '$_customer/bootstrap';
  static const String customerAssets = '$_customer/assets';
  static const String wallet = '$_customer/wallet';
  static const String walletTopup = '$wallet/topup';
  static const String customerWalletTopup = walletTopup;
  static const String walletTransactions = '$wallet/transactions';
  static const String customerWalletTransactions = walletTransactions;
  static const String customerWallet = wallet;
  static const String packages = '$_customer/package/balance';
  static const String customerPakages = packages;
  static const String packageTransactions = '$_customer/package/transactions';
  static const String customerPakagesTransactions = packageTransactions;
  static const String categories = '$_customer/categories';
  static const String banners = '$_customer/banners';
  static const String promoBanners = '$_customer/promo-banners';
  static const String customerCategory = '$_customer/category';
  static const String products = '$_customer/products';
  static const String orders = '$_customer/orders';
  static const String checkOut = '$_customer/checkout/payment';

  // Razorpay checkout. These routes exist on the API (customer/payment/*) but
  // the constants were missing, so payment_service.dart did not compile.
  static const String paymentConfig      = '$_customer/payment/config';
  static const String paymentCreateOrder = '$_customer/payment/create-order';
  static const String paymentVerify      = '$_customer/payment/verify';
  static const String paymentHistory     = '$_customer/payment/history';
  static const String paymentUnpaidBills = '$_customer/payment/unpaid-bills';
  static const String subscriptions = '$_customer/subscriptions';
  static const String subscriptionCheckout =
      '$_customer/subscriptions/checkout';
  static const String subscriptionCalendar =
      '$_customer/subscriptions/subscription-calender/';
  static const String cancelSubscriptionItem =
      '$_customer/subscriptions/subscription-items/';
  static String subscriptionSkip(String id) =>
      '$_customer/subscriptions/$id/skip';
  static String subscriptionOverride(String id) =>
      '$_customer/subscriptions/$id/override';
  static String subscriptionTomorrow(String id) =>
      '$_customer/subscriptions/$id/tomorrow';
  static String subscriptionCalendarEnhanced(String id) =>
      '$_customer/subscriptions/$id/calendar';
  static String subscriptionAddItem(String id) =>
      '$_customer/subscriptions/$id/add-item';
  static String subscriptionAddress(String id) =>
      '$_customer/subscriptions/$id/address';
  static String orderTracking(String id) => '$_customer/orders/$id/tracking';
  static const String cartSync = '$_customer/cart-sync';
  static const String cartItems = '$_customer/cart-items';
  static const String cartData = cartItems;
  static const String customerBills = '$_customer/orders/bills';
  static String receipt(String id) => '/receipt/$id';
  static String receiptPdf(String id) => '$host/api/v1/receipt/pdf/$id';

  // Referrals  →  /api/v1/customer/referrals/…
  static const String customerReferrals = '$_customer/referrals/dashboard';
  static const String validateReferralCode = '$_customer/referrals/validate';
  static const String referralHistory = '$_customer/referrals/history';
  static const String referralDetails = '$_customer/referrals/details';

  // ---------------------------------------------------------------------------
  // App version & device  →  /api/v1/device/…
  // ---------------------------------------------------------------------------
  /// Force-update check. The route lives at the versioned root (`@Get('app-version')`),
  /// not under `/device` — the old value 404'd, so version checking never ran.
  static const String appVersion = '/app-version';
  static const String deviceInformation = '/device/deviceInformation';

  // ---------------------------------------------------------------------------
  // Notifications  →  /api/v1/notifications/…
  // ---------------------------------------------------------------------------
  static const String notifications = '/notifications';
  static const String notificationsWithCount = '/notifications/with-count';
  static const String notificationsMarkAll = '/notifications/mark-all/read';
  static const String notificationsMarkAllRead = notificationsMarkAll;
  static const String notificationsDismissAll = '/notifications/dismiss-all';
  static String notificationMarkRead(int id) => '/notifications/$id/read';
  static String notificationDismiss(int id) => '/notifications/$id/dismiss';
}
