// ============================================================================
// F2H Fresh — Customer App
// File        : app_input_field.dart
// Description : Unified reusable input field widget.
//               • radius 12 — clean rectangle, not pill, not over-rounded
//               • Static #F0FDF4 icon badge — no tinting on focus
//               • Only border highlights on focus (kPrimary, 1.8px)
//               • Native OutlineInputBorder — no HTML input overlay overlap
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class AppInputField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String hintText;
  final IconData? prefixIcon;
  final bool obscureText;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final void Function(String)? onSubmitted;
  final void Function(String)? onChanged;
  final String? Function(String?)? validator;
  final Widget? suffixIcon;
  final bool readOnly;
  final VoidCallback? onTap;
  final int maxLines;
  final int? maxLength;
  final String? errorText;
  final List<TextInputFormatter>? inputFormatters;

  const AppInputField({
    super.key,
    required this.controller,
    this.focusNode,
    required this.hintText,
    this.prefixIcon,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.onChanged,
    this.validator,
    this.suffixIcon,
    this.readOnly = false,
    this.onTap,
    this.maxLines = 1,
    this.maxLength,
    this.errorText,
    this.inputFormatters,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onFieldSubmitted: onSubmitted,
      onChanged: onChanged,
      validator: validator,
      readOnly: readOnly,
      onTap: onTap,
      maxLines: maxLines,
      maxLength: maxLength,
      inputFormatters: inputFormatters,
      style: GoogleFonts.poppins(
        fontSize: 14,
        color: kText,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: GoogleFonts.poppins(
          color: kMuted,
          fontSize: 13.5,
          fontWeight: FontWeight.w400,
        ),
        errorText: errorText,
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
        prefixIcon: prefixIcon != null
            ? Padding(
                padding: const EdgeInsets.fromLTRB(10, 7, 10, 7),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Icon(
                      prefixIcon,
                      size: 18,
                      color: const Color(0xFF16A34A),
                    ),
                  ),
                ),
              )
            : null,
        prefixIconConstraints: prefixIcon != null
            ? const BoxConstraints(minWidth: 56, minHeight: 50)
            : null,
        suffixIcon: suffixIcon != null
            ? Padding(
                padding: const EdgeInsets.only(right: 12),
                child: suffixIcon,
              )
            : null,
        suffixIconConstraints: suffixIcon != null
            ? const BoxConstraints(minWidth: 40, minHeight: 50)
            : null,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kBorder, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kPrimary, width: 1.8),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kRed, width: 1.2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kRed, width: 1.8),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kBorderLt, width: 1.0),
        ),
      ),
    );
  }
}
