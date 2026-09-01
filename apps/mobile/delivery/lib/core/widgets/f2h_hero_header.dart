import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/utils/date_formatter.dart';

class F2hHeroHeader extends StatelessWidget {
  final String driverName;
  final bool isOnline;
  final ValueChanged<bool> onToggleOnline;
  final VoidCallback? onNotifications;
  final VoidCallback? onProfile;
  final String? avatarUrl;
  final int unreadCount;
  final String? address;
  final String? addressLabel;
  final String? vehicleType;

  const F2hHeroHeader({
    super.key,
    required this.driverName,
    required this.isOnline,
    required this.onToggleOnline,
    this.onNotifications,
    this.onProfile,
    this.avatarUrl,
    this.unreadCount = 0,
    this.address,
    this.addressLabel,
    this.vehicleType,
  });

  @override
  Widget build(BuildContext context) {
    final firstName = driverName.trim().split(' ').first;
    final topInset = MediaQuery.of(context).padding.top;

    return Stack(
      children: [
        // ── FULL BACKGROUND: delivery illustration covers entire header ──
        Positioned.fill(
          child: Image.asset(
            'assets/home_bg.png',
            fit: BoxFit.fitWidth,
            alignment: Alignment.topCenter,
            errorBuilder: (_, __, ___) => Container(color: const Color(0xFFE8F5E9)),
          ),
        ),

        // Gradient overlay for smooth readability
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Color(0xEEF8FAFC),
                  Color(0x80F8FAFC),
                  Colors.transparent,
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, 0.45, 1.0],
              ),
            ),
          ),
        ),

        // ── FOREGROUND: greeting, bell, avatar, online pill ──
        Padding(
          padding: EdgeInsets.fromLTRB(16, topInset + 8, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // TOP BAR: greeting on left, actions on right
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        RichText(
                          text: TextSpan(
                            children: [
                              TextSpan(
                                text: '${AppGreeting.get()}, $firstName!',
                                style: GoogleFonts.roboto(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              'Ready to deliver amazing today',
                              style: GoogleFonts.roboto(
                                fontSize: 11,
                                color: const Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Text('📍', style: TextStyle(fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Right: Bell + Avatar
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (onNotifications != null)
                        _buildActionButton(
                          icon: Icons.notifications_none_rounded,
                          badgeCount: unreadCount,
                          onTap: onNotifications!,
                        ),
                      if (onNotifications != null && onProfile != null)
                        const SizedBox(width: 8),
                      if (onProfile != null)
                        _buildAvatar(firstName),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // ONLINE STATUS PILL
              _buildOnlineStatusPill(context),

              // RUNNING ADDRESS BAR (Floating translucent pill above background)
              if (address != null && address!.isNotEmpty) ...[
                const SizedBox(height: 10),
                _buildAddressBanner(context),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required int badgeCount,
    required VoidCallback onTap,
  }) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          color: Colors.white,
          shape: const CircleBorder(),
          elevation: 2,
          shadowColor: const Color(0x18000000),
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              child: Icon(icon, size: 20, color: const Color(0xFF334155)),
            ),
          ),
        ),
        if (badgeCount > 0)
          Positioned(
            top: -2,
            right: -2,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              child: Text(
                badgeCount > 9 ? '9+' : '$badgeCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildAvatar(String firstName) {
    final initial = firstName.isNotEmpty ? firstName[0].toUpperCase() : 'D';
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      elevation: 2,
      shadowColor: const Color(0x18000000),
      child: InkWell(
        onTap: onProfile,
        customBorder: const CircleBorder(),
        child: CircleAvatar(
          radius: 19,
          backgroundColor: const Color(0xFF059669),
          backgroundImage: avatarUrl != null && avatarUrl!.isNotEmpty
              ? NetworkImage(avatarUrl!)
              : null,
          child: avatarUrl == null || avatarUrl!.isEmpty
              ? Text(
                  initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                  ),
                )
              : null,
        ),
      ),
    );
  }

  Widget _buildAddressBanner(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.90),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.location_on, size: 14, color: Color(0xFF059669)),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (addressLabel != null && addressLabel!.isNotEmpty)
                  Text(
                    addressLabel!.toUpperCase(),
                    style: GoogleFonts.roboto(
                      fontSize: 8.5,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF059669),
                      letterSpacing: 0.5,
                    ),
                  ),
                Text(
                  address!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.roboto(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF1E293B),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _getVehicleIcon(String? type) {
    final t = (type ?? '').toLowerCase().trim();
    if (t.contains('scoot') || t.contains('moped') || t == 'scooty') {
      return Icons.moped_rounded;
    } else if (t.contains('electric') || t.contains('ev')) {
      return Icons.electric_moped_rounded;
    } else if (t.contains('cycle') || t.contains('bicycle')) {
      return Icons.directions_bike_rounded;
    } else if (t.contains('car') || t.contains('van') || t.contains('auto')) {
      return Icons.directions_car_rounded;
    }
    return Icons.two_wheeler_rounded;
  }

  Widget _buildOnlineStatusPill(BuildContext context) {
    final vehicleIcon = _getVehicleIcon(vehicleType);

    return GestureDetector(
      onTap: () => onToggleOnline(!isOnline),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isOnline ? const Color(0xFF86EFAC) : const Color(0xFFCBD5E1),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: isOnline ? const Color(0x1A16A34A) : const Color(0x06000000),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              vehicleIcon,
              size: 16,
              color: isOnline ? const Color(0xFF15803D) : const Color(0xFF64748B),
            ),
            const SizedBox(width: 5),
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: isOnline ? const Color(0xFF16A34A) : const Color(0xFF94A3B8),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              isOnline ? 'Engine Started' : 'Start Engine',
              style: GoogleFonts.roboto(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isOnline ? const Color(0xFF15803D) : const Color(0xFF475569),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
