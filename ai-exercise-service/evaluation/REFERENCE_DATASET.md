# Bộ video tham chiếu Bodyweight Squat

AI tự đo và so sánh từng rep. Coach chỉ gắn nhãn để xây dựng và kiểm chứng bộ tham chiếu, không cần xem mọi lượt tập của Member.

## Tình trạng kiểm tra ngày 2026-11-01

- Có 9 tệp Bodyweight Squat thực, hash khớp. Catalog ghi 3 SIDE, 3 FRONT, 3 OBLIQUE; đây là góc khai báo, phải xác nhận lại bằng inference và xem video. Tất cả nằm trong Development.
- Chưa có nhãn Coach `MEETS`/`IMPROVE` theo từng rep, từng tiêu chí; chưa có Holdout độc lập.
- `SQUAT-02` (độ sâu) và `SQUAT-04` (thân trên khi đứng lên) cần SIDE. `SQUAT-03` (đầu gối đi vào trong) cần FRONT. OBLIQUE chưa được dùng để kết luận ba tiêu chí này.
- Bộ so sánh hiện có **0 ví dụ đã xác nhận**. Không được suy ra rằng các video Development là động tác đúng chỉ vì có video.

| Ưu tiên | Tiêu chí | Video Development đã có để Coach rà soát |
| --- | --- | --- |
| 1 | SQUAT-03 · FRONT | `front-facing-squat-pexels-5034577.mp4` (cùng hash với #18), `squat_first_view-220k.mp4`, `pexels-squat-6525519.mp4` |
| 2 | SQUAT-02 và SQUAT-04 · SIDE | `github-side-squat.mp4`, `pexels-squat-7117541.mp4`, `pexels-squat-8402111.mp4` |

Mỗi lớp đúng/chưa đạt vẫn cần ví dụ từ ít nhất 2 người. Nếu các tệp trên không chứa đủ hai lớp, phải quay thêm video có lỗi thật do Coach xác nhận. Cần thêm người/buổi quay riêng cho Holdout.

Lưu ý: inference cũ của `pexels-squat-6525519.mp4` nhận là SIDE dù catalog khai báo FRONT. Cần xem lại góc và chạy model hiện hành trước khi tính video này cho SQUAT-03.

## Thu thập mẫu

1. Coach mở Web Coach → **AI Form Check được học viên chia sẻ** → chọn video đã cấp quyền xem → chọn rep, tiêu chí, `MEETS`, `IMPROVE` hoặc `UNASSESSABLE`. Ghi thời điểm và lý do quan sát, rồi lưu. Nhãn được lưu trong bảng `ExerciseTechniqueCoachLabel`.
2. Dùng **Xuất gói Holdout JSON (evaluate_technique.py)** trên Web Coach để lấy video hash, nhãn từng rep và `inferenceResult` chứa các số đo. Tệp xuất luôn là bản nháp với `UNVERIFIED`, `UNASSIGNED`, `coachConfirmed:false`; đây là kiểm tra an toàn. Người phụ trách dữ liệu phải đối chiếu video gốc, người tập, buổi quay và quyết định split. Không tự đổi nhãn `UNASSESSABLE` hoặc nhãn cấp video thành nhãn cho từng tiêu chí.
3. Dành riêng video Development để chọn ví dụ và hiệu chỉnh; quay người/buổi tập **khác** cho Holdout. Không dùng lại #18 hoặc video Pexels cùng hash trong Holdout.
4. Với video Development đã được Coach xác nhận, lưu video, JSON nhãn và JSON inference trong `evaluation/private/`. Đưa đường dẫn tương đối, SHA-256, `subjectId`, `sessionId`, `sourceType:REAL`, `split:development`, `exercise:SQUAT`, `exerciseVariant:BODYWEIGHT` vào `reference-development-manifest.json`. JSON nhãn cần có `coachConfirmed:true`, `reviewer`, `reviewedAt`, `approvedConditions`, `videoSha256`, `rubricVersion`, camera view và từng nhãn rep có timestamp, note, reviewerId, standardVersion. Chỉ đặt `coachConfirmed:true` sau hành động xác nhận của Coach trên dữ liệu thật.
5. Chạy `python reference_dataset.py --audit-catalog` từ thư mục `ai-exercise-service`. Có thể thêm `--query <đường-dẫn-JSON-inference>` để biết từng rep thiếu số đo hay thiếu ví dụ có nhãn. Đầu ra ngân hàng tham chiếu ở `evaluation/private/reference-bank.json`.

`comparisonReady` chỉ có khi **mỗi lớp MEETS và IMPROVE có ít nhất 3 rep từ ít nhất 2 người khác nhau**, cùng tiêu chí, góc quay, `modelVersion` và `ruleVersion`. Đây là điều kiện tối thiểu để thử so sánh, **không phải** bằng chứng độ chính xác hay quyền phát hành. Kết quả so sánh chỉ đưa ra ví dụ gần nhất và `validatedForDecision:false`.

## Kiểm chứng trước khi Member nhận kết luận chính thức

- Dùng video Holdout độc lập có nhãn từng rep từ Coach. Chạy `evaluate_technique.py` để đo precision, recall, false positive, false negative và abstention; không dùng Development làm Holdout.
- Coach rà soát báo cáo, camera, model/rule version, điều kiện áp dụng và chữ ký duyệt từng tiêu chí trên Web Coach. Backend chỉ phát hành khi kiểm tra đủ nhãn SQL, báo cáo và scope.
- Chỉ sau khi `APPROVED_AND_VALIDATED` thật và chạy **lượt OFFICIAL mới**, Member mới có `MEETS_CRITERION` hoặc `NEEDS_IMPROVEMENT` chính thức. Các tiêu chí thiếu bằng chứng vẫn `UNABLE_TO_ASSESS`.

Nguồn bên ngoài đáng xem cho nghiên cứu: [REHAB26-ViewAngles](https://zenodo.org/records/23018128) có video, rep và mã lỗi do chuyên gia vật lý trị liệu gắn nhãn, trong đó có squat nông và gối đi vào trong. Bộ này chỉ cho nghiên cứu phi thương mại, tải video 8,4 GB; nhãn và chuẩn tập cần đối chiếu trước khi dùng. Không nhập trực tiếp vào bộ tham chiếu Member.
