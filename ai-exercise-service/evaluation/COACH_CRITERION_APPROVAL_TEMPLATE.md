# Hồ sơ Coach duyệt từng tiêu chí Squat — BẢN MẪU CHƯA KÝ

Sao chép mẫu này **riêng cho SQUAT-03 và SQUAT-02** sau khi đã có nhãn và báo cáo holdout độc lập. Chưa điền giá trị hoặc ký duyệt thay Coach. Review nội dung trên Web lưu `COACH_REVIEWED_PENDING_VIDEO_VALIDATION`; nút phát hành riêng chỉ hoạt động khi AI service chấm lại báo cáo holdout và Coach xác nhận bằng mật khẩu.

## Danh tính và phạm vi

- Criterion ID / tên: [Coach điền]
- Standard version / digest: [đối chiếu file chuẩn và kết quả inference]
- Coach duyệt / chuyên môn / mã hồ sơ: [Coach điền]
- Biến thể: BODYWEIGHT; camera: [FRONT cho SQUAT-03 hoặc SIDE cho SQUAT-02]
- Model version / rule version / result version: [đóng băng trước holdout]
- Người tập, mục tiêu tập, giới hạn áp dụng: [Coach điền]

## Quy tắc được rà

- Công thức và khớp cần nhìn thấy: [Coach đối chiếu chuẩn]
- Điều kiện MEETS: [Coach điền]
- Điều kiện IMPROVE: [Coach điền độc lập, không mặc nhiên là phần bù của MEETS]
- Điều kiện UNASSESSABLE: [Coach điền]
- Ngưỡng, đơn vị, căn cứ và ngày chốt trước holdout: [Coach điền]
- Gợi ý sửa và giới hạn quan sát 2D: [Coach điền]

## Dữ liệu và kết quả độc lập

- Development: video/người/buổi/rep/MEETS/IMPROVE/UNASSESSABLE: [điền]
- Holdout REAL độc lập: video/người/buổi/rep/MEETS/IMPROVE/UNASSESSABLE: [điền]
- Xác nhận không trùng SHA, người, buổi hoặc clip đã dùng chỉnh rule: [người quản lý dữ liệu kiểm tra]
- Manifest SHA-256 / label SHA-256 / inference SHA-256 / report SHA-256: [điền]
- Acceptance criteria ID, ngày Coach chốt, precision/recall tối thiểu, abstention tối đa, số nhãn/video tối thiểu: [điền]
- TP/FP/FN/TN, precision, recall, abstention, false acceptance, rep count error, phân nhóm camera/ánh sáng: [chép từ report và kiểm tra]
- Những trường hợp bất đồng AI/Coach, nguyên nhân, cách xử lý: [Coach ghi]

## Quyết định

- [ ] Dữ liệu không đủ / từ chối phát hành
- [ ] Yêu cầu chỉnh rule và kiểm thử holdout mới
- [ ] Đồng ý phát hành **riêng tiêu chí và phạm vi ghi trên** sau khi hệ thống kiểm tra toàn bộ bằng chứng

Tên, chữ ký/xác nhận Coach, ngày giờ có múi giờ: [CHƯA CÓ]

Người kiểm tra độc lập, ngày giờ có múi giờ: [CHƯA CÓ]

Mã báo cáo validation và mã bản phát hành: [CHƯA CÓ]

Lưu ý: bản mẫu này không tự đổi trạng thái chuẩn hoặc mở verdict Member. Coach phải dùng nút **Kiểm tra bằng chứng, ký duyệt và phát hành** trên Web sau khi có báo cáo hợp lệ. Backend lưu chữ ký, report hash, phạm vi và thời điểm; AI service chỉ kích hoạt tiêu chí nếu kiểm tra lại video, nhãn, inference, metric và phiên bản đều đạt.
