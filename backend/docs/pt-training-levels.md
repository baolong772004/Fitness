# Nghiệp vụ lộ trình PT theo cấp

Gói PT đã mua xác định cấp `BEGINNER`, `INTERMEDIATE` hoặc `ADVANCED`. Coach vẫn được Admin cấp chuyên môn tương ứng trước khi nhận booking. Cấp của học viên trong hồ sơ Coach lấy từ booking PT gần nhất hoặc gói PT được phân công.

## Đánh giá và theo dõi

Coach ghi đánh giá đầu vào tại **Hồ sơ học viên** trước khi gán giáo án riêng. Dữ liệu được lưu trong `PtTrainingAssessment`, gắn với học viên, Coach và cấp PT. Học viên xem đánh giá trên màn **Tiến độ** của mobile. Các lần đánh giá tiếp theo là `REVIEW`; hệ thống không cho ghi review trước baseline.

| Cấp | Dữ liệu bắt buộc | Mốc Coach được nhắc đánh giá lại |
| --- | --- | --- |
| Cơ bản | Mục tiêu, nhận xét kỹ thuật/khả năng vận động, bước tiếp theo | 4 buổi PT hoàn thành |
| Trung cấp | Mục tiêu, tên và giá trị chỉ số đo tiến bộ, bước tiếp theo | 3 buổi PT hoàn thành |
| Nâng cao | Mục tiêu, giai đoạn tập, tên và giá trị chỉ số đo tiến bộ, bước tiếp theo | 2 buổi PT hoàn thành |

Mốc đánh giá là lời nhắc cho Coach; không chặn việc hoàn tất buổi PT hoặc trừ lượt của học viên. Khi Coach soạn giáo án AI cho một học viên, cấp PT và đánh giá gần nhất được đưa vào ngữ cảnh tạo bản nháp. Coach phải duyệt bản nháp trước khi giao. Giáo án mẫu chưa chọn học viên vẫn hoạt động như trước.

## Triển khai

Chạy `npx prisma migrate deploy` và `npx prisma generate` trong `backend` trước khi dùng chức năng đánh giá PT. API đánh giá và tiến độ cần bảng mới trong cơ sở dữ liệu.
