# PT Trial và Paid

## Nguồn quyền lợi

Backend áp dụng chính sách theo `PtCreditBatch.source` của Credit đã giữ cho Booking:

| Nguồn | Loại | Mua |
| --- | --- | --- |
| `MEMBERSHIP_GIFT` | Trial | Tặng qua Gym Membership |
| `PACKAGE_PURCHASE` | Paid | Nút Mua theo gói, số buổi và giá của `PtProduct` |
| `SINGLE_PURCHASE` | Paid | Nút Mua buổi lẻ, đúng 1 buổi, giá `PtProduct.singleSessionPrice` |

Đơn PayOS lưu `Payment.ptPurchaseMode` và ảnh chụp số buổi. Webhook cấp Credit theo ảnh chụp và hình thức mua, không dựa vào giá sản phẩm hiện tại. Mua nhiều gói trong một đơn tạo một lô Credit cho mỗi gói để hạn mức bảo lưu và đổi Coach tính riêng. Đơn cũ không có `ptPurchaseMode` giữ cách phân loại trước đây.

## Báo vắng

Thời điểm báo vắng do máy chủ xác định. Báo trước ít nhất 2 giờ và còn lượt bảo lưu thì Booking chuyển `CANCELLED`, Credit giữ chỗ trở về đúng lô, hạn sử dụng không đổi. Trial có 1 lượt bảo lưu mỗi lô tặng; Paid theo gói nhiều buổi có tối đa 3 lượt mỗi lô; Paid buổi lẻ có 1 lượt. Hết lượt hoặc báo trễ thì trừ đúng 1 Credit. Coach báo vắng tạo quyền học bù 7 ngày, không dùng lượt bảo lưu của hội viên. Giao dịch `PROTECTED_CANCEL` ghi đồng thời việc hoàn 1 Credit và dùng 1 lượt bảo lưu; không ghi thêm `RELEASE` cho cùng buổi. Xử lý lặp Booking đã hủy bị từ chối.

Các giới hạn trên hiện là giá trị cố định trong `ptEntitlementPolicy.service.ts`; Admin có thể xem lịch sử và xử lý ngoại lệ đổi Coach nhưng chưa có màn hình tự thay đổi giới hạn.

### Đánh giá cấu hình Admin

Nên chuyển ba hạn mức (`protectedCancelLimit`, `coachChangeLimit`, `renewalGraceDays`) vào bảng cấu hình có `source`, `effectiveAt`, người sửa và lịch sử phiên bản. Khi cấp lô Credit, lưu phiên bản chính sách hoặc các hạn mức áp dụng vào lô để thay đổi sau này không hồi tố cho gói đã bán. Backend phải kiểm tra giới hạn và quyền theo lô, màn hình Admin chỉ quản lý cấu hình; không tin giá trị gửi từ Mobile. Giới hạn đầu vào cần chặn số âm, đặt trần hợp lý và ghi ActionLog. Việc này cần migration và kiểm thử hồi quy riêng, chưa triển khai trong đợt này.

## Đổi Coach

Hội viên chỉ tự yêu cầu đổi Coach trên lô `PACKAGE_PURCHASE` nhiều buổi, còn hiệu lực và chưa dùng hết. Coach mới phải đang hoạt động và có chuyên môn cho cấp PT. Tối đa 1 lần đổi theo yêu cầu mỗi lô; Coach cũ ngừng hoạt động thì yêu cầu không tính hạn mức. Nếu có lịch tương lai, Admin duyệt hoặc từ chối. Khi duyệt, lịch tương lai với Coach cũ bị hủy, Credit giữ chỗ được trả về lô, Booking không chuyển sang Coach mới. Credit đã dùng và thời hạn không đổi. Giáo án hiện hành được sao chép cho Coach mới, bản cũ được lưu trữ khi Coach cũ không còn quan hệ PT khác với hội viên.

## Chat và gia hạn

Trial chat phục vụ lịch đã xác nhận và chưa qua giờ kết thúc. Paid được chat tiếp với Coach đang phụ trách khi lô Paid còn hạn và còn Credit chưa sử dụng, kể cả sau một buổi tập đã kết thúc. Quyền chat được kiểm tra lại ở backend khi gửi tin. Paid có thể gia hạn riêng từng lô trong 30 ngày sau hạn nếu còn Credit; gia hạn không cộng buổi. Trial không gia hạn.

## Triển khai

Chạy Prisma migration trước khi khởi động backend đã cập nhật. Migration `20261030_pt_paid_entitlements` thêm giá buổi lẻ, hình thức mua và lịch sử yêu cầu đổi Coach; gán Coach cho các lô Paid cũ dựa trên Booking đầu tiên. Migration `20261031_pt_purchase_units` thay ràng buộc một lô mỗi Payment bằng ràng buộc duy nhất theo Payment và thứ tự gói, để một đơn mua nhiều gói cấp nhiều lô mà callback lặp không cấp trùng. Không tự thay đổi trạng thái hay hạn Credit cũ. Integration test dùng `PT_TEST_DATABASE_URL` trỏ đến SQL Server thử nghiệm đã migrate, có tên database chứa `test`.

### Kết nối SQL Server và TLS

Trên máy kiểm tra, sandbox chạy với tài khoản Windows riêng nên `integratedSecurity=true` trả lỗi SSPI `No credentials are available in the security package`. `sqlcmd -E -Q "SELECT 1"` chạy bằng tài khoản Windows của chủ máy kết nối được cùng instance; vì vậy không sửa ứng dụng bằng cách tắt TLS. Chạy migration và integration test bằng tài khoản có quyền trên database thử nghiệm, đặt `PT_TEST_DATABASE_URL` tới database riêng và kiểm tra tên database chứa `test`. Không dùng database ứng dụng để chạy fixture.

Trong production, cấu hình `encrypt=true`, chứng chỉ SQL Server có tên máy hợp lệ và chuỗi CA được client tin cậy; Prisma v6 hỗ trợ `trustServerCertificateCA` để chỉ tới CA riêng. Không dùng `trustServerCertificate=true` cho production vì tùy chọn này bỏ qua xác thực chứng chỉ. Tham khảo [Prisma SQL Server v6](https://www.prisma.io/docs/orm/v6/overview/databases/sql-server) và [Microsoft: cấu hình chứng chỉ SQL Server](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/configure-sql-server-encryption).
