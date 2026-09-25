import 'dart:async';
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
import 'package:f2h_customer/auth/presentation/widgets/auth_kit.dart';
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
import 'package:f2h_customer/features/profile/presentation/screens/zone_expansion_screen.dart';

// ----------------------------------------------------------
//  PROFILE SCREEN - Premium farm-market design
// ----------------------------------------------------------
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

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
        } else {
          context.read<CustomerSessionCubit>().refreshSilently();
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
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _CustomerPersonalDetailsSheet(
        profile: profile,
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
    super.build(context);
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
                  leading: Navigator.canPop(context)
                      ? IconButton(
                          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: _inkGreen),
                          onPressed: () => Navigator.pop(context),
                        )
                      : null,
                  titleSpacing: Navigator.canPop(context) ? 0 : 24,
                  title: const Text(
                    'My Profile',
                    style: TextStyle(
                      color: _inkGreen,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
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
                              Icons.radar_rounded,
                              'Request Zone Coverage',
                              const Color(0xFFFEF3C7),
                              const Color(0xFFD97706),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const ZoneExpansionScreen(),
                                ),
                              ),
                            ),
                            _divider(),
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

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER PERSONAL DETAILS SHEET WITH INLINE OTP VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

class _CustomerPersonalDetailsSheet extends StatefulWidget {
  final ProfileModel? profile;

  const _CustomerPersonalDetailsSheet({
    this.profile,
  });

  @override
  State<_CustomerPersonalDetailsSheet> createState() =>
      _CustomerPersonalDetailsSheetState();
}

