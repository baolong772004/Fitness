import 'package:cafe_fit_mobile/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> launch(
  WidgetTester tester, {
  Size size = const Size(390, 844),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(const AuraFitApp());
  await tester.pumpAndSettle();
}

Future<void> submit(WidgetTester tester) async {
  await tester.ensureVisible(find.byKey(const Key('auth-submit')));
  await tester.tap(find.byKey(const Key('auth-submit')));
  await tester.pumpAndSettle();
}

Future<void> fillRegistration(WidgetTester tester) async {
  await tester.enterText(find.byKey(const Key('register-name')), 'Lan Anh');
  await tester.enterText(
    find.byKey(const Key('auth-email')),
    'lan@example.com',
  );
  await tester.enterText(find.byKey(const Key('auth-password')), 'test1234');
  await tester.enterText(find.byKey(const Key('auth-confirm')), 'test1234');
}

void main() {
  testWidgets(
    'Guest home renders on a small phone and opens both auth screens',
    (tester) async {
      await launch(tester, size: const Size(320, 640));
      expect(find.byKey(const Key('home-register')), findsOneWidget);
      expect(find.byKey(const Key('home-login')), findsOneWidget);
      final err = tester.takeException();
      if (err is FlutterError) {
        for (final d in err.diagnostics) {
          // ignore: avoid_print
          print('DIAGNOSTIC: ${d.name} -> ${d.value}');
        }
      }
      expect(err, isNull);

      await tester.tap(find.byKey(const Key('home-login')));
      await tester.pumpAndSettle();
      expect(find.text('Chào mừng trở lại'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('home-register')));
      await tester.pumpAndSettle();
      expect(find.text('Tạo tài khoản'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Register, logout, reject wrong password, then login with the same account',
    (tester) async {
      await launch(tester);
      await tester.tap(find.byKey(const Key('home-register')));
      await tester.pumpAndSettle();
      await fillRegistration(tester);
      await submit(tester);
      expect(find.text('Xin chào Lan Anh!'), findsOneWidget);
      expect(find.byKey(const Key('home-login')), findsNothing);
      await tester.tap(find.text('Tài khoản'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('logout')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('home-login')), findsOneWidget);

      await tester.tap(find.byKey(const Key('home-login')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('auth-email')),
        'LAN@example.com',
      );
      await tester.enterText(
        find.byKey(const Key('auth-password')),
        'incorrect',
      );
      await submit(tester);
      expect(find.text('Email hoặc mật khẩu chưa chính xác.'), findsOneWidget);
      await tester.enterText(
        find.byKey(const Key('auth-password')),
        'test1234',
      );
      await submit(tester);
      expect(find.text('Xin chào Lan Anh!'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Registration validates empty fields and password confirmation', (
    tester,
  ) async {
    await launch(tester);
    await tester.tap(find.byKey(const Key('home-register')));
    await tester.pumpAndSettle();
    await submit(tester);
    expect(find.text('Vui lòng nhập họ và tên.'), findsOneWidget);
    expect(find.text('Vui lòng nhập email hợp lệ.'), findsOneWidget);
    expect(find.text('Mật khẩu cần ít nhất 6 ký tự.'), findsOneWidget);
    await fillRegistration(tester);
    await tester.enterText(find.byKey(const Key('auth-confirm')), 'different');
    await submit(tester);
    expect(find.text('Mật khẩu xác nhận chưa khớp.'), findsOneWidget);
    expect(find.text('Xin chào Lan Anh!'), findsNothing);
  });

  testWidgets(
    'Guest booking requires login and cancelling leaves the class unbooked',
    (tester) async {
      await launch(tester);
      await tester.tap(find.text('Đặt lịch'));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView).first, const Offset(0, -300));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Đặt chỗ').first);
      await tester.pumpAndSettle();
      expect(find.text('Chào mừng trở lại'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('Đã book'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Member can book and cancel a class', (tester) async {
    await launch(tester);
    await tester.tap(find.byKey(const Key('home-register')));
    await tester.pumpAndSettle();
    await fillRegistration(tester);
    await submit(tester);
    await tester.tap(find.text('Đặt lịch'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đặt chỗ').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    expect(find.text('Đã book'), findsOneWidget);
    await tester.tap(find.text('Đã book'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy đặt chỗ'));
    await tester.pumpAndSettle();
    expect(find.text('Đã book'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Landscape phone auth form stays scrollable above the keyboard', (
    tester,
  ) async {
    await launch(tester, size: const Size(700, 360));
    final registerBtn = find.byKey(const Key('home-register'));
    await tester.tap(registerBtn);
    await tester.pumpAndSettle();
    tester.view.viewInsets = const FakeViewPadding(bottom: 140);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    await fillRegistration(tester);
    await submit(tester);
    expect(find.text('Xin chào Lan Anh!'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
