# 🔑 TỔNG HỢP TÀI KHOẢN ẢO KIỂM THỬ UX/UI (TEST ACCOUNTS)
## Hệ Thống Quản Lý Trung Tâm Thể Thao (Sports Center Management System - AURA FITNESS)
*Tài liệu dành cho Giảng viên, Ban Giám khảo và Đội ngũ Kiểm thử UX/UI*

---

## ⚡ 1. TÍNH NĂNG ĐĂNG NHẬP 1-CHẠM (1-CLICK DEMO LOGIN)
Hệ thống đã tích hợp sẵn tính năng **1-Click Demo Login** ngay trong Modal Đăng Nhập:
* Bạn chỉ cần bấm nút **"Đăng Nhập"** trên thanh Navbar.
* Nhấp vào các thẻ tài khoản demo tương ứng (Admin, Lễ Tân, Master Coach, Member).
* Hệ thống sẽ **tự động điền tài khoản, mật khẩu và đăng nhập ngay lập tức**!

---

## 📋 2. BẢNG TÀI KHOẢN ĐĂNG NHẬP HỆ THỐNG WEB (WEB LOGIN CREDENTIALS)
*Hệ thống Web được thiết kế chuyên biệt cho công tác vận hành và quản lý trung tâm (Staff/Operations Portal). Khách vãng lai (`guest`) là trạng thái công khai mặc định không cần đăng nhập.*

| STT | Họ và Tên | Vai Trò (Role) | Email Đăng Nhập | Số Điện Thoại | Mật Khẩu | Mã OTP Test | Quyền Hạn & Mục Đích Kiểm Thử |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | **Hoàng Quản Lý** | `admin` | `admin@aurafitness.vn` | `0900 111 222` | `admin123` | `888999` | **Center Manager:** Toàn quyền quản trị, BI Analytics, Heatmap cao điểm, đổi giá Coach, xem hồ sơ Member 360°, Audit log. |
| **2** | **Thu Ngân (Lễ Tân)** | `receptionist` | `reception@aurafitness.vn` | `0900 333 444` | `staff123` | `888999` | **Receptionist:** Quầy Check-in QR, POS bán gói tại quầy, xuất hóa đơn VietQR/MoMo/Tiền mặt, in hóa đơn K80, ticket hỗ trợ. |
| **3** | **Trần Tuấn Hùng** | `coach` | `tuanhung@aurafitness.vn` | `0912 345 678` | `coach123` | `888999` | **Master Coach:** Xem lịch dạy hôm nay, điểm danh buổi tập & trừ Quota PT, xử lý học bù vắng mặt, gợi ý giáo án AI. Đơn giá: 650.000đ/buổi. |
| **4** | **Nguyễn Lan Anh** | `coach` | `lananh@aurafitness.vn` | `0988 765 432` | `coach123` | `888999` | **Senior Yoga Coach:** Giảng viên khóa Yoga trị liệu, thiết lập mục tiêu Macros dinh dưỡng cho học viên. Đơn giá: 400.000đ/buổi. |

> ℹ️ **LƯU Ý VỀ VAI TRÒ GUEST & MEMBER:**
> * **Khách vãng lai (`guest`):** Là trạng thái người dùng truy cập trang chủ (Landing Page) để xem bảng giá, lịch lớp, đội ngũ HLV và đặt lịch tập thử. **Không có tài khoản đăng nhập** và **không cần đăng nhập**.
> * **Hội viên (`member`):** Đăng ký tập luyện sẽ sử dụng Ứng dụng Di Động (Mobile App) riêng biệt. Danh sách dữ liệu hội viên bên dưới dùng để mô phỏng quét mã thẻ QR tại quầy Lễ Tân:

