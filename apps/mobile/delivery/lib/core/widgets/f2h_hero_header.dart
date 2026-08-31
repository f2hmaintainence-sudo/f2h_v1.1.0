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

        // ── FOREGROUND: greeting, bell, avatar, online pill ──
        Padding(
          padding: EdgeInsets.fromLTRB(16, topInset + 12, 16, 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Bar
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${AppGreeting.get()}, $firstName!',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.roboto(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Text(
                              'Ready to deliver amazing today',
                              style: GoogleFonts.roboto(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF475569),
                              ),
                            ),
                            const SizedBox(width: 3),
                            const Text('📍', style: TextStyle(fontSize: 12)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildBellButton(onTap: onNotifications, unreadCount: unreadCount),
                      const SizedBox(width: 8),
                      _buildProfileButton(onTap: onProfile, driverName: driverName, avatarUrl: avatarUrl),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 14),

              _buildOnlineStatusPill(context),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBellButton({VoidCallback? onTap, int unreadCount = 0}) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x08000000),
                  blurRadius: 6,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.notifications_none_rounded,
              color: Color(0xFF0F172A),
              size: 20,
            ),
          ),
          if (unreadCount > 0)
            Positioned(
              right: -1,
              top: -1,
              child: Container(
                padding: const EdgeInsets.all(3.5),
                decoration: const BoxDecoration(
                  color: Color(0xFFEF4444),
                  shape: BoxShape.circle,
                ),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                child: Text(
                  unreadCount > 9 ? '9+' : '$unreadCount',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    height: 1,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildProfileButton({VoidCallback? onTap, required String driverName, String? avatarUrl}) {
    final initial = driverName.trim().isNotEmpty ? driverName.trim()[0].toUpperCase() : 'P';
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: const Color(0xFF16A34A),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 1.5),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 6,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: ClipOval(
          child: avatarUrl != null && avatarUrl.isNotEmpty
              ? Image.network(
                  avatarUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Center(
                    child: Text(
                      initial,
                      style: GoogleFonts.roboto(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                )
              : Center(
                  child: Text(
                    initial,
                    style: GoogleFonts.roboto(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildOnlineStatusPill(BuildContext context) {
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
              Icons.two_wheeler_rounded,
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
              isOnline ? 'Bike Started' : 'Start Bike',
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
