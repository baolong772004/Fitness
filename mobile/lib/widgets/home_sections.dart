import 'package:flutter/material.dart';

import '../theme.dart';

class FitnessClass {
  const FitnessClass({
    required this.id,
    required this.time,
    required this.title,
    required this.coach,
    required this.room,
    required this.spots,
    required this.maxSpots,
    this.status = 'Đặt chỗ',
    this.hasFriend = false,
    this.highlight = false,
  });

  final String id;
  final String time;
  final String title;
  final String coach;
  final String room;
  final int spots;
  final int maxSpots;
  final String status;
  final bool hasFriend;
  final bool highlight;
}

const fitnessClasses = [
  FitnessClass(
    id: 'yoga-1',
    time: '09:00 - 12:00',
    title: 'YOGA',
    coach: 'HLV: Lee Wang',
    room: 'STUDIO 2 AURA FITNESS THÀNH THÁI',
    spots: 20,
    maxSpots: 30,
    status: 'Đặt chỗ',
    hasFriend: true,
  ),
  FitnessClass(
    id: 'yoga-2',
    time: '14:00 - 16:00',
    title: 'PILATES',
    coach: 'HLV: Minh Anh',
    room: 'STUDIO 2 AURA FITNESS THÀNH THÁI',
    spots: 20,
    maxSpots: 30,
    status: 'Đặt chỗ',
    hasFriend: true,
  ),
  FitnessClass(
    id: 'yoga-3',
    time: '18:00 - 20:00',
    title: 'HIIT & GYM',
    coach: 'HLV: Quốc Bảo',
    room: 'STUDIO 2 AURA FITNESS THÀNH THÁI',
    spots: 20,
    maxSpots: 30,
    status: 'Đặt chỗ',
    hasFriend: false,
  ),
];

/// Top Header / Hero matching screenshots
class HomeHero extends StatelessWidget {
  const HomeHero({
    super.key,
    required this.memberName,
    this.balance,
    required this.onLogin,
    required this.onRegister,
    required this.onNotifications,
    this.showSearchAndFilter = true,
    this.search,
    this.onSearch,
    this.segmentIndex = 0,
    this.onSegmentChanged,
    this.selectedDayIndex = 3,
    this.onDayChanged,
    this.today,
  });

  final String? memberName;
  final String? balance;
  final VoidCallback onLogin;
  final VoidCallback onRegister;
  final VoidCallback onNotifications;
  final bool showSearchAndFilter;
  final TextEditingController? search;
  final ValueChanged<String>? onSearch;
  final int segmentIndex;
  final ValueChanged<int>? onSegmentChanged;
  final int selectedDayIndex;
  final ValueChanged<int>? onDayChanged;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = memberName != null;

