import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/models/document_model.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/editable_field.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/image_upload_field.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}

/// Strict Indian PAN Formatter:
/// - Positions 0-4 (first 5 chars): Letters (A-Z) ONLY
/// - Positions 5-8 (next 4 chars): Digits (0-9) ONLY
/// - Position 9 (10th char): Letter (A-Z) ONLY
/// - Total length: Exactly 10 characters
class PanTextInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    if (newValue.text.isEmpty) return newValue;

    final raw = newValue.text.toUpperCase();
    final buffer = StringBuffer();

    for (int i = 0; i < raw.length && i < 10; i++) {
      final char = raw[i];
      if (i < 5) {
        // Positions 0..4 MUST be A-Z
        if (RegExp(r'[A-Z]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      } else if (i < 9) {
        // Positions 5..8 MUST be 0-9
        if (RegExp(r'[0-9]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      } else if (i == 9) {
        // Position 9 MUST be A-Z
        if (RegExp(r'[A-Z]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      }
    }

    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// Strict Indian Aadhaar Formatter:
/// - First digit: 2-9 ONLY (cannot start with 0 or 1 per UIDAI)
/// - Digits only
/// - Length: 12 digits
class AadhaarTextInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    if (newValue.text.isEmpty) return newValue;

    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final buffer = StringBuffer();

    for (int i = 0; i < digits.length && i < 12; i++) {
      final char = digits[i];
      if (i == 0) {
        if (RegExp(r'[2-9]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      } else {
        buffer.write(char);
      }
    }

    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// Strict Indian Driving License Formatter:
/// - Positions 0-1: 2-letter State Code (e.g. KA, TS, AP, DL, MH)
/// - Positions 2-3: 2-digit RTO Code
/// - Positions 4-15: Alphanumeric
/// - Length: Max 16 characters
class DrivingLicenseTextInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    if (newValue.text.isEmpty) return newValue;

    final raw = newValue.text.toUpperCase().replaceAll(RegExp(r'[\s\-]'), '');
    final buffer = StringBuffer();

    for (int i = 0; i < raw.length && i < 16; i++) {
      final char = raw[i];
      if (i < 2) {
        if (RegExp(r'[A-Z]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      } else if (i < 4) {
        if (RegExp(r'[0-9]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      } else {
        if (RegExp(r'[0-9A-Z]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      }
    }

    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// Strict Indian Vehicle RC Formatter:
/// - Positions 0-1: 2-letter State Code (e.g. KA, TS, DL)
/// - Positions 2-3: 1-2 digits RTO code
/// - Positions 4+: Alphanumeric series and 4 digits (e.g. KA01AB1234)
/// - Length: Max 12 characters
class VehicleRcTextInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    if (newValue.text.isEmpty) return newValue;

    final raw = newValue.text.toUpperCase().replaceAll(RegExp(r'[\s\-]'), '');
    final buffer = StringBuffer();

    for (int i = 0; i < raw.length && i < 12; i++) {
      final char = raw[i];
      if (i < 2) {
        if (RegExp(r'[A-Z]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      } else if (i < 4) {
        if (RegExp(r'[0-9]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      } else {
        if (RegExp(r'[0-9A-Z]').hasMatch(char)) {
          buffer.write(char);
        } else {
          break;
        }
      }
    }

    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  ({String label, String idLabel, IconData icon, String placeholder, int maxLength}) _getDocumentMeta(String type) {
    switch (type) {
      case 'aadhaar':
        return (
          label: 'Aadhaar Card',
          idLabel: 'Aadhaar Number (12 Digits)',
          icon: Icons.badge_rounded,
          placeholder: '12-digit Aadhaar Number',
          maxLength: 12,
        );
      case 'pan':
        return (
          label: 'PAN Card',
          idLabel: 'PAN Number (10 Characters: 5 letters, 4 digits, 1 letter)',
          icon: Icons.credit_card_rounded,
          placeholder: 'e.g. ABCDE1234F',
          maxLength: 10,
        );
      case 'driving_license':
        return (
          label: 'Driving License',
          idLabel: 'Driving License Number',
          icon: Icons.drive_eta_rounded,
          placeholder: 'e.g. KA0120150001234',
          maxLength: 16,
        );
      case 'police_verification':
        return (
          label: 'Police Verification',
          idLabel: 'Verification Certificate Number',
          icon: Icons.verified_user_rounded,
          placeholder: 'Reference / Certificate No.',
          maxLength: 30,
        );
      case 'vehicle_rc':
        return (
          label: 'Vehicle RC',
          idLabel: 'Vehicle Registration Number',
          icon: Icons.two_wheeler_rounded,
          placeholder: 'e.g. KA01AB1234 / TS09EA1234',
          maxLength: 12,
        );
      default:
        return (
          label: 'Other Document',
          idLabel: 'Document ID Number',
          icon: Icons.description_rounded,
          placeholder: 'Document ID / Reference Number',
          maxLength: 30,
        );
    }
  }

  List<TextInputFormatter> _getInputFormattersForType(String type) {
    switch (type) {
      case 'aadhaar':
        return [
          AadhaarTextInputFormatter(),
          LengthLimitingTextInputFormatter(12),
        ];
      case 'pan':
        return [
          PanTextInputFormatter(),
          LengthLimitingTextInputFormatter(10),
        ];
      case 'driving_license':
        return [
          DrivingLicenseTextInputFormatter(),
          LengthLimitingTextInputFormatter(16),
        ];
      case 'vehicle_rc':
        return [
          VehicleRcTextInputFormatter(),
          LengthLimitingTextInputFormatter(12),
        ];
      case 'police_verification':
        return [
          FilteringTextInputFormatter.allow(RegExp(r"[a-zA-Z0-9\/\-_]")),
          UpperCaseTextFormatter(),
          LengthLimitingTextInputFormatter(30),
        ];
      default:
        return [
          LengthLimitingTextInputFormatter(30),
        ];
    }
  }

  String? _validateDocumentNumber(String type, String? val) {
    if (val == null || val.trim().isEmpty) return 'Enter document number';
    final clean = val.replaceAll(RegExp(r'\s+'), '');

    if (type == 'aadhaar') {
      if (!RegExp(r'^\d{12}$').hasMatch(clean)) {
        return 'Aadhaar number must be exactly 12 digits';
      }
      if (clean.startsWith('0') || clean.startsWith('1')) {
        return 'Aadhaar number cannot start with 0 or 1';
      }
      if (RegExp(r'^([0-9])\1{11}$').hasMatch(clean)) {
        return 'Please enter a valid 12-digit Indian Aadhaar number';
      }
    } else if (type == 'pan') {
      final cleanPan = clean.toUpperCase();
      if (cleanPan.length != 10) return 'PAN must be exactly 10 characters (e.g. ABCDE1234F)';
      if (!RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$').hasMatch(cleanPan)) {
        return 'Enter valid 10-char PAN (e.g. ABCDE1234F)';
      }
    } else if (type == 'driving_license') {
      final cleanDL = val.replaceAll(RegExp(r'[\s\-]'), '').toUpperCase();
      if (cleanDL.length < 10 || cleanDL.length > 16) {
        return 'Driving license must be 10-16 characters';
      }
      if (!RegExp(r'^[A-Z]{2}').hasMatch(cleanDL)) {
        return 'DL must start with 2-letter state code (e.g. KA, TS, DL)';
      }
      if (!RegExp(r'^[A-Z]{2}[0-9]{2}[0-9A-Z]{6,12}$').hasMatch(cleanDL)) {
        return 'Enter valid DL format (e.g. KA0120150001234)';
      }
    } else if (type == 'vehicle_rc') {
      final cleanRC = val.replaceAll(RegExp(r'[\s\-]'), '').toUpperCase();
      if (!RegExp(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$').hasMatch(cleanRC)) {
        return 'Enter valid RC number (e.g. KA01AB1234 or TS09EA1234)';
      }
    } else if (type == 'police_verification') {
      final cleanPV = val.trim();
      if (cleanPV.length < 4) return 'Verification number must be at least 4 characters';
      if (cleanPV.length > 30) return 'Verification number cannot exceed 30 characters';
      if (!RegExp(r'^[a-zA-Z0-9\/\-_]+$').hasMatch(cleanPV)) {
        return 'Verification number can only contain letters, numbers, -, /, _';
      }
    } else {
      if (val.trim().length < 3) return 'Document number must be at least 3 characters';
    }
    return null;
  }

  void _openDocumentForm(BuildContext context, {DocumentModel? document}) {
    final formKey = GlobalKey<FormState>();
    final numberController = TextEditingController(text: document?.documentNumber ?? '');
    final issueController = TextEditingController(text: document?.issueDate?.split('T')[0] ?? '');
    final expiryController = TextEditingController(text: document?.expiryDate?.split('T')[0] ?? '');

    final documentTypes = ['aadhaar', 'pan', 'driving_license', 'police_verification', 'vehicle_rc', 'other'];

    String rawType = (document?.documentType ?? 'aadhaar').toLowerCase().trim();
    if (rawType == 'rc') rawType = 'vehicle_rc';
    if (rawType == 'id_proof') rawType = 'pan';
    if (rawType == 'dl') rawType = 'driving_license';
    String selectedType = documentTypes.contains(rawType) ? rawType : 'other';

    File? frontFile;
    File? backFile;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (modalContext) => BlocProvider.value(
        value: BlocProvider.of<ProfileBloc>(context),
        child: StatefulBuilder(
          builder: (dialogContext, setModalState) => Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(dialogContext).viewInsets.bottom + 20),
            child: SingleChildScrollView(
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          document == null ? 'Upload Document Proof' : 'Update Document',
                          style: GoogleFonts.roboto(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => Navigator.pop(dialogContext),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Direct Document Type Selection Grid
                    Text(
                      'Select Document Type',
                      style: GoogleFonts.roboto(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF334155),
                      ),
                    ),
                    const SizedBox(height: 8),

                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                      childAspectRatio: 2.7,
                      children: documentTypes.map((t) {
                        final meta = _getDocumentMeta(t);
                        final isSelected = selectedType == t;
                        final isEnabled = document == null;

                        return Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: isEnabled
                                ? () {
                                    setModalState(() {
                                      selectedType = t;
                                      numberController.clear();
                                    });
                                  }
                                : null,
                            borderRadius: BorderRadius.circular(12),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFFDCFCE7) : const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
                                  width: isSelected ? 1.6 : 1.0,
                                ),
                                boxShadow: isSelected
                                    ? [
                                        BoxShadow(
                                          color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                                          blurRadius: 6,
                                          offset: const Offset(0, 2),
                                        ),
                                      ]
                                    : null,
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      meta.icon,
                                      size: 15,
                                      color: isSelected ? Colors.white : const Color(0xFF64748B),
                                    ),
                                  ),
                                  const SizedBox(width: 7),
                                  Expanded(
                                    child: Text(
                                      meta.label,
                                      style: GoogleFonts.roboto(
                                        fontSize: 11,
                                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                        color: isSelected ? const Color(0xFF15803D) : const Color(0xFF334155),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (isSelected)
                                    const Icon(
                                      Icons.check_circle_rounded,
                                      size: 15,
                                      color: Color(0xFF16A34A),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),

                    EditableField(
                      label: _getDocumentMeta(selectedType).idLabel,
                      controller: numberController,
                      placeholder: _getDocumentMeta(selectedType).placeholder,
                      maxLength: _getDocumentMeta(selectedType).maxLength,
                      keyboardType: selectedType == 'aadhaar' ? TextInputType.number : TextInputType.text,
                      textCapitalization: selectedType == 'pan' || selectedType == 'driving_license' || selectedType == 'vehicle_rc'
                          ? TextCapitalization.characters
                          : TextCapitalization.none,
                      inputFormatters: _getInputFormattersForType(selectedType),
                      validator: (val) => _validateDocumentNumber(selectedType, val),
                    ),
                    const SizedBox(height: 14),

                    Row(
                      children: [
                        Expanded(
                          child: EditableField(
                            label: 'Issue Date',
                            controller: issueController,
                            placeholder: 'YYYY-MM-DD',
                            readOnly: true,
                            validator: (val) {
                              if (val != null && val.trim().isNotEmpty) {
                                final d = DateTime.tryParse(val.trim());
                                if (d != null && d.isAfter(DateTime.now())) {
                                  return 'Issue date cannot be in future';
                                }
                              }
                              return null;
                            },
                            onTap: () async {
                              final initialDate = issueController.text.trim().isNotEmpty
                                  ? (DateTime.tryParse(issueController.text.trim()) ?? DateTime.now())
                                  : DateTime.now();
                              final date = await showDatePicker(
                                context: dialogContext,
                                initialDate: initialDate,
                                firstDate: DateTime(1990),
                                lastDate: DateTime.now(),
                                builder: (context, child) {
                                  return Theme(
                                    data: Theme.of(context).copyWith(
                                      colorScheme: const ColorScheme.light(
                                        primary: Color(0xFF16A34A),
                                        onPrimary: Colors.white,
                                        surface: Colors.white,
                                        onSurface: Color(0xFF0F172A),
                                      ),
                                      dialogBackgroundColor: Colors.white,
                                      datePickerTheme: DatePickerThemeData(
                                        backgroundColor: Colors.white,
                                        headerBackgroundColor: const Color(0xFF16A34A),
                                        headerForegroundColor: Colors.white,
                                        surfaceTintColor: Colors.transparent,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                      ),
                                    ),
                                    child: child!,
                                  );
                                },
                              );
                              if (date != null) {
                                setModalState(() {
                                  issueController.text = date.toIso8601String().split('T')[0];
                                });
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: EditableField(
                            label: selectedType == 'driving_license' ? 'Expiry Date *' : 'Expiry Date',
                            controller: expiryController,
                            placeholder: 'YYYY-MM-DD',
                            readOnly: true,
                            validator: (val) {
                              if (selectedType == 'driving_license' && (val == null || val.trim().isEmpty)) {
                                return 'Expiry date required for DL';
                              }
                              if (val != null && val.trim().isNotEmpty) {
                                final d = DateTime.tryParse(val.trim());
                                if (d != null && d.isBefore(DateTime.now())) {
                                  return 'Document has already expired';
                                }
                              }
                              return null;
                            },
                            onTap: () async {
                              final initialDate = expiryController.text.trim().isNotEmpty
                                  ? (DateTime.tryParse(expiryController.text.trim()) ?? DateTime.now().add(const Duration(days: 365)))
                                  : DateTime.now().add(const Duration(days: 365));
                              final date = await showDatePicker(
                                context: dialogContext,
                                initialDate: initialDate,
                                firstDate: DateTime.now(),
                                lastDate: DateTime(2055),
                                builder: (context, child) {
                                  return Theme(
                                    data: Theme.of(context).copyWith(
                                      colorScheme: const ColorScheme.light(
                                        primary: Color(0xFF16A34A),
                                        onPrimary: Colors.white,
                                        surface: Colors.white,
                                        onSurface: Color(0xFF0F172A),
                                      ),
                                      dialogBackgroundColor: Colors.white,
                                      datePickerTheme: DatePickerThemeData(
                                        backgroundColor: Colors.white,
                                        headerBackgroundColor: const Color(0xFF16A34A),
                                        headerForegroundColor: Colors.white,
                                        surfaceTintColor: Colors.transparent,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                      ),
                                    ),
                                    child: child!,
                                  );
                                },
                              );
                              if (date != null) {
                                setModalState(() {
                                  expiryController.text = date.toIso8601String().split('T')[0];
                                });
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    Row(
                      children: [
                        Expanded(
                          child: ImageUploadField(
                            label: 'Front Image *',
                            initialImageUrl: document?.frontImage,
                            selectedFile: frontFile,
                            onImageSelected: (file) {
                              setModalState(() {
                                frontFile = file;
                              });
                            },
                          ),
                        ),
                        if (selectedType != 'pan' && selectedType != 'police_verification') ...[
                          const SizedBox(width: 12),
                          Expanded(
                            child: ImageUploadField(
                              label: 'Back Image',
                              initialImageUrl: document?.backImage,
                              selectedFile: backFile,
                              onImageSelected: (file) {
                                setModalState(() {
                                  backFile = file;
                                });
                              },
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: () {
                          if (formKey.currentState!.validate()) {
                            if (document == null && frontFile == null) {
                              ScaffoldMessenger.of(dialogContext).showSnackBar(
                                const SnackBar(
                                  content: Text('Please upload front image of document proof'),
                                  backgroundColor: Color(0xFFDC2626),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              return;
                            }

                            final data = {
                              'document_type': selectedType,
                              'document_number': numberController.text.trim(),
                              'issue_date': issueController.text.trim().isEmpty ? null : issueController.text.trim(),
                              'expiry_date': expiryController.text.trim().isEmpty ? null : expiryController.text.trim(),
                            };

                            if (document == null) {
                              dialogContext.read<ProfileBloc>().add(
                                    AddDocumentEvent(data, frontFile: frontFile, backFile: backFile),
                                  );
                            } else {
                              dialogContext.read<ProfileBloc>().add(
                                    UpdateDocumentEvent(document.id.toString(), data, frontFile: frontFile, backFile: backFile),
                                  );
                            }
                            Navigator.pop(dialogContext);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        child: Text(
                          'Submit Verification Proof',
                          style: GoogleFonts.roboto(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded && state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.successMessage!),
              backgroundColor: kSuccess,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: F2hAppBar(
          title: 'Documents',
          subtitle: 'Upload and manage your verification proof',
          actions: [
            F2hAppBar.iconAction(Icons.description_outlined),
          ],
        ),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator(color: kPrimary));
            }
            if (state is! ProfileLoaded) {
              return const Center(child: Text('Failed to load documents list'));
            }

            final documents = state.documents;
            final verifiedCount = documents.where((d) => d.verificationStatus.toLowerCase() == 'verified').length;
            const totalRequiredDocs = 5;

            return RefreshIndicator(
              onRefresh: () async {
                context.read<ProfileBloc>().add(FetchDocumentsEvent());
              },
              color: kPrimary,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  // ── TOP STATUS BANNER ──────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: const BoxDecoration(
                            color: Color(0xFFDCFCE7),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.hourglass_top_rounded,
                            color: Color(0xFF16A34A),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$verifiedCount/$totalRequiredDocs Documents Verified',
                                style: GoogleFonts.roboto(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                verifiedCount == totalRequiredDocs
                                    ? 'All 5 documents verified. Your profile is fully approved.'
                                    : '$verifiedCount of $totalRequiredDocs documents verified. Upload remaining proofs.',
                                style: GoogleFonts.roboto(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── SECTION HEADER ─────────────────────────────────────
                  Text(
                    'Uploaded Verification Proofs',
                    style: GoogleFonts.roboto(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F172A),
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 12),

                  if (documents.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.assignment_ind_outlined, size: 54, color: Color(0xFF94A3B8)),
                          const SizedBox(height: 12),
                          Text(
                            'No Verification Proofs Found',
                            style: GoogleFonts.roboto(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Please upload identification documents (Aadhaar, PAN, DL) to verify your rider account.',
                            style: GoogleFonts.roboto(color: const Color(0xFF64748B), fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    ...documents.map((doc) => _buildDocumentCard(context, doc)),
                ],
              ),
            );
          },
        ),
        bottomNavigationBar: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
            boxShadow: [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 10,
                offset: Offset(0, -4),
              ),
            ],
          ),
          child: SafeArea(
            child: SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                label: Text(
                  'Upload Document',
                  style: GoogleFonts.roboto(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                onPressed: () => _openDocumentForm(context),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDocumentCard(BuildContext context, DocumentModel doc) {
    final status = doc.verificationStatus.toLowerCase().trim();
    final isVerified = status == 'verified';
    final isPending = status == 'pending';

    final chipBg = isVerified
        ? const Color(0xFFDCFCE7)
        : isPending
            ? const Color(0xFFFEF3C7)
            : const Color(0xFFFEE2E2);

    final chipColor = isVerified
        ? const Color(0xFF15803D)
        : isPending
            ? const Color(0xFFB45309)
            : const Color(0xFFEF4444);

    final chipLabel = isVerified
        ? 'VERIFIED'
        : isPending
            ? 'PENDING'
            : 'REJECTED';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Doc Type & Status Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                doc.documentType.toUpperCase().replaceAll('_', ' '),
                style: GoogleFonts.roboto(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF15803D),
                  letterSpacing: 0.2,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: chipBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isVerified ? Icons.check_circle_rounded : isPending ? Icons.hourglass_top_rounded : Icons.cancel_rounded,
                      size: 11,
                      color: chipColor,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      chipLabel,
                      style: GoogleFonts.roboto(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: chipColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Document Number
          Text(
            'No: ${doc.documentNumber != null && doc.documentNumber!.isNotEmpty ? doc.documentNumber! : "Not provided"}',
            style: GoogleFonts.roboto(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF0F172A),
            ),
          ),

          const SizedBox(height: 10),

          // Issue & Expiry Dates Row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Issue Date',
                      style: GoogleFonts.roboto(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    Text(
                      doc.issueDate?.split('T')[0] ?? '2026-08-04',
                      style: GoogleFonts.roboto(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Expiry Date',
                      style: GoogleFonts.roboto(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    Text(
                      doc.expiryDate?.split('T')[0] ?? '2027-08-21',
                      style: GoogleFonts.roboto(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Front & Back Image Preview Boxes
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 90,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: doc.frontImage != null && doc.frontImage!.isNotEmpty
                        ? Image.network(
                            doc.frontImage!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Center(
                              child: Icon(Icons.image_outlined, color: Color(0xFF94A3B8), size: 28),
                            ),
                          )
                        : const Center(
                            child: Icon(Icons.image_outlined, color: Color(0xFF94A3B8), size: 28),
                          ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  height: 90,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: doc.backImage != null && doc.backImage!.isNotEmpty
                        ? Image.network(
                            doc.backImage!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Center(
                              child: Icon(Icons.image_outlined, color: Color(0xFF94A3B8), size: 28),
                            ),
                          )
                        : const Center(
                            child: Icon(Icons.image_outlined, color: Color(0xFF94A3B8), size: 28),
                          ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 10),

          // Bottom Action Buttons (Remove & Replace)
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              GestureDetector(
                onTap: () {
                  context.read<ProfileBloc>().add(DeleteDocumentEvent(doc.id.toString()));
                },
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFEF4444)),
                      const SizedBox(width: 4),
                      Text(
                        'Remove',
                        style: GoogleFonts.roboto(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFEF4444),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              GestureDetector(
                onTap: () => _openDocumentForm(context, document: doc),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF16A34A)),
                      const SizedBox(width: 4),
                      Text(
                        'Replace',
                        style: GoogleFonts.roboto(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF16A34A),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
