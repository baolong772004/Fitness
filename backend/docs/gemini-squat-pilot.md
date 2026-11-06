# Nhận xét video Squat bằng Gemini

Phạm vi: Squat không tạ. Theo chính sách cập nhật, Member nhận nhận xét Gemini tự động sau khi tải video và đồng ý rõ việc gửi video tới Google. Coach xem lại khi Member chủ động chia sẻ. Không cần migration.

1. Mobile gửi `externalVideoConsent=true` sau khi người dùng tích ô đồng ý có nhắc tới Google Gemini. API cũ chỉ có `consent=true` không được hiểu là đồng ý gửi sang Google. Dữ liệu lịch sử không được tự gửi đi.
2. Worker đo chuyển động bằng MediaPipe và gửi video thật cho Gemini. AI Coach Decision Engine ở Backend đưa ra một kết quả theo từng rep/tiêu chí, kiểm tra số đo, chất lượng tracking, góc quay, thời điểm, frame và tình trạng kiểm chứng của quy tắc. Quy tắc đã kiểm chứng có thể quyết định dù model không thấy lỗi; số đo rõ và tái hiện được phép so sánh cho phép nhận định thử nghiệm. Không yêu cầu hai nguồn đồng ý hoàn toàn. Nếu mâu thuẫn cùng thời điểm mà chưa có căn cứ mạnh hơn, chỉ tiêu chí đó chuyển sang cần kiểm tra thêm.
3. Kết quả thống nhất nằm tại `resultJson.assessment`; các lý do chọn nguồn ở `assessmentDiagnostics` dành cho Coach/Admin. Member thấy một kết luận cho từng rep, lỗi và cách sửa, tiêu chí đạt trong phạm vi đã kiểm tra và tiêu chí chưa đo được. Không hiển thị hai bộ nhãn nguồn. Không có tỷ lệ % kỹ thuật đúng. Một lỗi được xác định vẫn được giữ khi tiêu chí khác thiếu dữ liệu; kết luận đạt chỉ có phạm vi tiêu chí quan sát được, không xác nhận toàn bộ bài tập.
4. Video tối đa 12 MB cho Gemini. Key chỉ ở backend; `GEMINI_VIDEO_MODEL` là tuỳ chọn, mặc định dùng `GEMINI_MODEL`. Giới hạn xử lý Gemini 90 giây, thử lại một lần với HTTP 502/503/504. Giữ dữ liệu video tại phòng Gym tối đa 7 ngày; không cam kết thời gian lưu của nhà cung cấp Google.
5. Kết quả mới nằm ở `ExerciseAnalysis.resultJson.visionAnalysis`, kèm `externalVideoConsent` và audit log. Kết quả cũ `visionPilot` giữ nguyên. Member có thể đồng ý bổ sung Gemini qua `POST /exercise-analysis/:id/vision-analysis` cho video của mình còn lưu; gọi lại kết quả đã hoàn tất không gọi Google thêm. Luồng Coach/Admin thử nghiệm cũ vẫn dùng cùng service.

## Kiểm chứng ban đầu với 20–30 video

Tạo bộ 20–30 video Squat khác nhau, gồm mẫu đúng, lỗi hướng gối, độ sâu theo mục tiêu, nhịp, chất lượng kém và thiếu góc quay. Coach gắn nhãn từng rep/tiêu chí (`MEETS`, `IMPROVE` hoặc `UNASSESSABLE`), thời điểm xảy ra, bằng chứng và cách sửa bằng luồng hiện có. Không dùng nhãn AI tự sinh làm ground truth. Chỉ dùng SQL Server **test** tách biệt, có schema mới và `PT_TEST_DATABASE_URL`:

```powershell
cd backend
node -e "const os=require('node:os');os.userInfo=()=>({username:process.env.USERNAME||'tester',uid:-1,gid:-1,shell:null,homedir:process.env.USERPROFILE});require('tsx/cjs');require('./scripts/evaluateGeminiSquatPilot.ts')"
```

Script chỉ đọc DB test, loại video trùng hash và in TP/FP/FN/TN, precision/recall trên **rep/tiêu chí Coach đã gắn nhãn** cho các nguồn và quyết định cuối; số tiêu chí còn chưa kết luận được đếm riêng. Dưới 20 video khác nhau có nhãn hợp lệ thì trạng thái là `INSUFFICIENT_COACH_LABELED_VIDEOS`. Bộ khởi đầu này chưa chứng minh độ tin cậy thực tế; cần video holdout khác dữ liệu dùng để điều chỉnh và Coach xem lại cảnh báo sai/lỗi bỏ sót.
