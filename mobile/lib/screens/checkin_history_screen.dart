import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class CheckInHistoryScreen extends StatefulWidget {
  const CheckInHistoryScreen({super.key, required this.auth});

  final AuthService auth;

  @override
  State<CheckInHistoryScreen> createState() => _CheckInHistoryScreenState();
}

class _CheckInHistoryScreenState extends State<CheckInHistoryScreen> {
  final _scrollController = ScrollController();
  final _records = <CheckInHistoryRecord>[];
  int _nextPage = 1;
  int _total = 0;
  bool _hasMore = true;
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
    _fetchPage(reset: true);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_handleScroll)
      ..dispose();
    super.dispose();
  }

  void _handleScroll() {
    if (!_scrollController.hasClients || _isLoading || !_hasMore) return;
    if (_scrollController.position.extentAfter < 240) {
      _fetchPage(reset: false);
    }
  }

  Future<void> _fetchPage({required bool reset}) async {
    if (_isLoading) return;
    final page = reset ? 1 : _nextPage;
    setState(() {
      _isLoading = true;
      _error = null;
      if (reset) {
        _records.clear();
        _nextPage = 1;
        _hasMore = true;
      }
    });

    try {
      final result = await widget.auth.getCheckInHistory(page: page, limit: 10);
      if (!mounted) return;
      setState(() {
        _records.addAll(result.records);
        _total = result.total;
        _nextPage = result.page + 1;
        _hasMore = result.page < result.totalPages;
      });
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatDate(DateTime? value) {
    if (value == null) return 'Không rõ thời gian';
    final date = value;
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day/$month/${date.year} • $hour:$minute';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AuraColors.cream,
    appBar: AppBar(
      backgroundColor: AuraColors.espresso,
      foregroundColor: Colors.white,
      title: const Text(
        'Lịch sử điểm danh',
        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          tooltip: 'Tải lại',
          onPressed: _isLoading ? null : () => _fetchPage(reset: true),
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
                  Icons.fact_check_outlined,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Hành trình luyện tập',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '$_total lượt điểm danh được ghi nhận',
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
        Expanded(child: _buildHistoryList()),
      ],
    ),
  );

  Widget _buildHistoryList() {
    if (_isLoading && _records.isEmpty) {
      return const Center(child: AuraLoader(size: 64));
    }
    if (_error != null && _records.isEmpty) {
      return _EmptyHistory(
        icon: Icons.wifi_off_rounded,
        title: 'Chưa tải được lịch sử',
        message: _error!,
        actionLabel: 'Thử lại',
        onAction: () => _fetchPage(reset: true),
      );
    }
    if (_records.isEmpty) {
      return const _EmptyHistory(
        icon: Icons.qr_code_scanner_rounded,
        title: 'Chưa có lượt điểm danh',
        message: 'Các lượt check-in của bạn sẽ xuất hiện tại đây.',
      );
    }

    final showFooter = _hasMore || _isLoading || _error != null;
    return RefreshIndicator(
      color: AuraColors.caramel,
      onRefresh: () => _fetchPage(reset: true),
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 24),
        itemCount: _records.length + (showFooter ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _records.length) {
            if (_error != null) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Center(
                  child: TextButton.icon(
                    onPressed: () => _fetchPage(reset: false),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Tải thêm chưa thành công • Thử lại'),
                  ),
                ),
              );
            }
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: AuraLoader(size: 38)),
            );
          }
          return _CheckInRecordCard(
            record: _records[index],
            formattedDate: _formatDate(_records[index].checkInTime),
          );
        },
      ),
    );
  }
}

class _CheckInRecordCard extends StatelessWidget {
  const _CheckInRecordCard({required this.record, required this.formattedDate});

  final CheckInHistoryRecord record;
  final String formattedDate;

  @override
  Widget build(BuildContext context) {
    final successful = record.status.toUpperCase() == 'SUCCESS';
    final accent = successful ? const Color(0xFF2E8B57) : Colors.red.shade700;
    final statusLabel = successful ? 'Thành công' : 'Không thành công';
    final methodLabel = record.method.toUpperCase() == 'QR_CODE'
        ? 'Quét mã QR'
        : record.method.isEmpty
        ? 'Điểm danh'
        : record.method;

    return Container(
      margin: const EdgeInsets.only(bottom: 11),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: AuraColors.border.withValues(alpha: 0.7)),
        boxShadow: [
          BoxShadow(
            color: AuraColors.espresso.withValues(alpha: 0.055),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 43,
            height: 43,
            decoration: BoxDecoration(
              color: AuraColors.latte,
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(
              Icons.qr_code_2_rounded,
              color: AuraColors.darkCoffee,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  methodLabel,
                  style: const TextStyle(
                    color: AuraColors.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  formattedDate,
                  style: const TextStyle(
                    color: AuraColors.muted,
                    fontSize: 12,
                  ),
                ),
                if (record.packageName?.isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    record.packageName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AuraColors.muted,
                      fontSize: 11,
                    ),
                  ),
                ],
                if (!successful && record.rejectReason?.isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    record.rejectReason!,
                    style: TextStyle(color: accent, fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              statusLabel,
              style: TextStyle(
                color: accent,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 74,
            height: 74,
            decoration: const BoxDecoration(
              color: AuraColors.latte,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 34, color: AuraColors.caramel),
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
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 14),
            FilledButton(
              onPressed: onAction,
              style: FilledButton.styleFrom(
                backgroundColor: AuraColors.darkCoffee,
              ),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    ),
  );
}
