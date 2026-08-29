import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

enum ToastType { success, error, info }

class F2HToast {
  static OverlayEntry? _currentEntry;

  static void show(
    BuildContext context,
    String message, {
    bool isError = false,
    bool isInfo = false,
    ToastType? type,
    String? title,
    String? actionText,
    VoidCallback? onAction,
    Duration duration = const Duration(milliseconds: 3500),
  }) {
    final overlay = Overlay.maybeOf(context);
    if (overlay == null) return;

    _currentEntry?.remove();
    _currentEntry = null;

    final resolvedType = type ??
        (isError
            ? ToastType.error
            : (isInfo ? ToastType.info : ToastType.success));

    _currentEntry = OverlayEntry(
      builder: (context) {
        final Color iconBgColor;
        final Color iconColor;
        final IconData iconData;
        final String titleText;
        final Color titleColor;
        final Color btnColor;
        final String btnText;

        switch (resolvedType) {
          case ToastType.error:
            iconBgColor = const Color(0xFFFEE2E2);
            iconColor = const Color(0xFFDC2626);
            iconData = Icons.close_rounded;
            titleText = title ?? 'Action Failed';
            titleColor = const Color(0xFF991B1B);
            btnColor = const Color(0xFFDC2626);
            btnText = actionText ?? 'Got it';
            break;
          case ToastType.info:
            iconBgColor = const Color(0xFFDCFCE7);
            iconColor = kPrimary;
            iconData = Icons.info_outline_rounded;
            titleText = title ?? 'Sign In Required';
            titleColor = const Color(0xFF166534);
            btnColor = kPrimary;
            btnText = actionText ?? 'Sign In';
            break;
          case ToastType.success:
          default:
            iconBgColor = const Color(0xFFDCFCE7);
            iconColor = const Color(0xFF16A34A);
            iconData = Icons.check_rounded;
            titleText = title ?? 'Success!';
            titleColor = const Color(0xFF166534);
            btnColor = kPrimary;
            btnText = actionText ?? 'Awesome';
            break;
        }

        return Material(
          color: Colors.black.withValues(alpha: 0.4),
          child: Center(
            child: Container(
              width: 300,
              margin: const EdgeInsets.symmetric(horizontal: 32),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 30,
                    offset: const Offset(0, 12),
                  ),
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Icon container
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: iconBgColor,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      iconData,
                      size: 32,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  // Title
                  Text(
                    titleText,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: titleColor,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 10),
                  
                  // Message
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13.5,
                      color: kTextMid,
                      fontWeight: FontWeight.w500,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  // Action Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        _currentEntry?.remove();
                        _currentEntry = null;
                        onAction?.call();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: btnColor,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 46),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        btnText,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    overlay.insert(_currentEntry!);
    
    final entryToVerify = _currentEntry;
    Future.delayed(duration, () {
      if (entryToVerify != null && entryToVerify.mounted) {
        entryToVerify.remove();
        if (_currentEntry == entryToVerify) {
          _currentEntry = null;
        }
      }
    });
  }

  static void success(
    BuildContext context,
    String message, {
    String? title,
    String? actionText,
    VoidCallback? onAction,
    Duration duration = const Duration(milliseconds: 2500),
  }) {
    show(
      context,
      message,
      type: ToastType.success,
      title: title,
      actionText: actionText,
      onAction: onAction,
      duration: duration,
    );
  }

  static void error(
    BuildContext context,
    String message, {
    String? title,
    String? actionText,
    VoidCallback? onAction,
    Duration duration = const Duration(milliseconds: 2500),
  }) {
    show(
      context,
      message,
      type: ToastType.error,
      title: title,
      actionText: actionText,
      onAction: onAction,
      duration: duration,
    );
  }

  static void info(
    BuildContext context,
    String message, {
    String? title,
    String? actionText,
    VoidCallback? onAction,
    Duration duration = const Duration(milliseconds: 3000),
  }) {
    show(
      context,
      message,
      type: ToastType.info,
      title: title,
      actionText: actionText,
      onAction: onAction,
      duration: duration,
    );
  }
}