### 🪪 Danh sách Hội viên mô phỏng Quét Thẻ QR (Dành cho Lễ Tân test Check-in):
| Mã Thẻ QR | Họ và Tên | Gói Tập Hiện Tại | Thời Hạn Gói | Quota PT | Kịch bản kiểm thử |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MEM-1001` | **Nguyễn Văn An** | VIP Hybrid Gold | Còn 12 ngày | Còn 5/8 buổi | Test **Check-in thành công (Tít xanh du dương)** |
| `MEM-1002` | **Trần Thị Mai** | Standard Gym 1 Tháng | Còn 2 ngày | - | Test **Cảnh báo vàng sắp hết hạn & Gia hạn** |
| `MEM-1003` | **Lê Hoàng Nam** | Standard Gym 1 Tháng | Đã hết hạn 28 ngày | - | Test **Báo động đỏ Từ chối vào cửa (Bíp cảnh báo)** |

---

## 🎯 3. KỊCH BẢN KIỂM THỬ UX/UI MẪU (STEP-BY-STEP TEST SCENARIOS)

### 🧪 Kịch bản 1: Kiểm thử Cổng Check-in QR Quầy Lễ Tân (Luồng 3)
1. Chọn vai trò **Lễ Tân (Front-Desk)** hoặc click nút **"Quét QR Test"** trên thanh Navbar.
2. Tại cột bên trái **"Hội viên demo nhanh"**:
   * Nhấp chọn **Nguyễn Văn An (MEM-1001)**:
     * *Kết quả mong đợi:* Hệ thống phát âm thanh **Tít xanh du dương**, popup hiển thị trạng thái `CHECK-IN THÀNH CÔNG! CỬA ĐÃ MỞ`, hiển thị rõ Quota PT còn `5/8 buổi`.
   * Nhấp chọn **Lê Hoàng Nam (MEM-1003)**:
     * *Kết quả mong đợi:* Hệ thống phát âm thanh **Bíp đỏ cảnh báo**, popup hiển thị `TỪ CHỐI CHECK-IN: GÓI TẬP ĐÃ HẾT HẠN!`, xuất hiện nút điều hướng nhanh *"Gia Hạn Gói Nhanh Tại Quầy"*.

---

### 🧪 Kịch bản 2: Bán gói tại quầy & Thanh toán VietQR / In Hóa Đơn (Luồng 2)
1. Tại giao diện Lễ tân, chuyển sang tab **"Bán Gói Tại Quầy (POS)"**.
2. Nhập thông tin khách mới: Họ tên, Số điện thoại.
3. Chọn gói tập: Chọn **Gói VIP Hybrid Gold (Gym + 8 Buổi PT)** hoặc **Khóa Chuyên Biệt Boxing Bootcamp**.
4. Nhấn **"Tiến Hành Thu Tiền & Kích Hoạt Gói"**:
   * Modal thanh toán mở ra.
   * Chuyển đổi giữa 3 phương thức: **Chuyển khoản VietQR**, **Ví MoMo**, và **Tiền mặt (COD)**.
   * Nhấn nút **"[Giả Lập Thanh Toán Thành Công]"**.
   * Hệ thống phát âm thanh thành công, hiển thị **Biên lai thu tiền điện tử chuẩn hóa**.
   * Bấm nút **"In Hóa Đơn"** để kiểm tra giao diện in ấn của trình duyệt.

---

### 🧪 Kịch bản 3: Huấn Luyện Viên Xử Lý Buổi Tập & Trừ Buổi PT Quota (Luồng 5)
1. Đăng nhập hoặc chuyển sang vai trò **Huấn Luyện Viên (Coach)**.
2. Tại tab **"Lịch Dạy & Điểm Danh"**:
   * Tìm buổi tập của học viên **Nguyễn Văn An**.
   * Bấm **"Bắt Đầu Buổi"**: Đồng hồ bấm giờ tập luyện thực tế bắt đầu đếm.
   * Bấm **"Kết Thúc & Ghi Nhận"**: Mở form đánh giá mức tạ, số rep, cường độ 1-5 sao và nhận xét.
   * Bấm **"Lưu Kết Quả & Trừ 1 Buổi PT Quota"**: Hệ thống tự động trừ 1 buổi của Nguyễn Văn An (từ 5 buổi xuống 4 buổi).

---

### 🧪 Kịch bản 4: Xử lý Vắng Mặt & Chính Sách Học Bù (Makeup Session)
1. Tại danh sách buổi tập của Huấn Luyện Viên, bấm nút **"Báo Vắng"** ở một buổi tập.
2. Hộp thoại điều kiện học bù mở ra:
   * Nếu chọn **Báo trước $\ge 4$ tiếng**: Hệ thống xác nhận *Có phép* -> Học viên được cấp 01 buổi học bù (không trừ lượt tập).
   * Nếu chọn **Báo trước $< 4$ tiếng**: Hệ thống xác nhận *Không phép* -> Tính trừ 01 buổi tập theo chính sách chống bỏ giờ.

---

### 🧪 Kịch bản 5: Khởi Tạo Giáo Án Tập Luyện Bằng AI
1. Trong giao diện Coach, chọn tab **"Gợi Ý Giáo Án (AI)"**.
2. Chọn mục tiêu: *Giảm mỡ & Săn chắc*, *Tăng cơ bắp*, hoặc *Phục hồi thắt lưng*.
3. Nhập ghi chú chấn thương (ví dụ: *Đau khớp gối nhẹ*).
4. Nhấn **"Khởi Tạo Giáo Án Với AI"**:
   * Hệ thống tính toán và trả về giáo án chi tiết gồm tên bài tập, số set/rep, lượng Calo tiêu hao ước tính và lưu ý an toàn.

---

### 🧪 Kịch bản 6: Quản Lý Trung Tâm (Center Manager) - BI & Đổi Giá Riêng Coach
1. Chuyển sang vai trò **Center Manager (Admin)**.
2. Tại tab **"Tổng Quan & BI Báo Cáo"**:
   * Quan sát thẻ Doanh thu tháng, biểu đồ cơ cấu doanh thu và **Heatmap Giờ Cao Điểm** (17:30 - 20:30).
3. Tại tab **"Quản Lý Member 360°"**:
   * Bấm **"Xem Hồ Sơ 360°"** của một hội viên để xem trọn vẹn lịch sử tập, gói đang dùng và chỉ số InBody.
4. Tại tab **"Quản Lý & Giá Coach"**:
   * Tìm HLV Trần Tuấn Hùng, bấm **"Cấu Hình Giá & Cấp Bậc"**.
   * Thay đổi đơn giá buổi lẻ (ví dụ từ 650.000đ lên 700.000đ).
   * Bấm lưu -> Hệ thống tự động cập nhật và ghi nhận hành động vào **Nhật Ký Thao Tác (Audit Trail)**.

---

### 🧪 Kịch bản 7: Tiếp Nhận Báo Cáo Sự Cố Tại Quầy & Ban Quản Lý (Admin) Chỉ Đạo Giao Việc (Hai Chiều)
1. **Lễ tân gửi báo cáo:**
   * Đăng nhập vai trò **Thu Ngân (Lễ Tân)** -> Vào tab **"Hỗ Trợ & Yêu Cầu"**.
   * Tại form bên phải, chọn phân loại (VD: *Yêu cầu bảo lưu gói tập*), nhập tên khách *Nguyễn Văn An*, SĐT *0901 234 567*, tiêu đề: *Xin bảo lưu 10 ngày do đi công tác*.
   * Bấm **"Gửi Báo Cáo / Yêu Cầu Đến Quản Lý"** -> Hệ thống thông báo gửi thành công, cấp mã `TCK-XXXX`.
2. **Admin xem xét, phản hồi & giao việc:**
   * Đăng xuất, đăng nhập vào vai trò **Hoàng Quản Lý (Admin)**.
   * Trên thanh Navbar, nhấp vào tab mới **"Xử Lý Báo Cáo & Yêu Cầu"** (hoặc bấm thẻ KPI *"Báo Cáo / Sự Cố Chờ Duyệt"*).
   * Tìm báo cáo của Nguyễn Văn An, bấm nút **"Chỉ Đạo & Phản Hồi Xử Lý"**.
   * Bấm mẫu chỉ đạo nhanh: *"👉 Duyệt bảo lưu thẻ: Giao Lễ tân cập nhật hạn thẻ & báo khách"*.
   * Mục phân công chọn: **"⚡ Yêu cầu Lễ Tân xử lý tiếp"**, trạng thái: **"🟡 Đang Chỉ Đạo Xử Lý"**.
   * Bấm **"Ban Hành Chỉ Đạo & Gửi Lệnh"** -> Hệ thống phát âm thanh thành công, cập nhật trạng thái và ghi Audit Log.
3. **Lễ tân nhận chỉ đạo & hoàn tất giải quyết:**
   * Đăng nhập lại vai trò **Lễ Tân** -> Vào tab **"Hỗ Trợ & Yêu Cầu"**.
   * Trên thẻ báo cáo xuất hiện khung nổi bật: **👨‍💼 CHỈ ĐẠO TỪ BAN QUẢN LÝ (ADMIN)** kèm huy hiệu **⚡ Yêu cầu Lễ tân xử lý tiếp**.
   * Sau khi Lễ tân liên hệ khách và điều chỉnh ngày hạn thẻ, bấm nút **"✓ Xác Nhận Đã Xử Lý Xong Theo Chỉ Đạo"**.
   * Báo cáo chuyển thành trạng thái **"🟢 Đã Giải Quyết"** và đồng bộ tức thời với Quản lý!

---

### 🧪 Kịch bản 8: Cài Đặt Hệ Thống & Đăng Xuất An Toàn
1. Nhấp vào menu **Tài khoản / Cài Đặt** trên thanh Navbar.
2. Thay đổi thông tin cá nhân hoặc cấu hình quy định trung tâm (giờ mở cửa, hotline).
3. Bấm **"Đăng Xuất"**: Hệ thống xóa phiên đăng nhập an toàn và đưa người dùng về trạng thái Khách công khai.

---
*Tài liệu này được cập nhật nhằm hỗ trợ công tác kiểm thử và nghiệm thu đồ án môn học WDP301.*

