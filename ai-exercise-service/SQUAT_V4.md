# Squat v4: triển khai, kiểm thử và giới hạn

Ngày kiểm tra: 2026-10-30. Rule: `squat-observation-4`.

**Đã nâng cấp phần mềm. Chưa đạt mức AI kiểm tra kỹ thuật đáng tin cậy đã được kiểm chứng.** Chưa có nhãn Coach xác nhận; các ngưỡng là ngưỡng thử nghiệm, không phải chuẩn an toàn hay chuẩn sinh cơ học.

## Thay đổi và phần giữ lại

Giữ MediaPipe Pose Landmarker Lite + OpenCV, bộ tách rep góc ngang và các phép so sánh trong `rules.py`. Thêm `squat_criteria.py` để phân loại góc quay, tách rep chính diện và đánh giá từng rep. `squat_config.py` quản lý ngưỡng, kiểm tra cấu hình và trả snapshot/hash. `main.py` lấy mẫu mặc định 10 Hz, giữ 12 điểm vai/hông/gối/cổ chân/gót/mũi chân hai bên; inference chạy ngoài event loop FastAPI.

Backend/Worker chỉ bổ sung truyền góc quay/mục tiêu qua luồng upload và `resultJson` hiện có; không thêm migration hay xây lại hạ tầng. Mobile thêm lựa chọn mục tiêu, dấu hiệu theo bộ phận/thời điểm, danh sách đã/chưa đánh giá. Giữ video, skeleton, chọn rep, so sánh lịch sử và chia sẻ Coach theo quyền hiện có.

## Điều kiện dữ liệu

Video 3–30 giây, tối đa 25 MB, một người, camera cố định, thấy vai đến hai bàn chân; bắt đầu đứng yên khoảng một giây và kết thúc đứng. Engine giả định video là Squat, chưa phân biệt được mọi bài khác.

Tọa độ normalized đổi sang pixel theo width/height trước khi tính góc. Điểm phân tích cần visibility ≥0,65 và nằm trong ảnh. Visibility không phải xác suất nhận xét đúng.

Góc quay ước lượng bằng bề rộng vai/hông trên ảnh chia chiều dài thân. SIDE: vai ≤0,55 và hông ≤0,45. FRONT: vai ≥0,70 và hông ≥0,35. Cần ≥75% pose frames ủng hộ cùng góc; phần giữa hoặc không rõ trả UNKNOWN. Lựa chọn người dùng không ép vượt kiểm tra này. Heuristic chưa hiệu chuẩn, có thể nhầm do phối cảnh, xoay thân và khác biệt cơ thể.

Rep cần độ phủ ≥80%, không mất tracking quá 0,31 giây. Dịch chuyển cổ chân ≤0,12 chiều dài chân đầu rep. Kiểm tra thước tham chiếu bàn chân có p90/p10 − 1 ≤0,20: dùng gót–mũi chân ở góc ngang nếu có, khoảng cách cổ chân ở chính diện. Đây chỉ là kiểm tra ổn định hạn chế; không đo được camera/mặt sàn thực. Nhiễu bàn chân có thể làm từ chối nhiều rep.

Góc ngang giữ bộ tách rep theo gối: đứng ≥155°, rời đứng ≥8°, biên độ ≥35°, chu kỳ ≥0,6 giây. Chính diện dùng độ hạ hông tương đối cổ chân, chuẩn hóa chiều dài chân đoạn đứng đầu: bắt đầu ≥0,10, đỉnh ≥0,20, trở lại ≤0,05. Không dùng góc gối nhìn chính diện để kết luận độ sâu. Không ghép rep qua đoạn mất tracking hoặc tính rep dở dang.

## Tiêu chí từng rep

Các số đo là hình chiếu 2D; trục y hướng xuống. Thân/gối cần ≥3 mẫu liên tiếp kéo dài ≥0,25 giây.

