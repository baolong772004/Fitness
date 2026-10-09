import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

class _EditorialItem {
  const _EditorialItem({
    required this.title,
    required this.summary,
    required this.body,
    required this.label,
    this.image,
    this.icon = Icons.article_outlined,
  });

  final String title;
  final String summary;
  final String body;
  final String label;
  final String? image;
  final IconData icon;
}

const _news = [
  _EditorialItem(
    title: 'KHÁM PHÁ KHÔNG GIAN TẬP LUYỆN',
    summary: 'Một nơi để bắt đầu và duy trì nhịp tập của riêng bạn.',
    body:
        'Dành thời gian cho bản thân với một buổi tập phù hợp. Khám phá các lớp học trong ứng dụng để chọn thời gian và bộ môn bạn yêu thích. Hình ảnh chỉ mang tính minh họa.',
    label: 'GÓC TẬP LUYỆN',
    image: 'assets/images/news-gym.jpg',
  ),
  _EditorialItem(
    title: 'CHUẨN BỊ CHO BUỔI TẬP ĐẦU TIÊN',
    summary: 'Một vài bước nhỏ giúp bạn bắt đầu thật thoải mái.',
    body:
        'Bạn có thể xem lịch lớp trước khi đến, chuẩn bị trang phục phù hợp và đến sớm khoảng 15 phút để hỏi nhân viên về lớp học. Hình ảnh chỉ mang tính minh họa.',
    label: 'CẨM NANG HỘI VIÊN',
    image: 'assets/images/news-checkin.jpg',
  ),
];

const _guides = [
  _EditorialItem(
    title: 'HƯỚNG DẪN ĐẶT LỊCH',
    summary: 'Chọn lớp học phù hợp với lịch trình của bạn.',
    body:
        'Mở tab Đặt lịch, chọn ngày và tìm lớp học bạn muốn tham gia. Nhấn Đặt chỗ để xác nhận. Các lớp đã đặt có thể xem trong mục Lịch đã Book.',
    label: 'TÀI LIỆU SỬ DỤNG',
    icon: Icons.calendar_month_rounded,
  ),
  _EditorialItem(
    title: 'HƯỚNG DẪN CHECK-IN',
    summary: 'Xem thẻ hội viên khi đến câu lạc bộ.',
    body:
        'Nhấn nút QR ở giữa thanh điều hướng để mở thẻ hội viên. Khi đến câu lạc bộ, bạn có thể hỏi nhân viên tại quầy về cách check-in.',
    label: 'TÀI LIỆU SỬ DỤNG',
    icon: Icons.qr_code_2_rounded,
  ),
  _EditorialItem(
    title: 'HỖ TRỢ HỘI VIÊN',
    summary: 'Kết nối với đội ngũ Aura Fitness khi cần.',
    body:
        'Nếu cần trợ giúp về lịch tập hoặc tài khoản, hãy sử dụng nút hỗ trợ trong ứng dụng hoặc liên hệ trực tiếp với lễ tân.',
    label: 'THÔNG TIN HỖ TRỢ',
    icon: Icons.support_agent_rounded,
  ),
];

class HomeEditorial extends StatelessWidget {
  const HomeEditorial({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: const [
        _EditorialRail(id: 'news', title: 'Tin tức AURA FITNESS', items: _news),
        SizedBox(height: 34),
        _EditorialRail(
          id: 'guides',
          title: 'Tài liệu, chính sách',
          items: _guides,
        ),
      ],
    );
  }
}

