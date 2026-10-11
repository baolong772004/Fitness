# Aura Fitness React Native

Ứng dụng Expo/React Native độc lập trong `mobile-react-native/`. Ứng dụng Flutter cũ trong `mobile/` vẫn được giữ nguyên. Mã ứng dụng Android và iOS của bản này là `com.aurafitness.mobile.reactnative`, vì vậy có thể cài song song với Flutter.

## Chạy Android

1. Tạo `.env` từ `.env.example` và đặt `EXPO_PUBLIC_API_BASE_URL`:
   - Emulator Android: `http://10.0.2.2:5000/api`
   - Điện thoại thật: `http://<IPv4-LAN-của-máy-tính>:5000/api`. Điện thoại và máy tính cần cùng mạng, backend phải nghe trên mạng LAN.
2. Chạy backend như dự án hiện tại.
3. Trong thư mục này chạy `npm.cmd ci`, rồi dùng script build đường dẫn ngắn bên dưới và cài APK đúng kiến trúc thiết bị.
4. Chạy `npx.cmd expo start --dev-client` rồi mở app trên thiết bị.

Đường dẫn workspace hiện tại khá dài, có thể làm CMake/Ninja trên Windows không tạo được bản Android. Dùng script dưới đây để build ở thư mục tạm có đường dẫn ngắn. Chọn đúng kiến trúc thiết bị:

```powershell
# Điện thoại Android ARM64
./scripts/build-android-short-path.ps1

# Emulator Android x86_64
./scripts/build-android-short-path.ps1 -Architecture x86_64
```

APK được lưu ở `builds/aura-fitness-react-native-<kiến-trúc>-debug.apk`. Khi chạy trên điện thoại thật, đặt IP LAN của máy chạy backend trong `.env` trước khi khởi động Metro. APK này là development build; để mở giao diện, chạy `npx.cmd expo start --dev-client` trong `mobile-react-native/` và kết nối điện thoại với Metro. Thư mục `builds/` không được đưa vào Git.

Đăng nhập Google dùng native Google Sign-In, nên cần **development build**; Expo Go không chứa native module này. Android OAuth Client phải đăng ký package `com.aurafitness.mobile.reactnative` với SHA-1 của bản APK thực tế. Giá trị Android Client ID dùng để đăng ký ở Google Cloud, không phải đưa vào `.env`; ID token được phát cho Web Client ID đang cấu hình trong backend. Khi dùng khóa ký khác, đăng ký thêm SHA-1 tương ứng.

## iOS

Đặt `EXPO_PUBLIC_API_BASE_URL` thành IP LAN hoặc URL HTTPS của backend. Để bật Google Sign-In trên iPhone, tạo iOS OAuth Client cho bundle ID `com.aurafitness.mobile.reactnative`, thêm `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` vào `.env`, rồi build lại native app. Đăng nhập email/mật khẩu không cần iOS Client ID.

## Các luồng đã chuyển

Trang chủ và bài viết, đăng nhập/đăng ký/khôi phục mật khẩu, cửa hàng gói và PayOS, Membership/PT, lịch Workout Class, QR check-in gym/lớp/PT, lịch PT và nhắn tin Coach, thông báo, lịch sử điểm danh, tiến độ InBody, nhật ký tập và Giáo án & Dinh dưỡng. Dữ liệu được gọi trực tiếp từ backend hiện tại, phiên đăng nhập lưu bằng SecureStore.

| Flutter `mobile/lib` | React Native `src/app` |
| --- | --- |
| `member_shell.dart`, `home_showcase.dart`, `home_sections.dart`, `home_editorial.dart` | `(tabs)/index.tsx`, `(tabs)/booking.tsx`, `(tabs)/qr.tsx`, `(tabs)/notifications.tsx`, `(tabs)/account.tsx`, `article.tsx`, `articles.tsx` |
| `auth_screen.dart`, `forgot_password_screen.dart`, `change_password_screen.dart` | `auth.tsx`, `forgot-password.tsx`, `change-password.tsx` |
| `package_store_screen.dart`, `my_subscriptions_screen.dart`, `payos_checkout_screen.dart` | `packages.tsx`, `subscriptions.tsx`, `checkout.tsx` |
| `group_class_screen.dart`, `checkin_history_screen.dart` | `classes.tsx`, `scanner.tsx`, `history.tsx` |
| `pt_journey_screen.dart`, `pt_booking_screen.dart`, `pt_chat_screen.dart`, `pt_qr_screen.dart` | `pt.tsx`, `pt-book.tsx`, `pt-chat.tsx`, `pt-qr.tsx`, `scanner.tsx` |
| `workout_progress_screen.dart` | `progress.tsx` |

Tab QR chứa trực tiếp ba mục “Lịch tập”, “Check in”, “PT” như Flutter. Lịch PT cũng mở riêng từ tab Đặt lịch. Các ảnh trang chủ và tin tức được sao chép sang `assets/images/`.

## Cấu hình cần biết

- Thay IP trong `.env` khi chuyển từ emulator sang điện thoại thật; `localhost` trên điện thoại không phải máy tính chạy backend.
- Phần Google Android chỉ hoạt động sau khi OAuth Client được gắn đúng package và SHA-1. Để lấy SHA-1 của APK, xem hướng dẫn [Google Sign-In cho Expo](https://docs.expo.dev/guides/google-authentication/).
- iOS Google Client ID hiện chưa có trong cấu hình dự án; nút Google sẽ báo yêu cầu cấu hình trên iPhone cho đến khi ID được cung cấp.
