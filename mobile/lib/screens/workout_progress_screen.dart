import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';

class WorkoutProgressScreen extends StatefulWidget {
  const WorkoutProgressScreen({
    super.key,
    required this.auth,
    this.plansOnly = false,
  });

  final AuthService auth;
  final bool plansOnly;

  @override
  State<WorkoutProgressScreen> createState() => _WorkoutProgressScreenState();
}

class _WorkoutProgressScreenState extends State<WorkoutProgressScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _inBody = [];
  List<Map<String, dynamic>> _workouts = [];
  List<Map<String, dynamic>> _plans = [];
  String _metric = 'weight';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final result = await widget.auth.getMemberWorkoutProgress();
      if (!mounted) return;
      setState(() {
        _inBody = _mapList(result['inbodyLogs']);
        _workouts = _mapList(result['workoutLogs']);
        _plans = _mapList(result['plans']);
        _loading = false;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Không tải được tiến độ. Vui lòng thử lại.';
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> _mapList(Object? value) => value is List
      ? value
            .whereType<Map>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList()
      : <Map<String, dynamic>>[];

  double? _number(Object? value) =>
      value == null ? null : double.tryParse(value.toString());

  DateTime? _date(Object? value) =>
      DateTime.tryParse(value?.toString() ?? '')?.toLocal();

  String _dateLabel(DateTime? value) {
    if (value == null) return 'Chưa có ngày';
    return '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
  }

  String _timeLabel(DateTime? value) {
    if (value == null) return 'Buổi tập';
    return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')} · ${_dateLabel(value)}';
  }

  String _metricUnit(String key) => key == 'bodyFat' ? '%' : 'kg';

  String _formatMetric(double? value, String key) =>
      value == null ? '—' : '${value.toStringAsFixed(1)} ${_metricUnit(key)}';

  double? _change(String key) {
    if (_inBody.length < 2) return null;
    final latest = _number(_inBody.first[key]);
    final previous = _number(_inBody[1][key]);
    if (latest == null || previous == null) return null;
    return latest - previous;
  }

  List<Map<String, dynamic>> get _chronologicalInBody =>
      _inBody.reversed.toList();

  @override
  Widget build(BuildContext context) {
    final latest = _inBody.isEmpty ? null : _inBody.first;
    return Scaffold(
      backgroundColor: AuraColors.cream,
      appBar: AppBar(
        backgroundColor: AuraColors.espresso,
        foregroundColor: Colors.white,
        title: Text(
          widget.plansOnly ? 'Giáo án & Dinh dưỡng' : 'Tiến độ tập luyện',
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading && _inBody.isEmpty && _workouts.isEmpty && _plans.isEmpty
          ? const Center(
              child: CircularProgressIndicator(color: AuraColors.caramel),
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AuraColors.caramel,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 36),
                children: [
                  if (!widget.plansOnly)
                    _ProgressHero(
                      memberName: widget.auth.currentMember?.name ?? 'Hội viên',
                      measurementCount: _inBody.length,
                      workoutCount: _workouts.length,
                      latestDate: _dateLabel(_date(latest?['loggedAt'])),
                    ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    _ErrorCard(message: _error!, onRetry: _load),
                  ],
                  const SizedBox(height: 20),
                  _sectionHeader(
                    icon: Icons.menu_book_rounded,
                    title: 'Giáo án & Dinh dưỡng',
                    subtitle:
                        'Kế hoạch tập luyện và ăn uống Coach dành cho bạn',
                  ),
                  const SizedBox(height: 12),
                  if (_plans.isEmpty)
                    const _EmptyCard(
                      icon: Icons.restaurant_menu_rounded,
                      title: 'Chưa có kế hoạch',
                      message:
                          'Coach sẽ gửi giáo án và thực đơn cho bạn tại đây.',
                    )
                  else
                    ..._plans.map(
                      (plan) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _MemberPlanCard(plan: plan),
                      ),
                    ),
                  if (!widget.plansOnly) ...[
                    const SizedBox(height: 28),
                    _sectionHeader(
                      icon: Icons.monitor_weight_outlined,
                      title: 'Chỉ số InBody',
                      subtitle: 'Theo dõi thay đổi cơ thể qua từng lần đo',
                    ),
                    const SizedBox(height: 12),
                    _InBodySummary(
                      latest: latest,
                      loggedAt: _date(latest?['loggedAt']),
                      formatMetric: _formatMetric,
                      change: _change,
                    ),
                    const SizedBox(height: 12),
                    if (_inBody.isEmpty)
                      const _EmptyCard(
                        icon: Icons.insights_rounded,
                        title: 'Chưa có dữ liệu InBody',
                        message:
                            'Khi Coach hoặc nhân viên ghi nhận chỉ số mới, biểu đồ tiến độ sẽ xuất hiện tại đây.',
                      )
                    else
                      _InBodyChartCard(
                        logs: _chronologicalInBody,
                        metric: _metric,
                        onMetricChanged: (value) =>
                            setState(() => _metric = value),
                        dateLabel: _dateLabel,
                        dateParser: _date,
                      ),
                    const SizedBox(height: 28),
                    _sectionHeader(
                      icon: Icons.fitness_center_rounded,
                      title: 'Nhật ký buổi tập',
                      subtitle: 'Các buổi PT hoàn thành gần đây',
                    ),
                    const SizedBox(height: 12),
                    if (_workouts.isEmpty)
                      const _EmptyCard(
                        icon: Icons.event_note_rounded,
                        title: 'Chưa có nhật ký buổi tập',
                        message:
                            'Giáo án, ghi chú và kết quả sẽ được hiển thị sau khi Coach hoàn tất buổi PT.',
                      )
                    else
                      ..._workouts.map(
                        (workout) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _WorkoutLogCard(
                            workout: workout,
                            dateLabel: _timeLabel(_date(workout['startTime'])),
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _sectionHeader({
    required IconData icon,
    required String title,
    required String subtitle,
  }) => Row(
    children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AuraColors.latte,
          borderRadius: BorderRadius.circular(13),
        ),
        child: Icon(icon, color: AuraColors.darkCoffee, size: 21),
      ),
      const SizedBox(width: 11),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: AuraColors.ink,
                fontSize: 17,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(color: AuraColors.muted, fontSize: 11),
            ),
          ],
        ),
      ),
    ],
  );
}

List<Map<String, dynamic>> _planRows(Object? value) => value is List
    ? value
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList()
    : <Map<String, dynamic>>[];

String _planDay(Object? value) {
  const days = [
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
    'Chủ Nhật',
  ];
  final day = int.tryParse(value?.toString() ?? '');
  return day != null && day >= 1 && day <= 7 ? days[day - 1] : 'Ngày tập';
}

String _mealName(Object? value) => switch (value) {
  'BREAKFAST' => 'Bữa sáng',
  'LUNCH' => 'Bữa trưa',
  'DINNER' => 'Bữa tối',
  'SNACK' => 'Bữa phụ',
  _ => 'Bữa ăn',
};

class _MemberPlanCard extends StatelessWidget {
  const _MemberPlanCard({required this.plan});
  final Map<String, dynamic> plan;

  @override
  Widget build(BuildContext context) {
    final sessions = _planRows(plan['sessions']);
    final mealDays = _planRows(plan['mealDays']);
    final coach = plan['coach'];
    final coachName = coach is Map ? coach['fullName']?.toString() : null;
    final createdAt = DateTime.tryParse(
      plan['createdAt']?.toString() ?? '',
    )?.toLocal();
    final createdLabel = createdAt == null
        ? ''
        : '${createdAt.day.toString().padLeft(2, '0')}/${createdAt.month.toString().padLeft(2, '0')}/${createdAt.year}';
    final description = plan['description']?.toString().trim() ?? '';
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AuraColors.border),
      ),
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        title: Text(
          plan['title']?.toString() ?? 'Giáo án',
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            color: AuraColors.ink,
          ),
        ),
        subtitle: Text(
          [
            if (coachName != null) 'Coach $coachName',
            if (createdLabel.isNotEmpty) createdLabel,
            '${sessions.length} buổi tập · ${mealDays.length} ngày ăn',
          ].join(' · '),
          style: const TextStyle(fontSize: 11, color: AuraColors.muted),
        ),
        children: [
          if (description.isNotEmpty) _planNote('Lưu ý chung', description),
          if (sessions.isNotEmpty) ...[
            const _PlanSectionTitle(
              icon: Icons.fitness_center_rounded,
              title: 'Bài tập theo buổi',
            ),
            ...sessions.asMap().entries.map(
              (entry) => _planBlock(
                '${_planDay(entry.value['dayOfWeek'])} · Buổi ${entry.key + 1}: ${entry.value['title'] ?? ''}',
                [
                  if ((entry.value['notes']?.toString() ?? '').isNotEmpty)
                    _planNote('Coach lưu ý', entry.value['notes'].toString()),
                  ..._planRows(entry.value['exercises']).map(
                    (exercise) => Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            exercise['exerciseName']?.toString() ?? '',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AuraColors.ink,
                            ),
                          ),
                          Text(
                            '${exercise['sets'] ?? '—'} hiệp × ${exercise['reps'] ?? '—'} lần'
                            '${exercise['weightKg'] == null ? '' : ' · ${exercise['weightKg']} kg'}',
                            style: const TextStyle(
                              color: AuraColors.darkCoffee,
                              fontSize: 12,
                            ),
                          ),
                          if ((exercise['notes']?.toString() ?? '').isNotEmpty)
                            Text(
                              exercise['notes'].toString(),
                              style: const TextStyle(
                                color: AuraColors.muted,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (mealDays.isNotEmpty) ...[
            const _PlanSectionTitle(
              icon: Icons.restaurant_rounded,
              title: 'Thực đơn theo ngày',
            ),
            ...mealDays.map(
              (day) => _planBlock(_planDay(day['dayOfWeek']), [
                if ((day['notes']?.toString() ?? '').isNotEmpty)
                  _planNote('Coach lưu ý', day['notes'].toString()),
                ..._planRows(day['meals']).map(
                  (meal) => Padding(
                    padding: const EdgeInsets.only(top: 9),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_mealName(meal['mealType'])}${(meal['time']?.toString() ?? '').isEmpty ? '' : ' · ${meal['time']}'}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AuraColors.darkCoffee,
                          ),
                        ),
                        Text(
                          '${meal['food'] ?? ''} · ${meal['portion'] ?? ''}'
                          '${meal['calories'] == null ? '' : ' · ${meal['calories']} kcal'}',
                          style: const TextStyle(
                            color: AuraColors.ink,
                            fontSize: 12,
                          ),
                        ),
                        if ((meal['notes']?.toString() ?? '').isNotEmpty)
                          Text(
                            meal['notes'].toString(),
                            style: const TextStyle(
                              color: AuraColors.muted,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ]),
            ),
          ],
          if (sessions.isEmpty && mealDays.isEmpty && description.isEmpty)
            const Text(
              'Coach chưa thêm nội dung chi tiết.',
              style: TextStyle(color: AuraColors.muted),
            ),
        ],
      ),
    );
  }

  Widget _planBlock(String title, List<Widget> children) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(top: 9),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AuraColors.cream,
      borderRadius: BorderRadius.circular(13),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            color: AuraColors.ink,
          ),
        ),
        ...children,
      ],
    ),
  );

  Widget _planNote(String label, String value) => Padding(
    padding: const EdgeInsets.only(top: 7),
    child: Text(
      '$label: $value',
      style: const TextStyle(color: AuraColors.muted, fontSize: 12),
    ),
  );
}

