import 'dart:async';

import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/home_editorial.dart';
import '../widgets/home_sections.dart';
import '../widgets/home_showcase.dart';
import 'auth_screen.dart';
import 'booking_hub.dart';
import 'change_password_screen.dart';
import 'checkin_history_screen.dart';
import 'my_subscriptions_screen.dart';
import 'notifications_screen.dart';
import 'package_store_screen.dart';
import 'pt_journey_screen.dart';

class MemberShell extends StatefulWidget {
  const MemberShell({super.key, required this.auth});
  final AuthService auth;

  @override
  State<MemberShell> createState() => _MemberShellState();
}

class _MemberShellState extends State<MemberShell> {
  int _tab =
      0; // 0: Trang chu, 1: Dat lich, 2: Quet ma, 3: Hop thu, 4: Tai khoan
  int _checkinSubTab = 1; // 0: Lich tap, 1: Check in, 2: PT
  String _query = '';
  CheckInQr? _checkInQr;
  Timer? _qrRefreshTimer;
  Timer? _notificationRefreshTimer;
  int _unreadNotificationCount = 0;
  int _qrRequestId = 0;
  bool _isLoadingQr = false;
  String? _qrError;

  @override
  void initState() {
    super.initState();
    _refreshUnreadNotificationCount();
    _notificationRefreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _refreshUnreadNotificationCount(),
    );
  }

  @override
  void dispose() {
    _qrRefreshTimer?.cancel();
    _notificationRefreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _openCheckInQr() async {
    _qrRefreshTimer?.cancel();
    setState(() {
      _tab = 2;
      _checkinSubTab = 1;
      _qrError = null;
    });
    if (widget.auth.currentMember == null) {
      final signedIn = await _openAuth();
      if (!signedIn || !mounted) {
        if (mounted) {
          setState(() => _qrError = 'Đăng nhập để tạo mã QR điểm danh.');
        }
        return;
      }
    }
    if (!mounted) return;
    await _loadCheckInQr();
    _qrRefreshTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      if (mounted && _tab == 2 && _checkinSubTab == 1) {
        unawaited(_loadCheckInQr());
      }
    });
  }

  Future<void> _loadCheckInQr() async {
    final requestId = ++_qrRequestId;
    setState(() {
      _isLoadingQr = true;
      _qrError = null;
    });
    try {
      final qr = await widget.auth.generateCheckInQr();
      if (!mounted || requestId != _qrRequestId) return;
      setState(() => _checkInQr = qr);
    } on AuthApiException catch (error) {
      if (!mounted || requestId != _qrRequestId) return;
      setState(() => _qrError = error.message);
    } finally {
      if (mounted && requestId == _qrRequestId) {
        setState(() => _isLoadingQr = false);
      }
    }
  }

  void _selectTab(int index) {
    if (index != 2) _qrRefreshTimer?.cancel();
    setState(() {
      if (index == 1 && _tab != 1) {
        _query = '';
      }
      _tab = index;
    });
    if (index == 3) _refreshUnreadNotificationCount();
  }

  Future<void> _refreshUnreadNotificationCount() async {
    if (widget.auth.currentMember == null) {
      if (mounted && _unreadNotificationCount != 0) {
        setState(() => _unreadNotificationCount = 0);
      }
      return;
    }
    try {
      final count = await widget.auth.getUnreadNotificationCount();
      if (mounted && count != _unreadNotificationCount) {
        setState(() => _unreadNotificationCount = count);
      }
    } on AuthApiException {
      // Keep the last known badge if the server is temporarily unavailable.
    }
  }

  Future<bool> _openAuth({bool register = false}) async {
    final result = await Navigator.of(context).push<AuthCompletion>(
      MaterialPageRoute(
        builder: (_) => AuthScreen(auth: widget.auth, register: register),
      ),
    );
    if (!mounted || result == null) return false;
    setState(() {});
    unawaited(_refreshUnreadNotificationCount());
    final message = result == AuthCompletion.loggedIn
        ? 'Đăng nhập thành công. Chào mừng ${widget.auth.currentMember?.name ?? 'bạn'}!'
        : 'Tạo tài khoản thành công. Chào mừng bạn đến với Aura Fitness!';
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(child: Text(message)),
            ],
          ),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AuraColors.darkCoffee,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          duration: const Duration(seconds: 3),
        ),
      );
    return true;
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

  void _openScheduleFor([String category = '']) {
    setState(() {
      _tab = 1;
      _query = category;
    });
  }

  Widget _buildScheduleSection() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Gói tập, lịch PT và Workout Class nằm trong mục Đặt lịch.',
            style: TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => _selectTab(1),
            icon: const Icon(Icons.calendar_month_rounded),
            label: const Text('Mở Đặt lịch'),
          ),
        ],
      ),
    );
  }

  /// Full QR Checkin / Schedule Screen matching Images 4 & 5
  Widget _buildQRCheckinView() {
    return Container(
      color: AuraColors.darkCoffee,
      child: Stack(
        children: [
          Positioned.fill(child: CustomPaint(painter: PolygonBgPainter())),
          SafeArea(
            child: Column(
              children: [
                // Header Top Bar
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => setState(() => _tab = 0),
                        child: const Row(
                          children: [
                            Icon(
                              Icons.chevron_left,
                              color: Colors.white,
                              size: 28,
                            ),
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
                      const Icon(
                        Icons.lightbulb_outline,
                        color: Colors.white,
                        size: 24,
                      ),
                    ],
                  ),
                ),

                // Segmented Sub-Tab Switcher: Lịch tập | Check in | PT
                Container(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 8,
                  ),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
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
                  child: _checkinSubTab == 2
                      ? PtJourneyScreen(
                          auth: widget.auth,
                          onBrowsePackages: _openPackageStore,
                          onLoginRequired: _openAuth,
                        )
                      : SingleChildScrollView(
                          child: switch (_checkinSubTab) {
                            0 => _buildScheduleSection(),
                            1 => TicketQRCard(
                              memberName:
                                  widget.auth.currentMember?.name ??
                                  'Hội viên Aura',
                              packageName: 'Thẻ hội viên Aura Fitness',
                              qrCodeImage: _checkInQr?.imageData,
                              isLoading: _isLoadingQr,
                              isSignedIn: widget.auth.currentMember != null,
                              errorMessage: _qrError,
                              onRefresh: _loadCheckInQr,
                              onSignIn: _openCheckInQr,
                            ),
                            _ => const SizedBox.shrink(),
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

  Future<void> _openChangePassword() async {
    if (widget.auth.currentMember == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => ChangePasswordScreen(auth: widget.auth),
      ),
    );
  }

  Future<void> _openCheckInHistory() async {
    if (widget.auth.currentMember == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => CheckInHistoryScreen(auth: widget.auth),
      ),
    );
  }

  Future<void> _openPackageStore() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => PackageStoreScreen(
          auth: widget.auth,
          onLoginRequired: () => _openAuth(),
        ),
      ),
    );
  }

  Future<void> _openMySubscriptions() async {
    if (widget.auth.currentMember == null) {
      if (!await _openAuth() || !mounted) return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => MySubscriptionsScreen(
          auth: widget.auth,
          onBrowsePackages: _openPackageStore,
        ),
      ),
    );
  }

  Future<void> _openPtTab() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: AuraColors.espresso,
          appBar: AppBar(
            backgroundColor: AuraColors.espresso,
            foregroundColor: Colors.white,
            title: const Text('Lịch tập PT'),
          ),
          body: PtJourneyScreen(
            auth: widget.auth,
            onBrowsePackages: _openPackageStore,
            onLoginRequired: _openAuth,
          ),
        ),
      ),
    );
  }

  Widget _accountMenuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) => Container(
    margin: const EdgeInsets.fromLTRB(18, 0, 18, 10),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AuraColors.border.withValues(alpha: 0.65)),
      boxShadow: [
        BoxShadow(
          color: AuraColors.espresso.withValues(alpha: 0.07),
          blurRadius: 10,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 17, vertical: 4),
      leading: Icon(icon, color: AuraColors.caramel, size: 22),
      title: Text(
        title,
        style: const TextStyle(
          color: AuraColors.ink,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
      trailing: const Icon(
        Icons.chevron_right_rounded,
        color: AuraColors.muted,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
  );

  Widget _buildAccountView() {
    final member = widget.auth.currentMember;
    final name = member?.name.trim().isNotEmpty == true
        ? member!.name
        : 'Chào mừng đến Aura Fitness';
    final balance = member?.balance?.trim().isNotEmpty == true
        ? member!.balance!
        : 'Chưa cập nhật';
    final phone = member?.phone?.trim().isNotEmpty == true
        ? member!.phone!
        : 'Chưa cập nhật';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 292,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: 222,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AuraColors.espresso, AuraColors.darkCoffee],
                    ),
                    borderRadius: BorderRadius.vertical(
                      bottom: Radius.circular(34),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(22, 30, 22, 50),
                    child: Row(
                      children: [
                        Container(
                          width: 66,
                          height: 66,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.16),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.34),
                              width: 2,
                            ),
                          ),
                          child: const Icon(
                            Icons.person_rounded,
                            color: Colors.white,
                            size: 39,
                          ),
                        ),
                        const SizedBox(width: 15),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                member == null
                                    ? 'Đăng nhập để xem hồ sơ hội viên'
                                    : 'Mã tài khoản: ${member.id ?? member.email}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Color(0xFFE8D8CF),
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                member?.email ?? 'Hồ sơ ›',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 165,
                left: 18,
                right: 18,
                child: Container(
                  padding: const EdgeInsets.all(19),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AuraColors.caramel, AuraColors.darkCoffee],
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: AuraColors.espresso.withValues(alpha: 0.2),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'AURA FITNESS  •  HỘI VIÊN',
                              style: TextStyle(
                                color: Color(0xFFEAD8C7),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                          Icon(
                            Icons.workspace_premium_rounded,
                            color: Colors.white.withValues(alpha: 0.9),
                            size: 21,
                          ),
                        ],
                      ),
                      const SizedBox(height: 11),
                      Text(
                        member == null
                            ? 'Bắt đầu hành trình khỏe hơn'
                            : 'Xin chào, ${member.name}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 17,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        member == null
                            ? 'Đăng nhập để quản lý quyền lợi hội viên.'
                            : 'Số dư tài khoản: $balance',
                        style: const TextStyle(
                          color: Color(0xFFF4E9DF),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        if (member == null) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilledButton(
                  onPressed: _openAuth,
                  child: const Text('Đăng nhập'),
                ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () => _openAuth(register: true),
                  child: const Text('Tạo tài khoản hội viên'),
                ),
                const SizedBox(height: 10),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ] else ...[
          _accountMenuItem(
            icon: Icons.local_offer_outlined,
            title: 'Ưu đãi hội viên',
            onTap: () => _info(
              'Ưu đãi hội viên',
              'Các chương trình ưu đãi sẽ được cập nhật tại đây.',
            ),
          ),
          _accountMenuItem(
            icon: Icons.menu_book_outlined,
            title: 'Hướng dẫn sử dụng',
            onTap: () => _info(
              'Hướng dẫn sử dụng',
              'Bạn có thể xem lịch tập, đặt lớp và quét mã hội viên trong các mục bên dưới.',
            ),
          ),
          _accountMenuItem(
            icon: Icons.support_agent_rounded,
            title: 'Liên hệ Aura Fitness',
            onTap: () => _info(
              'Liên hệ',
              'Liên hệ hotline 1900 1234 hoặc quầy lễ tân để được hỗ trợ.',
            ),
          ),
          _accountMenuItem(
            icon: Icons.description_outlined,
            title: 'Hợp đồng hội viên',
            onTap: () => _info(
              'Hợp đồng hội viên',
              'Thông tin hợp đồng hiện chưa được đồng bộ vào ứng dụng.',
            ),
          ),
          _accountMenuItem(
            icon: Icons.fact_check_outlined,
            title: 'Lịch sử điểm danh',
            onTap: _openCheckInHistory,
          ),
          _accountMenuItem(
            icon: Icons.history_rounded,
            title: 'Hộp thư thông báo',
            onTap: () => _selectTab(3),
          ),
          _accountMenuItem(
            icon: Icons.security_rounded,
            title: 'Cài đặt đăng nhập',
            onTap: _openChangePassword,
          ),
          _accountMenuItem(
            icon: Icons.person_add_alt_1_rounded,
            title: 'Bổ sung hồ sơ',
            onTap: () => _info(
              'Hồ sơ hội viên',
              'Email: ${member.email}\nSố điện thoại: $phone',
            ),
          ),
          _accountMenuItem(
            icon: Icons.translate_rounded,
            title: 'Đổi ngôn ngữ',
            onTap: () =>
                _info('Ngôn ngữ', 'Ứng dụng hiện đang sử dụng tiếng Việt.'),
          ),
          _accountMenuItem(
            icon: Icons.lock_reset_rounded,
            title: 'Thay mật khẩu',
            onTap: _openChangePassword,
          ),
          _accountMenuItem(
            icon: Icons.no_accounts_outlined,
            title: 'Vô hiệu hóa tài khoản',
            onTap: () => _info(
              'Vô hiệu hóa tài khoản',
              'Vui lòng liên hệ quầy lễ tân để được hỗ trợ yêu cầu này.',
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 12),
            child: OutlinedButton.icon(
              key: const Key('logout'),
              onPressed: () => setState(() {
                widget.auth.logout();
                _tab = 0;
                _unreadNotificationCount = 0;
                _query = '';
              }),
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Đăng xuất'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AuraColors.caramel,
                side: const BorderSide(color: AuraColors.border),
                minimumSize: const Size.fromHeight(50),
              ),
            ),
          ),
        ],
        const SizedBox(height: 96),
      ],
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
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  HomeHero(
                    memberName: member?.name,
                    balance: member?.balance,
                    onLogin: _openAuth,
                    onRegister: () => _openAuth(register: true),
                    onNotifications: () => _selectTab(3),
                    showSearchAndFilter: false,
                  ),
                  HomePhotoHero(onExplore: _openScheduleFor),
                  UpcomingCard(onTap: _openCheckInQr),
                  FeatureCardsGrid(
                    onSelectFeature: (feature) =>
                        _info('Aura Fitness', feature),
                  ),
                  ClassSpotlight(onSelectCategory: _openScheduleFor),
                  CategoryGrid(onSelectCategory: _openScheduleFor),
                  const PromoBanner(),
                  NutritionSection(onSelectCategory: _openScheduleFor),
                  const HomeEditorial(),
                  const SizedBox(height: 90), // Space for bottom nav
                ],
              ),
              1 => BookingHub(
                auth: widget.auth,
                onBrowsePackages: _openPackageStore,
                onMyPackages: _openMySubscriptions,
                onPtSchedule: _openPtTab,
                onLoginRequired: _openAuth,
                workoutCategory: _query,
              ),
              2 => _buildQRCheckinView(),
              3 => NotificationsScreen(
                auth: widget.auth,
                onLoginRequired: _openAuth,
                onUnreadCountChanged: (count) {
                  if (mounted && count != _unreadNotificationCount) {
                    setState(() => _unreadNotificationCount = count);
                  }
                },
              ),
              _ => SingleChildScrollView(
                child: Column(
                  children: [_buildAccountView(), const SizedBox(height: 90)],
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
        onDestinationSelected: _selectTab,
        onQRClick: _openCheckInQr,
        unreadCount: _unreadNotificationCount,
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
      ..color = Colors.black.withValues(alpha: 0.12)
      ..style = PaintingStyle.fill;

    final lightPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
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
