# 📘 HƯỚNG DẪN CHI TIẾT CẤU HÌNH BIẾN MÔI TRƯỜNG (.ENV GUIDE)
## Hệ Thống Quản Lý Trung Tâm Thể Thao (Sports Center Management System - AURA FITNESS)
*Tài liệu kỹ thuật dành cho Lập trình viên Front-end, Back-end và DevOps của dự án FPT WDP301*

---

## 📑 MỤC LỤC
1. [File .env là gì và tại sao cần thiết?](#1-file-env-là-gì-và-tại-sao-cần-thiết)
2. [Cơ chế hoạt động của biến môi trường trong Vite](#2-cơ-chế-hoạt-động-của-biến-môi-trường-trong-vite)
3. [Bảng tra cứu chi tiết toàn bộ các biến trong .env](#3-bảng-tra-cứu-chi-tiết-toàn-bộ-các-biến-trong-env)
4. [Hướng dẫn thiết lập từng bước (Setup Guide)](#4-hướng-dẫn-thiết-lập-từng-bước-setup-guide)
5. [Cách sử dụng biến môi trường trong mã nguồn TypeScript / React](#5-cách-sử-dụng-biến-môi-trường-trong-mã-nguồn-typescript--react)
6. [Quy tắc bảo mật và quản lý Git an toàn](#6-quy-tắc-bảo-mật-và-quản-lý-git-an-toàn)
7. [Các lỗi thường gặp và cách xử lý (Troubleshooting)](#7-các-lỗi-thường-gặp-và-cách-xử-lý-troubleshooting)

---

## 🎯 1. FILE `.ENV` LÀ GÌ VÀ TẠI SAO CẦN THIẾT?

Tập tin `.env` (Environment Variables) là nơi lưu trữ **các tham số cấu hình riêng biệt của hệ thống** mà không làm thay đổi mã nguồn (hard-code).

### 💡 Lợi ích cốt lõi:
1. **Tách biệt cấu hình khỏi mã nguồn (12-Factor App):** Giúp dự án chạy được trên nhiều môi trường khác nhau (**Development**, **Staging**, **Production**) chỉ bằng việc thay đổi file `.env` mà không cần sửa code.
2. **Bảo mật thông tin nhạy cảm:** Tránh làm lộ API Key, Secret Token, thông tin tài khoản ngân hàng nhận tiền ra kho mã nguồn công khai (GitHub/GitLab).
3. **Linh hoạt trong bàn giao:** Khi kết nối với Back-end team (Java Spring Boot, C# .NET, NestJS...), chỉ cần thay đổi đường link `VITE_API_BASE_URL` trong file `.env` là toàn bộ Front-end tự động trỏ đến máy chủ mới.

---

## ⚡ 2. CƠ CHẾ HOẠT ĐỘNG CỦA BIẾN MÔI TRƯỜNG TRONG VITE

Dự án này sử dụng công cụ đóng gói hiện đại **Vite**:
* **Tiền tố bắt buộc:** Mọi biến môi trường muốn sử dụng trong mã nguồn Front-end **bắt buộc phải có tiền tố `VITE_`** (Ví dụ: `VITE_API_BASE_URL`). Các biến không có tiền tố `VITE_` sẽ bị Vite ẩn đi để đảm bảo an toàn.
* **Cú pháp truy cập:** Vite **không sử dụng** `process.env` của Node.js cũ, mà sử dụng cú pháp chuẩn ECMAScript Module:
  ```typescript
  import.meta.env.VITE_TEN_BIEN
  ```
* **Hỗ trợ Type-Safe:** Các biến đã được khai báo kiểu dữ liệu trong file [`src/vite-env.d.ts`](file:///c:/Users/Lenovo/Documents/FPT/FA26/WDP301/Fitness/frontend/src/vite-env.d.ts) giúp trình soạn thảo (VS Code) tự động gợi ý code (IntelliSense) và báo lỗi nếu gõ sai tên biến.

---

## 📋 3. BẢNG TRA CỨU CHI TIẾT TOÀN BỘ CÁC BIẾN TRONG `.ENV`

Dưới đây là danh sách và chức năng cụ thể của từng biến cấu hình trong dự án:

### 🏢 Nhóm 1: Cấu hình Ứng dụng & Trung tâm Thể thao
| Tên biến | Kiểu | Giá trị mẫu | Mục đích & Tác dụng |
| :--- | :---: | :--- | :--- |
| `VITE_APP_NAME` | `string` | `"AURA FITNESS - Sports Center Management System"` | Tên đầy đủ của hệ thống, hiển thị trên tiêu đề tab trình duyệt và tiêu đề hóa đơn. |
| `VITE_APP_SHORT_NAME` | `string` | `"AuraFitness"` | Tên viết tắt dùng cho mã QR, tiêu đề tin nhắn SMS thông báo. |
| `VITE_APP_VERSION` | `string` | `"1.0.0"` | Số phiên bản phần mềm để theo dõi tiến độ nâng cấp. |
| `VITE_APP_ENV` | `string` | `"development"` | Môi trường triển khai: `development` (nội bộ), `staging` (test nghiệm thu), `production` (chạy thật). |
| `VITE_APP_BASE_URL` | `string` | `"http://localhost:5173"` | URL gốc của Front-end, dùng để tạo đường link quay về sau khi thanh toán qua cổng online. |
| `VITE_CENTER_NAME` | `string` | `"AURA FITNESS & YOGA CENTER"` | Tên thương hiệu hiển thị trên thanh điều hướng, banner trang chủ và hợp đồng hội viên. |
| `VITE_CENTER_ADDRESS` | `string` | `"Số 108 Phố Thể Thao, Cầu Giấy, Hà Nội"` | Địa chỉ trung tâm in trên biên lai thanh toán POS và chân trang web. |
| `VITE_CENTER_HOTLINE` | `string` | `"1900 6868"` | Tổng đài hỗ trợ hiển thị trên nút bấm gọi nhanh cho khách vãng lai. |
| `VITE_CENTER_SUPPORT_EMAIL` | `string` | `"support@aurafitness.vn"` | Email tiếp nhận thắc mắc và gửi hóa đơn điện tử cho hội viên. |
| `VITE_CENTER_OPERATING_HOURS` | `string` | `"05:30 - 22:30"` | Giờ mở cửa phòng tập hiển thị trên trang chủ và cảnh báo khung giờ check-in. |

---

### 🌐 Nhóm 2: Kết nối Back-end API & WebSocket Thời Gian Thực
| Tên biến | Kiểu | Giá trị mẫu | Mục đích & Tác dụng |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | `string` | `"http://localhost:8080/api/v1"` | **Đường dẫn máy chủ API chính.** Khi team Back-end hoàn thành API, Front-end chỉ cần đổi đường link này để kết nối với cơ sở dữ liệu thật (PostgreSQL/MySQL). |
| `VITE_API_TIMEOUT_MS` | `number` | `15000` | Thời gian tối đa (mili-giây) chờ phản hồi từ server trước khi báo lỗi mạng (15 giây). |
| `VITE_WS_CHECKIN_URL` | `string` | `"ws://localhost:8080/ws/checkin"` | **Cổng kết nối WebSocket thời gian thực.** Dùng để quầy Lễ tân nhận tín hiệu mở cổng tự động ngay khi hội viên quẹt thẻ QR trên điện thoại. |
| `VITE_ENABLE_MOCK_FALLBACK` | `boolean` | `"true"` | Nếu bật `true`: Khi server Back-end chưa bật hoặc bị lỗi mạng, Front-end sẽ tự động dùng dữ liệu giả lập trong `LocalStorage` để tránh bị đứng màn hình khi chấm bài/demo. |

---

### 💳 Nhóm 3: Cổng Thanh Toán Tự Động (VietQR & MoMo)
| Tên biến | Kiểu | Giá trị mẫu | Mục đích & Tác dụng |
| :--- | :---: | :--- | :--- |
| `VITE_VIETQR_BANK_ID` | `string` | `"MB"` | Mã định danh ngân hàng thụ hưởng theo chuẩn Napas247 (VD: `MB` = MBBank, `VCB` = Vietcombank, `TCB` = Techcombank). |
| `VITE_VIETQR_ACCOUNT_NO` | `string` | `"0988776655"` | Số tài khoản ngân hàng chính thức của phòng gym để tạo mã QR động nhận tiền hội viên. |
| `VITE_VIETQR_ACCOUNT_NAME` | `string` | `"CTCP THE THAO AURA FITNESS VIET NAM"` | Tên chủ tài khoản hiển thị trên ứng dụng ngân hàng khi khách quét mã QR. |
| `VITE_VIETQR_TEMPLATE` | `string` | `"compact2"` | Giao diện hiển thị của mã VietQR: `compact2` (nhỏ gọn có logo ngân hàng), `qr_only` (chỉ mã QR thuần túy). |
| `VITE_MOMO_PARTNER_CODE` | `string` | `"MOMO_DEMO_AURA"` | Mã đối tác do MoMo Business cấp cho phòng tập để tích hợp thanh toán ví điện tử. |
| `VITE_MOMO_ACCESS_KEY` | `string` | `"mock_momo_access_key"` | Khóa truy cập bảo mật định danh ứng dụng gọi sang cổng thanh toán MoMo. |
| `VITE_MOMO_ENDPOINT` | `string` | `"https://test-payment.momo.vn/v2/gateway/api/create"` | Đường dẫn Sandbox của MoMo để chạy thử nghiệm quét mã thanh toán mà không mất tiền thật. |

---

### 🤖 Nhóm 4: Dịch Vụ Trí Tuệ Nhân Tạo (AI Assistant & Workout Plan)
| Tên biến | Kiểu | Giá trị mẫu | Mục đích & Tác dụng |
| :--- | :---: | :--- | :--- |
| `VITE_AI_PROVIDER` | `string` | `"gemini"` | Nhà cung cấp AI được kích hoạt: `gemini` (Google AI), `openai` (ChatGPT), hoặc `mock` (dữ liệu mẫu phản hồi tức thì). |
| `VITE_GEMINI_API_KEY` | `string` | `""` | API Key lấy từ **Google AI Studio** (`aistudio.google.com`). Nếu để trống, hệ thống sẽ tự động dùng engine giả lập thông minh mà không báo lỗi. |
| `VITE_OPENAI_API_KEY` | `string` | `""` | API Key của OpenAI (`platform.openai.com`) nếu bạn muốn sử dụng mô hình GPT-4o. |
| `VITE_AI_MODEL_NAME` | `string` | `"gemini-1.5-flash"` | Tên mô hình AI được gọi để phân tích mục tiêu thể hình, InBody và sinh bài tập cho Huấn luyện viên. |

---

### ⚙️ Nhóm 5: Quy Tắc Vận Hành & Tính Năng Giao Diện
| Tên biến | Kiểu | Giá trị mẫu | Mục đích & Tác dụng |
| :--- | :---: | :--- | :--- |
| `VITE_ENABLE_AUDIO_SYNTHESIS` | `boolean` | `"true"` | Bật/tắt bộ giả lập âm thanh Web Audio API (Tít xanh du dương khi check-in thành công, Bíp đỏ cảnh báo khi thẻ hết hạn). |
| `VITE_MAKEUP_NOTICE_HOURS` | `number` | `4` | **Chính sách học bù (Makeup Session):** Học viên phải báo vắng trước giờ học tối thiểu số tiếng này mới được bảo lưu buổi tập. Nếu báo muộn hơn sẽ bị tính trừ buổi PT. |

---

## 🚀 4. HƯỚNG DẪN THIẾT LẬP TỪNG BƯỚC (SETUP GUIDE)

Khi tải dự án về máy mới hoặc chuyển giao cho thành viên trong nhóm, thực hiện theo các bước sau:

### Bước 1: Tạo file cấu hình từ bản mẫu
Chạy lệnh sau trong thư mục `frontend`:
```bash
# Trên Windows PowerShell hoặc CMD:
copy .env.example .env

# Trên Linux / macOS:
cp .env.example .env
```

### Bước 2: Tùy chỉnh các giá trị mong muốn
Mở file `.env` bằng VS Code và chỉnh sửa:
* Đổi số tài khoản ngân hàng `VITE_VIETQR_ACCOUNT_NO` thành số tài khoản của bạn nếu muốn thử nghiệm quét VietQR thật bằng app ngân hàng trên điện thoại.
* Điền `VITE_GEMINI_API_KEY` nếu bạn muốn Chatbot và Trình tạo giáo án gọi trực tiếp vào Google AI Studio.

### Bước 3: Khởi động lại Dev Server
> ⚠️ **LƯU Ý:** Khi thay đổi bất kỳ giá trị nào trong file `.env`, bạn **BẮT BUỘC phải khởi động lại server** để Vite nhận diện giá trị mới:
```bash
# Nhấn Ctrl + C để dừng server cũ, sau đó gõ:
npm run dev
```

---

## 💻 5. CÁCH SỬ DỤNG BIẾN MÔI TRƯỜNG TRONG MÃ NGUỒN

### Ví dụ 1: Sử dụng trong gọi API Backend
```typescript
// src/services/apiService.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export async function fetchMemberList() {
  const response = await fetch(`${BASE_URL}/members`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}
```

### Ví dụ 2: Tạo link VietQR động từ biến cấu hình
```typescript
// src/features/payment/PaymentModal.tsx
const bankId = import.meta.env.VITE_VIETQR_BANK_ID || 'MB';
const accountNo = import.meta.env.VITE_VIETQR_ACCOUNT_NO || '0988776655';
const accountName = encodeURIComponent(import.meta.env.VITE_VIETQR_ACCOUNT_NAME || 'AURA FITNESS');
const template = import.meta.env.VITE_VIETQR_TEMPLATE || 'compact2';

// Link ảnh QR Napas247 chuẩn quốc gia:
const qrImageUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${memo}&accountName=${accountName}`;
```

### Ví dụ 3: Hiển thị Hotline và Địa chỉ trên giao diện
```tsx
// src/components/layout/Footer.tsx
export const Footer = () => {
  return (
    <footer>
      <h4>{import.meta.env.VITE_CENTER_NAME}</h4>
      <p>Địa chỉ: {import.meta.env.VITE_CENTER_ADDRESS}</p>
      <p>Hotline: {import.meta.env.VITE_CENTER_HOTLINE}</p>
    </footer>
  );
};
```

---

## 🔒 6. QUY TẮC BẢO MẬT VÀ QUẢN LÝ GIT AN TOÀN

1. **Tuyệt đối KHÔNG commit file `.env` lên Git Repository:**
   * File `.env` chứa thông tin cấu hình nội bộ và API keys. Nếu đẩy lên GitHub công khai, các công cụ quét tự động có thể đánh cắp API key hoặc thông tin tài khoản.
   * File [`.gitignore`](file:///c:/Users/Lenovo/Documents/FPT/FA26/WDP301/Fitness/frontend/.gitignore) và [`.ignore`](file:///c:/Users/Lenovo/Documents/FPT/FA26/WDP301/Fitness/frontend/.ignore) đã được thiết lập để tự động bỏ qua file `.env`, `.env.local`.

2. **Chỉ commit file `.env.example` lên Git:**
   * File [`.env.example`](file:///c:/Users/Lenovo/Documents/FPT/FA26/WDP301/Fitness/frontend/.env.example) chỉ chứa các giá trị mẫu hoặc placeholder (`your_api_key_here`). Khi người khác clone dự án về, họ chỉ cần copy sang `.env` và tự điền giá trị của họ.

3. **Cơ chế tải file cấu hình theo thứ tự ưu tiên của Vite:**
   ```
   .env                # Mặc định tải trong mọi môi trường
   .env.local          # Cấu hình cá nhân cục bộ (bị Git ignore)
   .env.development    # Chỉ tải khi chạy 'npm run dev'
   .env.production     # Chỉ tải khi chạy 'npm run build'
   ```

---

## ❓ 7. CÁC LỖI THƯỜNG GẶP VÀ CÁCH XỬ LÝ (TROUBLESHOOTING)

### 🔴 Lỗi 1: `import.meta.env.VITE_...` trả về `undefined`
* **Nguyên nhân:** Biến trong file `.env` bị thiếu tiền tố `VITE_` (ví dụ gõ nhầm thành `API_BASE_URL`).
* **Cách khắc phục:** Luôn đặt tên biến bắt đầu bằng `VITE_` (ví dụ `VITE_API_BASE_URL`).

### 🔴 Lỗi 2: Đã sửa file `.env` nhưng giao diện web không thay đổi
* **Nguyên nhân:** Vite nạp biến môi trường khi bắt đầu tiến trình chạy. Việc sửa file `.env` sẽ không tự động cập nhật qua Hot Module Replacement (HMR).
* **Cách khắc phục:** Tắt terminal dev server (`Ctrl + C`) và chạy lại lệnh `npm run dev`.

### 🔴 Lỗi 3: TypeScript gạch chân đỏ báo lỗi thuộc tính không tồn tại trên `ImportMetaEnv`
* **Nguyên nhân:** Biến mới thêm vào `.env` nhưng chưa được khai báo kiểu dữ liệu trong file định nghĩa kiểu của TypeScript.
* **Cách khắc phục:** Mở file [`src/vite-env.d.ts`](file:///c:/Users/Lenovo/Documents/FPT/FA26/WDP301/Fitness/frontend/src/vite-env.d.ts) và thêm định nghĩa biến:
  ```typescript
  interface ImportMetaEnv {
    readonly VITE_BIEN_MOI: string;
  }
  ```

---
*Tài liệu này được tạo tự động nhằm chuẩn hóa quy trình phát triển và bàn giao dự án môn học WDP301.*