class _CustomerPersonalDetailsSheetState
    extends State<_CustomerPersonalDetailsSheet> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  late final TextEditingController _dobController;

  late final String _initialEmail;
  late final String _initialPhone;

  String _selectedGender = 'Male';
  bool _isSaving = false;

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
    _firstNameController = TextEditingController(
      text: p?.firstName.isNotEmpty == true
          ? p!.firstName
          : (p?.name.isNotEmpty == true ? p!.name : ''),
    );
    _lastNameController = TextEditingController(text: p?.lastName ?? '');

    _initialEmail = (p?.email ?? '').trim().toLowerCase();
    _emailController = TextEditingController(text: p?.email ?? '');

    String rawPhone = p?.mobile ?? '';
    _initialPhone = rawPhone
        .replaceAll(RegExp(r'[\s\-+()]'), '')
        .replaceFirst(RegExp(r'^(91|0)'), '');
    if (_initialPhone.length > 10) _initialPhone = _initialPhone.substring(0, 10);
    _phoneController = TextEditingController(text: _initialPhone);

    _dobController = TextEditingController(
      text: p?.dob != null && p!.dob.isNotEmpty ? p.dob.split('T')[0] : '',
    );

    if (p?.gender != null && p!.gender.isNotEmpty) {
      _selectedGender = ['Male', 'Female', 'Other', 'Prefer not to say'].firstWhere(
        (g) => g.toLowerCase() == p.gender.toLowerCase().trim(),
        orElse: () => 'Male',
      );
    }
  }

  @override
  void dispose() {
    _emailTimer?.cancel();
    _phoneTimer?.cancel();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _dobController.dispose();
    _emailOtpController.dispose();
    _phoneOtpController.dispose();
    super.dispose();
  }

  bool get _isEmailChanged {
    final current = _emailController.text.trim().toLowerCase();
    return current.isNotEmpty && current != _initialEmail;
  }

  bool get _isPhoneChanged {
    final clean = _phoneController.text
        .replaceAll(RegExp(r'[\s\-+()]'), '')
        .replaceFirst(RegExp(r'^(91|0)'), '');
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
      final bootstrapApi = context.read<CustomerSessionCubit>().bootstrapApi;
      await bootstrapApi.sendUpdateOtp(type: 'email', value: cleanEmail);
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
      final bootstrapApi = context.read<CustomerSessionCubit>().bootstrapApi;
      final token = await bootstrapApi.verifyUpdateOtp(
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
    final cleanPhone = _phoneController.text
        .replaceAll(RegExp(r'[\s\-+()]'), '')
        .replaceFirst(RegExp(r'^(91|0)'), '');
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
      final bootstrapApi = context.read<CustomerSessionCubit>().bootstrapApi;
      await bootstrapApi.sendUpdateOtp(type: 'phone', value: cleanPhone);
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
    final cleanPhone = _phoneController.text
        .replaceAll(RegExp(r'[\s\-+()]'), '')
        .replaceFirst(RegExp(r'^(91|0)'), '');
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
      final bootstrapApi = context.read<CustomerSessionCubit>().bootstrapApi;
      final token = await bootstrapApi.verifyUpdateOtp(
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

  Future<void> _onSaveChanges() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_isEmailChanged && !_isEmailVerified) {
      setState(() {
        _generalError =
            'Please request and verify the OTP for your new Email Address before saving.';
      });
      return;
    }

    if (_isPhoneChanged && !_isPhoneVerified) {
      setState(() {
        _generalError =
            'Please request and verify the OTP for your new Mobile Number before saving.';
      });
      return;
    }

    final cleanPhone = _phoneController.text
        .replaceAll(RegExp(r'[\s\-+()]'), '')
        .replaceFirst(RegExp(r'^(91|0)'), '');
    final cleanEmail = _emailController.text.trim().toLowerCase();

    final updates = <String, dynamic>{
      'first_name': _firstNameController.text.trim(),
      'last_name': _lastNameController.text.trim(),
      'email': cleanEmail,
      'mobile': cleanPhone,
      'gender': _selectedGender,
      'dob': _dobController.text.trim().isEmpty ? null : _dobController.text.trim(),
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

    setState(() {
      _isSaving = true;
      _generalError = null;
    });

    try {
      await context.read<CustomerSessionCubit>().updateProfile(updates);
      if (mounted) {
        F2HToast.success(context, 'Personal details updated successfully');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaving = false;
          _generalError = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(
        24,
        14,
        24,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Pull indicator handle
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: kMuted.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),

              // Title Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: kPrimaryPl,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.person_outline_rounded,
                          color: kPrimary,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Personal Details',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: kText,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: kTextSub),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Name Row (First Name + Last Name)
              Row(
                children: [
                  Expanded(
                    child: _buildFormField(
                      label: 'First Name',
                      controller: _firstNameController,
                      placeholder: 'First name',
                      icon: Icons.badge_outlined,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return 'Enter first name';
                        if (val.trim().length < 2) return 'Min 2 characters';
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildFormField(
                      label: 'Last Name',
                      controller: _lastNameController,
                      placeholder: 'Last name',
                      icon: Icons.person_outline_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // ── EMAIL FIELD WITH INLINE OTP VERIFICATION ─────────────────
              _buildEmailSection(),
              const SizedBox(height: 14),

              // ── MOBILE FIELD WITH INLINE OTP VERIFICATION ────────────────
              _buildPhoneSection(),
              const SizedBox(height: 14),

              // Date of Birth
              _buildDobField(),
              const SizedBox(height: 14),

              // Gender Selector
              _buildGenderSection(),
              const SizedBox(height: 16),

              // General error banner if present
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
                      const Icon(
                        Icons.warning_amber_rounded,
                        size: 18,
                        color: Color(0xFFDC2626),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _generalError!,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFDC2626),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Save Changes Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _onSaveChanges,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Save Changes',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.2,
                          ),
                        ),
                ),
              ),
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
            const Text(
              'Email Address',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: kTextSub,
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
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, size: 12, color: Color(0xFF16A34A)),
                    SizedBox(width: 4),
                    Text(
                      'Verified',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF15803D),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),

        TextFormField(
          controller: _emailController,
          readOnly: _isEmailVerified,
          keyboardType: TextInputType.emailAddress,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: kText,
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
            hintStyle: const TextStyle(fontSize: 13, color: kMuted),
            prefixIcon: const Icon(Icons.mail_outline_rounded, color: kPrimaryMid, size: 19),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            filled: true,
            fillColor: _isEmailVerified ? const Color(0xFFF0FDF4) : kBg,
            suffixIcon: isDiff && !_isEmailVerified
                ? Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: TextButton(
                      onPressed: (_isSendingEmailOtp || _emailCountdown > 0)
                          ? null
                          : _sendEmailOtp,
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
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF2563EB),
                              ),
                            )
                          : Text(
                              _emailCountdown > 0
                                  ? '${_emailCountdown}s'
                                  : (_isEmailOtpSent ? 'Resend OTP' : 'Request OTP'),
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF1D4ED8),
                              ),
                            ),
                    ),
                  )
                : null,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                color: _isEmailVerified ? const Color(0xFF86EFAC) : kBorder,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kPrimary, width: 1.8),
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
                    const Icon(
                      Icons.mark_email_read_outlined,
                      size: 15,
                      color: Color(0xFF0284C7),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Enter 6-digit OTP sent to ${_emailController.text.trim()}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0369A1),
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
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 4,
                            color: kText,
                          ),
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: '• • • • • •',
                            hintStyle: const TextStyle(
                              fontSize: 14,
                              letterSpacing: 3,
                              color: kMuted,
                            ),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
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
                              borderSide: const BorderSide(
                                color: Color(0xFF0284C7),
                                width: 1.5,
                              ),
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
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          elevation: 0,
                        ),
                        child: _isVerifyingEmailOtp
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Verify OTP',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
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
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFDC2626),
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
            const Text(
              'Mobile Number',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: kTextSub,
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
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, size: 12, color: Color(0xFF16A34A)),
                    SizedBox(width: 4),
                    Text(
                      'Verified',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF15803D),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),

        TextFormField(
          controller: _phoneController,
          readOnly: _isPhoneVerified,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          inputFormatters: [
            IndianMobileNumberInputFormatter(),
          ],
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: kText,
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
            prefixStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: kText,
            ),
            hintText: '10-digit mobile number',
            hintStyle: const TextStyle(fontSize: 13, color: kMuted),
            prefixIcon: const Icon(
              Icons.phone_android_rounded,
              color: kPrimaryMid,
              size: 19,
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            filled: true,
            fillColor: _isPhoneVerified ? const Color(0xFFF0FDF4) : kBg,
            suffixIcon: isDiff && !_isPhoneVerified
                ? Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: TextButton(
                      onPressed: (_isSendingPhoneOtp || _phoneCountdown > 0)
                          ? null
                          : _sendPhoneOtp,
                      style: TextButton.styleFrom(
                        backgroundColor: const Color(0xFFEFF6FF),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: const BorderSide(color: Color(0xFFBFDBFE)),
                        ),
                      ),
                      child: _isSendingPhoneOtp
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF2563EB),
                              ),
                            )
                          : Text(
                              _phoneCountdown > 0
                                  ? '${_phoneCountdown}s'
                                  : (_isPhoneOtpSent ? 'Resend OTP' : 'Request OTP'),
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF1D4ED8),
                              ),
                            ),
                    ),
                  )
                : null,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                color: _isPhoneVerified ? const Color(0xFF86EFAC) : kBorder,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kPrimary, width: 1.8),
            ),
          ),
          validator: (val) {
            if (val == null || val.trim().isEmpty) return 'Enter mobile number';
            final clean = val.replaceAll(RegExp(r'[\s\-+()]'), '').replaceFirst(RegExp(r'^(91|0)'), '');
            if (clean.length != 10) return 'Enter 10-digit mobile number';
            if (!RegExp(r'^[6-9]\d{9}$').hasMatch(clean)) {
              return 'Mobile number must start with 6, 7, 8, or 9';
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
              color: const Color(0xFFF0F9FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBAE6FD)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.sms_outlined,
                      size: 15,
                      color: Color(0xFF0284C7),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Enter 6-digit OTP sent to +91 ${_phoneController.text.trim()}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0369A1),
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
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 4,
                            color: kText,
                          ),
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: '• • • • • •',
                            hintStyle: const TextStyle(
                              fontSize: 14,
                              letterSpacing: 3,
                              color: kMuted,
                            ),
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
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
                              borderSide: const BorderSide(
                                color: Color(0xFF0284C7),
                                width: 1.5,
                              ),
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
                          backgroundColor: const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          elevation: 0,
                        ),
                        child: _isVerifyingPhoneOtp
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Verify OTP',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
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
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFDC2626),
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

  // ── FORM FIELD HELPER ──────────────────────────────────────────────────────
  Widget _buildFormField({
    required String label,
    required TextEditingController controller,
    required String placeholder,
    required IconData icon,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: kTextSub,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          validator: validator,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: kText,
          ),
          decoration: InputDecoration(
            hintText: placeholder,
            hintStyle: const TextStyle(fontSize: 13, color: kMuted),
            prefixIcon: Icon(icon, color: kPrimaryMid, size: 19),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            filled: true,
            fillColor: kBg,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kPrimary, width: 1.8),
            ),
          ),
        ),
      ],
    );
  }

  // ── DATE OF BIRTH FIELD ────────────────────────────────────────────────────
  Widget _buildDobField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Date of Birth',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: kTextSub,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: _dobController,
          readOnly: true,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: kText,
          ),
          decoration: InputDecoration(
            hintText: 'YYYY-MM-DD',
            hintStyle: const TextStyle(fontSize: 13, color: kMuted),
            prefixIcon: const Icon(
              Icons.calendar_today_rounded,
              color: kPrimaryMid,
              size: 19,
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            filled: true,
            fillColor: kBg,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: kPrimary, width: 1.8),
            ),
          ),
          onTap: () async {
            final now = DateTime.now();
            final initialDate = _dobController.text.trim().isNotEmpty
                ? (DateTime.tryParse(_dobController.text.trim()) ??
                    now.subtract(const Duration(days: 365 * 25)))
                : now.subtract(const Duration(days: 365 * 25));
            final date = await showDatePicker(
              context: context,
              initialDate: initialDate,
              firstDate: DateTime(1940),
              lastDate: now,
              builder: (ctx, child) {
                return Theme(
                  data: Theme.of(ctx).copyWith(
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
              setState(() {
                _dobController.text =
                    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
              });
            }
          },
        ),
      ],
    );
  }

  // ── GENDER SECTION ─────────────────────────────────────────────────────────
  Widget _buildGenderSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Gender',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: kTextSub,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            _buildGenderOption('Male', Icons.male_rounded),
            const SizedBox(width: 8),
            _buildGenderOption('Female', Icons.female_rounded),
            const SizedBox(width: 8),
            _buildGenderOption('Other', Icons.transgender_rounded),
          ],
        ),
      ],
    );
  }

  Widget _buildGenderOption(String value, IconData icon) {
    final isSelected = _selectedGender.toLowerCase() == value.toLowerCase();
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedGender = value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? kPrimaryPl : kBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? kPrimary : kBorder,
              width: isSelected ? 1.8 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isSelected ? kPrimary : kTextSub,
              ),
              const SizedBox(width: 4),
              Text(
                value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: isSelected ? kPrimary : kTextSub,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

