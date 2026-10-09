import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';
import 'pt_qr_screen.dart';

class GroupClassScreen extends StatefulWidget {
  const GroupClassScreen({super.key, required this.auth, this.category = ''});

  final AuthService auth;
  final String category;

  @override
  State<GroupClassScreen> createState() => _GroupClassScreenState();
}

class _GroupClassScreenState extends State<GroupClassScreen> {
  late DateTime _selectedDay;
  late String _category;
  List<GroupClassSchedule> _schedules = const [];
  List<GroupClassReservation> _reservations = const [];
  bool _loading = true;
  String? _error;
  int? _busyScheduleId;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    _selectedDay = DateTime(today.year, today.month, today.day);
    _category = widget.category.trim();
    _load();
  }

  Future<void> _load() async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final schedules = await widget.auth.getGroupClassSchedules(_selectedDay);
      final reservations = await widget.auth.getMyGroupClassReservations(
        _selectedDay,
      );
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _schedules = schedules;
        _reservations = reservations;
      });
    } on AuthApiException catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted && requestId == _requestId) {
        setState(() => _loading = false);
      }
    }
  }

  void _selectDay(DateTime day) {
    setState(() => _selectedDay = DateTime(day.year, day.month, day.day));
    _load();
  }

  Future<void> _chooseDay() async {
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, now.day - 30);
    final lastDay = DateTime(now.year, now.month, now.day + 180);
    final day = await showDatePicker(
      context: context,
      initialDate: _selectedDay,
      firstDate: firstDay,
      lastDate: lastDay,
      locale: const Locale('vi', 'VN'),
    );
    if (day != null && mounted) _selectDay(day);
  }

  GroupClassReservation? _reservationFor(int scheduleId) {
    for (final reservation in _reservations) {
      if (reservation.scheduleId == scheduleId &&
          (reservation.status == 'BOOKED' ||
              reservation.status == 'CHECKED_IN')) {
        return reservation;
      }
    }
    return null;
  }

  Future<void> _runAction(
    GroupClassSchedule schedule,
    Future<void> Function() action,
    String successMessage,
  ) async {
    if (_busyScheduleId != null) return;
    setState(() => _busyScheduleId = schedule.id);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));
      await _load();
    } on AuthApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _busyScheduleId = null);
    }
  }

  Future<void> _cancel(
    GroupClassSchedule schedule,
    GroupClassReservation reservation,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hủy đăng ký lớp?'),
        content: Text('Bạn sẽ nhường chỗ trong lớp ${schedule.name}.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Giữ chỗ'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Hủy đăng ký'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _runAction(
      schedule,
      () => widget.auth.cancelGroupClass(reservation.id),
      'Đã hủy đăng ký ${schedule.name}.',
    );
  }

  Future<void> _scanCheckIn(
    GroupClassSchedule schedule,
    GroupClassReservation reservation,
  ) async {
    final qrToken = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => const PtQrScanScreen(
          title: 'Quét QR Workclass',
          instruction: 'Quét mã QR lớp học do HLV hiển thị để điểm danh.',
        ),
      ),
    );
    if (qrToken == null || !mounted) return;
    await _runAction(
      schedule,
      () => widget.auth.checkInGroupClass(reservation.id, qrToken),
      'Đã check-in lớp ${schedule.name}.',
    );
  }

  String _date(DateTime day) =>
      '${day.day.toString().padLeft(2, '0')}/${day.month.toString().padLeft(2, '0')}';

  String _time(DateTime date) =>
      '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final firstChipDay = DateTime(today.year, today.month, today.day);
    final visibleSchedules = _category.isEmpty
        ? _schedules
        : _schedules
              .where(
                (schedule) => schedule.name.toLowerCase().contains(
                  _category.toLowerCase(),
                ),
              )
              .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Workout Class')),
      body: RefreshIndicator(
        color: AuraColors.coffee,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 30),
          children: [
            Container(
              padding: const EdgeInsets.all(21),
              decoration: BoxDecoration(
                color: AuraColors.darkCoffee,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.groups_rounded, color: Colors.white, size: 32),
                  SizedBox(height: 13),
                  Text(
                    'Lớp học nhóm',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 25,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  SizedBox(height: 5),
                  Text(
                    'Chọn ngày, giữ chỗ và check-in cho buổi tập của bạn.',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Lịch ngày ${_date(_selectedDay)}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AuraColors.ink,
                    ),
                  ),
                ),
                TextButton.icon(
                  onPressed: _chooseDay,
                  icon: const Icon(Icons.calendar_month_rounded, size: 18),
                  label: const Text('Chọn ngày'),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 74,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: 7,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final day = DateTime(
                    firstChipDay.year,
                    firstChipDay.month,
                    firstChipDay.day + index,
                  );
                  final selected =
                      day.year == _selectedDay.year &&
                      day.month == _selectedDay.month &&
                      day.day == _selectedDay.day;
                  return InkWell(
                    onTap: () => _selectDay(day),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 62,
                      decoration: BoxDecoration(
                        color: selected ? AuraColors.coffee : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: selected
                              ? AuraColors.coffee
                              : AuraColors.border,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            [
                              'CN',
                              'T2',
                              'T3',
                              'T4',
                              'T5',
                              'T6',
                              'T7',
                            ][day.weekday % 7],
                            style: TextStyle(
                              fontSize: 11,
                              color: selected
                                  ? Colors.white70
                                  : AuraColors.muted,
                            ),
                          ),
                          Text(
                            '${day.day}',
                            style: TextStyle(
                              fontSize: 21,
                              fontWeight: FontWeight.w900,
                              color: selected ? Colors.white : AuraColors.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            if (_category.isNotEmpty) ...[
              const SizedBox(height: 14),
              InputChip(
                label: Text('Đang lọc: $_category'),
                onDeleted: () => setState(() => _category = ''),
              ),
            ],
            const SizedBox(height: 20),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: AuraLoader(size: 48)),
              )
            else if (_error != null)
              _messageCard(
                Icons.wifi_off_rounded,
                'Chưa tải được lịch lớp',
                _error!,
                onRetry: _load,
              )
            else if (visibleSchedules.isEmpty)
              _messageCard(
                Icons.event_busy_rounded,
                'Chưa có lớp trong ngày này',
                _category.isEmpty
                    ? 'Chọn ngày khác để xem các lớp sắp mở.'
                    : 'Bỏ bộ lọc để xem mọi lớp trong ngày.',
              )
            else
              for (final schedule in visibleSchedules) ...[
                _scheduleCard(schedule),
                const SizedBox(height: 13),
              ],
          ],
        ),
      ),
    );
  }

  Widget _messageCard(
    IconData icon,
    String title,
    String detail, {
    VoidCallback? onRetry,
  }) => Container(
    padding: const EdgeInsets.all(25),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: AuraColors.border),
    ),
    child: Column(
      children: [
        Icon(icon, color: AuraColors.caramel, size: 38),
        const SizedBox(height: 12),
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
        const SizedBox(height: 5),
        Text(
          detail,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AuraColors.muted),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ],
    ),
  );

  Widget _scheduleCard(GroupClassSchedule schedule) {
    final reservation = _reservationFor(schedule.id);
    final now = DateTime.now();
    final started = !schedule.startTime.isAfter(now);
    final ended = !schedule.endTime.isAfter(now);
    final canCheckIn = now.isAfter(schedule.startTime.subtract(const Duration(minutes: 15))) && !ended;
    final full = schedule.status == 'FULL' || schedule.availableSpots == 0;
    final canCancel =
        reservation?.status == 'BOOKED' &&
        schedule.startTime.difference(now) >= const Duration(hours: 2);
    final busy = _busyScheduleId != null;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: AuraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (schedule.imageUrl != null && schedule.imageUrl!.isNotEmpty)
            Image.network(
              schedule.imageUrl!,
              height: 126,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const SizedBox.shrink(),
            ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        schedule.name,
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          color: AuraColors.ink,
                        ),
                      ),
                    ),
                    if (reservation != null)
                      Chip(
                        label: Text(
                          reservation.status == 'CHECKED_IN'
                              ? 'Đã check-in'
                              : 'Đã đặt',
                        ),
                      ),
                  ],
                ),
                if (schedule.description != null &&
                    schedule.description!.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    schedule.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AuraColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
                const SizedBox(height: 13),
                _detail(
                  Icons.schedule_rounded,
                  '${_time(schedule.startTime)} – ${_time(schedule.endTime)} · ${_date(schedule.startTime)}',
                ),
                _detail(
                  Icons.person_rounded,
                  schedule.trainerName ?? 'Huấn luyện viên',
                ),
                _detail(
                  Icons.meeting_room_rounded,
                  schedule.roomName ?? 'Phòng tập nhóm',
                ),
                _detail(
                  Icons.people_alt_rounded,
                  'Còn ${schedule.availableSpots}/${schedule.capacity} chỗ',
                ),
                const SizedBox(height: 13),
                if (reservation == null)
                  FilledButton(
                    onPressed: busy || started || full
                        ? null
                        : () => _runAction(
                            schedule,
                            () => widget.auth.bookGroupClass(schedule.id),
                            'Đã đặt chỗ lớp ${schedule.name}.',
                          ),
                    child: Text(
                      started
                          ? 'Lớp đã bắt đầu'
                          : full
                          ? 'Đã hết chỗ'
                          : 'Đặt chỗ tham gia',
                    ),
                  )
                else if (reservation.status == 'BOOKED') ...[
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: busy || !canCancel
                              ? null
                              : () => _cancel(schedule, reservation),
                          child: const Text('Hủy đăng ký'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: FilledButton(
                          onPressed: busy || !canCheckIn
                              ? null
                              : () => _scanCheckIn(schedule, reservation),
                          child: const Text('Quét QR điểm danh'),
                        ),
                      ),
                    ],
                  ),
                  if (!canCheckIn && !ended)
                    const Padding(
                      padding: EdgeInsets.only(top: 7),
                      child: Text(
                        'QR điểm danh mở từ 15 phút trước giờ học.',
                        style: TextStyle(fontSize: 11, color: AuraColors.muted),
                      ),
                    ),
                  if (!canCancel)
                    const Padding(
                      padding: EdgeInsets.only(top: 7),
                      child: Text(
                        'Chỉ có thể hủy trước giờ học ít nhất 2 tiếng.',
                        style: TextStyle(fontSize: 11, color: AuraColors.muted),
                      ),
                    ),
                ] else
                  const Text(
                    'Bạn đã check-in cho lớp này.',
                    style: TextStyle(
                      color: AuraColors.green,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detail(IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(top: 7),
    child: Row(
      children: [
        Icon(icon, size: 16, color: AuraColors.caramel),
        const SizedBox(width: 7),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 12, color: AuraColors.ink),
          ),
        ),
      ],
    ),
  );
}
