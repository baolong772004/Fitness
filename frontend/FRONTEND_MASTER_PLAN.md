# 🏋️‍♂️ SPORTS CENTER MANAGEMENT SYSTEM (GYM/FITNESS)
## 📋 FRONT-END MASTER ARCHITECTURE & IMPLEMENTATION PLAN
**Tác giả:** Senior Front-End Solution Architect (20+ Years Experience)  
**Dự án:** Hệ thống Quản lý Trung tâm Thể thao & Thể hình Chuyên nghiệp (Sports Center Management System)  
**Design System Tham chiếu:** `DESIGN.md` (Freeletics Athletic Tokens: `#FE7413`, `#37474F`, `#161E21`, `#CFD8DC`)  
**Phiên bản:** 1.1.0 (Refined with Mobile Decoupling, Mock Payment Engine & AI Stubbing Strategy)  
**Ngày cập nhật:** 2026-09-28  

---

## 📑 MỤC LỤC
1. [TỔNG QUAN KIẾN TRÚC & ĐỊNH HƯỚNG CÔNG NGHỆ](#1-tổng-quan-kiến-trúc--định-hướng-công-nghệ)
2. [HỆ THỐNG THIẾT KẾ (DESIGN SYSTEM TOKENS) THEO DESIGN.MD](#2-hệ-thống-thiết-kế-design-system-tokens-theo-designmd)
3. [CHIẾN LƯỢC ĐA NỀN TẢNG (WEB PORTAL & DECOUPLED MOBILE APP)](#3-chiến-lược-đa-nền-tảng-web-portal--decoupled-mobile-app)
4. [CHI TIẾT 4 VAI TRÒ CHÍNH & VAI TRÒ GUEST](#4-chi-tiết-4-vai-trò-chính--vai-trò-guest)
   - 4.1. Member (Mobile App - React Native/Flutter/Capacitor & Web Member Simulator)
   - 4.2. Coach (Web Portal & Tablet View)
   - 4.3. Receptionist / Lễ tân (Web POS & Quầy Check-in Siêu tốc)
   - 4.4. Center Manager / Admin (Executive Web BI Dashboard)
   - 4.5. Guest (Public Landing Page & Khóa học chuyên sâu)
5. [CHI TIẾT 10 LUỒNG NGHIỆP VỤ CỐT LÕI (CORE FLOWS & STATE MACHINES)](#5-chi-tiết-10-luồng-nghiệp-vụ-cốt-lõi-core-flows--state-machines)
6. [CÁC TÍNH NĂNG ĐẶC THÙ & ĐỘC BẢN (SPECIALIZED CAPABILITIES)](#6-các-tính-năng-đặc-thù--độc-bản-specialized-capabilities)
   - Gói Hybrid (Vào tập tự do 100% + Hạn mức buổi PT)
   - Cơ chế Đổi Coach & Bù trừ chênh lệch giá tự động
   - Book thêm buổi PT với Bảng giá riêng từng Coach
   - Kế hoạch Dinh dưỡng & Tracking Macros/InBody
   - Khóa học chuyên biệt (Specialized Courses / Workshops)
   - Kiến trúc Giả lập Thanh toán (Mock Payment Gateway: VNPay, MoMo, COD)
   - Kiến trúc Module AI Dự phòng (Plug-and-Play AI Stubs & Contract)
7. [CẤU TRÚC THƯ MỤC DỰ ÁN (ENTERPRISE FOLDER STRUCTURE)](#7-cấu-trúc-thư-mục-dự-án-enterprise-folder-structure)
8. [LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (SPRINT ROADMAP & MILESTONES)](#8-lộ-trình-triển-khai-theo-giai-đoạn-sprint-roadmap--milestones)
9. [BẢO MẬT, TỐI ƯU HIỆU NĂNG & TIÊU CHUẨN KIỂM THỬ (QA/UX)](#9-bảo-mật-tối-ưu-hiệu-năng--tiêu-chuẩn-kiểm-thử-qaux)

---

## 1. TỔNG QUAN KIẾN TRÚC & ĐỊNH HƯỚNG CÔNG NGHỆ

Với 20 năm kinh nghiệm dẫn dắt và thiết kế các hệ thống quản trị quy mô lớn, kiến trúc được thiết kế nhằm đạt 3 mục tiêu sống còn:
1. **Zero-Backend Readiness (Sẵn sàng chạy độc lập không cần Backend):** Tích hợp Mock Service Engine, LocalStorage/IndexedDB State và Mock Payment Simulator, cho phép chạy thử nghiệm và demo đồ án mượt mà 100% các luồng nghiệp vụ ngay từ ngày đầu.
2. **Strict Design System Consistency:** Thừa hưởng trọn vẹn bản sắc thể thao tràn đầy năng lượng từ `DESIGN.md` (Phong cách Freeletics Athletic).
3. **Decoupled Multi-Platform:** Tách bạch rõ ràng giữa Web Portal (Admin, Receptionist, Coach, Guest) và Phân hệ Mobile Member (đóng gói Capacitor / React Native / Flutter) với lớp dữ liệu dùng chung (Shared Contracts & Types).

### 1.1. Core Tech Stack
* **Framework:** React 19 + TypeScript (Strict Type Safety, Zero `any`).
* **Build Tool:** Vite 6+ (Cực nhanh, tối ưu Bundle Chunking, Hot Module Replacement dưới 50ms).
* **State Management & Caching:**
  * *Server/Mock State:* **TanStack Query (React Query v5)** - Quản lý cache, stale-while-revalidate, optimistic updates khi đặt lịch hoặc điểm danh.
  * *Global Client State:* **Zustand** - Quản lý Auth State, App Preferences, Session Draft, Giỏ hàng/Đơn booking, Active QR Code.
* **Styling & Theming:**
  * Vanilla CSS Variables & CSS Modules kế thừa 100% token từ `DESIGN.md`.
  * Không phụ thuộc nặng nề vào các framework CSS cồng kềnh, ưu tiên tốc độ hiển thị và hiệu ứng chuyển động thể thao 60fps.
* **Component Primitives & Icons:**
  * Headless primitives: Radix UI (Bảo đảm chuẩn Accessibility WCAG 2.1 AA).
  * Icons: Lucide React (Bộ icon thể thao, biểu tượng sắc nét).
* **Form & Validation:** React Hook Form + Zod (Validation schema nghiêm ngặt, tự động map thông báo lỗi tiếng Việt).
* **Data Visualization & Timelines:**
  * Recharts / Chart.js (Báo cáo doanh thu, retention rate, biểu đồ tiến trình InBody, phân bổ Macro dinh dưỡng).
  * Custom CSS Grid Athletic Scheduler (Lịch tập cá nhân, lịch phòng, lịch lớp trực quan).
* **Local Data & Payment Simulation:**
  * Local Mock Engine (IndexedDB / LocalStorage Persistence) giả lập toàn bộ Database (Thành viên, Gói tập, Đơn hàng, Lịch booking).
  * Mock Payment Engine: Giả lập thanh toán VietQR / VNPay Sandbox, MoMo Sandbox và COD tại quầy.

---

## 2. HỆ THỐNG THIẾT KẾ (DESIGN SYSTEM TOKENS) THEO DESIGN.MD

Kế thừa chính xác bản sắc thẩm mỹ thể thao tràn đầy năng lượng từ `DESIGN.md`:

```
                        🎨 BẢNG MÃ MÀU CHỦ ĐẠO
┌───────────────────────┬──────────────┬──────────────────────────────────────────┐
│ Token                 │ Hex Code     │ Ứng dụng giao diện                       │
├───────────────────────┼──────────────┼──────────────────────────────────────────┤
│ --color-primary       │ #FE7413      │ Cam năng lượng: CTA Button, Badge, Highlight│
│ --color-secondary     │ #37474F      │ Xám Slate đậm: Card header, Secondary Nav│
│ --color-tertiary      │ #0000EE      │ Xanh Accent: Link phụ, Thông tin hỗ trợ  │
│ --color-surface       │ #CFD8DC      │ Xám khói nhạt: Background Cards, Borders  │
│ --color-on-surface    │ #161E21      │ Đen Obsidian: Text chính, Dark Theme Base│
│ --color-bg-dark       │ #10251E / #0D1619 │ Nền ứng dụng chính, tương phản cao  │
│ --color-success       │ #00C853      │ Check-in hợp lệ, Đặt lịch thành công     │
│ --color-danger        │ #D50000      │ Hết hạn gói, Trùng lịch, Check-in từ chối│
└───────────────────────┴──────────────┴──────────────────────────────────────────┘
```

### 2.1. Typography System
* **Primary Display Font:** `AktivGrotesk` (Mạnh mẽ, hiện đại, tối ưu cho giao diện thể thao & fitness).
* **Data/Metrics Monospace Font:** `Iosevka` (Sắc nét, dùng hiển thị Calo, Số buổi PT còn lại, Đồng hồ đếm ngược, Mã giao dịch hóa đơn).
* **Thang kích thước chuẩn:**
  * H1 Hero: `74px / 48px` (Line-height 1.1, Font-weight 524).
  * H2 Section Title: `40px / 32px`.
  * H3 Card Title: `24px` (Line-height 1.4).
  * Body Text: `16px / 18px` (Line-height 1.4).
  * Small / Metadata: `14px / 12px`.

### 2.2. Spacing Scale & Shapes (Bo góc)
* **Spacing Scale (Base 8px):**
  * `xs`: 2.5px | `sm`: 8px | `md`: 10px | `lg`: 12px | `xl`: 16px | `xxl`: 16.8px | `xxxl`: 24px | `xxxxl`: 32px.
* **Corner Radius (Shapes):**
  * `sm`: 8px (Form Input, Badge góc vuông bo nhẹ).
  * `md`: 27.5px (Cards, Dashboard Panels).
  * `lg`: 36.7px (Modal containers, Hero card banners).
  * `full`: 9999px (Pill Buttons - Nút bấm con nhộng thể thao đặc trưng Freeletics, Tag lọc).

### 2.3. Buttons & Elevation
* **Athletic Pill Button:** `border-radius: 9999px; padding: 12px 28px; font-weight: 700; transition: transform 0.2s ease, box-shadow 0.2s ease;`
* **Box Shadows:** Đổ bóng sâu đa tầng `rgba(0, 0, 0, 0.25) 0px 4px 12px` mang lại cảm giác công nghệ, nổi khối.

---

## 3. CHIẾN LƯỢC ĐA NỀN TẢNG (WEB PORTAL & DECOUPLED MOBILE APP)

Dự án áp dụng mô hình phân tách độc lập (Decoupled Multi-Platform Strategy) đáp ứng đúng định hướng của nhóm:

```
                            ┌──────────────────────────────────────┐
                            │    SPORTS CENTER PLATFORM ECOSYSTEM   │
                            └──────────────────┬───────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               │                                                               │
    📱 MOBILE APP (MEMBER PORTAL)                               💻 WEB PORTAL REPOSITORY
    (React Native / Flutter / Capacitor)                     (ADMIN, STAFF, COACH, GUEST)
┌──────────────────────────────────────┐            ┌──────────────────────────────────────────┐
│ • Đóng gói Native App / Capacitor    │            │ • Web Quản trị Trung tâm (Admin BI)      │
│ • Thao tác 1 chạm trên smartphone    │            │ • Quầy Lễ tân POS & Check-in siêu tốc    │
│ • Mã QR Check-in động (chống chụp)   │            │ • Workspace tương tác cho Huấn luyện viên│
│ • Đặt lịch PT & Group Class tức thì  │            │ • Landing Page công khai cho Guest       │
│ • Xem nhật ký tập & kế hoạch ăn uống │            │ • [TÍCH HỢP] Member Mobile Viewport      │
│ • Chia sẻ Type Contract với Web repo │            │   Simulator (Để test và demo trực tiếp)  │
└──────────────────────────────────────┘            └──────────────────────────────────────────┘
```

> [!NOTE]
> **Điểm sáng kiến trúc:** Trong Web Repo hiện tại, ngoài các giao diện Web cho Admin, Lễ tân, Coach và Guest, kiến trúc sẽ cung cấp sẵn một **Member Mobile Viewport Simulator** (Khung mô phỏng thiết bị di động có thể bật/tắt trên thanh điều hướng). Điều này giúp nhóm vừa có thể demo trọn vẹn luồng của Member trên trình duyệt Web khi bảo vệ đồ án, vừa sẵn sàng xuất gói module này sang Capacitor / React Native khi triển khai app di động thực tế.

---

## 4. CHI TIẾT 4 VAI TRÒ CHÍNH & VAI TRÒ GUEST

### 4.1. MEMBER (Học viên / Thành viên) - Mobile Interface
* **Màn hình Trang chủ (Home Hub):**
  * Widget Quick QR: Nút bật ngay mã QR cá nhân kèm mã OTP nhảy mỗi 30 giây để check-in tại quầy/cổng từ.
  * Thẻ trạng thái Gói tập: Hiển thị trạng thái Gói tập hiện tại (Số ngày còn lại) + Bộ đếm Quota buổi tập PT (VD: `Đã dùng 3/10 buổi`).
  * Buổi tập tiếp theo: Thông tin buổi tập sắp diễn ra kèm nút "Chỉ đường" hoặc "Đổi lịch".
  * Lối tắt AI Assistant: Đặt câu hỏi nhanh về bài tập hôm nay.
* **Màn hình Gói tập & Cửa hàng (Membership & Store):**
  * Danh mục gói: Gói Hội viên Standard/VIP (Không giới hạn vào phòng tập).
  * Mua thêm buổi PT: Danh sách Coach kèm đơn giá niêm yết riêng từng người (`VD: Coach A - 300k/buổi; Master Coach B - 500k/buổi`).
  * Danh mục Khóa học chuyên biệt (Yoga Bay, Boxing Bootcamp, Pilates Reformer).
  * Quy trình thanh toán: Hỗ trợ giả lập chuyển khoản VietQR, ví MoMo và đặt cọc/thanh toán tại quầy (COD).
* **Màn hình Lịch tập & Đặt chỗ (Schedule & Booking):**
  * Tab 1: Group Class (Danh sách lớp Yoga, Zumba, HIIT; số ghế còn trống; huấn luyện viên phụ trách).
  * Tab 2: Personal Trainer (Chọn Coach -> Xem khung giờ trống -> Xác nhận đặt lịch).
  * Tab 3: Lịch của tôi (Lịch đã đặt, lịch sử điểm danh, kết quả từng buổi, tính năng Đổi/Hủy lịch có áp dụng chính sách báo trước).
* **Màn hình Kế hoạch Tập luyện & Dinh dưỡng (Training & Nutrition):**
  * Kế hoạch tập luyện cá nhân do Coach soạn (hoặc mẫu AI).
  * Nhật ký dinh dưỡng: Báo cáo lượng Calo mục tiêu, Carbs, Protein, Fat, tính năng ghi nhận bữa ăn.
  * Theo dõi chỉ số cơ thể: Biểu đồ cân nặng, % mỡ, chỉ số InBody.
* **Màn hình Trợ lý Ảo (AI Fitness Assistant):**
  * Giao diện Chatbot dự phòng với giao diện chat trực quan, có câu trả lời mẫu sẵn sàng kết nối API sau này.
* **Màn hình Cá nhân (Profile & Settings):**
  * Thông tin tài khoản, lịch sử hóa đơn giao dịch, chính sách chuyển nhượng/đổi Coach, liên hệ hỗ trợ.

---

### 4.2. COACH (Huấn luyện viên) - Web Portal & Tablet View
* **Dashboard Lịch dạy (Coach Scheduler):**
  * Xem lịch tổng quan dạng Ngày / Tuần / Tháng.
  * Phân biệt rõ lịch: Lớp nhóm (Group Class) vs Buổi dạy cá nhân (1-on-1 PT).
  * Bộ lọc trạng thái: Đã xác nhận, Chờ học viên đến, Đã hoàn thành, Vắng mặt.
* **Màn hình Buổi tập & Điểm danh (Session Execution Terminal):**
  * Điểm danh 1-click hoặc quét mã học viên.
  * Bắt đầu buổi tập -> Bấm kết thúc buổi tập -> Form ghi nhận chỉ số (Mức tạ đạt được, nhịp tim, số rep, đánh giá thể lực).
  * Xử lý vắng mặt: Nút "Báo vắng" -> Tự động kích hoạt luồng kiểm tra điều kiện học bù (Makeup Session) theo chính sách hủy trước hạn.
* **Quản lý Hồ sơ Học viên (Trainee Roster):**
  * Danh sách học viên PT đang phụ trách.
  * Xem hồ sơ sức khỏe, mục tiêu (Tăng cơ, giảm mỡ, hồi phục chấn thương), lịch sử tập luyện.
* **Kế hoạch Tập luyện & Dinh dưỡng (Workout & Meal Plan Builder):**
  * Trình biên soạn bài tập: Kéo thả các bài tập từ thư viện động tác.
  * Khung gợi ý bài tập bằng AI (AI Suggestion Stub): Giao diện sẵn sàng, có bộ lọc mục tiêu và mẫu giáo án tiêu chuẩn.
  * Trình tạo Kế hoạch dinh dưỡng (Macro Targets Builder): Gán lượng Calo và phân bổ Macro cho học viên theo tuần.
* **Cấu hình Lịch làm việc cá nhân (Availability Settings):**
  * Thiết lập ca rảnh (Working Hours) để học viên có thể book trên app.
  * Đăng ký nghỉ phép / Khóa khung giờ đột xuất.

---

### 4.3. RECEPTIONIST (Nhân viên Lễ tân) - Web POS & Quầy Check-in Siêu tốc
* **Bàn làm việc Lễ tân (Front-Desk Quick Terminal):**
  * Ô tìm kiếm siêu tốc (Tìm theo SĐT, Tên, Mã hội viên, Thẻ căn cước).
  * Phím tắt tiện lợi cho thao tác bán hàng và kiểm tra nhanh.
* **Màn hình Check-in Quầy (Live Check-in Screen):**
  * Quét mã QR từ app của Member hoặc quẹt thẻ từ (Hỗ trợ camera web hoặc máy quét barcode 2D).
  * Âm thanh phản hồi (Tít xanh: Thành công; Bíp đỏ: Lỗi).
  * Popup hiển thị tức thì: Ảnh đại diện, Tên, Tình trạng gói tập (Hợp lệ / Hết hạn / Còn 2 ngày), Số buổi PT còn lại, Ghi chú đặc biệt.
* **Màn hình Đăng ký & Bán gói tại quầy (Walk-in POS):**
  * Đăng ký thông tin học viên mới.
  * Chọn gói tập, chọn Coach (nếu đăng ký kèm PT), chọn khóa học chuyên biệt.
  * Thu tiền mặt tại quầy (COD) hoặc phát sinh mã VietQR động để khách quét thanh toán ngay tại bàn lễ tân.
  * Xem trước và In hóa đơn / Hợp đồng hội viên (Print template chuẩn khổ A4 / Hóa đơn nhiệt K80).
* **Màn hình Hỗ trợ Lớp học & Đặt lịch hộ:**
  * Thao tác đăng ký lớp hoặc hủy lớp khẩn cấp cho hội viên tại quầy.
  * Tiếp nhận yêu cầu đổi Coach, bảo lưu gói tập, chuyển nhượng gói.
* **Hộp thư Yêu cầu Hỗ trợ (Customer Support Tickets):**
  * Tiếp nhận phản ánh về cơ sở vật chất, khiếu nại dịch vụ, đồ thất lạc (Lost & Found).

---

### 4.4. CENTER MANAGER / ADMIN (Quản lý Trung tâm) - Executive BI Dashboard
* **Executive Dashboard (Trung tâm Điều hành & Phân tích BI):**
  * Thẻ chỉ số chính: Tổng doanh thu (Ngày/Tuần/Tháng/Năm), Số hội viên mới, Lượt check-in hôm nay, Tỉ lệ gia hạn (Retention Rate).
  * Biểu đồ doanh thu đa chiều: Doanh thu từ Gói tập thường vs Doanh thu PT cá nhân vs Khóa học chuyên biệt.
  * Heatmap giờ cao điểm: Mật độ hội viên theo từng khung giờ trong ngày để điều phối nhân sự.
* **Quản trị Gói tập & Chính sách Giá (Membership & Course Engine):**
  * Cấu hình gói Hybrid: Cài đặt số ngày sử dụng không giới hạn + Hạn mức buổi PT đính kèm.
  * Tạo và quản lý Khóa học chuyên biệt (Yoga trị liệu, Boxing nâng cao, giới hạn học viên, giảng viên cố định).
  * Thiết lập chính sách bảo lưu, phí đổi Coach, chính sách phạt hủy muộn.
* **Quản trị Đội ngũ Huấn luyện viên (Coach Management):**
  * Danh sách Coach: Thêm mới, chỉnh sửa hồ sơ, tạm khóa tài khoản.
  * Cấu hình chuyên môn, chứng chỉ, tỷ lệ chia sẻ hoa hồng (Commission).
  * Thiết lập ĐƠN GIÁ RIÊNG cho từng Coach (Huấn luyện viên Master, Senior, Junior có mức giá booking lẻ khác nhau).
* **Quản trị Thành viên & Phân quyền RBAC (User Management):**
  * Quản lý hồ sơ 360 độ của mọi hội viên trong trung tâm.
  * Phân quyền vai trò linh hoạt: Manager, Senior Staff, Receptionist, Head Coach, Coach.
* **Nhật ký Hệ thống & Giám sát (Audit Trail & Activity Logs):**
  * Ghi nhận mọi thao tác nhạy cảm: Chỉnh sửa giá gói, Hoàn tiền, Kích hoạt gói thủ công, Đổi mật khẩu, Xóa dữ liệu.

---

### 4.5. GUEST (Khách vãng lai / Public Landing Page)
* **Trang chủ giới thiệu Trung tâm (Branded Hero Section):**
  * Hình ảnh video năng lượng cao, thiết kế tràn viền theo chuẩn Freeletics tokens.
  * Giới thiệu các khu vực tập luyện: Gym máy khối, Cardio, Khu chức năng Functional Training, Phòng Yoga, Bể bơi/Sauna.
* **Bảng giá Gói tập công khai (Transparent Pricing Table):**
  * So sánh trực quan quyền lợi các gói: Standard, VIP, Gói có PT, Khóa học chuyên sâu.
  * Nút "Đăng ký dùng thử miễn phí 01 buổi" (Lead Generation Form).
* **Đội ngũ Huấn luyện viên tiêu biểu (Meet Our Coaches):**
  * Danh thiếp số của từng Coach: Bằng cấp quốc tế, Chuyên môn chính, Đánh giá của học viên.
* **Lịch lớp học công khai (Public Timetable):**
  * Khách có thể xem trước lịch các lớp Group Class trong tuần.

---

## 5. CHI TIẾT 10 LUỒNG NGHIỆP VỤ CỐT LÕI (CORE FLOWS & STATE MACHINES)

### 📌 Luồng 1: Đăng nhập / Đăng ký (Auth Flow)
```
[Mở App/Web] ──> [Màn hình Login/Register]
                      │
                      ├──> Nhập SĐT/Email + Mật khẩu (hoặc Đăng nhập Demo 1-Click theo Role)
                      ├──> Kiểm tra định dạng Client-side (Zod validation)
                      └──> [Xác thực & Cấp quyền]
                                │
                    ┌───────────┴───────────┐
                 [Thành công]            [Thất bại]
                    │                       │
             Lưu Token & Role          Hiển thị thông báo lỗi
             Local Session Storage     (Sai pass, Tài khoản bị khóa)
                    │
           [Phân luồng theo Role]
                    ├─> Member       ──> Mobile Member Simulator / App
                    ├─> Coach        ──> Coach Schedule Terminal
                    ├─> Receptionist ──> Desk POS / Quick Terminal
                    └─> Admin        ──> Executive BI Dashboard
```

---

### 📌 Luồng 2: Mua / Đăng ký gói tập (Membership Purchase Flow)
```
[Member vào Store] ──> [Xem danh sách Gói] ──> [Chọn Gói mong muốn]
                             │
            ┌────────────────┴────────────────┐
   [Gói Hội viên thông thường]       [Khóa học chuyên biệt]
            │                                 │
   Chọn thời hạn (1/3/6/12T)         Chọn khung giờ cố định
            │                                 │
            └────────────────┬────────────────┘
                             │
                  [Xem chi tiết đơn hàng]
           (Gồm: Giá gói + Số buổi PT tặng kèm nếu có)
                             │
                [Chọn Cổng Thanh Toán]
     (VietQR / VNPay Sandbox | Ví MoMo | COD Thanh toán tại quầy)
                             │
                    ┌────────┴────────┐
                [Thất bại]       [Thành công / Xác nhận]
                    │                 │
              Báo lỗi giao dịch    Kích hoạt gói trên hệ thống
              Cho phép thử lại     Khởi tạo Quota buổi PT
                                   Lưu Lịch sử giao dịch & Tạo mã Hóa đơn
                                   Hiển thị biên lai điện tử tức thì
```

---

### 📌 Luồng 3: Check-in Phòng tập (Smart QR Check-in)
```
[Member mở App] ──> [Bật Mã QR Check-in] (Tự động làm mới mỗi 30s)
                           │
       [Quét QR tại Quầy Lễ tân / Cổng Barrier tự động]
                           │
                 [Kiểm tra hiệu lực gói]
                           │
            ┌──────────────┴──────────────┐
       [HẾT HẠN / LỖI]               [CÒN HIỆU LỰC]
            │                             │
    Từ chối Check-in            Kiểm tra trạng thái Member
    Hiển thị cảnh báo đỏ        (Đang bảo lưu? Bị cấm?)
    Gợi ý gia hạn tại quầy                │
                                  [Check-in THÀNH CÔNG]
                                          │
                                  Cửa mở / Đèn xanh sáng (Phát âm thanh tít)
                                  Ghi nhận Timestamp vào Lịch sử check-in
                                  Thông báo chào mừng trên thiết bị
```

---

### 📌 Luồng 4: Đặt lịch với Coach (Coach Booking Flow)
```
[Member vào Tab PT] ──> [Chọn Huấn Luyện Viên]
                               │
                      [Xem Hồ sơ & Bảng giá]
              (Nếu trong gói: Dùng Quota buổi;
               Nếu ngoài gói: Hiển thị giá riêng từng Coach)
                               │
                      [Xem Lịch trống của Coach]
                               │
                      [Chọn Ngày & Giờ tập]
                               │
                      [Xác nhận Đặt lịch]
                               │
                    ┌──────────┴──────────┐
               [Hết chỗ/Trùng]        [Còn trống]
                    │                     │
             Báo trùng lịch          Tạo Booking (Trạng thái Pending)
             Chọn giờ khác           Trừ 1 buổi Quota (hoặc Thanh toán buổi lẻ)
                                     Bắn Notification tới Coach
                                     Thêm vào Lịch tập cá nhân
```

---

### 📌 Luồng 5: Coach xác nhận & Xử lý buổi tập (Session Fulfillment)
```
[Coach mở Lịch dạy] ──> [Chọn Buổi tập sắp tới] ──> [Xác nhận buổi tập]
                                                            │
                                                [Học viên có mặt không?]
                                                            │
                               ┌────────────────────────────┴────────────────────────────┐
                           [CÓ MẶT]                                                  [VẮNG MẶT]
                               │                                                         │
                     [Bắt đầu Buổi tập]                                         [Ghi nhận VẮNG MẶT]
                               │                                                         │
                     [Kết thúc Buổi tập]                                        [Kiểm tra điều kiện học bù]
                               │                                                         │
                [Ghi nhận kết quả tập luyện]                              ┌──────────────┴──────────────┐
             (Mức tạ, Bài tập hoàn thành,                               [Báo trước > 4h]         [Không báo trước]
              Đánh giá thể lực & Dặn dò)                                  (Hợp lệ)                  (Trừ buổi)
                               │                                             │                          │
                 Đồng bộ vào App của Member                             Hoàn trả 1 buổi             Mất lượt tập
                                                                        Tạo lượt học bù
```

---

### 📌 Luồng 6: Đăng ký lớp Group Class (Group Class Booking)
```
[Member vào Tab Group Class] ──> [Xem Lịch lớp theo Tuần]
                                         │
                                [Chọn Lớp quan tâm]
                         (Yoga / Zumba / HIIT / Pilates)
                                         │
                                [Xem thông tin chi tiết]
                         (Số lượng: 18/20; HLV phụ trách; Phòng)
                                         │
                                    [Bấm Đăng ký]
                                         │
                      ┌──────────────────┴──────────────────┐
                 [LỚP ĐÃ HẾT CHỖ]                     [LỚP CÒN CHỖ]
                      │                                     │
             Hiển thị "Hết chỗ"                      Xác nhận đăng ký
             Đưa vào "Danh sách chờ" (Waitlist)      Đăng ký THÀNH CÔNG
             (Tự động thông báo nếu có người hủy)    Cập nhật sĩ số lớp (19/20)
                                                     Đồng bộ vào Lịch của tôi
```

---

### 📌 Luồng 7: Quản lý Lịch tập Cá nhân (Schedule Management & Changes)
```
[Member vào Lịch của tôi] ──> [Bộ lọc: Tất cả / Lớp nhóm / Buổi PT]
                                         │
                              [Chọn Buổi tập cụ thể]
                                         │
                              [Xem chi tiết buổi tập]
                                         │
                       ┌─────────────────┴─────────────────┐
                 [Yêu cầu ĐỔI LỊCH]                   [Yêu cầu HỦY LỊCH]
                       │                                   │
             Kiểm tra hạn mức báo trước          Kiểm tra quy định hủy
             (VD: Phải trước ít nhất 2 giờ)      (VD: Phải trước ít nhất 2 giờ)
                       │                                   │
             Chọn khung giờ mới khả dụng         Xác nhận hủy -> Hoàn slot/quota
```

---

### 📌 Luồng 8: Quản lý Member của Staff / Admin (Member 360 View)
```
[Staff/Admin] ──> [Menu Quản lý Hội viên] ──> [Thanh tìm kiếm nâng cao]
                                                        │
                                            [Chọn hồ sơ Hội viên]
                                                        │
        ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
        │                   │                   │                   │                   │
  [Thông tin cá nhân]   [Gói tập & Dịch vụ]  [Lịch sử Check-in]  [Lịch sử Hóa đơn]   [Tiến độ tập luyện]
  - SĐT, Email, CCCD   - Gói hiện tại        - Ngày giờ vào/ra   - Danh sách đơn hàng - Biểu đồ cân nặng
  - Ảnh đại diện       - Số buổi PT còn lại  - Cổng check-in     - Phương thức thanh  - Lịch sử buổi tập
  - Liên hệ khẩn cấp   - Khóa học tham gia   - Tỉ lệ chuyên cần    toán & In hóa đơn  - Nhận xét của Coach
```

---

### 📌 Luồng 9: Quản lý Huấn luyện viên của Admin (Coach Management)
```
[Admin] ──> [Menu Quản trị Coach] ──> [Thêm mới / Sửa / Khóa Coach]
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        │                                   │                                   │
[Thiết lập Chuyên môn]             [Cấu hình BẢNG GIÁ RIÊNG]             [Cấu hình Ca làm việc]
- Cấp bậc (Junior/Senior/Master)   - Đơn giá/Buổi dạy lẻ                 - Khung giờ nhận lịch
- Bộ môn (Gym/Boxing/Pilates)      - % Hoa hồng nhận được                - Ngày nghỉ trong tuần
- Bằng cấp & Chứng chỉ quốc tế     - Giá gói combo 10/20 buổi            - Số lớp nhóm tối đa
        │                                   │                                   │
        └───────────────────────────────────┴───────────────────────────────────┘
                                            │
                     [Lưu & Kích hoạt trên Hệ thống App]
                         (Coach sẵn sàng nhận Booking)
```

---

### 📌 Luồng 10: Gia hạn Gói tập (Membership Renewal Flow)
```
[Member vào App] ──> [Gói tập của tôi] ──> [Cảnh báo: Gói sắp hết hạn (còn 5 ngày)]
                                                    │
                                             [Bấm GIA HẠN GÓI]
                                                    │
                                     [Chọn Thời gian gia hạn]
                                      (1 Tháng / 3 Tháng / 1 Năm)
                                                    │
                                 [Áp dụng Ưu đãi Khách hàng thân thiết]
                                                    │
                                   [Thanh toán qua Mock Gateway]
                                                    │
                                           [Thanh toán THÀNH CÔNG]
                                                    │
                                  Cập nhật Ngày hết hạn mới = (Hạn cũ + Thời gian mới)
                                  Bảo lưu số buổi PT chưa dùng hết (nếu có chính sách)
                                  Tạo biên lai và cập nhật Lịch sử giao dịch
```

---

## 6. CÁC TÍNH NĂNG ĐẶC THÙ & ĐỘC BẢN (SPECIALIZED CAPABILITIES)

### 6.1. Gói Hybrid (Vào tập Tự do 100% + Hạn mức Buổi PT)
* **Khái niệm:** Học viên đăng ký gói 1 tháng/3 tháng/1 năm được quyền vào phòng tập bất kỳ lúc nào trong giờ hoạt động của trung tâm mà không bị giới hạn số lần check-in. Quyền lợi đi kèm có một hạn mức số buổi huấn luyện viên riêng (VD: Gói Gold 1 tháng kèm 8 buổi PT).
* **Thiết kế UI/UX Front-end:**
  * Thẻ Membership trên Mobile hiển thị 2 thanh chỉ số song song:
    1. **Gym Access Pass:** `Không giới hạn - Còn 22 ngày` (Vòng tròn màu xanh lá).
    2. **PT Session Allowance:** `5/8 buổi còn lại` (Thanh tiến trình màu Cam Freeletics `#FE7413`).
  * Khi quét QR check-in tại cửa: Hệ thống chỉ trừ quyền vào cửa, hoàn toàn KHÔNG trừ buổi PT.
  * Buổi PT chỉ được trừ khi có xác nhận buổi tập thành công giữa Member và Coach (Luồng 5).

---

### 6.2. Cơ chế Đổi Coach (Switch Coach Protocol) & Xử lý Chênh lệch giá
* **Nghiệp vụ:** Học viên cảm thấy không phù hợp phong cách hoặc muốn đổi sang bộ môn khác có quyền gửi yêu cầu đổi Coach.
* **Giao diện & Logic giải quyết:**
  * Member mở chi tiết gói tập -> Chọn "Yêu cầu đổi Huấn luyện viên".
  * Chọn Coach mới từ danh sách.
  * **Trường hợp 1 (Cùng đơn giá/buổi):** Chuyển toàn bộ số buổi còn lại sang Coach mới ngay lập tức mà không phát sinh chi phí.
  * **Trường hợp 2 (Coach mới có đơn giá cao hơn):** Hệ thống tính toán khoản phụ phí chênh lệch:
    $$\Delta = (\text{Đơn giá Coach mới} - \text{Đơn giá Coach cũ}) \times \text{Số buổi còn lại}$$
    Member xác nhận thanh toán phần chênh lệch trên app để kích hoạt.
  * **Trường hợp 3 (Coach mới có đơn giá thấp hơn):** Quy đổi tương đương số buổi tăng thêm hoặc bảo lưu tiền thừa vào ví nội bộ (Credit Wallet).

---

### 6.3. Book thêm buổi PT với Bảng giá riêng từng Coach
* **Cơ chế:** Mỗi Coach có thương hiệu và trình độ khác nhau, do đó trung tâm áp dụng mức giá linh động (Tiered Pricing):
  * *Junior Coach:* 250,000 VNĐ / buổi.
  * *Senior Coach:* 400,000 VNĐ / buổi.
  * *Master Coach / Vận động viên:* 650,000 VNĐ / buổi.
* **UI Front-End:**
  * Thẻ Coach Profile có huy hiệu cấp bậc rõ ràng, danh sách review và đơn giá niêm yết công khai.
  * Khi hết Quota trong gói chính, nút bấm tự động đổi thành `Book thêm buổi (400.000đ)` và chuyển tiếp sang bước thanh toán nhanh.

---

### 6.4. Kế hoạch Dinh dưỡng & Tracking Macros/InBody
* **Giao diện Dinh dưỡng (Nutrition Dashboard):**
  * Hiển thị bảng mục tiêu hàng ngày: Tổng Calo nạp, Protein (g), Carbs (g), Fat (g), Nước (Lít).
  * Vòng tròn tiến trình trực quan (Macro Ring Chart) tự động cập nhật khi Member log bữa ăn.
  * Coach có thể xem trực tiếp nhật ký ăn uống của học viên để đưa ra nhận xét hoặc điều chỉnh thực đơn tuần tiếp theo.
* **Biểu đồ InBody 3D:**
  * Lưu trữ các chỉ số theo dòng thời gian: Cân nặng, Tỷ lệ cơ (Skeletal Muscle Mass), Tỷ lệ mỡ (Body Fat Mass), Mỡ nội tạng (Visceral Fat).
  * Biểu đồ đường so sánh giữa các lần đo InBody định kỳ tại trung tâm.

---

### 6.5. Khóa học Chuyên biệt (Specialized Courses / Workshops)
* **Khác biệt với Lớp thường:** Khóa học chuyên biệt (VD: *Khóa Yoga Trị liệu Cột sống 12 buổi*, *Workshop Boxing Kỹ thuật 4 tuần*) có lộ trình cố định, không thể tham gia giữa chừng, giới hạn số lượng học viên nghiêm ngặt (chỉ từ 6 - 10 người/lớp).
* **UI Front-end:**
  * Thẻ hiển thị dạng Card đặc biệt với Banner nghệ thuật, lộ trình chi tiết từng buổi học (Syllabus Accordion).
  * Đếm ngược thời gian mở đăng ký (Countdown Timer).
  * Thanh hiển thị số chỗ còn lại theo thời gian thực (VD: `Chỉ còn 2 chỗ cuối`).

---

### 6.6. Kiến trúc Giả lập Thanh toán (Mock Payment Gateway Engine)
Do nhóm hiện tại **chưa có Backend** và dự định thực tế sẽ hỗ trợ **COD (Tiền mặt tại quầy)** kết hợp **Chuyển khoản VNPay / MoMo**, hệ thống Front-End sẽ được tích hợp sẵn một **Mock Payment Engine** hoàn chỉnh:

1. **Phương thức 1: Tiền mặt tại quầy (COD / Pay at Front Desk):**
   * Đơn hàng được tạo ở trạng thái `Pending Payment` kèm Mã đơn hàng dạng `ORD-2026-XXXX`.
   * Nhân viên Lễ tân tại quầy POS chỉ cần nhập/quét mã đơn, xác nhận đã nhận tiền mặt -> Kích hoạt gói ngay lập tức và in Biên lai thu tiền khổ K80/A4.
2. **Phương thức 2: Chuyển khoản VietQR / VNPay Sandbox Simulator:**
   * Hệ thống tự động sinh mã VietQR chuẩn Napas 247 kèm đúng số tiền và cú pháp `FITNESS [MaDonHang]`.
   * Cung cấp nút thao tác giả lập nhanh: `[Giả lập Quét thành công]` -> Tự động bắn tín hiệu kích hoạt gói, chuyển sang màn hình thành công sau 1.5 giây.
3. **Phương thức 3: Ví điện tử MoMo Sandbox:**
   * Modal thanh toán giả lập giao diện quét mã MoMo với nút xác nhận nhanh để demo trơn tru.
4. **Data Persistence:** Toàn bộ lịch sử giao dịch, gói tập đang hoạt động được lưu bền vững qua LocalStorage / IndexedDB, không bị mất dữ liệu khi F5 tải lại trang.

---

### 6.7. Kiến trúc Module AI Dự phòng (Plug-and-Play AI Stubs & Contract)
Theo thỏa thuận, nhóm chưa chốt giải pháp AI nên Front-End sẽ **đóng khung thành các Module cắm rút (Plug-and-Play Stubs)**. Điều này giúp giao diện không bị thiếu hụt khi demo nhưng tuyệt đối không gây lỗi hay phụ thuộc vào bất kỳ dịch vụ bên ngoài nào:

1. **AI Workout Generator (Dành cho Coach):**
   * Giao diện Modal "Gợi ý giáo án AI": Cho phép chọn mục tiêu, trình độ và tình trạng chấn thương.
   * Dữ liệu trả về hiện tại sử dụng **Smart Mock Generator Engine** với hơn 30 bài tập chuẩn quốc tế được lập trình sẵn.
   * Cung cấp sẵn file Interface `aiService.ts` với hàm `generateWorkoutPlan(prompt: WorkoutPrompt): Promise<WorkoutPlan>` để khi nhóm có backend hoặc API key chỉ cần thay thế hàm gọi API là hoạt động ngay.
2. **AI Fitness Assistant Chatbot (Dành cho Member/Guest):**
   * Nút nổi (Floating Chat Bubble) góc phải màn hình.
   * Giao diện chat streaming mô phỏng câu trả lời từng chữ mượt mà.
   * Cung cấp sẵn cơ chế kịch bản thông minh (Rule-based Fallback Answers) giải đáp về giờ mở cửa, cách dùng máy tập, gợi ý thực đơn mẫu.

---

## 7. CẤU TRÚC THƯ MỤC DỰ ÁN (ENTERPRISE FOLDER STRUCTURE)

Dự án áp dụng mô hình **Feature-Driven Architecture** (Kiến trúc hướng tính năng) kết hợp với **Shared Core Design System**, chuẩn hóa cho các dự án quy mô lớn:

```
frontend/
├── public/                     # Static assets, fonts, icons, PWA manifest
├── src/
│   ├── assets/                 # Logo, sound effects (check-in beep), demo images
│   ├── components/             # Reusable Design System components
│   │   ├── ui/                 # Atomic UI primitives
│   │   │   ├── Button/         # Freeletics Pill Button variant (#FE7413)
│   │   │   ├── Card/           # Elevated Cards (sm/md/lg radius)
│   │   │   ├── Input/          # Form inputs with floating labels
│   │   │   ├── Modal/          # Dialogs & Drawers
│   │   │   ├── Badge/          # Status tags, Coach rank badges
│   │   │   └── Toast/          # Notification toast
│   │   ├── layout/             # Layout wrappers
│   │   │   ├── AdminLayout.tsx # Web Sidebar + Header layout
│   │   │   ├── MobileSimulatorLayout.tsx # Khung mô phỏng Mobile cho Member
│   │   │   ├── CoachLayout.tsx # Tablet/Web responsive layout
│   │   │   └── Header.tsx
│   │   └── shared/             # QR Scanner modal, InBody Chart, Calendar Grid
│   │
│   ├── features/               # Modular features (Mỗi role/tính năng độc lập)
│   │   ├── auth/               # Login, Register, Role Redirect, Demo 1-Click Login
│   │   ├── member-mobile/      # Dành cho Member (Sẵn sàng đóng gói Capacitor/React Native)
│   │   │   ├── components/     # QuickQRWidget, QuotaProgress, NutritionRing
│   │   │   ├── pages/          # Home, Store, Schedule, Nutrition, Profile
│   │   │   └── hooks/          # useMemberBookings, useActiveMembership
│   │   ├── coach-portal/       # Dành cho Coach
│   │   │   ├── components/     # TraineeCard, SessionExecutionModal, AIWorkoutModal
│   │   │   ├── pages/          # CoachSchedulePage, TraineeListPage, AvailabilityPage
│   │   │   └── hooks/          # useCoachSchedule, useLogWorkout
│   │   ├── receptionist/       # Dành cho Lễ tân
│   │   │   ├── components/     # FastMemberSearch, LiveQRCheckinModal, POSInvoicePrint
│   │   │   ├── pages/          # FrontDeskPage, WalkinRegisterPage, TicketQueuePage
│   │   │   └── hooks/          # useCheckInScanner, useCreateWalkinInvoice
│   │   ├── admin-portal/       # Dành cho Quản lý Trung tâm
│   │   │   ├── components/     # RevenueHeatmap, CoachPricingTable, AuditLogTable
│   │   │   ├── pages/          # BIDashboardPage, CoachManagementPage, PricingPlanPage
│   │   │   └── hooks/          # useAnalyticsMetrics, useUpdateCoachTier
│   │   ├── payment-simulator/  # Module giả lập VNPay, MoMo, VietQR và COD tại quầy
│   │   ├── memberships/        # Quản lý gói Hybrid, Khóa học chuyên biệt, Gia hạn
│   │   ├── booking/            # Logic đặt lịch PT, Group Class, Đổi Coach
│   │   ├── nutrition/          # Ghi nhận calo, Meal planner, Macro calculator
│   │   └── ai-assistant/       # Plug-and-Play AI Stubs & Chatbot Widget
│   │
│   ├── mocks/                  # Mock Database Engine (Tự động lưu LocalStorage)
│   │   ├── db.ts               # Local Database chứa Members, Coaches, Plans, Bookings
│   │   ├── mockAuth.ts         # Giả lập xác thực đa vai trò
│   │   └── mockPayments.ts     # Giả lập sinh mã VietQR và xác nhận thanh toán
│   │
│   ├── hooks/                  # Global hooks (useSocket, useAuth, useDebounce)
│   ├── stores/                 # Zustand Stores (authStore, bookingDraftStore, cartStore)
│   ├── services/               # Mock API Service Layer (Chuyển đổi 1-dòng sang Real API sau này)
│   ├── styles/                 # Global styles
│   │   ├── design-tokens.css   # Mapping chính xác token từ DESIGN.md
│   │   ├── typography.css      # AktivGrotesk, Iosevka font configurations
│   │   ├── layout.css          # Responsive Breakpoints (480px, 600px, 750px)
│   │   └── index.css           # Global resets & animations
│   ├── types/                  # TypeScript Data Models dùng chung giữa Web và Mobile
│   ├── utils/                  # Format tiền tệ (VND), format date/time, QR validator
│   ├── App.tsx                 # Route declarations & Role Guard
│   └── main.tsx                # Entry point
```

---

## 8. LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (SPRINT ROADMAP & MILESTONES)

Kế hoạch được chia thành **6 Sprints chuẩn Scrum (Mỗi Sprint 2 tuần)**, tích hợp sẵn Mock Data Engine để kiểm thử độc lập mà không cần chờ Backend:

```
┌──────────────┬──────────────────────────────────────────┬───────────────────────────────┐
│ Giai đoạn    │ Trọng tâm phát triển                     │ Sản phẩm bàn giao             │
├──────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Sprint 1     │ • Xây dựng Design Tokens theo DESIGN.md │ • Thư viện Athletic UI Core   │
│ (Tuần 1 - 2) │ • Thiết lập Mock Database Engine nội bộ  │ • Luồng 1: Đăng nhập đa vai trò│
│              │ • Phân quyền Routes & Role Switcher Demo │ • Guest Landing Page thể thao │
├──────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Sprint 2     │ • Phân hệ Lễ tân (Receptionist Terminal) │ • Luồng 3: QR Check-in Quầy   │
│ (Tuần 3 - 4) │ • Giao diện Bán gói tại quầy (POS)       │ • Luồng 8: Quản lý Member 360 │
│              │ • Thanh toán COD & In hóa đơn nhiệt K80  │ • Cấu hình Gói tập & Hội viên │
├──────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Sprint 3     │ • Mobile Viewport Simulator cho Member   │ • Luồng 2: Mua/Đăng ký gói    │
│ (Tuần 5 - 6) │ • Mã QR động 30s chống chụp màn hình     │ • Luồng 6: Đăng ký Group Class│
│              │ • Quản lý Lịch cá nhân & Thông báo       │ • Luồng 7: Xem/Hủy/Đổi lịch   │
│              │ • Tích hợp Mock VietQR / MoMo Gateway    │ • Luồng 10: Gia hạn gói tập   │
├──────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Sprint 4     │ • Phân hệ Huấn luyện viên (Coach Portal) │ • Luồng 4: Đặt lịch với Coach │
│ (Tuần 7 - 8) │ • Lịch dạy tương tác & Điểm danh buổi    │ • Luồng 5: Coach xử lý buổi   │
│              │ • Tính năng Đổi Coach & Bù trừ giá       │ • Kế hoạch Dinh dưỡng & Macros│
│              │ • Khung AI Workout Generator (Stub Ready)│ • Book thêm buổi PT lẻ        │
├──────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Sprint 5     │ • Phân hệ Admin Dashboard (Manager)      │ • Luồng 9: Quản lý & Giá Coach│
│ (Tuần 9 - 10)│ • Phân tích Doanh thu & Báo cáo BI       │ • Khóa học chuyên biệt        │
│              │ • Khung AI Chatbot Assistant Widget      │ • Audit Trail nhật ký thao tác│
│              │ • Quản lý Gói Hybrid & Cấp quyền RBAC    │                               │
├──────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Sprint 6     │ • Tối ưu Performance, Tải trang < 1.5s   │ • Báo cáo Kiểm thử E2E        │
│ (Tuần 11-12) │ • Đóng gói thử nghiệm Capacitor Mobile   │ • Production Deployment Ready │
│              │ • Kiểm thử bảo mật, UAT & Đóng gói       │ • Tài liệu Hướng dẫn sử dụng  │
└──────────────┴──────────────────────────────────────────┴───────────────────────────────┘
```

---

## 9. BẢO MẬT, TỐI ƯU HIỆU NĂNG & TIÊU CHUẨN KIỂM THỬ (QA/UX)

### 9.1. Bảo mật Front-End (Defense-in-Depth)
1. **Dynamic QR Anti-Fraud:** Mã QR trên điện thoại học viên được tạo kèm timestamp và hash mã hóa bí mật, tự động làm mới mỗi 30 giây kèm hiệu ứng thanh quét tia laser. Nếu học viên chụp ảnh màn hình gửi cho người khác, mã sẽ hết hạn ngay lập tức khi quét tại cổng.
2. **Strict Route Protection:** Kiểm tra Session Claim và Role trực tiếp tại Client Router kết hợp Route Guard tự động điều hướng đúng phân hệ.
3. **Data Sanitization:** XSS Prevention triệt để với React Virtual DOM và thư viện DOMPurify đối với các nội dung ghi chú/nhận xét của Coach.

### 9.2. Tối ưu Hiệu năng (Performance Budgets)
* **Code Splitting & Lazy Loading:** Chia nhỏ các Route theo Role (Admin Bundle chỉ tải khi đăng nhập quyền Admin, Mobile Member Bundle tối ưu siêu nhẹ dưới 200KB).
* **Virtual Scrolling:** Áp dụng `@tanstack/react-virtual` cho danh sách hội viên hàng chục ngàn người và danh sách lịch sử check-in để đảm bảo mượt mà 60fps không bị giật lag DOM.
* **Image Optimization:** Sử dụng định dạng WebP/AVIF cho hình ảnh huấn luyện viên và bài tập, tự động tải Lazy Loading.

### 9.3. Tiêu chuẩn Kiểm thử
* **Unit & Component Testing:** Vitest + React Testing Library (Kiểm tra chính xác các nút bấm, tính toán giá chênh lệch đổi Coach, logic trừ Quota buổi PT).
* **End-to-End Testing (E2E):** Playwright kiểm thử trọn vẹn luồng từ khi Member mua gói -> Check-in QR tại quầy Lễ tân -> Coach mở lịch điểm danh.

---
*Tài liệu này đóng vai trò là kim chỉ nam kỹ thuật (Architectural Blueprint) cho toàn bộ đội ngũ phát triển Front-End trong suốt vòng đời dự án.*
