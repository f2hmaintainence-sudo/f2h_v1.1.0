import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/section_card.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/info_tile.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/editable_field.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/image_upload_field.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class PersonalInfoScreen extends StatefulWidget {
  const PersonalInfoScreen({super.key});

  @override
  State<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends State<PersonalInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isEditing = false;

  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _dobController;
  late TextEditingController _genderController;
  late TextEditingController _addressController;
  late TextEditingController _emergencyNameController;
  late TextEditingController _emergencyPhoneController;

  File? _selectedPhoto;

  @override
  void initState() {
    super.initState();
    _initControllers();
  }

  void _initControllers() {
    final state = context.read<ProfileBloc>().state;
    if (state is ProfileLoaded) {
      final p = state.profile;
      _nameController = TextEditingController(text: p.fullName);
      _emailController = TextEditingController(text: p.email);
      _dobController = TextEditingController(text: p.dateOfBirth?.split('T')[0] ?? '');
      _genderController = TextEditingController(text: p.gender ?? '');
      _addressController = TextEditingController(text: p.residentialAddress ?? '');
      _emergencyNameController = TextEditingController(text: p.emergencyContact ?? '');
      _emergencyPhoneController = TextEditingController(text: p.emergencyContactNumber ?? '');
    } else {
      _nameController = TextEditingController();
      _emailController = TextEditingController();
      _dobController = TextEditingController();
      _genderController = TextEditingController();
      _addressController = TextEditingController();
      _emergencyNameController = TextEditingController();
      _emergencyPhoneController = TextEditingController();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _dobController.dispose();
    _genderController.dispose();
    _addressController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      firstDate: DateTime(1960),
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
    if (picked != null) {
      setState(() {
        _dobController.text = picked.toIso8601String().split('T')[0];
      });
    }
  }

  void _saveDetails() {
    if (_formKey.currentState!.validate()) {
      final updates = {
        'full_name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'date_of_birth': _dobController.text.trim().isEmpty ? null : _dobController.text.trim(),
        'gender': _genderController.text.trim().isEmpty ? null : _genderController.text.trim(),
        'residential_address': _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
        'emergency_contact': _emergencyNameController.text.trim().isEmpty ? null : _emergencyNameController.text.trim(),
        'emergency_contact_number': _emergencyPhoneController.text.trim().isEmpty ? null : _emergencyPhoneController.text.trim(),
      };

      context.read<ProfileBloc>().add(UpdatePersonalInfoEvent(updates));
      setState(() {
        _isEditing = false;
      });
    }
  }

  void _showOtpDialog(BuildContext context, String currentPhone) {
    final phoneController = TextEditingController(text: currentPhone);
    final otpController = TextEditingController();
    bool otpSent = false;

    showDialog(
      context: context,
      builder: (dialogContext) => BlocProvider.value(
        value: BlocProvider.of<ProfileBloc>(context),
        child: StatefulBuilder(
          builder: (dialogContext, setDialogState) => AlertDialog(
            backgroundColor: kSurface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text(
              'Verify Mobile Number',
              style: TextStyle(color: kPrimary, fontWeight: FontWeight.bold),
            ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              EditableField(
                label: 'Mobile Number',
                controller: phoneController,
                keyboardType: TextInputType.phone,
                readOnly: otpSent,
              ),
              if (otpSent) ...[
                const SizedBox(height: 12),
                EditableField(
                  label: 'Enter 6-digit OTP',
                  controller: otpController,
                  keyboardType: TextInputType.number,
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel', style: TextStyle(color: kTextSub)),
            ),
            ElevatedButton(
              onPressed: () {
                if (!otpSent) {
                  // Simulate sending OTP
                  if (phoneController.text.trim().length >= 10) {
                    setDialogState(() {
                      otpSent = true;
                    });
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      const SnackBar(content: Text('OTP sent successfully!')),
                    );
                  }
                } else {
                  // Simulate verify OTP & update phone directly
                  if (otpController.text.trim().length == 6) {
                    dialogContext.read<ProfileBloc>().add(
                      UpdatePersonalInfoEvent({'phone': phoneController.text.trim()}),
                    );
                    Navigator.pop(dialogContext);
                  } else {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      const SnackBar(content: Text('Please enter a valid 6-digit OTP'), backgroundColor: kRed),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: kPrimary),
              child: Text(
                otpSent ? 'Verify & Update' : 'Send OTP',
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded) {
          if (state.successMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.successMessage!), backgroundColor: kSuccess),
            );
          }
          _initControllers();
        } else if (state is ProfileError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.message), backgroundColor: kRed),
          );
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        appBar: F2hAppBar(
        title: 'Personal Details',
        actions: [
            if (!_isEditing)
              IconButton(
                icon: const Icon(Icons.edit_rounded, color: kAccent),
                onPressed: () => setState(() => _isEditing = true),
              )
            else
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white70),
                onPressed: () => setState(() => _isEditing = false),
              ),
          ],
      ),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator(color: kPrimary));
            }
            if (state is! ProfileLoaded) {
              return const Center(child: Text('Error loading profile details'));
            }

            final p = state.profile;
            return Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Photo section
                  SectionCard(
                    title: 'Profile Photo',
                    icon: Icons.camera_enhance_rounded,
                    trailing: _isEditing ? null : const Text('🔒 READ ONLY'),
                    children: [
                      Center(
                        child: Column(
                          children: [
                            GestureDetector(
                              onTap: () {
                                if (!_isEditing) return;
                                // image upload widget inside bottom sheet handles it
                              },
                              child: Container(
                                width: 100,
                                height: 100,
                                decoration: BoxDecoration(
                                  color: kBgDeep,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: kPrimary, width: 2),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(50),
                                  child: _selectedPhoto != null
                                      ? Image.file(_selectedPhoto!, fit: BoxFit.cover)
                                      : p.profilePhotoUrl != null && p.profilePhotoUrl!.isNotEmpty
                                          ? Image.network(p.profilePhotoUrl!, fit: BoxFit.cover)
                                          : const Center(child: Icon(Icons.person, size: 60, color: kMuted)),
                                ),
                              ),
                            ),
                            if (_isEditing) ...[
                              const SizedBox(height: 12),
                              ImageUploadField(
                                label: 'Upload Photo',
                                initialImageUrl: p.profilePhotoUrl,
                                selectedFile: _selectedPhoto,
                                onImageSelected: (file) {
                                  setState(() {
                                    _selectedPhoto = file;
                                  });
                                  if (file != null) {
                                    context.read<ProfileBloc>().add(UploadProfilePhotoEvent(file));
                                  }
                                },
                              ),
                            ]
                          ],
                        ),
                      )
                    ],
                  ),

                  // Core Personal Info
                  SectionCard(
                    title: 'Personal Information',
                    icon: Icons.person_outline_rounded,
                    children: [
                      if (_isEditing) ...[
                        EditableField(
                          label: 'Full Name',
                          controller: _nameController,
                          validator: (val) => val == null || val.trim().isEmpty ? 'Enter full name' : null,
                        ),
                        const SizedBox(height: 12),
                        EditableField(
                          label: 'Email Address',
                          controller: _emailController,
                          validator: (val) => val == null || val.trim().isEmpty ? 'Enter email address' : null,
                        ),
                        const SizedBox(height: 12),
                        EditableField(
                          label: 'Date of Birth',
                          controller: _dobController,
                          readOnly: true,
                          onTap: _selectDate,
                          suffixIcon: const Icon(Icons.calendar_today_rounded, size: 18),
                        ),
                        const SizedBox(height: 12),
                        EditableField(
                          label: 'Gender',
                          controller: _genderController,
                          placeholder: 'Male / Female / Other',
                        ),
                        const SizedBox(height: 12),
                        EditableField(
                          label: 'Residential Address',
                          controller: _addressController,
                          placeholder: 'Enter present address',
                        ),
                      ] else ...[
                        InfoTile(label: 'Full Name', value: p.fullName),
                        InfoTile(label: 'Email Address', value: p.email),
                        InfoTile(label: 'Date of Birth', value: p.dateOfBirth?.split('T')[0] ?? 'Not Configured'),
                        InfoTile(label: 'Gender', value: p.gender ?? 'Not Configured'),
                        InfoTile(label: 'Residential Address', value: p.residentialAddress ?? 'Not Configured'),
                      ]
                    ],
                  ),

                  // Emergencies & Employment details
                  SectionCard(
                    title: 'Employment & Security',
                    icon: Icons.verified_user_rounded,
                    children: [
                      InfoTile(label: 'Employee ID (Permanent)', value: p.deliveryPartnerId, copyable: true),
                      InfoTile(
                        label: 'Mobile Number',
                        value: p.phone,
                        onTap: () => _showOtpDialog(context, p.phone),
                      ),
                      if (_isEditing) ...[
                        EditableField(
                          label: 'Emergency Contact Person',
                          controller: _emergencyNameController,
                        ),
                        const SizedBox(height: 12),
                        EditableField(
                          label: 'Emergency Phone Number',
                          controller: _emergencyPhoneController,
                          keyboardType: TextInputType.phone,
                        ),
                      ] else ...[
                        InfoTile(label: 'Emergency Contact', value: p.emergencyContact ?? 'Not Configured'),
                        InfoTile(label: 'Emergency Contact Phone', value: p.emergencyContactNumber ?? 'Not Configured'),
                      ]
                    ],
                  ),
                ],
              ),
            );
          },
        ),
        bottomNavigationBar: _isEditing
            ? SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _saveDetails,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text(
                        'Save Personal Changes',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ),
                  ),
                ),
              )
            : null,
      ),
    );
  }
}
