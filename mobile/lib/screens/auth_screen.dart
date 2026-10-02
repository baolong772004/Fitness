import 'package:flutter/material.dart';

import '../services/demo_auth.dart';
import '../theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.auth, this.register = false});
  final DemoAuth auth;
  final bool register;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  late bool _register = widget.register;
  bool _hidePassword = true;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_name, _email, _password, _confirm]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!_form.currentState!.validate()) return;
    final error = _register
        ? widget.auth.register(_name.text, _email.text, _password.text)
        : widget.auth.login(_email.text, _password.text);
    if (error != null) {
      setState(() => _error = error);
    } else {
      Navigator.pop(context, true);
    }
  }

  void _switchMode() {
    _form.currentState?.reset();
    setState(() {
      _register = !_register;
      _error = null;
      _password.clear();
      _confirm.clear();
      _hidePassword = true;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AuraColors.espresso,
    appBar: AppBar(
      title: const Text('AURA FITNESS'),
      backgroundColor: AuraColors.espresso,
      foregroundColor: Colors.white,
    ),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AuraColors.cream,
                borderRadius: BorderRadius.circular(28),
              ),
              child: AutofillGroup(
                child: Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: CircleAvatar(
                          backgroundColor: AuraColors.latte,
                          foregroundColor: AuraColors.coffee,
                          radius: 28,
                          child: Icon(Icons.fitness_center, size: 28),
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'AURA FITNESS MEMBER',
                        style: TextStyle(
                          color: AuraColors.caramel,
                          letterSpacing: 2,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _register ? 'Tạo tài khoản' : 'Chào mừng trở lại',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _register
                            ? 'Bắt đầu hành trình tập luyện của bạn.'
                            : 'Đăng nhập để tiếp tục hành trình khỏe hơn.',
                        style: const TextStyle(color: AuraColors.muted),
                      ),
                      const SizedBox(height: 28),
                      if (_register) ...[
                        TextFormField(
                          key: const Key('register-name'),
                          controller: _name,
                          autofillHints: const [AutofillHints.name],
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Họ và tên',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                          validator: (value) => (value?.trim().length ?? 0) < 2
                              ? 'Vui lòng nhập họ và tên.'
                              : null,
                        ),
                        const SizedBox(height: 16),
                      ],
                      TextFormField(
                        key: const Key('auth-email'),
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'Email',
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                        validator: (value) =>
                            !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                                .hasMatch(value?.trim() ?? '')
                            ? 'Vui lòng nhập email hợp lệ.'
                            : null,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        key: const Key('auth-password'),
                        controller: _password,
                        obscureText: _hidePassword,
                        enableSuggestions: false,
                        autocorrect: false,
                        autofillHints: [
                          _register
                              ? AutofillHints.newPassword
                              : AutofillHints.password,
                        ],
                        textInputAction: _register
                            ? TextInputAction.next
                            : TextInputAction.done,
                        onFieldSubmitted: (_) {
                          if (!_register) _submit();
                        },
                        decoration: InputDecoration(
                          labelText: 'Mật khẩu',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _hidePassword
                                ? 'Hiện mật khẩu'
                                : 'Ẩn mật khẩu',
                            onPressed: () =>
                                setState(() => _hidePassword = !_hidePassword),
                            icon: Icon(
                              _hidePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                          ),
                        ),
                        validator: (value) => (value?.length ?? 0) < 6
                            ? 'Mật khẩu cần ít nhất 6 ký tự.'
                            : null,
                      ),
                      if (_register) ...[
                        const SizedBox(height: 16),
                        TextFormField(
                          key: const Key('auth-confirm'),
                          controller: _confirm,
                          obscureText: _hidePassword,
                          enableSuggestions: false,
                          autocorrect: false,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                          decoration: const InputDecoration(
                            labelText: 'Xác nhận mật khẩu',
                            prefixIcon: Icon(Icons.lock_outline),
                          ),
                          validator: (value) =>
                              value != _password.text ||
                                  (value?.isEmpty ?? true)
                              ? 'Mật khẩu xác nhận chưa khớp.'
                              : null,
                        ),
                      ],
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: Semantics(
                            liveRegion: true,
                            child: Text(
                              _error!,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 24),
                      FilledButton(
                        key: const Key('auth-submit'),
                        onPressed: _submit,
                        child: Text(_register ? 'Đăng ký' : 'Đăng nhập'),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _register ? 'Đà có tài khoản?' : 'Chưa có tài khoản?',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AuraColors.muted),
                      ),
                      TextButton(
                        key: const Key('auth-switch'),
                        onPressed: _switchMode,
                        child: Text(_register ? 'Đăng nhập' : 'Đăng ký ngay'),
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
  );
}
