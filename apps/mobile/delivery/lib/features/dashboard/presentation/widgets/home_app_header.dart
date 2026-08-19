import 'package:flutter/material.dart';
import 'package:f2h_delivery/core/utils/date_formatter.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/notifications_screen.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';

import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/delivery_basket_modal.dart';

class HomeAppHeader extends StatelessWidget {
  final String driverName;
  final bool isOnline;
  final ValueChanged<bool> onToggleOnline;
  final List<DeliveryOrderModel>? orders;

  const HomeAppHeader({
    super.key,
    required this.driverName,
    required this.isOnline,
    required this.onToggleOnline,
    this.orders,
  });

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    // Ensure top 10% spacing from top border / status bar
    final double topMargin = topPadding > 0 ? topPadding + 14 : 16.0;
    // Dynamic height calculation so home_bg.png and rider illustration are fully visible without clipping
    final double headerHeight = topMargin + 176;

    return SizedBox(
      width: double.infinity,
      height: headerHeight,
      child: Stack(
        children: [
          // 1. Full Background Image (home_bg.png) cleanly rendered without clipping wheels or artwork
          Positioned.fill(
            child: Image.asset(
              'assets/home_bg.png',
              fit: BoxFit.cover,
              alignment: Alignment.topRight,
              filterQuality: FilterQuality.high,
            ),
          ),

          // 2. Soft light fade gradient at bottom edge of image mixing seamlessly with page background (kBg)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 32,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFFF8FAFC).withValues(alpha: 0.0),
                    const Color(0xFFF8FAFC).withValues(alpha: 0.65),
                    const Color(0xFFF8FAFC),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),

          // 2. Left-Aligned Greetings & Online/Offline Toggle Switch
          Positioned(
            left: 16,
            top: topMargin,
            right: 140, // Protects text from touching rider graphic on right
            bottom: 6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  "${AppGreeting.get()}, ${driverName.split(' ').first}! 👋",
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                const Text(
                  "Ready to deliver amazing today",
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF475569),
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 10),

                // Interactive Online/Offline Toggle Switch Button
                GestureDetector(
                  onTap: () => onToggleOnline(!isOnline),
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeInOut,
                    width: 124,
                    height: 34,
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                    decoration: BoxDecoration(
                      color: isOnline
                          ? const Color(0xFFDCFCE7)
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isOnline
                            ? const Color(0xFF86EFAC)
                            : const Color(0xFFCBD5E1),
                        width: 1.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        // Sliding Toggle Thumb Knob
                        AnimatedAlign(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeInOut,
                          alignment: isOnline
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: isOnline
                                  ? const Color(0xFF16A34A)
                                  : const Color(0xFF94A3B8),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: (isOnline
                                          ? const Color(0xFF16A34A)
                                          : const Color(0xFF94A3B8))
                                      .withValues(alpha: 0.35),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Icon(
                              isOnline ? Icons.check_rounded : Icons.power_settings_new_rounded,
                              size: 14,
                              color: Colors.white,
                            ),
                          ),
                        ),

                        // Toggle Status Text (ONLINE / OFFLINE)
                        Align(
                          alignment: isOnline
                              ? Alignment.centerLeft
                              : Alignment.centerRight,
                          child: Padding(
                            padding: EdgeInsets.only(
                              left: isOnline ? 12 : 0,
                              right: isOnline ? 0 : 12,
                            ),
                            child: Text(
                              isOnline ? "ONLINE" : "OFFLINE",
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.4,
                                color: isOnline
                                    ? const Color(0xFF15803D)
                                    : const Color(0xFF64748B),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 3. Basket Icon & Notification Bell Row
          Positioned(
            right: 14,
            top: topMargin,
            child: Row(
              children: [
                if (orders != null && orders!.isNotEmpty) ...[
                  GestureDetector(
                    onTap: () => DeliveryBasketModal.show(context, orders!),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.95),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.10),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.shopping_bag_rounded,
                        color: Color(0xFF16A34A),
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                ValueListenableBuilder<int>(
                  valueListenable: MockDataService().unreadNotificationCountNotifier,
                  builder: (context, unreadCount, _) {
                    return GestureDetector(
                      onTap: () {
                        MockDataService().unreadNotificationCountNotifier.value = 0;
                        Navigator.push(
                          context,
                          PageRouteBuilder(
                            pageBuilder: (_, _, _) => const NotificationsScreen(),
                            transitionsBuilder: (_, animation, _, child) => FadeTransition(
                              opacity: animation,
                              child: child,
                            ),
                            transitionDuration: const Duration(milliseconds: 180),
                          ),
                        );
                      },
                      behavior: HitTestBehavior.opaque,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.95),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.10),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
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
                              right: 1,
                              top: 1,
                              child: Container(
                                padding: const EdgeInsets.all(3.5),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFEF4444),
                                  shape: BoxShape.circle,
                                ),
                                constraints: const BoxConstraints(
                                  minWidth: 16,
                                  minHeight: 16,
                                ),
                                child: Text(
                                  unreadCount > 9 ? '9+' : '$unreadCount',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    height: 1,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
          ],
        ),
      ),
        ],
      ),
    );
  }
}
