import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

const _heroImage = 'assets/images/home-hero.jpg';
const _yogaImage = 'assets/images/yoga.jpg';
const _strengthImage = 'assets/images/strength.jpg';

/// The first visual anchor on the home screen.
class HomePhotoHero extends StatelessWidget {
  const HomePhotoHero({super.key, required this.onExplore});

  final VoidCallback onExplore;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 650),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 18 * (1 - value)),
          child: child,
        ),
      ),
      child: Container(
        height: 320,
        margin: const EdgeInsets.fromLTRB(16, 16, 16, 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: AuraColors.darkCoffee.withValues(alpha: 0.22),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.asset(
                _heroImage,
                fit: BoxFit.cover,
                alignment: Alignment.centerRight,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Color(0xF5220F0A),
                      Color(0xB32B140C),
                      Color(0x002B140C),
                    ],
                    stops: [0, 0.53, 1],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        border: Border.all(color: Colors.white30),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'AURA FITNESS  •  MOVE WITH PURPOSE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.7,
                        ),
                      ),
                    ),
                    const Spacer(),
                    const Text(
                      'NĂNG LƯỢNG\nBẮT ĐẦU TỪ BẠN',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 25,
                        height: 1.08,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.7,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const SizedBox(
                      width: 190,
                      child: Text(
                        'Tìm lớp tập phù hợp và bắt đầu hành trình của riêng bạn.',
                        style: TextStyle(
                          color: Color(0xFFEDE1DA),
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      key: const Key('home-explore-classes'),
                      onPressed: onExplore,
                      icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                      label: const Text('Khám phá lớp tập'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AuraColors.darkCoffee,
                        minimumSize: const Size(0, 40),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        textStyle: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ClassSpotlight extends StatefulWidget {
  const ClassSpotlight({super.key, required this.onSelectCategory});

  final ValueChanged<String> onSelectCategory;

  @override
  State<ClassSpotlight> createState() => _ClassSpotlightState();
}

class _ClassSpotlightState extends State<ClassSpotlight> {
  late final PageController _controller = PageController(
    viewportFraction: 0.88,
  );
  int _page = 0;

  static const _classes = [
    (
      title: 'YOGA',
      eyebrow: 'THĂNG BẰNG MỖI NGÀY',
      subtitle: 'Thả lỏng cơ thể, tái tạo năng lượng',
      image: _yogaImage,
      category: 'YOGA',
    ),
    (
      title: 'STRENGTH',
      eyebrow: 'MẠNH MẼ HƠN HÔM QUA',
      subtitle: 'Chinh phục giới hạn của chính bạn',
      image: _strengthImage,
      category: 'GYM',
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'CHỌN NHỊP TẬP CỦA BẠN',
                style: TextStyle(
                  color: AuraColors.darkCoffee,
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.4,
                ),
              ),
              SizedBox(height: 3),
              Text(
                'Mỗi ngày là một cơ hội để tốt hơn',
                style: TextStyle(color: AuraColors.muted, fontSize: 12),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 220,
          child: PageView.builder(
            controller: _controller,
            itemCount: _classes.length,
            onPageChanged: (page) => setState(() => _page = page),
            itemBuilder: (context, index) {
              final item = _classes[index];
              return AnimatedBuilder(
                animation: _controller,
                builder: (context, child) {
                  final page =
                      _controller.hasClients &&
                          _controller.position.hasContentDimensions
                      ? (_controller.page ?? _page.toDouble())
                      : _page.toDouble();
                  final distance = (page - index).abs();
                  final scale = 1 - math.min(distance, 1) * 0.06;
                  return Transform.scale(scale: scale, child: child);
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.asset(item.image, fit: BoxFit.cover),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Colors.transparent, Color(0xE625100B)],
                              stops: [0.2, 1],
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Spacer(),
                              Text(
                                item.eyebrow,
                                style: const TextStyle(
                                  color: Color(0xFFF4D8C5),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                item.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 27,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              Text(
                                item.subtitle,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                ),
                              ),
                              const SizedBox(height: 10),
                              InkWell(
                                key: Key(
                                  'spotlight-${item.category.toLowerCase()}',
                                ),
                                onTap: () =>
                                    widget.onSelectCategory(item.category),
                                borderRadius: BorderRadius.circular(16),
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 3),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'Xem lớp học',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      SizedBox(width: 5),
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        color: Colors.white,
                                        size: 16,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_classes.length, (index) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: _page == index ? 21 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _page == index
                      ? AuraColors.darkCoffee
                      : AuraColors.border,
                  borderRadius: BorderRadius.circular(6),
                ),
              );
            }),
          ),
        ),
      ],
    );
  }
}
