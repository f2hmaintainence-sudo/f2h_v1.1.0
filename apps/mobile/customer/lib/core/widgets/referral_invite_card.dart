import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/features/profile/presentation/screens/referral_screen.dart';

/// Refer-and-earn card shown on Home and Profile.
///
/// Three states, driven by the session: signed out (prompt to explore the
/// programme), locked (code arrives after the first order) and active (code
/// with copy + share). Tapping anywhere outside the buttons opens the full
/// referral screen.
class ReferralInviteCard extends StatelessWidget {
  final EdgeInsetsGeometry margin;

  const ReferralInviteCard({
    super.key,
    this.margin = const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
  });

  static const Color _deep = Color(0xFF043927);
  static const Color _mint = Color(0xFFA7F3D0);
  static const Color _forest = Color(0xFF064E3B);
  static const Color _amber = Color(0xFFB45309);

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, sessionState) {
        final profile = sessionState.profile;
        final isLoggedIn = profile != null;
        final rawCode =
            profile?.referralCode ??
            sessionState.wallet['referral_code']?.toString();
        final rawStatus =
            profile?.referralStatus ??
            sessionState.wallet['referral_status']?.toString();
        final isLocked = isLoggedIn && (rawStatus?.toLowerCase() == 'locked');
        final code =
            (isLoggedIn && !isLocked && rawCode != null && rawCode.isNotEmpty)
            ? rawCode
            : null;

        return Padding(
          padding: margin,
          child: Align(
            alignment: Alignment.center,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ReferralScreen(
                      referralCode: rawCode,
                      referralStatus: rawStatus,
                    ),
                  ),
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: _forest.withValues(alpha: 0.28),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Stack(
                      children: [
                        // Base gradient matching profile card theme
                        Positioned.fill(
                          child: DecoratedBox(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Color(0xFF0D331E),
                                  Color(0xFF16A34A),
                                  Color(0xFF15803D),
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                          ),
                        ),
                        // Leaf watermark background decor
                        Positioned(
                          right: -15,
                          bottom: -20,
                          child: Icon(
                            Icons.eco_rounded,
                            size: 140,
                            color: Colors.white.withValues(alpha: 0.08),
                          ),
                        ),
                        // Soft light bloom
                        Positioned(right: -34, top: -46, child: _glow(126, 0.08)),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 15),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _header(isLocked: isLocked, isLoggedIn: isLoggedIn),
                              const SizedBox(height: 13),
                              Divider(
                                height: 1,
                                thickness: 1,
                                color: Colors.white.withValues(alpha: 0.12),
                              ),
                              const SizedBox(height: 13),
                              if (code != null)
                                _activeRow(context, code)
                              else if (isLocked)
                                _noticeRow(
                                  icon: Icons.lock_clock_rounded,
                                  text:
                                      'Place your first order to unlock your invite code.',
                                )
                              else
                                _noticeRow(
                                  icon: Icons.login_rounded,
                                  text: 'Sign in to get your personal invite code.',
                                  actionLabel: 'View',
                                  onAction: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => ReferralScreen(
                                        referralCode: rawCode,
                                        referralStatus: rawStatus,
                                      ),
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
            ),
          ),
        );
      },
    );
  }

  Widget _glow(double size, double opacity) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: Colors.white.withValues(alpha: opacity),
    ),
  );

  // ── Top half: gift badge, eyebrow, headline, reward pills ──────────────

  Widget _header({required bool isLocked, required bool isLoggedIn}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFECFDF5), Color(0xFFA7F3D0)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF059669).withValues(alpha: 0.35),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Icon(
            isLocked ? Icons.lock_outline_rounded : Icons.redeem_rounded,
            color: _forest,
            size: 23,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'REFER & EARN',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: _mint,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 3),
              const FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  'Invite friends, earn ₹100 each',
                  maxLines: 1,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    height: 1.15,
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    _RewardPill(label: '₹100 for you'),
                    SizedBox(width: 6),
                    _RewardPill(label: 'On first order delivered'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Bottom half: the code block plus the share button ──────────────────

  Widget _activeRow(BuildContext context, String code) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 340;
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => _copyCode(context, code),
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: isNarrow ? 10 : 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.4),
                        width: 1.2,
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text(
                                'YOUR CODE',
                                style: TextStyle(
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.w900,
                                  color: _mint,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              const SizedBox(height: 2),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  code,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    letterSpacing: 1.6,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(
                          Icons.copy_rounded,
                          size: 15,
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _shareCode(context, code),
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: isNarrow ? 12 : 18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.14),
                        blurRadius: 6,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.share_rounded, color: _forest, size: 15),
                      const SizedBox(width: 5),
                      Text(
                        'Share',
                        style: TextStyle(
                          fontSize: isNarrow ? 12 : 13,
                          fontWeight: FontWeight.w900,
                          color: _forest,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Locked / signed-out variant of the bottom half.
  Widget _noticeRow({
    required IconData icon,
    required String text,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  Icon(icon, size: 15, color: _mint),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      text,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        height: 1.25,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (actionLabel != null) ...[
            const SizedBox(width: 10),
            GestureDetector(
              onTap: onAction,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Text(
                    actionLabel,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: _forest,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────

  static void _copyCode(BuildContext context, String code) {
    Clipboard.setData(ClipboardData(text: code));
    F2HToast.success(context, 'Invite code $code copied!');
  }

  static Future<void> _shareCode(BuildContext context, String code) async {
    final message =
        'Your F2H Invite is Ready\n\n'
        'Fresh farm products, delivered to your doorstep.\n\n'
        'Invite Code: $code\n'
        'https://f2h.app.link/$code\n\n'
        'F2H — Farm To Home\n'
        'Fresh. Smart. Rewarding.';
    final encodedMsg = Uri.encodeComponent(message);
    final whatsappUri = Uri.parse('https://wa.me/?text=$encodedMsg');

    try {
      if (await canLaunchUrl(whatsappUri)) {
        await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
        return;
      }
    } catch (_) {
      // Falls through to the clipboard copy below.
    }

    Clipboard.setData(ClipboardData(text: message));
    if (context.mounted) {
      F2HToast.success(context, 'Referral message copied to clipboard!');
    }
  }
}

class _RewardPill extends StatelessWidget {
  final String label;

  const _RewardPill({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          color: ReferralInviteCard._mint,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
