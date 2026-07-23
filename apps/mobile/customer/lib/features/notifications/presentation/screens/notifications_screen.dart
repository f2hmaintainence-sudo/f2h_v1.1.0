import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/notifications/data/models/notification_model.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_bloc.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_event.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_state.dart';
import 'package:f2h_customer/core/widgets/scrolling_items_loader.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  int _activeTab = 0; // 0: All, 1: Orders, 2: Offers
  bool _pushNotifEnabled = true;
  bool _smsAlertsEnabled = true;
  bool _whatsappUpdatesEnabled = false;

  @override
  void initState() {
    super.initState();
    // Load notifications when screen opens
    context.read<NotificationsBloc>().add(LoadNotifications());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(80),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Back Button
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.arrow_back,
                      color: kPrimary,
                      size: 20,
                    ),
                  ),
                ),
                // Title
                const Text(
                  'Notifications',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: kText,
                  ),
                ),
                // Settings Button (Commented out for now)
                // GestureDetector(
                //   onTap: () => _showNotificationPrefs(context),
                //   child: Container(
                //     width: 44,
                //     height: 44,
                //     decoration: BoxDecoration(
                //       color: Colors.white,
                //       borderRadius: BorderRadius.circular(12),
                //       boxShadow: [
                //         BoxShadow(
                //           color: Colors.black.withOpacity(0.04),
                //           blurRadius: 6,
                //           offset: const Offset(0, 2),
                //         ),
                //       ],
                //     ),
                //     child: const Icon(
                //       Icons.settings_outlined,
                //       color: kPrimary,
                //       size: 20,
                //     ),
                //   ),
                // ),
                const SizedBox(width: 44),
              ],
            ),
          ),
        ),
      ),
      body: BlocBuilder<NotificationsBloc, NotificationsState>(
        builder: (context, state) {
          if (state is NotificationsLoading || state is NotificationsInitial) {
            return const Center(
              child: ScrollingItemsLoader(),
            );
          }

          if (state is NotificationsError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: kRed),
                    const SizedBox(height: 12),
                    Text(
                      state.message,
                      style: const TextStyle(fontSize: 14, color: kTextMid),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is NotificationsLoaded) {
            // Filter list based on selected tab
            final filteredNotifications = state.allNotifications.where((n) {
              if (_activeTab == 1) {
                // Orders: type is success or contains order/delivery related keywords
                return n.type == 'success' ||
                    n.title.toLowerCase().contains('order') ||
                    n.message.toLowerCase().contains('order') ||
                    n.title.toLowerCase().contains('delivery') ||
                    n.message.toLowerCase().contains('delivery');
              }
              if (_activeTab == 2) {
                // Offers: contains offer/discount/cashback/coupon/promo keywords
                return n.title.toLowerCase().contains('offer') ||
                    n.message.toLowerCase().contains('offer') ||
                    n.title.toLowerCase().contains('discount') ||
                    n.message.toLowerCase().contains('discount') ||
                    n.title.toLowerCase().contains('cashback') ||
                    n.message.toLowerCase().contains('cashback') ||
                    n.title.toLowerCase().contains('coupon') ||
                    n.message.toLowerCase().contains('coupon') ||
                    n.title.toLowerCase().contains('promo') ||
                    n.message.toLowerCase().contains('promo');
              }
              return true;
            }).toList();

            // Group filtered notifications
            final groups = <String, List<NotificationItem>>{};
            for (var n in filteredNotifications) {
              final groupName = _getGroup(n.createdAt ?? DateTime.now());
              groups.putIfAbsent(groupName, () => []).add(n);
            }

            // Keep strict ordering
            final orderedGroups = [
              'Today',
              'Yesterday',
              'Earlier',
            ].where((g) => groups.containsKey(g)).toList();

            return Column(
              children: [
                // Tabs
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(30),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Expanded(child: _buildTab(0, 'All', hasDot: state.unreadCount > 0)),
                        Expanded(child: _buildTab(1, 'Orders')),
                        Expanded(child: _buildTab(2, 'Offers')),
                      ],
                    ),
                  ),
                ),
                // Notifications List
                Expanded(
                  child: filteredNotifications.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.notifications_off_outlined,
                                size: 48,
                                color: kTextSub,
                              ),
                              SizedBox(height: 12),
                              Text(
                                'No notifications found',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: kTextMid,
                                ),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          color: kPrimary,
                          onRefresh: () async {
                            context.read<NotificationsBloc>().add(LoadNotifications());
                            await context.read<NotificationsBloc>().stream.firstWhere(
                                  (s) => s is NotificationsLoaded || s is NotificationsError,
                                );
                          },
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                            itemCount: orderedGroups.length,
                            itemBuilder: (context, gIdx) {
                              final groupName = orderedGroups[gIdx];
                              final items = groups[groupName]!;
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Group Header
                                  Padding(
                                    padding: const EdgeInsets.only(top: 14, bottom: 8),
                                    child: Text(
                                      groupName,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                        color: kTextMid,
                                      ),
                                    ),
                                  ),
                                  // List of Items
                                  ...items.map((item) => _buildNotificationCard(item)),
                                ],
                              );
                            },
                          ),
                        ),
                ),
                // Clear all button (only if there are notifications)
                if (filteredNotifications.isNotEmpty)
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: GestureDetector(
                        onTap: () {
                          context.read<NotificationsBloc>().add(DismissAllNotifications());
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('All notifications cleared.'),
                            ),
                          );
                        },
                        child: Container(
                          height: 52,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(26),
                            border: Border.all(color: kBorderLt),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.delete_sweep_rounded,
                                color: kRed,
                                size: 20,
                              ),
                              SizedBox(width: 8),
                              Text(
                                'Clear all',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: kRed,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildTab(int index, String label, {bool hasDot = false}) {
    final isActive = _activeTab == index;
    return GestureDetector(
      onTap: () {
        setState(() {
          _activeTab = index;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 38,
        decoration: BoxDecoration(
          color: isActive ? kPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isActive ? Colors.white : kTextMid,
              ),
            ),
            if (hasDot && isActive) ...[
              const SizedBox(width: 4),
              Container(
                width: 5,
                height: 5,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationCard(NotificationItem item) {
    return Dismissible(
      key: Key('notif_${item.id}'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: kRedLt,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Icon(Icons.delete_outline_rounded, color: kRed),
      ),
      onDismissed: (direction) {
        context.read<NotificationsBloc>().add(DismissNotification(item.id));
      },
      child: GestureDetector(
        onTap: () {
          if (item.isUnread) {
            context.read<NotificationsBloc>().add(MarkAsRead(item.id));
          }
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: item.isUnread ? kBorder : kBorderLt),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: _iconBgColor(item.type),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _icon(item.type),
                  color: _iconColor(item.type),
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              
              // Text Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title + Time
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  item.title,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: item.isUnread ? FontWeight.w800 : FontWeight.w600,
                                    color: kText,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (item.isUnread) ...[
                                const SizedBox(width: 6),
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                    color: kPrimary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Row(
                          children: [
                            Text(
                              _timeAgo(item.createdAt ?? DateTime.now()),
                              style: TextStyle(
                                fontSize: 11,
                                color: item.isUnread ? kPrimary : kTextSub,
                                fontWeight: item.isUnread
                                    ? FontWeight.w800
                                    : FontWeight.normal,
                              ),
                            ),
                            if (item.isUnread) ...[
                              const SizedBox(width: 4),
                              Container(
                                width: 5,
                                height: 5,
                                decoration: const BoxDecoration(
                                  color: kPrimary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Description
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                          fontSize: 12,
                          color: kTextMid,
                          height: 1.4,
                        ),
                        children: [
                          TextSpan(text: item.message),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _icon(String type) {
    switch (type) {
      case 'success':
        return Icons.check_circle_outline_rounded;
      case 'warning':
        return Icons.warning_amber_rounded;
      case 'error':
        return Icons.error_outline_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  Color _iconColor(String type) {
    switch (type) {
      case 'success':
        return kPrimary;
      case 'warning':
        return const Color(0xFFE67E22);
      case 'error':
        return kRed;
      default:
        return const Color(0xFF3498DB);
    }
  }

  Color _iconBgColor(String type) {
    switch (type) {
      case 'success':
        return kPrimaryPl;
      case 'warning':
        return const Color(0xFFFFF3E0);
      case 'error':
        return kRedLt;
      default:
        return const Color(0xFFEBF5FB);
    }
  }

  String _timeAgo(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    return '${(diff.inDays / 30).floor()}mo ago';
  }

  String _getGroup(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final checkDate = DateTime(date.year, date.month, date.day);

    if (checkDate.isAtSameMomentAs(today)) {
      return 'Today';
    } else if (checkDate.isAtSameMomentAs(yesterday)) {
      return 'Yesterday';
    } else {
      return 'Earlier';
    }
  }

  void _showNotificationPrefs(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 48,
                      height: 5,
                      margin: const EdgeInsets.only(bottom: 24),
                      decoration: BoxDecoration(
                        color: kMuted.withOpacity(0.4),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: kPrimaryPl,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.notifications_active_rounded,
                          color: kPrimary,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Notification Preferences',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: kText,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _buildSwitchTile(
                    title: 'Push Notifications',
                    subtitle:
                        'Daily morning delivery updates & tracking status.',
                    value: _pushNotifEnabled,
                    onChanged: (val) {
                      setModalState(() {
                        _pushNotifEnabled = val;
                      });
                      setState(() {});
                    },
                  ),
                  const Divider(color: kBorderLt, height: 1),
                  _buildSwitchTile(
                    title: 'SMS Alerts',
                    subtitle: 'Critical payment & wallet low balance alerts.',
                    value: _smsAlertsEnabled,
                    onChanged: (val) {
                      setModalState(() {
                        _smsAlertsEnabled = val;
                      });
                      setState(() {});
                    },
                  ),
                  const Divider(color: kBorderLt, height: 1),
                  _buildSwitchTile(
                    title: 'WhatsApp Updates',
                    subtitle:
                        'Receive invoices and delivery confirmations on WhatsApp.',
                    value: _whatsappUpdatesEnabled,
                    onChanged: (val) {
                      setModalState(() {
                        _whatsappUpdatesEnabled = val;
                      });
                      setState(() {});
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: kText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    color: kTextSub,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => onChanged(!value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 44,
              height: 24,
              decoration: BoxDecoration(
                color: value ? kPrimary : kMuted.withOpacity(0.3),
                borderRadius: BorderRadius.circular(4),
              ),
              padding: const EdgeInsets.all(2),
              alignment: value ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 2,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
