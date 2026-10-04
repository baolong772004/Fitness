class Member {
  const Member({
    required this.name,
    required this.email,
    this.balance = '\$6000',
  });

  final String name;
  final String email;
  final String balance;
}

/// In-memory UI prototype. Replace with the backend auth API for production.
/// Credentials and sessions are never written to device storage.
class DemoAuth {
  DemoAuth() {
    // Pre-populate default test accounts for user
    _registerDefault('Chewy Chewbaca', 'chewy@aura.fit', '123456', '\$6000');
    _registerDefault('Aura Member', 'demo@aura.fit', '123456', '\$8500');
  }

  final Map<String, ({Member member, String password})> _accounts = {};
  Member? currentMember;

  void _registerDefault(
    String name,
    String email,
    String password,
    String balance,
  ) {
    final key = email.trim().toLowerCase();
    final member = Member(name: name, email: key, balance: balance);
    _accounts[key] = (member: member, password: password);
  }

  String? register(String name, String email, String password) {
    final key = email.trim().toLowerCase();
    if (_accounts.containsKey(key)) return 'Email này đã được đăng ký.';
    final member = Member(name: name.trim(), email: key, balance: '\$6000');
    _accounts[key] = (member: member, password: password);
    currentMember = member;
    return null;
  }

  String? login(String email, String password) {
    final account = _accounts[email.trim().toLowerCase()];
    if (account == null || account.password != password) {
      return 'Email hoặc mật khẩu chưa chính xác.';
    }
    currentMember = account.member;
    return null;
  }

  void logout() => currentMember = null;
}
