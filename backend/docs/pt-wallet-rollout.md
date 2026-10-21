# PT Wallet rollout

## Nghiệp vụ cũ và mới

| Phạm vi | Trước đây | Sau refactor |
| --- | --- | --- |
| Gym | Membership có thời hạn, hàng chờ kích hoạt | Giữ nguyên; quyền Gym phải bao phủ toàn bộ ca PT |
| PT trả phí | Membership PT có ngày hết hạn, `remainingSessions`, thường gắn một Coach | Credit theo `BEGINNER`, `INTERMEDIATE`, `ADVANCED`; mỗi lần mua mới có hạn riêng từ PayOS, nguồn cũ không bị tự gán hạn; có thể chọn Coach đủ chuyên môn |
| PT tặng | `trialPtSessions`/`remainingSessions` trong Gym Membership | Batch `MEMBERSHIP_GIFT` gắn Membership cấp quà; chỉ dùng trong thời gian Gym đó hợp lệ |
| Mua PT | Checkout gói PT theo thời gian | Mua `PtProduct` qua PayOS; callback đã xác thực mới cấp credit, mỗi payment chỉ cấp một lần |
| Booking | Có thể chờ Coach duyệt và trừ buổi trên Membership | Tự `CONFIRMED`, giữ credit theo batch; batch booking atomic, chống trùng ca |
| Vắng/học bù | Dựa trên số buổi gói cũ | Giữ hoặc tiêu thụ credit; học bù chuyển quyền giữ chỗ sang booking mới |
| Dữ liệu cũ | Membership, Payment, Booking PT cũ | Giữ nguyên để tra cứu; script backfill tạo batch và allocation tương ứng |

## Phạm vi thay đổi

- Prisma: `CoachSpecialization`, `PtProduct`, `PtWallet`, `PtCreditBatch`, `PtCreditTransaction`, `PtBookingCreditAllocation`; thêm `Package.ptLevel`, `Payment.ptProductId`, `Payment.ptQuantity`.
- Backend: `/api/pt/wallet`, `/api/pt/wallet/history`, `/api/pt/products`, `/api/pt/wallet/bookings`, API Admin quản lý sản phẩm, ví và chuyên môn Coach; `/api/payments/pt-credit/checkout`. Staff/Admin có `/api/pt/booking/:id/manual-check-in` với lý do và ActionLog khi QR lỗi. Route PT cũ còn đọc/đặt cho dữ liệu đã chuyển đổi, nhưng gói PT Membership cũ ngừng bán.
- Web Admin: quản lý sản phẩm PT, ví, chuyên môn Coach; lịch chung và ngoại lệ dùng các màn sẵn có. Web Coach: lịch rảnh, booking đã xác nhận, báo vắng, QR, kết thúc, chat và học viên có wallet booking.
- Mobile: ví theo cấp độ, mua credit, chọn Coach/ca, lịch sử credit, báo vắng, học bù, QR và chat.

## Chính sách đã chọn

- PT trả phí còn lại không mất khi Gym hết hạn nhưng chỉ đặt được khi cả Gym và chính nguồn PT còn hiệu lực. Nguồn PT hết hạn vẫn lưu lịch sử; có thể gia hạn đúng nguồn trong 30 ngày nếu còn buổi và đã cấu hình giá gia hạn. `TRIAL` chỉ khả dụng trong khoảng hiệu lực của Membership cấp quà; không được bán hoặc gia hạn theo giá PT trả phí.
- Hội viên báo vắng sớm có tối đa ba quyền học bù **trên mỗi batch PT trả phí**. Báo vắng ở buổi bù hoặc quá hạn hai giờ tiêu thụ credit. Hội viên báo vắng Trial tiêu thụ credit và không tự cấp học bù. Coach báo vắng giữ credit và cấp quyền học bù trong bảy ngày, không dùng quota của hội viên.
- Booking đã xác nhận mà Gym hoặc Trial không còn bao phủ sẽ bị worker hủy trước buổi tập và giải phóng credit. Check-in xác thực quyền Gym lại.
- Không tự quy đổi cấp độ hoặc chuyển Coach của credit cũ gắn Coach. Gói PT cũ không xác định được cấp độ phải được Admin phân loại thủ công trước backfill.

## Triển khai dữ liệu

1. Sao lưu SQL Server và đối chiếu các migration hiện có, đặc biệt các migration `20261017_*` trong workspace. Không chạy `db push` lên cơ sở dữ liệu đang có dữ liệu.
   Khi so sánh schema trên database thử nghiệm, còn drift mặc định cột `Membership` có sẵn từ trước; cần đối chiếu migration cũ trước khi áp dụng lên môi trường chính.
2. Điền `Package.ptLevel` cho mọi gói PT lịch sử chưa được tự suy ra từ tên chính xác `Beginner`, `Intermediate`, `Advanced`, `Trial`. Rà soát Coach specialization; migration chỉ suy ra từ chuỗi chuyên môn chính xác, không tự cấp quyền cao hơn.
3. Trong `backend`, đặt `DATABASE_URL` trỏ đúng môi trường đích rồi chạy `npx prisma migrate deploy` và `npx prisma generate`. Migration `20261019_pt_credit_wallet` là cộng thêm, không xóa dữ liệu cũ.
4. Chạy `npx tsx scripts/backfillPtWallet.ts` (dry run mặc định). Xử lý toàn bộ `errors` trước khi chạy `npx tsx scripts/backfillPtWallet.ts --apply`. Script idempotent theo Membership, cấp lại đúng nguồn và chuyển booking đang giữ chỗ. Lưu báo cáo dry run và apply để đối soát.
5. Đối soát số batch, tổng `initialCount/usedCount/heldCount` theo từng hội viên và nguồn với Membership, Payment, Booking cũ; kiểm tra sản phẩm, chuyên môn Coach, PayOS callback và worker trong môi trường staging.

Migration mới và backfill đã được chạy trên SQL Server thử nghiệm riêng `fitness_pt_test`. Migration `20261019_pt_credit_wallet` đã được áp dụng lên database local cấu hình `fitness_db` ngày 2026-10-19; startup schema guards đã đạt. Backfill trên `fitness_db` mới chạy dry run: `ready: 2`, `skipped: 3`, còn hai lỗi phân cấp cho Membership #4 (Package #3) và Membership #7 (Package #7). Hai package này không ghi rõ cấp độ nên chưa áp dụng backfill. Chưa kiểm thử callback PayOS thật, MongoDB/socket trên thiết bị và giao diện mobile trên máy thật. Bộ integration dùng SQL Server thật nhưng gọi service/controller trực tiếp. Khi triển khai, cần kiểm thử luồng HTTP và thanh toán staging trước khi mở bán.
