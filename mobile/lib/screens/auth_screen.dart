import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/aura_loader.dart';
import 'forgot_password_screen.dart';

enum AuthCompletion { loggedIn, registered }

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.auth, this.register = false});

  final AuthService auth;
  final bool register;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  static const _googleServerClientId = '64327623006-atl8dp6tgs3g650ts542b8ig0f9p54n2.apps.googleusercontent.com';
  static const _googleIosClientId =
      String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');
  static Future<void>? _googleInitialization;

  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  late bool _register = widget.register;
  bool _hidePassword = true;
  bool _hideConfirm = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_name, _phone, _email, _password, _confirm]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;

    final loadingClock = Stopwatch()..start();
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      if (_register) {
        await widget.auth.register(
          name: _name.text,
          email: _email.text,
          password: _password.text,
          phone: _phone.text,
        );
      } else {
        await widget.auth.login(email: _email.text, password: _password.text);
      }

      await _keepLoaderVisible(loadingClock);
      if (!mounted) return;
      Navigator.pop(
        context,
        _register ? AuthCompletion.registered : AuthCompletion.loggedIn,
      );
    } on AuthApiException catch (error) {
      await _keepLoaderVisible(loadingClock);
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      await _keepLoaderVisible(loadingClock);
      if (mounted) {
        setState(() {
          _error = 'KhÃ´ng thá»ƒ Ä‘Äƒng nháº­p Google. HÃ£y kiá»ƒm tra cáº¥u hÃ¬nh vÃ  thá»­ láº¡i.';
        });
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    if (_isSubmitting) return;
    FocusScope.of(context).unfocus();
    final loadingClock = Stopwatch()..start();
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final google = GoogleSignIn.instance;
      _googleInitialization ??= google.initialize(
        clientId: _googleIosClientId.isEmpty ? null : _googleIosClientId,
        serverClientId: _googleServerClientId.isEmpty
            ? null
            : _googleServerClientId,
      );
      try {
        await _googleInitialization;
      } catch (_) {
        _googleInitialization = null;
        rethrow;
      }

      if (!google.supportsAuthenticate()) {
        throw const AuthApiException(
          'Google Sign-In khÃ´ng Ä‘Æ°á»£c há»— trá»£ trÃªn thiáº¿t bá»‹ nÃ y.',
        );
      }

      final account = await google.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const AuthApiException(
          'Google chÆ°a tráº£ vá» mÃ£ xÃ¡c thá»±c. HÃ£y kiá»ƒm tra cáº¥u hÃ¬nh Google OAuth.',
        );
      }

      await widget.auth.loginWithGoogle(idToken: idToken);
      await _keepLoaderVisible(loadingClock);
      if (!mounted) return;
      Navigator.pop(context, AuthCompletion.loggedIn);
    } on GoogleSignInException catch (error) {
      await _keepLoaderVisible(loadingClock);
      if (!mounted || error.code == GoogleSignInExceptionCode.canceled) return;
      setState(() {
        _error = error.code == GoogleSignInExceptionCode.clientConfigurationError
            ? 'Cáº¥u hÃ¬nh Google OAuth chÆ°a Ä‘Ãºng. Kiá»ƒm tra Client ID, package name vÃ  SHA-1.'
            : 'KhÃ´ng thá»ƒ Ä‘Äƒng nháº­p Google. Vui lÃ²ng thá»­ láº¡i.';
      });
    } on AuthApiException catch (error) {
      await _keepLoaderVisible(loadingClock);
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _keepLoaderVisible(Stopwatch clock) async {
    const minimumDuration = Duration(milliseconds: 1100);
    final remaining = minimumDuration - clock.elapsed;
    if (remaining > Duration.zero) await Future<void>.delayed(remaining);
  }

  void _setMode(bool register) {
    if (_register == register || _isSubmitting) return;
    setState(() {
      _register = register;
      _error = null;
      _password.clear();
      _confirm.clear();
      _hidePassword = true;
      _hideConfirm = true;
    });
    _form.currentState?.reset();
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return PopScope(
      canPop: !_isSubmitting,
      child: Stack(
        children: [
          Scaffold(
      backgroundColor: AuraColors.cream,
      appBar: AppBar(
        backgroundColor: AuraColors.espresso,
        foregroundColor: Colors.white,
        titleSpacing: 20,
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.spa_outlined, size: 20),
            SizedBox(width: 9),
            Text(
              'AURA FITNESS',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.3,
              ),
            ),
          ],
        ),
        elevation: 0,
      ),
      body: Stack(
        children: [
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 165,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AuraColors.espresso, AuraColors.darkCoffee],
                ),
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(36),
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: LayoutBuilder(
              builder: (context, _) => SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: EdgeInsets.fromLTRB(18, 22, 18, 24 + keyboardInset),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 460),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(6, 2, 6, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 11,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: Colors.white24),
                                ),
                                child: const Text(
                                  'HÀNH TRÌNH KHỎE HƠN BẮT ĐẦU TỪ ĐÂY',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              AnimatedSwitcher(
                                duration: const Duration(milliseconds: 220),
                                child: Text(
                                  _register
                                      ? 'Tạo tài khoản'
                                      : 'Chào mừng trở lại',
                                  key: ValueKey(_register),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 27,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                _register
                                    ? 'Đăng ký để bắt đầu tập luyện cùng Aura.'
                                    : 'Đăng nhập để tiếp tục hành trình của bạn.',
                                style: const TextStyle(
                                  color: Color(0xFFE8D8CF),
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(26),
                            border: Border.all(
                              color: AuraColors.border.withValues(alpha: 0.8),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: AuraColors.espresso.withValues(
                                  alpha: 0.12,
                                ),
                                blurRadius: 26,
                                offset: const Offset(0, 12),
                              ),
                            ],
                          ),
                          child: AutofillGroup(
                            child: Form(
                              key: _form,
                              autovalidateMode:
                                  AutovalidateMode.onUserInteraction,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _ModeSwitcher(
                                    register: _register,
                                    onChanged: _setMode,
                                  ),
                                  const SizedBox(height: 21),
                                  AnimatedSize(
                                    duration: const Duration(milliseconds: 250),
                                    curve: Curves.easeInOut,
                                    child: Column(
                                      key: ValueKey(_register),
                                      children: [
                                        if (_register) ...[
                                          _buildField(
                                            key: const Key('register-name'),
                                            controller: _name,
                                            label: 'Họ và tên',
                                            icon: Icons.person_outline_rounded,
                                            textCapitalization:
                                                TextCapitalization.words,
                                            textInputAction:
                                                TextInputAction.next,
                                            validator: (value) =>
                                                (value?.trim().length ?? 0) < 2
                                                ? 'Nhập họ tên từ 2 ký tự trở lên.'
                                                : null,
                                          ),
                                          const SizedBox(height: 13),
                                          _buildField(
                                            key: const Key('register-phone'),
                                            controller: _phone,
                                            label:
                                                'Số điện thoại (không bắt buộc)',
                                            icon: Icons.phone_outlined,
                                            keyboardType: TextInputType.phone,
                                            textInputAction:
                                                TextInputAction.next,
                                            autofillHints: const [
                                              AutofillHints.telephoneNumber,
                                            ],
                                            validator: _validatePhone,
                                          ),
                                          const SizedBox(height: 13),
                                        ],
                                        _buildField(
                                          key: const Key('auth-email'),
                                          controller: _email,
                                          label: 'Email',
                                          icon: Icons.mail_outline_rounded,
                                          keyboardType:
                                              TextInputType.emailAddress,
                                          textInputAction: TextInputAction.next,
                                          autofillHints: const [
                                            AutofillHints.email,
                                          ],
                                          autocorrect: false,
                                          validator: _validateEmail,
                                        ),
                                        const SizedBox(height: 13),
                                        _buildPasswordField(
                                          key: const Key('auth-password'),
                                          controller: _password,
                                          label: 'Mật khẩu',
                                          hidden: _hidePassword,
                                          onToggle: () => setState(
                                            () =>
                                                _hidePassword = !_hidePassword,
                                          ),
                                          autofillHints: _register
                                              ? const [
                                                  AutofillHints.newPassword,
                                                ]
                                              : const [AutofillHints.password],
                                          textInputAction: _register
                                              ? TextInputAction.next
                                              : TextInputAction.done,
                                          onFieldSubmitted: _register
                                              ? null
                                              : (_) => _submit(),
                                          validator: _validatePassword,
                                        ),
                                        if (!_register) ...[
                                          const SizedBox(height: 2),
                                          Align(
                                            alignment: Alignment.centerRight,
                                            child: TextButton(
                                              key: const Key('forgot-password'),
                                              onPressed: _isSubmitting
                                                  ? null
                                                  : () {
                                                      Navigator.of(context).push(
                                                        MaterialPageRoute<void>(
                                                          builder: (_) =>
                                                              ForgotPasswordScreen(
                                                                auth: widget.auth,
                                                                initialEmail:
                                                                    _email.text
                                                                        .trim(),
                                                              ),
                                                        ),
                                                      );
                                                    },
                                              style: TextButton.styleFrom(
                                                foregroundColor:
                                                    AuraColors.caramel,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 4,
                                                    ),
                                                visualDensity:
                                                    VisualDensity.compact,
                                              ),
                                              child: const Text(
                                                'Quên mật khẩu?',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                        if (_register) ...[
                                          const SizedBox(height: 13),
                                          _buildPasswordField(
                                            key: const Key('auth-confirm'),
                                            controller: _confirm,
                                            label: 'Nhập lại mật khẩu',
                                            hidden: _hideConfirm,
                                            onToggle: () => setState(
                                              () =>
                                                  _hideConfirm = !_hideConfirm,
                                            ),
                                            textInputAction:
                                                TextInputAction.done,
                                            onFieldSubmitted: (_) => _submit(),
                                            validator: (value) =>
                                                value != _password.text
                                                ? 'Mật khẩu xác nhận chưa khớp.'
                                                : null,
                                          ),
                                          const SizedBox(height: 9),
                                          const _PasswordHint(),
                                        ],
                                      ],
                                    ),
                                  ),
                                  if (_error != null) ...[
                                    const SizedBox(height: 15),
                                    _ErrorNotice(message: _error!),
                                  ],
                                  const SizedBox(height: 19),
                                  SizedBox(
                                    height: 52,
                                    child: FilledButton(
                                      key: const Key('auth-submit'),
                                      onPressed: _isSubmitting ? null : _submit,
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AuraColors.darkCoffee,
                                        disabledBackgroundColor: AuraColors
                                            .coffee
                                            .withValues(alpha: 0.65),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            15,
                                          ),
                                        ),
                                        elevation: 0,
                                      ),
                                      child: _isSubmitting
                                          ? const AuraLoader(
                                              size: 23,
                                              centerColor: Colors.white,
                                            )
                                          : Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.center,
                                              children: [
                                                Text(
                                                  _register
                                                      ? 'Tạo tài khoản'
                                                      : 'Đăng nhập',
                                                  style: const TextStyle(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                const Icon(
                                                  Icons.arrow_forward_rounded,
                                                  size: 18,
                                                ),
                                              ],
                                      ),
                                    ),
                                  ),
                                  if (!_register) ...[
                                    const SizedBox(height: 14),
                                    Row(
                                      children: [
                                        const Expanded(
                                          child: Divider(color: AuraColors.border),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                          ),
                                          child: Text(
                                            'HOẶC',
                                            style: TextStyle(
                                              color: AuraColors.muted,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w800,
                                              letterSpacing: 1,
                                            ),
                                          ),
                                        ),
                                        const Expanded(
                                          child: Divider(color: AuraColors.border),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    SizedBox(
                                      height: 50,
                                      child: OutlinedButton(
                                        key: const Key('google-sign-in'),
                                        onPressed: _isSubmitting
                                            ? null
                                            : _signInWithGoogle,
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: AuraColors.darkCoffee,
                                          side: const BorderSide(
                                            color: AuraColors.border,
                                          ),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(
                                              15,
                                            ),
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            const _GoogleMark(),
                                            const SizedBox(width: 10),
                                            const Text(
                                              'Tiếp tục với Google',
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 13),
                                  Text(
                                    _register
                                        ? 'Thông tin tài khoản giúp bạn sử dụng các tính năng hội viên.'
                                        : 'Đăng nhập để quản lý tài khoản và lịch tập.',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: AuraColors.muted,
                                      fontSize: 11,
                                      height: 1.4,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.verified_user_outlined,
                              color: AuraColors.muted,
                              size: 15,
                            ),
                            SizedBox(width: 6),
                            Text(
                              'Đồng hành cùng bạn trên từng chặng đường',
                              style: TextStyle(
                                color: AuraColors.muted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
          ),
          ),
          if (_isSubmitting)
            AuraLoadingOverlay(
              message: _register
                  ? 'Đang tạo tài khoản...'
                  : 'Đang đăng nhập...',
            ),
        ],
      ),
    );
  }

  Widget _buildField({
    required Key key,
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required String? Function(String?) validator,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    Iterable<String>? autofillHints,
    TextCapitalization textCapitalization = TextCapitalization.none,
    bool autocorrect = true,
  }) {
    return TextFormField(
      key: key,
      controller: controller,
      enabled: !_isSubmitting,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      textCapitalization: textCapitalization,
      autocorrect: autocorrect,
      validator: validator,
      decoration: _inputDecoration(label, icon),
    );
  }

  Widget _buildPasswordField({
    required Key key,
    required TextEditingController controller,
    required String label,
    required bool hidden,
    required VoidCallback onToggle,
    required String? Function(String?) validator,
    Iterable<String>? autofillHints,
    TextInputAction? textInputAction,
    ValueChanged<String>? onFieldSubmitted,
  }) {
    return TextFormField(
      key: key,
      controller: controller,
      enabled: !_isSubmitting,
      obscureText: hidden,
      enableSuggestions: false,
      autocorrect: false,
      autofillHints: autofillHints,
      textInputAction: textInputAction,
      onFieldSubmitted: onFieldSubmitted,
      validator: validator,
      decoration: _inputDecoration(label, Icons.lock_outline_rounded).copyWith(
        suffixIcon: IconButton(
          tooltip: hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
          onPressed: onToggle,
          icon: Icon(
            hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon) =>
      InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 20),
        filled: true,
        fillColor: const Color(0xFFFCFAF8),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 16,
        ),
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
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Theme.of(context).colorScheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.error,
            width: 1.5,
          ),
        ),
      );

  String? _validatePhone(String? value) {
    final phone = value?.trim() ?? '';
    if (phone.isEmpty) return null;
    if (!RegExp(r'^\+?[0-9 ()-]+$').hasMatch(phone)) {
      return 'Số điện thoại chỉ gồm chữ số và dấu +, -, khoảng trắng.';
    }
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    return digits.length < 8 || digits.length > 15
        ? 'Số điện thoại cần từ 8 đến 15 chữ số.'
        : null;
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email)
        ? null
        : 'Nhập email đúng định dạng, ví dụ ten@email.com.';
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (!_register) {
      return password.length < 6 ? 'Mật khẩu cần ít nhất 6 ký tự.' : null;
    }
    if (password.length < 6) return 'Mật khẩu cần ít nhất 6 ký tự.';
    if (!RegExp(r'[A-Za-z]').hasMatch(password) ||
        !RegExp(r'\d').hasMatch(password)) {
      return 'Mật khẩu cần có cả chữ cái và chữ số.';
    }
    return null;
  }
}

class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) => const SizedBox(
    width: 21,
    height: 21,
    child: Center(
      child: Text(
        'G',
        style: TextStyle(
          color: Color(0xFF4285F4),
          fontSize: 21,
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
  );
}

class _ModeSwitcher extends StatelessWidget {
  const _ModeSwitcher({required this.register, required this.onChanged});

  final bool register;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: AuraColors.cream,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      children: [
        _ModeButton(
          label: 'Đăng nhập',
          selected: !register,
          onTap: () => onChanged(false),
        ),
        _ModeButton(
          label: 'Đăng ký',
          selected: register,
          onTap: () => onChanged(true),
        ),
      ],
    ),
  );
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(11),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(11),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AuraColors.darkCoffee.withValues(alpha: 0.08),
                      blurRadius: 7,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: selected ? AuraColors.darkCoffee : AuraColors.muted,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ),
      ),
    ),
  );
}

class _PasswordHint extends StatelessWidget {
  const _PasswordHint();

  @override
  Widget build(BuildContext context) => const Align(
    alignment: Alignment.centerLeft,
    child: Row(
      children: [
        Icon(Icons.info_outline_rounded, color: AuraColors.muted, size: 14),
        SizedBox(width: 6),
        Expanded(
          child: Text(
            'Dùng ít nhất 6 ký tự, gồm chữ cái và chữ số.',
            style: TextStyle(color: AuraColors.muted, fontSize: 11),
          ),
        ),
      ],
    ),
  );
}

class _ErrorNotice extends StatelessWidget {
  const _ErrorNotice({required this.message});

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
          child: Semantics(
            liveRegion: true,
            child: Text(
              message,
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
                fontSize: 13,
                height: 1.35,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
