import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';
import 'package:f2h_delivery/features/notifications/data/models/notification_model.dart';
import 'package:f2h_delivery/features/notifications/services/notification_api_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final NotificationApiService _apiService = NotificationApiService();
  bool _isLoading = true;
  List<DeliveryNotification> _notifications = [];
  String _selectedFilter = 'All';

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);
    final result = await _apiService.getNotificationsWithCount();
    if (mounted) {
      setState(() {
        _notifications = result['notifications'] as List<DeliveryNotification>;
        _isLoading = false;
      });
    }
  }

  Future<void> _markAllAsRead() async {
    await _apiService.markAllAsRead();
    if (mounted) {
      setState(() {
        _notifications = _notifications.map((n) => n.copyWith(isRead: true)).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All notifications marked as read'),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 1),
        ),
      );
    }
  }

  Future<void> _clearAll() async {
    await _apiService.dismissAll();
    if (mounted) {
      setState(() {
        _notifications.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All notifications cleared'),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 1),
        ),
      );
    }
  }

  void _onNotificationTap(DeliveryNotification n) {
    if (!n.isRead) {
      _apiService.markAsRead(n.id);
      setState(() {
        final idx = _notifications.indexWhere((item) => item.id == n.id);
        if (idx != -1) {
          _notifications[idx] = n.copyWith(isRead: true);
        }
      });
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _buildIconContainer(n.type, size: 44),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        n.title,
                        style: GoogleFonts.roboto(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _timeAgo(n.createdAt),
                        style: GoogleFonts.roboto(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),
            Text(
              n.message,
              style: GoogleFonts.roboto(
                fontSize: 13.5,
                color: const Color(0xFF334155),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(sheetCtx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Text(
                  'Dismiss',
                  style: GoogleFonts.roboto(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays}d ago';
  }

  Widget _buildIconContainer(String type, {double size = 40}) {
    Color bg;
    Color fg;
    IconData icon;

    switch (type.toLowerCase()) {
      case 'order':
      case 'delivery':
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF16A34A);
        icon = Icons.local_shipping_outlined;
        break;
      case 'alert':
      case 'warning':
      case 'sos':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFEF4444);
        icon = Icons.warning_amber_rounded;
        break;
      case 'reminder':
      case 'pickup':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFD97706);
        icon = Icons.inventory_2_outlined;
        break;
      case 'wallet':
      case 'earnings':
        bg = const Color(0xFFF3E8FF);
        fg = const Color(0xFF9333EA);
        icon = Icons.account_balance_wallet_outlined;
        break;
      default:
        bg = const Color(0xFFDBEAFE);
        fg = const Color(0xFF2563EB);
        icon = Icons.notifications_none_rounded;
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: fg, size: size * 0.5),
    );
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n.isRead).length;

    List<DeliveryNotification> filtered = _notifications;
    if (_selectedFilter == 'Unread') {
      filtered = _notifications.where((n) => !n.isRead).toList();
    } else if (_selectedFilter == 'Orders') {
      filtered = _notifications.where((n) => n.type == 'order' || n.type == 'delivery' || n.type == 'pickup').toList();
    } else if (_selectedFilter == 'System') {
      filtered = _notifications.where((n) => n.type == 'system' || n.type == 'alert').toList();
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: F2hAppBar(
        title: 'Notifications',
        subtitle: unreadCount > 0 ? '$unreadCount unread updates' : 'All caught up',
        actions: [
          if (_notifications.isNotEmpty)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF0F172A)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              onSelected: (val) {
                if (val == 'mark_all') {
                  _markAllAsRead();
                } else if (val == 'clear_all') {
                  _clearAll();
                }
              },
              itemBuilder: (ctx) => [
                const PopupMenuItem(
                  value: 'mark_all',
                  child: Row(
                    children: [
                      Icon(Icons.done_all_rounded, size: 18, color: Color(0xFF16A34A)),
                      SizedBox(width: 8),
                      Text('Mark all as read'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'clear_all',
                  child: Row(
                    children: [
                      Icon(Icons.delete_sweep_outlined, size: 18, color: Color(0xFFEF4444)),
                      SizedBox(width: 8),
                      Text('Clear all'),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : RefreshIndicator(
              onRefresh: _loadNotifications,
              color: kPrimary,
              child: Column(
                children: [
                  // Filter Chips Row
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildFilterChip('All', _notifications.length),
                          const SizedBox(width: 8),
                          _buildFilterChip('Unread', unreadCount),
                          const SizedBox(width: 8),
                          _buildFilterChip('Orders', _notifications.where((n) => n.type == 'order' || n.type == 'delivery').length),
                          const SizedBox(width: 8),
                          _buildFilterChip('System', _notifications.where((n) => n.type == 'system' || n.type == 'alert').length),
                        ],
                      ),
                    ),
                  ),

                  // Notifications List View
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    width: 72,
                                    height: 72,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFF1F5F9),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.notifications_none_rounded,
                                      size: 36,
                                      color: Color(0xFF94A3B8),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    _selectedFilter == 'Unread' ? 'No Unread Notifications' : 'No Notifications Yet',
                                    style: GoogleFonts.roboto(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    _selectedFilter == 'Unread'
                                        ? 'You have caught up with all shift and route alerts.'
                                        : 'Important delivery and shift updates will appear here.',
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.roboto(
                                      fontSize: 12.5,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final n = filtered[index];
                              return Dismissible(
                                key: Key(n.id),
                                direction: DismissDirection.endToStart,
                                background: Container(
                                  alignment: Alignment.centerRight,
                                  padding: const EdgeInsets.only(right: 20),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEF4444),
                                    borderRadius: BorderRadius.circular(18),
                                  ),
                                  child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
                                ),
                                onDismissed: (_) {
                                  _apiService.deleteNotification(n.id);
                                  setState(() {
                                    _notifications.removeWhere((item) => item.id == n.id);
                                  });
                                },
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: n.isRead ? Colors.white : const Color(0xFFF0FDF4),
                                    borderRadius: BorderRadius.circular(18),
                                    border: Border.all(
                                      color: n.isRead ? const Color(0xFFE2E8F0) : const Color(0xFFBBF7D0),
                                      width: n.isRead ? 1 : 1.2,
                                    ),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Color(0x04000000),
                                        blurRadius: 8,
                                        offset: Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    borderRadius: BorderRadius.circular(18),
                                    child: InkWell(
                                      onTap: () => _onNotificationTap(n),
                                      borderRadius: BorderRadius.circular(18),
                                      child: Padding(
                                        padding: const EdgeInsets.all(14),
                                        child: Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            _buildIconContainer(n.type, size: 40),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Row(
                                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                    children: [
                                                      Expanded(
                                                        child: Text(
                                                          n.title,
                                                          style: GoogleFonts.roboto(
                                                            fontSize: 13.5,
                                                            fontWeight: n.isRead ? FontWeight.w600 : FontWeight.w800,
                                                            color: const Color(0xFF0F172A),
                                                          ),
                                                          maxLines: 1,
                                                          overflow: TextOverflow.ellipsis,
                                                        ),
                                                      ),
                                                      Text(
                                                        _timeAgo(n.createdAt),
                                                        style: GoogleFonts.roboto(
                                                          fontSize: 10.5,
                                                          fontWeight: FontWeight.w500,
                                                          color: const Color(0xFF94A3B8),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    n.message,
                                                    style: GoogleFonts.roboto(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w400,
                                                      color: const Color(0xFF64748B),
                                                      height: 1.4,
                                                    ),
                                                    maxLines: 2,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ],
                                              ),
                                            ),
                                            if (!n.isRead) ...[
                                              const SizedBox(width: 8),
                                              Container(
                                                width: 8,
                                                height: 8,
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFF16A34A),
                                                  shape: BoxShape.circle,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildFilterChip(String label, int count) {
    final bool isSelected = _selectedFilter == label;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF16A34A) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF16A34A).withOpacity(0.2),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: GoogleFonts.roboto(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: isSelected ? Colors.white : const Color(0xFF475569),
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white.withOpacity(0.25) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: GoogleFonts.roboto(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? Colors.white : const Color(0xFF475569),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
