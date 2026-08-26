import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/features/profile/presentation/screens/pakage_screen.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_history_screen.dart';
import 'package:f2h_customer/features/address/presentation/widgets/address_selector_drawer.dart';
import 'package:f2h_customer/features/profile/data/models/profile_model.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/widgets/referral_invite_card.dart';
import 'package:f2h_customer/features/profile/presentation/screens/privacy_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/terms_conditions_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/refund_policy_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/delivery_policy_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/contact_us_screen.dart';
import 'package:f2h_customer/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/profile/presentation/screens/customer_bills_screen.dart';

// ----------------------------------------------------------
//  PROFILE SCREEN - Premium farm-market design
// ----------------------------------------------------------
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const Color _marketGold = Color(0xFFFFC857);
  static const Color _marketOrange = Color(0xFFE76F24);
  static const Color _inkGreen = Color(0xFF10291F);
  static const Color _cream = Color(0xFFFFFBF0);
  static const Color _softShadow = Color(0x1A1B4332);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final state = context.read<CustomerSessionCubit>().state;
        if (state.status == CustomerSessionStatus.initial ||
            state.status == CustomerSessionStatus.failure) {
          context.read<CustomerSessionCubit>().bootstrap();
        }
      }
    });
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: kSurface,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: kRedLt,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.logout_rounded, color: kRed, size: 22),
            ),
            const SizedBox(width: 12),
            const Text(
              'Log Out',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                color: kText,
                fontSize: 20,
              ),
            ),
          ],
        ),
        content: const Text(
          'Are you sure you want to log out of your F2H account?',
          style: TextStyle(
            color: kTextMid,
            fontSize: 14,
            fontWeight: FontWeight.w500,
            height: 1.4,
          ),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: kBorder),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      color: kTextSub,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.of(ctx).pop();
                    await context.read<CustomerSessionCubit>().clear(
                      clearToken: false,
                    );
                    context.read<AuthBloc>().add(const LogoutRequested());
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kRed,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Log Out',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _openLogin(BuildContext context) {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _showLoginDrawer(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 48,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: kMuted.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              Container(
                width: 80,
                height: 80,
                decoration: const BoxDecoration(
                  color: kPrimaryPl,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.account_circle_outlined,
                  size: 40,
                  color: kPrimary,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Manage Your Account',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: kText,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Log in to view and edit your personal details, manage addresses, order history, and preferences.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: kTextSub,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    final success = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const LoginScreen(popOnSuccess: true),
                      ),
                    );
                    if (success == true && context.mounted) {
                      context.read<CustomerSessionCubit>().bootstrap();
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Log In',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showToast(
    BuildContext context,
    String message, {
    bool isError = false,
  }) {
    F2HToast.show(context, message, isError: isError);
  }

  void _showPersonalDetails(BuildContext context, ProfileModel? profile) {
    final firstNameController = TextEditingController(
      text: profile?.firstName ?? '',
    );
    final lastNameController = TextEditingController(
      text: profile?.lastName ?? '',
    );
    final emailController = TextEditingController(text: profile?.email ?? '');
    final phoneController = TextEditingController(text: profile?.mobile ?? '');
    final dobController = TextEditingController(text: profile?.dob ?? '');
    final genderController = TextEditingController(text: profile?.gender ?? '');
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            return Container(
              decoration: const BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              padding: EdgeInsets.fromLTRB(
                24,
                12,
                24,
                24 + MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 48,
                        height: 5,
                        margin: const EdgeInsets.only(bottom: 24),
                        decoration: BoxDecoration(
                          color: kMuted.withValues(alpha: 0.4),
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: kPrimaryPl,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.person_rounded,
                            color: kPrimary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Text(
                          'Personal Details',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: kText,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    _buildTextField(
                      controller: firstNameController,
                      label: 'First Name *',
                      hint: 'Enter your first name',
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                      controller: lastNameController,
                      label: 'Last Name',
                      hint: 'Enter your last name',
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                      controller: emailController,
                      label: 'Email Address *',
                      hint: 'Enter your email address',
                      icon: Icons.mail_outline,
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                      controller: phoneController,
                      label: 'Phone Number *',
                      hint: 'Enter your phone number',
                      icon: Icons.phone_android_outlined,
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 16),
                    _buildDatePickerField(
                      context: ctx,
                      controller: dobController,
                      label: 'Date of Birth',
                      icon: Icons.calendar_today_outlined,
                    ),
                    const SizedBox(height: 16),
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Gender',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: kTextSub,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _buildGenderPill(
                          sheetContext,
                          setSheetState,
                          'male',
                          'Male',
                          genderController,
                        ),
                        const SizedBox(width: 12),
                        _buildGenderPill(
                          sheetContext,
                          setSheetState,
                          'female',
                          'Female',
                          genderController,
                        ),
                        const SizedBox(width: 12),
                        _buildGenderPill(
                          sheetContext,
                          setSheetState,
                          'other',
                          'Other',
                          genderController,
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    ElevatedButton(
                      onPressed: isSaving
                          ? null
                          : () async {
                              final firstName = firstNameController.text.trim();
                              final mobile = phoneController.text.trim();
                              final email = emailController.text.trim();

                              if (firstName.isEmpty ||
                                  email.isEmpty ||
                                  mobile.isEmpty) {
                                _showToast(
                                  context,
                                  'First name, email and phone number are required',
                                  isError: true,
                                );
                                return;
                              }

                              if (email.isNotEmpty && !email.contains('@')) {
                                _showToast(
                                  context,
                                  'Please enter a valid email address',
                                  isError: true,
                                );
                                return;
                              }

                              final payload = {
                                "first_name": firstName,
                                "last_name": lastNameController.text.trim(),
                                "email": email,
                                "mobile": mobile,
                                "dob": dobController.text.trim(),
                                "gender": genderController.text.trim(),
                              };

                              setSheetState(() => isSaving = true);
                              try {
                                await context
                                    .read<CustomerSessionCubit>()
                                    .updateProfile(payload);

                                if (ctx.mounted) {
                                  Navigator.pop(ctx);
                                  _showToast(
                                    context,
                                    'Profile updated successfully',
                                  );
                                }
                              } catch (e) {
                                if (ctx.mounted) {
                                  setSheetState(() => isSaving = false);
                                }
                                final msg = extractErrorMessage(e);
                                _showToast(
                                  context,
                                  'Failed to update profile: $msg',
                                  isError: true,
                                );
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 54),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: isSaving
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Save Changes',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        color: kText,
        fontSize: 15,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: kPrimaryMid, size: 20),
        labelStyle: const TextStyle(
          color: kTextSub,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        hintStyle: const TextStyle(
          color: kMuted,
          fontWeight: FontWeight.normal,
        ),
        floatingLabelStyle: const TextStyle(
          color: kPrimary,
          fontWeight: FontWeight.bold,
        ),
        filled: true,
        fillColor: kBg,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kBorder, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kPrimary, width: 1.8),
        ),
      ),
    );
  }

  Widget _buildDatePickerField({
    required BuildContext context,
    required TextEditingController controller,
    required String label,
    required IconData icon,
  }) {
    return TextField(
      controller: controller,
      readOnly: true,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        color: kText,
        fontSize: 15,
      ),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: kPrimaryMid, size: 20),
        labelStyle: const TextStyle(
          color: kTextSub,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        floatingLabelStyle: const TextStyle(
          color: kPrimary,
          fontWeight: FontWeight.bold,
        ),
        filled: true,
        fillColor: kBg,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kBorder, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kPrimary, width: 1.8),
        ),
      ),
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: DateTime.now(),
          firstDate: DateTime(1950),
          lastDate: DateTime.now(),
          builder: (context, child) {
            return Theme(
              data: Theme.of(context).copyWith(
                colorScheme: const ColorScheme.light(
                  primary: kPrimary,
                  onPrimary: Colors.white,
                  onSurface: kText,
                ),
              ),
              child: child!,
            );
          },
        );

        if (date != null) {
          controller.text = '${date.day}-${date.month}-${date.year}';
        }
      },
    );
  }

  Widget _buildGenderPill(
    BuildContext context,
    StateSetter setSheetState,
    String value,
    String label,
    TextEditingController controller,
  ) {
    final isSelected = controller.text.toLowerCase().trim() == value;
    return Expanded(
      child: InkWell(
        onTap: () {
          setSheetState(() {
            controller.text = value;
          });
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected
                ? kPrimary.withValues(alpha: 0.08)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? kPrimary : kBorder,
              width: isSelected ? 1.8 : 1,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isSelected ? kPrimary : kTextSub,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showNotificationPrefs(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 48,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: kMuted.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.notifications_active_rounded,
                      color: kPrimary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Notification Preferences',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _buildSwitchTile(
                title: 'Push Notifications',
                subtitle: 'Daily morning delivery updates & tracking status.',
                value: true,
                onChanged: (val) {},
              ),
              const Divider(color: kBorderLt, height: 1),
              _buildSwitchTile(
                title: 'SMS Alerts',
                subtitle: 'Critical payment & wallet low balance alerts.',
                value: true,
                onChanged: (val) {},
              ),
              const Divider(color: kBorderLt, height: 1),
              _buildSwitchTile(
                title: 'WhatsApp Updates',
                subtitle:
                    'Receive invoices and delivery confirmations on WhatsApp.',
                value: false,
                onChanged: (val) {},
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: kText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: kTextSub,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Switch.adaptive(
            value: value,
            activeColor: kPrimary,
            activeTrackColor: kPrimaryLt.withValues(alpha: 0.3),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  void _showHelpCenter(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 48,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: kMuted.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.support_agent_rounded,
                      color: kPrimary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'F2H Help Center',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _buildHelpTile(
                icon: Icons.chat_bubble_outline_rounded,
                iconColor: kPrimary,
                iconBg: kPrimaryPl,
                title: 'Chat with Bot Support',
                subtitle:
                    'Resolve subscription and delivery problems instantly.',
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Starting chat support session...'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
              ),
              const SizedBox(height: 12),
              _buildHelpTile(
                icon: Icons.assignment_outlined,
                iconColor: Colors.blue,
                iconBg: const Color(0xFFE3F2FD),
                title: 'Raise a Ticket',
                subtitle: 'Our support team will resolve it within 2 hours.',
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Ticket created successfully! Ref: F2H-TKT-991.',
                      ),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHelpTile({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorderLt),
          color: kBg,
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: kText,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 11, color: kTextSub),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              color: kMuted,
              size: 14,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showWhatsAppPopup(BuildContext context) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Opening WhatsApp chat with F2H Support (+91 91487 73591)...',
        ),
        backgroundColor: Colors.teal,
        behavior: SnackBarBehavior.floating,
      ),
    );

    final url = Uri.parse('https://wa.me/919148773591');
    try {
      final launched = await launchUrl(
        url,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        final fallbackUrl = Uri.parse('whatsapp://send?phone=919148773591');
        final launchedFallback = await launchUrl(
          fallbackUrl,
          mode: LaunchMode.externalApplication,
        );
        if (!launchedFallback) {
          throw 'Could not launch WhatsApp link or fallback';
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open WhatsApp: $e'),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is Unauthenticated) {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const LoginScreen()),
            (route) => false,
          );
        }
      },
      child: BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
        builder: (context, state) {
          final profile = state.profile;
          final isLoggedIn =
              (authState is Authenticated || profile != null) &&
              state.status != CustomerSessionStatus.unauthenticated;
          String customerName = 'Guest';
          String customerMobile = 'Login to unlock your dashboard';
          String customerInfo = 'NORMAL';
          String customerEmail = 'Fresh market essentials, delivered daily';

          if (profile != null) {
            final displayName = profile.name.trim();
            customerName = displayName.isNotEmpty
                ? displayName
                : (profile.firstName.trim().isNotEmpty
                      ? profile.firstName.trim()
                      : (profile.mobile.isNotEmpty
                            ? profile.mobile
                            : 'Customer'));
            customerMobile = profile.mobile;
            customerEmail = profile.email.isNotEmpty
                ? profile.email
                : 'Complete your email for faster support';

            customerInfo = profile.isMember ? 'VIP MEMBER' : 'NORMAL';
          }

          return Scaffold(
            backgroundColor: kBg,
            body: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                // App bar
                SliverAppBar(
                  backgroundColor: kBg,
                  surfaceTintColor: Colors.transparent,
                  elevation: 0,
                  pinned: true,
                  titleSpacing: 24,
                  title: const Text(
                    'My Profile',
                    style: TextStyle(
                      color: _inkGreen,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                  actions: [
                    IconButton(
                      onPressed: () => _showHelpCenter(context),
                      icon: const Icon(Icons.support_agent_rounded, size: 22),
                      color: kPrimary,
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white,
                        padding: const EdgeInsets.all(12),
                        side: const BorderSide(color: kBorderLt, width: 1.2),
                        shadowColor: Colors.black.withValues(alpha: 0.04),
                        elevation: 4,
                      ),
                    ),
                    const SizedBox(width: 20),
                  ],
                ),

                SliverToBoxAdapter(
                  child: Column(
                    children: [
                      // Profile header card with modern glassmorphic layout
                      Container(
                        margin: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                        clipBehavior: Clip.antiAlias,
                        decoration: BoxDecoration(
                          gradient: profile?.isMember == true
                              ? const LinearGradient(
                                  colors: [
                                    Color(
                                      0xFF0F2015,
                                    ), // Luxury Deep Emerald/Obsidian
                                    Color(0xFF1B3D2A), // Forest Emerald
                                    Color(0xFF133220), // Rich Dark Green
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : const LinearGradient(
                                  colors: [
                                    Color(0xFF0D331E),
                                    kPrimary,
                                    kPrimaryMid,
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(
                            color: profile?.isMember == true
                                ? const Color(
                                    0xFFFFD700,
                                  ).withValues(alpha: 0.35)
                                : Colors.white.withValues(alpha: 0.2),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: profile?.isMember == true
                                  ? const Color(
                                      0xFF16A34A,
                                    ).withValues(alpha: 0.2)
                                  : kPrimary.withValues(alpha: 0.15),
                              blurRadius: 24,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Stack(
                          children: [
                            // Background Watermark Decor
                            Positioned(
                              right: -15,
                              bottom: -20,
                              child: Icon(
                                profile?.isMember == true
                                    ? Icons.workspace_premium_rounded
                                    : Icons.eco_rounded,
                                size: 140,
                                color: profile?.isMember == true
                                    ? const Color(
                                        0xFFFFD700,
                                      ).withValues(alpha: 0.07)
                                    : Colors.white.withValues(alpha: 0.05),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(22),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      // Avatar Ring
                                      Stack(
                                        children: [
                                          Container(
                                            width: 70,
                                            height: 70,
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                colors:
                                                    profile?.isMember == true
                                                    ? [
                                                        const Color(0xFFFFD700),
                                                        const Color(0xFFB8860B),
                                                      ]
                                                    : [
                                                        Colors.white,
                                                        Colors.white.withValues(
                                                          alpha: 0.4,
                                                        ),
                                                      ],
                                                begin: Alignment.topLeft,
                                                end: Alignment.bottomRight,
                                              ),
                                              shape: BoxShape.circle,
                                              boxShadow: [
                                                BoxShadow(
                                                  color:
                                                      profile?.isMember == true
                                                      ? const Color(
                                                          0xFFFFD700,
                                                        ).withValues(
                                                          alpha: 0.35,
                                                        )
                                                      : Colors.black.withValues(
                                                          alpha: 0.1,
                                                        ),
                                                  blurRadius: 10,
                                                  offset: const Offset(0, 4),
                                                ),
                                              ],
                                            ),
                                            padding: const EdgeInsets.all(2.5),
                                            child: Container(
                                              decoration: const BoxDecoration(
                                                color: Colors.white,
                                                shape: BoxShape.circle,
                                              ),
                                              child: Center(
                                                child: Text(
                                                  customerName.isNotEmpty
                                                      ? customerName[0]
                                                            .toUpperCase()
                                                      : 'G',
                                                  style: TextStyle(
                                                    fontSize: 28,
                                                    fontWeight: FontWeight.w900,
                                                    color:
                                                        profile?.isMember ==
                                                            true
                                                        ? const Color(
                                                            0xFF133220,
                                                          )
                                                        : kPrimary,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                          if (profile?.isMember == true)
                                            Positioned(
                                              top: 0,
                                              right: 0,
                                              child: Container(
                                                padding: const EdgeInsets.all(
                                                  3,
                                                ),
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFFFFD700),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(
                                                  Icons.star_rounded,
                                                  size: 11,
                                                  color: Color(0xFF0F2015),
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              customerName,
                                              style: const TextStyle(
                                                fontSize: 21,
                                                fontWeight: FontWeight.w900,
                                                color: Colors.white,
                                                letterSpacing: -0.4,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            if (customerMobile.isNotEmpty) ...[
                                              const SizedBox(height: 2),
                                              Text(
                                                customerMobile,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                  color: Colors.white
                                                      .withValues(alpha: 0.8),
                                                ),
                                              ),
                                            ],
                                            const SizedBox(height: 6),
                                            // Verified badge pill
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 10,
                                                    vertical: 4,
                                                  ),
                                              decoration: BoxDecoration(
                                                gradient:
                                                    profile?.isMember == true
                                                    ? const LinearGradient(
                                                        colors: [
                                                          Color(0xFF052E16),
                                                          Color(0xFF14532D),
                                                        ],
                                                        begin:
                                                            Alignment.topLeft,
                                                        end: Alignment
                                                            .bottomRight,
                                                      )
                                                    : const LinearGradient(
                                                        colors: [
                                                          Color(0xFFFFD56B),
                                                          _marketGold,
                                                        ],
                                                        begin:
                                                            Alignment.topLeft,
                                                        end: Alignment
                                                            .bottomRight,
                                                      ),
                                                borderRadius:
                                                    BorderRadius.circular(30),
                                                border:
                                                    profile?.isMember == true
                                                    ? Border.all(
                                                        color: const Color(
                                                          0xFFFFD700,
                                                        ),
                                                        width: 1.2,
                                                      )
                                                    : null,
                                                boxShadow: [
                                                  BoxShadow(
                                                    color:
                                                        profile?.isMember ==
                                                            true
                                                        ? Colors.black
                                                              .withValues(
                                                                alpha: 0.3,
                                                              )
                                                        : Colors.black
                                                              .withValues(
                                                                alpha: 0.06,
                                                              ),
                                                    blurRadius: 8,
                                                    offset: const Offset(0, 2),
                                                  ),
                                                ],
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(
                                                    profile?.isMember == true
                                                        ? Icons
                                                              .workspace_premium_rounded
                                                        : Icons
                                                              .verified_rounded,
                                                    size: 13,
                                                    color:
                                                        profile?.isMember ==
                                                            true
                                                        ? const Color(
                                                            0xFFFFD700,
                                                          )
                                                        : const Color(
                                                            0xFF332000,
                                                          ),
                                                  ),
                                                  const SizedBox(width: 5),
                                                  Flexible(
                                                    child: Text(
                                                      customerInfo,
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w900,
                                                        color:
                                                            profile?.isMember ==
                                                                true
                                                            ? const Color(
                                                                0xFFFFD700,
                                                              )
                                                            : const Color(
                                                                0xFF332000,
                                                              ),
                                                        letterSpacing: 0.8,
                                                      ),
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      // Action button (Edit details / Settings)
                                      IconButton(
                                        onPressed: () {
                                          if (isLoggedIn) {
                                            _showPersonalDetails(
                                              context,
                                              profile,
                                            );
                                          } else {
                                            _showLoginDrawer(context);
                                          }
                                        },
                                        icon: const Icon(
                                          Icons.chevron_right_rounded,
                                          size: 22,
                                        ),
                                        color: Colors.white,
                                        style: IconButton.styleFrom(
                                          backgroundColor: Colors.white
                                              .withValues(alpha: 0.15),
                                          padding: const EdgeInsets.all(8),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Wallet card
                      _walletOverviewCard(
                        balance: profile?.walletBalance ?? 0.0,
                        onWalletTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const WalletScreen(),
                          ),
                        ),
                        onPackageTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ContainerBalanceScreen(),
                          ),
                        ),
                      ),

                      // Quick actions card - 3 items per row
                      Container(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        padding: const EdgeInsets.symmetric(
                          vertical: 14,
                          horizontal: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: kBorderLt, width: 1.2),
                          boxShadow: const [
                            BoxShadow(
                              color: _softShadow,
                              blurRadius: 20,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            // Row 1: Bills, Orders, Address
                            Row(
                              children: [
                                _quickAction(
                                  Icons.receipt_long_outlined,
                                  'Bills',
                                  const Color(0xFFE8F5E9),
                                  const Color(0xFF2E7D32),
                                  () {
                                    if (isLoggedIn) {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              const CustomerBillsScreen(),
                                        ),
                                      );
                                    } else {
                                      _showLoginDrawer(context);
                                    }
                                  },
                                ),
                                _quickAction(
                                  Icons.shopping_bag_outlined,
                                  'Orders',
                                  const Color(0xFFE3F2FD),
                                  const Color(0xFF1565C0),
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const OrderHistoryScreen(),
                                    ),
                                  ),
                                ),
                                _quickAction(
                                  Icons.location_on_outlined,
                                  'Address',
                                  const Color(0xFFF3E5F5),
                                  const Color(0xFF7B1FA2),
                                  () async {
                                    if (isLoggedIn) {
                                      final selected =
                                          await AddressSelectorDrawer.show(
                                            context,
                                          );
                                      if (selected != null && context.mounted) {
                                        final addrId = (selected.addressId !=
                                                    null &&
                                                selected.addressId!.isNotEmpty)
                                            ? selected.addressId!
                                            : ((selected.id != null &&
                                                    selected.id!.isNotEmpty)
                                                ? selected.id!
                                                : selected.uniqueId);
                                        await context
                                            .read<CustomerSessionCubit>()
                                            .updateDefaultAddress(addrId);
                                        if (context.mounted) {
                                          F2HToast.success(
                                            context,
                                            'Default address updated',
                                          );
                                        }
                                      }
                                    } else {
                                      _showLoginDrawer(context);
                                    }
                                  },
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            // Row 2: Notifications, Privacy,Rate App
                            Row(
                              children: [
                                _quickAction(
                                  Icons.notifications_none_outlined,
                                  'Notifications',
                                  const Color(0xFFFFF3E0),
                                  _marketOrange,
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const NotificationsScreen(),
                                    ),
                                  ),
                                ),
                                _quickAction(
                                  Icons.security_outlined,
                                  'Privacy',
                                  const Color(0xFFE8F5E9),
                                  const Color(0xFF2E7D32),
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const PrivacyScreen(),
                                    ),
                                  ),
                                ),
                                _quickAction(
                                  Icons.star_outline_rounded,
                                  'Rate App',
                                  const Color(0xFFFFFDE7),
                                  const Color(0xFFFBC02D),
                                  () async {
                                    const playStoreUrl =
                                        'https://play.google.com/store/apps/details?id=com.f2h.customer&pcampaignid=web_share';
                                    final uri = Uri.parse(playStoreUrl);
                                    try {
                                      await launchUrl(uri,
                                          mode: LaunchMode.externalApplication);
                                    } catch (_) {
                                      await launchUrl(uri);
                                    }
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Referral Banner (Invite Friends & Earn Rewards!)
                      const ReferralInviteCard(),
                      // Support & Info Group
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 8,
                        ),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'SUPPORT & INFO',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: kTextSub.withValues(alpha: 0.8),
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),
                      ),
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: kBorderLt, width: 1.2),
                          boxShadow: const [
                            BoxShadow(
                              color: _softShadow,
                              blurRadius: 20,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            _menuItem(
                              Icons.support_agent_rounded,
                              'Contact & Grievance Support',
                              const Color(0xFFE0F2FE),
                              const Color(0xFF0284C7),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const ContactUsScreen(),
                                ),
                              ),
                            ),
                            _divider(),
                            _menuItem(
                              Icons.description_outlined,
                              'Terms & Conditions',
                              const Color(0xFFF3E8FF),
                              const Color(0xFF7E22CE),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const TermsConditionsScreen(),
                                ),
                              ),
                            ),
                            _divider(),
                            _menuItem(
                              Icons.replay_circle_filled_outlined,
                              'Cancellation & Refund Policy',
                              const Color(0xFFFEF3C7),
                              const Color(0xFFB45309),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const RefundPolicyScreen(),
                                ),
                              ),
                            ),
                            _divider(),
                            _menuItem(
                              Icons.local_shipping_outlined,
                              'Delivery & Shipping Policy',
                              const Color(0xFFDCFCE7),
                              const Color(0xFF15803D),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const DeliveryPolicyScreen(),
                                ),
                              ),
                            ),
                            _divider(),
                            _menuItem(
                              Icons.security_outlined,
                              'Privacy Policy',
                              const Color(0xFFE8F5E9),
                              const Color(0xFF2E7D32),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const PrivacyScreen(),
                                ),
                              ),
                            ),
                            _divider(),
                            _menuItem(
                              Icons.phone_outlined,
                              'Call Helpline - +91 91487 73591',
                              const Color(0xFFE8F5E9),
                              const Color(0xFF2E7D32),
                              onTap: () async {
                                final url = Uri.parse('tel:+919148773591');
                                try {
                                  await launchUrl(url);
                                } catch (_) {}
                              },
                            ),
                            _divider(),
                            _menuItem(
                              Icons.chat_bubble_outline_rounded,
                              'WhatsApp Support',
                              const Color(0xFFE8F8F5),
                              const Color(0xFF075E54),
                              onTap: () => _showWhatsAppPopup(context),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),

                      // Login / Logout Action Button
                      InkWell(
                        onTap: () => isLoggedIn
                            ? _confirmLogout(context)
                            : _openLogin(context),
                        borderRadius: BorderRadius.circular(24),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 16),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 16,
                          ),
                          decoration: BoxDecoration(
                            color: isLoggedIn
                                ? const Color(0xFFFFF2F2)
                                : kPrimaryPl.withValues(alpha: 0.4),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: isLoggedIn
                                  ? const Color(0xFFFCA5A5)
                                  : kPrimary.withValues(alpha: 0.2),
                              width: 1.2,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(14),
                                  boxShadow: [
                                    BoxShadow(
                                      color: (isLoggedIn ? kRed : kPrimary)
                                          .withValues(alpha: 0.06),
                                      blurRadius: 8,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  isLoggedIn
                                      ? Icons.power_settings_new_rounded
                                      : Icons.login_rounded,
                                  color: isLoggedIn ? kRed : kPrimary,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Text(
                                  isLoggedIn
                                      ? 'Log Out Account'
                                      : 'Log In Account',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    color: isLoggedIn ? kRed : kPrimary,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                              ),
                              Icon(
                                Icons.arrow_forward_ios_rounded,
                                color: isLoggedIn ? kRed : kPrimary,
                                size: 14,
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 28),
                      const Text(
                        'F2H - Farm to Home  |  Proudly Made in India  |  Since 2018',
                        style: TextStyle(
                          fontSize: 10,
                          color: kMuted,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 48),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _walletOverviewCard({
    required double balance,
    required VoidCallback onWalletTap,
    required VoidCallback onPackageTap,
  }) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.white, _cream],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFFE6A3), width: 1.2),
        boxShadow: const [
          BoxShadow(color: _softShadow, blurRadius: 20, offset: Offset(0, 8)),
        ],
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onWalletTap,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [kPrimary, kPrimaryMid],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: kPrimary.withValues(alpha: 0.18),
                          blurRadius: 12,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.account_balance_wallet_outlined,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'F2H Wallet  •  ₹${balance.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: kText,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: _marketGold,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: _marketGold.withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Text(
                      'Open',
                      style: TextStyle(
                        color: Color(0xFF332000),
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFFFE9B6), thickness: 1),
          InkWell(
            onTap: onPackageTap,
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(24),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                children: [
                  const Icon(
                    Icons.inventory_2_outlined,
                    color: _marketOrange,
                    size: 20,
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Text(
                      'Container balance',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: kTextMid,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: kMuted.withValues(alpha: 0.8),
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickAction(
    IconData icon,
    String label,
    Color bg,
    Color iconColor,
    VoidCallback onTap,
  ) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Column(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: iconColor.withValues(alpha: 0.08),
                      blurRadius: 10,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Center(child: Icon(icon, color: iconColor, size: 22)),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: _inkGreen,
                  letterSpacing: -0.1,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _menuItem(
    IconData icon,
    String label,
    Color iconBg,
    Color iconColor, {
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap ?? () {},
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: iconColor.withValues(alpha: 0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Center(child: Icon(icon, color: iconColor, size: 20)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: _inkGreen,
                  letterSpacing: -0.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: kBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.chevron_right_rounded,
                color: kTextSub,
                size: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _divider() =>
      const Divider(height: 1, thickness: 1, color: kBorderLt, indent: 76);
}
