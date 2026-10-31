# Báo cáo debug AI Exercise Form Checker — Squat v6

Ngày kiểm tra: 2026-10-31. Engine đang chạy tại `127.0.0.1:8001` trả `ruleVersion: squat-observation-6`. Đây là bộ quan sát chuyển động 2D đang thử nghiệm, chưa có nhãn Coach để đo độ chính xác.

## Nguyên nhân gốc và thay đổi

1. Bản v4 chỉ tìm tư thế đứng ổn định trong 0,5 giây đầu. Video bắt đầu khi đang hạ người không thể khởi tạo, dù các rep phía sau rõ. Bản v5 đã tìm mốc đứng ở mọi đoạn phù hợp, bỏ rep đầu dở dang, giữ frame chuyển động qua vùng góc nhìn tạm mơ hồ và kiểm tra độ phủ theo từng rep. Clip chính diện từng bị `INSUFFICIENT_DATA` nay đếm được 5 rep.
2. Bản v5 lấy từng frame bằng seek OpenCV theo FPS báo cáo. Video FPS biến thiên có thể seek trùng/lệch frame nhưng gán timestamp đều, làm hỏng nhịp hoặc đếm thừa. Bản v6 đọc liên tiếp, lấy PTS của frame giải mã, chỉ dùng FPS khi PTS sai, và ghi số lần fallback. Fixture VFR cùng chuyển động đã chuyển từ **6 rep ở v5 xuống 5 rep ở v6**, bằng clip gốc. Không đổi ngưỡng để đạt kết quả này.
3. Lỗi “0 đã kiểm tra / 9 chưa thể đánh giá” có hai phần: điều kiện khởi tạo toàn clip chặn mọi tiêu chí và các tiêu chí không đủ điều kiện dùng chung một lý do. Bản v6 tách điều kiện theo từng tiêu chí: cần rep hoàn chỉnh, có thể đo từ đoạn hợp lệ, cần góc cụ thể, thiếu landmark, thiếu mục tiêu, hoặc chưa triển khai. `JOINT_MOTION` chỉ trả số đo biên độ của đoạn khớp liên tục; `MOVEMENT_TIMING` chỉ đo số rep và nhịp; cả hai không chứng nhận tư thế đúng. Các mục cong lưng, nhấc gót, thăng bằng, đối xứng toàn thân vẫn `NOT_ASSESSED` với `NOT_IMPLEMENTED`, không có `PASS` giả.
4. Thiếu mũi chân một bên trước đây chặn cả hai kiểm tra hướng gối chính diện. Nay mỗi bên kiểm tra landmark của chính bên đó; bên còn lại vẫn có thể đánh giá. Góc không phù hợp, mục tiêu chưa chọn và mất theo dõi có mã/lý do khác nhau.
5. Clip chéo thật bị bề rộng vai/hông gán `SIDE` dù hai cổ chân luôn trải rộng hơn vai ở các đoạn đứng. Bản v6 coi sự mâu thuẫn kéo dài này là `OBLIQUE`, chỉ đo chu kỳ/nhịp, từ chối các tiêu chí cần góc ngang hoặc chính diện và hướng dẫn quay lại đúng góc. Quy tắc này dùng cùng tỷ lệ đồng thuận góc đã có, không thêm ngưỡng số mới.

Các ngưỡng phân đoạn và ngưỡng phát tín hiệu giữ nguyên v5; không hạ ngưỡng để ép trả kết quả. Video bắt đầu giữa rep chỉ đếm chu kỳ sau khi đã thấy mốc đứng; khoảng mất dấu dài không nối thành rep.

## Pipeline đã kiểm tra

- OpenCV: ghi FPS, frame count báo cáo, số frame giải mã, PTS, số frame lấy mẫu, EOF sớm, độ xoay metadata, trạng thái tự xoay và kích thước ảnh sau xoay. Fixture xoay metadata `270°` được tự xoay, trả 5 rep như gốc. Các clip kiểm thử hợp lệ có `timestampFallbacks=0`.
- MediaPipe: dùng `RunningMode.VIDEO`; timestamp đầu vào được lấy từ PTS, làm tròn mili giây và bắt buộc tăng nghiêm ngặt. Mỗi frame ghi số pose hoặc `BLURRED`, `NO_POSE`, `MULTIPLE_PEOPLE`.
- Landmarks: lưu 12 khớp hai bên và visibility để overlay vẫn có dữ liệu. Diagnostic tách thiếu điểm, visibility thấp, điểm ngoài ảnh, giá trị không hữu hạn và hình học chi quá ngắn. Bên dùng để tách rep là bên có nhiều frame đủ vai–hông–gối–cổ chân hơn; không đổi bên giữa rep. Góc gối/hông tính bằng tọa độ pixel đúng tỉ lệ ảnh, là góc hình chiếu 2D.
- Tín hiệu: lưu góc/tọa độ thô và đã làm mượt, khoảng giá trị, chuỗi trạng thái, thời điểm chuyển trạng thái, rep bị từ chối và nguyên nhân. Trên clip chính diện, tín hiệu hông thô có biên độ `0,458`, sau làm mượt `0,456`; làm mượt không xóa chuyển động trong clip này.