class _ClassReminder extends StatelessWidget {
  const _ClassReminder();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 26, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AuraColors.border),
        boxShadow: [
          BoxShadow(
            color: AuraColors.darkCoffee.withValues(alpha: 0.07),
            blurRadius: 18,
            offset: const Offset(0, 7),
          ),
        ],
      ),
      child: Row(
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
              Icons.notifications_active_outlined,
              color: AuraColors.darkCoffee,
              size: 21,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LƯU Ý TRƯỚC BUỔI TẬP',
                  style: TextStyle(
                    color: AuraColors.darkCoffee,
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.4,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  'Vui lòng đến trước giờ học khoảng 15 phút để chuẩn bị dụng cụ và được hướng dẫn vào lớp.',
                  style: TextStyle(
                    color: AuraColors.ink,
                    fontSize: 12,
                    height: 1.45,
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

class _EditorialRail extends StatelessWidget {
  const _EditorialRail({
    required this.id,
    required this.title,
    required this.items,
  });

  final String id;
  final String title;
  final List<_EditorialItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 10, 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AuraColors.darkCoffee,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              TextButton(
                key: Key('home-$id-view-all'),
                onPressed: () => _showAll(context),
                child: const Text(
                  'Xem tất cả',
                  style: TextStyle(
                    color: AuraColors.darkCoffee,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        LayoutBuilder(
          builder: (context, constraints) {
            final cardWidth = math.min(330.0, constraints.maxWidth * 0.76);
            return SizedBox(
              height: 257,
              child: ListView.separated(
                key: PageStorageKey<String>('home-editorial-$id'),
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, index) => SizedBox(
                  width: cardWidth,
                  child: _EditorialCard(
                    key: Key('home-$id-card-$index'),
                    item: items[index],
                    onTap: () => _showDetail(context, items[index]),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  void _showAll(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AuraColors.cream,
      builder: (sheetContext) => SafeArea(
        child: FractionallySizedBox(
          heightFactor: 0.72,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AuraColors.darkCoffee,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => Card(
                    color: Colors.white,
                    elevation: 0,
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(10),
                      leading: ClipRRect(
                        borderRadius: BorderRadius.circular(9),
                        child: SizedBox(
                          width: 60,
                          height: 60,
                          child: _EditorialArtwork(
                            item: items[index],
                            compact: true,
                          ),
                        ),
                      ),
                      title: Text(
                        items[index].title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      subtitle: Text(
                        items[index].summary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.of(sheetContext).pop();
                        _showDetail(context, items[index]);
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context, _EditorialItem item) {
    final steps = _stepsFor(item);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => Scaffold(
          backgroundColor: AuraColors.cream,
          body: CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 228,
                pinned: true,
                backgroundColor: AuraColors.darkCoffee,
                elevation: 0,
                leading: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: CircleAvatar(
                    backgroundColor: Colors.black.withValues(alpha: 0.3),
                    child: IconButton(
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                ),
                flexibleSpace: FlexibleSpaceBar(
                  collapseMode: CollapseMode.parallax,
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      _EditorialArtwork(item: item, showTitle: false),
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              AuraColors.darkCoffee.withValues(alpha: 0.8),
                            ],
                            stops: const [0.5, 1.0],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 22,
                        right: 22,
                        bottom: 48,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: AuraColors.caramel,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                item.label,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              item.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                height: 1.2,
                                fontWeight: FontWeight.w900,
                                shadows: [
                                  Shadow(color: Colors.black45, blurRadius: 12),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Container(
                  decoration: const BoxDecoration(
                    color: AuraColors.cream,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(30),
                    ),
                  ),
                  transform: Matrix4.translationValues(0.0, -30.0, 0.0),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 27, 20, 38),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AuraColors.caramel.withValues(
                                  alpha: 0.15,
                                ),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                item.label,
                                style: const TextStyle(
                                  color: AuraColors.caramel,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                            const Spacer(),
                            const Icon(
                              Icons.access_time_rounded,
                              size: 14,
                              color: Colors.grey,
                            ),
                            const SizedBox(width: 4),
                            const Text(
                              'Đọc 3 phút',
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            const CircleAvatar(
                              radius: 16,
                              backgroundColor: AuraColors.darkCoffee,
                              child: Icon(
                                Icons.fitness_center_rounded,
                                size: 16,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Aura Fitness Team',
                                  style: TextStyle(
                                    color: AuraColors.ink,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(
                                  'Đăng hôm nay',
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(16, 15, 16, 16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AuraColors.border),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.format_quote_rounded,
                                color: AuraColors.caramel,
                                size: 23,
                              ),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  item.summary,
                                  style: const TextStyle(
                                    color: AuraColors.darkCoffee,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    height: 1.55,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: AuraColors.caramel.withValues(
                                  alpha: 0.12,
                                ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                item.icon,
                                size: 18,
                                color: AuraColors.caramel,
                              ),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'NỘI DUNG BÀI VIẾT',
                              style: TextStyle(
                                color: AuraColors.darkCoffee,
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 11),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(17),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFBF6),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AuraColors.border),
                          ),
                          child: Text(
                            item.body.replaceAll('. ', '.\n\n'),
                            style: const TextStyle(
                              color: AuraColors.ink,
                              fontSize: 15,
                              height: 1.75,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'LÀM THEO TỪNG BƯỚC',
                                style: TextStyle(
                                  color: AuraColors.darkCoffee,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                            Text(
                              '${steps.length} bước',
                              style: const TextStyle(
                                color: AuraColors.muted,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        for (var index = 0; index < steps.length; index++) ...[
                          _EditorialStepCard(
                            index: index + 1,
                            text: steps[index],
                          ),
                          if (index != steps.length - 1)
                            const SizedBox(height: 9),
                        ],
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.all(15),
                          decoration: BoxDecoration(
                            color: AuraColors.darkCoffee,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.lightbulb_outline_rounded,
                                color: AuraColors.caramel,
                                size: 20,
                              ),
                              SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Mẹo nhỏ: Bạn có thể mở lại tài liệu này bất cứ lúc nào trong mục Tin tức và hướng dẫn trên trang chủ.',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    height: 1.55,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 40),
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: FilledButton(
                            onPressed: () => Navigator.of(context).pop(),
                            style: FilledButton.styleFrom(
                              backgroundColor: AuraColors.darkCoffee,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: const Text(
                              'QUAY LẠI TRANG TRƯỚC',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

List<String> _stepsFor(_EditorialItem item) {
  if (item.icon == Icons.calendar_month_rounded) {
    return const [
      'Mở mục Đặt lịch và chọn ngày bạn muốn tham gia.',
      'Xem giờ học, huấn luyện viên và số chỗ còn lại của lớp.',
      'Nhấn Đặt chỗ, sau đó kiểm tra trạng thái trong Lịch đã đặt.',
    ];
  }
  if (item.icon == Icons.qr_code_2_rounded) {
    return const [
      'Đăng nhập tài khoản hội viên trước khi đến câu lạc bộ.',
      'Mở mã QR hội viên trong ứng dụng và đưa cho nhân viên quét.',
      'Kiểm tra thông báo xác nhận sau khi hệ thống ghi nhận lượt vào.',
    ];
  }
  if (item.icon == Icons.support_agent_rounded) {
    return const [
      'Mở phần hỗ trợ trong ứng dụng hoặc đến quầy lễ tân.',
      'Chuẩn bị email hoặc số điện thoại dùng cho tài khoản hội viên.',
      'Mô tả vấn đề và thời điểm xảy ra để đội ngũ kiểm tra nhanh hơn.',
    ];
  }
  return const [
    'Đọc thông tin và chọn nội dung phù hợp với mục tiêu của bạn.',
    'Chuẩn bị lịch tập, tài khoản và các vật dụng cần thiết.',
    'Liên hệ nhân viên AURA nếu bạn cần được hướng dẫn thêm.',
  ];
}

class _EditorialStepCard extends StatelessWidget {
  const _EditorialStepCard({required this.index, required this.text});

  final int index;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: AuraColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AuraColors.darkCoffee,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              index.toString().padLeft(2, '0'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                text,
                style: const TextStyle(
                  color: AuraColors.ink,
                  fontSize: 13,
                  height: 1.55,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          const Icon(
            Icons.check_circle_outline_rounded,
            size: 17,
            color: AuraColors.caramel,
          ),
        ],
      ),
    );
  }
}

class _EditorialCard extends StatelessWidget {
  const _EditorialCard({super.key, required this.item, required this.onTap});

  final _EditorialItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 3,
      shadowColor: AuraColors.darkCoffee.withValues(alpha: 0.16),
      borderRadius: BorderRadius.circular(17),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: 145, child: _EditorialArtwork(item: item)),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(13, 10, 13, 11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AuraColors.ink,
                        fontSize: 13,
                        height: 1.25,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AuraColors.muted,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          color: AuraColors.coffee,
                          size: 15,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditorialArtwork extends StatelessWidget {
  const _EditorialArtwork({
    required this.item,
    this.compact = false,
    this.showTitle = true,
  });

  final _EditorialItem item;
  final bool compact;
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    if (item.image != null) {
      return Image.asset(
        item.image!,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _EditorialFallback(
          item: item,
          compact: compact,
          showTitle: showTitle,
        ),
      );
    }

    return _EditorialFallback(
      item: item,
      compact: compact,
      showTitle: showTitle,
    );
  }
}

class _EditorialFallback extends StatelessWidget {
  const _EditorialFallback({
    required this.item,
    required this.compact,
    required this.showTitle,
  });

  final _EditorialItem item;
  final bool compact;
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AuraColors.caramel,
            AuraColors.darkCoffee,
            AuraColors.espresso,
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -30,
            bottom: -35,
            child: Icon(
              item.icon,
              size: compact ? 90 : 170,
              color: Colors.white.withValues(alpha: 0.13),
            ),
          ),
          if (!compact && showTitle)
            Padding(
              padding: const EdgeInsets.all(19),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'AURA FITNESS',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      height: 1.15,
                      fontWeight: FontWeight.w900,
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
