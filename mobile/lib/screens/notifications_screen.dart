import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({
    super.key,
    required this.auth,
    required this.onLoginRequired,
    required this.onUnreadCountChanged,
  });

  final AuthService auth;
  final Future<bool> Function() onLoginRequired;
  final ValueChanged<int> onUnreadCountChanged;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<MemberNotification> _notifications = const [];
  bool _loading = true;
  bool _markingAll = false;
  String? _error;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications({bool showLoader = true}) async {
    if (widget.auth.currentMember == null) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = null;
        _notifications = const [];
        _unreadCount = 0;
      });
      widget.onUnreadCountChanged(0);
      return;
    }
    if (mounted) {
      setState(() {
        if (showLoader) _loading = true;
        _error = null;
      });
    }
    try {
      final page = await widget.auth.getMyNotifications();
      if (!mounted) return;
      setState(() {
        _notifications = page.notifications;
        _unreadCount = page.unreadCount;
        _loading = false;
      });
      widget.onUnreadCountChanged(page.unreadCount);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  Future<void> _signIn() async {
    final signedIn = await widget.onLoginRequired();
    if (signedIn && mounted) await _loadNotifications();
  }

  Future<void> _markRead(MemberNotification notification) async {
    if (notification.isRead || notification.id.isEmpty) return;
    try {
      await widget.auth.markNotificationRead(notification.id);
      if (!mounted) return;
      setState(() {
        _notifications = _notifications
            .map((item) => item.id == notification.id
                ? MemberNotification(
                    id: item.id,
                    title: item.title,
                    message: item.message,
                    isRead: true,
                    createdAt: item.createdAt,
                  )
                : item)
            .toList();
        if (_unreadCount > 0) _unreadCount--;
      });
      widget.onUnreadCountChanged(_unreadCount);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  Future<void> _markAllRead() async {
    if (_unreadCount == 0 || _markingAll) return;
    setState(() => _markingAll = true);
    try {
      await widget.auth.markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        _notifications = _notifications
            .map((item) => MemberNotification(
                  id: item.id,
                  title: item.title,
                  message: item.message,
                  isRead: true,
                  createdAt: item.createdAt,
                ))
            .toList();
        _unreadCount = 0;
        _markingAll = false;
      });
      widget.onUnreadCountChanged(0);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() => _markingAll = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  String _dateLabel(DateTime? date) {
    if (date == null) return '';
    final now = DateTime.now();
    final sameDay = date.year == now.year && date.month == now.month && date.day == now.day;
    final yesterday = DateTime(now.year, now.month, now.day)
        .difference(DateTime(date.year, date.month, date.day))
        .inDays == 1;
    final clock = '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    if (sameDay) return 'Hôm nay · $clock';
    if (yesterday) return 'Hôm qua · $clock';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} · $clock';
  }

  @override
  Widget build(BuildContext context) {
    final isSignedIn = widget.auth.currentMember != null;
    return RefreshIndicator(
      color: AuraColors.coffee,
      onRefresh: () => _loadNotifications(showLoader: false),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 110),
        children: [
          _header(isSignedIn),
          const SizedBox(height: 20),
          if (!isSignedIn)
            _signInCard()
          else if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 80),
              child: Center(child: AuraLoader(size: 58)),
            )
          else if (_error != null)
            _errorCard()
          else if (_notifications.isEmpty)
            _emptyState()
          else ...[
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Gần đây',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AuraColors.ink),
                  ),
                ),
                if (_unreadCount > 0)
                  TextButton(
                    onPressed: _markingAll ? null : _markAllRead,
                    child: _markingAll
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Đọc tất cả'),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            ..._notifications.map(_notificationCard),
          ],
        ],
      ),
    );
  }

  Widget _header(bool isSignedIn) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            colors: [AuraColors.darkCoffee, AuraColors.caramel],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(color: AuraColors.darkCoffee.withValues(alpha: 0.16), blurRadius: 18, offset: const Offset(0, 8)),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(17)),
              child: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 27),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Hộp thư Aura', style: TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(
                    isSignedIn ? '$_unreadCount thông báo chưa đọc' : 'Đăng nhập để xem thông báo của bạn',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.82), fontSize: 13),
                  ),
                ],
              ),
            ),
            if (isSignedIn)
              IconButton(
                tooltip: 'Làm mới',
                onPressed: () => _loadNotifications(),
                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              ),
          ],
        ),
      );

  Widget _signInCard() => _surface(
        child: Column(
          children: [
            const Icon(Icons.mark_email_unread_outlined, size: 48, color: AuraColors.caramel),
            const SizedBox(height: 12),
            const Text('Đăng nhập để xem hộp thư', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AuraColors.ink)),
            const SizedBox(height: 6),
            const Text('Thông báo lịch tập và cập nhật tài khoản sẽ được lưu tại đây.', textAlign: TextAlign.center, style: TextStyle(color: AuraColors.muted, height: 1.4)),
            const SizedBox(height: 16),
            FilledButton.icon(onPressed: _signIn, icon: const Icon(Icons.login_rounded), label: const Text('Đăng nhập')),
          ],
        ),
      );

  Widget _errorCard() => _surface(
        child: Column(
          children: [
            const Icon(Icons.cloud_off_rounded, size: 42, color: AuraColors.caramel),
            const SizedBox(height: 10),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AuraColors.muted, height: 1.4)),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: () => _loadNotifications(), icon: const Icon(Icons.refresh_rounded), label: const Text('Thử lại')),
          ],
        ),
      );

  Widget _emptyState() => _surface(
        child: const Column(
          children: [
            Icon(Icons.notifications_none_rounded, size: 52, color: AuraColors.caramel),
            SizedBox(height: 12),
            Text('Bạn chưa có thông báo', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AuraColors.ink)),
            SizedBox(height: 5),
            Text('Khi có cập nhật về lịch tập, thông báo sẽ xuất hiện ở đây.', textAlign: TextAlign.center, style: TextStyle(color: AuraColors.muted, height: 1.4)),
          ],
        ),
      );

  Widget _notificationCard(MemberNotification item) => Padding(
        padding: const EdgeInsets.only(bottom: 11),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => _markRead(item),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: item.isRead ? Colors.white : const Color(0xFFFFF8F1),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: item.isRead ? AuraColors.border : AuraColors.latte),
                boxShadow: [BoxShadow(color: AuraColors.ink.withValues(alpha: 0.035), blurRadius: 10, offset: const Offset(0, 3))],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(color: item.isRead ? AuraColors.cream : AuraColors.latte, borderRadius: BorderRadius.circular(14)),
                    child: Icon(_iconFor(item.title), color: AuraColors.coffee, size: 21),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: Text(item.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AuraColors.ink))),
                            if (!item.isRead) Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 5, left: 8), decoration: const BoxDecoration(color: AuraColors.caramel, shape: BoxShape.circle)),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(item.message, style: const TextStyle(color: AuraColors.muted, height: 1.4, fontSize: 13)),
                        if (item.createdAt != null) ...[
                          const SizedBox(height: 9),
                          Text(_dateLabel(item.createdAt), style: const TextStyle(color: AuraColors.caramel, fontSize: 11, fontWeight: FontWeight.w700)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _surface({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AuraColors.border)),
        child: child,
      );

  IconData _iconFor(String title) {
    final value = title.toLowerCase();
    if (value.contains('lịch') || value.contains('buổi')) return Icons.calendar_month_rounded;
    if (value.contains('thanh toán') || value.contains('gói')) return Icons.card_membership_rounded;
    if (value.contains('pt') || value.contains('huấn luyện')) return Icons.fitness_center_rounded;
    return Icons.notifications_active_rounded;
  }
}
