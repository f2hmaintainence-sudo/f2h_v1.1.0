import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/models/bank_account_model.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/verification_badge.dart';

class BankAccountCard extends StatelessWidget {
  final BankAccountModel account;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  const BankAccountCard({
    super.key,
    required this.account,
    this.onTap,
    this.onDelete,
  });

  void _showImagePreview(BuildContext context, String imageUrl, String title) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppBar(
              backgroundColor: Colors.black87,
              title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              leading: IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
              elevation: 0,
            ),
            Container(
              color: Colors.black,
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.7,
              ),
              child: Image.network(
                imageUrl,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return const Center(child: CircularProgressIndicator(color: kPrimaryLt));
                },
                errorBuilder: (context, error, stackTrace) => const Center(
                  child: Icon(Icons.broken_image_rounded, color: Colors.white, size: 60),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: kText.withValues(alpha: 0.01),
            blurRadius: 8,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: kBgDeep,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.account_balance_rounded,
                          color: kPrimary,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  account.bankName,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    color: kText,
                                  ),
                                ),
                                if (account.isPrimary) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: kPrimaryPl,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'PRIMARY',
                                      style: TextStyle(
                                        color: kPrimary,
                                        fontSize: 8,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              account.maskedAccountNumber,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: kTextMid,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                VerificationBadge(
                  status: account.verificationStatus,
                  showReason: false,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: kBorderLt),

          // Details & Cancelled Cheque
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Account Holder', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(account.accountHolderName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('IFSC Code', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 2),
                                Text(account.ifscCode, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                              ],
                            ),
                          ),
                          if (account.branchName != null && account.branchName!.isNotEmpty)
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Branch Name', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 2),
                                  Text(account.branchName!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                                ],
                              ),
                            ),
                        ],
                      ),
                      if (account.upiId != null && account.upiId!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        const Text('UPI ID', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        Text(account.upiId!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                      ],
                    ],
                  ),
                ),
                if (account.cancelledChequeImage != null && account.cancelledChequeImage!.isNotEmpty) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Cheque / Passbook', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        GestureDetector(
                          onTap: () => _showImagePreview(context, account.cancelledChequeImage!, 'Cancelled Cheque'),
                          child: Container(
                            height: 70,
                            decoration: BoxDecoration(
                              color: kBgDeep,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorder),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(
                                account.cancelledChequeImage!,
                                fit: BoxFit.cover,
                                width: double.infinity,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Rejection reason banner inside card
          if (account.verificationStatus.toLowerCase() == 'rejected' && account.rejectionReason != null && account.rejectionReason!.isNotEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: kRedLt,
              child: Row(
                children: [
                  const Icon(Icons.report_gmailerrorred_rounded, color: kRed, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Rejection Reason: ${account.rejectionReason}',
                      style: const TextStyle(color: kRed, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Action buttons
          const Divider(height: 1, color: kBorderLt),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (onDelete != null)
                  TextButton.icon(
                    icon: const Icon(Icons.delete_outline_rounded, color: kRed, size: 16),
                    label: const Text('Remove', style: TextStyle(color: kRed, fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: onDelete,
                  ),
                if (onTap != null) ...[
                  const SizedBox(width: 8),
                  TextButton.icon(
                    icon: const Icon(Icons.edit_outlined, color: kPrimary, size: 16),
                    label: const Text('Update', style: TextStyle(color: kPrimary, fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: onTap,
                  ),
                ]
              ],
            ),
          ),
        ],
      ),
    );
  }
}
