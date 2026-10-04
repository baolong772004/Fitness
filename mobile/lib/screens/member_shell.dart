import 'package:flutter/material.dart';

import '../services/demo_auth.dart';
import '../theme.dart';
import '../widgets/home_sections.dart';
import 'auth_screen.dart';

class MemberShell extends StatefulWidget {
  const MemberShell({super.key, required this.auth});
  final DemoAuth auth;

  @override
  State<MemberShell> createState() => _MemberShellState();
}

class _MemberShellState extends State<MemberShell> {
  int _tab = 0; // 0: Trang chu, 1: Dat lich, 2: Quet ma, 3: Hop thu, 4: Tai khoan
  int _checkinSubTab = 1; // 0: Lich tap, 1: Check in, 2: PT
  int _day = 3; // Default T5 (07)
  int _segmentIndex = 0; // 0: Danh sach, 1: Lich doi xac nhan, 2: Lich da Book
  String _query = '';
  final _search = TextEditingController();
  final _bookings = <String, Set<String>>{};
  final _today = DateUtils.dateOnly(DateTime.now());

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  DateTime get _selectedDate => _today.add(Duration(days: _day));

  Set<String> get _memberBookings =>
      _bookings[widget.auth.currentMember?.email] ?? {};

  String _bookingKey(FitnessClass session) =>
      '${_selectedDate.toIso8601String()}/${session.id}';

