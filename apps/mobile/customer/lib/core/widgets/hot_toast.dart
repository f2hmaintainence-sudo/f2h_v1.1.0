import 'package:flutter/material.dart';

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
    Duration duration = const Duration(milliseconds: 3200),
  }) {
    final overlay = Overlay.maybeOf(context);
    if (overlay == null) return;

    _currentEntry?.remove();
    _currentEntry = null;

    final resolvedType = type ??
        (isError
            ? ToastType.error
            : (isInfo ? ToastType.info : ToastType.success));

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (context) {
        return _ToastOverlayWidget(
          message: message,
          title: title,
          type: resolvedType,
          actionText: actionText,
          onAction: onAction,
          duration: duration,
          onDismiss: () {
            if (_currentEntry == entry) {
              _currentEntry?.remove();
              _currentEntry = null;
            }
          },
        );
      },
    );

    _currentEntry = entry;
    overlay.insert(entry);
  }

  static void success(
    BuildContext context,
    String message, {
    String? title,
    String? actionText,
    VoidCallback? onAction,
    Duration duration = const Duration(milliseconds: 2800),
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
    Duration duration = const Duration(milliseconds: 3500),
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

class _ToastOverlayWidget extends StatefulWidget {
  final String message;
  final String? title;
  final ToastType type;
  final String? actionText;
  final VoidCallback? onAction;
  final VoidCallback onDismiss;
  final Duration duration;

  const _ToastOverlayWidget({
    required this.message,
    this.title,
    required this.type,
    this.actionText,
    this.onAction,
    required this.onDismiss,
    required this.duration,
  });

  @override
  State<_ToastOverlayWidget> createState() => _ToastOverlayWidgetState();
}

class _ToastOverlayWidgetState extends State<_ToastOverlayWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  bool _isDismissed = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -0.35),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));

    _controller.forward();

    Future.delayed(widget.duration, () {
      if (mounted && !_isDismissed) {
        _dismiss();
      }
    });
  }

  void _dismiss() {
    if (!mounted || _isDismissed) return;
    _isDismissed = true;
    _controller.reverse().then((_) {
      if (mounted) {
        widget.onDismiss();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Color primaryColor;
    final IconData iconData;
    final String defaultTitle;

    switch (widget.type) {
      case ToastType.error:
        primaryColor = const Color(0xFFDC2626);
        iconData = Icons.cancel_rounded;
        defaultTitle = 'ERROR';
        break;
      case ToastType.info:
        primaryColor = const Color(0xFF16A34A);
        iconData = Icons.info_rounded;
        defaultTitle = 'INFO';
        break;
      case ToastType.success:
      default:
        primaryColor = const Color(0xFF16A34A);
        iconData = Icons.check_circle_rounded;
        defaultTitle = 'SUCCESS';
        break;
    }

    final titleText = widget.title ?? defaultTitle;

    return SafeArea(
      child: Align(
        alignment: Alignment.topCenter,
        child: Padding(
          padding: const EdgeInsets.only(top: 16, left: 16, right: 16),
          child: SlideTransition(
            position: _slideAnimation,
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: Material(
                color: Colors.transparent,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: const Color(0xFFE2E8F0),
                        width: 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                          spreadRadius: 0,
                        ),
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Left color indicator bar
                          Container(
                            width: 5,
                            color: primaryColor,
                          ),

                          // Main Content
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  // Icon
                                  Icon(
                                    iconData,
                                    color: primaryColor,
                                    size: 22,
                                  ),
                                  const SizedBox(width: 12),

                                  // Title + Message
                                  Expanded(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          titleText.toUpperCase(),
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w800,
                                            color: primaryColor,
                                            letterSpacing: 0.4,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          widget.message,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: Color(0xFF1E293B),
                                            height: 1.35,
                                          ),
                                        ),
                                        if (widget.actionText != null &&
                                            widget.onAction != null) ...[
                                          const SizedBox(height: 4),
                                          GestureDetector(
                                            onTap: () {
                                              _dismiss();
                                              widget.onAction!();
                                            },
                                            child: Text(
                                              widget.actionText!,
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: primaryColor,
                                                decoration:
                                                    TextDecoration.underline,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),

                                  const SizedBox(width: 6),

                                  // Close button (X)
                                  IconButton(
                                    icon: const Icon(
                                      Icons.close_rounded,
                                      size: 16,
                                      color: Color(0xFF94A3B8),
                                    ),
                                    splashRadius: 16,
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(
                                      minWidth: 26,
                                      minHeight: 26,
                                    ),
                                    onPressed: _dismiss,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
