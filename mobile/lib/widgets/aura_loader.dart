import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// A compact liquid-inspired loader using Aura's coffee and caramel palette.
class AuraLoader extends StatefulWidget {
  const AuraLoader({
    super.key,
    this.size = 56,
    this.centerColor = AuraColors.darkCoffee,
  });

  final double size;
  final Color centerColor;

  @override
  State<AuraLoader> createState() => _AuraLoaderState();
}

class _AuraLoaderState extends State<AuraLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Đang tải',
    liveRegion: true,
    child: SizedBox.square(
      dimension: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: Size.square(widget.size),
              painter: _AuraLoaderPainter(progress: _controller.value),
            ),
            Icon(
              Icons.fitness_center_rounded,
              size: widget.size * 0.26,
              color: widget.centerColor,
            ),
          ],
        ),
      ),
    ),
  );
}

class _AuraLoaderPainter extends CustomPainter {
  const _AuraLoaderPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.shortestSide * 0.35;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final start = -math.pi / 2 + progress * math.pi * 2;
    final sweep = math.pi * 1.48;

    canvas.drawArc(
      rect,
      start,
      sweep,
      false,
      Paint()
        ..color = AuraColors.caramel.withValues(alpha: 0.28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.shortestSide * 0.16
        ..strokeCap = StrokeCap.round
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.09),
    );
    canvas.drawArc(
      rect,
      start,
      sweep,
      false,
      Paint()
        ..shader = const SweepGradient(
          colors: [
            AuraColors.latte,
            AuraColors.caramel,
            AuraColors.darkCoffee,
            AuraColors.coffee,
            AuraColors.latte,
          ],
        ).createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.shortestSide * 0.09
        ..strokeCap = StrokeCap.round,
    );

    final bubbleColors = [
      AuraColors.latte,
      AuraColors.caramel,
      AuraColors.coffee,
      AuraColors.border,
      AuraColors.darkCoffee,
      AuraColors.latte,
    ];
    for (var i = 0; i < bubbleColors.length; i++) {
      final angle = progress * math.pi * 2 + i * math.pi / 3;
      final pulse = (math.sin(progress * math.pi * 4 + i) + 1) / 2;
      final orbit = radius * (0.72 + pulse * 0.08);
      final bubbleRadius = size.shortestSide * (0.045 + pulse * 0.025);
      final point = center + Offset(math.cos(angle), math.sin(angle)) * orbit;
      canvas.drawCircle(
        point,
        bubbleRadius,
        Paint()
          ..color = bubbleColors[i].withValues(alpha: 0.24)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, bubbleRadius * 1.5),
      );
      canvas.drawCircle(
        point,
        bubbleRadius * 0.72,
        Paint()
          ..shader = RadialGradient(
            colors: [AuraColors.cream, bubbleColors[i]],
          ).createShader(Rect.fromCircle(center: point, radius: bubbleRadius)),
      );
    }

    final coreRadius = size.shortestSide * 0.15;
    canvas.drawCircle(
      center,
      coreRadius,
      Paint()
        ..shader = const RadialGradient(
          colors: [AuraColors.cream, AuraColors.latte],
        ).createShader(Rect.fromCircle(center: center, radius: coreRadius)),
    );
  }

  @override
  bool shouldRepaint(covariant _AuraLoaderPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class AuraLoadingOverlay extends StatelessWidget {
  const AuraLoadingOverlay({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: Stack(
      alignment: Alignment.center,
      children: [
        const ModalBarrier(
          dismissible: false,
          color: Color(0x993B180E),
        ),
        Material(
          color: AuraColors.cream,
          elevation: 16,
          borderRadius: BorderRadius.circular(24),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 25),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AuraColors.border),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const AuraLoader(size: 68),
                const SizedBox(height: 15),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AuraColors.espresso,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                const Text(
                  'Vui lòng đợi trong giây lát',
                  style: TextStyle(color: AuraColors.caramel, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
