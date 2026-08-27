import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/personal_info_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/documents_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/vehicle_info_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/bank_details_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/support_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/security_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/performance_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/leave_request_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/referral_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/notifications_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/privacy_policy_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/terms_conditions_screen.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';
import 'package:f2h_delivery/core/widgets/image_source_dialog.dart';
import 'crop_photo_screen.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _pickAndUploadPhoto(BuildContext context) async {
    try {
      showImageSourceDialog(
        context: context,
        title: 'Change Profile Photo',
        onCameraSelected: () => _processPhotoPick(context, ImageSource.camera),
        onGallerySelected: () => _processPhotoPick(context, ImageSource.gallery),
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick photo: $e'),
            backgroundColor: kRed,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _processPhotoPick(BuildContext context, ImageSource source) async {
    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(source: source, imageQuality: 70);
      if (pickedFile != null) {
        final file = File(pickedFile.path);
        if (context.mounted) {
          final croppedFile = await Navigator.push<File?>(
            context,
            MaterialPageRoute(
              builder: (_) => CropPhotoScreen(
                imageFile: file,
                title: 'Crop Profile Photo',
                message: 'Are you sure you want to update your profile photo to this cropped image?',
              ),
            ),
          );
          if (croppedFile != null && context.mounted) {
            context.read<ProfileBloc>().add(UploadProfilePhotoEvent(croppedFile));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Uploading profile photo...'),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick photo: $e'),
            backgroundColor: kRed,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ProfileBloc>()..add(FetchProfileEvent()),
      child: BlocListener<ProfileBloc, ProfileState>(
        listener: (context, state) {
          if (state is ProfileLoaded && state.successMessage != null) {
            final msg = state.successMessage!;
            if (msg.toLowerCase().contains('photo')) {
              showProfilePhotoNotificationDialog(context, msg, !msg.toLowerCase().contains('failed'));
              context.read<ProfileBloc>().add(ClearProfileMessageEvent());
            }
          }
        },
        child: Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: const F2hAppBar(
            title: 'Profile',
            subtitle: 'Manage your account, documents & preferences',
            showBackButton: true,
            actions: [],
          ),
          body: BlocBuilder<ProfileBloc, ProfileState>(
            builder: (context, state) {
              if (state is ProfileLoading) {
                return const Center(
                  child: CircularProgressIndicator(color: kPrimary),
                );
              }

              if (state is ProfileError) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 64, color: kDanger),
                        const SizedBox(height: 16),
                        const Text(
                          'Failed to load profile',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: kText),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          state.message,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 14, color: kTextSub),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 130,
                              height: 48,
                              child: ElevatedButton(
                                onPressed: () {
                                  context.read<ProfileBloc>().add(FetchProfileEvent());
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: kPrimary,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                child: const Text('Retry', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            SizedBox(
                              width: 130,
                              height: 48,
                              child: OutlinedButton(
                                onPressed: () {
                                  context.read<AuthBloc>().add(LogoutRequested());
                                },
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: kRed, width: 1.5),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                child: const Text('Log Out', style: TextStyle(color: kRed, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }

              if (state is! ProfileLoaded) {
                return const Center(
                  child: CircularProgressIndicator(color: kPrimary),
                );
              }

              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (MockDataService().shouldOpenKycOnProfile) {
                  MockDataService().shouldOpenKycOnProfile = false;
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => BlocProvider.value(
                        value: context.read<ProfileBloc>(),
                        child: const DocumentsScreen(),
                      ),
                    ),
                  );
                }
              });

              final profile = state.profile;
              final partnerName = profile.fullName.isNotEmpty ? profile.fullName : 'Delivery Partner';
              final partnerId = profile.deliveryPartnerId.isNotEmpty ? profile.deliveryPartnerId : 'F2H001';
              final isVerified = profile.isVerified;

              return RefreshIndicator(
                onRefresh: () async {
                  context.read<ProfileBloc>().add(FetchProfileEvent());
                },
                color: kPrimary,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
                  children: [
                    // ── TOP PARTNER PROFILE CARD ────────────────────────────
                    _buildPartnerProfileCard(
                      context,
                      partnerName: partnerName,
                      partnerId: partnerId,
                      isVerified: isVerified,
                      photoUrl: profile.profilePhotoUrl,
                      deliveriesCount: profile.totalDeliveries ?? 0,
                      onPhotoTap: () => _pickAndUploadPhoto(context),
                      onCardTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => BlocProvider.value(
                            value: context.read<ProfileBloc>(),
                            child: const PersonalInfoScreen(),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // ── ACCOUNT & INFORMATION ───────────────────────────────
                    _buildSectionTitle('Account & Information'),
                    const SizedBox(height: 12),
                    _buildAccountGrid(context),

                    const SizedBox(height: 20),

                    // ── SETTINGS & POLICIES ─────────────────────────────────
                    _buildSectionTitle('Settings & Policies'),
                    const SizedBox(height: 12),
                    _buildPreferencesCard(context),

                    const SizedBox(height: 20),

                    // ── LOGOUT BUTTON ─────────────────────────────────────────
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFFCA5A5).withValues(alpha: 0.6)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x06000000),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(18),
                        child: InkWell(
                          onTap: () => _showLogoutConfirmation(context),
                          borderRadius: BorderRadius.circular(18),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(7),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFFEE2E2),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.logout_rounded,
                                    color: Color(0xFFDC2626),
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'Log Out of Account',
                                  style: GoogleFonts.poppins(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFFDC2626),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 28),

                    // ── FOOTER & VERSION ───────────────────────────────────
                    Center(
                      child: Column(
                        children: [
                          Text(
                            '🇮🇳 F2H Fresh Partner App · v2.5.0',
                            style: GoogleFonts.poppins(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF94A3B8),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Made in India with Pride',
                            style: GoogleFonts.poppins(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: const Color(0xFFCBD5E1),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: GoogleFonts.poppins(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: const Color(0xFF0F172A),
        letterSpacing: -0.2,
      ),
    );
  }

  Widget _buildPartnerProfileCard(
    BuildContext context, {
    required String partnerName,
    required String partnerId,
    required bool isVerified,
    String? photoUrl,
    required int deliveriesCount,
    required VoidCallback onPhotoTap,
    required VoidCallback onCardTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: onCardTap,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    // Avatar with camera icon
                    GestureDetector(
                      onTap: onPhotoTap,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFFBBF7D0), width: 2),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(32),
                              child: photoUrl != null && photoUrl.isNotEmpty
                                  ? Image.network(
                                      photoUrl,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => const Icon(
                                        Icons.person_rounded,
                                        size: 36,
                                        color: Color(0xFF16A34A),
                                      ),
                                    )
                                  : const Icon(
                                      Icons.person_rounded,
                                      size: 36,
                                      color: Color(0xFF16A34A),
                                    ),
                            ),
                          ),
                          Positioned(
                            right: -2,
                            bottom: -2,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x10000000),
                                    blurRadius: 4,
                                    offset: Offset(0, 1),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.camera_alt_outlined,
                                size: 12,
                                color: Color(0xFF16A34A),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),

                    // Info Column
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  partnerName,
                                  style: GoogleFonts.poppins(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF0F172A),
                                    letterSpacing: -0.3,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isVerified ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      isVerified ? Icons.check_circle_rounded : Icons.hourglass_top_rounded,
                                      size: 10,
                                      color: isVerified ? const Color(0xFF15803D) : const Color(0xFFB45309),
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      isVerified ? 'Verified' : 'Pending',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: isVerified ? const Color(0xFF15803D) : const Color(0xFFB45309),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Text(
                                'ID: $partnerId',
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(width: 4),
                              GestureDetector(
                                onTap: () {
                                  Clipboard.setData(ClipboardData(text: partnerId));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Partner ID copied to clipboard'),
                                      duration: Duration(seconds: 1),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                },
                                child: const Icon(
                                  Icons.copy_rounded,
                                  size: 13,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const Icon(
                      Icons.chevron_right_rounded,
                      color: Color(0xFF94A3B8),
                      size: 22,
                    ),
                  ],
                ),

                const SizedBox(height: 14),

                // Sub Banner / Level Row
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.military_tech_rounded,
                          size: 16,
                          color: Color(0xFFD97706),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Partner Status',
                              style: GoogleFonts.poppins(
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF94A3B8),
                              ),
                            ),
                            Text(
                              isVerified ? 'Verified Delivery Partner' : 'Standard Delivery Partner',
                              style: GoogleFonts.poppins(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isVerified ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          isVerified ? 'ACTIVE' : 'PENDING',
                          style: GoogleFonts.poppins(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: isVerified ? const Color(0xFF15803D) : const Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAccountGrid(BuildContext context) {
    final bloc = context.read<ProfileBloc>();
    final items = [
      _GridItem(
        label: 'Personal',
        icon: Icons.person_outline_rounded,
        iconBg: const Color(0xFFDCFCE7),
        iconColor: const Color(0xFF16A34A),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: bloc,
              child: const PersonalInfoScreen(),
            ),
          ),
        ),
      ),
      _GridItem(
        label: 'Documents',
        icon: Icons.badge_outlined,
        iconBg: const Color(0xFFDBEAFE),
        iconColor: const Color(0xFF2563EB),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: bloc,
              child: const DocumentsScreen(),
            ),
          ),
        ),
      ),
      _GridItem(
        label: 'Bank',
        icon: Icons.account_balance_outlined,
        iconBg: const Color(0xFFFFEDD5),
        iconColor: const Color(0xFFEA580C),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: bloc,
              child: const BankDetailsScreen(),
            ),
          ),
        ),
      ),
      _GridItem(
        label: 'Vehicle',
        icon: Icons.two_wheeler_rounded,
        iconBg: const Color(0xFFF3E8FF),
        iconColor: const Color(0xFF9333EA),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: bloc,
              child: const VehicleInfoScreen(),
            ),
          ),
        ),
      ),
      _GridItem(
        label: 'Leaves',
        icon: Icons.beach_access_outlined,
        iconBg: const Color(0xFFFFEDD5),
        iconColor: const Color(0xFFD97706),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: bloc,
              child: const LeaveRequestScreen(),
            ),
          ),
        ),
      ),
      _GridItem(
        label: 'Performance',
        icon: Icons.bar_chart_rounded,
        iconBg: const Color(0xFFF3E8FF),
        iconColor: const Color(0xFF7C3AED),
        onTap: () {
          final state = bloc.state;
          if (state is ProfileLoaded) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => BlocProvider.value(
                  value: bloc,
                  child: PerformanceScreen(
                    profile: state.profile,
                    initialTab: PerformanceTab.attendance,
                  ),
                ),
              ),
            );
          }
        },
      ),
      _GridItem(
        label: 'Referrals',
        icon: Icons.card_giftcard_rounded,
        iconBg: const Color(0xFFDCFCE7),
        iconColor: const Color(0xFF059669),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: bloc,
              child: const ReferralScreen(),
            ),
          ),
        ),
      ),
      _GridItem(
        label: 'Alerts',
        icon: Icons.notifications_none_rounded,
        iconBg: const Color(0xFFE0E7FF),
        iconColor: const Color(0xFF4F46E5),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const NotificationsScreen(),
          ),
        ),
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        crossAxisSpacing: 10,
        mainAxisSpacing: 12,
        childAspectRatio: 0.82,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x04000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: item.onTap,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: item.iconBg,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        item.icon,
                        color: item.iconColor,
                        size: 22,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      item.label,
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF0F172A),
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildPreferencesCard(BuildContext context) {
    final bloc = context.read<ProfileBloc>();
    final preferenceItems = [
      _PrefItem(
        icon: Icons.settings_outlined,
        iconBg: const Color(0xFFF1F5F9),
        iconColor: const Color(0xFF475569),
        title: 'Settings',
        subtitle: 'Security, password & account controls',
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => BlocProvider.value(
              value: bloc,
              child: const SecurityScreen(),
            ),
          ),
        ),
      ),
      _PrefItem(
        icon: Icons.shield_outlined,
        iconBg: const Color(0xFFFAF5FF),
        iconColor: const Color(0xFF9333EA),
        title: 'Privacy Policy',
        subtitle: 'Read our privacy policy',
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const PrivacyPolicyScreen(),
          ),
        ),
      ),
      _PrefItem(
        icon: Icons.description_outlined,
        iconBg: const Color(0xFFFFFBEB),
        iconColor: const Color(0xFFD97706),
        title: 'Terms & Conditions',
        subtitle: 'Read our terms and conditions',
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const TermsConditionsScreen(),
          ),
        ),
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: preferenceItems.asMap().entries.map((entry) {
          final idx = entry.key;
          final item = entry.value;
          final isLast = idx == preferenceItems.length - 1;

          return Column(
            children: [
              Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.vertical(
                  top: idx == 0 ? const Radius.circular(20) : Radius.zero,
                  bottom: isLast ? const Radius.circular(20) : Radius.zero,
                ),
                child: InkWell(
                  onTap: item.onTap,
                  borderRadius: BorderRadius.vertical(
                    top: idx == 0 ? const Radius.circular(20) : Radius.zero,
                    bottom: isLast ? const Radius.circular(20) : Radius.zero,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: item.iconBg,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            item.icon,
                            color: item.iconColor,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                item.subtitle,
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w400,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: Color(0xFF94A3B8),
                          size: 20,
                        ),
                      ],
                    ),
                  ),
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
        }).toList(),
      ),
    );
  }

  void _showLogoutConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFFEE2E2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 20),
            ),
            const SizedBox(width: 10),
            Text(
              'Log Out',
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: const Color(0xFF0F172A),
              ),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to log out of your delivery partner account?',
          style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF64748B), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: GoogleFonts.poppins(color: const Color(0xFF64748B), fontWeight: FontWeight.w700),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthBloc>().add(LogoutRequested());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              'Log Out',
              style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _GridItem {
  final String label;
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final VoidCallback onTap;

  _GridItem({
    required this.label,
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.onTap,
  });
}

class _PrefItem {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  _PrefItem({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
}
