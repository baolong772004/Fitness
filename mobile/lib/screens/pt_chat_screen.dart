import 'dart:async';

import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/pt_chat_live_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class PtChatScreen extends StatefulWidget {
  const PtChatScreen({
    super.key,
    required this.auth,
    required this.booking,
    required this.isCoach,
  });

  final AuthService auth;
  final PtBooking booking;
  final bool isCoach;

  @override
  State<PtChatScreen> createState() => _PtChatScreenState();
}

class _PtChatScreenState extends State<PtChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  late final PtChatLiveService _live = PtChatLiveService(widget.auth);
  List<PtChatMessage> _messages = const [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _syncing = false;
  bool _sending = false;
  bool _hasMore = false;
  bool _canSend = false;
  bool _connected = false;
  bool _closed = false;
  int? _lastFetchedId;
  String? _error;
  Timer? _chatCloseTimer;

  bool get _beforeEnd => widget.booking.endTime != null &&
      DateTime.now().isBefore(widget.booking.endTime!);

  int get _myId => int.tryParse(widget.auth.currentMember?.id ?? '') ?? 0;
  String get _otherName => widget.isCoach
      ? widget.booking.memberName ?? 'Hội viên'
      : widget.booking.coachName ?? 'Huấn luyện viên PT';

  @override
  void initState() {
    super.initState();
    final endTime = widget.booking.endTime;
    if (endTime != null && endTime.isAfter(DateTime.now())) {
      _chatCloseTimer = Timer(endTime.difference(DateTime.now()), () {
        if (mounted) setState(() => _canSend = false);
      });
    }
    unawaited(_loadLatest());
    _live.connect(
      bookingId: widget.booking.id,
      onMessage: _addMessage,
      onConnected: () {
        if (!mounted) return;
        setState(() => _connected = true);
        unawaited(_syncNew());
      },
      onDisconnected: () {
        if (mounted) setState(() => _connected = false);
      },
      onClosed: _closeBecauseFinished,
      onError: (message) {
        if (_isCompletedError(message)) {
          _closeBecauseFinished();
          return;
        }
        if (mounted) setState(() => _connected = false);
      },
    );
  }

  @override
  void dispose() {
    _chatCloseTimer?.cancel();
    _live.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  bool _isCompletedError(String message) =>
      message.contains('Lịch PT đã hoàn thành');

  void _closeBecauseFinished() {
    if (!mounted || _closed) return;
    _closed = true;
    _live.dispose();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Lịch PT đã hoàn thành. Chat đã được đóng.')),
    );
    Navigator.of(context).pop();
  }

  void _mergeMessages(Iterable<PtChatMessage> incoming) {
    final byId = <int, PtChatMessage>{
      for (final message in _messages) message.id: message,
      for (final message in incoming) message.id: message,
    };
    _messages = byId.values.toList()..sort((a, b) => a.id.compareTo(b.id));
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _loadLatest() async {
    try {
      final page = await widget.auth.getPtChatMessages(widget.booking.id);
      if (!mounted) return;
      setState(() {
        _mergeMessages(page.messages);
        if (page.messages.isNotEmpty &&
            (_lastFetchedId == null ||
                page.messages.last.id > _lastFetchedId!)) {
          _lastFetchedId = page.messages.last.id;
        }
        _hasMore = page.hasMore;
        _canSend = page.canSend && _beforeEnd;
        _error = null;
        _loading = false;
      });
      _scrollToBottom();
    } on AuthApiException catch (error) {
      if (!mounted) return;
      if (_isCompletedError(error.message)) {
        _closeBecauseFinished();
        return;
      }
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadOlder() async {
    if (_loadingMore || !_hasMore || _messages.isEmpty) return;
    setState(() => _loadingMore = true);
    try {
      final page = await widget.auth.getPtChatMessages(
        widget.booking.id,
        beforeId: _messages.first.id,
      );
      if (!mounted) return;
      setState(() {
        _mergeMessages(page.messages);
        _hasMore = page.hasMore;
        _canSend = page.canSend && _beforeEnd;
      });
    } on AuthApiException catch (error) {
      if (_isCompletedError(error.message)) {
        _closeBecauseFinished();
        return;
      }
      if (mounted) _notice(error.message);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _syncNew() async {
    if (_syncing) return;
    if (_lastFetchedId == null) {
      await _loadLatest();
      return;
    }
    _syncing = true;
    try {
      var cursor = _lastFetchedId!;
      while (mounted) {
        final page = await widget.auth.getPtChatMessages(
          widget.booking.id,
          afterId: cursor,
        );
        if (!mounted) return;
        setState(() {
          _mergeMessages(page.messages);
          _canSend = page.canSend && _beforeEnd;
        });
        if (page.messages.isNotEmpty) {
          cursor = page.messages.last.id;
          _lastFetchedId = cursor;
          _scrollToBottom();
        }
        if (!page.hasMore || page.messages.isEmpty) break;
      }
    } on AuthApiException catch (error) {
      if (_isCompletedError(error.message)) {
        _closeBecauseFinished();
        return;
      }
      if (mounted) _notice(error.message);
    } finally {
      _syncing = false;
    }
  }

  void _addMessage(PtChatMessage message) {
    if (!mounted || _messages.any((item) => item.id == message.id)) return;
    setState(() => _mergeMessages([message]));
    _scrollToBottom();
  }

  Future<void> _send() async {
    final content = _input.text.trim();
    if (_sending || !_canSend || !_beforeEnd || content.isEmpty) return;
    setState(() => _sending = true);
    try {
      final message = await widget.auth.sendPtChatMessage(
        widget.booking.id,
        content,
      );
      if (!mounted) return;
      _input.clear();
      _addMessage(message);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      if (_isCompletedError(error.message)) {
        _closeBecauseFinished();
        return;
      }
      _notice(error.message);
      if (error.message.contains('đã đóng')) {
        setState(() => _canSend = false);
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _notice(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _clock(DateTime? date) {
    if (date == null) return '';
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  String _bookingDate() {
    final date = widget.booking.startTime;
    if (date == null) return 'Lịch tập PT';
    return '${_clock(date)} · ${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AuraColors.cream,
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _otherName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            Text(
              _bookingDate(),
              style: const TextStyle(fontSize: 11, color: AuraColors.muted),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Tải lại tin nhắn',
            onPressed: _syncNew,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
              color: _connected ? const Color(0xFFEAF4E9) : AuraColors.latte,
              child: Text(
                _connected
                    ? 'Đang kết nối trực tiếp'
                    : 'Đang kết nối lại · có thể tải tin bằng nút làm mới',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: _connected ? AuraColors.green : AuraColors.caramel,
                ),
              ),
            ),
            Expanded(child: _messageArea()),
            if (_canSend && _beforeEnd)
              _composer()
            else if (!_loading && _error == null)
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 10, 20, 16),
                child: Text(
                  'Cuộc trò chuyện đã đóng. Bạn vẫn có thể xem tin nhắn cũ.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AuraColors.muted),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _messageArea() {
    if (_loading) return const Center(child: AuraLoader());
    if (_error != null && _messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AuraColors.muted),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _loadLatest,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }
    if (_messages.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.forum_outlined, size: 48, color: AuraColors.caramel),
              SizedBox(height: 12),
              Text(
                'Chưa có tin nhắn',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AuraColors.ink,
                ),
              ),
              SizedBox(height: 5),
              Text(
                'Hãy nhắn vị trí của bạn tại phòng tập để hai người dễ tìm nhau.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AuraColors.muted, height: 1.4),
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: AuraColors.coffee,
      onRefresh: _syncNew,
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
        itemCount: _messages.length + (_hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (_hasMore && index == 0) {
            return Center(
              child: TextButton(
                onPressed: _loadingMore ? null : _loadOlder,
                child: Text(_loadingMore ? 'Đang tải…' : 'Xem tin nhắn trước'),
              ),
            );
          }
          final message = _messages[index - (_hasMore ? 1 : 0)];
          final mine = message.senderId == _myId;
          return Align(
            alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width * 0.78,
              ),
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
              decoration: BoxDecoration(
                color: mine ? AuraColors.darkCoffee : Colors.white,
                borderRadius: BorderRadius.circular(18).copyWith(
                  bottomRight: mine ? const Radius.circular(5) : null,
                  bottomLeft: mine ? null : const Radius.circular(5),
                ),
                border: mine ? null : Border.all(color: AuraColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    message.content,
                    style: TextStyle(
                      color: mine ? Colors.white : AuraColors.ink,
                      fontSize: 14,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _clock(message.createdAt),
                    style: TextStyle(
                      fontSize: 10,
                      color: mine ? Colors.white70 : AuraColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _composer() => Container(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(top: BorderSide(color: AuraColors.border)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: TextField(
            controller: _input,
            maxLines: 4,
            minLines: 1,
            maxLength: 1000,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: widget.isCoach
                  ? 'Nhắn vị trí hoặc lời nhắn cho hội viên…'
                  : 'Nhắn vị trí hoặc lời nhắn cho PT…',
              counterText: '',
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 11,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          tooltip: 'Gửi tin nhắn',
          onPressed: _sending ? null : _send,
          icon: _sending
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.send_rounded),
        ),
      ],
    ),
  );
}
