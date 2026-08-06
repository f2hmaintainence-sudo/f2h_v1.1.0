import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/models/document_model.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/verification_badge.dart';

class DocumentCard extends StatelessWidget {
  final DocumentModel document;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  const DocumentCard({
    super.key,
    required this.document,
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
    final typeLabel = document.documentType.toUpperCase().replaceAll('_', ' ');
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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        typeLabel,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: kPrimary,
                        ),
                      ),
                      if (document.documentNumber != null && document.documentNumber!.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          'No: ${document.documentNumber}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: kTextMid,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                VerificationBadge(
                  status: document.verificationStatus,
                  rejectionReason: document.rejectionReason,
                  showReason: false,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: kBorderLt),

          // Details & Dates
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
                if (document.issueDate != null || document.expiryDate != null) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (document.issueDate != null)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Issue Date', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(document.issueDate!.split('T')[0], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                          ],
                        ),
                      if (document.expiryDate != null)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('Expiry Date', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(document.expiryDate!.split('T')[0], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],

                // Warnings
                if (document.isExpired)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: kRedLt, borderRadius: BorderRadius.circular(8)),
                    child: const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: kRed, size: 14),
                        SizedBox(width: 6),
                        Text('Document has expired!', style: TextStyle(color: kRed, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  )
                else if (document.isExpiringSoon)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: kAccentLt, borderRadius: BorderRadius.circular(8)),
                    child: const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: kAccent, size: 14),
                        SizedBox(width: 6),
                        Text('Document is expiring soon!', style: TextStyle(color: kAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),

                // Thumbnails
                Row(
                  children: [
                    if (document.frontImage != null && document.frontImage!.isNotEmpty)
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _showImagePreview(context, document.frontImage!, '$typeLabel - Front'),
                          child: Container(
                            height: 80,
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              color: kBgDeep,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorder),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(
                                document.frontImage!,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => const Center(
                                  child: Icon(Icons.broken_image_rounded, color: kMuted),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    if (document.backImage != null && document.backImage!.isNotEmpty)
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _showImagePreview(context, document.backImage!, '$typeLabel - Back'),
                          child: Container(
                            height: 80,
                            margin: const EdgeInsets.only(left: 8),
                            decoration: BoxDecoration(
                              color: kBgDeep,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorder),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(
                                document.backImage!,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => const Center(
                                  child: Icon(Icons.broken_image_rounded, color: kMuted),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // Rejection reason banner inside card
          if (document.verificationStatus.toLowerCase() == 'rejected' && document.rejectionReason != null && document.rejectionReason!.isNotEmpty) ...[
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
                      'Rejection Reason: ${document.rejectionReason}',
                      style: const TextStyle(color: kRed, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Footer Action buttons
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
                    label: const Text('Replace', style: TextStyle(color: kPrimary, fontSize: 12, fontWeight: FontWeight.bold)),
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
