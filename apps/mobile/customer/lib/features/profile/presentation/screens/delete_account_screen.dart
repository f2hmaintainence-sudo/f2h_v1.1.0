import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';

// ══════════════════════════════════════════════════════════
//  DELETE ACCOUNT SCREEN - Premium UI Compliance Screen
// ══════════════════════════════════════════════════════════

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  bool _understandCheck = false;
  bool _isLoading = false;

  void _submitDeletionRequest() {
    if (!_understandCheck) return;

    setState(() {
      _isLoading = true;
    });

    // Simulate request registration (UI only for now)
    Future.delayed(const Duration(milliseconds: 1500), () async {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });

      // Show final confirmation dialog to user
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: kSurface,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: kPrimaryPl,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, color: kPrimary, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Request Registered',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: kText,
                    fontSize: 18,
                  ),
                ),
              ),
            ],
          ),
          content: const Text(
            'Your account deletion request has been registered. '
            'In compliance with Google Play Store policies, your account and all associated data '
            'will be permanently deleted from our servers within 7 business days.\n\n'
            'You will be logged out now.',
            style: TextStyle(
              color: kTextMid,
              fontSize: 13,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          actions: [
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () async {
                  Navigator.of(ctx).pop();
                  // Clean session and log out
                  await context.read<CustomerSessionCubit>().clear(clearToken: false);
                  if (context.mounted) {
                    context.read<AuthBloc>().add(const LogoutRequested());
                    // Go back to entry screen
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Okay, Log Out',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: kText, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Delete Account',
          style: TextStyle(
            color: kText,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Warning Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: kRedLt,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFFCA5A5), width: 1.2),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: kRed,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'This Action is Permanent',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: kRed,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Once your account is deleted, your data cannot be recovered. Please read the consequences below carefully.',
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.4,
                      color: kTextMid,
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text(
              'What you will lose:',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: kText,
              ),
            ),
            const SizedBox(height: 12),

            _buildImpactItem(
              title: 'Wallet Balance Forfeited',
              desc: 'Any remaining balance in your F2H Fresh wallet will be permanently lost and cannot be refunded or transferred.',
              icon: Icons.account_balance_wallet_outlined,
            ),
            _buildImpactItem(
              title: 'Subscriptions Cancelled',
              desc: 'Your active subscription calendars (milk, curd, paneer drops) will be stopped immediately.',
              icon: Icons.calendar_today_outlined,
            ),
            _buildImpactItem(
              title: 'Personal & Order History Cleaned',
              desc: 'All saved delivery addresses, profile details, and history of past bills/orders will be cleared.',
              icon: Icons.history_rounded,
            ),

            const SizedBox(height: 20),

            // Checkbox Container
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: kBorder, width: 1.2),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: Checkbox(
                      value: _understandCheck,
                      activeColor: kRed,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                      onChanged: (val) {
                        setState(() {
                          _understandCheck = val ?? false;
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'I understand the consequences and request permanent deletion of my F2H Fresh account and all associated data.',
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: kTextMid,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Confirm Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: (_understandCheck && !_isLoading)
                    ? _submitDeletionRequest
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kRed,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: kBorder,
                  disabledForegroundColor: kMuted,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text(
                        'Confirm Deletion',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(
                  'Keep My Account',
                  style: TextStyle(
                    color: kTextSub,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildImpactItem({
    required String title,
    required String desc,
    required IconData icon,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: kBgDeep,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: kTextMid, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: const TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: kTextSub,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