| Tiêu chí | Công thức, đầu vào | Điều kiện và ngưỡng mặc định | Bằng chứng và hướng thử điều chỉnh |
| --- | --- | --- | --- |
| DEPTH_TARGET | Median `(kneeY−hipY)/distance(hip,knee)` quanh đáy ±0,2s | Ngang; đã chọn HIP_AT_KNEE; ≥3 mẫu đáy; tỷ lệ >0,12 | Rep, thời điểm đáy, cửa sổ đo, tỷ lệ và mục tiêu. Thử hạ thêm chút trong phạm vi thoải mái; không ép khi đau/khó kiểm soát, nhờ Coach sửa mục tiêu. Không đo nếp hông hoặc độ sâu phù hợp từng người. |
| TORSO_ASCENT_CHANGE | `lean(t)−lean(bottom)` và `(hipRise−shoulderRise)/torsoLength(bottom)`; vai/hông/gối/cổ chân | Ngang; 60% đầu pha lên; đồng thời tăng ≥12° và chênh nâng ≥0,12, kéo dài đủ thời gian | Rep, timestamp đỉnh, khoảng thời gian, độ tăng góc và chênh nâng. Thử lên chậm hơn, để vai/hông cùng nâng; quay ngang đối chiếu hoặc nhờ Coach. Không kết luận cong lưng hay nguyên nhân. |
| DESCENT_TARGET | `bottomSeconds−startSeconds` so với mục tiêu | Cả hai góc; tracking liên tục; mục tiêu 1–6s được chọn; lệch tuyệt đối >0,30s | Rep, đoạn xuống, thời gian đo/mục tiêu/chênh lệch. Thử đếm theo mục tiêu; đổi mục tiêu nếu chủ ý tập nhịp khác. Chưa tách dừng đáy; nhịp khác không có nghĩa nguy hiểm. |
| KNEE_INWARD_LEFT / RIGHT | Độ đổi có dấu của `kneeX−(ankleX+toeX)/2` so đầu rep, chia khoảng cách hai cổ chân; cần cả hai bên và bàn chân | Chính diện; gót/mũi chân rõ ≥80% rep và mốc đứng; khoảng cách cổ chân ≥0,15 chiều dài chân; chân ổn định; dịch vào giữa ≥0,10 thế đứng và đủ thời gian | Rep, bên cơ thể, timestamp/khoảng thời gian, tỷ lệ. Thử giữ bàn chân ổn định, cho gối theo hướng mũi chân trong phạm vi thoải mái; quay lại/nhờ Coach. Không ép mở gối, không chẩn đoán valgus/chụm gối. |

Mỗi tiêu chí trả status/outcome/reason, formula, landmarks, thresholds, qualityConditions, evidence, limitation và validation. Rep có criteria/bodyParts/trackingCoverage/qualityEvidence. Observation có bộ phận, rep, timestamp, khoảng thời gian, thông số và hướng điều chỉnh. Tổng hợp ghi rõ số rep được đánh giá trên tổng số.

Mặc định không đặt độ sâu/nhịp; thiếu mục tiêu thì ghi chưa đánh giá. Không có tín hiệu vẫn hiển thị đã kiểm tra/chưa đánh giá, không tuyên bố toàn bộ đúng.

## So sánh cũ và các kết luận không hỗ trợ

Các phép so sánh gắn WITHIN_CLIP_COMPARISON, tách khỏi OBSERVABLE_SIGNAL: biên độ <70% rep lớn nhất; nghiêng thân cuối tăng ≥12° so đầu; thời gian pha >1,6 lần pha ngắn nhất; khoảng ngang gối–cổ chân/chiều dài cẳng chân lệch >0,20. Cần ≥2 rep; nếu một rep không đủ tracking kỹ thuật thì không phát các so sánh này. Đây là khác biệt trong clip, không phải chuẩn kỹ thuật độc lập.

LUMBAR_CURVATURE, HEEL_LIFT, BALANCE, LEFT_RIGHT_SYMMETRY luôn chưa đánh giá, kèm lý do. Vai/hông không đo đường cong cột sống; thấy gót không chứng minh tiếp xúc sàn; không có trọng tâm/lực để kết luận mất thăng bằng. Không trả điểm đúng/an toàn.

## Cấu hình và truy vết

`SQUAT_CONFIG_PATH` trỏ file JSON với khóa trong SquatConfig; khóa lạ/giá trị sai bị từ chối. Ví dụ cú pháp: `{"sample_hz":10,"depth_tolerance_ratio":0.12}`. Kết quả giữ toàn bộ ngưỡng, hash squat-v4, ruleVersion, hash model và protocol. Chỉnh ngưỡng trên development, không chỉnh bằng holdout rồi công bố accuracy trên cùng dữ liệu.

## Video thật đã chạy

Inference trực tiếp MP4 qua MediaPipe, không nạp landmark giả. Mục tiêu thử nghiệm là hông ngang gối và xuống 2s; không coi đây là mục tiêu ban đầu của người trong video.

