# Thư viện tham chiếu kỹ thuật

Sáu bản JSON là **bản nháp có nguồn**, chưa có Coach phê duyệt và chưa có bộ video độc lập để xác nhận thuật toán. `SUPPORTED` chưa được bật. Tiêu chí dựa tài liệu huấn luyện, mục tiêu cá nhân, ngưỡng thuật toán và bằng chứng validation được lưu riêng; đọc một nguồn chuyên môn không làm ngưỡng xử lý ảnh trở thành chuẩn khoa học.

`index.json` liệt kê các phiên bản. `exercise-standard.schema.json` mô tả cấu trúc; `standard_registry.py` kiểm tra các trường bắt buộc, variant, nguồn và metadata phê duyệt trước khi đọc. Hash `standard_digest()` xác định toàn bộ snapshot; `approval_digest()` xác định nội dung cần duyệt, loại phần envelope phê duyệt để tránh hash tự tham chiếu. Xác minh report thực và ngưỡng chấp nhận diễn ra ở runtime evaluator, không chỉ dựa nhãn trong JSON.

Mỗi thay đổi nội dung cần phiên bản mới và ghi `history`; kết quả phân tích giữ snapshot/version/digest cũ. `build_drafts.py` tạo lại các nháp gốc và từ chối ghi đè nếu một phiên bản đã thay đổi. Không chạy script để thay thế tiêu chuẩn đã được người chuyên môn rà soát.

## Rà soát bởi người chuyên môn

Từ `ai-exercise-service` chạy:

```powershell
.venv\Scripts\python.exe -m http.server 8765 --bind 127.0.0.1 --directory standards
```

Mở `http://127.0.0.1:8765/review.html`. Công cụ cho xem nguồn, pha, phép đo, điều kiện, gợi ý và giới hạn từng tiêu chí; Coach nhập thông tin, điều kiện đề xuất và rà lời khuyên rồi xuất JSON. Công cụ không ghi server hoặc tự kích hoạt rule. File xuất là hồ sơ đề xuất; tính xác thực/chuyên môn của người duyệt cần được người quản lý kiểm tra ngoài công cụ. Khi hoàn tất nội dung, tách tập video độc lập, gắn nhãn và chốt chỉ tiêu chấp nhận trước khi kiểm thử. Chỉ kích hoạt tiêu chí thuộc variant/góc/quần thể đã kiểm chứng; loại D không được suy diễn từ pose 2D.

## Phạm vi nguồn

- [ACE Bodyweight Squat](https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/) và [NSCA Optimizing Squat Technique](https://www.nsca.com/education/videos/bridge-series/bridge-optimizing-squat-technique/) là nguồn định tính cho bản Bodyweight. Không tự chuyển sang weighted squat, không dùng một mức sâu bắt buộc chung.
- [ACE Push-up](https://www.acefitness.org/resources/everyone/exercise-library/41/push-up/), [ACE Front Plank](https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/), [ACE Forward Lunge](https://www.acefitness.org/resources/everyone/exercise-library/94/forward-lunge/) xác định biến thể tham chiếu. Plank dùng khoảng giữ, không dùng chu kỳ Squat.
- [ACE Hammer Curl](https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/) chỉ là ngữ cảnh neutral-grip cho bài đứng. Không áp cách cầm hoặc mốc cố định cho mọi curl; hệ thống chưa xác minh grip từ pose.
- [ACE Dumbbell Shoulder Press](https://www.acefitness.org/resources/pros/expert-articles/5047/strength-training-workout-for-beginners/) và [ACE Shoulder Solutions](https://www.acefitness.org/resources/pros/expert-articles/9074/smart-shoulder-solutions-an-evidence-based-approach-to-training-the-deltoids/) cung cấp ngữ cảnh dumbbell và biến thể ngồi; không áp hướng dẫn barbell hoặc máy sang dumbbell.
- [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) chỉ mô tả công nghệ khớp, không duyệt điều kiện kỹ thuật.

Các nội dung tham chiếu được diễn đạt lại ngắn gọn, không chép lại toàn bộ bài của nguồn. Không có ngưỡng số kỹ thuật nào được gán là do ACE/NSCA phê duyệt cho phần mềm này.
