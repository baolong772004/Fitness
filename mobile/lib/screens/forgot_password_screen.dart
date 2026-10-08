import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    required this.auth,
    this.initialEmail = '',
  });

  final AuthService auth;
  final String initialEmail;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();

  String? _resetToken;
  String? _error;
  bool _isLoading = false;
  bool _isRequestingToken = false;
  bool _hidePassword = true;
  bool _hideConfirmPassword = true;

  @override
  void initState() {
    super.initState();
    _email.text = widget.initialEmail;
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _requestResetToken() async {
    if (_resetToken == null && !_formKey.currentState!.validate()) return;
    final clock = Stopwatch()..start();
    setState(() {
      _isLoading = true;
      _isRequestingToken = true;
      _error = null;
    });

    try {
      final token = await widget.auth.requestPasswordReset(email: _email.text);
      await _keepLoaderVisible(clock);
      if (!mounted) return;
      setState(() => _resetToken = token);
    } on AuthApiException catch (error) {
      await _keepLoaderVisible(clock);
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) return;
    final token = _resetToken;
    if (token == null) return;

    final clock = Stopwatch()..start();
    setState(() {
      _isLoading = true;
      _isRequestingToken = false;
      _error = null;
    });

    try {
      await widget.auth.resetPassword(
        resetToken: token,
        newPassword: _password.text,
      );
      await _keepLoaderVisible(clock);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đổi mật khẩu thành công. Hãy đăng nhập lại.')),
      );
      Navigator.of(context).pop();
    } on AuthApiException catch (error) {
      await _keepLoaderVisible(clock);
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _keepLoaderVisible(Stopwatch clock) async {
    const minimumDuration = Duration(milliseconds: 1100);
    final remaining = minimumDuration - clock.elapsed;
    if (remaining > Duration.zero) await Future<void>.delayed(remaining);
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email)
        ? null
        : 'Nhập email đúng định dạng.';
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.length < 6) return 'Mật khẩu cần ít nhất 6 ký tự.';
    if (!RegExp(r'[A-Za-z]').hasMatch(password) ||
        !RegExp(r'\d').hasMatch(password)) {
      return 'Mật khẩu cần có cả chữ cái và chữ số.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_isLoading,
    child: Stack(
      children: [
        Scaffold(
          backgroundColor: AuraColors.cream,
          appBar: AppBar(
            backgroundColor: AuraColors.espresso,
            foregroundColor: Colors.white,
            title: const Text(
              'Khôi phục mật khẩu',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            elevation: 0,
          ),
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 460),
                  child: Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: AuraColors.border),
                      boxShadow: [
                        BoxShadow(
                          color: AuraColors.espresso.withValues(alpha: 0.1),
                          blurRadius: 24,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            decoration: BoxDecoration(
                              color: AuraColors.latte,
                              borderRadius: BorderRadius.circular(17),
                            ),
                            child: const Icon(
                              Icons.lock_reset_rounded,
                              color: AuraColors.caramel,
                              size: 28,
                            ),
                          ),
                          const SizedBox(height: 17),
                          Text(
                            _resetToken == null
                                ? 'Đặt lại mật khẩu'
                                : 'Tạo mật khẩu mới',
                            style: const TextStyle(
                              color: AuraColors.espresso,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 7),
                          Text(
                            _resetToken == null
                                ? 'Nhập email tài khoản để tiếp tục.'
                                : 'Tạo mật khẩu mới cho tài khoản của bạn.',
                            style: const TextStyle(
                              color: AuraColors.muted,
                              fontSize: 13,
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 23),
                          if (_resetToken == null)
                            TextFormField(
                              controller: _email,
                              enabled: !_isLoading,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.done,
                              autocorrect: false,
                              validator: _validateEmail,
                              decoration: _decoration(
                                'Email',
                                Icons.mail_outline_rounded,
                              ),
                              onFieldSubmitted: (_) => _requestResetToken(),
                            ),
                          if (_resetToken != null) ...[
                            const SizedBox(height: 4),
                            _passwordField(
                              controller: _password,
                              label: 'Mật khẩu mới',
                              hidden: _hidePassword,
                              onToggle: () => setState(
                                () => _hidePassword = !_hidePassword,
                              ),
                              validator: _validatePassword,
                              onSubmitted: (_) => _resetPassword(),
                            ),
                            const SizedBox(height: 13),
                            _passwordField(
                              controller: _confirmPassword,
                              label: 'Nhập lại mật khẩu mới',
                              hidden: _hideConfirmPassword,
                              onToggle: () => setState(
                                () => _hideConfirmPassword =
                                    !_hideConfirmPassword,
                              ),
                              validator: (value) =>
                                  value != _password.text
                                      ? 'Mật khẩu xác nhận chưa khớp.'
                                      : null,
                              onSubmitted: (_) => _resetPassword(),
                            ),
                          ],
                          if (_error != null) ...[
                            const SizedBox(height: 15),
                            _ErrorPanel(message: _error!),
                          ],
                          const SizedBox(height: 20),
                          SizedBox(
                            height: 52,
                            child: FilledButton.icon(
                              onPressed: _isLoading
                                  ? null
                                  : _resetToken == null
                                  ? _requestResetToken
                                  : _resetPassword,
                              icon: Icon(
                                _resetToken == null
                                    ? Icons.mark_email_read_outlined
                                    : Icons.check_rounded,
                              ),
                              label: Text(
                                _resetToken == null
                                    ? 'Tạo mã đặt lại'
                                    : 'Lưu mật khẩu mới',
                              ),
                              style: FilledButton.styleFrom(
                                backgroundColor: AuraColors.darkCoffee,
                                disabledBackgroundColor: AuraColors.coffee
                                    .withValues(alpha: 0.65),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(15),
                                ),
                                textStyle: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (_isLoading)
          AuraLoadingOverlay(
            message: _isRequestingToken
                ? 'Đang tạo mã khôi phục...'
                : 'Đang cập nhật mật khẩu...',
          ),
      ],
    ),
  );

  TextFormField _passwordField({
    required TextEditingController controller,
    required String label,
    required bool hidden,
    required VoidCallback onToggle,
    required String? Function(String?) validator,
    required ValueChanged<String> onSubmitted,
  }) => TextFormField(
    controller: controller,
    enabled: !_isLoading,
    obscureText: hidden,
    autocorrect: false,
    enableSuggestions: false,
    textInputAction: TextInputAction.done,
    validator: validator,
    onFieldSubmitted: onSubmitted,
    decoration: _decoration(label, Icons.lock_outline_rounded).copyWith(
      suffixIcon: IconButton(
        onPressed: onToggle,
        icon: Icon(
          hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        ),
      ),
    ),
  );

  InputDecoration _decoration(String label, IconData icon) => InputDecoration(
    labelText: label,
    prefixIcon: Icon(icon, size: 20),
    filled: true,
    fillColor: const Color(0xFFFCFAF8),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AuraColors.border),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AuraColors.border),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: AuraColors.caramel, width: 1.5),
    ),
  );
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.error_outline_rounded,
          color: Theme.of(context).colorScheme.error,
          size: 19,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ),
      ],
    ),
  );
}
