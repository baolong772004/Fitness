import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import 'payos_checkout_screen.dart';
import 'pt_booking_screen.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class MySubscriptionsScreen extends StatefulWidget {
  const MySubscriptionsScreen({
    super.key,
    required this.auth,
    required this.onBrowsePackages,
  });

  final AuthService auth;
  final VoidCallback onBrowsePackages;

  @override
  State<MySubscriptionsScreen> createState() => _MySubscriptionsScreenState();
}

class _MySubscriptionsScreenState extends State<MySubscriptionsScreen> {
  List<MemberSubscription> _subscriptions = const [];
  bool _isLoading = true;
  String? _error;
  String? _renewingSubscriptionId;

  @override
  void initState() {
    super.initState();
    _loadSubscriptions();
  }

  Future<void> _loadSubscriptions() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final subscriptions = await widget.auth.getMySubscriptions();
      if (mounted) setState(() => _subscriptions = subscriptions);
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _renewSubscription(MemberSubscription subscription) async {
    final package = subscription.package;
    if (package == null ||
        package.type.toUpperCase() == 'PT' ||
        _renewingSubscriptionId != null) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Gia hạn gói tập?'),
        content: Text(
          'Bạn sẽ thanh toán ${_formatPrice(package.price)} để gia hạn '
          '${package.name}. Thời hạn mới sẽ được cộng nối tiếp vào gói hiện '
          'tại sau khi thanh toán thành công.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Để sau'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: AuraColors.darkCoffee,
            ),
            child: const Text('Tiếp tục thanh toán'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _renewingSubscriptionId = subscription.id);
    try {
      final checkout = await widget.auth.renewSubscription(
        subscriptionId: subscription.id,
        packageId: package.id,
      );
      if (!mounted) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => PayOsCheckoutScreen(
            auth: widget.auth,
            package: package,
            checkout: checkout,
            isRenewal: true,
          ),
        ),
      );
      if (!mounted) return;
      await _loadSubscriptions();
    } on AuthApiException catch (error) {
      if (mounted) _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _renewingSubscriptionId = null);
    }
  }

  Future<void> _bookPtSession(MemberSubscription subscription) async {
    final booked = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PtBookingScreen(
          auth: widget.auth,
          subscription: subscription,
        ),
      ),
    );
    if (booked != true || !mounted) return;
    _showMessage('Đã gửi yêu cầu đặt lịch. Vui lòng chờ HLV xác nhận.');
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  String _formatDate(DateTime? value) {
    if (value == null) return 'Chưa cập nhật';
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');
    return '$day/$month/${value.year}';
  }

  String _formatPrice(double value) {
    final digits = value.round().toString();
    final result = StringBuffer();
    for (var index = 0; index < digits.length; index++) {
      if (index > 0 && (digits.length - index) % 3 == 0) result.write('.');
      result.write(digits[index]);
    }
    return '${result.toString()} đ';
  }

  int get _activeCount => _subscriptions
      .where((subscription) => subscription.status.toUpperCase() == 'ACTIVE')
      .length;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AuraColors.cream,
    appBar: AppBar(
      backgroundColor: AuraColors.espresso,
      foregroundColor: Colors.white,
      title: const Text(
        'Gói tập của tôi',
        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          tooltip: 'Tải lại',
          onPressed: _isLoading ? null : _loadSubscriptions,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
    ),
    body: Column(
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AuraColors.espresso, AuraColors.darkCoffee],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AuraColors.espresso.withValues(alpha: 0.15),
                blurRadius: 16,
                offset: const Offset(0, 7),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.workspace_premium_rounded,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hội viên Aura Fitness',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '$_activeCount gói đang hoạt động • ${_subscriptions.length} gói tất cả',
                      style: const TextStyle(
                        color: Color(0xFFE8D8CF),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(child: _buildContent()),
      ],
    ),
  );

  Widget _buildContent() {
    if (_isLoading && _subscriptions.isEmpty) {
      return const Center(child: AuraLoader(size: 64));
    }
    if (_error != null && _subscriptions.isEmpty) {
      return _SubscriptionsMessage(
        icon: Icons.wifi_off_rounded,
        title: 'Chưa tải được danh sách gói',
        message: _error!,
        actionLabel: 'Thử lại',
        onAction: _loadSubscriptions,
      );
    }
    if (_subscriptions.isEmpty) {
      return _SubscriptionsMessage(
        icon: Icons.card_membership_rounded,
        title: 'Bạn chưa có gói tập',
        message: 'Chọn một gói phù hợp và bắt đầu hành trình tập luyện của bạn.',
        actionLabel: 'Khám phá gói tập',
        onAction: widget.onBrowsePackages,
      );
    }

    return RefreshIndicator(
      color: AuraColors.caramel,
      onRefresh: _loadSubscriptions,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 24),
        itemCount: _subscriptions.length + (_error == null ? 0 : 1),
        separatorBuilder: (_, _) => const SizedBox(height: 11),
        itemBuilder: (context, index) {
          if (index == _subscriptions.length) {
            return TextButton.icon(
              onPressed: _loadSubscriptions,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(_error!),
            );
          }
          final subscription = _subscriptions[index];
          return _SubscriptionCard(
            subscription: subscription,
            formatDate: _formatDate,
            formatPrice: _formatPrice,
            isRenewing: _renewingSubscriptionId == subscription.id,
            onRenew: () => _renewSubscription(subscription),
            onBookPt: () => _bookPtSession(subscription),
          );
        },
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({
    required this.subscription,
    required this.formatDate,
    required this.formatPrice,
    required this.isRenewing,
    required this.onRenew,
    required this.onBookPt,
  });

  final MemberSubscription subscription;
  final String Function(DateTime?) formatDate;
  final String Function(double) formatPrice;
  final bool isRenewing;
  final VoidCallback onRenew;
  final VoidCallback onBookPt;

  @override
  Widget build(BuildContext context) {
    final status = subscription.status.toUpperCase();
    final statusColor = switch (status) {
      'ACTIVE' => const Color(0xFF2E8B57),
      'PENDING' => AuraColors.caramel,
      'EXPIRED' || 'CANCELLED' => Colors.red.shade700,
      _ => AuraColors.muted,
    };
    final statusLabel = switch (status) {
      'ACTIVE' => 'Đang hoạt động',
      'PENDING' => 'Chờ xác nhận',
      'EXPIRED' => 'Đã hết hạn',
      'CANCELLED' => 'Đã hủy',
      _ => subscription.status,
    };
    final package = subscription.package;
    final isPt = package?.type.toUpperCase() == 'PT';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AuraColors.border.withValues(alpha: 0.7)),
        boxShadow: [
          BoxShadow(
            color: AuraColors.espresso.withValues(alpha: 0.055),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AuraColors.latte,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  isPt
                      ? Icons.sports_gymnastics_rounded
                      : Icons.workspace_premium_rounded,
                  color: AuraColors.caramel,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      package?.name ?? 'Gói tập Aura',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AuraColors.ink,
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      isPt ? 'Huấn luyện cá nhân' : 'Hội viên',
                      style: const TextStyle(
                        color: AuraColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AuraColors.border),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _SubscriptionDetail(
                  label: 'BẮT ĐẦU',
                  value: formatDate(subscription.startDate),
                ),
              ),
              Expanded(
                child: _SubscriptionDetail(
                  label: 'KẾT THÚC',
                  value: formatDate(subscription.endDate),
                ),
              ),
            ],
          ),
          if (subscription.remainingSessions != null) ...[
            const SizedBox(height: 11),
            Row(
              children: [
                const Icon(
                  Icons.fitness_center_rounded,
                  color: AuraColors.caramel,
                  size: 16,
                ),
                const SizedBox(width: 7),
                Text(
                  isPt
                      ? 'Còn ${subscription.remainingSessions} buổi PT'
                      : 'Buổi PT tặng kèm: ${subscription.remainingSessions}',
                  style: const TextStyle(
                    color: AuraColors.darkCoffee,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                if (package != null)
                  Text(
                    formatPrice(package.price),
                    style: const TextStyle(
                      color: AuraColors.darkCoffee,
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
              ],
            ),
          ],
          if ((status == 'ACTIVE' || status == 'EXPIRED') &&
              package != null &&
              !isPt) ...[
            const SizedBox(height: 13),
            SizedBox(
              width: double.infinity,
              height: 45,
              child: FilledButton.icon(
                onPressed: isRenewing ? null : onRenew,
                style: FilledButton.styleFrom(
                  backgroundColor: AuraColors.darkCoffee,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(13),
                  ),
                ),
                icon: isRenewing
                    ? const SizedBox.square(
                        dimension: 18,
                        child: AuraLoader(size: 18, centerColor: Colors.white),
                      )
                    : const Icon(Icons.autorenew_rounded, size: 19),
                label: Text(
                  isRenewing ? 'Đang tạo đơn gia hạn…' : 'Gia hạn gói tập',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
          if (status == 'ACTIVE' && isPt && subscription.coachId != null) ...[
            const SizedBox(height: 13),
            SizedBox(
              width: double.infinity,
              height: 45,
              child: FilledButton.icon(
                onPressed: (subscription.remainingSessions ?? 0) > 0
                    ? onBookPt
                    : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AuraColors.darkCoffee,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(13),
                  ),
                ),
                icon: const Icon(Icons.calendar_month_rounded, size: 19),
                label: Text(
                  (subscription.remainingSessions ?? 0) <= 0
                      ? 'Gói PT chưa có buổi khả dụng'
                      : subscription.coachName == null
                      ? 'Xem lịch trống & đặt buổi PT'
                      : 'Đặt lịch với ${subscription.coachName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SubscriptionDetail extends StatelessWidget {
  const _SubscriptionDetail({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: AuraColors.muted,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.7,
        ),
      ),
      const SizedBox(height: 4),
      Text(
        value,
        style: const TextStyle(
          color: AuraColors.ink,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _SubscriptionsMessage extends StatelessWidget {
  const _SubscriptionsMessage({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: const BoxDecoration(
              color: AuraColors.latte,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AuraColors.caramel, size: 35),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AuraColors.darkCoffee,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AuraColors.muted,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: onAction,
            style: FilledButton.styleFrom(
              backgroundColor: AuraColors.darkCoffee,
            ),
            child: Text(actionLabel),
          ),
        ],
      ),
    ),
  );
}
