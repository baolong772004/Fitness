# Café Fit — Flutter mobile

Ứng dụng hội viên viết bằng Flutter/Dart, có project Android và iOS.
Mã nguồn, theme và điều hướng nằm trong `mobile`; không import hay dùng chung giao diện với `frontend`.

## Chạy ứng dụng

Yêu cầu Flutter 3.47.4 / Dart 3.13.3 hoặc phiên bản tương thích mới hơn.

```sh
cd mobile
flutter pub get
flutter devices
flutter run
```

Mở Android Emulator hoặc kết nối điện thoại có USB debugging trước khi chạy.
Có thể chọn thiết bị bằng `flutter run -d <device-id>`.
Chạy iOS cần macOS, Xcode và simulator/thiết bị iOS.

```sh
flutter analyze
flutter test
flutter build apk --debug
```

Nếu `flutter doctor` báo thiếu Android cmdline-tools, mở Android Studio → SDK Manager → SDK Tools → cài Android SDK Command-line Tools (latest).
Sau đó chạy `flutter doctor --android-licenses` và đọc/chấp nhận các điều khoản trên máy của bạn.

## Giao diện và luồng

- Chủ đạo nâu cà phê–trắng; hỗ trợ bàn phím, cuộn trang, safe area và tiếng Việt.
- Trang chủ khách hiển thị Đăng ký/Đăng nhập. Khi đăng nhập hiển thị tên thật từ form.
- Màn hình đăng ký và đăng nhập riêng, kiểm tra email, mật khẩu, xác nhận mật khẩu và email trùng.
- Thanh điều hướng Trang chủ / Lịch tập / Khám phá / Tài khoản.
- Tìm lớp, chọn ngày, đặt/hủy chỗ và đăng xuất.

## Dữ liệu hiện tại

Backend hiện chưa có API tài khoản hoặc đặt lịch. `lib/services/demo_auth.dart` là dịch vụ mô phỏng trong bộ nhớ:

- Đăng ký trước, sau đó đăng xuất và đăng nhập lại trong cùng lần mở app.
- Tài khoản, phiên đăng nhập và lịch đặt được xóa khi khởi động lại app.
- Không lưu mật khẩu vào file hay bộ nhớ thiết bị.
- Các lớp là dữ liệu mẫu lặp lại cho 7 ngày tiếp theo. Đặt chỗ chỉ thay đổi dữ liệu trong lần chạy hiện tại, chưa gửi về server.

Khi kết nối backend, thay dịch vụ mô phỏng bằng API xác thực và API đặt lịch; lưu token phiên bằng kho lưu trữ bảo mật của thiết bị.

## Mã nguồn

```text
lib/
  main.dart                   App và cấu hình tiếng Việt
  theme.dart                  Bảng màu và theme Material
  screens/auth_screen.dart    Đăng ký / đăng nhập
  screens/member_shell.dart   Trang chủ, lịch tập, khám phá, tài khoản
  services/demo_auth.dart     Tài khoản mô phỏng
  widgets/home_sections.dart Các thành phần giao diện dùng trong mobile
```

`test/widget_test.dart` kiểm tra luồng tài khoản, đặt lịch và kích thước màn hình nhỏ/ngang.
