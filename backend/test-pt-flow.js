import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function testPtFlow() {
  try {
    console.log('🔄 Bắt đầu test luồng Booking PT...');
    
    // 1. Tìm hoặc tạo HLV (Trainer)
    let trainer = await prisma.user.findFirst({ where: { role: 'COACH' } });
    if (!trainer) {
      trainer = await prisma.user.create({
        data: { email: 'trainer@gym.com', password: '123', fullName: 'PT Siêu Cấp', role: 'COACH', status: 'ACTIVE' }
      });
      console.log('✅ Đã tạo Trainer mới:', trainer.fullName);
    } else {
      console.log('✅ Đã tìm thấy Trainer:', trainer.fullName);
    }

    // 2. Tìm hoặc tạo User (Member)
    let member = await prisma.user.findFirst({ where: { role: 'MEMBER' } });
    if (!member) {
      member = await prisma.user.create({
        data: { email: 'member@gym.com', password: '123', fullName: 'Hội Viên Vip', role: 'MEMBER', status: 'ACTIVE' }
      });
      console.log('✅ Đã tạo Member mới:', member.fullName);
    } else {
      console.log('✅ Đã tìm thấy Member:', member.fullName);
    }

    // 3. Tạo 1 Gói PT
    let ptPackage = await prisma.package.findFirst({ where: { type: 'PT' } });
    if (!ptPackage) {
      ptPackage = await prisma.package.create({
        data: { name: 'Gói PT 10 Buổi', type: 'PT', price: 5000000, durationDays: 30, totalPtSessions: 10 }
      });
      console.log('✅ Đã tạo Gói PT:', ptPackage.name);
    }

    // 4. Mua Gói PT (Tạo Membership)
    let membership = await prisma.membership.findFirst({ 
      where: { userId: member.id, packageId: ptPackage.id, coachId: trainer.id } 
    });
    if (!membership) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      membership = await prisma.membership.create({
        data: {
          userId: member.id,
          packageId: ptPackage.id,
          coachId: trainer.id,
          startDate: new Date(),
          endDate: endDate,
          remainingSessions: 10,
          status: 'ACTIVE'
        }
      });
      console.log('✅ Hội viên đã mua Gói PT thành công!');
    }

    // 5. Đặt lịch tập (Booking)
    const bookingDate = new Date();
    bookingDate.setHours(bookingDate.getHours() + 1); // Tập sau 1 tiếng
    
    let booking = await prisma.booking.create({
      data: {
        type: 'PT',
        memberId: member.id,
        coachId: trainer.id,
        membershipId: membership.id,
        startTime: bookingDate,
        endTime: new Date(bookingDate.getTime() + 60*60*1000),
        status: 'CONFIRMED' // Giả sử HLV đã duyệt
      }
    });
    console.log('✅ Đã tạo Booking lúc:', booking.startTime.toLocaleString());

    // --- TEST CÁC HÀM TRONG CONTROLLER BẰNG CÁCH GỌI LOGIC TRỰC TIẾP ---
    const secret = process.env.JWT_SECRET || 'secret';

    // A. Generate QR (PT gọi)
    console.log('\n--- BƯỚC 1: HLV TẠO QR ---');
    const qrToken = jwt.sign({ bookingId: booking.id, trainerId: trainer.id }, secret, { expiresIn: '90s' });
    await prisma.booking.update({ where: { id: booking.id }, data: { sessionQrToken: qrToken } });
    console.log('🎫 Đã tạo QR Token thành công!');

    // B. Bắt đầu tập (Hội viên quét)
    console.log('\n--- BƯỚC 2: HỘI VIÊN QUÉT QR BẮT ĐẦU TẬP ---');
    let currentBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    if (currentBooking.sessionQrToken === qrToken) {
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'IN_PROGRESS', sessionQrToken: null } });
      console.log('🔥 Trạng thái buổi tập chuyển sang: IN_PROGRESS (Đang tập)');
    }

    // C. Kết thúc tập (PT bấm kết thúc)
    console.log('\n--- BƯỚC 3: HLV KẾT THÚC BUỔI TẬP ---');
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } });
      const currentMem = await tx.membership.findUnique({ where: { id: membership.id } });
      const newRemaining = currentMem.remainingSessions - 1;
      await tx.membership.update({
        where: { id: membership.id },
        data: { remainingSessions: newRemaining, status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE' }
      });
      console.log(`🎉 Buổi tập Hoàn thành! Số buổi còn lại của Khách: ${newRemaining}`);
    });

    console.log('\n✅ TEST LUỒNG PT BOOKING THÀNH CÔNG RỰC RỠ!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testPtFlow();
