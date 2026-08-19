import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/section_card.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/editable_field.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key});

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _submitPasswordChange() {
    if (_formKey.currentState!.validate()) {
      context.read<ProfileBloc>().add(
            ChangePasswordEvent(
              currentPassword: _currentPasswordController.text,
              newPassword: _newPasswordController.text,
              confirmPassword: _confirmPasswordController.text,
            ),
          );
    }
  }

  void _confirmLogoutAll() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: kSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Logout from All Devices', style: TextStyle(color: kRed, fontWeight: FontWeight.bold)),
        content: const Text(
          'Are you sure you want to terminate all active sessions? You will be logged out of this device as well.',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: kTextSub)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.read<ProfileBloc>().add(LogoutAllDevicesEvent());
              // Auto request auth logout locally as well
              context.read<AuthBloc>().add(LogoutRequested());
            },
            style: ElevatedButton.styleFrom(backgroundColor: kRed),
            child: const Text('Logout All', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded && state.successMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.successMessage!), backgroundColor: kSuccess),
          );
          _currentPasswordController.clear();
          _newPasswordController.clear();
          _confirmPasswordController.clear();
        } else if (state is ProfileError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.message), backgroundColor: kRed),
          );
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        appBar: F2hAppBar(title: 'Security & Access'),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionCard(
                title: 'Change Password',
                icon: Icons.vpn_key_rounded,
                children: [
                  EditableField(
                    label: 'Current Password',
                    controller: _currentPasswordController,
                    placeholder: 'Enter current password',
                    validator: (val) => val == null || val.isEmpty ? 'Enter current password' : null,
                    suffixIcon: IconButton(
                      icon: Icon(_obscureCurrent ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 18),
                      onPressed: () => setState(() => _obscureCurrent = !_obscureCurrent),
                    ),
                  ),
                  const SizedBox(height: 12),
                  EditableField(
                    label: 'New Password',
                    controller: _newPasswordController,
                    placeholder: 'Enter new password (min. 8 characters)',
                    validator: (val) {
                      if (val == null || val.isEmpty) return 'Enter new password';
                      if (val.length < 8) return 'Password must be at least 8 characters';
                      return null;
                    },
                    suffixIcon: IconButton(
                      icon: Icon(_obscureNew ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 18),
                      onPressed: () => setState(() => _obscureNew = !_obscureNew),
                    ),
                  ),
                  const SizedBox(height: 12),
                  EditableField(
                    label: 'Confirm New Password',
                    controller: _confirmPasswordController,
                    placeholder: 'Confirm new password',
                    validator: (val) {
                      if (val == null || val.isEmpty) return 'Confirm new password';
                      if (val != _newPasswordController.text) return 'Passwords do not match';
                      return null;
                    },
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirm ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 18),
                      onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _submitPasswordChange,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Update Password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
              SectionCard(
                title: 'Session Management',
                icon: Icons.logout_rounded,
                children: [
                  const Text(
                    'Device Logouts',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: kTextMid),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Ensure your account security by logging out from active devices you are no longer using.',
                    style: TextStyle(fontSize: 11, color: kTextSub, height: 1.3),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            context.read<AuthBloc>().add(LogoutRequested());
                          },
                          icon: const Icon(Icons.logout_rounded, color: kRed, size: 16),
                          label: const Text('Logout Current Device', style: TextStyle(color: kRed, fontSize: 11, fontWeight: FontWeight.bold)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: kRed),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _confirmLogoutAll,
                          icon: const Icon(Icons.phonelink_erase_rounded, color: Colors.white, size: 16),
                          label: const Text('Logout All Devices', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kRed,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
