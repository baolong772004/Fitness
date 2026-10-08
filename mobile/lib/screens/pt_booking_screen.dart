import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class PtBookingScreen extends StatefulWidget {
  const PtBookingScreen({
    super.key,
    required this.auth,
    required this.subscription,
    this.originalBookingId,
    this.makeupDeadline,
  });

  final AuthService auth;
  final MemberSubscription subscription;
  final int? originalBookingId;
  final DateTime? makeupDeadline;

  @override
  State<PtBookingScreen> createState() => _PtBookingScreenState();
}

class _PtBookingScreenState extends State<PtBookingScreen> {
  static const _gymUtcOffset = Duration(hours: 7);
  late DateTime _selectedDate;
  List<PtTimeSlot> _slots = const [];
  String? _selectedStartTime;
  String? _error;
  bool _isLoading = true;
  bool _isBooking = false;

  int? get _trainerId => widget.subscription.coachId;

  @override
  void initState() {
    super.initState();
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    _selectedDate = DateTime(tomorrow.year, tomorrow.month, tomorrow.day);
    final deadline = widget.makeupDeadline;
    if (deadline != null &&
        DateUtils.dateOnly(deadline).isBefore(_selectedDate)) {
      _selectedDate = DateUtils.dateOnly(DateTime.now());
    }
    _loadSlots();
  }

  bool _canBook(PtTimeSlot slot) {
    if (!slot.isAvailable) return false;
    final deadline = widget.makeupDeadline;
    if (deadline == null) return true;
    final parts = slot.startTime.split(':');
    if (parts.length != 2) return false;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return false;
    final instant = DateTime.utc(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      hour,
      minute,
    ).subtract(_gymUtcOffset);
    return !instant.isAfter(deadline);
  }

