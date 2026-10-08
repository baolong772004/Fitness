import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';
import 'pt_booking_screen.dart';
import 'pt_chat_screen.dart';
import 'pt_qr_screen.dart';

class PtJourneyScreen extends StatefulWidget {
  const PtJourneyScreen({
    super.key,
    required this.auth,
    required this.onBrowsePackages,
    required this.onLoginRequired,
  });

  final AuthService auth;
  final Future<void> Function() onBrowsePackages;
  final Future<bool> Function() onLoginRequired;

  @override
  State<PtJourneyScreen> createState() => _PtJourneyScreenState();
}

class _PtJourneyScreenState extends State<PtJourneyScreen> {
  List<PtBooking> _bookings = const [];
  List<MemberSubscription> _subscriptions = const [];
  String? _error;
  bool _loading = true;
  int? _busyBookingId;

  bool get _isCoach => const {
    'COACH',
    'TRAINER',
  }.contains(widget.auth.currentMember?.effectiveRole.toUpperCase());

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.auth.currentMember == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bookings = await widget.auth.getMyPtBookings();
      final subscriptions = _isCoach
          ? <MemberSubscription>[]
          : await widget.auth.getMySubscriptions();
      if (!mounted) return;
      setState(() {
        _bookings = bookings;
        _subscriptions = subscriptions;
      });
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _browse() async {
    await widget.onBrowsePackages();
    if (mounted) await _load();
  }

