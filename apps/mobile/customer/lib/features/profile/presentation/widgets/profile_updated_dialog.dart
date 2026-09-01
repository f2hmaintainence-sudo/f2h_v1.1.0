import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

class ProfileUpdatedDialog extends StatefulWidget {
  final String title;
  final String message;
  final VoidCallback? onDismissed;

  const ProfileUpdatedDialog({
    Key? key,
    this.title = 'Profile Updated!',
    this.message = 'Your personal details have been saved successfully.',
    this.onDismissed,
  }) : super(key: key);

  static Future<void> show(
    BuildContext context, {
    String title = 'Profile Updated!',
    String message = 'Your personal details have been saved successfully.',
    VoidCallback? onDismissed,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'ProfileUpdated',
      barrierColor: Colors.black.withValues(alpha: 0.5),
      transitionDuration: const Duration(milliseconds: 280),
      pageBuilder: (context, anim1, anim2) {
        return ProfileUpdatedDialog(
          title: title,
          message: message,
          onDismissed: onDismissed,
        );
      },
      transitionBuilder: (context, anim1, anim2, child) {
        final curved = CurvedAnimation(parent: anim1, curve: Curves.easeOutBack);
        return ScaleTransition(
          scale: Tween<double>(begin: 0.85, end: 1.0).animate(curved),
          child: FadeTransition(
            opacity: anim1,
            child: child,
          ),
        );
      },
    );
  }

  @override
  State<ProfileUpdatedDialog> createState() => _ProfileUpdatedDialogState();
}

class _ProfileUpdatedDialogState extends State<ProfileUpdatedDialog> {
  Timer? _autoDismissTimer;

  @override
  void initState() {
    super.initState();
    _autoDismissTimer = Timer(const Duration(milliseconds: 3200), () {
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
        widget.onDismissed?.call();
      }
    });
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const kPrimary = Color(0xFF00754A);
    const kText = Color(0xFF1E293B);
    const kTextSub = Color(0xFF64748B);

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.86,
          constraints: const BoxConstraints(maxWidth: 380),
          margin: const EdgeInsets.symmetric(horizontal: 24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 30,
                offset: const Offset(0, 10),
                spreadRadius: 2,
              ),
            ],
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Lottie Animation Container
                    Container(
                      width: 130,
                      height: 130,
                      alignment: Alignment.center,
                      child: Lottie.asset(
                        'assets/loading/profile_updated.json',
                        width: 130,
                        height: 130,
                        fit: BoxFit.contain,
                        repeat: false,
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Title
                    Text(
                      widget.title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: kText,
                        letterSpacing: -0.3,
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Subtitle / Message
                    Text(
                      widget.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14,
                        color: kTextSub,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Primary Action Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: () {
                          _autoDismissTimer?.cancel();
                          Navigator.of(context).pop();
                          widget.onDismissed?.call();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kPrimary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text(
                          'Done',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Close Icon button on top-right
              Positioned(
                top: 12,
                right: 12,
                child: IconButton(
                  icon: const Icon(
                    Icons.close_rounded,
                    size: 20,
                    color: Color(0xFF94A3B8),
                  ),
                  splashRadius: 18,
                  onPressed: () {
                    _autoDismissTimer?.cancel();
                    Navigator.of(context).pop();
                    widget.onDismissed?.call();
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
