import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class F2HToast {
  static OverlayEntry? _currentEntry;

  static void show(
    BuildContext context,
    String message, {
    bool isError = false,
    Duration duration = const Duration(milliseconds: 3000),
  }) {
    final overlay = Overlay.maybeOf(context);
    if (overlay == null) return;

    _currentEntry?.remove();
    _currentEntry = null;

    _currentEntry = OverlayEntry(
      builder: (context) {
        final iconBgColor = isError ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7);
        final iconColor = isError ? const Color(0xFFDC2626) : const Color(0xFF16A34A);
        final titleText = isError ? 'Action Failed' : 'Success!';
        final titleColor = isError ? const Color(0xFF991B1B) : const Color(0xFF166534);
        final btnColor = isError ? const Color(0xFFDC2626) : kPrimary;
        final btnText = isError ? 'Got it' : 'Awesome';

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
                      isError ? Icons.close_rounded : Icons.check_rounded,
                      size: 32,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  // Title
                  Text(
                    titleText,
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
    Duration duration = const Duration(milliseconds: 2500),
  }) {
    show(context, message, isError: false, duration: duration);
  }

  static void error(
    BuildContext context,
    String message, {
    Duration duration = const Duration(milliseconds: 2500),
  }) {
    show(context, message, isError: true, duration: duration);
  }
}
