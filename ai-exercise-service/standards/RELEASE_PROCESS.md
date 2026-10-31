# Phát hành tiêu chí kỹ thuật sau kiểm chứng

Các tiêu chuẩn đi kèm dự án đều đang là draft. Chưa có người chuyên môn phê duyệt hay bộ holdout có nhãn Coach để bật kết luận trong Mobile. Các test tạo JSON giả chỉ kiểm tra phần mềm, không được dùng làm bằng chứng chất lượng.

## Luồng đánh giá đề xuất ngoài ứng dụng

1. Coach chuyên môn rà soát nguồn, phạm vi biến thể, góc quay, điều kiện đạt và điều kiện cần cải thiện. `improvementCondition` phải khai báo độc lập; chỉ dùng `{"kind":"COMPLEMENT_OF_PASS"}` nếu Coach chủ ý duyệt toàn bộ phần ngoài vùng đạt là cần cải thiện. Không tự suy ra thất bại từ một điều kiện đạt.
2. Chốt chỉ tiêu chấp nhận trước khi chạy holdout: precision, recall, tỷ lệ từ chối tối đa, số nhãn có/không có dấu hiệu tối thiểu và số video tối thiểu. Ghi mốc có múi giờ, người rà soát và phạm vi model/rule/biến thể/camera. Không có mặc định số nào tự bật tính năng.
3. Dùng video REAL được cho phép và Coach gắn nhãn độc lập. Tách người/buổi khỏi development. Manifest cần `subjectId`, `sessionId`, `coachLabels`, `resultPath`, `sha256`, `criterionIds`, `referenceStandardVersion`; từng clip có output riêng. Nhãn cần cùng SHA-256 và phiên bản rubric.
4. Phép đo thô có thể chạy dưới engine draft. Để thử điều kiện đề xuất trước khi phê duyệt phát hành, xuất kết quả ứng viên ra namespace riêng:

```powershell
.venv\Scripts\python.exe evaluate_technique.py --candidate-input evaluation/private/clip.runtime.json --candidate-standard evaluation/private/proposed-standard.json --candidate-output evaluation/private/clip.candidate.json
```

`techniqueEvaluation` của bản runtime giữ nguyên. `candidateTechniqueEvaluation` có `offlineOnly: true` chứa kết quả chạy thử; CLI này không gửi kết quả đến SQL/Mobile và không thay đổi registry.

5. Manifest dạng object đặt `evaluationMode: "OFFLINE_CANDIDATE"`, `clips: [...]`; `resultPath` trỏ đúng file candidate. Chạy evaluator trên manifest đó để đo ứng viên so với nhãn thật. Các khoảng rep được ghép một-một theo temporal IoU; từ chối trên dấu hiệu có thật vẫn tính bỏ sót. Thiếu nhãn thật trả `INSUFFICIENT_GROUND_TRUTH`.
6. Sau khi xem bất đồng và kết quả, Coach chuyên môn quyết định có phát hành hay không. Đề xuất không tự trở thành phê duyệt. Lưu phiên bản mới, lịch sử review và báo cáo; những kết quả đã lưu giữ nguyên snapshot/version cũ.

## Những dữ liệu runtime bắt buộc kiểm tra

Policy `APPROVED_AND_VALIDATED` phải có Coach/qualification/reviewRecordId, ngày duyệt, digest chính xác của nội dung và `validationReport` gồm đường dẫn, SHA-256, phiên bản, criterionId, scope, acceptanceCriteriaId. Scope chứa `exerciseVariant`, `cameraViews`, `modelVersion`, `ruleVersion`; đổi model/rule sẽ phải kiểm chứng phạm vi mới.

Báo cáo cần `releaseEvidence[criterionId]` có:

- `criterionId`, `standardVersion`, `reviewedStandardDigest`, `independentCoachReview: true`.
- `scope` trùng hoàn toàn metadata policy.
- `holdoutStartedAt`, `evaluatedAt` và `acceptanceCriteria.declaredAt` có múi giờ, theo thứ tự thời gian.
- `acceptanceCriteria`: `id`, `minimumPrecision`, `minimumRecall`, `maximumAbstentionRate`, `minimumPositiveLabels`, `minimumNegativeLabels`, `minimumVideos`. Đây là quyết định được Coach duyệt trước kiểm thử, không phải ngưỡng do phần mềm tự chọn.

Runtime xác minh hash báo cáo và manifest nguồn; tính lại confusion counts từ video/nhãn/inference được ràng buộc SHA-256; đối chiếu hash nhãn/inference, counts, precision/recall/abstention và số mẫu tối thiểu. Cờ `acceptanceMet: true` không đủ để vượt gate. Thiếu hoặc sai bất kỳ bằng chứng bắt buộc nào giữ tiêu chí ở phép đo thử nghiệm.

Các khai báo người đánh giá, nguồn video và tính độc lập vẫn phải được con người kiểm tra; JSON và hash không chứng minh chứng chỉ Coach. Không tạo dữ liệu phê duyệt thật từ fixture unit test.
