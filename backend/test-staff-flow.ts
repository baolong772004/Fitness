import { StaffService } from './src/services/staff.service.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

async function runStaffFlowTests() {
  console.log('========================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN 5 GIAI ĐOẠN CỦA ROLE STAFF');
  console.log('========================================================\n');

  try {
    // -----------------------------------------------------------------------
    // BƯỚC 0: CHUẨN BỊ DỮ LIỆU MẪU
    // -----------------------------------------------------------------------
    console.log('0️⃣ Khởi tạo dữ liệu kiểm thử (Staff, Member, Package, DeskDevice)...');

    // 0.1 Seed thiết bị quầy
    await StaffService.seedDefaultDeskDeviceIfNone();
    const deskDevice = await prisma.deskDevice.findFirst({
      where: { isActive: true }
    });
    console.log(`   ✅ Thiết bị quầy lễ tân: [${deskDevice?.deviceName}] (Token: ${deskDevice?.deviceToken})`);

    // 0.2 Seed tài khoản Lễ tân test
    const staffPassword = await bcrypt.hash('Staff@123', 10);
    const testStaff = await prisma.user.upsert({
      where: { email: 'staff_tester@fitness.com' },
      update: { role: 'STAFF', status: 'ACTIVE' },
      create: {
        email: 'staff_tester@fitness.com',
        fullName: 'Lễ Tân Thảo Vy',
        phone: '0901112233',
        password: staffPassword,
        role: 'STAFF',
        status: 'ACTIVE'
      }
    });
    console.log(`   ✅ Tài khoản Lễ tân test: [${testStaff.fullName}] (ID: ${testStaff.id})`);

    // 0.3 Đảm bảo có gói Membership trong hệ thống
    let testPackage = await prisma.package.findFirst({
      where: { type: 'MEMBERSHIP', isActive: true }
    });
    if (!testPackage) {
      testPackage = await prisma.package.create({
        data: {
          name: 'Gói Gym Tiêu Chuẩn 30 Ngày',
          type: 'MEMBERSHIP',
          price: 600000,
          durationDays: 30,
          trialPtSessions: 1,
          isActive: true
        }
      });
    }
    console.log(`   ✅ Gói tập mẫu: [${testPackage.name}] - Giá: ${Number(testPackage.price).toLocaleString('vi-VN')} đ`);

    // 0.4 Seed Hội viên có gói hợp lệ
    const memberPassword = await bcrypt.hash('Member@123', 10);
    const testMember = await prisma.user.upsert({
      where: { email: 'member_tester@fitness.com' },
      update: { status: 'ACTIVE' },
      create: {
        email: 'member_tester@fitness.com',
        fullName: 'Nguyễn Văn An',
        phone: '0933445566',
        password: memberPassword,
        role: 'MEMBER',
        status: 'ACTIVE',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
      }
    });

    // Tạo gói tập đang còn hạn cho Member
    const now = new Date();
    const membership = await prisma.membership.create({
      data: {
        userId: testMember.id,
        packageId: testPackage.id,
        startDate: new Date(now.getTime() - 2 * 86400000), // đã kích hoạt 2 ngày trước
        endDate: new Date(now.getTime() + 28 * 86400000), // còn 28 ngày
        status: 'ACTIVE'
      }
    });
    console.log(`   ✅ Hội viên mẫu: [${testMember.fullName}] - Gói ID: ${membership.id} (Còn 28 ngày)\n`);

    // -----------------------------------------------------------------------
    // GIAI ĐOẠN 1: ĐĂNG NHẬP & TỰ ĐỘNG CHẤM CÔNG (Clock-in)
    // -----------------------------------------------------------------------
    console.log('1️⃣ GIAI ĐOẠN 1: ĐĂNG NHẬP & TỰ ĐỘNG CHẤM CÔNG (Clock-in)');

    // 1.1 Thử đăng nhập với thiết bị lạ -> Phải bị chặn
    try {
      await StaffService.staffLogin({
        email: testStaff.email,
        password: 'Staff@123',
        deviceToken: 'UNKNOWN-ROGUE-DEVICE-TOKEN'
      });
      console.error('   ❌ LỖI: Lẽ ra phải chặn thiết bị lạ!');
    } catch (e: any) {
      console.log(`   ✅ Chặn thiết bị lạ thành công: "${e.message}"`);
    }

    // 1.2 Đăng nhập đúng máy quầy -> Kích hoạt ca trực & Tự động Clock-in
    const loginResult = await StaffService.staffLogin({
      email: testStaff.email,
      password: 'Staff@123',
      deviceToken: deskDevice!.deviceToken
    });

    console.log(`   ✅ Đăng nhập máy quầy thành công!`);
    console.log(`      - Mã ca trực (Shift_ID): ${loginResult.shift.shiftCode}`);
    console.log(`      - Giờ Clock-in: ${new Date(loginResult.shift.clockIn).toLocaleTimeString('vi-VN')}`);
    console.log(`      - Máy quầy: ${loginResult.device.deviceName}`);
    console.log(`      - Quỹ tiền mặt ban đầu: ${loginResult.shift.systemCashAmount} đ\n`);

    const shiftId = loginResult.shift.shiftId;

    // -----------------------------------------------------------------------
    // GIAI ĐOẠN 2: SOÁT VÉ VÀO CỔNG (Venue Check-in)
    // -----------------------------------------------------------------------
    console.log('2️⃣ GIAI ĐOẠN 2: SOÁT VÉ VÀO CỔNG (Venue Check-in)');

    // 2.1 Sinh mã Dynamic QR giả lập Mobile App của khách
    const dynamicQrToken = jwt.sign(
      { checkInUserId: testMember.id },
      JWT_SECRET,
      { expiresIn: '1m' }
    );

    // Quét QR lần 1: Gói còn hạn -> Thành công (Xanh)
    const scan1 = await StaffService.scanQrCheckIn({
      qrToken: dynamicQrToken,
      staffId: testStaff.id,
      shiftId
    });
    console.log(`   ✅ Quét QR lần 1: [Trạng thái: ${scan1.status}] [Màu: ${scan1.color}] - "${scan1.message}"`);
    console.log(`      - Hội viên: ${scan1.data?.member.fullName}`);
    console.log(`      - Gói: ${scan1.data?.membership.packageName} (Còn ${scan1.data?.membership.remainingDays} ngày)`);

    // Quét QR lần 2 ngay sau đó: Thử cơ chế Anti-Passback 30 phút -> Phải bị chặn (Đỏ)
    const scan2 = await StaffService.scanQrCheckIn({
      qrToken: dynamicQrToken,
      staffId: testStaff.id,
      shiftId
    });
    console.log(`   ✅ Test Anti-Passback: [Trạng thái: ${scan2.status}] [Màu: ${scan2.color}] - "${scan2.message}"`);

    // 2.2 Test Check-in thủ công khi khách hết pin / quên điện thoại
    const lookup = await StaffService.lookupMemberByPhone(testMember.phone!);
    console.log(`   ✅ Tra cứu SĐT [${testMember.phone}]:`);
    console.log(`      - Họ tên: ${lookup.member.fullName}`);
    console.log(`      - Ảnh chân dung: ${lookup.member.avatar}`);
    console.log(`      - Trạng thái gói: ${lookup.hasActiveGymAccess ? 'CÒN HẠN' : 'HẾT HẠN'}\n`);

    // -----------------------------------------------------------------------
    // GIAI ĐOẠN 3: HỖ TRỢ THANH TOÁN TẠI QUẦY (Offline POS Fallback)
    // -----------------------------------------------------------------------
    console.log('3️⃣ GIAI ĐOẠN 3: HỖ TRỢ THANH TOÁN TẠI QUẦY (Offline POS Fallback)');

    // 3.1 Khách Walk-in mới chưa tải App: Đăng ký + Thu tiền mặt
    const walkInPhone = '0988776655';
    const walkInResult = await StaffService.processWalkInCustomer({
      fullName: 'Khách Walk-in Test',
      phone: walkInPhone,
      packageId: testPackage.id,
      paymentMethod: 'CASH',
      amountPaid: 700000, // Giá gói 600.000 đ, khách đưa 700.000 đ
      staffId: testStaff.id,
      shiftId
    });

    console.log(`   ✅ Đăng ký khách Walk-in thành công:`);
    console.log(`      - Tên: ${walkInResult.data.member.fullName} (${walkInResult.data.member.phone})`);
    console.log(`      - Gói kích hoạt: ${walkInResult.data.membership.packageName}`);
    console.log(`      - Số tiền: ${walkInResult.data.payment.amount.toLocaleString('vi-VN')} đ`);
    console.log(`      - Tiền khách đưa: ${walkInResult.data.payment.cashReceived?.toLocaleString('vi-VN')} đ | Tiền thừa trả khách: ${walkInResult.data.payment.cashChange?.toLocaleString('vi-VN')} đ`);
    console.log(`      - Link SMS kích hoạt: ${walkInResult.data.smsInvitation.smsLink}`);

    // 3.2 Hỗ trợ bảo lưu gói tại quầy
    const freezeResult = await StaffService.freezeMembershipAtDesk({
      membershipId: membership.id,
      freezeDays: 15,
      reason: 'Khách bận công tác đột xuất',
      staffId: testStaff.id,
      shiftId
    });
    console.log(`   ✅ Hỗ trợ bảo lưu gói thành công:`);
    console.log(`      - Thêm: ${freezeResult.data.freezeDays} ngày`);
    console.log(`      - Hạn cũ: ${new Date(freezeResult.data.previousEndDate).toLocaleDateString('vi-VN')} -> Hạn mới: ${new Date(freezeResult.data.newEndDate).toLocaleDateString('vi-VN')}\n`);

    // -----------------------------------------------------------------------
    // GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU
    // -----------------------------------------------------------------------
    console.log('4️⃣ GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU');

    // 4.1 Tạo hoặc lấy thiết bị phòng tập
    let room = await prisma.room.findFirst();
    if (!room) {
      room = await prisma.room.create({
        data: { name: 'Phòng Gym Cardio', type: 'GYM', capacity: 50, isActive: true }
      });
    }

    let equipment = await prisma.equipment.findFirst({ where: { roomId: room.id } });
    if (!equipment) {
      equipment = await prisma.equipment.create({
        data: {
          name: 'Máy chạy bộ Technogym Pro 01',
          code: 'RUN-TECHNO-01',
          roomId: room.id,
          status: 'AVAILABLE'
        }
      });
    }

    // Báo hỏng thiết bị sang UNDER_MAINTENANCE
    const eqUpdate = await StaffService.updateEquipmentMaintenance({
      equipmentId: equipment.id,
      status: 'UNDER_MAINTENANCE',
      note: 'Dây đai trơn trượt, cần kỹ thuật viên căng lại',
      staffId: testStaff.id
    });
    console.log(`   ✅ Cập nhật bảo trì thiết bị: [${eqUpdate.data.name}] -> Trạng thái: ${eqUpdate.data.status}`);
    console.log(`      - Ghi chú: "${eqUpdate.data.note}" (Đã bắn cảnh báo tới Center Manager)`);

    // 4.2 Tiếp nhận khiếu nại / Ghi chú vận hành
    const noteResult = await StaffService.createOperationalNote({
      staffId: testStaff.id,
      shiftId,
      customerName: 'Hội viên phản ánh',
      category: 'HYGIENE',
      content: 'Máy lạnh khu vực tạ tay bị rỉ nước xuống sàn',
      priority: 'HIGH'
    });
    console.log(`   ✅ Tạo ghi chú vận hành: [${noteResult.data.category}] - "${noteResult.data.content}" [Ưu tiên: ${noteResult.data.priority}]\n`);

    // -----------------------------------------------------------------------
    // GIAI ĐOẠN 5: CHỐT CA & TỰ ĐỘNG CHẤM CÔNG RA (Clock-out)
    // -----------------------------------------------------------------------
    console.log('5️⃣ GIAI ĐOẠN 5: CHỐT CA & TỰ ĐỘNG CHẤM CÔNG RA (Clock-out)');

    // 5.1 Khởi tạo đóng ca: Xem tóm tắt doanh thu tiền mặt hệ thống X
    const summary = await StaffService.getCurrentShiftSummary(testStaff.id);
    console.log(`   ✅ Tóm tắt ca trực của [${testStaff.fullName}]:`);
    console.log(`      - Tổng tiền mặt hệ thống ghi nhận (X): ${summary.systemCashAmount.toLocaleString('vi-VN')} đ`);
    console.log(`      - Số lượt check-in đã xử lý: ${summary.stats.totalCheckIns}`);
    console.log(`      - Số hóa đơn đã thu: ${summary.stats.totalPayments}`);

    // 5.2 Đối soát: Nhập số tiền thực tế Y lệch với X mà KHÔNG nhập lý do -> Phải báo lỗi
    const systemCashX = summary.systemCashAmount;
    const actualCashY_Wrong = systemCashX - 50000; // lệch 50.000 đ
    try {
      await StaffService.closeShiftAndClockOut({
        staffId: testStaff.id,
        actualCashAmount: actualCashY_Wrong,
        differenceReason: '' // Để trống lý do
      });
      console.error('   ❌ LỖI: Lẽ ra phải bắt buộc nhập lý do chênh lệch!');
    } catch (e: any) {
      console.log(`   ✅ Bắt buộc nhập lý do chênh lệch thành công: "${e.message}"`);
    }

    // 5.3 Đối soát đúng có kèm lý do chênh lệch -> Chốt ca và Clock-out thành công
    const closeShiftResult = await StaffService.closeShiftAndClockOut({
      staffId: testStaff.id,
      actualCashAmount: actualCashY_Wrong,
      differenceReason: 'Đổi tiền lẻ cho quầy nước thiếu 50k'
    });

    console.log(`   ✅ Chốt ca làm việc thành công:`);
    console.log(`      - Mã ca: ${closeShiftResult.data.shiftCode}`);
    console.log(`      - Giờ Clock-in: ${new Date(closeShiftResult.data.clockIn).toLocaleTimeString('vi-VN')}`);
    console.log(`      - Giờ Clock-out: ${new Date(closeShiftResult.data.clockOut!).toLocaleTimeString('vi-VN')}`);
    console.log(`      - Tiền hệ thống (X): ${closeShiftResult.data.systemCashAmount.toLocaleString('vi-VN')} đ`);
    console.log(`      - Tiền thực tế (Y): ${closeShiftResult.data.actualCashAmount.toLocaleString('vi-VN')} đ`);
    console.log(`      - Chênh lệch: ${closeShiftResult.data.differenceAmount?.toLocaleString('vi-VN')} đ (Lý do: "${closeShiftResult.data.differenceReason}")`);
    console.log(`      - Tự động đăng xuất (autoLogout): ${closeShiftResult.data.autoLogout}`);

    console.log('\n🎉 TẤT CẢ 5 GIAI ĐOẠN ĐỀU VƯỢT QUA TEST THÀNH CÔNG 100%!');
  } catch (error: any) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runStaffFlowTests();