[Bảng chẩn đoán từng video](evaluation/PIPELINE_DIAGNOSTICS.md) có FPS, tỷ lệ pose/landmark, khoảng góc gối/hông, mọi tiêu chí, lý do từ chối và link JSON/CSV theo thời gian cho từng frame. [Manifest](evaluation/debug-video-manifest.json) ghi SHA-256, nguồn clip và phép dựng lại; video chỉnh sửa được ghi `EDITED`, không dùng làm nhãn đúng của Coach.

## Kết quả video

`Đọc / mẫu / pose / hợp lệ` là số frame giải mã, số frame đưa vào lấy mẫu, số frame nhận diện một pose và số frame đủ hình học theo góc đã chọn. Tỷ lệ pose và landmark dùng mẫu làm mẫu số. Bảng đầy đủ có 18 trường hợp; dưới đây là các ca kiểm tra lỗi chính.

| Video | FPS | Đọc / mẫu / pose / hợp lệ | Pose / hợp lệ | v5 → v6 rep | Kết quả và nguyên nhân |
|---|---:|---:|---:|---:|---|
| Squat nghiêng thật | 29,970 | 614 / 205 / 205 / 205 | 100% / 100% | 2 → 2 | Hoàn thành; gối phải 71,847–177,043° |
| Squat chính diện thật | 29,970 | 495 / 165 / 165 / 165 | 100% / 100% | 5 → 5 | Hoàn thành; gối trái 132,655–179,691°, phải 141,749–179,857° |
| Bắt đầu giữa rep, chỉnh từ clip thật | 30,034 | 471 / 157 / 157 / 157 | 100% / 100% | 4 → 4 | Bỏ rep đầu dở, đếm 4 rep hoàn chỉnh sau đó |
| Đứng 3 giây rồi tập, chỉnh từ clip thật | 29,970 | 585 / 195 / 195 / 195 | 100% / 100% | 5 → 5 | Không đếm phần đứng yên |
| Mất dấu ngắn, chỉnh từ clip thật | 29,970 | 495 / 165 / 163 / 163 | 98,8% / 98,8% | 5 → 5 | Vẫn giữ 5 rep |
| Mất dấu dài, chỉnh từ clip thật | 29,970 | 495 / 165 / 156 / 156 | 94,5% / 94,5% | 4 → 4 | Bỏ chu kỳ bị đứt, không nối qua mất dấu |
| VFR, chỉnh từ clip thật | 22,613 | 375 / 165 / 165 / 165 | 100% / 100% | 6 → 5 | Đọc PTS thật, hết đếm thừa một rep |
| Xoay bằng metadata, chỉnh từ clip thật | 29,970 | 495 / 165 / 165 / 165 | 100% / 100% | 5 → 5 | Tự xoay đúng, góc chính diện |
| Đứng yên, chỉnh từ clip thật | 25,168 | 149 / 60 / 60 / 60 | 100% / 100% | 0 → 0 | `NO_SQUAT_MOVEMENT`; gối biến thiên dưới 0,2° |
| Hammer curl thật | 25,000 | 327 / 131 / 131 / 131 | 100% / 100% | 0 → 0 | `NO_SQUAT_MOVEMENT`; có pose nhưng không có chu kỳ squat |
| Squat quay chéo thật | 25,000 | 639 / 256 / 256 / 256 | 100% / 100% | 5 → 5 | `OBLIQUE`; đo chu kỳ, không nhận xét kỹ thuật theo góc ngang/chính diện |

Ba clip `squat_*_view-220k.mp4` dài 35–39 giây bị chặn bởi giới hạn upload 30 giây trước khi chạy pose; `0 frame` của chúng không phải lỗi MediaPipe. Clip barbell, dumbbell và kettlebell thật lần lượt cho 4, 5, 5 rep; clip `variable-depth` chỉnh sửa cho 2. Tất cả chi tiết, góc theo thời gian và kết quả từng tiêu chí ở báo cáo liên kết trên. Không có nhãn Coach độc lập nên số rep này là output để kiểm tra hồi quy, chưa phải độ chính xác so với thực tế.

## Tiêu chí và thông báo

