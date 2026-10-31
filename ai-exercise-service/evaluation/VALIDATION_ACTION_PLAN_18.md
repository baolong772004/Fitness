# Kế hoạch kiểm chứng Squat sau kết quả #18

Kiểm tra SQL lúc 01:04 ngày 01/11/2026 (Bangkok): #18 là SQUAT/BODYWEIGHT, OFFICIAL, 5 rep, FRONT, 16,52 s; video gốc còn lưu. Kết quả đã chia sẻ cho Coach ID 2 nhưng `includeVideo=false`, nên Coach chưa thể xem video hoặc gắn nhãn. Có 0 nhãn Coach, 0 review tiêu chí, 0 tiêu chí được phê duyệt sau kiểm chứng. Coach Ho Dang Quang (user ID 2) có tài khoản/hồ sơ ACTIVE và quan hệ PT hợp lệ với Member ID 5. Coach Cuong7Nui (ID 7) không có quan hệ PT hợp lệ với Member này.

Lần kiểm tra Mobile ngày 01/11 phát hiện `.env.local` còn gọi `192.168.1.25` trong khi IP LAN hiện tại của máy Backend là `192.168.1.27`. Mobile hiển thị lỗi kết nối và không tải được lịch sử. Đã sửa `.env.local`, khởi động lại Metro và xác nhận app tải được lịch sử cùng kết quả #18 từ Backend. Trên màn hình #18, ô cho phép video vẫn chưa tích, nút cấp quyền còn mờ. Dòng tiêu đề “Chỉ thấy kết quả được chia sẻ khi quan hệ PT còn hiệu lực...” nằm ở **Web Coach**, không xác nhận quyền video của #18.

**Cập nhật 01:13 ngày 01/11:** Sau khi người dùng đã xác nhận muốn cấp quyền cho #18, thao tác được thực hiện qua phiên Mobile Member: tích ô cho phép video, bấm nút cấp quyền, nhận dòng “Máy chủ đã xác nhận Coach được xem video gốc và gắn nhãn.” SQL kiểm tra lại trả `includeVideo=true`, `revokedAt=null`, video còn lưu và quan hệ PT hợp lệ. Chưa có nhãn Coach hoặc phê duyệt. Web Coach cần bấm **Tải lại** trong khung AI Form Check để bỏ trạng thái trước khi cấp quyền; thao tác này đang chờ xác nhận trên màn hình Coach.

SHA-256 video #18 là `5d27d9b378af0d323237fa48fa2fe32befec20a72e4f24988f7979f7fef9c7a8`, đúng bằng clip development `samples/front-facing-squat-pexels-5034577.mp4`. Vì vậy #18 chỉ dùng để thực hành gắn nhãn và rà quy trình; không đưa vào holdout độc lập và không dùng làm bằng chứng về kỹ thuật của chính Member nếu người trong clip không phải Member.

## Mobile Member: chia sẻ #18

1. Đăng nhập tài khoản Member đã tạo #18. Vào **AI Form Check**, mở lịch sử và chọn **Kết quả #18**.
2. Ở **Gửi kết quả cho Coach**, đánh dấu **Cho phép Coach xem cả video gốc khi chia sẻ**.
3. Vì #18 đã chia sẻ kết quả nhưng chưa cấp video, bấm **Cấp quyền xem video gốc cho Coach Ho Dang Quang** sau khi đánh dấu ô; nút đang mờ sẽ sáng lên. Mobile gửi lại quyền `includeVideo:true`; không cần thu hồi rồi chia sẻ lại. Chờ dòng **Máy chủ đã xác nhận Coach được xem video gốc và gắn nhãn**. Nếu vẫn ghi Coach chỉ thấy kết quả hoặc có lỗi đỏ, quyền chưa được lưu.
4. Video tự hết hạn sau 7 ngày từ lúc tải lên; với #18 thời điểm đó khoảng 07/11/2026 23:26 (giờ Bangkok). Chia sẻ sớm để Coach có thể mở video.

Nếu không thấy Coach, kiểm tra quan hệ PT còn hiệu lực; nút chia sẻ chỉ liệt kê Coach hợp lệ. Nếu không thấy ô cho phép video, bản gốc đã hết hạn hoặc bị xóa và cần tải lại video được phép sử dụng.

## Web Coach: gắn nhãn và rà tiêu chí

