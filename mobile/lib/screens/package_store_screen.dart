import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';
import 'payos_checkout_screen.dart';
import 'pt_booking_screen.dart';

class PackageStoreScreen extends StatefulWidget {
  const PackageStoreScreen({
    super.key,
    required this.auth,
    required this.onLoginRequired,
  });

  final AuthService auth;
  final Future<bool> Function() onLoginRequired;

  @override
  State<PackageStoreScreen> createState() => _PackageStoreScreenState();
}

class _PackageStoreScreenState extends State<PackageStoreScreen> {
  List<FitnessPackage> _packages = const [];
  List<MemberSubscription> _mySubscriptions = const [];
  bool _isLoading = true;
  String? _error;
  String _filter = 'ALL';
  int? _purchasingId;

  List<FitnessPackage> get _visiblePackages => _filter == 'ALL'
      ? _packages
      : _packages.where((package) => package.type == _filter).toList();

  @override
  void initState() {
    super.initState();
    _loadPackages();
  }

  Future<void> _loadPackages() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final packages = await widget.auth.getFitnessPackages();
      var subscriptions = <MemberSubscription>[];
      if (widget.auth.accessToken?.isNotEmpty == true) {
        try {
          subscriptions = await widget.auth.getMySubscriptions();
        } on AuthApiException {
          // Package browsing and first-time purchases should still work if
          // the optional membership lookup is temporarily unavailable.
        }
      }
      if (mounted) {
        setState(() {
          _packages = packages;
          _mySubscriptions = subscriptions;
        });
      }
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
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

  MemberSubscription? _renewableSubscriptionFor(FitnessPackage package) {
    if (package.type.toUpperCase() == 'PT') return null;
    final matching = _mySubscriptions.where((subscription) {
      final status = subscription.status.toUpperCase();
      return subscription.package?.id == package.id &&
          (status == 'ACTIVE' || status == 'EXPIRED');
    }).toList();
    if (matching.isEmpty) return null;
    matching.sort((first, second) {
      final firstActive = first.status.toUpperCase() == 'ACTIVE';
      final secondActive = second.status.toUpperCase() == 'ACTIVE';
      if (firstActive != secondActive) return firstActive ? -1 : 1;
      return (second.endDate ?? DateTime(0)).compareTo(
        first.endDate ?? DateTime(0),
      );
    });
    return matching.first;
  }

