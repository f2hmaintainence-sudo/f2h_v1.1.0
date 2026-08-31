import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_customer/features/catalog/data/models/today_delivery_partner_model.dart';

class TodayDeliveryPartnerCard extends StatelessWidget {
  final TodayDeliveryPartner partner;
  final EdgeInsetsGeometry? margin;

  const TodayDeliveryPartnerCard({
    required this.partner,
    this.margin,
    super.key,
  });

  Future<void> _callPartner(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^\d+]'), '');
    if (cleanPhone.isEmpty) return;
    final uri = Uri.parse('tel:$cleanPhone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _formatPhone(String phone) {
    final clean = phone.trim();
    if (clean.length == 10) {
      return '+91 ${clean.substring(0, 5)} ${clean.substring(5)}';
    }
    return clean;
  }

  @override
  Widget build(BuildContext context) {
    final isEvening = partner.deliverySlot.toLowerCase() == 'evening';
    final slotColor = isEvening ? const Color(0xFF6366F1) : const Color(0xFFD97706);
    final slotBg = isEvening ? const Color(0xFFEEF2FF) : const Color(0xFFFFFBEB);
    final slotBorder = isEvening
        ? const Color(0xFF818CF8).withValues(alpha: 0.3)
        : const Color(0xFFFBBF24).withValues(alpha: 0.3);
    final slotIcon = isEvening ? Icons.nightlight_round_rounded : Icons.wb_sunny_rounded;

    // Status styling
    String statusText = 'Assigned for Today';
    Color statusColor = const Color(0xFF0284C7);
    Color statusBg = const Color(0xFFE0F2FE);

    final s = partner.deliveryStatus.toLowerCase();
    if (s == 'in_transit' || s == 'out_for_delivery') {
      statusText = 'Out for Delivery';
      statusColor = const Color(0xFF16A34A);
      statusBg = const Color(0xFFDCFCE7);
    } else if (s == 'arrived') {
      statusText = 'Arrived Nearby';
      statusColor = const Color(0xFFD97706);
      statusBg = const Color(0xFFFEF3C7);
    } else if (s == 'delivered') {
      statusText = 'Delivered Today';
      statusColor = const Color(0xFF15803D);
      statusBg = const Color(0xFFDCFCE7);
    }

    final hasPhone = partner.phone.trim().isNotEmpty;
    final addressText = partner.addresses.isNotEmpty
        ? (partner.addresses.first.area.isNotEmpty
            ? partner.addresses.first.area
            : partner.addresses.first.addressLine)
        : null;

    return Container(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF16A34A).withValues(alpha: 0.22),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16A34A).withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header: Slot Badge & Status Pill
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFF0FDF4), Color(0xFFECFDF5)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border(
                  bottom: BorderSide(
                    color: Color(0xFFE2E8F0),
                    width: 0.8,
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Slot Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                    decoration: BoxDecoration(
                      color: slotBg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: slotBorder, width: 1),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(slotIcon, size: 12, color: slotColor),
                        const SizedBox(width: 4),
                        Text(
                          partner.slotLabel,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: slotColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  // Delivery Status Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                    decoration: BoxDecoration(
                      color: statusBg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: statusColor.withValues(alpha: 0.3),
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: statusColor,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          statusText,
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: statusColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Body: Partner Profile, Phone & Call Button
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Partner Avatar / Icon
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF15803D), Color(0xFF16A34A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Center(
                      child: partner.profilePhoto != null && partner.profilePhoto!.isNotEmpty
                          ? ClipOval(
                              child: Image.network(
                                partner.profilePhoto!,
                                width: 44,
                                height: 44,
                                fit: BoxFit.cover,
                                errorBuilder: (ctx, err, stack) => const Icon(
                                  Icons.two_wheeler_rounded,
                                  color: Colors.white,
                                  size: 22,
                                ),
                              ),
                            )
                          : const Icon(
                              Icons.two_wheeler_rounded,
                              color: Colors.white,
                              size: 22,
                            ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Partner Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          partner.partnerName,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: kText,
                            letterSpacing: -0.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        if (hasPhone)
                          Row(
                            children: [
                              const Icon(
                                Icons.phone_android_rounded,
                                size: 12,
                                color: Color(0xFF16653A),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                _formatPhone(partner.phone),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF16653A),
                                ),
                              ),
                            ],
                          )
                        else
                          const Text(
                            'Delivery Partner Assigned',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: kTextSub,
                            ),
                          ),
                        if (addressText != null && addressText.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(
                                Icons.place_outlined,
                                size: 11,
                                color: kTextSub,
                              ),
                              const SizedBox(width: 2),
                              Expanded(
                                child: Text(
                                  addressText,
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w500,
                                    color: kTextSub,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Call Action Button
                  if (hasPhone) ...[
                    const SizedBox(width: 8),
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _callPartner(partner.phone),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF15803D), Color(0xFF16A34A)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.phone_rounded,
                                size: 14,
                                color: Colors.white,
                              ),
                              SizedBox(width: 5),
                              Text(
                                'Call',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TodayDeliveryPartnersSection extends StatelessWidget {
  final List<TodayDeliveryPartner> partners;

  const TodayDeliveryPartnersSection({
    required this.partners,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    if (partners.isEmpty) return const SizedBox.shrink();

    if (partners.length == 1) {
      return TodayDeliveryPartnerCard(partner: partners.first);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: partners
          .map((partner) => TodayDeliveryPartnerCard(partner: partner))
          .toList(),
    );
  }
}