1. Đăng nhập Web bằng tài khoản **Ho Dang Quang**. Vào **Hồ Sơ Học Viên** → **AI Form Check được học viên chia sẻ** → **Tải lại**. Mở video #18 bằng nút **Xem video học viên đã cho phép chia sẻ & Gắn nhãn / Duyệt tiêu chí**.
2. Coach xem video và ghi nhận độc lập trước khi đọc số đo AI. Chọn **Rep 1–5**; nút rep điền khoảng thời gian và nhảy tới đáy rep. Có thể sửa mốc **Bắt đầu**, **Thời điểm bằng chứng**, **Kết thúc** bằng nút **Lấy video**.
3. Với **SQUAT-03**, chọn góc **FRONT** và lần lượt cho từng rep nhãn **MEETS**, **IMPROVE** hoặc **UNASSESSABLE** theo quan sát của Coach. Điền **Bằng chứng quan sát** và **Ghi chú Coach**, rồi bấm **Lưu nhãn video cho tiêu chí**. Không gắn MEETS chỉ vì AI có số đo. Nếu không nhìn rõ gối/bàn chân, chọn UNASSESSABLE và ghi lý do.
4. #18 quay FRONT, vì vậy **SQUAT-02** về độ sâu cần góc SIDE và mục tiêu độ sâu đã chọn trước buổi tập. Với #18 ghi **UNASSESSABLE** nếu Coach không thể xác định độ sâu theo rubric; không suy diễn từ ảnh chính diện. Với video SIDE mới, chọn mục tiêu **Muốn hông gần ngang gối ở đáy** trên Mobile trước khi gửi, rồi Coach gắn nhãn từng rep.
5. Mở **Rà soát điều kiện/ngưỡng & Duyệt nội dung tiêu chí**, chọn SQUAT-03 hoặc SQUAT-02, điền chuyên môn/chứng chỉ, mã hồ sơ, phạm vi camera/biến thể, điều kiện đạt/chưa đạt, căn cứ ngưỡng, rồi bấm **Lưu rà soát Coach · chờ kiểm chứng Holdout**. Trạng thái chỉ là `COACH_REVIEWED_PENDING_VIDEO_VALIDATION`, chưa phát hành cho Member.
6. Bảng **AI vs Coach** cho thấy bất đồng để điều tra. Sau khi nhãn đủ và Coach kiểm tra lại, **Xuất gói Holdout JSON**. Gói xuất hiện là bản nháp: nguồn, subject, session, split, xác nhận Coach và điều kiện phê duyệt cần điền bằng chứng thật. Gói chứa `inferenceResult` nhưng không chứa bản thân video.

## Dữ liệu và checklist còn thiếu

Kho development có 12 video Squat thật, gồm 9 Bodyweight và 3 có tạ; 9 Bodyweight được định hướng 3 FRONT, 3 SIDE, 3 OBLIQUE trong metadata nhưng phải kiểm tra góc thật từng clip. Tất cả chỉ phù hợp cho development/rà phần mềm. Không video nào có nhãn Coach trong SQL. Manifest holdout đang có 0 video. Video #18 trùng development nên không được chuyển sang holdout.

| Tiêu chí | Development cần làm | Holdout độc lập cần thu thập | Nhãn tối thiểu trước khi cân nhắc phát hành |
| --- | --- | --- | --- |
| SQUAT-03 (hướng gối trên ảnh) | Coach gắn nhãn từng rep của clip FRONT thật, bắt đầu #18 như mẫu quy trình; rà lại ngưỡng và lỗi tracking | Ít nhất 3 video Bodyweight FRONT mới, khác video/người/buổi development | Ít nhất 5 rep `MEETS`, 5 rep `IMPROVE`; ghi thêm `UNASSESSABLE` cho gối/bàn chân bị che hoặc camera không phù hợp |
| SQUAT-02 (độ sâu theo mục tiêu) | Coach xem clip SIDE và chốt mục tiêu `HIP_AT_KNEE` trước inference; điều tra rep bị tracking/reference từ chối | Ít nhất 3 video Bodyweight SIDE mới, khác video/người/buổi development, có mục tiêu đã thống nhất trước khi quay | Ít nhất 5 rep `MEETS`, 5 rep `IMPROVE`; ghi thêm `UNASSESSABLE` nếu mốc hông/gối không rõ hoặc reference không ổn định |

