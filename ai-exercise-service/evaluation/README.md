# Gắn nhãn và đánh giá Squat

Chưa có GT Coach. Manifest cố ý rỗng; report không có số accuracy. Không lấy output AI làm nhãn đúng.

## Coach đánh giá

1. Mở coach-review.html bằng trình duyệt, chọn video được đồng ý sử dụng. Trang không upload. Nếu Web Crypto không chạy với file, từ ai-exercise-service chạy `python -m http.server 8765 --bind 127.0.0.1 --directory evaluation`, mở http://127.0.0.1:8765/coach-review.html.
2. Ghi mã/tên Coach, nguồn REAL/EDITED/SYNTHETIC, góc và khả năng phân tích. Mục tiêu phải chốt trước lần tập, không chọn lại để làm nhãn khớp AI.
3. Mỗi rep hoàn chỉnh: đầu rời đứng, đáy và cuối trở lại đứng. Dùng bước 0,1s/nút lấy thời điểm. Rep dở dang ghi chú, không tính rep hoàn chỉnh.
4. Mỗi tiêu chí: PRESENT/ABSENT/UNASSESSABLE. PRESENT cần timestamp, nên ghi căn cứ. Không đủ dữ liệu chọn UNASSESSABLE, không chọn ABSENT. Gối cần chính diện thấy đủ chân; độ sâu/thân cần ngang; không có mục tiêu thì tiêu chí theo mục tiêu không đánh giá.
5. Ghi hướng sửa Coach thấy phù hợp và giới hạn. Đánh giá độc lập trước khi xem AI; nên có Coach thứ hai đối chiếu bất đồng, lưu bản gốc và bản thống nhất.
6. Kiểm tra số rep/mốc/mọi nhãn, tick xác nhận rồi xuất JSON. SHA-256 ràng buộc nhãn với video. Tick xác nhận không có nghĩa hệ thống xác minh chứng chỉ Coach.

Lưu video/nhãn ở evaluation/private/ (gitignore), dùng mã Coach nếu cần; không đưa dữ liệu hội viên lên git.

## Chuẩn bị tập đánh giá

- Quay độc lập, nhiều người/buổi/ánh sáng/quần áo/camera. Bắt đầu đứng ổn định, thấy đủ chân.
- Mỗi tiêu chí có PRESENT/ABSENT/UNASSESSABLE; thêm góc chéo, che khớp, camera chuyển, nhiều người, rep dở dang, bài khác Squat.
- Không yêu cầu người tập thực hiện chuyển động đau/nguy hiểm để tạo nhãn; Coach chọn tình huống phù hợp.
- Tách development/holdout theo người/buổi, không chỉ tên file. Video đã xem/chỉnh ngưỡng thuộc development, gồm sample hiện tại.
- Báo số clip/người/rep và phân bố nhãn/góc cùng metrics; vài clip không đủ kết luận tổng quát.

## Chạy evaluator

Điền manifest khi có nhãn thật. Ví dụ cấu trúc, không phải dataset đã tồn tại:

```json
{"clips":[{"video":"private/subject-a-side.mp4","labels":"private/subject-a-side.mp4.coach.json","sourceType":"REAL","split":"holdout"}]}
```

Từ ai-exercise-service:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
$env:MPLCONFIGDIR = Join-Path (Get-Location) '.venv/mplconfig'
.\.venv\Scripts\python.exe evaluate.py --manifest evaluation/manifest.json --output evaluation/report.json
```

Yêu cầu Coach xác nhận, nguồn REAL, protocol hợp lệ, đủ nhãn/mốc, hash khớp. Loại dựng/synthetic, không holdout, trùng hash. Split/nguồn/người đánh giá vẫn do người chuẩn bị khai báo, script không thể chứng minh dữ liệu độc lập hay chứng chỉ Coach.

Ghép rep một-một theo temporal IoU ≥0,5; binary từng dấu hiệu trên từng rep. Dự đoán dư có dấu hiệu tính FP. GT PRESENT mà không phát hiện, kể cả từ chối, tính FN. GT UNASSESSABLE loại khỏi precision/recall, đếm riêng. Từ chối toàn clip dùng số rep 0 khi tính sai số. Timestamp MAE chỉ trên TP đã ghép.

Report: TP/FP/FN/TN, abstained/GT không đánh giá được, precision/recall từng dấu hiệu/góc, repCountMAE, insufficientDataRate theo clip, falseAcceptanceCount với clip không thể phân tích/không Squat, phiên bản rule/model/config. Mẫu số 0 trả null; không GT trả INSUFFICIENT_GROUND_TRUTH. excluded nêu lý do loại clip. Chưa có khoảng tin cậy hay đo đồng thuận Coach.

## Checklist Mobile v4

- Gửi video 3–30s, thử có/không mục tiêu; protocol sau xử lý phải giữ nguyên.
- Mở video, bật/tắt skeleton, bấm rep và timestamp; đối chiếu đúng bên cơ thể và thời điểm.
- Không tín hiệu vẫn thấy đã kiểm tra/chưa đánh giá, không khẳng định toàn bộ đúng.
- Chia sẻ kết quả đúng Coach; video cần đồng ý riêng; thu hồi mất quyền.
- Nghiệm thu Android/iOS thật, video dọc/ngang/xoay metadata/tốc độ khung hình thấp.
