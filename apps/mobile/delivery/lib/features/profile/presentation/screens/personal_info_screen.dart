import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class PersonalInfoScreen extends StatefulWidget {
  const PersonalInfoScreen({super.key});

  @override
  State<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends State<PersonalInfoScreen> {
  void _openEditBottomSheet(BuildContext context) {
    final state = context.read<ProfileBloc>().state;
    if (state is! ProfileLoaded) return;

    final p = state.profile;
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(text: p.fullName);
    final emailController = TextEditingController(text: p.email);
    final dobController = TextEditingController(text: p.dateOfBirth?.split('T')[0] ?? '');
    final genderController = TextEditingController(text: p.gender ?? '');
    final addressController = TextEditingController(text: p.residentialAddress ?? '');
    final emergencyNameController = TextEditingController(text: p.emergencyContact ?? '');

    String rawEmerg = p.emergencyContactNumber ?? '';
    String initEmerg = rawEmerg.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
    if (initEmerg.length > 10) initEmerg = initEmerg.substring(0, 10);
    final emergencyPhoneController = TextEditingController(text: initEmerg);

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
                          'Edit Personal Details',
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

                    _buildEditTextField(
                      label: 'Full Name',
                      controller: nameController,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Enter full name';
                        if (val.trim().length < 2) return 'Full name must be at least 2 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    _buildEditTextField(
                      label: 'Email Address',
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Enter email address';
                        if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(val.trim())) {
                          return 'Enter a valid email address';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    _buildEditTextField(
                      label: 'Date of Birth (YYYY-MM-DD)',
                      controller: dobController,
                      readOnly: true,
                      onTap: () async {
                        final date = await showDatePicker(
                          context: dialogContext,
                          initialDate: DateTime.now().subtract(const Duration(days: 365 * 20)),
                          firstDate: DateTime(1960),
                          lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
                        );
                        if (date != null) {
                          setModalState(() {
                            dobController.text = date.toIso8601String().split('T')[0];
                          });
                        }
                      },
                      validator: (val) {
                        if (val != null && val.trim().isNotEmpty) {
                          try {
                            final dob = DateTime.parse(val.trim());
                            final now = DateTime.now();
                            final age = now.year - dob.year - ((now.month < dob.month || (now.month == dob.month && now.day < dob.day)) ? 1 : 0);
                            if (age < 18) return 'Delivery partner must be at least 18 years old';
                          } catch (_) {}
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    _buildEditTextField(
                      label: 'Gender',
                      controller: genderController,
                      placeholder: 'e.g. Male / Female',
                    ),
                    const SizedBox(height: 12),

                    _buildEditTextField(
                      label: 'Residential Address',
                      controller: addressController,
                      maxLines: 2,
                      validator: (val) {
                        if (val != null && val.trim().isNotEmpty && val.trim().length < 5) {
                          return 'Enter complete address (min 5 characters)';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    Text(
                      'Emergency Contact',
                      style: GoogleFonts.roboto(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 10),

                    _buildEditTextField(
                      label: 'Contact Name / Relationship',
                      controller: emergencyNameController,
                      placeholder: 'e.g. Brother / Ashok',
                      validator: (val) {
                        if (emergencyPhoneController.text.trim().isNotEmpty && (val == null || val.trim().length < 2)) {
                          return 'Enter emergency contact person name (min 2 characters)';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    _buildEditTextField(
                      label: 'Emergency Mobile Number',
                      controller: emergencyPhoneController,
                      keyboardType: TextInputType.phone,
                      maxLength: 10,
                      prefixText: '+91 ',
                      placeholder: '10-digit Mobile Number',
                      inputFormatters: [
                        IndianMobileNumberInputFormatter(),
                      ],
                      validator: (val) {
                        if (emergencyNameController.text.trim().isNotEmpty && (val == null || val.trim().isEmpty)) {
                          return 'Enter emergency mobile number';
                        }
                        if (val == null || val.trim().isEmpty) return null;
                        final clean = val.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
                        if (clean.length != 10) {
                          return 'Enter complete 10-digit Indian mobile number';
                        }
                        if (!RegExp(r'^[6-9]\d{9}$').hasMatch(clean)) {
                          return 'Indian mobile number must start with 6, 7, 8, or 9';
                        }
                        if (RegExp(r'^([6-9])\1{9}$').hasMatch(clean)) {
                          return 'Please enter a valid active Indian mobile number';
                        }
                        if (clean == p.phone.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '')) {
                          return 'Emergency contact cannot be your own mobile number';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: () {
                          if (formKey.currentState!.validate()) {
                            final rawEmergencyPhone = emergencyPhoneController.text.trim();
                            final cleanEmergencyPhone = rawEmergencyPhone.isEmpty
                                ? null
                                : rawEmergencyPhone.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');

                            final updates = {
                              'full_name': nameController.text.trim(),
                              'email': emailController.text.trim(),
                              'date_of_birth': dobController.text.trim().isEmpty ? null : dobController.text.trim(),
                              'gender': genderController.text.trim().isEmpty ? null : genderController.text.trim(),
                              'residential_address': addressController.text.trim().isEmpty ? null : addressController.text.trim(),
                              'emergency_contact': emergencyNameController.text.trim().isEmpty ? null : emergencyNameController.text.trim(),
                              'emergency_contact_number': cleanEmergencyPhone,
                            };

                            dialogContext.read<ProfileBloc>().add(UpdatePersonalInfoEvent(updates));
                            Navigator.pop(dialogContext);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        child: Text(
                          'Save Changes',
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

  Widget _buildEditTextField({
    required String label,
    required TextEditingController controller,
    String? placeholder,
    bool readOnly = false,
    int maxLines = 1,
    int? maxLength,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    String? prefixText,
    VoidCallback? onTap,
    AutovalidateMode autovalidateMode = AutovalidateMode.onUserInteraction,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.roboto(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF475569),
          ),
        ),
        const SizedBox(height: 5),
        TextFormField(
          controller: controller,
          readOnly: readOnly,
          maxLines: maxLines,
          maxLength: maxLength,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          autovalidateMode: autovalidateMode,
          onTap: onTap,
          validator: validator,
          style: GoogleFonts.roboto(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0F172A),
          ),
          decoration: InputDecoration(
            hintText: placeholder,
            hintStyle: GoogleFonts.roboto(fontSize: 12, color: const Color(0xFF94A3B8)),
            prefixText: prefixText,
            prefixStyle: GoogleFonts.roboto(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F172A),
            ),
            counterText: '',
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF16A34A), width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.2),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.5),
            ),
          ),
        ),
      ],
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
        } else if (state is ProfileError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: kRed,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: F2hAppBar(
          title: 'Personal Information',
          subtitle: 'View and manage your details',
          actions: [
            F2hAppBar.iconAction(Icons.person_outline_rounded),
          ],
        ),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(
                child: CircularProgressIndicator(color: kPrimary),
              );
            }
            if (state is! ProfileLoaded) {
              return const Center(child: Text('Error loading profile details'));
            }

            final p = state.profile;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                // ── PROFILE DETAILS ──────────────────────────────────────
                _buildSectionHeader('Profile Details'),
                const SizedBox(height: 10),
                _buildCard([
                  _buildDetailRow(
                    icon: Icons.person_outline_rounded,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Full Name',
                    value: p.fullName.isNotEmpty ? p.fullName : 'Not set',
                  ),
                  _buildDetailRow(
                    icon: Icons.mail_outline_rounded,
                    iconBg: const Color(0xFFDBEAFE),
                    iconColor: const Color(0xFF2563EB),
                    label: 'Email',
                    value: p.email.isNotEmpty ? p.email : 'Not set',
                  ),
                  _buildDetailRow(
                    icon: Icons.phone_android_rounded,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Mobile Number',
                    value: p.phone.isNotEmpty ? p.phone : '+91',
                  ),
                  _buildDetailRow(
                    icon: Icons.calendar_today_outlined,
                    iconBg: const Color(0xFFFFEDD5),
                    iconColor: const Color(0xFFEA580C),
                    label: 'Date of Birth',
                    value: p.dateOfBirth?.split('T')[0] ?? '',
                  ),
                  _buildDetailRow(
                    icon: Icons.wc_rounded,
                    iconBg: const Color(0xFFF3E8FF),
                    iconColor: const Color(0xFF9333EA),
                    label: 'Gender',
                    value: p.gender ?? '',
                  ),
                  _buildDetailRow(
                    icon: Icons.location_on_outlined,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Address',
                    value: p.residentialAddress ?? '',
                    isLast: true,
                  ),
                ]),

                const SizedBox(height: 20),

                // ── EMERGENCY CONTACT ────────────────────────────────────
                _buildSectionHeader('Emergency Contact'),
                const SizedBox(height: 10),
                _buildCard([
                  _buildDetailRow(
                    icon: Icons.person_outline_rounded,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Contact Name',
                    value: p.emergencyContact ?? '',
                  ),
                  _buildDetailRow(
                    icon: Icons.shield_outlined,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Relationship',
                    value: p.emergencyContact ?? 'Brother',
                  ),
                  _buildDetailRow(
                    icon: Icons.phone_android_rounded,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Mobile Number',
                    value: p.emergencyContactNumber?.isNotEmpty == true ? p.emergencyContactNumber! : '+91',
                    isLast: true,
                  ),
                ]),
              ],
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
              child: ElevatedButton(
                onPressed: () => _openEditBottomSheet(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                child: Text(
                  'Edit Information',
                  style: GoogleFonts.roboto(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: GoogleFonts.roboto(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: const Color(0xFF0F172A),
        letterSpacing: -0.2,
      ),
    );
  }

  Widget _buildCard(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String label,
    required String value,
    bool isLast = false,
  }) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: iconBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  color: iconColor,
                  size: 19,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: GoogleFonts.roboto(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    if (value.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        value,
                        style: GoogleFonts.roboto(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        if (!isLast)
          const Divider(
            height: 1,
            thickness: 1,
            indent: 68,
            endIndent: 16,
            color: Color(0xFFF1F5F9),
          ),
      ],
    );
  }
}

class IndianMobileNumberInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = newValue.text;
    if (text.isEmpty) {
      return newValue;
    }
    // Only allow digits
    final digits = text.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      return const TextEditingValue();
    }
    // First digit MUST start with 6, 7, 8, or 9
    if (!RegExp(r'^[6-9]').hasMatch(digits)) {
      return oldValue; // Rejects 0, 1, 2, 3, 4, 5 as first character
    }
    // Maximum 10 digits
    final clamped = digits.length > 10 ? digits.substring(0, 10) : digits;
    return TextEditingValue(
      text: clamped,
      selection: TextSelection.collapsed(offset: clamped.length),
    );
  }
}
