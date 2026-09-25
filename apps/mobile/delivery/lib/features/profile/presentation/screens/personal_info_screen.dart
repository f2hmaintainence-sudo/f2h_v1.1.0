import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/data/profile_repository.dart';
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
    final repository = sl<ProfileRepository>();
    final profileBloc = context.read<ProfileBloc>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (modalContext) => _EditPersonalDetailsModal(
        profile: p,
        repository: repository,
        profileBloc: profileBloc,
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
                    value: p.fullName.isNotEmpty ? p.fullName : '—',
                  ),
                  _buildDetailRow(
                    icon: Icons.mail_outline_rounded,
                    iconBg: const Color(0xFFDBEAFE),
                    iconColor: const Color(0xFF2563EB),
                    label: 'Email',
                    value: p.email.isNotEmpty ? p.email : '—',
                  ),
                  _buildDetailRow(
                    icon: Icons.phone_android_rounded,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Mobile Number',
                    value: p.phone.isNotEmpty ? p.phone : '—',
                  ),
                  _buildDetailRow(
                    icon: Icons.calendar_today_rounded,
                    iconBg: const Color(0xFFFFEDD5),
                    iconColor: const Color(0xFFEA580C),
                    label: 'Date of Birth',
                    value: (p.dateOfBirth != null && p.dateOfBirth!.isNotEmpty)
                        ? p.dateOfBirth!.split('T')[0]
                        : '—',
                  ),
                  _buildDetailRow(
                    icon: Icons.wc_rounded,
                    iconBg: const Color(0xFFF3E8FF),
                    iconColor: const Color(0xFF9333EA),
                    label: 'Gender',
                    value: (p.gender != null && p.gender!.isNotEmpty) ? p.gender! : '—',
                  ),
                  _buildDetailRow(
                    icon: Icons.location_on_outlined,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Address',
                    value: (p.residentialAddress != null && p.residentialAddress!.isNotEmpty)
                        ? p.residentialAddress!
                        : '—',
                    isLast: true,
                  ),
                ]),

                const SizedBox(height: 24),

                // ── EMERGENCY CONTACT ────────────────────────────────────
                _buildSectionHeader('Emergency Contact'),
                const SizedBox(height: 10),
                _buildCard([
                  _buildDetailRow(
                    icon: Icons.person_pin_outlined,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Contact Name',
                    value: (p.emergencyContact != null && p.emergencyContact!.isNotEmpty)
                        ? p.emergencyContact!
                        : '—',
                  ),
                  _buildDetailRow(
                    icon: Icons.phone_android_rounded,
                    iconBg: const Color(0xFFDCFCE7),
                    iconColor: const Color(0xFF16A34A),
                    label: 'Emergency Mobile Number',
                    value: (p.emergencyContactNumber != null &&
                            p.emergencyContactNumber!.isNotEmpty)
                        ? p.emergencyContactNumber!
                        : '—',
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
                    const SizedBox(height: 2),
                    Text(
                      value.isEmpty ? '—' : value,
                      style: GoogleFonts.roboto(
                        fontSize: 13.5,
                        fontWeight: (value.isEmpty || value == '—' || value == 'Not set')
                            ? FontWeight.w500
                            : FontWeight.w700,
                        color: (value.isEmpty || value == '—' || value == 'Not set')
                            ? const Color(0xFF94A3B8)
                            : const Color(0xFF0F172A),
                      ),
                    ),
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

// ─── EDIT PERSONAL DETAILS MODAL (WITH INLINE OTP REQUEST & VERIFICATION) ──────

class _EditPersonalDetailsModal extends StatefulWidget {
  final ProfileModel profile;
  final ProfileRepository repository;
  final ProfileBloc profileBloc;

  const _EditPersonalDetailsModal({
    required this.profile,
    required this.repository,
    required this.profileBloc,
  });

  @override
  State<_EditPersonalDetailsModal> createState() => _EditPersonalDetailsModalState();
}

class _EditPersonalDetailsModalState extends State<_EditPersonalDetailsModal> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  late final TextEditingController _dobController;
  late final TextEditingController _addressController;
  late final TextEditingController _emergencyNameController;
  late final TextEditingController _emergencyPhoneController;

  late final String _initialEmail;
  late final String _initialPhone;

  String _selectedGender = 'Male';

  // Email OTP state
  bool _isSendingEmailOtp = false;
  bool _isEmailOtpSent = false;
  bool _isVerifyingEmailOtp = false;
  bool _isEmailVerified = false;
  String? _emailVerificationToken;
  String? _emailOtpError;
  int _emailCountdown = 0;
  Timer? _emailTimer;
  final TextEditingController _emailOtpController = TextEditingController();

  // Phone OTP state
  bool _isSendingPhoneOtp = false;
  bool _isPhoneOtpSent = false;
  bool _isVerifyingPhoneOtp = false;
  bool _isPhoneVerified = false;
  String? _phoneVerificationToken;
  String? _phoneOtpError;
  int _phoneCountdown = 0;
  Timer? _phoneTimer;
  final TextEditingController _phoneOtpController = TextEditingController();

  String? _generalError;

  @override
  void initState() {
    super.initState();
    final p = widget.profile;
    _nameController = TextEditingController(text: p.fullName);

    _initialEmail = p.email.trim().toLowerCase();
    _emailController = TextEditingController(text: p.email);

    String rawPhone = p.phone;
    _initialPhone = rawPhone.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
    if (_initialPhone.length > 10) _initialPhone = _initialPhone.substring(0, 10);
    _phoneController = TextEditingController(text: _initialPhone);

    _dobController = TextEditingController(text: p.dateOfBirth?.split('T')[0] ?? '');
    if (p.gender != null && p.gender!.isNotEmpty) {
      _selectedGender = ['Male', 'Female', 'Other', 'Prefer not to say'].firstWhere(
        (g) => g.toLowerCase() == p.gender!.toLowerCase().trim(),
        orElse: () => 'Male',
      );
    }
    _addressController = TextEditingController(text: p.residentialAddress ?? '');
    _emergencyNameController = TextEditingController(text: p.emergencyContact ?? '');

    String rawEmerg = p.emergencyContactNumber ?? '';
    String initEmerg = rawEmerg.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
    if (initEmerg.length > 10) initEmerg = initEmerg.substring(0, 10);
    _emergencyPhoneController = TextEditingController(text: initEmerg);
  }

  @override
  void dispose() {
    _emailTimer?.cancel();
    _phoneTimer?.cancel();
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _dobController.dispose();
    _addressController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _emailOtpController.dispose();
    _phoneOtpController.dispose();
    super.dispose();
  }

  bool get _isEmailChanged {
    final current = _emailController.text.trim().toLowerCase();
    return current.isNotEmpty && current != _initialEmail;
  }

  bool get _isPhoneChanged {
    final clean = _phoneController.text.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
    return clean.isNotEmpty && clean != _initialPhone;
  }

  void _startEmailCountdown() {
    _emailTimer?.cancel();
    setState(() => _emailCountdown = 60);
    _emailTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_emailCountdown > 0) {
        setState(() => _emailCountdown--);
      } else {
        timer.cancel();
      }
    });
  }

  void _startPhoneCountdown() {
    _phoneTimer?.cancel();
    setState(() => _phoneCountdown = 60);
    _phoneTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_phoneCountdown > 0) {
        setState(() => _phoneCountdown--);
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _sendEmailOtp() async {
    final cleanEmail = _emailController.text.trim().toLowerCase();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(cleanEmail)) {
      setState(() => _emailOtpError = 'Enter a valid email address first');
      return;
    }

    setState(() {
      _isSendingEmailOtp = true;
      _emailOtpError = null;
      _generalError = null;
    });

    try {
      await widget.repository.sendUpdateOtp(type: 'email', value: cleanEmail);
      if (mounted) {
        setState(() {
          _isSendingEmailOtp = false;
          _isEmailOtpSent = true;
          _emailOtpController.clear();
        });
        _startEmailCountdown();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSendingEmailOtp = false;
          _emailOtpError = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  Future<void> _verifyEmailOtp() async {
    final cleanEmail = _emailController.text.trim().toLowerCase();
    final otp = _emailOtpController.text.trim();

    if (otp.length != 6) {
      setState(() => _emailOtpError = 'Enter complete 6-digit OTP');
      return;
    }

    setState(() {
      _isVerifyingEmailOtp = true;
      _emailOtpError = null;
      _generalError = null;
    });

    try {
      final token = await widget.repository.verifyUpdateOtp(
        type: 'email',
        value: cleanEmail,
        otp: otp,
      );
      if (mounted) {
        setState(() {
          _isVerifyingEmailOtp = false;
          _isEmailVerified = true;
          _emailVerificationToken = token;
          _emailOtpError = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isVerifyingEmailOtp = false;
          _emailOtpError = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  Future<void> _sendPhoneOtp() async {
    final cleanPhone = _phoneController.text.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
    if (cleanPhone.length != 10 || !RegExp(r'^[6-9]\d{9}$').hasMatch(cleanPhone)) {
      setState(() => _phoneOtpError = 'Enter a valid 10-digit mobile number first');
      return;
    }

    setState(() {
      _isSendingPhoneOtp = true;
      _phoneOtpError = null;
      _generalError = null;
    });

    try {
      await widget.repository.sendUpdateOtp(type: 'phone', value: cleanPhone);
      if (mounted) {
        setState(() {
          _isSendingPhoneOtp = false;
          _isPhoneOtpSent = true;
          _phoneOtpController.clear();
        });
        _startPhoneCountdown();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSendingPhoneOtp = false;
          _phoneOtpError = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  Future<void> _verifyPhoneOtp() async {
    final cleanPhone = _phoneController.text.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
    final otp = _phoneOtpController.text.trim();

    if (otp.length != 6) {
      setState(() => _phoneOtpError = 'Enter complete 6-digit OTP');
      return;
    }

    setState(() {
      _isVerifyingPhoneOtp = true;
      _phoneOtpError = null;
      _generalError = null;
    });

    try {
      final token = await widget.repository.verifyUpdateOtp(
        type: 'phone',
        value: cleanPhone,
        otp: otp,
      );
      if (mounted) {
        setState(() {
          _isVerifyingPhoneOtp = false;
          _isPhoneVerified = true;
          _phoneVerificationToken = token;
          _phoneOtpError = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isVerifyingPhoneOtp = false;
          _phoneOtpError = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  void _onSaveChanges() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Check if email changed and not verified
    if (_isEmailChanged && !_isEmailVerified) {
      setState(() {
        _generalError = 'Please request and verify the OTP for your new Email Address before saving.';
      });
      return;
    }

    // Check if phone changed and not verified
    if (_isPhoneChanged && !_isPhoneVerified) {
      setState(() {
        _generalError = 'Please request and verify the OTP for your new Mobile Number before saving.';
      });
      return;
    }

    final rawEmergencyPhone = _emergencyPhoneController.text.trim();
    final cleanEmergencyPhone = rawEmergencyPhone.isEmpty
        ? null
        : rawEmergencyPhone.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');

    final cleanPhone = _phoneController.text.trim().replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
    final cleanEmail = _emailController.text.trim().toLowerCase();

    final updates = <String, dynamic>{
      'full_name': _nameController.text.trim(),
      'email': cleanEmail,
      'phone': cleanPhone,
      'date_of_birth': _dobController.text.trim().isEmpty ? null : _dobController.text.trim(),
      'gender': _selectedGender,
      'residential_address': _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
      'emergency_contact': _emergencyNameController.text.trim().isEmpty ? null : _emergencyNameController.text.trim(),
      'emergency_contact_number': cleanEmergencyPhone,
    };

    if (_emailVerificationToken != null) {
      updates['email_verification_token'] = _emailVerificationToken;
    }
    if (_phoneVerificationToken != null) {
      updates['phone_verification_token'] = _phoneVerificationToken;
    }
    if (_emailOtpController.text.trim().isNotEmpty) {
      updates['email_otp'] = _emailOtpController.text.trim();
    }
    if (_phoneOtpController.text.trim().isNotEmpty) {
      updates['phone_otp'] = _phoneOtpController.text.trim();
    }

    widget.profileBloc.add(UpdatePersonalInfoEvent(updates));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
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
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Full Name
              _buildEditTextField(
                label: 'Full Name',
                controller: _nameController,
                placeholder: 'Enter full name',
                maxLength: 50,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r"[a-zA-Z\s\.\-']")),
                ],
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Enter full name';
                  final clean = val.trim();
                  if (clean.length < 2) return 'Full name must be at least 2 characters';
                  if (clean.length > 50) return 'Full name cannot exceed 50 characters';
                  if (!RegExp(r"^[a-zA-Z\s\.\-']+$").hasMatch(clean)) {
                    return 'Name can only contain letters and spaces';
                  }
                  if (RegExp(r'\d').hasMatch(clean)) {
                    return 'Name cannot contain numbers';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // ── EMAIL FIELD WITH INLINE OTP BUTTON & VERIFICATION ────────
              _buildEmailSection(),
              const SizedBox(height: 12),

              // ── MOBILE FIELD WITH INLINE OTP BUTTON & VERIFICATION ───────
              _buildPhoneSection(),
              const SizedBox(height: 12),

              // Date of Birth
              _buildEditTextField(
                label: 'Date of Birth (YYYY-MM-DD)',
                controller: _dobController,
                readOnly: true,
                onTap: () async {
                  final initialDate = _dobController.text.trim().isNotEmpty
                      ? (DateTime.tryParse(_dobController.text.trim()) ??
                          DateTime.now().subtract(const Duration(days: 365 * 20)))
                      : DateTime.now().subtract(const Duration(days: 365 * 20));
                  final date = await showDatePicker(
                    context: context,
                    initialDate: initialDate,
                    firstDate: DateTime(1960),
                    lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
                    builder: (ctx, child) {
                      return Theme(
                        data: Theme.of(ctx).copyWith(
                          colorScheme: const ColorScheme.light(
                            primary: Color(0xFF16A34A),
                            onPrimary: Colors.white,
                            surface: Colors.white,
                            onSurface: Color(0xFF0F172A),
                          ),
                          dialogBackgroundColor: Colors.white,
                          datePickerTheme: const DatePickerThemeData(
                            backgroundColor: Colors.white,
                            headerBackgroundColor: Color(0xFF16A34A),
                            headerForegroundColor: Colors.white,
                            surfaceTintColor: Colors.transparent,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.all(Radius.circular(20)),
                            ),
                          ),
                        ),
                        child: child!,
                      );
                    },
                  );
                  if (date != null) {
                    setState(() {
                      _dobController.text = date.toIso8601String().split('T')[0];
                    });
                  }
                },
                validator: (val) {
                  if (val != null && val.trim().isNotEmpty) {
                    try {
                      final dob = DateTime.parse(val.trim());
                      final now = DateTime.now();
                      final age = now.year -
                          dob.year -
                          ((now.month < dob.month || (now.month == dob.month && now.day < dob.day)) ? 1 : 0);
                      if (age < 18) return 'Delivery partner must be at least 18 years old';
                    } catch (_) {}
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Gender Selector
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Gender',
                    style: GoogleFonts.roboto(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF475569),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _buildGenderOption(
                        label: 'Male',
                        icon: Icons.male_rounded,
                        isSelected: _selectedGender == 'Male',
                        onTap: () => setState(() => _selectedGender = 'Male'),
                      ),
                      const SizedBox(width: 8),
                      _buildGenderOption(
                        label: 'Female',
                        icon: Icons.female_rounded,
                        isSelected: _selectedGender == 'Female',
                        onTap: () => setState(() => _selectedGender = 'Female'),
                      ),
                      const SizedBox(width: 8),
                      _buildGenderOption(
                        label: 'Other',
                        icon: Icons.transgender_rounded,
                        isSelected: _selectedGender == 'Other',
                        onTap: () => setState(() => _selectedGender = 'Other'),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Residential Address
              _buildEditTextField(
                label: 'Residential Address',
                controller: _addressController,
                placeholder: 'Enter full current living address',
                maxLines: 2,
                maxLength: 250,
                validator: (val) {
                  if (val != null && val.trim().isNotEmpty) {
                    if (val.trim().length < 5) return 'Address must be at least 5 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Emergency Section Header
              Text(
                'Emergency Contact',
                style: GoogleFonts.roboto(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 10),

              // Emergency Contact Name
              _buildEditTextField(
                label: 'Contact Name / Relationship',
                controller: _emergencyNameController,
                placeholder: 'e.g. Brother / Ashok',
                maxLength: 50,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r"[a-zA-Z\s\.\-']")),
                ],
                validator: (val) {
                  if (_emergencyPhoneController.text.trim().isNotEmpty && (val == null || val.trim().isEmpty)) {
                    return 'Enter emergency contact person name';
                  }
                  if (val != null && val.trim().isNotEmpty) {
                    final clean = val.trim();
                    if (clean.length < 2) return 'Enter emergency contact name (min 2 characters)';
                    if (clean.length > 50) return 'Name cannot exceed 50 characters';
                    if (!RegExp(r"^[a-zA-Z\s\.\-']+$").hasMatch(clean)) {
                      return 'Name can only contain letters and spaces';
                    }
                    if (RegExp(r'\d').hasMatch(clean)) {
                      return 'Name cannot contain numbers';
                    }
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Emergency Mobile Number
              _buildEditTextField(
                label: 'Emergency Mobile Number',
                controller: _emergencyPhoneController,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                prefixText: '+91 ',
                placeholder: '10-digit Mobile Number',
                inputFormatters: [
                  IndianMobileNumberInputFormatter(),
                ],
                validator: (val) {
                  if (_emergencyNameController.text.trim().isNotEmpty && (val == null || val.trim().isEmpty)) {
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
                  final ownPhone = _phoneController.text.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
                  if (clean == ownPhone) {
                    return 'Emergency contact cannot be your own mobile number';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // General error banner if unverified
              if (_generalError != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFDC2626)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _generalError!,
                          style: GoogleFonts.roboto(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFFDC2626),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Save Changes button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _onSaveChanges,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: Text(
                    'Save Changes',
                    style: GoogleFonts.roboto(
                      color: Colors.white,
                      fontSize: 14.5,
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
    );
  }

  // ── EMAIL SECTION BUILDER ──────────────────────────────────────────────────
  Widget _buildEmailSection() {
    final isDiff = _isEmailChanged;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Email Address',
              style: GoogleFonts.roboto(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF475569),
              ),
            ),
            if (isDiff && _isEmailVerified)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF86EFAC)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle_rounded, size: 12, color: Color(0xFF16A34A)),
                    const SizedBox(width: 4),
                    Text(
                      'Verified',
                      style: GoogleFonts.roboto(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF15803D),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 5),

        // Text input field with inline "Get OTP" suffix button if modified
        TextFormField(
          controller: _emailController,
          readOnly: _isEmailVerified,
          keyboardType: TextInputType.emailAddress,
          style: GoogleFonts.roboto(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0F172A),
          ),
          onChanged: (val) {
            setState(() {
              _isEmailOtpSent = false;
              _isEmailVerified = false;
              _emailVerificationToken = null;
              _emailOtpError = null;
              _generalError = null;
            });
          },
          decoration: InputDecoration(
            hintText: 'Enter email address',
            hintStyle: GoogleFonts.roboto(fontSize: 12, color: const Color(0xFF94A3B8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            filled: true,
            fillColor: _isEmailVerified ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
            suffixIcon: isDiff && !_isEmailVerified
                ? Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: TextButton(
                      onPressed: (_isSendingEmailOtp || _emailCountdown > 0) ? null : _sendEmailOtp,
                      style: TextButton.styleFrom(
                        backgroundColor: const Color(0xFFEFF6FF),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: const BorderSide(color: Color(0xFFBFDBFE)),
                        ),
                      ),
                      child: _isSendingEmailOtp
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                            )
                          : Text(
                              _emailCountdown > 0
                                  ? '${_emailCountdown}s'
                                  : (_isEmailOtpSent ? 'Resend OTP' : 'Request OTP'),
                              style: GoogleFonts.roboto(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF1D4ED8),
                              ),
                            ),
                    ),
                  )
                : null,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: _isEmailVerified ? const Color(0xFF86EFAC) : const Color(0xFFE2E8F0),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF16A34A), width: 1.5),
            ),
          ),
          validator: (val) {
            if (val == null || val.trim().isEmpty) return 'Enter email address';
            if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(val.trim())) {
              return 'Enter a valid email address';
            }
            return null;
          },
        ),

        // Inline OTP input block when OTP is sent
        if (isDiff && !_isEmailVerified && _isEmailOtpSent) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F9FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBAE6FD)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.mark_email_read_outlined, size: 15, color: Color(0xFF0284C7)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Enter 6-digit OTP sent to ${_emailController.text.trim()}',
                        style: GoogleFonts.roboto(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0369A1),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 42,
                        child: TextField(
                          controller: _emailOtpController,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.roboto(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 4,
                            color: const Color(0xFF0F172A),
                          ),
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: '• • • • • •',
                            hintStyle: GoogleFonts.roboto(
                              fontSize: 14,
                              letterSpacing: 3,
                              color: const Color(0xFF94A3B8),
                            ),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Color(0xFFBAE6FD)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Color(0xFFBAE6FD)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Color(0xFF0284C7), width: 1.5),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 42,
                      child: ElevatedButton(
                        onPressed: _isVerifyingEmailOtp ? null : _verifyEmailOtp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          elevation: 0,
                        ),
                        child: _isVerifyingEmailOtp
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(
                                'Verify OTP',
                                style: GoogleFonts.roboto(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
                if (_emailOtpError != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    _emailOtpError!,
                    style: GoogleFonts.roboto(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFFDC2626),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  // ── PHONE SECTION BUILDER ──────────────────────────────────────────────────
  Widget _buildPhoneSection() {
    final isDiff = _isPhoneChanged;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Mobile Number',
              style: GoogleFonts.roboto(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF475569),
              ),
            ),
            if (isDiff && _isPhoneVerified)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF86EFAC)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle_rounded, size: 12, color: Color(0xFF16A34A)),
                    const SizedBox(width: 4),
                    Text(
                      'Verified',
                      style: GoogleFonts.roboto(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF15803D),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 5),

        // Text input field with inline "Request OTP" suffix button if modified
        TextFormField(
          controller: _phoneController,
          readOnly: _isPhoneVerified,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          inputFormatters: [
            IndianMobileNumberInputFormatter(),
          ],
          style: GoogleFonts.roboto(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0F172A),
          ),
          onChanged: (val) {
            setState(() {
              _isPhoneOtpSent = false;
              _isPhoneVerified = false;
              _phoneVerificationToken = null;
              _phoneOtpError = null;
              _generalError = null;
            });
          },
          decoration: InputDecoration(
            counterText: '',
            prefixText: '+91 ',
            prefixStyle: GoogleFonts.roboto(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F172A),
            ),
            hintText: '10-digit Mobile Number',
            hintStyle: GoogleFonts.roboto(fontSize: 12, color: const Color(0xFF94A3B8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            filled: true,
            fillColor: _isPhoneVerified ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
            suffixIcon: isDiff && !_isPhoneVerified
                ? Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: TextButton(
                      onPressed: (_isSendingPhoneOtp || _phoneCountdown > 0) ? null : _sendPhoneOtp,
                      style: TextButton.styleFrom(
                        backgroundColor: const Color(0xFFFFFBEB),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: const BorderSide(color: Color(0xFFFDE68A)),
                        ),
                      ),
                      child: _isSendingPhoneOtp
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFD97706)),
                            )
                          : Text(
                              _phoneCountdown > 0
                                  ? '${_phoneCountdown}s'
                                  : (_isPhoneOtpSent ? 'Resend OTP' : 'Request OTP'),
                              style: GoogleFonts.roboto(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFFB45309),
                              ),
                            ),
                    ),
                  )
                : null,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: _isPhoneVerified ? const Color(0xFF86EFAC) : const Color(0xFFE2E8F0),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF16A34A), width: 1.5),
            ),
          ),
          validator: (val) {
            if (val == null || val.trim().isEmpty) return 'Enter mobile number';
            final clean = val.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
            if (clean.length != 10) {
              return 'Mobile number must be exactly 10 digits';
            }
            if (!RegExp(r'^[6-9]\d{9}$').hasMatch(clean)) {
              return 'Indian mobile number must start with 6, 7, 8, or 9';
            }
            if (RegExp(r'^([6-9])\1{9}$').hasMatch(clean)) {
              return 'Please enter a valid active Indian mobile number';
            }
            return null;
          },
        ),

        // Inline OTP input block when OTP is sent
        if (isDiff && !_isPhoneVerified && _isPhoneOtpSent) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.sms_outlined, size: 15, color: Color(0xFFD97706)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Enter 6-digit OTP sent via SMS to +91 ${_phoneController.text.trim()}',
                        style: GoogleFonts.roboto(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF92400E),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 42,
                        child: TextField(
                          controller: _phoneOtpController,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.roboto(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 4,
                            color: const Color(0xFF0F172A),
                          ),
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: '• • • • • •',
                            hintStyle: GoogleFonts.roboto(
                              fontSize: 14,
                              letterSpacing: 3,
                              color: const Color(0xFF94A3B8),
                            ),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Color(0xFFFDE68A)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Color(0xFFFDE68A)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 42,
                      child: ElevatedButton(
                        onPressed: _isVerifyingPhoneOtp ? null : _verifyPhoneOtp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          elevation: 0,
                        ),
                        child: _isVerifyingPhoneOtp
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(
                                'Verify OTP',
                                style: GoogleFonts.roboto(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
                if (_phoneOtpError != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    _phoneOtpError!,
                    style: GoogleFonts.roboto(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFFDC2626),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildGenderOption({
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFDCFCE7) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
              width: isSelected ? 1.6 : 1.0,
            ),
            boxShadow: isSelected
                ? const [
                    BoxShadow(
                      color: Color(0x1816A34A),
                      blurRadius: 6,
                      offset: Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isSelected ? const Color(0xFF16A34A) : const Color(0xFF64748B),
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: GoogleFonts.roboto(
                  fontSize: 12.5,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? const Color(0xFF15803D) : const Color(0xFF334155),
                ),
              ),
            ],
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
    ValueChanged<String>? onChanged,
    Widget? trailingWidget,
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
          onChanged: onChanged,
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
        if (trailingWidget != null) trailingWidget,
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
