import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class PtQrScanScreen extends StatefulWidget {
  const PtQrScanScreen({
    super.key,
    this.title = 'Quét QR buổi PT',
    this.instruction = 'Đưa mã QR trên điện thoại HLV vào khung để bắt đầu buổi tập.',
  });

  final String title;
  final String instruction;

  @override
  State<PtQrScanScreen> createState() => _PtQrScanScreenState();
}

class _PtQrScanScreenState extends State<PtQrScanScreen> {
  bool _handled = false;

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value == null || value.isEmpty) continue;
      _handled = true;
      Navigator.of(context).pop(value);
      return;
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(
      title: Text(widget.title),
      backgroundColor: AuraColors.espresso,
      foregroundColor: Colors.white,
    ),
    body: Stack(
      children: [
        MobileScanner(
          onDetect: _onDetect,
          errorBuilder: (context, error) => const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Không mở được camera. Hãy cấp quyền camera cho ứng dụng rồi thử lại.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
          ),
        ),
        Center(
          child: Container(
            width: 260,
            height: 260,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 3),
              borderRadius: BorderRadius.circular(22),
            ),
          ),
        ),
        Align(
          alignment: Alignment(0, 0.7),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 25),
            child: Text(
              widget.instruction,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class PtSessionQrScreen extends StatefulWidget {
  const PtSessionQrScreen({
    super.key,
    required this.auth,
    required this.booking,
  });

  final AuthService auth;
  final PtBooking booking;

  @override
  State<PtSessionQrScreen> createState() => _PtSessionQrScreenState();
}

class _PtSessionQrScreenState extends State<PtSessionQrScreen> {
  PtSessionQr? _qr;
  DateTime? _generatedAt;
  String? _error;
  bool _loading = false;
  Timer? _timer;

  int get _secondsLeft {
    final generatedAt = _generatedAt;
    if (generatedAt == null) return 0;
    final seconds = 90 - DateTime.now().difference(generatedAt).inSeconds;
    return seconds.clamp(0, 90);
  }

  @override
  void initState() {
    super.initState();
    _generate();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _generatedAt != null) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
      _qr = null;
    });
    try {
      final qr = await widget.auth.generatePtSessionQr(widget.booking.id);
      if (!mounted) return;
      setState(() {
        _qr = qr;
        _generatedAt = DateTime.now();
      });
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AuraColors.cream,
    appBar: AppBar(
      backgroundColor: AuraColors.espresso,
      foregroundColor: Colors.white,
      title: const Text('QR buổi tập PT'),
    ),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AuraColors.border),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.sports_gymnastics_rounded,
                  color: AuraColors.caramel,
                  size: 34,
                ),
                const SizedBox(height: 8),
                Text(
                  widget.booking.memberName ?? 'Hội viên',
                  style: const TextStyle(
                    color: AuraColors.ink,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Cho hội viên quét mã này để bắt đầu buổi tập.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AuraColors.muted),
                ),
                const SizedBox(height: 18),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.all(60),
                    child: AuraLoader(size: 48),
                  )
                else if (_error != null)
                  Padding(
                    padding: const EdgeInsets.all(18),
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AuraColors.caramel),
                    ),
                  )
                else if (_qr != null && _secondsLeft > 0)
                  QrImageView(
                    data: _qr!.token,
                    size: 250,
                    backgroundColor: Colors.white,
                  )
                else
                  const Padding(
                    padding: EdgeInsets.all(30),
                    child: Text(
                      'Mã QR đã hết hạn. Tạo mã mới để hội viên quét.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                const SizedBox(height: 12),
                if (_qr != null && _secondsLeft > 0)
                  Text(
                    'Còn $_secondsLeft giây',
                    style: const TextStyle(
                      color: AuraColors.darkCoffee,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _loading ? null : _generate,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Tạo mã QR mới'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
