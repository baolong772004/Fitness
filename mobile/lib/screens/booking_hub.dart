import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class BookingHub extends StatefulWidget {
  const BookingHub({
    super.key,
    required this.auth,
    required this.onBrowsePackages,
    required this.onMyPackages,
    required this.onPtSchedule,
    required this.onLoginRequired,
    this.workoutCategory = '',
  });

  final AuthService auth;
  final Future<void> Function() onBrowsePackages;
  final Future<void> Function() onMyPackages;
  final Future<void> Function() onPtSchedule;
  final Future<bool> Function() onLoginRequired;
  final String workoutCategory;

  @override
  State<BookingHub> createState() => _BookingHubState();
}

class _BookingHubState extends State<BookingHub> {
  List<MemberSubscription> _subscriptions = const [];
  List<PtBooking> _bookings = const [];
  bool _loading = true;
  String? _packageError;
  String? _bookingError;
  String? _loadedUserId;
  int _requestId = 0;

  bool get _isCoach => const {
    'COACH',
    'TRAINER',
  }.contains(widget.auth.currentMember?.effectiveRole.toUpperCase());

  @override
  void initState() {
    super.initState();
    _loadedUserId = widget.auth.currentMember?.id;
    _load();
  }

  @override
  void didUpdateWidget(covariant BookingHub oldWidget) {
    super.didUpdateWidget(oldWidget);
    final userId = widget.auth.currentMember?.id;
    if (userId != _loadedUserId) {
      _loadedUserId = userId;
      _load();
    }
  }

  Future<void> _load() async {
    final requestId = ++_requestId;
    if (widget.auth.currentMember == null) {
      if (!mounted) return;
      setState(() {
        _subscriptions = const [];
        _bookings = const [];
        _packageError = null;
        _bookingError = null;
        _loading = false;
      });
      return;
    }

    setState(() {
      _loading = true;
      _packageError = null;
      _bookingError = null;
    });
    var subscriptions = <MemberSubscription>[];
    var bookings = <PtBooking>[];
    String? packageError;
    String? bookingError;
    if (!_isCoach) {
      try {
        subscriptions = await widget.auth.getMySubscriptions();
      } on AuthApiException catch (error) {
        packageError = error.message;
      }
    }
    try {
      bookings = await widget.auth.getMyPtBookings();
    } on AuthApiException catch (error) {
      bookingError = error.message;
    }
    if (!mounted || requestId != _requestId) return;
    setState(() {
      _subscriptions = subscriptions;
      _bookings = bookings;
      _packageError = packageError;
      _bookingError = bookingError;
      _loading = false;
    });
  }

  Future<void> _openPackages() async {
    await widget.onBrowsePackages();
    if (mounted) await _load();
  }

  Future<void> _openMyPackages() async {
    if (widget.auth.currentMember == null) {
      if (!await widget.onLoginRequired() || !mounted) return;
    }
    await widget.onMyPackages();
    if (mounted) await _load();
  }

  Future<void> _signIn() async {
    if (await widget.onLoginRequired() && mounted) await _load();
  }

  Future<void> _openPtSchedule() async {
    await widget.onPtSchedule();
    if (mounted) await _load();
  }

  MemberSubscription? get _activeMembership {
    for (final subscription in _subscriptions) {
      if (subscription.status.toUpperCase() == 'ACTIVE' &&
          subscription.package?.type.toUpperCase() != 'PT' &&
          subscription.coachId == null) {
        return subscription;
      }
    }
    return null;
  }

  PtBooking? get _nextPtBooking {
    final now = DateTime.now();
    final upcoming =
        _bookings.where((booking) {
            final status = booking.status.toUpperCase();
            return const {
                  'PENDING',
                  'UPCOMING',
                  'CONFIRMED',
                  'IN_PROGRESS',
                }.contains(status) &&
                booking.endTime != null &&
                booking.endTime!.isAfter(now);
          }).toList()
          ..sort((a, b) => (a.startTime ?? now).compareTo(b.startTime ?? now));
    return upcoming.isEmpty ? null : upcoming.first;
  }