Ở clip chính diện: `MOVEMENT_TIMING` và `JOINT_MOTION` được `MEASURED`; kiểm tra hướng gối trái/phải trả `NO_SIGNAL` theo quy tắc hiện có. Độ sâu và thân lúc đứng lên báo cần góc ngang; nhịp xuống theo mục tiêu báo chưa chọn mục tiêu. Bốn tiêu chí chưa triển khai báo `NOT_IMPLEMENTED` riêng. `NO_SIGNAL` chỉ nghĩa là chưa phát hiện dấu hiệu theo ngưỡng thử nghiệm, không có nghĩa đúng kỹ thuật. Nếu không có rep, tiêu chí cần rep nêu `NO_SQUAT_MOVEMENT`/`NO_STANDING_REFERENCE`/`NO_COMPLETE_REPETITION` khi phù hợp; đoạn khớp hợp lệ vẫn có thể được đo riêng. Mobile hiển thị trạng thái “đã đo một đoạn” và không tính số đo này là kiểm tra kỹ thuật đạt.

## File thay đổi trong vòng sửa này

- `main.py`, `video_io.py`, `diagnostics.py`: giải mã và timestamp, VIDEO inference, xoay metadata, trace từng frame và báo cáo từ chối.
- `rules.py`, `squat_criteria.py`, `squat_config.py`: trace state machine, đoạn chuyển động, điều kiện từng tiêu chí, bên cơ thể, version v6; không đổi ngưỡng số.
- `diagnose_videos.py`, `requirements-dev.txt`, `evaluation/debug-video-manifest.json`, `evaluation/PIPELINE_DIAGNOSTICS.md`, `test_diagnostics.py`, `test_video_regressions.py`, `test_squat_criteria.py`: bộ dữ liệu phát lại, kết quả thật và kiểm thử. Các file video/JSON/CSV trong `samples/` và `evaluation/private/` là artifact cục bộ.
- `backend/src/services/exerciseAnalysis.utils.js`, `backend/tests/exerciseAnalysis.unit.test.mjs`, `backend/tests/run-exercise-isolated.mjs`: giữ trace đầy đủ trong chi tiết nhưng thu gọn payload lịch sử; chạy AI, PT Booking và Wallet trên database test tạm.
- `mobile-react-native/src/lib/exerciseAnalysis.ts`, `mobile-react-native/src/components/ExerciseAnalysisResult.tsx`: phân biệt đo đoạn chuyển động với kiểm tra kỹ thuật, nhận diện kết quả v5/v6. Video player và skeleton overlay vẫn dùng `poseFrames` cũ.
- `README.md` và báo cáo này: lệnh phát lại, kết quả và giới hạn.

## Kiểm thử và giới hạn

53 Python tests qua, gồm logic với landmark hình học dựng để kiểm tra state machine và 7 hồi quy đọc **output inference từ video thật/chỉnh thật**. Backend: 14 unit/media/PT policy tests, 3 AI integration và 52 PT Booking/Wallet integration qua trên SQL test DB tạm đã xóa. Mobile typecheck qua; lint 0 lỗi, còn 2 cảnh báo unused có sẵn ở `pt-chat.tsx` và `PtConversation.tsx`. API `POST /analyze/squat` đã smoke test với video chính diện: v6, 5 rep, 165 overlay frames và 165 diagnostic samples. [Smoke API clip chéo](evaluation/private/pipeline-debug/live-api-oblique-smoke.json) sau khi khởi động lại cũng trả `OBLIQUE`, 5 rep, 256 overlay frames và 256 diagnostic samples; `/health` trả v6. Chưa nghiệm thu trực quan màn Android/iOS cho vòng thay đổi này. Kết quả lịch sử lưu từ v4/v5 không tự chạy lại; cần gửi lại video để nhận kết quả mới.

Giới hạn chưa giải quyết: phân loại góc quay vẫn dựa hình chiếu 2D, và quy tắc “cổ chân trải rộng hơn vai” có thể chịu ảnh hưởng của thế đứng rộng hoặc phối cảnh. Nó giúp từ chối kết luận kỹ thuật ở clip chéo đang có, chưa chứng minh phân loại đúng mọi clip chéo. Chưa có camera calibration hay nhãn góc được Coach xác nhận để chọn ngưỡng mới an toàn. Engine cũng chưa phân loại mọi bài tập khác Squat: clip curl này bị từ chối vì không có chu kỳ squat, nhưng chưa chứng minh tỷ lệ từ chối chung. Các tiêu chí cong lưng, gót chạm sàn, thăng bằng và đối xứng chưa thể kết luận từ pose 2D. Cần tập video độc lập được Coach gắn nhãn để đo sai số rep, góc quay, dấu hiệu và hiệu chỉnh góc chéo mà không tăng đếm nhầm.
