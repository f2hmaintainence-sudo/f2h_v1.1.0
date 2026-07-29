import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/profile/data/profile_model.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_event.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_state.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/section_card.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/info_tile.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/personal_info_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/documents_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/vehicle_info_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/bank_details_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/notifications_preferences_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/activity_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/support_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/security_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/performance_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/leave_request_screen.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';
import 'package:f2h_delivery/core/widgets/image_source_dialog.dart';
import 'crop_photo_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/notifications_screen.dart';

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
            backgroundColor: Colors.redAccent,
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
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String getStatusEmoji(String status) {
    if (status == 'verified') return '✅';
    if (status == 'rejected') return '❌';
    return '⏳';
  }

  Future<int> _fetchUnreadCount(BuildContext context) async {
    // TODO: Implement actual API call to fetch unread notification count.
    // Placeholder returns 0.
    return 0;
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
        child: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Scaffold(
                backgroundColor: kBg,
                body: Center(
                  child: CircularProgressIndicator(color: kPrimary),
                ),
              );
            }

            if (state is ProfileError) {
              return Scaffold(
                backgroundColor: kBg,
                appBar: AppBar(
                  backgroundColor: kSurface,
                  elevation: 0,
                  title: const Text('Profile', style: TextStyle(color: kText, fontWeight: FontWeight.bold)),
                ),
                body: Center(
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
                ),
              );
            }

            if (state is! ProfileLoaded) {
              return const Scaffold(
                backgroundColor: kBg,
                body: Center(
                  child: CircularProgressIndicator(color: kPrimary),
                ),
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
            final partnerId = profile.deliveryPartnerId.isNotEmpty ? profile.deliveryPartnerId : 'N/A';

            String docStatus = 'verified';
            if (state.documents.isEmpty) {
              docStatus = 'pending';
            } else {
              for (var d in state.documents) {
                if (d.verificationStatus == 'rejected') docStatus = 'rejected';
                if (d.verificationStatus == 'pending' && docStatus != 'rejected') docStatus = 'pending';
              }
            }

            String vehicleStatus = 'verified';
            if (state.vehicles.isEmpty) {
              vehicleStatus = 'pending';
            } else {
              for (var v in state.vehicles) {
                if (v.verificationStatus == 'rejected') vehicleStatus = 'rejected';
                if (v.verificationStatus == 'pending' && vehicleStatus != 'rejected') vehicleStatus = 'pending';
              }
            }

            String bankStatus = 'verified';
            if (state.bankAccounts.isEmpty) {
              bankStatus = 'pending';
            } else {
              for (var b in state.bankAccounts) {
                if (b.verificationStatus == 'rejected') bankStatus = 'rejected';
                if (b.verificationStatus == 'pending' && bankStatus != 'rejected') bankStatus = 'pending';
              }
            }

            return Scaffold(
              backgroundColor: const Color(0xFFF8FAFC),
              body: RefreshIndicator(
                onRefresh: () async {
                  context.read<ProfileBloc>().add(FetchProfileEvent());
                },
                color: kPrimary,
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: _buildHeader(context, state, partnerName, partnerId),
                    ),

                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                        child: Column(
                          children: [
                            // ── ACCOUNT & PROFILE ─────────────────────────────────────
                            _buildSectionHeader(
                              'Account & Profile',
                              'Manage your personal and account details',
                            ),
                            Row(
                              children: [
                                _buildGridCard(
                                  'Personal Info',
                                  Icons.person_rounded,
                                  const Color(0xFF09AD42),
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => BlocProvider.value(
                                        value: context.read<ProfileBloc>(),
                                        child: const PersonalInfoScreen(),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                _buildGridCard(
                                  'Documents',
                                  Icons.assignment_turned_in_rounded,
                                  const Color(0xFF09AD42),
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => BlocProvider.value(
                                        value: context.read<ProfileBloc>(),
                                        child: const DocumentsScreen(),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                _buildGridCard(
                                  'Vehicle Info',
                                  Icons.two_wheeler_rounded,
                                  const Color(0xFF09AD42),
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => BlocProvider.value(
                                        value: context.read<ProfileBloc>(),
                                        child: const VehicleInfoScreen(),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                _buildGridCard(
                                  'Bank Details',
                                  Icons.account_balance_rounded,
                                  const Color(0xFF09AD42),
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => BlocProvider.value(
                                        value: context.read<ProfileBloc>(),
                                        child: const BankDetailsScreen(),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            _buildReferralCard(context, profile),
                            const SizedBox(height: 16),
                            SectionCard(
                              title: 'Performance & Operations',
                              icon: Icons.dashboard_customize_rounded,
                              children: [
                                InfoTile(
                                  label: 'Shifts & Performance',
                                  value: 'View attendance and leaderboard ranks',
                                  leadingIcon: Icons.history_rounded,
                                  onTap: () {
                                    final bloc = context.read<ProfileBloc>();
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => BlocProvider.value(
                                          value: bloc,
                                          child: PerformanceScreen(
                                            profile: profile,
                                            initialTab: PerformanceTab.attendance,
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                                InfoTile(
                                  label: 'Leave Requests',
                                  value: 'Apply for leave & notify admin in advance',
                                  leadingIcon: Icons.beach_access_rounded,
                                  onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => BlocProvider.value(
                                        value: context.read<ProfileBloc>(),
                                        child: const LeaveRequestScreen(),
                                      ),
                                    ),
                                  ),
                                ),
                                InfoTile(
                                  label: 'Support & Help Center',
                                  value: 'Contact Supervisor or submit issues',
                                  leadingIcon: Icons.support_agent_rounded,
                                  onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const SupportScreen(
                                        initialTabIndex: 0,
                                      ),
                                    ),
                                  ),
                                ),
                                InfoTile(
                                  label: 'Security Settings',
                                  value: 'Password and session management',
                                  leadingIcon: Icons.shield_rounded,
                                  onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => BlocProvider.value(
                                        value: context.read<ProfileBloc>(),
                                        child: const SecurityScreen(),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),

                            // ── REFERRAL SECTION ─────────────────────────────────────
                            _buildSectionHeader(
                              'Refer & Earn',
                              'Invite friends and earn rewards',
                            ),
                            _buildReferralLinkCard(context, profile),
                            const SizedBox(height: 12),
                            _buildLogoutCard(() {
                              _showLogoutConfirmationDialog(context);
                            }),
                            const SizedBox(height: 32),

                            const Text(
                              '🇮🇳 F2H Fresh Partner App · v2.5.0\nMade in India with Pride',
                              style: TextStyle(fontSize: 10, color: kMuted, fontWeight: FontWeight.bold, height: 1.5),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, ProfileLoaded state, String partnerName, String partnerId) {
    final profile = state.profile;

    return SizedBox(
      height: 250,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Curved Gradient Background Shape
          ClipPath(
            clipper: HeaderCurveClipper(),
            child: Container(
              width: double.infinity,
              height: 210,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF09AD42), Color(0xFF14532D)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Stack(
                children: [
                  // Dotted map path decoration in white (subtle opacity)
                  Positioned.fill(
                    child: Opacity(
                      opacity: 0.12,
                      child: CustomPaint(
                        painter: HeaderBackgroundPainter(
                          primaryColor: Colors.white,
                          primaryLtColor: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Title / App Header text at the top
          Positioned(
            top: 48,
            left: 20,
            child: Text(
              'Rider Profile',
              style: GoogleFonts.poppins(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
          ),

          // Notification Bell Icon Button with dynamic unread count
          Positioned(
            top: 40,
            right: 20,
            child: FutureBuilder<int>(
              future: _fetchUnreadCount(context),
              builder: (context, snapshot) {
                final count = snapshot.data ?? 0;
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 24),
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => NotificationsScreen(),
                        ),
                      ),
                    ),
                    if (count > 0)
                      Positioned(
                        right: 4,
                        top: 4,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444), // red badge
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            count.toString(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),

          // Floating User Profile Card
          Positioned(
            left: 16,
            right: 16,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
                ),
                child: Row(
                  children: [
                    // Avatar image with edit pencil icon overlay
                    Stack(
                      children: [
                        Container(
                          width: 74,
                          height: 74,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFF09AD42), width: 2.5),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.04),
                                blurRadius: 8,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(37),
                            child: profile.profilePhotoUrl != null && profile.profilePhotoUrl!.isNotEmpty
                                ? Image.network(
                                    profile.profilePhotoUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) => const Center(
                                      child: Text('👨‍✈️', style: TextStyle(fontSize: 36)),
                                    ),
                                  )
                                : const Center(
                                    child: Text('👨‍✈️', style: TextStyle(fontSize: 36)),
                                  ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: GestureDetector(
                            onTap: () => _pickAndUploadPhoto(context),
                            child: Container(
                              padding: const EdgeInsets.all(5),
                              decoration: const BoxDecoration(
                                color: Color(0xFF09AD42),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2)),
                                ],
                              ),
                              child: const Icon(
                                Icons.edit_rounded,
                                color: Colors.white,
                                size: 10,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),

                    // User name & ID details
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Hello, 👋',
                            style: GoogleFonts.poppins(
                              fontSize: 11,
                              color: const Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  partnerName,
                                  style: GoogleFonts.poppins(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF0F172A),
                                    letterSpacing: -0.5,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(
                                Icons.verified_rounded,
                                color: Color(0xFF09AD42),
                                size: 16,
                              ),
                            ],
                          ),
                          Text(
                            'ID: $partnerId',
                            style: GoogleFonts.poppins(
                              fontSize: 10,
                              color: const Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 6),
                          // Badges Row
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE8F8EE),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFFDCFCE7)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.home_work_rounded, color: Color(0xFF09AD42), size: 10),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Hub: ${profile.branchName ?? "Kuppam"}',
                                      style: GoogleFonts.poppins(
                                        fontSize: 9,
                                        color: const Color(0xFF09AD42),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE8F8EE),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFFDCFCE7)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.shield_rounded, color: Color(0xFF09AD42), size: 10),
                                    const SizedBox(width: 4),
                                    Text(
                                      'VERIFIED',
                                      style: GoogleFonts.poppins(
                                        fontSize: 9,
                                        color: const Color(0xFF09AD42),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
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
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, String subtitle, {String? viewAllText, VoidCallback? onViewAll}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          if (viewAllText != null && onViewAll != null)
            TextButton(
              onPressed: onViewAll,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Row(
                children: [
                  Text(
                    viewAllText,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF09AD42),
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(Icons.chevron_right_rounded, size: 14, color: Color(0xFF09AD42)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildGridCard(String title, IconData icon, Color color, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  color: const Color(0xFF059669),
                  size: 18,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.poppins(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1E293B),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFF94A3B8),
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPremiumWideCard(String title, String subtitle, IconData icon, Color color, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  icon,
                  color: color,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: GoogleFonts.poppins(
                        fontSize: 10,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFF94A3B8),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogoutCard(VoidCallback onTap) {
    return _buildPremiumWideCard(
      'Log Out Session',
      'Securely log out from your account',
      Icons.logout_rounded,
      const Color(0xFFEF4444),
      onTap,
    );
  }

  void _showLogoutConfirmationDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          backgroundColor: Colors.white,
          title: Row(
            children: const [
              Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFEF4444),
                size: 28,
              ),
              SizedBox(width: 10),
              Text(
                'Confirm Log Out',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  color: kText,
                ),
              ),
            ],
          ),
          content: const Text(
            'Are you sure you want to log out of your session? You will need your credentials to log back in.',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: kTextSub,
              height: 1.4,
            ),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'Cancel',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  color: kTextSub,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                context.read<AuthBloc>().add(LogoutRequested());
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: const Text(
                'Log Out',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildReferralLinkCard(BuildContext context, ProfileModel profile) {
    final code = (profile.referralCode ?? '').isNotEmpty ? profile.referralCode! : 'F2HDR-RIDER';
    return _buildPremiumWideCard(
      'Refer & Earn ₹75',
      'Share code "$code" & earn ₹75 per referral',
      Icons.share_rounded,
      const Color(0xFF09AD42),
      () => _showReferralShareDialog(context, code),
    );
  }

  void _showReferralShareDialog(BuildContext context, String code) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF09AD42).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.card_giftcard_rounded,
                  color: Color(0xFF09AD42),
                  size: 40,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Refer & Earn ₹75',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: kText,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Invite friends to join F2H Fresh. You earn ₹75 cash bonus for every partner or customer who registers using your code!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: kTextSub,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'YOUR REFERRAL CODE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: kTextSub,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          code,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF09AD42),
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF09AD42),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: code));
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Referral code "$code" copied to clipboard!'),
                            behavior: SnackBarBehavior.floating,
                            backgroundColor: const Color(0xFF09AD42),
                          ),
                        );
                      },
                      icon: const Icon(Icons.copy_rounded, size: 16),
                      label: const Text(
                        'Copy Code',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              // Referral Share Link Box
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.link_rounded, color: Color(0xFF09AD42), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'REFERRAL SHARE LINK',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: kTextSub,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'https://f2hfresh.com/refer?code=$code',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: kText,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF09AD42), width: 1.5),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: 'https://f2hfresh.com/refer?code=$code'));
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Referral link "https://f2hfresh.com/refer?code=$code" copied to clipboard!'),
                            behavior: SnackBarBehavior.floating,
                            backgroundColor: const Color(0xFF09AD42),
                          ),
                        );
                      },
                      icon: const Icon(Icons.link_rounded, size: 16, color: Color(0xFF09AD42)),
                      label: const Text(
                        'Copy Link',
                        style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF09AD42)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF25D366),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () async {
                        final msg = 'Join F2H Fresh with my referral code "$code" and get ₹100 bonus on your first order!\n\nLink: https://f2hfresh.com/refer?code=$code';
                        final url = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(msg)}');
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url, mode: LaunchMode.externalApplication);
                        } else {
                          Clipboard.setData(ClipboardData(text: msg));
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Referral invite message copied to clipboard!'),
                                backgroundColor: Color(0xFF09AD42),
                              ),
                            );
                          }
                        }
                      },
                      icon: const Icon(Icons.share_rounded, size: 16),
                      label: const Text(
                        'Share Link',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildReferralCard(BuildContext context, ProfileModel profile) {
    final earnings = profile.referralEarnings ?? 0.0;
    final count = profile.referralCount ?? 0;
    final code = (profile.referralCode ?? '').isNotEmpty ? profile.referralCode! : 'F2HDR-RIDER';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF09AD42).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.card_giftcard_rounded,
                      color: Color(0xFF09AD42),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Referral Earnings',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: kText,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Earn ₹75 per successful referral',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: kTextSub,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF09AD42).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF09AD42).withOpacity(0.2)),
                ),
                child: const Text(
                  '₹75 / Refer',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF09AD42),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'TOTAL EARNED',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: kTextSub,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${earnings.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF09AD42),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 1,
                  height: 36,
                  color: const Color(0xFFE2E8F0),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TOTAL REFERRED',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: kTextSub,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$count Partners',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: kText,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text(
                    'Your Code: ',
                    style: TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    code,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF09AD42), fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                ],
              ),
              InkWell(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Referral Code "$code" copied to clipboard!'),
                      behavior: SnackBarBehavior.floating,
                      backgroundColor: const Color(0xFF09AD42),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.copy_rounded, size: 14, color: Color(0xFF09AD42)),
                      SizedBox(width: 4),
                      Text(
                        'Copy Code',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF09AD42)),
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

class HeaderBackgroundPainter extends CustomPainter {
  final Color primaryColor;
  final Color primaryLtColor;

  HeaderBackgroundPainter({required this.primaryColor, required this.primaryLtColor});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = primaryColor
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final mapPath = Path();
    final startPt = Offset(size.width * 0.76, size.height * 0.40);
    final midPt1 = Offset(size.width * 0.68, size.height * 0.52);
    final midPt2 = Offset(size.width * 0.88, size.height * 0.67);
    final endPt = Offset(size.width * 0.92, size.height * 0.54);

    mapPath.moveTo(startPt.dx, startPt.dy);
    mapPath.cubicTo(
      midPt1.dx, midPt1.dy,
      midPt2.dx, midPt2.dy,
      endPt.dx, endPt.dy,
    );

    _drawDashedPath(canvas, mapPath, paint, 4, 4);

    final birdPaint = Paint()
      ..color = primaryColor
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;
      
    _drawBird(canvas, Offset(size.width * 0.73, size.height * 0.30), 5, birdPaint);
    _drawBird(canvas, Offset(size.width * 0.78, size.height * 0.26), 6, birdPaint);
  }

  void _drawDashedPath(Canvas canvas, Path path, Paint paint, double dashWidth, double dashSpace) {
    final ui.PathMetrics pathMetrics = path.computeMetrics();
    for (ui.PathMetric metric in pathMetrics) {
      double distance = 0.0;
      while (distance < metric.length) {
        final double length = dashWidth;
        final Path extract = metric.extractPath(distance, distance + length);
        canvas.drawPath(extract, paint);
        distance += length + dashSpace;
      }
    }
  }

  void _drawBird(Canvas canvas, Offset center, double size, Paint paint) {
    final path = Path()
      ..moveTo(center.dx - size, center.dy + size * 0.3)
      ..quadraticBezierTo(center.dx - size * 0.5, center.dy - size * 0.3, center.dx, center.dy)
      ..quadraticBezierTo(center.dx + size * 0.5, center.dy - size * 0.3, center.dx + size, center.dy + size * 0.3);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class HeaderCurveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height - 40);
    path.quadraticBezierTo(
      size.width / 2, size.height + 20,
      size.width, size.height - 40,
    );
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
