# Quản lý giáo án PT

Luồng: tạo mẫu → gán bản riêng cho học viên → chỉnh sửa → cập nhật mobile → xem/khôi phục phiên bản.

## Dữ liệu

- `WorkoutPlan`: mẫu tái sử dụng. Các dòng có `memberId` từ hệ thống cũ được giữ nguyên để đối chiếu.
- `StudentWorkoutPlan`: nội dung độc lập của một học viên, Coach và chương trình. `ACTIVE` là đang áp dụng; `ARCHIVED` là giáo án cũ.
- `WorkoutPlanRevision`: snapshot bất biến của từng phiên bản, người thay đổi, lý do và thời điểm. Phiên bản 1 được tạo ngay khi gán; khôi phục tạo phiên bản mới.

Mỗi `(memberId, coachId, programName)` có tối đa một bản `ACTIVE`. Backend chuẩn hóa tên chương trình, dùng transaction + SQL Server application lock; filtered unique index trong migration bảo vệ thêm ở database. Dùng **migrate deploy**, không dùng `db push` thay thế migration vì Prisma không mô tả filtered index này.

Gán mẫu tạo snapshot riêng. Gán bản mới cho cùng chương trình sẽ lưu trữ bản đang áp dụng. Chỉnh sửa/khôi phục yêu cầu `expectedVersion` và `changeReason`; phiên bản không khớp trả HTTP 409. Không có API sửa/xóa revision.

Coach chỉ gán cho học viên có Booking PT đã xác nhận/đang tập còn hiệu lực hoặc gói PT đang hoạt động còn buổi với mình. Coach sở hữu và Admin được sửa giáo án; hội viên chỉ đọc giáo án/lịch sử của mình. Giáo án cũ chỉ đọc.

Các thao tác giáo án không cập nhật Booking, Membership, thanh toán hay PT Credit. Thông báo được lưu cùng transaction với thay đổi giáo án, sau đó phát qua Socket.IO; mobile tải lại khi nhận thông báo, kết nối lại hoặc mở màn hình.

## API

| Phương thức | Đường dẫn dưới `/api` | Chức năng |
| --- | --- | --- |
| GET | `/pt/coach/plans` | Mẫu và giáo án đã gán của Coach |
| POST | `/pt/coach/plans` | Tạo mẫu; hỗ trợ `memberId` để tương thích client cũ |
| POST | `/pt/coach/plans/:id/assign` | Gán mẫu: `memberId`, `programName` (mặc định `PT`) |
| PUT | `/pt/coach/assigned-plans/:id` | Cập nhật snapshot: nội dung, `expectedVersion`, `changeReason` |
| GET | `/pt/coach/assigned-plans/:id/revisions` | Coach/Admin xem lịch sử |
| POST | `/pt/coach/assigned-plans/:id/restore` | `revisionId`, `expectedVersion`, `changeReason` |
| GET | `/workouts/student-plans/:id/revisions` | Hội viên/Coach/Admin được phép xem lịch sử |
| GET | `/workouts/progress/:memberId` | Trả `plans` gồm bản đang áp dụng và bản đã lưu trữ |

Danh sách Coach có `kind: TEMPLATE | ASSIGNED`. Hai loại dùng ID của hai bảng khác nhau; client cần ghép `kind` với `id` khi tạo khóa. Nội dung vẫn dùng `sessions` và `mealDays` như trước; dinh dưỡng không bắt buộc.

## Migration và kiểm thử

Trong thư mục `backend`:

```powershell
npm.cmd run db:migrate
npm.cmd run prisma:generate
```

Migration `20261024_student_workout_plans` sao chép toàn bộ giáo án đã gán cũ thành snapshot và revision 1; bản mới nhất theo Coach/học viên trở thành `ACTIVE`, còn lại `ARCHIVED`. Các dòng nguồn được giữ nguyên.

Đặt `PT_TEST_DATABASE_URL` tới một SQL Server database riêng đã migrate, tên có chữ `test`, khác `DATABASE_URL`, rồi chạy:

```powershell
node --import tsx --test tests/workoutPlans.integration.test.ts
```

Kiểm thử bao gồm snapshot độc lập, gán đồng thời, cập nhật đồng thời, kiểm tra quyền, khôi phục, thông báo, nội dung mobile và bảo toàn Booking/PT Credit. Không chạy bộ kiểm thử trên database ứng dụng.
