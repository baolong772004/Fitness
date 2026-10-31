# Truy vết kết quả #12 và phạm vi đánh giá kỹ thuật

Kiểm tra tại môi trường phát triển ngày 2026-10-31. Đây là báo cáo từ SQL và video thật, không phải nhãn Coach.

## Vì sao #12 vẫn 0/0/8

- SQL: `ExerciseAnalysis.id=12`, chủ sở hữu `MEMBER`, `evaluationMode=OFFICIAL`, `resultVersion=exercise-analysis-result-2`, `ruleVersion=squat-observation-6`.
- Video SHA-256: `5d27d9b378af0d323237fa48fa2fe32befec20a72e4f24988f7979f7fef9c7a8`; 5 rep, 165 pose frame, 5/8 tiêu chí có số đo. Đây là cùng video được dùng trong bài thử trực tiếp FastAPI và Backend.
- `experimentalEvaluation` không có trong #12 vì tuyến Member tạo job OFFICIAL. Worker và Backend không xóa trường này.
- `released_policy` chặn mọi verdict chính thức vì tiêu chuẩn Squat còn draft. SQL có 0 nhãn Coach, 0 bản rà soát và 0 tiêu chí `APPROVED_AND_VIDEO_VALIDATED`. #12 cũng chưa được chia sẻ video cho Coach.
- Không có cache kết quả: #12 được xử lý với `resultVersion` mới. API GET chỉ đọc bản ghi đã lưu; bản ghi cũ không được tự tái phân tích.

## Kiểm thử thực tế

- `backend/tests/artifacts/live-runtime-experimental.json`: job thử nghiệm tạm qua Backend đang chạy, Worker, Python Service và SQL thật bằng đúng video #12. Job tạm được xóa sau khi chụp response. `SQUAT-03` tạo 10 dự đoán theo 5 rep × 2 gối, 1 verdict thử nghiệm cấp tiêu chí, kèm số đo, ngưỡng và landmark.
- `backend/tests/artifacts/exercise-experimental-e2e.json`: cơ sở dữ liệu thử nghiệm riêng, đối chiếu JSON FastAPI → Worker SQL → Backend API → Mobile projection. Video ngang có mục tiêu `HIP_AT_KNEE` tạo `NEEDS_IMPROVEMENT` thử nghiệm ở `SQUAT-02`, rep 2; rep 1 trả `UNABLE_TO_ASSESS` do mốc theo dõi chưa ổn định.
- `backend/tests/artifacts/exercise-coverage-audit.json`: chạy video thật qua 15 trường hợp của sáu bài tập, các góc và biến thể Squat. Chỉ hai nhánh Squat nêu trên có verdict thử nghiệm. Push-up, Plank, Lunge, Curl, Press vẫn thiếu bộ tách rep/đoạn giữ tư thế và rule; ảnh 2D đo khớp không đủ để kết luận.
- Mobile `tsc --noEmit` đạt. Python 14 unit test liên quan đạt. Integration SQL tạm đạt 4 test tuyến Backend và 2 test video thật. Backend full `tsc` còn hai lỗi kiểu timer `unref` ở `membership.service.ts` và `ptNoShow.service.ts`, nằm ngoài Exercise Analysis.

## Cổng phát hành chưa thể vượt

Không chuyển draft sang APPROVED bằng sửa trạng thái database. Cần Coach gắn nhãn video thật, bộ holdout độc lập, ngưỡng chấp nhận công bố trước, báo cáo kiểm thử có hash và phê duyệt phạm vi model/rule/camera/biến thể. Hiện chưa có dữ liệu Coach nào trong SQL. Vì vậy Member #12 phải tiếp tục thấy 0 verdict chính thức; chỉ Developer/Coach được xem kết quả thử nghiệm có cảnh báo **CHƯA KIỂM CHỨNG**.