  Future<void> _buy(FitnessPackage package) async {
    if (_purchasingId != null) return;
    if (widget.auth.currentMember == null) {
      final signedIn = await widget.onLoginRequired();
      if (!signedIn || !mounted) return;
      try {
        final subscriptions = await widget.auth.getMySubscriptions();
        if (mounted) setState(() => _mySubscriptions = subscriptions);
      } on AuthApiException {
        // If lookup fails, keep the purchase flow available.
      }
    }

    if (!mounted) return;
    if (package.type.toUpperCase() == 'PT') {
      await _buyPtPackage(package);
      return;
    }

    var renewalSubscription = _renewableSubscriptionFor(package);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(
          Icons.fitness_center_rounded,
          color: AuraColors.caramel,
        ),
        title: Text(
          renewalSubscription == null ? 'Xác nhận đăng ký' : 'Gia hạn gói tập?',
        ),
        content: Text(
          renewalSubscription == null
              ? 'Bạn muốn đăng ký gói “${package.name}” với giá ${_formatPrice(package.price)}?\n\n'
                    'Bạn sẽ thanh toán an toàn qua PayOS. Gói chỉ được kích hoạt sau khi thanh toán thành công.'
              : 'Bạn đã có gói “${package.name}”. Thanh toán ${_formatPrice(package.price)} để gia hạn membership hiện tại. Thời hạn sẽ được cộng nối tiếp sau khi PayOS xác nhận; không tạo membership mới.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Để sau'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: AuraColors.darkCoffee,
            ),
            child: Text(
              renewalSubscription == null ? 'Xác nhận' : 'Tiếp tục thanh toán',
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _purchasingId = package.id);
    try {
      renewalSubscription ??= _renewableSubscriptionFor(package);
      final isRenewal = renewalSubscription != null;
      final checkout = isRenewal
          ? await widget.auth.renewSubscription(
              subscriptionId: renewalSubscription.id,
              packageId: package.id,
            )
          : await widget.auth.createPayOsCheckout(packageId: package.id);
      if (!mounted) return;
      setState(() => _purchasingId = null);
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => PayOsCheckoutScreen(
            auth: widget.auth,
            package: package,
            checkout: checkout,
            isRenewal: isRenewal,
          ),
        ),
      );
      if (mounted && isRenewal) {
        try {
          final subscriptions = await widget.auth.getMySubscriptions();
          if (mounted) setState(() => _mySubscriptions = subscriptions);
        } on AuthApiException {
          // The store remains usable; the membership screen can refresh later.
        }
      }
    } on AuthApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(error.message),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
    } finally {
      if (mounted) setState(() => _purchasingId = null);
    }
  }

  Future<void> _buyPtPackage(FitnessPackage package) async {
    if (package.totalPtSessions == null || package.totalPtSessions! <= 0) {
      _showMessage('Gói PT chưa được cấu hình số buổi. Vui lòng chọn gói khác.');
      return;
    }
    setState(() => _purchasingId = package.id);
    try {
      final subscriptions = await widget.auth.getMySubscriptions();
      if (!mounted) return;
      setState(() => _mySubscriptions = subscriptions);
      final now = DateTime.now();
      final hasActiveMembership = subscriptions.any((subscription) {
        return subscription.package?.type.toUpperCase() == 'MEMBERSHIP' &&
            subscription.status.toUpperCase() == 'ACTIVE' &&
            subscription.startDate != null &&
            subscription.endDate != null &&
            !subscription.startDate!.isAfter(now) &&
            !subscription.endDate!.isBefore(now);
      });

      if (!hasActiveMembership) {
        final browseMemberships = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            icon: const Icon(
              Icons.workspace_premium_rounded,
              color: AuraColors.caramel,
            ),
            title: const Text('Cần gói hội viên còn hạn'),
            content: const Text(
              'Bạn cần có Membership đang hoạt động mới được đăng ký gói PT.',
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
                child: const Text('Xem gói hội viên'),
              ),
            ],
          ),
        );
        if (browseMemberships == true && mounted) {
          setState(() => _filter = 'MEMBERSHIP');
        }
        return;
      }

      final coaches = await widget.auth.getAvailablePtCoaches();
      if (!mounted) return;
      if (coaches.isEmpty) {
        _showMessage('Hiện chưa có huấn luyện viên PT đang hoạt động.');
        return;
      }

      final selectedCoach = await showModalBottomSheet<FitnessCoach>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (sheetContext) => SafeArea(
          child: Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.72,
            ),
            decoration: const BoxDecoration(
              color: AuraColors.cream,
              borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 10),
                Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AuraColors.border,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.fromLTRB(20, 18, 20, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Chọn huấn luyện viên',
                      style: TextStyle(
                        color: AuraColors.darkCoffee,
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                    itemCount: coaches.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 9),
                    itemBuilder: (context, index) {
                      final coach = coaches[index];
                      return Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        child: ListTile(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: const BorderSide(color: AuraColors.border),
                          ),
                          leading: CircleAvatar(
                            backgroundColor: AuraColors.latte,
                            foregroundImage:
                                coach.avatar == null || coach.avatar!.isEmpty
                                ? null
                                : NetworkImage(coach.avatar!),
                            child: coach.avatar == null || coach.avatar!.isEmpty
                                ? const Icon(
                                    Icons.person_rounded,
                                    color: AuraColors.caramel,
                                  )
                                : null,
                          ),
                          title: Text(
                            coach.name,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            [
                                  coach.specialization,
                                  coach.rating == null
                                      ? null
                                      : '★ ${coach.rating!.toStringAsFixed(1)}',
                                ]
                                .whereType<String>()
                                .where((value) => value.trim().isNotEmpty)
                                .join('  ·  '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: const Icon(
                            Icons.chevron_right_rounded,
                            color: AuraColors.caramel,
                          ),
                          onTap: () => Navigator.pop(sheetContext, coach),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      if (selectedCoach == null || !mounted) return;

      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Thanh toán gói PT'),
          content: Text(
            'Gói ${package.name} · ${_formatPrice(package.price)}\n'
            '${package.totalPtSessions} buổi PT · HLV: ${selectedCoach.name}\n\n'
            'Bạn sẽ thanh toán qua PayOS. Gói chỉ được kích hoạt sau khi thanh toán thành công.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Hủy'),
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

      final checkout = await widget.auth.createPtPayOsCheckout(
        ptPackageId: package.id,
        trainerId: selectedCoach.id,
      );
      if (!mounted) return;
      final paid = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => PayOsCheckoutScreen(
            auth: widget.auth,
            package: package,
            checkout: checkout,
            isPtPurchase: true,
          ),
        ),
      );
      if (paid != true || !mounted) return;
      final updatedSubscriptions = await widget.auth.getMySubscriptions();
      if (mounted) setState(() => _mySubscriptions = updatedSubscriptions);
      final purchased = updatedSubscriptions
          .where((subscription) =>
              subscription.package?.id == package.id &&
              subscription.package?.type.toUpperCase() == 'PT' &&
              subscription.coachId == selectedCoach.id &&
              subscription.status.toUpperCase() == 'ACTIVE')
          .toList()
        ..sort((first, second) =>
            (second.startDate ?? DateTime(0)).compareTo(first.startDate ?? DateTime(0)));
      if (purchased.isEmpty) {
        _showMessage('Đã thanh toán. Vui lòng tải lại danh sách gói PT.');
        return;
      }
      await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => PtBookingScreen(
            auth: widget.auth,
            subscription: purchased.first,
          ),
        ),
      );
    } on AuthApiException catch (error) {
      if (mounted) _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _purchasingId = null);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AuraColors.cream,
    appBar: AppBar(
      backgroundColor: AuraColors.espresso,
      foregroundColor: Colors.white,
      title: const Text(
        'Gói tập Aura',
        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
      ),
    ),
    body: Column(
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AuraColors.espresso, AuraColors.darkCoffee],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: AuraColors.espresso.withValues(alpha: 0.17),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Đầu tư cho phiên bản khỏe hơn',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        height: 1.2,
                      ),
                    ),
                    SizedBox(height: 7),
                    Text(
                      'Chọn gói phù hợp với mục tiêu của bạn.',
                      style: TextStyle(color: Color(0xFFE8D8CF), fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.13),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.workspace_premium_rounded,
                  color: AuraColors.latte,
                  size: 29,
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Row(
            children: [
              _PackageFilterChip(
                label: 'Tất cả',
                selected: _filter == 'ALL',
                onTap: () => setState(() => _filter = 'ALL'),
              ),
              const SizedBox(width: 8),
              _PackageFilterChip(
                label: 'Hội viên',
                selected: _filter == 'MEMBERSHIP',
                onTap: () => setState(() => _filter = 'MEMBERSHIP'),
              ),
              const SizedBox(width: 8),
              _PackageFilterChip(
                label: 'PT cá nhân',
                selected: _filter == 'PT',
                onTap: () => setState(() => _filter = 'PT'),
              ),
            ],
          ),
        ),
        Expanded(child: _buildPackages()),
      ],
    ),
  );

  Widget _buildPackages() {
    if (_isLoading) return const Center(child: AuraLoader(size: 64));
    if (_error != null) {
      return _PackageMessage(
        icon: Icons.wifi_off_rounded,
        title: 'Không tải được gói tập',
        message: _error!,
        action: FilledButton.icon(
          onPressed: _loadPackages,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Thử lại'),
        ),
      );
    }
    final packages = _visiblePackages;
    if (packages.isEmpty) {
      return const _PackageMessage(
        icon: Icons.inventory_2_outlined,
        title: 'Chưa có gói phù hợp',
        message: 'Các gói đang mở bán sẽ được cập nhật tại đây.',
      );
    }
    return RefreshIndicator(
      color: AuraColors.caramel,
      onRefresh: _loadPackages,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 24),
        itemCount: packages.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final package = packages[index];
          final renewalSubscription = _renewableSubscriptionFor(package);
          return _FitnessPackageCard(
            package: package,
            formattedPrice: _formatPrice(package.price),
            isPurchasing: _purchasingId == package.id,
            isAnotherPurchaseInProgress: _purchasingId != null,
            isRenewal: renewalSubscription != null,
            onBuy: () => _buy(package),
          );
        },
      ),
    );
  }
}

