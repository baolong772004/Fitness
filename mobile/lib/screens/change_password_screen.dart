import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, required this.auth});

  final AuthService auth;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _hideCurrent = true;
  bool _hideNew = true;
  bool _hideConfirm = true;
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    final clock = Stopwatch()..start();
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await widget.auth.changePassword(
        oldPassword: _currentPassword.text,
        newPassword: _newPassword.text,
      );
      await _keepLoaderVisible(clock);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đổi mật khẩu thành công.')),
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

  String? _validateCurrent(String? value) => (value?.isEmpty ?? true)
      ? 'Nhập mật khẩu hiện tại.'
      : null;

  String? _validateNew(String? value) {
    final password = value ?? '';
    if (password.length < 6) return 'Mật khẩu mới cần ít nhất 6 ký tự.';
    if (!RegExp(r'[A-Za-z]').hasMatch(password) ||
        !RegExp(r'\d').hasMatch(password)) {
      return 'Mật khẩu cần có cả chữ cái và chữ số.';
    }
    if (password == _currentPassword.text) {
      return 'Mật khẩu mới cần khác mật khẩu hiện tại.';
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
              'Thay mật khẩu',
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
                    child: AutofillGroup(
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
                            const Text(
                              'Bảo vệ tài khoản',
                              style: TextStyle(
                                color: AuraColors.espresso,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 7),
                            const Text(
                              'Nhập mật khẩu hiện tại, sau đó tạo mật khẩu mới cho tài khoản Aura của bạn.',
                              style: TextStyle(
                                color: AuraColors.muted,
                                fontSize: 13,
                                height: 1.45,
                              ),
                            ),
                            const SizedBox(height: 24),
                            _passwordField(
                              controller: _currentPassword,
                              label: 'Mật khẩu hiện tại',
                              hidden: _hideCurrent,
                              onToggle: () => setState(
                                () => _hideCurrent = !_hideCurrent,
                              ),
                              validator: _validateCurrent,
                              autofillHints: const [AutofillHints.password],
                              textInputAction: TextInputAction.next,
                            ),
                            const SizedBox(height: 14),
                            _passwordField(
                              controller: _newPassword,
                              label: 'Mật khẩu mới',
                              hidden: _hideNew,
                              onToggle: () => setState(() => _hideNew = !_hideNew),
                              validator: _validateNew,
                              autofillHints: const [AutofillHints.newPassword],
                              textInputAction: TextInputAction.next,
                            ),
                            const SizedBox(height: 14),
                            _passwordField(
                              controller: _confirmPassword,
                              label: 'Nhập lại mật khẩu mới',
                              hidden: _hideConfirm,
                              onToggle: () => setState(
                                () => _hideConfirm = !_hideConfirm,
                              ),
                              validator: (value) => value != _newPassword.text
                                  ? 'Mật khẩu xác nhận chưa khớp.'
                                  : null,
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) => _submit(),
                            ),
                            const SizedBox(height: 9),
                            const Row(
                              children: [
                                Icon(
                                  Icons.info_outline_rounded,
                                  color: AuraColors.muted,
                                  size: 14,
                                ),
                                SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    'Tối thiểu 6 ký tự, gồm chữ cái và chữ số.',
                                    style: TextStyle(
                                      color: AuraColors.muted,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 15),
                              _PasswordError(message: _error!),
                            ],
                            const SizedBox(height: 20),
                            SizedBox(
                              height: 52,
                              child: FilledButton(
                                onPressed: _isLoading ? null : _submit,
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
                                child: _isLoading
                                    ? const AuraLoader(
                                        size: 23,
                                        centerColor: Colors.white,
                                      )
                                    : const Text('Cập nhật mật khẩu'),
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
        ),
        if (_isLoading)
          const AuraLoadingOverlay(message: 'Đang cập nhật mật khẩu...'),
      ],
    ),
  );

  TextFormField _passwordField({
    required TextEditingController controller,
    required String label,
    required bool hidden,
    required VoidCallback onToggle,
    required String? Function(String?) validator,
    Iterable<String>? autofillHints,
    TextInputAction? textInputAction,
    ValueChanged<String>? onSubmitted,
  }) => TextFormField(
    controller: controller,
    enabled: !_isLoading,
    obscureText: hidden,
    autocorrect: false,
    enableSuggestions: false,
    autofillHints: autofillHints,
    textInputAction: textInputAction,
    onFieldSubmitted: onSubmitted,
    validator: validator,
    decoration: InputDecoration(
      labelText: label,
      prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
      suffixIcon: IconButton(
        onPressed: onToggle,
        icon: Icon(
          hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        ),
      ),
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
    ),
  );
}

class _PasswordError extends StatelessWidget {
  const _PasswordError({required this.message});

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