  Future<void> _openBooking(
    MemberSubscription subscription, {
    int? makeupFor,
    DateTime? makeupDeadline,
  }) async {
    final booked = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PtBookingScreen(
          auth: widget.auth,
          subscription: subscription,
          originalBookingId: makeupFor,
          makeupDeadline: makeupDeadline,
        ),
      ),
    );
    if (booked == true && mounted) {
      _notice(
        makeupFor == null
            ? 'Đã gửi yêu cầu đặt lịch. Hãy chờ HLV xác nhận.'
            : 'Đã đặt lịch học bù thành công.',
      );
      await _load();
    }
  }

  Future<void> _scanSession() async {
    final qrToken = await Navigator.of(
      context,
    ).push<String>(MaterialPageRoute(builder: (_) => const PtQrScanScreen()));
    if (qrToken == null || !mounted) return;
    try {
      await widget.auth.startPtSession(qrToken);
      if (!mounted) return;
      _notice('Đã điểm danh. Buổi tập PT đã bắt đầu!');
      await _load();
    } on AuthApiException catch (error) {
      if (mounted) _notice(error.message);
    }
  }

  Future<void> _markAbsent(PtBooking booking) async {
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Báo vắng buổi PT'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Báo trước ít nhất 2 giờ và còn lượt học bù để được đặt lịch bù. '
              'Báo trễ hoặc vắng buổi học bù có thể bị trừ buổi.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reason,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Lý do vắng mặt'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Quay lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Xác nhận báo vắng'),
          ),
        ],
      ),
    );
    final absenceReason = reason.text.trim();
    reason.dispose();
    if (confirmed != true || !mounted) return;
    await _runAction(booking.id, () async {
      final message = await widget.auth.markPtAbsent(booking.id, absenceReason);
      _notice(message);
    });
  }

  Future<void> _complete(PtBooking booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hoàn thành buổi tập?'),
        content: const Text(
          'Xác nhận hoàn thành sẽ trừ 1 buổi trong gói PT của hội viên.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Để sau'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Hoàn thành'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _runAction(booking.id, () async {
      await widget.auth.completePtSession(booking.id);
      _notice('Buổi tập đã hoàn thành và trừ 1 buổi trong gói PT.');
    });
  }

  Future<void> _reviewBooking(PtBooking booking, {required bool accept}) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(accept ? 'Xác nhận lịch tập?' : 'Từ chối lịch tập?'),
        content: Text(
          accept
              ? 'Hội viên sẽ nhận được xác nhận và có thể dùng QR khi đến tập.'
              : 'Lịch hẹn sẽ được đánh dấu đã từ chối. Hội viên có thể chọn ca khác.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Để sau'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(accept ? 'Đồng ý' : 'Từ chối'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _runAction(booking.id, () async {
      await widget.auth.reviewPtBooking(bookingId: booking.id, accept: accept);
      _notice(accept ? 'Đã xác nhận lịch tập.' : 'Đã từ chối lịch tập.');
    });
  }

  Future<void> _runAction(int id, Future<void> Function() action) async {
    if (_busyBookingId != null) return;
    setState(() => _busyBookingId = id);
    try {
      await action();
      if (mounted) await _load();
    } on AuthApiException catch (error) {
      if (mounted) _notice(error.message);
    } finally {
      if (mounted) setState(() => _busyBookingId = null);
    }
  }

  void _notice(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  String _date(DateTime? value) {
    if (value == null) return 'Chưa cập nhật';
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '$hour:$minute · $day/$month/${value.year}';
  }

  String _status(String status) => switch (status.toUpperCase()) {
    'PENDING' || 'UPCOMING' => 'Chờ HLV xác nhận',
    'CONFIRMED' => 'Đã xác nhận',
    'IN_PROGRESS' => 'Đang tập',
    'COMPLETED' => 'Hoàn thành',
    'ABSENT_ELIGIBLE' => 'Được học bù',
    'ABSENT_NO_REFUND' => 'Vắng, đã trừ buổi',
    'MAKEUP_BOOKED' => 'Đã đặt học bù',
    'CANCELLED' => 'Đã hủy',
    'REJECTED' => 'PT đã từ chối',
    _ => status,
  };

  @override
  Widget build(BuildContext context) {
    final member = widget.auth.currentMember;
    if (member == null) {
      return _empty(
        icon: Icons.lock_outline_rounded,
        title: 'Đăng nhập để tập cùng PT',
        description: 'Xem gói đã mua, lịch hẹn và điểm danh buổi tập của bạn.',
        button: 'Đăng nhập',
        onPressed: () async {
          final signedIn = await widget.onLoginRequired();
          if (signedIn && mounted) await _load();
        },
      );
    }

    final activePackages = _subscriptions
        .where(
          (subscription) =>
              subscription.package?.type.toUpperCase() == 'PT' &&
              subscription.status.toUpperCase() == 'ACTIVE' &&
              subscription.coachId != null,
        )
        .toList();
    return RefreshIndicator(
      onRefresh: _load,
      color: AuraColors.caramel,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        children: [
          Text(
            _isCoach ? 'Lịch hẹn của HLV' : 'Hành trình PT của bạn',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 21,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            _isCoach
                ? 'Tạo QR cho hội viên, theo dõi và hoàn thành buổi tập.'
                : 'Đặt lịch, điểm danh và theo dõi từng buổi tập.',
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 18),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(38),
              child: Center(child: AuraLoader(size: 48)),
            )
          else if (_error != null)
            _empty(
              icon: Icons.wifi_off_rounded,
              title: 'Chưa tải được lịch PT',
              description: _error!,
              button: 'Thử lại',
              onPressed: _load,
            )
          else ...[
            if (!_isCoach) ...[
              if (activePackages.isEmpty)
                _empty(
                  icon: Icons.workspace_premium_rounded,
                  title: 'Chưa có gói PT đang hoạt động',
                  description:
                      'Chọn gói PT và HLV. Bạn cần gói hội viên còn hạn để mua.',
                  button: 'Xem gói PT',
                  onPressed: _browse,
                )
              else ...[
                for (final subscription in activePackages)
                  _packageCard(subscription),
                const SizedBox(height: 8),
              ],
            ],
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Lịch hẹn PT',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Tải lại lịch',
                  onPressed: _load,
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                ),
              ],
            ),
            const SizedBox(height: 4),
            if (_bookings.isEmpty)
              _empty(
                icon: Icons.event_available_rounded,
                title: 'Chưa có lịch hẹn',
                description: _isCoach
                    ? 'Lịch của hội viên sẽ hiện ở đây sau khi họ đặt buổi.'
                    : 'Chọn ca trống trên gói PT để đặt buổi đầu tiên.',
              )
            else
              for (final booking in _bookings) _bookingCard(booking),
          ],
        ],
      ),
    );
  }

  Widget _packageCard(MemberSubscription subscription) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(17),
    decoration: _decoration(),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          subscription.package?.name ?? 'Gói PT',
          style: const TextStyle(
            color: AuraColors.ink,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          'HLV: ${subscription.coachName ?? 'Đã chọn'} · Còn ${subscription.remainingSessions ?? 0} buổi',
          style: const TextStyle(color: AuraColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: (subscription.remainingSessions ?? 0) <= 0
                ? null
                : () => _openBooking(subscription),
            icon: const Icon(Icons.calendar_month_rounded),
            label: const Text('Xem ca trống & đặt buổi'),
          ),
        ),
      ],
    ),
  );

  Widget _bookingCard(PtBooking booking) {
    final status = booking.status.toUpperCase();
    final canOpenChat =
        booking.coachId != null &&
        const {
          'CONFIRMED',
          'IN_PROGRESS',
        }.contains(status);
    final canReview = status == 'PENDING' || status == 'UPCOMING';
    final canAttend = status == 'CONFIRMED';
    final now = DateTime.now();
    final checkInOpensAt = booking.startTime?.subtract(
      const Duration(minutes: 15),
    );
    final checkInEnded =
        booking.endTime != null && now.isAfter(booking.endTime!);
    final canScanQr =
        canAttend &&
        checkInOpensAt != null &&
        booking.endTime != null &&
        !now.isBefore(checkInOpensAt) &&
        !checkInEnded;
    final statusLabel = status == 'CONFIRMED' && checkInEnded
        ? 'Đã qua giờ tập'
        : _status(status);
    final canMakeup =
        status == 'ABSENT_ELIGIBLE' &&
        booking.absenceReportedAt != null &&
        DateTime.now().isBefore(
          booking.absenceReportedAt!.add(const Duration(days: 7)),
        );
    final busy = _busyBookingId == booking.id;
    return Container(
      margin: const EdgeInsets.only(bottom: 11),
      padding: const EdgeInsets.all(16),
      decoration: _decoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.fitness_center_rounded,
                color: AuraColors.caramel,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _isCoach
                      ? (booking.memberName ?? 'Hội viên')
                      : (booking.coachName ?? 'Huấn luyện viên PT'),
                  style: const TextStyle(
                    color: AuraColors.ink,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Text(
                statusLabel,
                style: TextStyle(
                  color: status == 'IN_PROGRESS' || status == 'CONFIRMED'
                      ? checkInEnded
                            ? AuraColors.muted
                            : AuraColors.green
                      : status == 'REJECTED'
                      ? Colors.red.shade700
                      : AuraColors.caramel,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            _date(booking.startTime),
            style: const TextStyle(
              color: AuraColors.ink,
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (booking.packageName != null) ...[
            const SizedBox(height: 3),
            Text(
              booking.packageName!,
              style: const TextStyle(color: AuraColors.muted, fontSize: 12),
            ),
          ],
          if (booking.isMakeup)
            const Padding(
              padding: EdgeInsets.only(top: 5),
              child: Text(
                'Buổi học bù',
                style: TextStyle(color: AuraColors.caramel, fontSize: 11),
              ),
            ),
          if (booking.remainingSessions != null)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                'Gói còn ${booking.remainingSessions} buổi',
                style: const TextStyle(color: AuraColors.muted, fontSize: 11),
              ),
            ),
          if (canOpenChat) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (_) => PtChatScreen(
                        auth: widget.auth,
                        booking: booking,
                        isCoach: _isCoach,
                      ),
                    ),
                  );
                  if (mounted) await _load();
                },
                icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                label: Text(_isCoach ? 'Nhắn hội viên' : 'Nhắn PT'),
              ),
            ),
          ],
          if ((_isCoach &&
                  (canReview || canScanQr || status == 'IN_PROGRESS')) ||
              (!_isCoach && (canAttend || canMakeup))) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_isCoach && canReview) ...[
                  FilledButton.icon(
                    onPressed: busy
                        ? null
                        : () => _reviewBooking(booking, accept: true),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Đồng ý'),
                  ),
                  OutlinedButton.icon(
                    onPressed: busy
                        ? null
                        : () => _reviewBooking(booking, accept: false),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Từ chối'),
                  ),
                ],
                if (_isCoach && canScanQr)
                  FilledButton.icon(
                    onPressed: busy
                        ? null
                        : () async {
                            await Navigator.of(context).push<void>(
                              MaterialPageRoute(
                                builder: (_) => PtSessionQrScreen(
                                  auth: widget.auth,
                                  booking: booking,
                                ),
                              ),
                            );
                            if (mounted) await _load();
                          },
                    icon: const Icon(Icons.qr_code_rounded, size: 18),
                    label: const Text('Tạo QR buổi tập'),
                  ),
                if (_isCoach && status == 'IN_PROGRESS')
                  FilledButton.icon(
                    onPressed: busy ? null : () => _complete(booking),
                    icon: const Icon(
                      Icons.check_circle_outline_rounded,
                      size: 18,
                    ),
                    label: Text(busy ? 'Đang xử lý…' : 'Hoàn thành'),
                  ),
                if (!_isCoach && canScanQr)
                  FilledButton.icon(
                    onPressed: busy ? null : _scanSession,
                    icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                    label: const Text('Quét QR điểm danh'),
                  ),
                if (!_isCoach && canAttend)
                  OutlinedButton(
                    onPressed: busy ? null : () => _markAbsent(booking),
                    child: Text(busy ? 'Đang xử lý…' : 'Báo vắng'),
                  ),
                if (!_isCoach && canMakeup && booking.coachId != null)
                  FilledButton.icon(
                    onPressed: () => _openBooking(
                      MemberSubscription(
                        id: booking.membershipId?.toString() ?? '',
                        status: 'ACTIVE',
                        startDate: null,
                        endDate: null,
                        package: null,
                        coachId: booking.coachId,
                        coachName: booking.coachName,
                      ),
                      makeupFor: booking.id,
                      makeupDeadline: booking.absenceReportedAt!.add(
                        const Duration(days: 7),
                      ),
                    ),
                    icon: const Icon(Icons.event_repeat_rounded, size: 18),
                    label: const Text('Đặt lịch học bù'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _empty({
    required IconData icon,
    required String title,
    required String description,
    String? button,
    VoidCallback? onPressed,
  }) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(20),
    decoration: _decoration(),
    child: Column(
      children: [
        Icon(icon, size: 36, color: AuraColors.caramel),
        const SizedBox(height: 9),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AuraColors.ink,
            fontSize: 15,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          description,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AuraColors.muted, fontSize: 12),
        ),
        if (button != null && onPressed != null) ...[
          const SizedBox(height: 12),
          FilledButton(onPressed: onPressed, child: Text(button)),
        ],
      ],
    ),
  );

  BoxDecoration _decoration() => BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(18),
    border: Border.all(color: AuraColors.border),
  );
}
