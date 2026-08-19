import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/features/profile/presentation/screens/referral_screen.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class ReferralBannerWidget extends StatelessWidget {
  final EdgeInsetsGeometry? margin;

  const ReferralBannerWidget({
    super.key,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, sessionState) {
        final profile = sessionState.profile;
        final isLoggedIn = profile != null;

        final userId = profile?.userId ??
            profile?.customerId ??
            sessionState.wallet['user_id']?.toString() ??
            sessionState.wallet['customer_id']?.toString();

        final rawCode = (userId != null && userId.isNotEmpty)
            ? userId
            : (profile?.referralCode ?? sessionState.wallet['referral_code']?.toString());

        final rawStatus = profile?.referralStatus ??
            sessionState.wallet['referral_status']?.toString();

        final firstOrderCompleted = (profile?.firstOrderCompleted == true) ||
            (sessionState.wallet['first_order_completed'] == true ||
             sessionState.wallet['first_order_completed']?.toString() == 'true' ||
             sessionState.wallet['first_order_completed'] == 1) ||
            (rawStatus?.toLowerCase() == 'active' || rawStatus?.toLowerCase() == 'unlocked');

        final isUnlocked = isLoggedIn && firstOrderCompleted;
        final isLocked = isLoggedIn && !firstOrderCompleted;

        final displayCode = isUnlocked
            ? (rawCode != null && rawCode.isNotEmpty ? rawCode : 'F2HREF')
            : (isLoggedIn ? 'LOCKED' : 'SIGN IN');

        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ReferralScreen(
                  referralCode: isUnlocked ? rawCode : null,
                  referralStatus: isUnlocked ? 'active' : 'locked',
                ),
              ),
            );
          },
          child: Container(
            margin: margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFF15803D),
                  Color(0xFF16A34A),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.2),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Top Row: Yellow Gift Circle + Title & Subtitle ──────────
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Gift Circle Icon
                    Container(
                      width: 50,
                      height: 50,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFDE68A),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Icon(
                          isLocked
                              ? Icons.lock_outline_rounded
                              : Icons.card_giftcard_rounded,
                          color: const Color(0xFF92400E),
                          size: 26,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    // Text Details
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Invite & Earn ₹100!',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              height: 1.2,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            isLocked
                                ? 'Make your first order to unlock referral code.'
                                : 'Share your referral code and get ₹100 when your friend places their first order.',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: Colors.white.withValues(alpha: 0.9),
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // ── Bottom Inner Box: Referral Code + Copy Button ──────────
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.15),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Referral Code Label & Value
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isLoggedIn ? 'YOUR REFERRAL CODE' : 'APP INVITE CODE',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF6EE7B7),
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isLocked
                                  ? 'LOCKED'
                                  : (isUnlocked ? displayCode : 'APP INVITE'),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 1.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(width: 12),

                      // White Action Button (Copy when unlocked / Share when locked or guest)
                      GestureDetector(
                        onTap: () async {
                          if (isUnlocked) {
                            Clipboard.setData(ClipboardData(text: displayCode));
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Copied referral code "$displayCode" to clipboard! 📋'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          } else {
                            // Allow customer to share app referral link at any stage
                            const inviteMsg = 'Join F2H — Farm To Home & Get fresh farm produce delivered! 🥬🍓\nFresh farm products, delivered to your doorstep.\nhttps://f2h.app.link/invite';
                            try {
                              final encodedMsg = Uri.encodeComponent(inviteMsg);
                              final whatsappUri = Uri.parse('https://wa.me/?text=$encodedMsg');
                              if (await canLaunchUrl(whatsappUri)) {
                                await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
                              } else {
                                await Clipboard.setData(const ClipboardData(text: 'https://f2h.app.link/invite'));
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('App Invite link copied to clipboard! 📋'),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              }
                            } catch (_) {
                              await Clipboard.setData(const ClipboardData(text: 'https://f2h.app.link/invite'));
                            }
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.1),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isUnlocked ? Icons.copy_rounded : Icons.share_rounded,
                                color: kPrimary,
                                size: 16,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isUnlocked ? 'Copy' : 'Share',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: kPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