  Future<bool> _openAuth({bool register = false}) async {
    final success = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AuthScreen(auth: widget.auth, register: register),
      ),
    );
    if (!mounted) return false;
    setState(() {});
    return success == true;
  }

  Future<void> _book(FitnessClass session) async {
    if (widget.auth.currentMember == null) {
      if (!await _openAuth() || !mounted) return;
    }
    final key = _bookingKey(session);
    final booked = _memberBookings.contains(key);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(booked ? 'Hủy đặt chỗ?' : 'Xác nhận đặt chỗ'),
        content: Text(
          '${session.title}\n${session.time} · ${_selectedDate.day}/${_selectedDate.month}\n${session.room}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Quay lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(booked ? 'Hủy đặt chỗ' : 'Xác nhận'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      final bookings = _bookings.putIfAbsent(
        widget.auth.currentMember!.email,
        () => {},
      );
      booked ? bookings.remove(key) : bookings.add(key);
    });
  }

  void _info(String title, String text) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(text),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleSection() {
    final classes = fitnessClasses.where((session) {
      final matches = '${session.title} ${session.coach} ${session.room}'
          .toLowerCase()
          .contains(_query.toLowerCase());

      if (!matches) return false;

      if (_segmentIndex == 1) {
        return session.status == 'Đợi xác nhận';
      } else if (_segmentIndex == 2) {
        return _memberBookings.contains(_bookingKey(session)) ||
            session.status == 'Đã book';
      }
      return true;
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (classes.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Chưa có lớp tập phù hợp.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AuraColors.muted),
            ),
          ),
        for (final session in classes)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: SessionCard(
              session: session,
              booked: _memberBookings.contains(_bookingKey(session)),
              onBook: () => _book(session),
            ),
          ),
      ],
    );
  }

  /// Full QR Checkin / Schedule Screen matching Images 4 & 5
  Widget _buildQRCheckinView() {
    return Container(
      color: AuraColors.darkCoffee,
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: PolygonBgPainter(),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                // Header Top Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => setState(() => _tab = 0),
                        child: const Row(
                          children: [
                            Icon(Icons.chevron_left, color: Colors.white, size: 28),
                            Text(
                              'Quay lại',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.lightbulb_outline, color: Colors.white, size: 24),
                    ],
                  ),
                ),

                // Segmented Sub-Tab Switcher: Lịch tập | Check in | PT
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      _buildSubTabItem('Lịch tập', 0),
                      _buildSubTabItem('Check in', 1),
                      _buildSubTabItem('PT', 2),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // Body depending on sub-tab
                Expanded(
                  child: SingleChildScrollView(
                    child: switch (_checkinSubTab) {
                      0 => _buildScheduleSection(),
                      1 => TicketQRCard(
                          memberName: widget.auth.currentMember?.name ?? 'Chewy Chewbaca',
                          packageName: 'Gói Lorem Ipsum - ${widget.auth.currentMember?.balance ?? "\$6000"}',
                        ),
                      _ => Padding(
                          padding: const EdgeInsets.all(24),
                          child: Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Column(
                              children: [
                                Icon(Icons.fitness_center, size: 48, color: AuraColors.darkCoffee),
                                SizedBox(height: 16),
                                Text(
                                  'Huấn luyện viên cá nhân (PT)',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: AuraColors.darkCoffee,
                                  ),
                                ),
                                SizedBox(height: 8),
                                Text(
                                  'Liên hệ lễ tân Aura Fitness để đăng ký gói tập 1-on-1 cùng HLV.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ],
                            ),
                          ),
                        ),
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubTabItem(String label, int index) {
    final isSelected = _checkinSubTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _checkinSubTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AuraColors.darkCoffee : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: isSelected ? Colors.white : Colors.white70,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAccountView() {
    final member = widget.auth.currentMember;
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          const CircleAvatar(
            radius: 44,
            backgroundColor: AuraColors.latte,
            child: Icon(Icons.person, size: 50, color: AuraColors.coffee),
          ),
          const SizedBox(height: 20),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              member?.name ?? 'Chào mừng đến Aura Fitness',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: AuraColors.darkCoffee,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            member?.email ?? 'Đăng nhập để quản lý lịch tập của bạn.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AuraColors.muted),
          ),
          const SizedBox(height: 28),
          if (member == null) ...[
            FilledButton(
              onPressed: _openAuth,
              child: const Text('Đăng nhập'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => _openAuth(register: true),
              child: const Text('Đăng ký'),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AuraColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.key, color: AuraColors.darkCoffee, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Tài khoản đăng nhập dùng thử:',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AuraColors.darkCoffee,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: const Text('• Email: chewy@aura.fit | Pass: 123456'),
                  ),
                  const SizedBox(height: 4),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: const Text('• Email: demo@aura.fit | Pass: 123456'),
                  ),
                ],
              ),
            ),
          ] else ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AuraColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Text(
                      'Số dư tài khoản:',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    member.balance,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AuraColors.darkCoffee,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.calendar_month, color: AuraColors.darkCoffee),
              title: const Text('Lịch tập đã đặt'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => setState(() {
                _tab = 2;
                _checkinSubTab = 0;
              }),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.history, color: AuraColors.darkCoffee),
              title: const Text('Lịch sử case'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => setState(() => _tab = 3),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              key: const Key('logout'),
              icon: const Icon(Icons.logout),
              onPressed: () => setState(() {
                widget.auth.logout();
                _tab = 0;
                _query = '';
                _search.clear();
              }),
              label: const FittedBox(child: Text('Đăng xuất')),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final member = widget.auth.currentMember;

    return Scaffold(
      backgroundColor: AuraColors.cream,
      body: SafeArea(
        top: _tab != 2,
        bottom: false,
        child: Stack(
          children: [
            // Main Body View per Tab
            switch (_tab) {
              0 => ListView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  children: [
                    HomeHero(
                      memberName: member?.name,
                      balance: member?.balance,
                      onLogin: _openAuth,
                      onRegister: () => _openAuth(register: true),
                      onNotifications: () => setState(() => _tab = 3),
                      showSearchAndFilter: false,
                    ),
                    const SizedBox(height: 12),
                    UpcomingCard(
                      onTap: () => setState(() {
                        _tab = 2;
                        _checkinSubTab = 1;
                      }),
                    ),
                    FeatureCardsGrid(
                      onSelectFeature: (feature) => _info('Aura Fitness', feature),
                    ),
                    CategoryGrid(
                      onSelectCategory: (cat) => setState(() {
                        _query = cat;
                        _tab = 1;
                      }),
                    ),
                    const PromoBanner(),
                    const NutritionSection(),
                    const SizedBox(height: 90), // Space for bottom nav
                  ],
                ),
              1 => ListView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  children: [
                    HomeHero(
                      memberName: member?.name,
                      balance: member?.balance,
                      onLogin: _openAuth,
                      onRegister: () => _openAuth(register: true),
                      onNotifications: () => setState(() => _tab = 3),
                      showSearchAndFilter: true,
                      search: _search,
                      onSearch: (value) => setState(() => _query = value),
                      segmentIndex: _segmentIndex,
                      onSegmentChanged: (idx) => setState(() => _segmentIndex = idx),
                      selectedDayIndex: _day,
                      onDayChanged: (day) => setState(() => _day = day),
                      today: _today,
                    ),
                    const SizedBox(height: 16),
                    _buildScheduleSection(),
                    const SizedBox(height: 90),
                  ],
                ),
              2 => _buildQRCheckinView(),
              3 => SingleChildScrollView(
                  child: Column(
                    children: [
                      CaseHistoryList(onBack: () => setState(() => _tab = 0)),
                      const SizedBox(height: 90),
                    ],
                  ),
                ),
              _ => SingleChildScrollView(
                  child: Column(
                    children: [
                      _buildAccountView(),
                      const SizedBox(height: 90),
                    ],
                  ),
                ),
            },

            // Floating Envelope Contact Action Button (Matching Screenshots)
            if (_tab != 2)
              Positioned(
                right: 20,
                bottom: 84,
                child: FloatingActionButton(
                  mini: true,
                  backgroundColor: Colors.white,
                  elevation: 6,
                  onPressed: () => _info(
                    'Hỗ trợ Aura Fitness',
                    'Liên hệ hotline 1900 1234 hoặc quầy lễ tân để được hỗ trợ.',
                  ),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: AuraColors.darkCoffee,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.mark_email_unread_outlined,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: AuraBottomNavBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        onQRClick: () => setState(() {
          _tab = 2;
          _checkinSubTab = 1;
        }),
      ),
    );
  }
}

/// Canvas Painter for rendering geometric polygon background accents (as in Images 4 & 5)
class PolygonBgPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final darkPaint = Paint()
      ..color = Colors.black.withOpacity(0.12)
      ..style = PaintingStyle.fill;

    final lightPaint = Paint()
      ..color = Colors.white.withOpacity(0.06)
      ..style = PaintingStyle.fill;

    // Top-left dark polygon accent
    final path1 = Path();
    path1.moveTo(0, 0);
    path1.lineTo(w * 0.5, 0);
    path1.lineTo(0, h * 0.22);
    path1.close();
    canvas.drawPath(path1, darkPaint);

    // Bottom-left large light polygon accent
    final path2 = Path();
    path2.moveTo(0, h * 0.62);
    path2.lineTo(w * 0.45, h);
    path2.lineTo(0, h);
    path2.close();
    canvas.drawPath(path2, lightPaint);

    // Bottom-right dark polygon accent
    final path3 = Path();
    path3.moveTo(w, h * 0.72);
    path3.lineTo(w, h);
    path3.lineTo(w * 0.55, h);
    path3.close();
    canvas.drawPath(path3, darkPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