class _PlanSectionTitle extends StatelessWidget {
  const _PlanSectionTitle({required this.icon, required this.title});
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 17, bottom: 2),
    child: Row(
      children: [
        Icon(icon, size: 17, color: AuraColors.caramel),
        const SizedBox(width: 7),
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            color: AuraColors.ink,
          ),
        ),
      ],
    ),
  );
}

class _ProgressHero extends StatelessWidget {
  const _ProgressHero({
    required this.memberName,
    required this.measurementCount,
    required this.workoutCount,
    required this.latestDate,
  });

  final String memberName;
  final int measurementCount;
  final int workoutCount;
  final String latestDate;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(23),
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          AuraColors.caramel,
          AuraColors.darkCoffee,
          AuraColors.espresso,
        ],
      ),
      boxShadow: [
        BoxShadow(
          color: AuraColors.espresso.withValues(alpha: 0.16),
          blurRadius: 18,
          offset: const Offset(0, 8),
        ),
      ],
    ),
    child: Stack(
      children: [
        Positioned(
          right: -12,
          top: -20,
          child: Icon(
            Icons.insights_rounded,
            size: 120,
            color: Colors.white.withValues(alpha: 0.08),
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(
                  Icons.auto_awesome_rounded,
                  color: Color(0xFFFFC18E),
                  size: 16,
                ),
                SizedBox(width: 7),
                Text(
                  'HÀNH TRÌNH CỦA BẠN',
                  style: TextStyle(
                    color: Color(0xFFFFD6B4),
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Tiến bộ mỗi ngày,\n${memberName.trim().isEmpty ? 'bứt phá mục tiêu' : memberName}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                height: 1.15,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HeroStat(
                  icon: Icons.monitor_weight_outlined,
                  label: '$measurementCount lần đo',
                ),
                _HeroStat(
                  icon: Icons.fitness_center_rounded,
                  label: '$workoutCount buổi PT',
                ),
                _HeroStat(
                  icon: Icons.calendar_today_rounded,
                  label: latestDate,
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  );
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(30),
      border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: const Color(0xFFFFC18E), size: 13),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _InBodySummary extends StatelessWidget {
  const _InBodySummary({
    required this.latest,
    required this.loggedAt,
    required this.formatMetric,
    required this.change,
  });

  final Map<String, dynamic>? latest;
  final DateTime? loggedAt;
  final String Function(double?, String) formatMetric;
  final double? Function(String) change;

  @override
  Widget build(BuildContext context) {
    const metrics = [
      ('weight', 'Cân nặng', Icons.monitor_weight_outlined),
      ('bodyFat', 'Mỡ cơ thể', Icons.water_drop_outlined),
      ('muscleMass', 'Khối lượng cơ', Icons.fitness_center_rounded),
    ];
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AuraColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(3, 0, 3, 10),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'LẦN ĐO GẦN NHẤT',
                    style: TextStyle(
                      color: AuraColors.muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                if (loggedAt != null)
                  Text(
                    '${loggedAt!.day.toString().padLeft(2, '0')}/${loggedAt!.month.toString().padLeft(2, '0')}/${loggedAt!.year}',
                    style: const TextStyle(
                      color: AuraColors.muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ),
          Row(
            children: metrics.map((metric) {
              final value = latest == null
                  ? null
                  : _asDouble(latest![metric.$1]);
              final delta = change(metric.$1);
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(
                    right: metric == metrics.last ? 0 : 7,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBF6),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(metric.$3, color: AuraColors.caramel, size: 17),
                      const SizedBox(height: 7),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          formatMetric(value, metric.$1),
                          style: const TextStyle(
                            color: AuraColors.darkCoffee,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        metric.$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AuraColors.muted,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (delta != null) ...[
                        const SizedBox(height: 6),
                        _ChangePill(
                          value: delta,
                          unit: metric.$1 == 'bodyFat' ? '%' : 'kg',
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

double? _asDouble(Object? value) =>
    value == null ? null : double.tryParse(value.toString());

class _ChangePill extends StatelessWidget {
  const _ChangePill({required this.value, required this.unit});
  final double value;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final positive = value > 0;
    final color = value == 0
        ? AuraColors.muted
        : (positive ? AuraColors.caramel : AuraColors.green);
    final icon = value == 0
        ? Icons.remove_rounded
        : (positive ? Icons.trending_up_rounded : Icons.trending_down_rounded);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 2),
        Flexible(
          child: Text(
            '${value > 0 ? '+' : ''}${value.toStringAsFixed(1)} $unit',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: color,
              fontSize: 9,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}

class _InBodyChartCard extends StatelessWidget {
  const _InBodyChartCard({
    required this.logs,
    required this.metric,
    required this.onMetricChanged,
    required this.dateLabel,
    required this.dateParser,
  });

  final List<Map<String, dynamic>> logs;
  final String metric;
  final ValueChanged<String> onMetricChanged;
  final String Function(DateTime?) dateLabel;
  final DateTime? Function(Object?) dateParser;

  @override
  Widget build(BuildContext context) {
    final values = logs.map((log) => _asDouble(log[metric])).toList();
    final lastValue = values.isEmpty ? null : values.last;
    final label = switch (metric) {
      'bodyFat' => 'Mỡ cơ thể',
      'muscleMass' => 'Khối lượng cơ',
      _ => 'Cân nặng',
    };
    final unit = metric == 'bodyFat' ? '%' : 'kg';
    return Container(
      padding: const EdgeInsets.fromLTRB(15, 15, 15, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: AuraColors.border),
        boxShadow: [
          BoxShadow(
            color: AuraColors.espresso.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AuraColors.ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${logs.length} lần đo được ghi nhận',
                      style: const TextStyle(
                        color: AuraColors.muted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              if (lastValue != null)
                Text(
                  '${lastValue.toStringAsFixed(1)} $unit',
                  style: const TextStyle(
                    color: AuraColors.darkCoffee,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 7,
            children: [
              _MetricChip(
                label: 'Cân nặng',
                value: 'weight',
                selected: metric == 'weight',
                onTap: onMetricChanged,
              ),
              _MetricChip(
                label: 'Mỡ',
                value: 'bodyFat',
                selected: metric == 'bodyFat',
                onTap: onMetricChanged,
              ),
              _MetricChip(
                label: 'Cơ',
                value: 'muscleMass',
                selected: metric == 'muscleMass',
                onTap: onMetricChanged,
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 160,
            width: double.infinity,
            child: CustomPaint(painter: _InBodyChartPainter(values: values)),
          ),
          const SizedBox(height: 7),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                dateLabel(dateParser(logs.first['loggedAt'])),
                style: const TextStyle(color: AuraColors.muted, fontSize: 9),
              ),
              Text(
                dateLabel(dateParser(logs.last['loggedAt'])),
                style: const TextStyle(color: AuraColors.muted, fontSize: 9),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.label,
    required this.value,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final String value;
  final bool selected;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(30),
    onTap: () => onTap(value),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: selected ? AuraColors.darkCoffee : AuraColors.cream,
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: selected ? Colors.white : AuraColors.muted,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
  );
}

class _InBodyChartPainter extends CustomPainter {
  _InBodyChartPainter({required this.values});
  final List<double?> values;

  @override
  void paint(Canvas canvas, Size size) {
    const left = 8.0;
    const right = 8.0;
    const top = 12.0;
    const bottom = 12.0;
    final chart = Rect.fromLTRB(
      left,
      top,
      size.width - right,
      size.height - bottom,
    );
    final grid = Paint()
      ..color = AuraColors.border.withValues(alpha: 0.75)
      ..strokeWidth = 1;
    for (var index = 0; index < 4; index++) {
      final y = chart.top + chart.height * index / 3;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), grid);
    }
    final points = values
        .asMap()
        .entries
        .where((entry) => entry.value != null)
        .toList();
    if (points.isEmpty) return;
    final numeric = points.map((entry) => entry.value!).toList();
    var minValue = numeric.reduce(math.min);
    var maxValue = numeric.reduce(math.max);
    if ((maxValue - minValue).abs() < 0.1) {
      minValue -= 1;
      maxValue += 1;
    } else {
      final pad = (maxValue - minValue) * 0.18;
      minValue -= pad;
      maxValue += pad;
    }
    Offset pointAt(int sourceIndex, double value) {
      final x = values.length <= 1
          ? chart.center.dx
          : chart.left + chart.width * sourceIndex / (values.length - 1);
      final y =
          chart.bottom -
          ((value - minValue) / (maxValue - minValue)) * chart.height;
      return Offset(x, y);
    }

    final coords = points
        .map((entry) => pointAt(entry.key, entry.value!))
        .toList();
    if (coords.length == 1) {
      canvas.drawCircle(
        coords.first,
        22,
        Paint()..color = AuraColors.caramel.withValues(alpha: 0.08),
      );
      canvas.drawCircle(coords.first, 7, Paint()..color = AuraColors.caramel);
      canvas.drawCircle(coords.first, 3, Paint()..color = Colors.white);
      return;
    }
    final line = Path()..moveTo(coords.first.dx, coords.first.dy);
    for (var index = 1; index < coords.length; index++) {
      line.lineTo(coords[index].dx, coords[index].dy);
    }
    final fill = Path.from(line)
      ..lineTo(coords.last.dx, chart.bottom)
      ..lineTo(coords.first.dx, chart.bottom)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AuraColors.caramel.withValues(alpha: 0.22),
            AuraColors.caramel.withValues(alpha: 0.01),
          ],
        ).createShader(chart),
    );
    canvas.drawPath(
      line,
      Paint()
        ..color = AuraColors.caramel
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke,
    );
    for (final point in coords) {
      canvas.drawCircle(point, 6, Paint()..color = Colors.white);
      canvas.drawCircle(point, 4, Paint()..color = AuraColors.caramel);
    }
  }

  @override
  bool shouldRepaint(covariant _InBodyChartPainter oldDelegate) =>
      oldDelegate.values != values;
}

class _WorkoutLogCard extends StatelessWidget {
  const _WorkoutLogCard({required this.workout, required this.dateLabel});
  final Map<String, dynamic> workout;
  final String dateLabel;

  Map<String, dynamic>? _map(Object? value) =>
      value is Map ? Map<String, dynamic>.from(value) : null;

  @override
  Widget build(BuildContext context) {
    final result = _map(workout['sessionResult']);
    final coach = _map(workout['coach']);
    final exercises = result?['exercises'] is List
        ? (result!['exercises'] as List)
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
        : <Map<String, dynamic>>[];
    final notes = result?['notes']?.toString().trim() ?? '';
    final duration = int.tryParse(result?['durationMin']?.toString() ?? '');
    final calories = int.tryParse(result?['calories']?.toString() ?? '');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AuraColors.border),
        boxShadow: [
          BoxShadow(
            color: AuraColors.espresso.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
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
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AuraColors.latte,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.fitness_center_rounded,
                  color: AuraColors.darkCoffee,
                  size: 19,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      dateLabel,
                      style: const TextStyle(
                        color: AuraColors.ink,
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Coach ${coach?['fullName'] ?? 'AURA'}',
                      style: const TextStyle(
                        color: AuraColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F4EA),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'HOÀN THÀNH',
                  style: TextStyle(
                    color: AuraColors.green,
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          if (duration != null || calories != null) ...[
            const SizedBox(height: 13),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (duration != null)
                  _WorkoutMeta(
                    icon: Icons.schedule_rounded,
                    label: '$duration phút',
                  ),
                if (calories != null)
                  _WorkoutMeta(
                    icon: Icons.local_fire_department_outlined,
                    label: '$calories kcal',
                  ),
              ],
            ),
          ],
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 13),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AuraColors.cream,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                notes,
                style: const TextStyle(
                  color: AuraColors.ink,
                  fontSize: 12,
                  height: 1.55,
                ),
              ),
            ),
          ],
          if (exercises.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Text(
              'GIÁO ÁN',
              style: TextStyle(
                color: AuraColors.darkCoffee,
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 7),
            ...exercises.map((exercise) {
              final name = exercise['exerciseName']?.toString() ?? 'Bài tập';
              final sets = exercise['sets']?.toString() ?? '—';
              final reps = exercise['reps']?.toString() ?? '—';
              final weight = _asDouble(exercise['weightKg']);
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_rounded,
                      size: 15,
                      color: AuraColors.caramel,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        name,
                        style: const TextStyle(
                          color: AuraColors.ink,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      '$sets × $reps${weight == null ? '' : ' · ${weight.toStringAsFixed(1)} kg'}',
                      style: const TextStyle(
                        color: AuraColors.muted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
          if (notes.isEmpty &&
              exercises.isEmpty &&
              duration == null &&
              calories == null)
            const Padding(
              padding: EdgeInsets.only(top: 13),
              child: Text(
                'Coach chưa thêm ghi chú cho buổi tập này.',
                style: TextStyle(
                  color: AuraColors.muted,
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _WorkoutMeta extends StatelessWidget {
  const _WorkoutMeta({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
    decoration: BoxDecoration(
      color: AuraColors.cream,
      borderRadius: BorderRadius.circular(9),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AuraColors.caramel),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            color: AuraColors.darkCoffee,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AuraColors.border),
    ),
    child: Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AuraColors.latte,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: AuraColors.darkCoffee, size: 24),
        ),
        const SizedBox(height: 11),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AuraColors.ink,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AuraColors.muted,
            fontSize: 11,
            height: 1.5,
          ),
        ),
      ],
    ),
  );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF0EC),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0xFFEEC4B8)),
    ),
    child: Row(
      children: [
        const Icon(Icons.error_outline_rounded, color: AuraColors.caramel),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(
              color: AuraColors.darkCoffee,
              fontSize: 12,
              height: 1.4,
            ),
          ),
        ),
        TextButton(onPressed: onRetry, child: const Text('Thử lại')),
      ],
    ),
  );
}