Các mức 3 video, 5 nhãn mỗi phía, precision/recall ≥ 0,80 và tỷ lệ từ chối ≤ 0,20 nằm trong `acceptance-criteria.json` dưới dạng **đề xuất**. Coach có chuyên môn phải xác nhận phạm vi và chỉ tiêu trước khi chạy holdout. Không dùng cùng người/buổi, clip cắt lại, hoặc video đã dùng chọn ngưỡng để tạo holdout. Không yêu cầu người tập cố làm động tác gây đau để tạo nhãn lỗi.

## Chạy công cụ kiểm chứng khi có dữ liệu thật

1. Coach rà và lưu điều kiện/ngưỡng **trước khi bắt đầu holdout**; thời điểm `reviewedAt` phải sớm hơn `holdoutStartedAt` trong hồ sơ kiểm chứng. Lưu video được đồng ý sử dụng, nhãn Coach đã xác nhận và inference cố định trong `ai-exercise-service/evaluation/private/`. Kiểm tra hash video khớp manifest/nhãn/inference, `subjectId` và `sessionId` đúng người/buổi thật, camera/biến thể/phiên bản rule/model không thay đổi. Bộ chấm cũng so hash/người/buổi với danh mục development đã lưu, kể cả khi manifest chỉ liệt kê holdout. Gói Web export mặc định `UNASSIGNED`/`UNVERIFIED` và `coachConfirmed:false`; chỉ Coach/người quản lý dữ liệu có bằng chứng thật mới sửa các khai báo này.
2. Tạo manifest `evaluation/private/holdout-manifest.json` với `evaluationMode: "OFFLINE_CANDIDATE"`, `clips` là các `manifestEntry` đã kiểm tra. Mỗi entry được phép chọn `criterionIds:["SQUAT-03"]` hoặc `["SQUAT-02"]`; từng rep trong nhãn phải có nhãn cho tiêu chí đã chọn. Không đưa #18 vào manifest holdout.
3. Nếu cần so điều kiện ứng viên offline, từ `ai-exercise-service` chạy:

   ```powershell
   .\.venv\Scripts\python.exe evaluate_technique.py --candidate-input evaluation/private/holdout/clip.inference.json --candidate-standard evaluation/private/proposed-standard.json --candidate-output evaluation/private/holdout/clip.candidate.json
   ```

   Proposed standard phải được Coach rà điều kiện và ngưỡng trước holdout. Kết quả ứng viên ở `candidateTechniqueEvaluation`, không ảnh hưởng Member.
4. Chạy:

   ```powershell
   .\.venv\Scripts\python.exe evaluate_technique.py --manifest evaluation/private/holdout-manifest.json --output evaluation/private/holdout-report.json
   ```

   Report cho từng tiêu chí có TP/FP/FN/TN, precision, recall, abstention, số video và các clip bị loại. Không đủ nhãn trả `INSUFFICIENT_GROUND_TRUTH`; không diễn giải thành accuracy.
5. Coach độc lập xem các bất đồng và hồ sơ: nguồn/giấy phép video, danh tính người/buổi, bản rubric và digest, model/rule/camera/biến thể, điều kiện/ngưỡng đã chốt, nhãn gốc và lịch sử sửa, report cùng SHA-256, mẫu dương/âm, tỷ lệ từ chối, giới hạn đánh giá. Trong **Coach ký duyệt & phát hành tiêu chí sau Holdout độc lập**, nhập đường dẫn report trong `evaluation/private`, SHA-256, acceptance ID, model/rule/camera đã kiểm chứng, họ tên và mật khẩu Coach; xác nhận rồi bấm **Kiểm tra bằng chứng, ký duyệt và phát hành**. Backend kiểm tra quyền, nhãn SQL và chữ ký; AI service tự chấm lại artifact/hash/metric trước khi kích hoạt riêng tiêu chí. Nếu thiếu hoặc lệch dữ liệu, màn hình báo blocker và không phát hành. Không sửa trạng thái database bằng tay.

## Preflight hiện tại

`evaluate_technique.py --manifest evaluation/manifest.json` trả `INSUFFICIENT_GROUND_TRUTH`, 0 video holdout, không có precision/recall. Đây là kết quả đúng với dữ liệu hiện có; Member tiếp tục 0 verdict chính thức.
