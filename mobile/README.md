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

## Kết nối backend

Đăng ký và đăng nhập gọi `POST /api/auth/register` và `POST /api/auth/login`. Đăng ký thành công sẽ gọi đăng nhập để nhận access token. Phiên và token được giữ trong bộ nhớ ứng dụng; đăng xuất sẽ xóa chúng.

Mặc định app dùng `http://10.0.2.2:5000/api` cho Android Emulator và `http://localhost:5000/api` cho iOS Simulator. Khi chạy trên điện thoại thật, truyền địa chỉ LAN của máy chạy backend:

```sh
flutter run --dart-define=API_BASE_URL=http://192.168.1.45:5000/api
```

Thay `192.168.1.10` bằng địa chỉ IP của máy bạn. Điện thoại và máy chạy backend cần cùng mạng. Android cho phép HTTP trong debug build để dùng với server local; bản phát hành nên dùng HTTPS.

Các lớp và lịch đặt vẫn là dữ liệu mẫu trong bộ nhớ, chưa kết nối API lịch tập.

## Mã nguồn

```text
lib/
  main.dart                   App và cấu hình tiếng Việt
  theme.dart                  Bảng màu và theme Material
  screens/auth_screen.dart    Đăng ký / đăng nhập
  screens/member_shell.dart   Trang chủ, lịch tập, khám phá, tài khoản
  services/auth_service.dart  Kết nối đăng ký / đăng nhập với backend
  widgets/home_sections.dart Các thành phần giao diện dùng trong mobile
```

`test/widget_test.dart` kiểm tra luồng tài khoản, đặt lịch và kích thước màn hình nhỏ/ngang.