    return Container(
      decoration: const BoxDecoration(
        color: AuraColors.darkCoffee,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
      ),
      padding: EdgeInsets.fromLTRB(
        14,
        16,
        14,
        showSearchAndFilter ? 20 : 28,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Greeting & Balance Pill
          Row(
            children: [
              Expanded(
                child: Text(
                  isLoggedIn ? 'Xin chào $memberName!' : 'Xin chào quý khách!',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isLoggedIn && balance != null) ...[
                const SizedBox(width: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white, width: 1.5),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$balance ▼',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),

          // Guest Auth Buttons if logged out
          if (!isLoggedIn) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    key: const Key('home-register'),
                    onPressed: onRegister,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AuraColors.darkCoffee,
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                    ),
                    child: const FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text('Đăng ký ngay', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    key: const Key('home-login'),
                    onPressed: onLogin,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white),
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                    ),
                    child: const FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text('Đăng nhập', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                ),
              ],
            ),
          ],

          // Search input & Filters (ONLY shown on Schedule / Đặt lịch tab)
          if (showSearchAndFilter) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: TextField(
                      controller: search,
                      onChanged: onSearch,
                      decoration: const InputDecoration(
                        hintText: 'Tìm kiếm',
                        hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                        prefixIcon: Icon(Icons.search, color: Colors.grey),
                        contentPadding: EdgeInsets.symmetric(vertical: 10),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: AuraColors.coffee,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.greenAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.tune, color: Colors.white, size: 16),
                        const SizedBox(width: 4),
                        const Text(
                          'Lọc',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Segmented Tab Filter (Danh sách | Lịch đợi xác nhận | Lịch đã Book)
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  _buildSegmentItem('Danh sách', 0),
                  _buildSegmentItem('Lịch đợi xác nhận', 1),
                  _buildSegmentItem('Lịch đã Book', 2),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Week Calendar Picker (T2 - CN, 04 - 10)
            if (today != null)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                decoration: BoxDecoration(
                  color: AuraColors.cream.withOpacity(0.95),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: List.generate(7, (index) {
                      final date = today!.add(Duration(days: index));
                      final isSelected = index == selectedDayIndex;
                      final dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
                      final dayLabel = dayNames[date.weekday - 1];
                      final dayNum = date.day.toString().padLeft(2, '0');

                      return GestureDetector(
                        onTap: () => onDayChanged?.call(index),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          margin: const EdgeInsets.symmetric(horizontal: 2),
                          decoration: BoxDecoration(
                            color: isSelected ? AuraColors.darkCoffee : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                dayLabel,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected ? Colors.white : Colors.grey[600],
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                dayNum,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: isSelected ? Colors.white : Colors.black87,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildSegmentItem(String title, int index) {
    final isSelected = segmentIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => onSegmentChanged?.call(index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 1),
          decoration: BoxDecoration(
            color: isSelected ? AuraColors.darkCoffee : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: isSelected ? Colors.white : Colors.black87,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Session Card matching Image 1
class SessionCard extends StatelessWidget {
  const SessionCard({
    super.key,
    required this.session,
    required this.booked,
    required this.onBook,
  });

  final FitnessClass session;
  final bool booked;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    String buttonText = session.status;
    Color buttonBg = AuraColors.darkCoffee;
    if (booked) {
      buttonText = 'Đã book';
      buttonBg = AuraColors.green;
    } else if (session.status == 'Đợi xác nhận') {
      buttonBg = AuraColors.espresso;
    } else if (session.status == 'Đặt chỗ') {
      buttonBg = AuraColors.darkCoffee;
    }

    final isFull = session.spots >= session.maxSpots;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: AuraColors.border.withOpacity(0.6)),
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
                      session.title,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: AuraColors.darkCoffee,
                        letterSpacing: 0.5,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      session.coach,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AuraColors.darkCoffee,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'STUDIO 2',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[800],
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'AURA FITNESS THÀNH THÁI',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    session.time,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AuraColors.darkCoffee,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 36,
                    child: ElevatedButton(
                      onPressed: onBook,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: buttonBg,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          buttonText,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: session.hasFriend ? AuraColors.darkCoffee : Colors.grey[200],
                        border: Border.all(
                          color: session.hasFriend ? AuraColors.darkCoffee : Colors.grey[400]!,
                        ),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: session.hasFriend
                          ? const Icon(Icons.check, size: 10, color: Colors.white)
                          : null,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        'Có bạn đi cùng',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[700],
                          fontWeight: FontWeight.w500,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                children: [
                  Icon(Icons.person, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text(
                    '${session.spots}/${session.maxSpots}${isFull ? " - Hết chỗ" : ""}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// "Lịch tập sắp tới" Card matching Image 2 & 7
class UpcomingCard extends StatelessWidget {
  const UpcomingCard({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'Lịch tập sắp tới',
                        style: TextStyle(
                          fontSize: 12,
                          color: AuraColors.darkCoffee,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    SizedBox(width: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        '09:00 - 12:00\n07/11/2020',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          fontSize: 11,
                          color: AuraColors.darkCoffee,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'YOGA',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: AuraColors.darkCoffee,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'HLV: Lee Wang',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.black87,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'STUDIO 2 AURA FITNESS THÀNH THÁI',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey[700],
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onTap,
            child: Column(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: CustomPaint(
                    painter: QRMatrixPainter(data: 'AURA-FITNESS-CHECKIN'),
                  ),
                ),
                const SizedBox(height: 2),
                const Icon(Icons.chevron_right, color: Colors.grey, size: 20),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 4 Action Feature Cards matching Image 2 & 7
class FeatureCardsGrid extends StatelessWidget {
  const FeatureCardsGrid({super.key, required this.onSelectFeature});

  final ValueChanged<String> onSelectFeature;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            _buildFeatureCard(
              title: 'AuraRewards',
              icon: Icons.star_border_rounded,
              bgColor: AuraColors.darkCoffee,
              textColor: Colors.white,
              iconColor: Colors.white,
              isDark: true,
              onTap: () => onSelectFeature('AuraRewards'),
            ),
            const SizedBox(width: 8),
            _buildFeatureCard(
              title: 'Chính sách giá',
              iconText: '\$',
              bgColor: Colors.white,
              textColor: Colors.black87,
              onTap: () => onSelectFeature('Chính sách giá'),
            ),
            const SizedBox(width: 8),
            _buildFeatureCard(
              title: 'Giới thiệu\nAURA FITNESS',
              iconText: 'i',
              bgColor: Colors.white,
              textColor: Colors.black87,
              onTap: () => onSelectFeature('Giới thiệu AURA FITNESS'),
            ),
            const SizedBox(width: 8),
            _buildFeatureCard(
              title: 'Hướng dẫn\nsử dụng',
              icon: Icons.lightbulb_outline,
              bgColor: Colors.white,
              textColor: Colors.black87,
              onTap: () => onSelectFeature('Hướng dẫn sử dụng'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCard({
    required String title,
    IconData? icon,
    String? iconText,
    required Color bgColor,
    required Color textColor,
    Color? iconColor,
    bool isDark = false,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 88,
        height: 100,
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
          border: isDark ? null : Border.all(color: Colors.grey[200]!),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.2) : AuraColors.darkCoffee,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: icon != null
                    ? Icon(icon, color: iconColor ?? Colors.white, size: 18)
                    : Text(
                        iconText ?? '',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: textColor,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 8 Category Square Buttons matching Image 2 & 7
class CategoryGrid extends StatelessWidget {
  const CategoryGrid({super.key, required this.onSelectCategory});

  final ValueChanged<String> onSelectCategory;

  static const categories = [
    'GYM',
    'YOGA',
    'PILATES',
    'HIIT',
    'DANCE',
    'ZUMBA',
    'BOXING',
    'CYCLING',
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        children: [
          Row(
            children: categories
                .take(4)
                .map((cat) => Expanded(child: _buildCategoryButton(cat)))
                .toList(),
          ),
          const SizedBox(height: 6),
          Row(
            children: categories
                .skip(4)
                .map((cat) => Expanded(child: _buildCategoryButton(cat)))
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryButton(String category) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: GestureDetector(
        onTap: () => onSelectCategory(category),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            color: AuraColors.darkCoffee,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                category,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Promotional Banner Item model
class PromoItem {
  const PromoItem({
    required this.sponsorTag,
    required this.title,
    required this.subtitle,
    required this.highlight,
    required this.buttonText,
    required this.gradientColors,
    required this.textColor,
    this.isDark = false,
    required this.icon,
  });

  final String sponsorTag;
  final String title;
  final String subtitle;
  final String highlight;
  final String buttonText;
  final List<Color> gradientColors;
  final Color textColor;
  final bool isDark;
  final IconData icon;
}

/// Promotional Banner Slider Carousel matching Image 2 & 7
class PromoBanner extends StatefulWidget {
  const PromoBanner({super.key});

  @override
  State<PromoBanner> createState() => _PromoBannerState();
}

class _PromoBannerState extends State<PromoBanner> {
  int _currentPage = 0;
  final PageController _controller = PageController();

  static const items = [
    PromoItem(
      sponsorTag: 'AURA x ELLE',
      title: 'CHÚC MỪNG CHỦ NHÂN',
      subtitle: 'nhận giải thưởng may mắn',
      highlight: '100 TRIỆU VNĐ',
      buttonText: 'Xem chi tiết',
      gradientColors: [Color(0xFFFFFDF8), Color(0xFFF5E8DC)],
      textColor: AuraColors.darkCoffee,
      icon: Icons.emoji_events_rounded,
    ),
    PromoItem(
      sponsorTag: 'AURA V.I.P',
      title: 'TẬP KHÔNG GIỚI HẠN',
      subtitle: 'Ưu đãi giảm 50% tháng đầu',
      highlight: 'AURA PASS VIP',
      buttonText: 'Đăng ký ngay',
      gradientColors: [AuraColors.darkCoffee, AuraColors.coffee],
      textColor: Colors.white,
      isDark: true,
      icon: Icons.workspace_premium_rounded,
    ),
    PromoItem(
      sponsorTag: 'HLV CÁ NHÂN',
      title: 'THỬ THÁCH 30 NGÀY',
      subtitle: 'Tặng 3 buổi tập 1-on-1 HLV',
      highlight: 'MIỄN PHÍ PT 1-1',
      buttonText: 'Nhận ưu đãi',
      gradientColors: [Color(0xFFF3E0D2), Color(0xFFFAF7F2)],
      textColor: AuraColors.darkCoffee,
      icon: Icons.fitness_center_rounded,
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          height: 150,
          child: PageView.builder(
            controller: _controller,
            onPageChanged: (idx) => setState(() => _currentPage = idx),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: item.gradientColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            'Đơn vị tài trợ',
                            style: TextStyle(
                              fontSize: 11,
                              color: item.isDark ? Colors.white70 : Colors.grey[600],
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: item.isDark ? Colors.white : AuraColors.darkCoffee,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            item.sponsorTag,
                            style: TextStyle(
                              color: item.isDark ? AuraColors.darkCoffee : Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  item.title,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    color: item.textColor,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              Text(
                                item.subtitle,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: item.isDark ? Colors.white70 : Colors.grey[700],
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  item.highlight,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                    color: item.isDark ? Colors.amber[300] : AuraColors.darkCoffee,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: item.isDark ? Colors.white.withOpacity(0.15) : AuraColors.latte,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            item.icon,
                            color: item.isDark ? Colors.amber[300] : AuraColors.coffee,
                            size: 24,
                          ),
                        ),
                      ],
                    ),
                    // Dots indicator inside card bottom
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(items.length, (i) {
                        final isSel = i == _currentPage;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: isSel ? 14 : 5,
                          height: 5,
                          decoration: BoxDecoration(
                            color: item.isDark
                                ? (isSel ? Colors.white : Colors.white38)
                                : (isSel ? AuraColors.darkCoffee : Colors.grey[300]),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// "ĐỪNG BỎ LỠ" Section matching Image 2 & 7
class NutritionSection extends StatelessWidget {
  const NutritionSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ĐỪNG BỎ LỠ',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AuraColors.darkCoffee,
                ),
              ),
              TextButton(
                onPressed: () {},
                child: const Text(
                  'Xem tất cả',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.black87,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 150,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _buildNutritionCard('Dinh dưỡng cho tập luyện', 'Chế độ ăn cân bằng protein'),
              _buildNutritionCard('Lộ trình tập Gym 30 ngày', 'Tối ưu hóa sức bền cơ bắp'),
              _buildNutritionCard('Yoga & Thiền định', 'Thư giãn tâm trí và cơ thể'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildNutritionCard(String title, String subtitle) {
    return Container(
      width: 200,
      margin: const EdgeInsets.only(right: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 85,
            decoration: const BoxDecoration(
              color: AuraColors.latte,
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: const Center(
              child: Icon(Icons.restaurant_menu, size: 36, color: AuraColors.coffee),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.black87,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Canvas Painter for rendering a sharp QR Code Matrix
class QRMatrixPainter extends CustomPainter {
  QRMatrixPainter({required this.data, this.color = Colors.black});

  final String data;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final double cellSize = size.width / 15;

    // Corner finder patterns (Top-left, Top-right, Bottom-left)
    _drawFinderPattern(canvas, paint, 0, 0, cellSize);
    _drawFinderPattern(canvas, paint, 8 * cellSize, 0, cellSize);
    _drawFinderPattern(canvas, paint, 0, 8 * cellSize, cellSize);

    // Random deterministic matrix dots inside
    final hash = data.hashCode;
    for (int r = 0; r < 15; r++) {
      for (int c = 0; c < 15; c++) {
        // Skip finder areas
        if ((r < 7 && c < 7) || (r < 7 && c >= 8) || (r >= 8 && c < 7)) continue;
        final val = (hash ^ (r * 17 + c * 31)) % 3;
        if (val == 0) {
          canvas.drawRect(
            Rect.fromLTWH(c * cellSize, r * cellSize, cellSize, cellSize),
            paint,
          );
        }
      }
    }
  }

  void _drawFinderPattern(
    Canvas canvas,
    Paint paint,
    double x,
    double y,
    double cellSize,
  ) {
    // Outer square 7x7
    canvas.drawRect(
      Rect.fromLTWH(x, y, 7 * cellSize, 7 * cellSize),
      paint,
    );
    // Inner white 5x5
    final whitePaint = Paint()..color = Colors.white;
    canvas.drawRect(
      Rect.fromLTWH(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize),
      whitePaint,
    );
    // Center square 3x3
    canvas.drawRect(
      Rect.fromLTWH(
        x + 2 * cellSize,
        y + 2 * cellSize,
        3 * cellSize,
        3 * cellSize,
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Full Ticket Card with QR code matching Image 4 & 5 & 9 & 10
class TicketQRCard extends StatelessWidget {
  const TicketQRCard({
    super.key,
    required this.memberName,
    required this.packageName,
  });

  final String memberName;
  final String packageName;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Top section: Avatar, Member Info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: Colors.grey[200],
                  child: const Icon(Icons.person, size: 30, color: Colors.grey),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        memberName,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AuraColors.darkCoffee,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        packageName,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.black87,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Dotted Divider Line with side circular notches
          Row(
            children: [
              Container(
                width: 10,
                height: 20,
                decoration: const BoxDecoration(
                  color: AuraColors.darkCoffee,
                  borderRadius: BorderRadius.horizontal(right: Radius.circular(10)),
                ),
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final double width = constraints.maxWidth;
                    const double dashWidth = 5;
                    final int dashCount = (width / (2 * dashWidth)).floor();
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(dashCount, (_) {
                        return Container(
                          width: dashWidth,
                          height: 2,
                          color: Colors.grey[300],
                        );
                      }),
                    );
                  },
                ),
              ),
              Container(
                width: 10,
                height: 20,
                decoration: const BoxDecoration(
                  color: AuraColors.darkCoffee,
                  borderRadius: BorderRadius.horizontal(left: Radius.circular(10)),
                ),
              ),
            ],
          ),

          // Center section: Big QR Code
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                SizedBox(
                  width: 180,
                  height: 180,
                  child: CustomPaint(
                    painter: QRMatrixPainter(
                      data: '$memberName-$packageName',
                      color: AuraColors.ink,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Scan your QR code for checking in',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.black87,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 16),

                // Indicator line dashes
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(8, (i) {
                    final isActive = i == 3;
                    return Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      width: isActive ? 20 : 12,
                      height: 3,
                      decoration: BoxDecoration(
                        color: isActive ? Colors.black87 : Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 20),
                const Text(
                  'A U R A  F I T N E S S',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: AuraColors.darkCoffee,
                    letterSpacing: 2.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Case History Accordion Card List matching Image 3 & 8
class CaseHistoryList extends StatefulWidget {
  const CaseHistoryList({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  State<CaseHistoryList> createState() => _CaseHistoryListState();
}

class _CaseHistoryListState extends State<CaseHistoryList> {
  final Map<int, bool> _expanded = {0: false, 1: false, 2: true};

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Top Back & Title Bar
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              GestureDetector(
                onTap: widget.onBack,
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.chevron_left, color: AuraColors.darkCoffee, size: 26),
                    Text(
                      'Quay lại',
                      style: TextStyle(
                        color: AuraColors.darkCoffee,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const Expanded(
                child: Text(
                  'Lịch sử case',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: AuraColors.darkCoffee,
                  ),
                ),
              ),
              const SizedBox(width: 60), // spacer balance
            ],
          ),
        ),

        // Case Cards
        _buildCaseCard(
          index: 0,
          title: 'Mất thẻ thành viên',
          date: '07/11/2020',
          studio: 'STUDIO 2 AURA FITNESS THÀNH THÁI',
          status: 'Đã giải quyết',
          isResolved: true,
        ),
        _buildCaseCard(
          index: 1,
          title: 'Mất thẻ thành viên',
          date: '17/11/2020',
          studio: 'STUDIO 2 AURA FITNESS QUẬN 1',
          status: 'Đang chờ xử lý',
          isResolved: false,
        ),
        _buildCaseCard(
          index: 2,
          title: 'Vấn đề Top-up',
          date: '22/11/2020',
          studio: 'STUDIO 2 AURA FITNESS QUẬN 8',
          status: 'Đang chờ xử lý',
          isResolved: false,
        ),
      ],
    );
  }

  Widget _buildCaseCard({
    required int index,
    required String title,
    required String date,
    required String studio,
    required String status,
    required bool isResolved,
  }) {
    final isExp = _expanded[index] ?? false;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.black87,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: isResolved ? Colors.grey[200] : AuraColors.darkCoffee,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: isResolved ? Colors.grey[700] : Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            date,
            style: TextStyle(fontSize: 11, color: Colors.grey[500]),
          ),
          const SizedBox(height: 4),
          Text(
            studio,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AuraColors.darkCoffee,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Yêu cầu hỗ trợ đã được ghi nhận. Đội ngũ chăm sóc khách hàng Aura Fitness sẽ hỗ trợ bạn trong thời gian sớm nhất.',
            style: TextStyle(fontSize: 12, color: Colors.grey[700], height: 1.3),
            maxLines: isExp ? 10 : 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Center(
            child: GestureDetector(
              onTap: () => setState(() => _expanded[index] = !isExp),
              child: Icon(
                isExp ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                color: AuraColors.darkCoffee,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Custom Wave Bottom Navigation Bar matching Screenshots
class AuraBottomNavBar extends StatelessWidget {
  const AuraBottomNavBar({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.onQRClick,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onQRClick;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.bottomCenter,
      clipBehavior: Clip.none,
      children: [
        // Curved Bottom Container
        CustomPaint(
          size: Size(MediaQuery.of(context).size.width, 68),
          painter: WaveNavBarPainter(color: AuraColors.darkCoffee),
          child: SizedBox(
            height: 68,
            child: Row(
              children: [
                _buildNavItem(0, Icons.home, 'Trang chủ'),
                _buildNavItem(1, Icons.calendar_month, 'Đặt lịch'),
                const Expanded(child: SizedBox()), // Center space for FAB
                _buildNavItem(3, Icons.notifications, 'Hộp thư', badge: '07'),
                _buildNavItem(4, Icons.person, 'Tài khoản'),
              ],
            ),
          ),
        ),

        // Center Floating Action QR Button
        Positioned(
          top: -18,
          child: GestureDetector(
            onTap: onQRClick,
            child: Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: AuraColors.darkCoffee,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(Icons.qr_code_2, color: Colors.white, size: 30),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNavItem(
    int index,
    IconData icon,
    String label, {
    String? badge,
  }) {
    final isSelected = selectedIndex == index;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onDestinationSelected(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  icon,
                  color: isSelected ? Colors.white : Colors.white70,
                  size: 22,
                ),
                if (badge != null)
                  Positioned(
                    top: -4,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badge,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white70,
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Custom Wave Navbar Painter for smooth center notch
class WaveNavBarPainter extends CustomPainter {
  WaveNavBarPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path();
    final w = size.width;
    final h = size.height;

    final cx = w / 2;

    path.moveTo(0, 0);
    path.lineTo(cx - 48, 0);
    // Smooth notch curve downwards
    path.cubicTo(
      cx - 28, 0,
      cx - 32, 36,
      cx, 36,
    );
    path.cubicTo(
      cx + 32, 36,
      cx + 28, 0,
      cx + 48, 0,
    );
    path.lineTo(w, 0);
    path.lineTo(w, h);
    path.lineTo(0, h);
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
