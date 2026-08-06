import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

/// Displays the KYC verification pending or account suspended state.
///
/// This widget renders **body content only** — the parent screen is
/// responsible for providing a [Scaffold] and [AppBar].
class VerificationPendingView extends StatelessWidget {
  final bool isUnverified;
  final VoidCallback onRedirectToProfile;

  const VerificationPendingView({
    super.key,
    required this.isUnverified,
    required this.onRedirectToProfile,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: kBorderLt, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: kText.withValues(alpha: 0.04),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    )
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    GestureDetector(
                      onTap: () {
                        if (isUnverified) {
                          onRedirectToProfile();
                        }
                      },
                      behavior: HitTestBehavior.opaque,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: isUnverified 
                                  ? Colors.amber.shade50 
                                  : Colors.red.shade50,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isUnverified 
                                  ? Icons.gpp_maybe_rounded 
                                  : Icons.block_rounded,
                              color: isUnverified 
                                  ? Colors.amber.shade900 
                                  : Colors.red.shade900,
                              size: 56,
                            ),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            isUnverified 
                                ? 'KYC Verification Pending' 
                                : 'Account Inactive',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: kText,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            isUnverified
                                ? 'Your profile details and documents are under review. Access to delivery runs and features will remain disabled until administrator approval.'
                                : 'Your delivery partner account has been deactivated by the administrator. You are restricted from participating in delivery shifts.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 13.5,
                              color: kTextSub,
                              fontWeight: FontWeight.w500,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      height: 1.5,
                      color: kBorderLt,
                    ),
                    const SizedBox(height: 20),
                    InkWell(
                      onTap: () async {
                        final Uri emailLaunchUri = Uri(
                          scheme: 'mailto',
                          path: 'admin@f2hfresh.com',
                          queryParameters: {
                            'subject': 'F2H Support Request',
                          },
                        );
                        if (await canLaunchUrl(emailLaunchUri)) {
                          await launchUrl(emailLaunchUri);
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Could not launch email client.'),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.mail_outline_rounded, size: 16, color: kMuted),
                            SizedBox(width: 8),
                            Text(
                              'Contact Support',
                              style: TextStyle(
                                fontSize: 13,
                                color: kTextSub,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (isUnverified)
                ElevatedButton(
                  onPressed: onRedirectToProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Update Documents / Profile',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                  ),
                ),
            ],
          ),
        ),
    );
  }
}