| Video | Output v4 | Giới hạn |
| --- | --- | --- |
| github-side-squat.mp4, 20,49s | SIDE, 2 rep, 205 pose frames; nhịp đánh giá 2/2, không dấu hiệu | Tham chiếu bàn chân dao động nên độ sâu/thân chưa đánh giá 2/2. Không phải chứng nhận đúng. |
| barbell-back-squat.mp4, 14s | SIDE, 4 rep, 140 pose frames; lệch nhịp mục tiêu ở 4/4; độ sâu/thân đánh giá 2/4, không tín hiệu hai tiêu chí đó | Chưa có Coach xác nhận số rep hoặc dấu hiệu. |
| dumbbell-goblet-squat.mp4, 19,12s | INSUFFICIENT_DATA, UNKNOWN | Chưa biết từ chối đúng hay sai theo Coach. |
| kettlebell-goblet-squat.mp4, 17,2s | INSUFFICIENT_DATA, UNKNOWN | Chưa hiệu chuẩn góc quay. |
| Ba clip squat_*view-220k.mp4, 35,48–38,61s | Từ chối vì vượt 30s | Không đánh giá kỹ thuật từ các clip này. |

Clip dựng/đảo đoạn squat-variable-depth-test.mp4 phát DEPTH_TARGET và DESCENT_TARGET ở rep 2, chỉ kiểm tra nhánh code. Video trống tự tạo bị từ chối. Không dùng hai trường hợp này làm bằng chứng phát hiện lỗi người tập thật.

Chi tiết: [development-smoke-report.json](evaluation/development-smoke-report.json). Trong 4 clip thật có độ dài hợp lệ, 2 clip bị từ chối (50% trên mẫu development nhỏ này, không phải benchmark với GT). Chưa có positive độ sâu/thân/gối được Coach xác nhận. Nhánh chính diện chưa kiểm chứng trên bộ video thật phù hợp.

## Kiểm thử phần mềm

- 28 Python unit tests qua: rep cũ, tiêu chí mới, chân bị che/di chuyển, nhiễu một frame, tracking gaps, 5Hz, thứ tự timestamp, không mục tiêu, không suy diễn chẩn đoán, phép tính metrics. Hình học giả chỉ dùng test logic.
- 6 backend unit, 1 HTTP media, 3 integration tests qua. SQL test tạo riêng/xóa sau chạy; xác nhận upload giữ mục tiêu, quyền chia sẻ/video/thu hồi/expiry. TypeScript qua.
- Mobile typecheck/lint qua, có 2 cảnh báo cũ ở pt-chat/PtConversation. 3 test tương thích v2/v3/v4 qua, gồm giữ null cho góc nhìn ngang không thể đo từ chính diện. UI v4 cần tiếp tục nghiệm thu trên thiết bị thật; smoke emulator v3 trước đây không phải kiểm chứng v4. Lần kiểm tra hiện tại không có Android emulator kết nối, browser automation host không khả dụng; chưa xác minh trực quan UI v4/trang Coach.
- [Công cụ Coach](evaluation/coach-review.html) mở video local, gắn mốc/dấu hiệu, xuất JSON có SHA-256 và xác nhận Coach. [Hướng dẫn](evaluation/README.md).
- evaluate.py chạy inference mới trên nhãn xác nhận, nguồn thật/holdout/hash khớp; tính precision/recall từng dấu hiệu, sai số đếm, timestamp, tỷ lệ thiếu dữ liệu.
- HTTP AI local trả 200, rule v4, 4 rep/140 pose frames từ barbell thật và giữ protocol; chặn sai key (403)/options sai (400). Integration Worker dùng AI stub chỉ kiểm tra vận chuyển protocol/lưu kết quả, không phải kiểm thử độ chính xác.

Manifest hiện rỗng. [report.json](evaluation/report.json) ghi INSUFFICIENT_GROUND_TRUTH, 0 clip, precision/recall/repCountMAE/insufficientDataRate đều null. Không dùng 0%/100% thay cho chưa có dữ liệu.

## Chưa đạt

1. Chưa xác nhận độ tin cậy độ sâu/thân/gối trên video thật, chưa có precision/recall thực tế.
2. Chính diện mới qua unit tests; cần video thật với cả có/không dấu hiệu.
3. Bộ lọc góc quay/bàn chân còn thô, từ chối nhiều rep; chưa tách mọi chuyển động camera.
4. Chưa benchmark bài khác, che khớp, nhiều người, ánh sáng/quần áo/tỷ lệ cơ thể đa dạng.
5. Gợi ý là câu cố định theo quan sát, chưa được Coach đánh giá tính phù hợp cá nhân. Không dùng Gemini suy diễn.
6. Chưa đánh giá cong lưng, gót, thăng bằng, đối xứng; chưa mở rộng Push-up/Plank.

Ưu tiên tiếp theo: Coach gắn nhãn tập development và holdout độc lập, đo lỗi từng tiêu chí/mức từ chối rồi mới kết luận độ tin cậy.