  String _date(DateTime? date) {
    if (date == null) return 'Chưa cập nhật';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  String _appointment(DateTime? date) {
    if (date == null) return 'Chưa cập nhật giờ tập';
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')} · ${_date(date)}';
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = widget.auth.currentMember != null;
    return RefreshIndicator(
      color: AuraColors.coffee,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 116),
        children: [
          _hero(),
          const SizedBox(height: 25),
          if (!_isCoach) ...[
            _sectionTitle('Gói tập & quyền lợi'),
            const SizedBox(height: 11),
            Row(
              children: [
                Expanded(
                  child: _actionCard(
                    icon: Icons.local_offer_rounded,
                    title: 'Mua gói tập',
                    subtitle: 'Hội viên và PT',
                    onTap: _openPackages,
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: _actionCard(
                    icon: Icons.card_membership_rounded,
                    title: 'Gói của tôi',
                    subtitle: 'Xem hạn và gia hạn',
                    onTap: _openMyPackages,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 13),
          ],
          if (!signedIn)
            _summaryCard(
              icon: Icons.lock_outline_rounded,
              title: 'Đăng nhập để xem gói và lịch tập',
              detail: 'Thông tin tập luyện của bạn sẽ hiển thị tại đây.',
              actionLabel: 'Đăng nhập',
              onAction: _signIn,
            )
          else if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: AuraLoader(size: 48)),
            )
          else ...[
            if (!_isCoach) ...[
              _membershipSummary(),
              const SizedBox(height: 22),
            ],
            _sectionTitle('Lịch tập của bạn'),
            const SizedBox(height: 11),
            _ptSummary(),
          ],
          const SizedBox(height: 22),
          _sectionTitle('Hình thức tập luyện'),
          const SizedBox(height: 11),
          _trainingOption(
            icon: Icons.fitness_center_rounded,
            title: 'Tập cùng PT',
            description: 'Lịch hẹn, đặt buổi và liên hệ huấn luyện viên',
            onTap: _openPtSchedule,
          ),
          const SizedBox(height: 11),
          _trainingOption(
            icon: Icons.groups_rounded,
            title: 'Workout Class',
            description: widget.workoutCategory.isEmpty
                ? 'Khu vực dành cho lịch lớp tập nhóm sắp tới'
                : 'Lớp ${widget.workoutCategory} sẽ hiển thị tại đây',
            badge: 'Đang hoàn thiện',
          ),
        ],
      ),
    );
  }

  Widget _hero() => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(26),
      gradient: const LinearGradient(
        colors: [
          AuraColors.espresso,
          AuraColors.darkCoffee,
          AuraColors.caramel,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      boxShadow: [
        BoxShadow(
          color: AuraColors.darkCoffee.withValues(alpha: 0.18),
          blurRadius: 20,
          offset: const Offset(0, 10),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(99),
          ),
          child: const Text(
            'AURA FITNESS · LỊCH TẬP',
            style: TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
        ),
        const SizedBox(height: 19),
        Text(
          _isCoach ? 'Lịch huấn luyện của bạn' : 'Tập luyện theo cách của bạn',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 25,
            fontWeight: FontWeight.w900,
            height: 1.12,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          _isCoach
              ? 'Theo dõi buổi hẹn và đồng hành cùng hội viên.'
              : 'Xem gói đang dùng, chọn buổi PT và chuẩn bị cho lớp tập.',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.82),
            fontSize: 13,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: _isCoach ? _openPtSchedule : _openPackages,
          style: FilledButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: AuraColors.darkCoffee,
          ),
          icon: Icon(
            _isCoach ? Icons.calendar_month_rounded : Icons.add_rounded,
          ),
          label: Text(_isCoach ? 'Xem lịch PT' : 'Khám phá gói tập'),
        ),
      ],
    ),
  );

  Widget _sectionTitle(String title) => Text(
    title,
    style: const TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w900,
      color: AuraColors.ink,
    ),
  );

  Widget _actionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(20),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 145,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AuraColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AuraColors.latte,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: AuraColors.darkCoffee, size: 22),
            ),
            const Spacer(),
            Text(
              title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: AuraColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: AuraColors.muted),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _membershipSummary() {
    if (_packageError != null) {
      return _summaryCard(
        icon: Icons.cloud_off_rounded,
        title: 'Chưa tải được thông tin gói',
        detail: _packageError!,
        actionLabel: 'Thử lại',
        onAction: _load,
      );
    }
    final active = _activeMembership;
    return _summaryCard(
      icon: active == null
          ? Icons.card_membership_outlined
          : Icons.verified_rounded,
      title: active?.package?.name ?? 'Bạn chưa có gói hội viên hoạt động',
      detail: active == null
          ? 'Chọn gói hội viên để bắt đầu tập luyện.'
          : 'Đang hoạt động · Hết hạn ${_date(active.endDate)}',
      actionLabel: active == null ? 'Xem gói tập' : 'Chi tiết gói',
      onAction: active == null ? _openPackages : _openMyPackages,
    );
  }

  Widget _ptSummary() {
    if (_bookingError != null) {
      return _summaryCard(
        icon: Icons.cloud_off_rounded,
        title: 'Chưa tải được lịch PT',
        detail: _bookingError!,
        actionLabel: 'Thử lại',
        onAction: _load,
      );
    }
    final booking = _nextPtBooking;
    return _summaryCard(
      icon: Icons.event_available_rounded,
      title: booking == null
          ? (_isCoach
                ? 'Chưa có lịch huấn luyện sắp tới'
                : 'Chưa có buổi PT sắp tới')
          : (_isCoach
                ? booking.memberName ?? 'Buổi tập với hội viên'
                : booking.coachName ?? 'Buổi tập cùng PT'),
      detail: booking == null
          ? 'Lịch PT và trạng thái xác nhận sẽ hiển thị tại đây.'
          : '${_appointment(booking.startTime)} · ${switch (booking.status.toUpperCase()) {
              'PENDING' || 'UPCOMING' => 'Chờ HLV xác nhận',
              'IN_PROGRESS' => 'Đang tập',
              _ => 'Đã xác nhận',
            }}',
      actionLabel: 'Xem lịch PT',
      onAction: _openPtSchedule,
    );
  }

  Widget _summaryCard({
    required IconData icon,
    required String title,
    required String detail,
    required String actionLabel,
    required VoidCallback onAction,
  }) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(17),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: AuraColors.border),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AuraColors.latte,
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(icon, color: AuraColors.darkCoffee, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AuraColors.ink,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                detail,
                style: const TextStyle(
                  fontSize: 12,
                  color: AuraColors.muted,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 30),
                ),
                child: Text(
                  '$actionLabel  →',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _trainingOption({
    required IconData icon,
    required String title,
    required String description,
    String? badge,
    VoidCallback? onTap,
  }) => Material(
    color: badge == null ? Colors.white : const Color(0xFFF5EBE2),
    borderRadius: BorderRadius.circular(20),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AuraColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AuraColors.latte,
                borderRadius: BorderRadius.circular(15),
              ),
              child: Icon(icon, color: AuraColors.darkCoffee, size: 24),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: AuraColors.ink,
                          ),
                        ),
                      ),
                      if (badge != null) ...[
                        const SizedBox(width: 7),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            badge,
                            style: const TextStyle(
                              color: AuraColors.caramel,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AuraColors.muted,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
            if (onTap != null)
              const Icon(
                Icons.chevron_right_rounded,
                color: AuraColors.caramel,
              ),
          ],
        ),
      ),
    ),
  );
}