  Future<void> _loadSlots() async {
    final trainerId = _trainerId;
    if (trainerId == null) {
      setState(() {
        _isLoading = false;
        _error = 'Gói PT chưa có huấn luyện viên được gán.';
      });
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
      _selectedStartTime = null;
    });
    try {
      final slots = await widget.auth.getPtTrainerSlots(
        trainerId: trainerId,
        date: _selectedDate,
      );
      if (mounted) setState(() => _slots = slots);
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _chooseDate() async {
    final today = DateTime.now();
    final deadlineDate = widget.makeupDeadline;
    final maxDate =
        deadlineDate == null ||
            deadlineDate.isAfter(today.add(const Duration(days: 90)))
        ? today.add(const Duration(days: 90))
        : deadlineDate;
    final selected = await showDatePicker(
      context: context,
      initialDate: _selectedDate.isBefore(today) ? today : _selectedDate,
      firstDate: DateTime(today.year, today.month, today.day),
      lastDate: DateUtils.dateOnly(maxDate),
      helpText: 'Chọn ngày tập',
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(
            context,
          ).colorScheme.copyWith(primary: AuraColors.darkCoffee),
        ),
        child: child!,
      ),
    );
    if (selected == null || !mounted) return;
    setState(() => _selectedDate = selected);
    await _loadSlots();
  }

  Future<void> _bookSelectedSlot() async {
    final trainerId = _trainerId;
    final startTime = _selectedStartTime;
    final subscriptionId = int.tryParse(widget.subscription.id);
    if (trainerId == null ||
        startTime == null ||
        (widget.originalBookingId == null && subscriptionId == null)) {
      return;
    }
    final pieces = startTime.split(':');
    if (pieces.length != 2) return;
    final hour = int.tryParse(pieces[0]);
    final minute = int.tryParse(pieces[1]);
    if (hour == null || minute == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xác nhận đặt lịch'),
        content: Text(
          'Bạn muốn tập với ${widget.subscription.coachName ?? 'HLV PT'} '
          'vào ${_formatDate(_selectedDate)} lúc $startTime?',
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
            child: const Text('Đặt lịch'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isBooking = true);
    try {
      // CoachSchedule times are configured in gym local time (UTC+07).
      final bookingDate = DateTime.utc(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
        hour,
        minute,
      ).subtract(_gymUtcOffset);
      if (widget.originalBookingId case final originalId?) {
        await widget.auth.schedulePtMakeup(
          originalBookingId: originalId,
          newBookingDate: bookingDate,
        );
      } else {
        await widget.auth.createPtBooking(
          ptSubscriptionId: subscriptionId!,
          bookingDate: bookingDate,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } on AuthApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text(error.message),
              behavior: SnackBarBehavior.floating,
            ),
          );
        await _loadSlots();
      }
    } finally {
      if (mounted) setState(() => _isBooking = false);
    }
  }

  String _formatDate(DateTime date) {
    const weekdays = [
      'Thứ Hai',
      'Thứ Ba',
      'Thứ Tư',
      'Thứ Năm',
      'Thứ Sáu',
      'Thứ Bảy',
      'Chủ Nhật',
    ];
    final weekday = weekdays[date.weekday - 1];
    return '$weekday, ${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AuraColors.cream,
    appBar: AppBar(
      backgroundColor: AuraColors.espresso,
      foregroundColor: Colors.white,
      title: const Text(
        'Lịch tập cùng PT',
        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          tooltip: 'Tải lại lịch',
          onPressed: _isLoading ? null : _loadSlots,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
    ),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(17),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AuraColors.espresso, AuraColors.darkCoffee],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.sports_gymnastics_rounded,
                    color: AuraColors.latte,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.subscription.coachName ?? 'Huấn luyện viên PT',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.subscription.package?.name ?? 'Gói PT',
                        style: const TextStyle(
                          color: Color(0xFFE8D8CF),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                if (widget.subscription.remainingSessions != null)
                  Text(
                    '${widget.subscription.remainingSessions} buổi',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Chọn ngày tập',
            style: TextStyle(
              color: AuraColors.ink,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 9),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isBooking ? null : _chooseDate,
              style: OutlinedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AuraColors.darkCoffee,
                side: const BorderSide(color: AuraColors.border),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.calendar_month_rounded),
              label: Text(
                _formatDate(_selectedDate),
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Ca còn trống',
                  style: TextStyle(
                    color: AuraColors.ink,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              if (_slots.isNotEmpty)
                Text(
                  '${_slots.where(_canBook).length} ca',
                  style: const TextStyle(
                    color: AuraColors.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 11),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: AuraLoader(size: 48)),
            )
          else if (_error != null)
            _ScheduleNotice(
              icon: Icons.wifi_off_rounded,
              text: _error!,
              onRetry: _loadSlots,
            )
          else if (_slots.where(_canBook).isEmpty)
            _ScheduleNotice(
              icon: Icons.event_busy_rounded,
              text: 'Ngày này không còn ca phù hợp. Thử chọn ngày khác nhé.',
              onRetry: _chooseDate,
            )
          else
            Wrap(
              spacing: 9,
              runSpacing: 9,
              children: _slots.map((slot) {
                final selected = _selectedStartTime == slot.startTime;
                final available = _canBook(slot);
                return ChoiceChip(
                  label: Text('${slot.startTime} – ${slot.endTime}'),
                  selected: selected,
                  onSelected: available
                      ? (_) =>
                            setState(() => _selectedStartTime = slot.startTime)
                      : null,
                  selectedColor: AuraColors.darkCoffee,
                  backgroundColor: available
                      ? Colors.white
                      : const Color(0xFFF0ECE9),
                  side: BorderSide(
                    color: selected ? AuraColors.darkCoffee : AuraColors.border,
                  ),
                  labelStyle: TextStyle(
                    color: selected
                        ? Colors.white
                        : available
                        ? AuraColors.ink
                        : AuraColors.muted,
                    fontWeight: FontWeight.w800,
                  ),
                );
              }).toList(),
            ),
          const SizedBox(height: 8),
          if (!_isLoading && _error == null && _slots.isNotEmpty)
            const Text(
              'Ca màu xám đã được đặt hoặc đã qua.',
              style: TextStyle(color: AuraColors.muted, fontSize: 11),
            ),
          const SizedBox(height: 22),
          SizedBox(
            height: 50,
            child: FilledButton.icon(
              onPressed: _selectedStartTime == null || _isBooking
                  ? null
                  : _bookSelectedSlot,
              style: FilledButton.styleFrom(
                backgroundColor: AuraColors.darkCoffee,
                disabledBackgroundColor: AuraColors.coffee.withValues(
                  alpha: 0.45,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: _isBooking
                  ? const SizedBox.square(
                      dimension: 19,
                      child: AuraLoader(size: 19, centerColor: Colors.white),
                    )
                  : const Icon(Icons.event_available_rounded),
              label: Text(
                _isBooking
                    ? 'Đang đặt lịch…'
                    : widget.originalBookingId == null
                    ? 'Xác nhận đặt lịch'
                    : 'Xác nhận lịch học bù',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ScheduleNotice extends StatelessWidget {
  const _ScheduleNotice({
    required this.icon,
    required this.text,
    required this.onRetry,
  });

  final IconData icon;
  final String text;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AuraColors.border),
    ),
    child: Column(
      children: [
        Icon(icon, color: AuraColors.caramel, size: 30),
        const SizedBox(height: 8),
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AuraColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 4),
        TextButton(onPressed: onRetry, child: const Text('Thử lại / đổi ngày')),
      ],
    ),
  );
}