class _FitnessPackageCard extends StatelessWidget {
  const _FitnessPackageCard({
    required this.package,
    required this.formattedPrice,
    required this.isPurchasing,
    required this.isAnotherPurchaseInProgress,
    required this.isRenewal,
    required this.onBuy,
  });

  final FitnessPackage package;
  final String formattedPrice;
  final bool isPurchasing;
  final bool isAnotherPurchaseInProgress;
  final bool isRenewal;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final isPersonalTraining = package.type.toUpperCase() == 'PT';
    final accent = isPersonalTraining
        ? AuraColors.caramel
        : AuraColors.darkCoffee;
    final duration = package.durationDays > 0
        ? '${package.durationDays} ngày tập luyện'
        : 'Linh hoạt theo gói';
    final sessions = isPersonalTraining
        ? package.totalPtSessions
        : package.trialPtSessions;
    final invalidPtPackage = isPersonalTraining && (sessions == null || sessions <= 0);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AuraColors.border.withValues(alpha: 0.8)),
        boxShadow: [
          BoxShadow(
            color: AuraColors.espresso.withValues(alpha: 0.065),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AuraColors.latte,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  isPersonalTraining
                      ? Icons.sports_gymnastics_rounded
                      : Icons.workspace_premium_rounded,
                  color: accent,
                  size: 25,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AuraColors.latte,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isPersonalTraining ? 'PT CÁ NHÂN' : 'HỘI VIÊN',
                        style: TextStyle(
                          color: accent,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.7,
                        ),
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      package.name,
                      style: const TextStyle(
                        color: AuraColors.ink,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (package.description?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Text(
              package.description!,
              style: const TextStyle(
                color: AuraColors.muted,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _PackageDetailChip(
                icon: Icons.calendar_month_rounded,
                text: duration,
              ),
              if (sessions != null && sessions > 0)
                _PackageDetailChip(
                  icon: Icons.fitness_center_rounded,
                  text: isPersonalTraining
                      ? '$sessions buổi PT'
                      : '$sessions buổi PT tặng kèm',
                ),
              if (invalidPtPackage)
                const _PackageDetailChip(
                  icon: Icons.info_outline_rounded,
                  text: 'Chưa cấu hình số buổi',
                ),
            ],
          ),
          const SizedBox(height: 17),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'GIÁ GÓI',
                      style: TextStyle(
                        color: AuraColors.muted,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      formattedPrice,
                      style: TextStyle(
                        color: accent,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: 46,
                child: FilledButton(
                  onPressed: isAnotherPurchaseInProgress || invalidPtPackage ? null : onBuy,
                  style: FilledButton.styleFrom(
                    backgroundColor: AuraColors.darkCoffee,
                    disabledBackgroundColor: AuraColors.coffee.withValues(
                      alpha: 0.6,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: isPurchasing
                      ? const AuraLoader(size: 23, centerColor: Colors.white)
                      : Text(
                          invalidPtPackage
                              ? 'Chưa sẵn sàng'
                              : isRenewal
                              ? 'Gia hạn gói'
                              : isPersonalTraining
                              ? 'Mua gói PT'
                              : 'Đăng ký gói',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PackageDetailChip extends StatelessWidget {
  const _PackageDetailChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xFFFCF8F4),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AuraColors.caramel),
        const SizedBox(width: 5),
        Text(
          text,
          style: const TextStyle(
            color: AuraColors.espresso,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _PackageFilterChip extends StatelessWidget {
  const _PackageFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          color: selected ? AuraColors.darkCoffee : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? AuraColors.darkCoffee : AuraColors.border,
          ),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: selected ? Colors.white : AuraColors.muted,
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    ),
  );
}

class _PackageMessage extends StatelessWidget {
  const _PackageMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56, color: AuraColors.caramel),
          const SizedBox(height: 14),
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
            style: const TextStyle(color: AuraColors.muted, fontSize: 13),
          ),
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    ),
  );
}
