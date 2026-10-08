import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class PayOsCheckoutScreen extends StatefulWidget {
  const PayOsCheckoutScreen({
    super.key,
    required this.auth,
    required this.package,
    required this.checkout,
    this.isRenewal = false,
    this.isPtPurchase = false,
  });

  final AuthService auth;
  final FitnessPackage package;
  final PayOsCheckout checkout;
  final bool isRenewal;
  final bool isPtPurchase;

  @override
  State<PayOsCheckoutScreen> createState() => _PayOsCheckoutScreenState();
}

class _PayOsCheckoutScreenState extends State<PayOsCheckoutScreen> {
  Timer? _statusTimer;
  bool _isChecking = false;
  bool _isOpeningPayOs = false;
  bool _isPaid = false;
  bool _isCancelled = false;
  String? _statusError;
  String _paymentStatus = 'PENDING';

  @override
  void initState() {
    super.initState();
    unawaited(_checkStatus());
    _statusTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_checkStatus()),
    );
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    if (_isChecking || _isPaid || _isCancelled) return;
    setState(() {
      _isChecking = true;
      _statusError = null;
    });
    try {
      final result = await widget.auth.checkPayOsPaymentStatus(
        orderCode: widget.checkout.orderCode,
      );
      if (!mounted) return;
      final status = result.status.toUpperCase();
      setState(() {
        _paymentStatus = status;
        _isPaid = result.isPaid;
        _isCancelled =
            status == 'CANCELLED' || status == 'FAILED' || status == 'EXPIRED';
      });
      if (_isPaid || _isCancelled) _statusTimer?.cancel();
    } on AuthApiException catch (error) {
      if (mounted) setState(() => _statusError = error.message);
    } finally {
      if (mounted) setState(() => _isChecking = false);
    }
  }

  Future<void> _openPayOs() async {
    if (_isOpeningPayOs) return;
    setState(() => _isOpeningPayOs = true);
    try {
      final uri = Uri.tryParse(widget.checkout.checkoutUrl);
      if (uri == null || !uri.hasScheme) {
        throw const FormatException('Invalid checkout URL');
      }
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) {
        _showMessage('Không mở được trang PayOS. Bạn có thể quét mã QR để thanh toán.');
      }
    } on FormatException {
      if (mounted) _showMessage('Link thanh toán PayOS không hợp lệ.');
    } catch (_) {
      if (mounted) _showMessage('Không mở được PayOS. Vui lòng thử lại.');
    } finally {
      if (mounted) setState(() => _isOpeningPayOs = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  String _formatPrice(double value) {
    final digits = value.round().toString();
    final result = StringBuffer();
    for (var index = 0; index < digits.length; index++) {
      if (index > 0 && (digits.length - index) % 3 == 0) result.write('.');
      result.write(digits[index]);
    }
    return '${result.toString()} đ';
  }

  @override
  Widget build(BuildContext context) {
    final isFinished = _isPaid || _isCancelled;
    final statusColor = _isPaid
        ? const Color(0xFF2E8B57)
        : _isCancelled
        ? Theme.of(context).colorScheme.error
        : AuraColors.caramel;

    return Scaffold(
      backgroundColor: AuraColors.cream,
      appBar: AppBar(
        backgroundColor: AuraColors.espresso,
        foregroundColor: Colors.white,
        title: Text(
          widget.isRenewal ? 'Gia hạn gói tập' : 'Thanh toán PayOS',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AuraColors.espresso, AuraColors.darkCoffee],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(21),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.lock_rounded,
                    color: AuraColors.latte,
                    size: 25,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.package.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Đơn hàng #${widget.checkout.orderCode}',
                          style: const TextStyle(
                            color: Color(0xFFE8D8CF),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _formatPrice(widget.package.price),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: statusColor.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  if (_isChecking && !isFinished)
                    const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AuraColors.caramel,
                      ),
                    )
                  else
                    Icon(
                      _isPaid
                          ? Icons.check_circle_rounded
                          : _isCancelled
                          ? Icons.cancel_rounded
                          : Icons.schedule_rounded,
                      color: statusColor,
                      size: 19,
                    ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      _isPaid
                          ? widget.isRenewal
                                ? 'Thanh toán thành công. Thời hạn gói tập đã được gia hạn.'
                                : 'Thanh toán thành công. Gói tập đã được xác nhận.'
                          : _isCancelled
                          ? _paymentStatus == 'EXPIRED'
                                ? 'Đơn thanh toán đã hết hạn. Hãy quay lại để tạo đơn mới.'
                                : 'Đơn thanh toán đã bị hủy. Hãy quay lại để tạo đơn mới.'
                          : _statusError ?? 'Đang chờ PayOS xác nhận thanh toán…',
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(23),
                boxShadow: [
                  BoxShadow(
                    color: AuraColors.espresso.withValues(alpha: 0.09),
                    blurRadius: 18,
                    offset: const Offset(0, 7),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const Text(
                    'Quét mã bằng ứng dụng ngân hàng',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AuraColors.darkCoffee,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Hoặc mở trang PayOS để chọn phương thức thanh toán.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AuraColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: AuraColors.border),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: QrImageView(
                      data: widget.checkout.qrCode,
                      size: 230,
                      version: QrVersions.auto,
                      gapless: false,
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: AuraColors.darkCoffee,
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: AuraColors.ink,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: FilledButton.icon(
                      onPressed: isFinished || _isOpeningPayOs
                          ? null
                          : _openPayOs,
                      style: FilledButton.styleFrom(
                        backgroundColor: AuraColors.darkCoffee,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      icon: _isOpeningPayOs
                          ? const SizedBox.square(
                              dimension: 19,
                              child: AuraLoader(
                                size: 19,
                                centerColor: Colors.white,
                              ),
                            )
                          : const Icon(Icons.open_in_new_rounded, size: 19),
                      label: Text(
                        _isOpeningPayOs ? 'Đang mở PayOS…' : 'Mở trang PayOS',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  TextButton.icon(
                    onPressed: _isChecking || isFinished ? null : _checkStatus,
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Kiểm tra trạng thái thanh toán'),
                  ),
                ],
              ),
            ),
            if (_isPaid) ...[
              const SizedBox(height: 18),
              SizedBox(
                height: 50,
                child: FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF2E8B57),
                  ),
                  child: Text(
                    widget.isPtPurchase
                        ? 'Tiếp tục đặt lịch'
                        : widget.isRenewal
                        ? 'Hoàn tất gia hạn'
                        : 'Hoàn tất',
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
