import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/profile/data/models/vehicle_model.dart';
import 'package:f2h_delivery/features/profile/presentation/widgets/verification_badge.dart';

class VehicleCard extends StatelessWidget {
  final VehicleModel vehicle;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  const VehicleCard({
    super.key,
    required this.vehicle,
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
    final typeLabel = vehicle.vehicleType.toUpperCase().replaceAll('_', ' ');
    final modelText = '${vehicle.brand ?? ""} ${vehicle.model ?? ""}'.trim();
    final colorText = vehicle.color ?? '';

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
                        child: Icon(
                          vehicle.vehicleType.toLowerCase().contains('cycle')
                              ? Icons.directions_bike_rounded
                              : Icons.motorcycle_rounded,
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
                                  vehicle.registrationNumber,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    color: kText,
                                  ),
                                ),
                                if (vehicle.isPrimary) ...[
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
                              typeLabel,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: kTextSub,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                VerificationBadge(
                  status: vehicle.verificationStatus,
                  showReason: false,
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: kBorderLt),

          // Details & Images
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (modelText.isNotEmpty || colorText.isNotEmpty) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (modelText.isNotEmpty)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Brand & Model', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(modelText, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                          ],
                        ),
                      if (colorText.isNotEmpty)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('Color', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(colorText, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],

                // RC details
                if (vehicle.rcNumber != null && vehicle.rcNumber!.isNotEmpty) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('RC Number', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(vehicle.rcNumber!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                        ],
                      ),
                      if (vehicle.insuranceNumber != null && vehicle.insuranceNumber!.isNotEmpty)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('Insurance No', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(vehicle.insuranceNumber!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],

                // Insurance Date
                if (vehicle.insuranceExpiry != null && vehicle.insuranceExpiry!.isNotEmpty) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Insurance Expiry', style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(vehicle.insuranceExpiry!.split('T')[0], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],

                // Expiry warnings
                if (vehicle.isInsuranceExpired)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: kRedLt, borderRadius: BorderRadius.circular(8)),
                    child: const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: kRed, size: 14),
                        SizedBox(width: 6),
                        Text('Vehicle Insurance has expired!', style: TextStyle(color: kRed, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  )
                else if (vehicle.isInsuranceExpiringSoon)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: kAccentLt, borderRadius: BorderRadius.circular(8)),
                    child: const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: kAccent, size: 14),
                        SizedBox(width: 6),
                        Text('Insurance is expiring soon!', style: TextStyle(color: kAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),

                // Thumbnails
                Row(
                  children: [
                    if (vehicle.rcFrontImage != null && vehicle.rcFrontImage!.isNotEmpty)
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _showImagePreview(context, vehicle.rcFrontImage!, 'RC Front'),
                          child: Container(
                            height: 80,
                            margin: const EdgeInsets.only(right: 6),
                            decoration: BoxDecoration(
                              color: kBgDeep,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorder),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(vehicle.rcFrontImage!, fit: BoxFit.cover),
                            ),
                          ),
                        ),
                      ),
                    if (vehicle.rcBackImage != null && vehicle.rcBackImage!.isNotEmpty)
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _showImagePreview(context, vehicle.rcBackImage!, 'RC Back'),
                          child: Container(
                            height: 80,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: BoxDecoration(
                              color: kBgDeep,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorder),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(vehicle.rcBackImage!, fit: BoxFit.cover),
                            ),
                          ),
                        ),
                      ),
                    if (vehicle.insuranceImage != null && vehicle.insuranceImage!.isNotEmpty)
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _showImagePreview(context, vehicle.insuranceImage!, 'Insurance Policy'),
                          child: Container(
                            height: 80,
                            margin: const EdgeInsets.only(left: 6),
                            decoration: BoxDecoration(
                              color: kBgDeep,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorder),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(vehicle.insuranceImage!, fit: BoxFit.cover),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),

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
