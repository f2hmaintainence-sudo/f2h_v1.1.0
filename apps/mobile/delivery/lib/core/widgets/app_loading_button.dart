import 'package:flutter/material.dart';

/// Reusable Action Button with Inline Loading Spinner
class AppLoadingButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final bool isLoading;
  final String label;
  final IconData? icon;
  final Color backgroundColor;
  final Color foregroundColor;
  final double height;
  final double fontSize;
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;

  const AppLoadingButton({
    super.key,
    required this.onPressed,
    this.isLoading = false,
    required this.label,
    this.icon,
    this.backgroundColor = const Color(0xFF16A34A),
    this.foregroundColor = Colors.white,
    this.height = 42,
    this.fontSize = 12.5,
    this.borderRadius,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          disabledBackgroundColor: backgroundColor.withValues(alpha: 0.6),
          disabledForegroundColor: foregroundColor.withValues(alpha: 0.8),
          elevation: 0,
          padding: padding ?? const EdgeInsets.symmetric(horizontal: 10),
          shape: RoundedRectangleBorder(
            borderRadius: borderRadius ?? BorderRadius.circular(10),
          ),
        ),
        child: isLoading
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  valueColor: AlwaysStoppedAnimation<Color>(foregroundColor),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: fontSize + 2, color: foregroundColor),
                    const SizedBox(width: 6),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: fontSize,
                        fontWeight: FontWeight.bold,
                        color: foregroundColor,
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
