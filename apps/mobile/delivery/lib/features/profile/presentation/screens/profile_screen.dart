import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/core/di/injection.dart';
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

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ProfileBloc>()..add(FetchProfileEvent()),
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

          // Automatically push DocumentsScreen if requested by cross-tab navigation
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

          // Summary status indicators
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

          String getStatusEmoji(String status) {
            if (status == 'verified') return '✅';
            if (status == 'rejected') return '❌';
            return '⏳';
          }

          return Scaffold(
            backgroundColor: kBg,
            body: RefreshIndicator(
              onRefresh: () async {
                context.read<ProfileBloc>().add(FetchProfileEvent());
              },
              color: kPrimary,
              child: CustomScrollView(
                slivers: [
                  SliverAppBar(
                    backgroundColor: kPrimary,
                    expandedHeight: 180,
                    pinned: true,
                    flexibleSpace: FlexibleSpaceBar(
                      background: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF1B4332), Color(0xFF2D6A4F)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
                        child: Row(
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: kAccent, width: 3),
                                boxShadow: const [
                                  BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 3))
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(36),
                                child: profile.profilePhotoUrl != null && profile.profilePhotoUrl!.isNotEmpty
                                    ? Image.network(
                                        profile.profilePhotoUrl!,
                                        fit: BoxFit.cover,
                                        errorBuilder: (context, error, stackTrace) => const Center(
                                          child: Text('👨‍✈️', style: TextStyle(fontSize: 40)),
                                        ),
                                      )
                                    : const Center(
                                        child: Text('👨‍✈️', style: TextStyle(fontSize: 40)),
                                      ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        partnerName,
                                        style: const TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                          letterSpacing: -0.5,
                                        ),
                                      ),
                                      if (profile.isVerified) ...[
                                        const SizedBox(width: 6),
                                        const Icon(
                                          Icons.verified_rounded,
                                          color: kAccent,
                                          size: 18,
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    'ID: $partnerId',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Colors.white70,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: Colors.white24,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          '🛵 Hub: ${profile.branchName ?? "Not Assigned"}',
                                          style: const TextStyle(
                                            fontSize: 10,
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: profile.isVerified
                                              ? kPrimaryLt.withValues(alpha: 0.3)
                                              : kAccent.withValues(alpha: 0.3),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: profile.isVerified ? kPrimaryLt : kAccent,
                                            width: 1,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              profile.isVerified
                                                  ? Icons.check_circle_rounded
                                                  : Icons.hourglass_empty_rounded,
                                              color: profile.isVerified ? Colors.white : kAccent,
                                              size: 10,
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              profile.isVerified ? 'VERIFIED' : 'PENDING',
                                              style: TextStyle(
                                                fontSize: 9,
                                                color: profile.isVerified ? Colors.white : kAccent,
                                                fontWeight: FontWeight.w900,
                                                letterSpacing: 0.5,
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
                  if (state.isOffline)
                    SliverToBoxAdapter(
                      child: Container(
                        color: Colors.amber.shade800,
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.wifi_off_rounded, color: Colors.white, size: 16),
                            const SizedBox(width: 8),
                            Text(
                              profile.deliveryPartnerId.isEmpty
                                  ? 'Offline Mode · No cached profile data'
                                  : 'Offline Mode · Showing cached profile data',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          SectionCard(
                            title: 'Profile Settings',
                            icon: Icons.manage_accounts_rounded,
                            children: [
                              InfoTile(
                                label: 'Personal Information',
                                value: profile.email,
                                leadingIcon: Icons.person_rounded,
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => BlocProvider.value(
                                      value: context.read<ProfileBloc>(),
                                      child: const PersonalInfoScreen(),
                                    ),
                                  ),
                                ),
                              ),
                              InfoTile(
                                label: 'Documents & Verification',
                                value: '${getStatusEmoji(docStatus)} Document proofs',
                                leadingIcon: Icons.description_rounded,
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => BlocProvider.value(
                                      value: context.read<ProfileBloc>(),
                                      child: const DocumentsScreen(),
                                    ),
                                  ),
                                ),
                              ),
                              InfoTile(
                                label: 'Vehicle Information',
                                value: '${getStatusEmoji(vehicleStatus)} ${profile.vehicleNumber.isNotEmpty ? profile.vehicleNumber : "Not Configured"}',
                                leadingIcon: Icons.motorcycle_rounded,
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => BlocProvider.value(
                                      value: context.read<ProfileBloc>(),
                                      child: const VehicleInfoScreen(),
                                    ),
                                  ),
                                ),
                              ),
                              InfoTile(
                                label: 'Bank Details',
                                value: '${getStatusEmoji(bankStatus)} Payout Account',
                                leadingIcon: Icons.account_balance_rounded,
                                onTap: () => Navigator.push(
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
                            ],
                          ),
                          SectionCard(
                            title: 'System Preferences',
                            icon: Icons.settings_rounded,
                            children: [
                              InfoTile(
                                label: 'Notifications & Preferences',
                                value: 'Config alerts and app language',
                                leadingIcon: Icons.notifications_rounded,
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => BlocProvider.value(
                                      value: context.read<ProfileBloc>(),
                                      child: const NotificationsPreferencesScreen(),
                                    ),
                                  ),
                                ),
                              ),
                              InfoTile(
                                label: 'Activity Logs',
                                value: 'Device info and app version',
                                leadingIcon: Icons.assessment_rounded,
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => BlocProvider.value(
                                      value: context.read<ProfileBloc>(),
                                      child: const ActivityScreen(),
                                    ),
                                  ),
                                ),
                              ),
                              InfoTile(
                                label: 'Security Settings',
                                value: 'Password and session management',
                                leadingIcon: Icons.lock_rounded,
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
                          const SizedBox(height: 8),
                          GestureDetector(
                            onTap: () {
                              context.read<AuthBloc>().add(LogoutRequested());
                            },
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              decoration: BoxDecoration(
                                color: kRedLt,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: kRed.withValues(alpha: 0.2), width: 1.5),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.logout_rounded, color: kRed, size: 20),
                                  SizedBox(width: 8),
                                  Text(
                                    'LOG OUT SESSION',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      color: kRed,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            '🇮🇳 F2H Fresh Partner App · v2.5.0\nMade in India with Pride',
                            style: TextStyle(fontSize: 10, color: kMuted, fontWeight: FontWeight.bold, height: 1.5),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 32),
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
    );
  }
}
