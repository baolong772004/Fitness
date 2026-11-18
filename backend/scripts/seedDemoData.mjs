import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset');

// ============================================================================
// TIME HELPERS (Asia/Ho_Chi_Minh = UTC+07:00)
// ============================================================================
const VN_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

function vnTodayStr() {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Returns UTC Date corresponding to (today + dayOffset) at HH:mm Vietnam time */
function vnDate(dayOffset, hour = 0, minute = 0) {
  const baseStr = vnTodayStr();
  const baseMidnightUtc = Date.parse(`${baseStr}T00:00:00.000Z`) - VN_OFFSET_MS;
  return new Date(baseMidnightUtc + dayOffset * DAY_MS + hour * 3600 * 1000 + minute * 60 * 1000);
}

let orderSeq = Number(`${Date.now().toString().slice(-8)}00`);
function nextOrderCode() {
  orderSeq += 1;
  return BigInt(orderSeq);
}

// ============================================================================
// OPTIONAL CLEAN RESET (only when --reset is explicitly passed)
// ============================================================================
async function resetTransactionalData() {
  console.log('⚠️  --reset: Đang làm sạch dữ liệu cũ để nạp lại dữ liệu chuyên Gym...');
  await prisma.payment.updateMany({ where: { ptRenewalBatchId: { not: null } }, data: { ptRenewalBatchId: null } });
  const deleteOrder = [
    'ptChatMessage',
    'review',
    'sessionExercise',
    'sessionResult',
    'ptAttendanceReviewEvent',
    'ptAttendanceReview',
    'ptMakeUpEvent',
    'makeUpRequest',
    'ptBookingCreditAllocation',
    'ptCreditTransaction',
    'ptRenewalEvent',
    'ptCoachChangeRequest',
    'ptPurchaseItem',
    'ptCreditBatch',
    'ptWallet',
    'workoutPlanRevision',
    'studentWorkoutPlan',
    'workoutPlan',
    'ptTrainingAssessment',
    'progressLog',
    'groupClassBooking',
    'groupClassSchedule',
    'booking',
    'checkIn',
    'operationalNote',
    'payment',
    'staffShift',
    'membership',
    'notification',
    'supportRequest',
    'actionLog',
    'gymClosure',
    'coachScheduleChangeRequest',
    'coachDateAvailability',
    'coachSchedule',
    'coachPricing',
    'coachSpecialization',
    'ptRenewalOption',
    'equipment',
  ];
  for (const model of deleteOrder) {
    if (prisma[model]) {
      await prisma[model].deleteMany({});
    }
  }
  await prisma.groupClass.deleteMany({});
  await prisma.room.deleteMany({});

  if (process.env.MONGODB_URI) {
    try {
      const mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
      await mongo.connect();
      const db = mongo.db();
      await db.collection('pt_chat_messages').deleteMany({});
      await db.collection('counters').updateOne({ _id: 'pt-chat-message-id' }, { $set: { seq: 0 } }, { upsert: true });
      await mongo.close();
    } catch (err) {
      console.warn('Mongo reset skipped:', err.message);
    }
  }
}

// ============================================================================
// MAIN SEED (100% GYM SPECIALIZED — NO YOGA, PILATES, BOXING, ZUMBA)
// ============================================================================
async function main() {
  const todayStr = vnTodayStr();
  console.log(`🚀 Bắt đầu nạp dữ liệu thực tế chuyên Gym cho Aura Fitness (Ngày hệ thống VN: ${todayStr})`);

  if (RESET) {
    await resetTransactionalData();
  } else {
    const existingPayments = await prisma.payment.count();
    if (existingPayments > 0) {
      console.log(`ℹ️  CSDL đã có ${existingPayments} giao dịch. Dùng --reset nếu muốn nạp mới hoàn toàn.`);
      return;
    }
  }

  const hashAdmin = await bcrypt.hash('admin', 10);
  const hashDefault = await bcrypt.hash('123456', 10);
  const hashCoach = await bcrypt.hash('Coach@123456', 10);

  // --------------------------------------------------------------------------
  // 1. GYM CALENDAR CONFIG & CLOSURE
  // --------------------------------------------------------------------------
  await prisma.gymCalendarConfig.upsert({
    where: { id: 1 },
    update: { openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 },
    create: { id: 1, openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 },
  });

  await prisma.gymClosure.create({
    data: {
      startAt: vnDate(12, 12, 0),
      endAt: vnDate(12, 14, 0),
      kind: 'MAINTENANCE',
      reason: 'Bảo trì thiết bị tạ, hệ thống điện và vệ sinh tổng thể phòng gym định kỳ cuối tháng',
    },
  });

  // --------------------------------------------------------------------------
  // 2. USERS (ADMIN, STAFF, 5 GYM COACHES, 12 MEMBERS)
  // --------------------------------------------------------------------------
  async function upsertUser(data, preservePasswordIfExists = false) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      const updatePayload = {
        fullName: data.fullName,
        phone: data.phone,
        gender: data.gender ?? existing.gender,
        dateOfBirth: data.dateOfBirth ?? existing.dateOfBirth,
        height: data.height ?? existing.height,
        weight: data.weight ?? existing.weight,
        role: data.role,
        status: data.status ?? 'ACTIVE',
        emailVerified: true,
      };
      if (!preservePasswordIfExists) {
        updatePayload.password = data.password;
      }
      return prisma.user.update({ where: { id: existing.id }, data: updatePayload });
    }
    return prisma.user.create({ data: { ...data, emailVerified: true } });
  }

  // Admin
  const admin = await upsertUser({
    email: 'admin@gym.com',
    password: hashAdmin,
    fullName: 'Quản Trị Viên Aura',
    phone: '0909000001',
    gender: 'MALE',
    role: 'ADMIN',
    status: 'ACTIVE',
  });

  // Staff / Receptionists
  const staff1 = await upsertUser({
    email: 'staff1@aura.vn',
    password: hashDefault,
    fullName: 'Lê Thu Hà',
    phone: '0909000011',
    gender: 'FEMALE',
    dateOfBirth: new Date('1998-04-12'),
    role: 'STAFF',
    status: 'ACTIVE',
  });

  const staff2 = await upsertUser({
    email: 'staff2@aura.vn',
    password: hashDefault,
    fullName: 'Nguyễn Hoàng Nam',
    phone: '0909000012',
    gender: 'MALE',
    dateOfBirth: new Date('1997-09-20'),
    role: 'STAFF',
    status: 'ACTIVE',
  });

  // 5 Pure-Gym Coaches
  const coachConfigs = [
    {
      email: 'minh.pt@aura.local',
      fullName: 'Nguyễn Minh PT',
      phone: '0900000001',
      gender: 'MALE',
      dateOfBirth: new Date('1994-03-15'),
      height: 178,
      weight: 76,
      bio: 'Huấn luyện viên Gym chuyên giảm mỡ và xây dựng sức mạnh nền tảng, hơn 5 năm kinh nghiệm đồng hành cùng người mới làm quen phòng tạ.',
      specialization: 'Giảm mỡ, tăng sức mạnh, kỹ thuật gym cơ bản',
      experience: 5,
      certifications: 'ACE Certified Personal Trainer, CPR/AED',
      hourlyRate: 180000,
      rank: 'senior',
      commissionPercent: 45,
      levels: ['TRIAL', 'BEGINNER', 'INTERMEDIATE'],
      pricing: [
        { sessionCount: 12, price: 3000000 },
        { sessionCount: 24, price: 5400000 },
        { sessionCount: 36, price: 7560000 },
      ],
      shifts: [
        { startTime: '06:00', endTime: '12:00' },
        { startTime: '14:00', endTime: '21:00' },
      ],
    },
    {
      email: 'lan.pt@aura.local',
      fullName: 'Trần Lan PT',
      phone: '0900000002',
      gender: 'FEMALE',
      dateOfBirth: new Date('1993-07-22'),
      height: 166,
      weight: 56,
      bio: 'Chuyên gia chuẩn hóa kỹ thuật tập tạ (Squat, Deadlift, Bench Press), cải thiện tư thế và độ linh hoạt khớp cho hội viên gym trung cấp đến nâng cao.',
      specialization: 'Mobility, tư thế tập tạ, squat, deadlift, bench press',
      experience: 7,
      certifications: 'NASM CPT, NASM Corrective Exercise Specialist',
      hourlyRate: 220000,
      rank: 'master',
      commissionPercent: 50,
      levels: ['TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
      pricing: [
        { sessionCount: 12, price: 3600000 },
        { sessionCount: 24, price: 6600000 },
        { sessionCount: 36, price: 9360000 },
      ],
      shifts: [
        { startTime: '07:00', endTime: '12:00' },
        { startTime: '15:00', endTime: '22:00' },
      ],
    },
    {
      email: 'duc.pt@aura.local',
      fullName: 'Phạm Đức PT',
      phone: '0900000003',
      gender: 'MALE',
      dateOfBirth: new Date('1992-11-08'),
      height: 180,
      weight: 84,
      bio: 'Chuyên thiết kế giáo án tăng cơ (Hypertrophy), Powerbuilding và tối ưu dinh dưỡng tăng cơ giảm mỡ cho người tập gym lâu năm.',
      specialization: 'Tăng cơ, hypertrophy, powerbuilding, strength training',
      experience: 6,
      certifications: 'ISSA Certified Strength & Conditioning Coach',
      hourlyRate: 200000,
      rank: 'senior',
      commissionPercent: 45,
      levels: ['TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
      pricing: [
        { sessionCount: 12, price: 3600000 },
        { sessionCount: 24, price: 6800000 },
        { sessionCount: 36, price: 9600000 },
      ],
      shifts: [
        { startTime: '06:00', endTime: '11:00' },
        { startTime: '15:00', endTime: '22:00' },
      ],
    },
    {
      email: 'vy.coach@aura.vn',
      fullName: 'Đặng Thảo Vy',
      phone: '0900000004',
      gender: 'FEMALE',
      dateOfBirth: new Date('1995-02-19'),
      height: 164,
      weight: 53,
      bio: 'Huấn luyện viên Gym chuyên biệt cho nữ: phát triển vòng 3 (Glutes), săn chắc cơ lõi (Core), giảm mỡ toàn thân và làm chủ máy tập kháng lực.',
      specialization: 'Glutes & Core, giảm mỡ siết dáng, tập tạ kháng lực cho nữ',
      experience: 6,
      certifications: 'NASM CPT, Certified Glute & Body Recomposition Coach',
      hourlyRate: 200000,
      rank: 'senior',
      commissionPercent: 45,
      levels: ['TRIAL', 'BEGINNER', 'INTERMEDIATE'],
      pricing: [
        { sessionCount: 12, price: 3200000 },
        { sessionCount: 24, price: 5800000 },
      ],
      shifts: [
        { startTime: '06:00', endTime: '12:00' },
        { startTime: '16:00', endTime: '21:00' },
      ],
    },
    {
      email: 'khang.coach@aura.vn',
      fullName: 'Võ Gia Khang',
      phone: '0900000005',
      gender: 'MALE',
      dateOfBirth: new Date('1991-08-30'),
      height: 179,
      weight: 81,
      bio: 'Chuyên gia Powerlifting và Strength & Conditioning với 8 năm kinh nghiệm huấn luyện sức mạnh Big 3 (Squat, Bench, Deadlift) và HIIT Gym đốt mỡ.',
      specialization: 'Powerlifting, Strength & Conditioning, HIIT Gym, Functional',
      experience: 8,
      certifications: 'NSCA-CSCS, Certified Powerlifting & Strength Coach',
      hourlyRate: 240000,
      rank: 'master',
      commissionPercent: 50,
      levels: ['TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
      pricing: [
        { sessionCount: 12, price: 4000000 },
        { sessionCount: 24, price: 7200000 },
      ],
      shifts: [
        { startTime: '07:00', endTime: '12:00' },
        { startTime: '14:00', endTime: '21:00' },
      ],
    },
  ];

  const coaches = {};
  for (const cfg of coachConfigs) {
    const user = await upsertUser({
      email: cfg.email,
      password: hashCoach,
      fullName: cfg.fullName,
      phone: cfg.phone,
      gender: cfg.gender,
      dateOfBirth: cfg.dateOfBirth,
      height: cfg.height,
      weight: cfg.weight,
      role: 'COACH',
      status: 'ACTIVE',
    });
    const profile = await prisma.coachProfile.upsert({
      where: { userId: user.id },
      update: {
        bio: cfg.bio,
        specialization: cfg.specialization,
        experience: cfg.experience,
        certifications: cfg.certifications,
        hourlyRate: cfg.hourlyRate,
        rank: cfg.rank,
        commissionPercent: cfg.commissionPercent,
        status: 'ACTIVE',
      },
      create: {
        userId: user.id,
        bio: cfg.bio,
        specialization: cfg.specialization,
        experience: cfg.experience,
        certifications: cfg.certifications,
        rating: 4.9,
        hourlyRate: cfg.hourlyRate,
        rank: cfg.rank,
        commissionPercent: cfg.commissionPercent,
        status: 'ACTIVE',
      },
    });

    await prisma.coachSpecialization.deleteMany({ where: { coachProfileId: profile.id } });
    await prisma.coachSpecialization.createMany({
      data: cfg.levels.map((level) => ({ coachProfileId: profile.id, level })),
    });

    await prisma.coachPricing.deleteMany({ where: { coachProfileId: profile.id } });
    await prisma.coachPricing.createMany({
      data: cfg.pricing.map((p) => ({ coachProfileId: profile.id, sessionCount: p.sessionCount, price: p.price })),
    });

    await prisma.coachSchedule.deleteMany({ where: { coachProfileId: profile.id } });
    const schedRows = [];
    for (let dow = 1; dow <= 7; dow++) {
      for (const sh of cfg.shifts) {
        schedRows.push({
          coachProfileId: profile.id,
          dayOfWeek: dow,
          startTime: sh.startTime,
          endTime: sh.endTime,
          isAvailable: true,
        });
      }
    }
    await prisma.coachSchedule.createMany({ data: schedRows });

    coaches[cfg.email] = { user, profile };
  }

  const coachMinh = coaches['minh.pt@aura.local'];
  const coachLan = coaches['lan.pt@aura.local'];
  const coachDuc = coaches['duc.pt@aura.local'];
  const coachVy = coaches['vy.coach@aura.vn'];
  const coachKhang = coaches['khang.coach@aura.vn'];

  // 12 Members
  const memberConfigs = [
    { key: 'baolong', email: 'baolong@gmail.com', fullName: 'Bảo Long', phone: '0901234567', gender: 'MALE', dob: '2001-05-14', height: 175, weight: 71.5, preservePw: true },
    { key: 'an', email: 'an.nguyen@aura.vn', fullName: 'Nguyễn Minh An', phone: '0912345601', gender: 'MALE', dob: '1996-02-10', height: 174, weight: 73.0 },
    { key: 'linh', email: 'linh.tran@aura.vn', fullName: 'Trần Khánh Linh', phone: '0912345602', gender: 'FEMALE', dob: '1999-08-21', height: 163, weight: 53.5 },
    { key: 'huy', email: 'huy.le@aura.vn', fullName: 'Lê Quốc Huy', phone: '0912345603', gender: 'MALE', dob: '1995-11-03', height: 179, weight: 80.2 },
    { key: 'trang', email: 'trang.pham@aura.vn', fullName: 'Phạm Thu Trang', phone: '0912345604', gender: 'FEMALE', dob: '1997-06-18', height: 160, weight: 52.0 },
    { key: 'khoa', email: 'khoa.vo@aura.vn', fullName: 'Võ Đăng Khoa', phone: '0912345605', gender: 'MALE', dob: '2000-01-25', height: 172, weight: 69.5 },
    { key: 'mai', email: 'mai.hoang@aura.vn', fullName: 'Hoàng Ngọc Mai', phone: '0912345606', gender: 'FEMALE', dob: '1998-09-12', height: 165, weight: 55.0 },
    { key: 'tuan', email: 'tuan.do@aura.vn', fullName: 'Đỗ Anh Tuấn', phone: '0912345607', gender: 'MALE', dob: '1994-12-05', height: 181, weight: 82.0 },
    { key: 'nhi', email: 'nhi.bui@aura.vn', fullName: 'Bùi Yến Nhi', phone: '0912345608', gender: 'FEMALE', dob: '2001-03-29', height: 161, weight: 50.5 },
    { key: 'dat', email: 'dat.vu@aura.vn', fullName: 'Vũ Tiến Đạt', phone: '0912345609', gender: 'MALE', dob: '1993-07-07', height: 176, weight: 78.0 },
    { key: 'phuong', email: 'phuong.ngo@aura.vn', fullName: 'Ngô Lan Phương', phone: '0912345610', gender: 'FEMALE', dob: '1997-10-16', height: 164, weight: 54.0 },
    { key: 'kien', email: 'kien.dang@aura.vn', fullName: 'Đặng Trung Kiên', phone: '0912345611', gender: 'MALE', dob: '2002-04-02', height: 173, weight: 67.0 },
  ];

  const members = {};
  for (const m of memberConfigs) {
    members[m.key] = await upsertUser({
      email: m.email,
      password: hashDefault,
      fullName: m.fullName,
      phone: m.phone,
      gender: m.gender,
      dateOfBirth: new Date(m.dob),
      height: m.height,
      weight: m.weight,
      role: 'MEMBER',
      status: 'ACTIVE',
    }, Boolean(m.preservePw));
  }

  console.log(`✅ Đã đồng bộ ${1 + 2 + coachConfigs.length + memberConfigs.length} tài khoản (1 Admin, 2 Staff, 5 Coach Gym, 12 Member).`);

  // --------------------------------------------------------------------------
  // 3. PACKAGES, PT PRODUCTS, SINGLE OFFERS, RENEWAL OPTIONS
  // --------------------------------------------------------------------------
  async function upsertPackage(data) {
    const existing = await prisma.package.findFirst({ where: { name: data.name } });
    if (existing) return prisma.package.update({ where: { id: existing.id }, data: { ...data, isActive: true } });
    return prisma.package.create({ data: { ...data, isActive: true } });
  }

  const pkg1M = await upsertPackage({
    name: 'Gói 1 tháng',
    description: 'Sử dụng toàn bộ khu tập tạ, khu Cardio, máy tập kháng lực, phòng thay đồ và lớp tập nhóm Gym trong 30 ngày.',
    type: 'MEMBERSHIP',
    price: 500000,
    durationDays: 30,
    trialPtSessions: 0,
  });
  const pkg3M = await upsertPackage({
    name: 'Gói 3 tháng',
    description: 'Lựa chọn tối ưu xây dựng thói quen tập gym 90 ngày, tặng kèm 1 buổi PT Trial đo InBody và chỉnh kỹ thuật tập tạ.',
    type: 'MEMBERSHIP',
    price: 1200000,
    durationDays: 90,
    trialPtSessions: 1,
  });
  const pkg6M = await upsertPackage({
    name: 'Gói 6 tháng',
    description: 'Gói hội viên tiêu chuẩn 180 ngày, không giới hạn lớp tập nhóm Gym (BodyPump, HIIT, Glutes, Core) và tặng 2 buổi PT Trial.',
    type: 'MEMBERSHIP',
    price: 2100000,
    durationDays: 180,
    trialPtSessions: 2,
  });
  const pkg12M = await upsertPackage({
    name: 'Gói 12 tháng',
    description: 'Gói hội viên VIP cả năm 365 ngày với chi phí tiết kiệm nhất, miễn phí đo InBody định kỳ và tặng kèm 3 buổi PT Trial 1:1.',
    type: 'MEMBERSHIP',
    price: 3600000,
    durationDays: 365,
    trialPtSessions: 3,
  });

  async function upsertPtProduct(data) {
    const existing = await prisma.ptProduct.findFirst({ where: { name: data.name } });
    if (existing) return prisma.ptProduct.update({ where: { id: existing.id }, data: { ...data, isActive: true } });
    return prisma.ptProduct.create({ data: { ...data, isActive: true } });
  }

  const ptBeg12 = await upsertPtProduct({
    name: 'PT Beginner 12 buổi',
    level: 'BEGINNER',
    sessionCount: 12,
    durationDays: 60,
    price: 3000000,
    singleSessionPrice: 280000,
    benefits: '12 buổi tập Gym 1:1, đánh giá thể trạng InBody, hướng dẫn kỹ thuật tạ chuẩn & giáo án nền tảng.',
  });
  const ptBeg24 = await upsertPtProduct({
    name: 'PT Beginner 24 buổi',
    level: 'BEGINNER',
    sessionCount: 24,
    durationDays: 90,
    price: 5400000,
    singleSessionPrice: 280000,
    benefits: '24 buổi tập Gym 1:1, giáo án cá nhân hóa, thực đơn tăng cơ giảm mỡ & theo dõi tiến độ định kỳ.',
  });
  const ptInt12 = await upsertPtProduct({
    name: 'PT Intermediate 12 buổi',
    level: 'INTERMEDIATE',
    sessionCount: 12,
    durationDays: 60,
    price: 3600000,
    singleSessionPrice: 320000,
    benefits: '12 buổi nâng cao kỹ thuật compound (Squat, Bench, Deadlift), tối ưu sức mạnh và chỉnh tư thế tập tạ.',
  });
  const ptInt24 = await upsertPtProduct({
    name: 'PT Intermediate 24 buổi',
    level: 'INTERMEDIATE',
    sessionCount: 24,
    durationDays: 90,
    price: 6600000,
    singleSessionPrice: 320000,
    benefits: '24 buổi phát triển cơ bắp & sức mạnh, phân tích video kỹ thuật định kỳ cùng HLV.',
  });
  const ptAdv12 = await upsertPtProduct({
    name: 'PT Advanced 12 buổi',
    level: 'ADVANCED',
    sessionCount: 12,
    durationDays: 60,
    price: 4200000,
    singleSessionPrice: 380000,
    benefits: '12 buổi chuyên sâu phân kỳ tải (periodization), hypertrophy & tối ưu mức tạ tối đa.',
  });
  const ptAdv24 = await upsertPtProduct({
    name: 'PT Advanced 24 buổi',
    level: 'ADVANCED',
    sessionCount: 24,
    durationDays: 90,
    price: 7200000,
    singleSessionPrice: 380000,
    benefits: '24 buổi cá nhân hóa toàn diện, tăng sức mạnh Powerlifting / Hypertrophy và theo sát dinh dưỡng từng giai đoạn.',
  });

  const singleOffers = [
    { level: 'BEGINNER', price: 280000, durationDays: 30, maxQuantity: 20, benefits: 'Buổi PT Gym lẻ 1:1 cho người mới, linh hoạt đặt lịch trong 30 ngày.' },
    { level: 'INTERMEDIATE', price: 320000, durationDays: 30, maxQuantity: 20, benefits: 'Buổi PT Gym lẻ 1:1 trung cấp, tối ưu kỹ thuật tạ và cường độ tập.' },
    { level: 'ADVANCED', price: 380000, durationDays: 30, maxQuantity: 20, benefits: 'Buổi PT Gym lẻ 1:1 chuyên sâu cùng HLV Master.' },
  ];
  for (const offer of singleOffers) {
    await prisma.ptSingleOffer.upsert({
      where: { level: offer.level },
      update: { ...offer, isActive: true },
      create: { ...offer, isActive: true },
    });
  }

  const renewalOptionConfigs = [
    { name: 'Gia hạn PT Beginner +15 ngày', level: 'BEGINNER', durationDays: 15, price: 350000, purchaseMode: 'PACKAGE', ptProductId: null },
    { name: 'Gia hạn PT Beginner +30 ngày', level: 'BEGINNER', durationDays: 30, price: 600000, purchaseMode: 'PACKAGE', ptProductId: null },
    { name: 'Gia hạn PT Lẻ Beginner +15 ngày', level: 'BEGINNER', durationDays: 15, price: 250000, purchaseMode: 'SINGLE', ptProductId: null },
    { name: 'Gia hạn PT Intermediate +15 ngày', level: 'INTERMEDIATE', durationDays: 15, price: 450000, purchaseMode: 'PACKAGE', ptProductId: null },
    { name: 'Gia hạn PT Intermediate +30 ngày', level: 'INTERMEDIATE', durationDays: 30, price: 750000, purchaseMode: 'PACKAGE', ptProductId: null },
    { name: 'Gia hạn PT Advanced +30 ngày', level: 'ADVANCED', durationDays: 30, price: 950000, purchaseMode: 'PACKAGE', ptProductId: null },
  ];
  const renewalOptions = [];
  for (const opt of renewalOptionConfigs) {
    const existing = await prisma.ptRenewalOption.findFirst({ where: { name: opt.name } });
    renewalOptions.push(
      existing
        ? await prisma.ptRenewalOption.update({ where: { id: existing.id }, data: { ...opt, isActive: true } })
        : await prisma.ptRenewalOption.create({ data: { ...opt, isActive: true } })
    );
  }
  console.log('✅ Đã nạp 4 gói Membership, 6 gói PT, 3 PT lẻ, 6 gói gia hạn PT.');

  // --------------------------------------------------------------------------
  // 4. FACILITY: 5 GYM ZONES & 18 PURE-GYM EQUIPMENTS
  // --------------------------------------------------------------------------
  const roomMain = await prisma.room.create({ data: { name: 'Khu Tạ Tự Do & Máy Tập Chính (Main Gym Floor)', type: 'GYM', capacity: 60, isActive: true } });
  const roomPt = await prisma.room.create({ data: { name: 'Khu Tập PT 1:1 (Private PT Zone)', type: 'PT_ZONE', capacity: 12, isActive: true } });
  const roomCardio = await prisma.room.create({ data: { name: 'Khu Cardio & Đốt Mỡ (Cardio Zone)', type: 'CARDIO', capacity: 25, isActive: true } });
  const roomGroupStrength = await prisma.room.create({ data: { name: 'Phòng Tập Nhóm Gym & Thể Lực (Group Strength Studio)', type: 'STUDIO', capacity: 25, isActive: true } });
  const roomFunctional = await prisma.room.create({ data: { name: 'Khu Sức Mạnh & Functional (Strength & HIIT Zone)', type: 'FUNCTIONAL', capacity: 20, isActive: true } });

  const equipmentData = [
    { name: 'Máy chạy bộ Technogym Excite Run 1000 #1', code: 'TM-001', roomId: roomCardio.id, status: 'AVAILABLE', note: 'Hoạt động ổn định, bảo dưỡng gần nhất 01/11/2026' },
    { name: 'Máy chạy bộ Technogym Excite Run 1000 #2', code: 'TM-002', roomId: roomCardio.id, status: 'AVAILABLE', note: 'Hoạt động ổn định' },
    { name: 'Máy chạy bộ Technogym Excite Run 1000 #3', code: 'TM-003', roomId: roomCardio.id, status: 'MAINTENANCE', note: 'Đang thay dây băng tải và tra dầu định kỳ' },
    { name: 'Máy leo cầu thang StairMaster 8Gx', code: 'ST-001', roomId: roomCardio.id, status: 'AVAILABLE', note: 'Bậc thang hoạt động mượt, cảm biến nhịp tim chuẩn' },
    { name: 'Máy trượt tuyết Elliptical Life Fitness', code: 'EL-001', roomId: roomCardio.id, status: 'BROKEN', note: 'Hỏng cảm biến kháng lực điện từ, chờ linh kiện thay thế' },
    { name: 'Khung gánh tạ Rogue Power Rack #1', code: 'PR-001', roomId: roomMain.id, status: 'AVAILABLE', note: 'Trang bị đầy đủ thanh đòn Olympic 20kg và bánh tạ bumper' },
    { name: 'Khung gánh tạ Rogue Power Rack #2', code: 'PR-002', roomId: roomMain.id, status: 'AVAILABLE', note: 'Hoạt động tốt' },
    { name: 'Máy đẩy tạ Smith Machine Life Fitness', code: 'SM-001', roomId: roomMain.id, status: 'AVAILABLE', note: 'Thanh trượt mượt, khóa an toàn chuẩn' },
    { name: 'Giàn kéo cáp đa năng Cable Crossover', code: 'CC-001', roomId: roomMain.id, status: 'AVAILABLE', note: 'Đã kiểm tra cáp và puly tuần trước' },
    { name: 'Máy đạp đùi 45 độ Leg Press Hammer Strength', code: 'LP-001', roomId: roomMain.id, status: 'AVAILABLE', note: 'Hoạt động tốt' },
    { name: 'Máy kéo xô & chèo lưng Lat Pulldown / Low Row', code: 'LAT-001', roomId: roomMain.id, status: 'AVAILABLE', note: 'Đầy đủ thanh kéo rộng, hẹp và tay cầm chữ V' },
    { name: 'Máy đá đùi & móc đùi Leg Extension / Curl', code: 'LE-001', roomId: roomMain.id, status: 'MAINTENANCE', note: 'Đang căn chỉnh lại dây cáp tải trọng' },
    { name: 'Giàn tạ đơn Dumbbell 2kg - 50kg', code: 'DB-001', roomId: roomMain.id, status: 'AVAILABLE', note: 'Đủ cặp tạ theo chuẩn bọc cao su' },
    { name: 'Khung tập đa năng PT Functional Trainer', code: 'PT-FT-01', roomId: roomPt.id, status: 'AVAILABLE', note: 'Dành riêng cho buổi tập PT 1:1' },
    { name: 'Máy phân tích chỉ số cơ thể InBody 570', code: 'IB-570', roomId: roomPt.id, status: 'AVAILABLE', note: 'Hiệu chuẩn chính xác 10/11/2026' },
    { name: 'Máy chèo thuyền Concept2 RowErg', code: 'RW-001', roomId: roomFunctional.id, status: 'AVAILABLE', note: 'Màn hình PM5 hoạt động tốt' },
    { name: 'Xe đẩy tạ Prowler Sled & Thảm kéo lực', code: 'SL-001', roomId: roomFunctional.id, status: 'AVAILABLE', note: 'Kèm bánh tạ chuyên dụng tập sức mạnh thân dưới' },
    { name: 'Bộ tạ ấm Kettlebell Competition 8kg - 32kg', code: 'KB-001', roomId: roomGroupStrength.id, status: 'AVAILABLE', note: 'Phục vụ các lớp tập nhóm Gym & HIIT' },
  ];
  await prisma.equipment.createMany({ data: equipmentData });
  console.log(`✅ Đã nạp 5 khu vực phòng Gym và ${equipmentData.length} thiết bị tập Gym.`);

  // --------------------------------------------------------------------------
  // 5. DESK DEVICES & STAFF SHIFTS
  // --------------------------------------------------------------------------
  const desk1 = await prisma.deskDevice.upsert({
    where: { deviceToken: 'DESK-POS-DEFAULT-001' },
    update: { deviceName: 'Quầy Lễ Tân Số 1 (Front Desk 01)', location: 'Tầng 1 - Cổng chính', isActive: true },
    create: { deviceToken: 'DESK-POS-DEFAULT-001', deviceName: 'Quầy Lễ Tân Số 1 (Front Desk 01)', location: 'Tầng 1 - Cổng chính', isActive: true },
  });
  await prisma.deskDevice.upsert({
    where: { deviceToken: 'DESK-POS-VIP-002' },
    update: { deviceName: 'Quầy Tư Vấn PT & VIP (Desk 02)', location: 'Tầng 2 - Khu PT', isActive: true },
    create: { deviceToken: 'DESK-POS-VIP-002', deviceName: 'Quầy Tư Vấn PT & VIP (Desk 02)', location: 'Tầng 2 - Khu PT', isActive: true },
  });

  const shiftDayMinus3 = await prisma.staffShift.create({
    data: {
      shiftCode: `SHIFT-${todayStr.replace(/-/g, '')}-D3`,
      staffId: staff1.id,
      deskDeviceId: desk1.id,
      deviceToken: desk1.deviceToken,
      clockIn: vnDate(-3, 6, 0),
      clockOut: vnDate(-3, 14, 0),
      systemCashAmount: 1700000,
      actualCashAmount: 1700000,
      differenceAmount: 0,
      status: 'CLOSED',
      notes: 'Ca sáng ổn định, bàn giao đầy đủ tiền mặt và thẻ tủ đồ.',
      createdAt: vnDate(-3, 6, 0),
    },
  });
  const shiftDayMinus2 = await prisma.staffShift.create({
    data: {
      shiftCode: `SHIFT-${todayStr.replace(/-/g, '')}-D2`,
      staffId: staff2.id,
      deskDeviceId: desk1.id,
      deviceToken: desk1.deviceToken,
      clockIn: vnDate(-2, 14, 0),
      clockOut: vnDate(-2, 22, 0),
      systemCashAmount: 2100000,
      actualCashAmount: 2100000,
      differenceAmount: 0,
      status: 'CLOSED',
      notes: 'Ca chiều tối đông hội viên check-in khung giờ cao điểm 18h-20h.',
      createdAt: vnDate(-2, 14, 0),
    },
  });
  const shiftDayMinus1 = await prisma.staffShift.create({
    data: {
      shiftCode: `SHIFT-${todayStr.replace(/-/g, '')}-D1`,
      staffId: staff1.id,
      deskDeviceId: desk1.id,
      deviceToken: desk1.deviceToken,
      clockIn: vnDate(-1, 6, 0),
      clockOut: vnDate(-1, 14, 0),
      systemCashAmount: 1200000,
      actualCashAmount: 1200000,
      differenceAmount: 0,
      status: 'CLOSED',
      notes: 'Đã bàn giao ca chiều đầy đủ.',
      createdAt: vnDate(-1, 6, 0),
    },
  });
  const shiftToday = await prisma.staffShift.create({
    data: {
      shiftCode: `SHIFT-${todayStr.replace(/-/g, '')}-OPEN`,
      staffId: staff1.id,
      deskDeviceId: desk1.id,
      deviceToken: desk1.deviceToken,
      clockIn: vnDate(0, 6, 0),
      systemCashAmount: 500000,
      status: 'OPEN',
      notes: 'Ca trực sáng hôm nay tại quầy lễ tân chính.',
      createdAt: vnDate(0, 6, 0),
    },
  });

  // --------------------------------------------------------------------------
  // 6. MEMBERSHIPS + VERIFIED PAYMENTS + HISTORICAL REVENUE
  // --------------------------------------------------------------------------
  async function createGymMembershipWithPayment({
    member, pkg, startOffset, status = 'ACTIVE', activationOrder = 1,
    method = 'PAYOS', paidOffset = startOffset, staff = null, shift = null, note = null,
  }) {
    const startDate = vnDate(startOffset, 8, 0);
    const endDate = new Date(startDate.getTime() + pkg.durationDays * DAY_MS);
    const paidAt = vnDate(paidOffset, 9, 15);

    const membership = await prisma.membership.create({
      data: {
        userId: member.id,
        packageId: pkg.id,
        startDate,
        endDate,
        isGymMembership: true,
        activationOrder,
        activatedAt: status === 'ACTIVE' || status === 'EXPIRED' || status === 'FROZEN' ? startDate : null,
        status,
        createdAt: paidAt,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        userId: member.id,
        membershipId: membership.id,
        amount: pkg.price,
        method,
        status: 'PAID',
        orderCode: nextOrderCode(),
        transactionNo: `TXN-GYM-${member.id}-${membership.id}-${Date.now().toString().slice(-4)}`,
        staffId: staff?.id ?? null,
        consultantId: staff?.id ?? null,
        shiftId: shift?.id ?? null,
        cashReceived: method === 'CASH' ? pkg.price : null,
        cashChange: method === 'CASH' ? 0 : null,
        note: note ?? `Thanh toán ${pkg.name}`,
        createdAt: paidAt,
        paidAt,
      },
    });

    let trialBatch = null;
    if (pkg.trialPtSessions > 0 && ['ACTIVE', 'PENDING_ACTIVATION'].includes(status)) {
      const wallet = await prisma.ptWallet.upsert({
        where: { memberId: member.id },
        create: { memberId: member.id },
        update: {},
      });
      trialBatch = await prisma.ptCreditBatch.create({
        data: {
          walletId: wallet.id,
          level: 'TRIAL',
          source: 'MEMBERSHIP_GIFT',
          initialCount: pkg.trialPtSessions,
          usedCount: 0,
          heldCount: 0,
          membershipId: membership.id,
          benefitsSnapshot: `Tặng ${pkg.trialPtSessions} buổi PT trải nghiệm kèm ${pkg.name}`,
          grantedAt: paidAt,
          startAt: startDate,
          endAt: endDate,
          activatedAt: status === 'ACTIVE' ? startDate : null,
        },
      });
      await prisma.ptCreditTransaction.create({
        data: {
          batchId: trialBatch.id,
          kind: 'GRANT',
          quantity: pkg.trialPtSessions,
          note: `Tặng kèm ${pkg.name}`,
          createdAt: paidAt,
        },
      });
    }

    return { membership, payment, trialBatch };
  }

  const blGym = await createGymMembershipWithPayment({
    member: members.baolong, pkg: pkg12M, startOffset: -40, status: 'ACTIVE', activationOrder: 1, method: 'PAYOS', paidOffset: -40,
  });
  await createGymMembershipWithPayment({
    member: members.baolong, pkg: pkg3M, startOffset: 325, status: 'PENDING_ACTIVATION', activationOrder: 2, method: 'PAYOS', paidOffset: -3, note: 'Gia hạn sớm gói 3 tháng nối tiếp',
  });

  await createGymMembershipWithPayment({ member: members.an, pkg: pkg3M, startOffset: -260, status: 'EXPIRED', activationOrder: 1, method: 'PAYOS', paidOffset: -260 });
  const anGym = await createGymMembershipWithPayment({ member: members.an, pkg: pkg6M, startOffset: -25, status: 'ACTIVE', activationOrder: 2, method: 'PAYOS', paidOffset: -25 });

  await createGymMembershipWithPayment({ member: members.linh, pkg: pkg3M, startOffset: -190, status: 'EXPIRED', activationOrder: 1, method: 'POS_CARD', paidOffset: -190, staff: staff1 });
  const linhGym = await createGymMembershipWithPayment({ member: members.linh, pkg: pkg12M, startOffset: -14, status: 'ACTIVE', activationOrder: 2, method: 'PAYOS', paidOffset: -14 });

  const huyGym = await createGymMembershipWithPayment({ member: members.huy, pkg: pkg3M, startOffset: -18, status: 'ACTIVE', activationOrder: 1, method: 'PAYOS', paidOffset: -18 });

  const trangGym = await createGymMembershipWithPayment({ member: members.trang, pkg: pkg6M, startOffset: -55, status: 'FROZEN', activationOrder: 1, method: 'POS_CARD', paidOffset: -55, staff: staff2 });
  await prisma.actionLog.create({
    data: {
      userId: staff1.id,
      action: 'MEMBERSHIP_FREEZE_BY_STAFF',
      details: JSON.stringify({
        type: 'FREEZE',
        membershipId: trangGym.membership.id,
        memberId: members.trang.id,
        frozenAt: vnDate(-4, 10, 0).toISOString(),
        freezeDays: 14,
        reason: 'Hội viên đi công tác nước ngoài 2 tuần, bảo lưu theo chính sách.',
      }),
      createdAt: vnDate(-4, 10, 0),
    },
  });

  const khoaGym = await createGymMembershipWithPayment({ member: members.khoa, pkg: pkg3M, startOffset: -10, status: 'ACTIVE', activationOrder: 1, method: 'CASH', paidOffset: -10, staff: staff1 });
  const maiGym = await createGymMembershipWithPayment({ member: members.mai, pkg: pkg1M, startOffset: -5, status: 'ACTIVE', activationOrder: 1, method: 'PAYOS', paidOffset: -5 });
  const tuanGym = await createGymMembershipWithPayment({ member: members.tuan, pkg: pkg12M, startOffset: -12, status: 'ACTIVE', activationOrder: 1, method: 'PAYOS', paidOffset: -12 });
  const nhiGym = await createGymMembershipWithPayment({ member: members.nhi, pkg: pkg3M, startOffset: -2, status: 'ACTIVE', activationOrder: 1, method: 'CASH', paidOffset: -2, staff: staff2, shift: shiftDayMinus2 });
  await createGymMembershipWithPayment({ member: members.dat, pkg: pkg1M, startOffset: -34, status: 'EXPIRED', activationOrder: 1, method: 'CASH', paidOffset: -34, staff: staff1 });
  await createGymMembershipWithPayment({ member: members.phuong, pkg: pkg1M, startOffset: -95, status: 'EXPIRED', activationOrder: 1, method: 'PAYOS', paidOffset: -95 });
  const phuongGym = await createGymMembershipWithPayment({ member: members.phuong, pkg: pkg6M, startOffset: -1, status: 'ACTIVE', activationOrder: 2, method: 'CASH', paidOffset: -1, staff: staff1, shift: shiftDayMinus1 });

  await createGymMembershipWithPayment({
    member: members.mai, pkg: pkg1M, startOffset: 25, status: 'PENDING_ACTIVATION', activationOrder: 2,
    method: 'CASH', paidOffset: 0, staff: staff1, shift: shiftToday, note: 'Gia hạn gói 1 tháng tại quầy sáng nay',
  });

  // --------------------------------------------------------------------------
  // 7. PT WALLET CREDITS, PURCHASES, RENEWALS & COACH CHANGE REQUESTS
  // --------------------------------------------------------------------------
  async function purchasePtPackage({ member, product, coach, purchasedOffset, durationOverrideDays = null, method = 'PAYOS', staff = null }) {
    const paidAt = vnDate(purchasedOffset, 10, 30);
    const durationDays = durationOverrideDays ?? product.durationDays ?? 60;
    const endAt = new Date(paidAt.getTime() + durationDays * DAY_MS);

    const payment = await prisma.payment.create({
      data: {
        userId: member.id,
        amount: product.price,
        method,
        status: 'PAID',
        orderCode: nextOrderCode(),
        transactionNo: `TXN-PT-${member.id}-${product.id}-${Math.abs(purchasedOffset)}`,
        ptProductId: product.id,
        ptQuantity: 1,
        ptPurchaseMode: 'PACKAGE',
        ptLevelSnapshot: product.level,
        ptSessionsSnapshot: product.sessionCount,
        ptDurationDays: durationDays,
        staffId: staff?.id ?? null,
        note: `Mua gói ${product.name}`,
        createdAt: paidAt,
        paidAt,
      },
    });

    await prisma.ptPurchaseItem.create({
      data: {
        paymentId: payment.id,
        productId: product.id,
        mode: 'PACKAGE',
        nameSnapshot: product.name,
        levelSnapshot: product.level,
        sessionsSnapshot: product.sessionCount,
        durationDays,
        unitPrice: product.price,
        quantity: 1,
        benefitsSnapshot: product.benefits,
        unitStartIndex: 0,
      },
    });

    const wallet = await prisma.ptWallet.upsert({
      where: { memberId: member.id },
      create: { memberId: member.id },
      update: {},
    });

    const batch = await prisma.ptCreditBatch.create({
      data: {
        walletId: wallet.id,
        level: product.level,
        source: 'PACKAGE_PURCHASE',
        initialCount: product.sessionCount,
        usedCount: 0,
        heldCount: 0,
        paymentId: payment.id,
        purchaseUnitIndex: 0,
        ptProductIdSnapshot: product.id,
        benefitsSnapshot: product.benefits,
        coachId: coach?.user.id ?? null,
        grantedAt: paidAt,
        startAt: paidAt,
        endAt,
        activatedAt: paidAt,
      },
    });

    await prisma.ptCreditTransaction.create({
      data: {
        batchId: batch.id,
        kind: 'GRANT',
        quantity: product.sessionCount,
        note: `Mua ${product.name}`,
        createdAt: paidAt,
      },
    });

    return { payment, batch };
  }

  async function purchasePtSingle({ member, level, quantity, unitPrice, coach, purchasedOffset, method = 'PAYOS' }) {
    const paidAt = vnDate(purchasedOffset, 11, 0);
    const durationDays = 30;
    const endAt = new Date(paidAt.getTime() + durationDays * DAY_MS);
    const totalAmount = unitPrice * quantity;

    const payment = await prisma.payment.create({
      data: {
        userId: member.id,
        amount: totalAmount,
        method,
        status: 'PAID',
        orderCode: nextOrderCode(),
        transactionNo: `TXN-PTS-${member.id}-${level}-${Math.abs(purchasedOffset)}`,
        ptQuantity: quantity,
        ptPurchaseMode: 'SINGLE',
        ptLevelSnapshot: level,
        ptSessionsSnapshot: quantity,
        ptDurationDays: durationDays,
        note: `Mua ${quantity} buổi PT lẻ (${level})`,
        createdAt: paidAt,
        paidAt,
      },
    });

    await prisma.ptPurchaseItem.create({
      data: {
        paymentId: payment.id,
        productId: null,
        mode: 'SINGLE',
        nameSnapshot: `PT lẻ ${level}`,
        levelSnapshot: level,
        sessionsSnapshot: 1,
        durationDays,
        unitPrice,
        quantity,
        benefitsSnapshot: `Buổi PT lẻ ${level}`,
        unitStartIndex: 0,
      },
    });

    const wallet = await prisma.ptWallet.upsert({
      where: { memberId: member.id },
      create: { memberId: member.id },
      update: {},
    });

    const batch = await prisma.ptCreditBatch.create({
      data: {
        walletId: wallet.id,
        level,
        source: 'SINGLE_PURCHASE',
        initialCount: quantity,
        usedCount: 0,
        heldCount: 0,
        paymentId: payment.id,
        purchaseUnitIndex: 0,
        benefitsSnapshot: `${quantity} buổi PT lẻ cấp ${level}`,
        coachId: coach?.user.id ?? null,
        grantedAt: paidAt,
        startAt: paidAt,
        endAt,
        activatedAt: paidAt,
      },
    });

    await prisma.ptCreditTransaction.create({
      data: {
        batchId: batch.id,
        kind: 'GRANT',
        quantity,
        note: `Mua ${quantity} buổi PT lẻ ${level}`,
        createdAt: paidAt,
      },
    });

    return { payment, batch };
  }

  const blBeg = await purchasePtPackage({ member: members.baolong, product: ptBeg12, coach: coachMinh, purchasedOffset: -22, method: 'PAYOS' });
  const blInt = await purchasePtPackage({ member: members.baolong, product: ptInt12, coach: coachLan, purchasedOffset: -6, method: 'PAYOS' });

  const anInt = await purchasePtPackage({ member: members.an, product: ptInt12, coach: coachLan, purchasedOffset: -20, method: 'PAYOS' });
  const linhBeg = await purchasePtPackage({ member: members.linh, product: ptBeg24, coach: coachVy, purchasedOffset: -13, method: 'PAYOS' });
  const huyAdv = await purchasePtPackage({ member: members.huy, product: ptAdv24, coach: coachDuc, purchasedOffset: -16, method: 'PAYOS' });
  const khoaSingle = await purchasePtSingle({ member: members.khoa, level: 'BEGINNER', quantity: 5, unitPrice: 280000, coach: coachMinh, purchasedOffset: -8, method: 'PAYOS' });
  const tuanAdv = await purchasePtPackage({ member: members.tuan, product: ptAdv24, coach: coachKhang, purchasedOffset: -11, method: 'PAYOS' });
  const nhiBeg = await purchasePtPackage({ member: members.nhi, product: ptBeg12, coach: coachMinh, purchasedOffset: -55, durationOverrideDays: 60, method: 'PAYOS' });
  const phuongInt = await purchasePtPackage({ member: members.phuong, product: ptInt12, coach: coachLan, purchasedOffset: 0, method: 'PAYOS' });

  // PT Renewal Event for Bao Long
  const renOptBeg15 = renewalOptions[0];
  const prevEnd = blBeg.batch.endAt;
  const newEnd = new Date(prevEnd.getTime() + 15 * DAY_MS);
  const renPay = await prisma.payment.create({
    data: {
      userId: members.baolong.id,
      amount: renOptBeg15.price,
      method: 'PAYOS',
      status: 'PAID',
      orderCode: nextOrderCode(),
      transactionNo: `TXN-PTREN-${members.baolong.id}-1`,
      ptRenewalOptionId: renOptBeg15.id,
      ptRenewalProductId: ptBeg12.id,
      ptRenewalBatchId: blBeg.batch.id,
      ptRenewalDays: 15,
      note: 'Gia hạn thêm 15 ngày sử dụng gói PT Beginner',
      createdAt: vnDate(-2, 16, 20),
      paidAt: vnDate(-2, 16, 21),
    },
  });
  await prisma.ptRenewalEvent.create({
    data: {
      batchId: blBeg.batch.id,
      paymentId: renPay.id,
      previousEndAt: prevEnd,
      startAt: prevEnd,
      endAt: newEnd,
      durationDays: 15,
      createdAt: vnDate(-2, 16, 21),
    },
  });
  await prisma.ptCreditBatch.update({ where: { id: blBeg.batch.id }, data: { endAt: newEnd } });

  // PT Coach Change Request (PENDING_ADMIN) for Huy
  await prisma.ptCoachChangeRequest.create({
    data: {
      batchId: huyAdv.batch.id,
      memberId: members.huy.id,
      oldCoachId: coachDuc.user.id,
      newCoachId: coachKhang.user.id,
      reason: 'Em muốn chuyển sang HLV Võ Gia Khang để tập chuyên sâu Powerlifting và nâng mức tạ tối đa 3 bài Big 3 (Squat, Bench, Deadlift).',
      status: 'PENDING_ADMIN',
      requestedAt: vnDate(-1, 15, 0),
    },
  });

  // Historical Q2/Q3 PT payments for Year/Quarter charts
  for (const [mKey, prod, daysAgo] of [
    ['an', ptBeg12, -160],
    ['tuan', ptInt12, -120],
    ['linh', ptBeg12, -85],
    ['huy', ptInt24, -65],
  ]) {
    const dt = vnDate(daysAgo, 14, 0);
    await prisma.payment.create({
      data: {
        userId: members[mKey].id,
        amount: prod.price,
        method: 'PAYOS',
        status: 'PAID',
        orderCode: nextOrderCode(),
        transactionNo: `TXN-HIST-${mKey}-${Math.abs(daysAgo)}`,
        ptProductId: prod.id,
        ptQuantity: 1,
        ptPurchaseMode: 'PACKAGE',
        ptLevelSnapshot: prod.level,
        ptSessionsSnapshot: prod.sessionCount,
        ptDurationDays: prod.durationDays,
        note: `Lịch sử mua ${prod.name}`,
        createdAt: dt,
        paidAt: dt,
      },
    });
  }

  console.log('✅ Đã nạp Membership, Ví PT, Credit Batches, Hóa đơn doanh thu & Yêu cầu đổi HLV.');

  // --------------------------------------------------------------------------
  // 8. PT BOOKINGS + CREDIT ALLOCATIONS + SESSION RESULTS + REVIEWS + MAKEUP + ATTENDANCE REVIEW
  // --------------------------------------------------------------------------
  async function createPtBooking({
    member, coach, batch, dayOffset, startHour, status,
    sessionLog = null, reviewData = null, absenceReason = null, makeupExtra = null,
  }) {
    const startTime = vnDate(dayOffset, startHour, 0);
    const endTime = vnDate(dayOffset, startHour + 1, 0);

    const booking = await prisma.booking.create({
      data: {
        type: 'PT',
        memberId: member.id,
        coachId: coach.user.id,
        startTime,
        endTime,
        status,
        reportedAbsence: status === 'ABSENT_ELIGIBLE',
        absenceReason: absenceReason ?? null,
        absenceReportedAt: status === 'ABSENT_ELIGIBLE' ? vnDate(dayOffset, startHour - 4, 0) : null,
        cancelledBy: status === 'ABSENT_ELIGIBLE' ? 'MEMBER' : null,
        createdAt: vnDate(dayOffset - 2, 9, 0),
      },
    });

    if (batch) {
      const allocStatus = status === 'COMPLETED' ? 'CONSUMED' : 'HELD';
      await prisma.ptBookingCreditAllocation.create({
        data: { bookingId: booking.id, batchId: batch.id, status: allocStatus },
      });

      await prisma.ptCreditTransaction.create({
        data: {
          batchId: batch.id,
          bookingId: booking.id,
          kind: 'HOLD',
          quantity: 1,
          note: `Giữ chỗ lịch PT #${booking.id}`,
          createdAt: vnDate(dayOffset - 2, 9, 0),
        },
      });

      if (allocStatus === 'CONSUMED') {
        await prisma.ptCreditTransaction.create({
          data: {
            batchId: batch.id,
            bookingId: booking.id,
            kind: 'CONSUME',
            quantity: 1,
            note: `Hoàn tất buổi tập PT #${booking.id}`,
            createdAt: endTime,
          },
        });
        await prisma.ptCreditBatch.update({
          where: { id: batch.id },
          data: { usedCount: { increment: 1 } },
        });
      } else {
        await prisma.ptCreditBatch.update({
          where: { id: batch.id },
          data: { heldCount: { increment: 1 } },
        });
      }
    }

    if (status === 'COMPLETED' && sessionLog) {
      const sr = await prisma.sessionResult.create({
        data: {
          bookingId: booking.id,
          notes: sessionLog.notes,
          calories: sessionLog.calories,
          durationMin: sessionLog.durationMin ?? 60,
          createdAt: endTime,
        },
      });
      await prisma.sessionExercise.createMany({
        data: sessionLog.exercises.map((ex) => ({
          sessionResultId: sr.id,
          exerciseName: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weightKg: ex.weightKg ?? null,
        })),
      });
    }

    if (status === 'COMPLETED' && reviewData) {
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          memberId: member.id,
          coachProfileId: coach.profile.id,
          rating: reviewData.rating,
          comment: reviewData.comment,
          createdAt: new Date(endTime.getTime() + 3600 * 1000),
        },
      });
    }

    if (status === 'ABSENT_ELIGIBLE') {
      const mk = await prisma.makeUpRequest.create({
        data: {
          originalBookingId: booking.id,
          status: 'PENDING',
          expiresAt: vnDate(dayOffset + 7, 23, 59),
          createdAt: vnDate(dayOffset, startHour - 4, 0),
          ...(makeupExtra ?? {}),
        },
      });
      if (makeupExtra?.requestedCoachId && prisma.ptMakeUpEvent) {
        await prisma.ptMakeUpEvent.create({
          data: {
            requestId: mk.id,
            actorId: member.id,
            action: 'MEMBER_REQUESTED_COACH_CHANGE',
            details: 'Hội viên chọn HLV Trần Lan PT cho buổi học bù và chuyển Admin duyệt.',
          },
        });
      }
    }

    return booking;
  }

  // --- Bao Long's PT Bookings ---
  await createPtBooking({
    member: members.baolong, coach: coachMinh, batch: blGym.trialBatch, dayOffset: -30, startHour: 18, status: 'COMPLETED',
    sessionLog: {
      notes: 'Đánh giá InBody đầu vào, kiểm tra độ linh hoạt khớp hông và khớp vai. Làm quen kỹ thuật Squat & Hinge cơ bản.',
      calories: 340, durationMin: 60,
      exercises: [
        { name: 'Bodyweight Squat', sets: 3, reps: 15, weightKg: 0 },
        { name: 'Goblet Squat', sets: 3, reps: 12, weightKg: 12 },
        { name: 'Dumbbell Romanian Deadlift', sets: 3, reps: 12, weightKg: 10 },
        { name: 'Plank', sets: 3, reps: 45, weightKg: 0 },
      ],
    },
    reviewData: { rating: 5, comment: 'HLV Nguyễn Minh hướng dẫn cực kỳ tận tâm, giải thích kỹ thuật thở và giữ lưng khi tập tạ rất dễ hiểu!' },
  });

  await createPtBooking({
    member: members.baolong, coach: coachMinh, batch: blBeg.batch, dayOffset: -18, startHour: 18, status: 'COMPLETED',
    sessionLog: {
      notes: 'Buổi thân trên: kiểm soát bả vai khi kéo xô và đẩy ngực tốt hơn hẳn buổi đầu.',
      calories: 410, durationMin: 60,
      exercises: [
        { name: 'Dumbbell Bench Press', sets: 4, reps: 10, weightKg: 16 },
        { name: 'Lat Pulldown', sets: 4, reps: 12, weightKg: 40 },
        { name: 'Seated Cable Row', sets: 3, reps: 12, weightKg: 35 },
        { name: 'Dumbbell Shoulder Press', sets: 3, reps: 10, weightKg: 12 },
      ],
    },
  });
  await createPtBooking({
    member: members.baolong, coach: coachMinh, batch: blBeg.batch, dayOffset: -12, startHour: 18, status: 'COMPLETED',
    sessionLog: {
      notes: 'Buổi thân dưới: độ sâu Squat đạt song song chuẩn, giữ gối không bị chụm vào trong.',
      calories: 480, durationMin: 60,
      exercises: [
        { name: 'Barbell Back Squat', sets: 4, reps: 8, weightKg: 50 },
        { name: 'Walking Lunges', sets: 3, reps: 12, weightKg: 10 },
        { name: 'Leg Press 45°', sets: 3, reps: 12, weightKg: 90 },
        { name: 'Hanging Knee Raise', sets: 3, reps: 15, weightKg: 0 },
      ],
    },
    reviewData: { rating: 5, comment: 'Cảm nhận cơ đùi và mông rõ rệt, giáo án tăng tạ vừa sức không bị quá tải.' },
  });
  await createPtBooking({
    member: members.baolong, coach: coachMinh, batch: blBeg.batch, dayOffset: -5, startHour: 18, status: 'COMPLETED',
    sessionLog: {
      notes: 'Tăng tạ Incline Dumbbell Press lên 18kg mỗi tay, nhịp thở ổn định.',
      calories: 445, durationMin: 60,
      exercises: [
        { name: 'Incline Dumbbell Press', sets: 4, reps: 10, weightKg: 18 },
        { name: 'Assisted Pull-up', sets: 4, reps: 10, weightKg: 25 },
        { name: 'Face Pull', sets: 3, reps: 15, weightKg: 20 },
        { name: 'Cable Triceps Pushdown', sets: 3, reps: 12, weightKg: 22.5 },
      ],
    },
  });
  await createPtBooking({
    member: members.baolong, coach: coachLan, batch: blInt.batch, dayOffset: -3, startHour: 19, status: 'COMPLETED',
    sessionLog: {
      notes: 'Chuẩn hóa form Barbell Squat & Hip Hinge với tạ trung bình, cải thiện độ mở cổ chân.',
      calories: 460, durationMin: 60,
      exercises: [
        { name: 'Barbell Back Squat', sets: 4, reps: 6, weightKg: 65 },
        { name: 'Romanian Deadlift', sets: 4, reps: 8, weightKg: 60 },
        { name: 'Bulgarian Split Squat', sets: 3, reps: 10, weightKg: 12 },
      ],
    },
    reviewData: { rating: 5, comment: 'Chị Lan chỉnh form Squat siêu chi tiết, hết hẳn cảm giác cấn lưng dưới.' },
  });

  await createPtBooking({
    member: members.baolong, coach: coachMinh, batch: blBeg.batch, dayOffset: -2, startHour: 18, status: 'ABSENT_ELIGIBLE',
    absenceReason: 'Bận họp dự án đột xuất tại công ty, xin báo nghỉ trước 4 tiếng để học bù trong tuần.',
  });

  const blTonightBooking = await createPtBooking({ member: members.baolong, coach: coachMinh, batch: blBeg.batch, dayOffset: 0, startHour: 20, status: 'CONFIRMED' });
  await createPtBooking({ member: members.baolong, coach: coachMinh, batch: blBeg.batch, dayOffset: 1, startHour: 18, status: 'CONFIRMED' });
  const blLanUpcoming = await createPtBooking({ member: members.baolong, coach: coachLan, batch: blInt.batch, dayOffset: 2, startHour: 19, status: 'CONFIRMED' });

  // --- Nguyen Minh An + Coach Lan ---
  const anCompleted1 = await createPtBooking({
    member: members.an, coach: coachLan, batch: anInt.batch, dayOffset: -14, startHour: 17, status: 'COMPLETED',
    sessionLog: {
      notes: 'Tối ưu nhịp thở bracing khi Deadlift, tăng ổn định core.',
      calories: 510, durationMin: 60,
      exercises: [
        { name: 'Conventional Deadlift', sets: 4, reps: 5, weightKg: 90 },
        { name: 'Barbell Row', sets: 4, reps: 8, weightKg: 55 },
        { name: 'Cable Woodchopper', sets: 3, reps: 12, weightKg: 15 },
      ],
    },
    reviewData: { rating: 5, comment: 'HLV Trần Lan rất chuyên nghiệp, nâng mức tạ Deadlift lên 90kg an toàn.' },
  });
  await createPtBooking({
    member: members.an, coach: coachLan, batch: anInt.batch, dayOffset: -7, startHour: 17, status: 'COMPLETED',
    sessionLog: {
      notes: 'Đẩy ngực và vai trên ổn định, cải thiện tốc độ thanh đòn.',
      calories: 430, durationMin: 60,
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: 6, weightKg: 65 },
        { name: 'Overhead Press', sets: 3, reps: 8, weightKg: 40 },
        { name: 'Dip', sets: 3, reps: 10, weightKg: 0 },
      ],
    },
  });
  await createPtBooking({ member: members.an, coach: coachLan, batch: anInt.batch, dayOffset: 0, startHour: 18, status: 'CONFIRMED' });
  await createPtBooking({ member: members.an, coach: coachLan, batch: anInt.batch, dayOffset: 2, startHour: 17, status: 'CONFIRMED' });

  // --- Tran Khanh Linh + Coach Vy (100% Pure Gym: Glutes, Legs & Core) ---
  const linhCompleted1 = await createPtBooking({
    member: members.linh, coach: coachVy, batch: linhBeg.batch, dayOffset: -10, startHour: 9, status: 'COMPLETED',
    sessionLog: {
      notes: 'Tập trung kích hoạt cơ mông đùi với Hip Thrust và hoàn thiện form RDL không mỏi lưng dưới.',
      calories: 380, durationMin: 60,
      exercises: [
        { name: 'Barbell Hip Thrust', sets: 4, reps: 12, weightKg: 40 },
        { name: 'Dumbbell Romanian Deadlift', sets: 4, reps: 12, weightKg: 12 },
        { name: 'Cable Glute Kickback', sets: 3, reps: 15, weightKg: 10 },
        { name: 'Plank', sets: 3, reps: 45, weightKg: 0 },
      ],
    },
    reviewData: { rating: 5, comment: 'Tập tạ với chị Vy rất vào cơ mông và bụng, dáng đứng thẳng và săn chắc hơn hẳn!' },
  });
  await createPtBooking({
    member: members.linh, coach: coachVy, batch: linhBeg.batch, dayOffset: -4, startHour: 9, status: 'COMPLETED',
    sessionLog: {
      notes: 'Tăng mức tạ Hip Thrust lên 50kg, kéo lưng trên Lat Pulldown giúp mở vai giảm mỏi cổ gáy.',
      calories: 410, durationMin: 60,
      exercises: [
        { name: 'Barbell Hip Thrust', sets: 4, reps: 10, weightKg: 50 },
        { name: 'Goblet Squat', sets: 4, reps: 12, weightKg: 14 },
        { name: 'Lat Pulldown', sets: 3, reps: 12, weightKg: 25 },
        { name: 'Cable Crunch', sets: 3, reps: 15, weightKg: 20 },
      ],
    },
  });
  await createPtBooking({ member: members.linh, coach: coachVy, batch: linhBeg.batch, dayOffset: 0, startHour: 19, status: 'CONFIRMED' });
  await createPtBooking({ member: members.linh, coach: coachVy, batch: linhBeg.batch, dayOffset: 3, startHour: 9, status: 'CONFIRMED' });

  // --- Le Quoc Huy + Coach Duc (Hypertrophy) ---
  const huyCompleted1 = await createPtBooking({
    member: members.huy, coach: coachDuc, batch: huyAdv.batch, dayOffset: -12, startHour: 19, status: 'COMPLETED',
    sessionLog: {
      notes: 'Buổi Push hypertrophy cường độ cao, giữ RPE 8.',
      calories: 540, durationMin: 60,
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: 8, weightKg: 80 },
        { name: 'Incline Dumbbell Press', sets: 4, reps: 10, weightKg: 26 },
        { name: 'Cable Fly', sets: 3, reps: 15, weightKg: 15 },
      ],
    },
    reviewData: { rating: 5, comment: 'Anh Đức lên bài chuẩn bodybuilding, cảm nhận cơ cực tốt!' },
  });
  await createPtBooking({
    member: members.huy, coach: coachDuc, batch: huyAdv.batch, dayOffset: -6, startHour: 19, status: 'COMPLETED',
    sessionLog: {
      notes: 'Buổi Pull tập trung độ dày lưng và sức nắm.',
      calories: 520, durationMin: 60,
      exercises: [
        { name: 'Weighted Pull-up', sets: 4, reps: 8, weightKg: 10 },
        { name: 'T-Bar Row', sets: 4, reps: 10, weightKg: 60 },
        { name: 'Barbell Curl', sets: 3, reps: 12, weightKg: 30 },
      ],
    },
  });
  await createPtBooking({ member: members.huy, coach: coachDuc, batch: huyAdv.batch, dayOffset: 1, startHour: 19, status: 'CONFIRMED' });

  // --- Do Anh Tuan + Coach Khang (100% Powerlifting & Strength Conditioning) ---
  await createPtBooking({
    member: members.tuan, coach: coachKhang, batch: tuanAdv.batch, dayOffset: -8, startHour: 17, status: 'COMPLETED',
    sessionLog: {
      notes: 'Chu kỳ sức mạnh Big 3: Back Squat 110kg và kết hợp đẩy xe tạ Prowler Sled cuối buổi đốt mỡ cực tốt.',
      calories: 620, durationMin: 60,
      exercises: [
        { name: 'Barbell Back Squat', sets: 5, reps: 5, weightKg: 110 },
        { name: 'Conventional Deadlift', sets: 4, reps: 5, weightKg: 130 },
        { name: 'Kettlebell Swing', sets: 4, reps: 20, weightKg: 24 },
        { name: 'Prowler Sled Push', sets: 4, reps: 20, weightKg: 80 },
      ],
    },
    reviewData: { rating: 5, comment: 'Tập sức mạnh với HLV Khang cực kỳ bài bản, phá kỷ lục Squat 110kg và giảm 2kg mỡ chỉ sau 2 tuần!' },
  });
  await createPtBooking({ member: members.tuan, coach: coachKhang, batch: tuanAdv.batch, dayOffset: 1, startHour: 17, status: 'CONFIRMED' });

  // Past booking for Tuan with PENDING_ADMIN PtAttendanceReview (for Admin PT Operations)
  const tuanReviewBooking = await createPtBooking({
    member: members.tuan, coach: coachKhang, batch: null, dayOffset: -1, startHour: 17, status: 'CONFIRMED',
  });
  if (prisma.ptAttendanceReview) {
    const rev = await prisma.ptAttendanceReview.create({
      data: {
        bookingId: tuanReviewBooking.id,
        status: 'PENDING_ADMIN',
        deadlineAt: vnDate(1, 17, 0),
        coachDecision: 'NO_SHOW',
        coachNote: 'Học viên đến trễ quá 20 phút chưa quét QR bắt đầu buổi tập, chuyển Admin đối soát.',
        coachReviewedAt: vnDate(-1, 18, 15),
      },
    });
    await prisma.ptAttendanceReviewEvent.create({
      data: {
        reviewId: rev.id,
        actorId: coachKhang.user.id,
        action: 'COACH_MARKED_NO_SHOW',
        details: 'Chuyển Admin đối soát quyền lợi buổi tập.',
      },
    });
  }

  // --- Vo Dang Khoa + Coach Minh (with ESCALATED MakeUpRequest for Admin Operations) ---
  await createPtBooking({
    member: members.khoa, coach: coachMinh, batch: khoaSingle.batch, dayOffset: -6, startHour: 16, status: 'COMPLETED',
    sessionLog: {
      notes: 'Làm quen bài tập tạ toàn thân cơ bản, kiểm soát nhịp thở tốt.',
      calories: 390, durationMin: 60,
      exercises: [
        { name: 'Goblet Squat', sets: 3, reps: 12, weightKg: 14 },
        { name: 'Dumbbell Bench Press', sets: 3, reps: 12, weightKg: 12 },
        { name: 'Seated Cable Row', sets: 3, reps: 12, weightKg: 35 },
      ],
    },
    reviewData: { rating: 4, comment: 'Buổi tập hiệu quả, HLV theo sát từng rep.' },
  });
  await createPtBooking({
    member: members.khoa, coach: coachMinh, batch: khoaSingle.batch, dayOffset: -1, startHour: 16, status: 'ABSENT_ELIGIBLE',
    absenceReason: 'HLV bận đột xuất, học viên đề nghị học bù cùng HLV Trần Lan PT để kịp tiến độ tuần này.',
    makeupExtra: {
      cause: 'COACH_ABSENCE',
      coachAbsenceCount: 1,
      requestedCoachId: coachLan.user.id,
      requestReason: 'HLV cũ bận đột xuất, học viên đề nghị học bù cùng HLV Trần Lan PT để kịp tiến độ tuần này.',
      coachChangeRequestedAt: vnDate(0, 7, 0),
      escalatedAt: vnDate(0, 8, 0),
    },
  });

  // --- Bui Yen Nhi + Coach Minh (expiring soon batch) ---
  await createPtBooking({
    member: members.nhi, coach: coachMinh, batch: nhiBeg.batch, dayOffset: -4, startHour: 10, status: 'COMPLETED',
    sessionLog: {
      notes: 'Cải thiện dáng đứng và tăng sức mạnh thân dưới.',
      calories: 360, durationMin: 60,
      exercises: [
        { name: 'Hip Thrust', sets: 4, reps: 12, weightKg: 40 },
        { name: 'Dumbbell Lunge', sets: 3, reps: 12, weightKg: 8 },
      ],
    },
  });
  await createPtBooking({ member: members.nhi, coach: coachMinh, batch: nhiBeg.batch, dayOffset: 2, startHour: 10, status: 'CONFIRMED' });

  // --- Ngo Lan Phuong + Coach Lan ---
  await createPtBooking({ member: members.phuong, coach: coachLan, batch: phuongInt.batch, dayOffset: 1, startHour: 20, status: 'CONFIRMED' });

  // Recalculate Coach Ratings from real Reviews
  for (const c of Object.values(coaches)) {
    const revs = await prisma.review.findMany({ where: { coachProfileId: c.profile.id }, select: { rating: true } });
    if (revs.length > 0) {
      const avg = Number((revs.reduce((s, r) => s + r.rating, 0) / revs.length).toFixed(1));
      await prisma.coachProfile.update({ where: { id: c.profile.id }, data: { rating: avg } });
    }
  }
  console.log('✅ Đã nạp lịch tập PT Gym, nhật ký buổi tập, đánh giá, học bù & đối soát điểm danh.');

  // --------------------------------------------------------------------------
  // 9. GROUP CLASSES (100% GYM STRENGTH, HIIT, GLUTES, CORE, CIRCUIT, UPPER)
  // --------------------------------------------------------------------------
  const gcPump = await prisma.groupClass.create({
    data: {
      name: 'BodyPump — Tạ Nhóm Toàn Thân',
      description: 'Tập tạ thanh đòn theo nhóm tác động đồng đều toàn bộ các nhóm cơ lớn giúp săn chắc và tăng sức bền cơ bắp.',
      durationMin: 60,
    },
  });
  const gcHiit = await prisma.groupClass.create({
    data: {
      name: 'HIIT Gym — Đốt Mỡ Cường Độ Cao',
      description: 'Chuỗi bài tập cường độ cao ngắt quãng với tạ ấm, tạ đơn và máy chèo thuyền giúp đốt 500-650 kcal trong 45 phút.',
      durationMin: 45,
    },
  });
  const gcGlutes = await prisma.groupClass.create({
    data: {
      name: 'Glutes & Legs — Săn Chắc Thân Dưới',
      description: 'Chuyên sâu cơ mông và đùi với Barbell Hip Thrust, Squat, Romanian Deadlift và dây kháng lực.',
      durationMin: 60,
    },
  });
  const gcCore = await prisma.groupClass.create({
    data: {
      name: 'Core & Abs — Săn Chắc Cơ Bụng',
      description: 'Kích hoạt nhóm cơ lõi sâu, siết vòng eo và tăng ổn định cột sống hỗ trợ nâng tạ an toàn.',
      durationMin: 45,
    },
  });
  const gcCircuit = await prisma.groupClass.create({
    data: {
      name: 'Circuit Functional — Thể Lực Toàn Diện',
      description: 'Tập xoay vòng nhiều trạm với Kettlebell, RowErg, Prowler Sled và Dumbbell giúp tăng thể lực toàn thân.',
      durationMin: 60,
    },
  });
  const gcUpper = await prisma.groupClass.create({
    data: {
      name: 'Upper Body Burn — Thân Trên Săn Chắc',
      description: 'Tập trung phát triển ngực, lưng xô, vai và cánh tay với tạ đơn và bài tập bodyweight chuẩn kỹ thuật.',
      durationMin: 60,
    },
  });

  const dailyClassTemplate = [
    { gc: gcCore, coach: coachVy, room: roomGroupStrength, hour: 7, min: 0, cap: 18 },
    { gc: gcGlutes, coach: coachVy, room: roomGroupStrength, hour: 12, min: 0, cap: 18 },
    { gc: gcHiit, coach: coachKhang, room: roomFunctional, hour: 17, min: 30, cap: 18 },
    { gc: gcPump, coach: coachDuc, room: roomGroupStrength, hour: 18, min: 30, cap: 24 },
    { gc: gcCircuit, coach: coachKhang, room: roomFunctional, hour: 19, min: 30, cap: 16 },
    { gc: gcUpper, coach: coachMinh, room: roomGroupStrength, hour: 20, min: 30, cap: 20 },
  ];

  const activeMemberPool = [
    members.baolong, members.an, members.linh, members.huy,
    members.khoa, members.mai, members.tuan, members.nhi, members.phuong,
  ];

  let totalClassSchedules = 0;
  let totalClassBookings = 0;
  for (let d = -1; d <= 6; d++) {
    const slots = d === 0 ? dailyClassTemplate : dailyClassTemplate.filter((_, idx) => (idx + d + 10) % 6 !== 5);
    for (let sIdx = 0; sIdx < slots.length; sIdx++) {
      const slot = slots[sIdx];
      const startTime = vnDate(d, slot.hour, slot.min);
      const endTime = new Date(startTime.getTime() + slot.gc.durationMin * 60 * 1000);
      const isPast = d < 0 || (d === 0 && slot.hour < 10);
      const isFullDemo = d === 1 && sIdx === 3;
      const capacity = isFullDemo ? 5 : slot.cap;

      const schedule = await prisma.groupClassSchedule.create({
        data: {
          classId: slot.gc.id,
          trainerId: slot.coach.user.id,
          roomId: slot.room.id,
          startTime,
          endTime,
          capacity,
          bookedCount: 0,
          status: isPast ? 'COMPLETED' : 'OPEN',
        },
      });
      totalClassSchedules++;

      const countToBook = isFullDemo ? capacity : Math.min(capacity - 2, 3 + ((d + sIdx + 7) % 4));
      const picked = [];
      for (let k = 0; k < countToBook && k < activeMemberPool.length; k++) {
        const m = activeMemberPool[(sIdx * 2 + d + k + 18) % activeMemberPool.length];
        if (!picked.some((x) => x.id === m.id)) picked.push(m);
      }
      if ((d === -1 && sIdx === 2) || (d === 0 && slot.hour === 18) || (d === 1 && slot.hour === 19)) {
        if (!picked.some((x) => x.id === members.baolong.id)) {
          picked[0] = members.baolong;
        }
      }

      for (const attendee of picked) {
        await prisma.groupClassBooking.create({
          data: {
            scheduleId: schedule.id,
            userId: attendee.id,
            status: isPast ? 'CHECKED_IN' : 'BOOKED',
            createdAt: vnDate(d - 1, 10, 0),
          },
        });
        totalClassBookings++;
      }

      await prisma.groupClassSchedule.update({
        where: { id: schedule.id },
        data: {
          bookedCount: picked.length,
          status: isPast ? 'COMPLETED' : picked.length >= capacity ? 'FULL' : 'OPEN',
        },
      });
    }
  }
  console.log(`✅ Đã nạp 6 bộ môn lớp nhóm chuyên Gym, ${totalClassSchedules} lịch lớp và ${totalClassBookings} lượt đặt chỗ.`);

  // --------------------------------------------------------------------------
  // 10. WORKOUT PLAN TEMPLATES, STUDENT PLANS, REVISIONS, ASSESSMENTS & PROGRESS LOGS
  // --------------------------------------------------------------------------
  const beginnerSessions = [
    {
      dayOfWeek: 1,
      title: 'Thân trên (Push & Pull cơ bản)',
      notes: 'Khởi động kỹ khớp vai 10 phút, nghỉ 60-90 giây giữa mỗi hiệp.',
      exercises: [
        { exerciseName: 'Incline Dumbbell Press', sets: 4, reps: 10, weightKg: 18, notes: 'Hạ chậm 2 giây, ép ngực ở đỉnh' },
        { exerciseName: 'Lat Pulldown', sets: 4, reps: 12, weightKg: 40, notes: 'Kéo bằng khuỷu tay, không nhún vai' },
        { exerciseName: 'Seated Cable Row', sets: 3, reps: 12, weightKg: 35, notes: 'Giữ lưng thẳng, siết cơ giữa lưng' },
        { exerciseName: 'Dumbbell Lateral Raise', sets: 3, reps: 15, weightKg: 6, notes: 'Nâng ngang tầm vai, kiểm soát nhịp' },
      ],
    },
    {
      dayOfWeek: 3,
      title: 'Thân dưới & Core (Legs & Abs)',
      notes: 'Giữ cột sống trung lập suốt chuyển động Squat và RDL.',
      exercises: [
        { exerciseName: 'Barbell Back Squat', sets: 4, reps: 8, weightKg: 60, notes: 'Hạ đùi song song sàn, đẩy đầu gối mở nhẹ' },
        { exerciseName: 'Dumbbell Romanian Deadlift', sets: 4, reps: 10, weightKg: 20, notes: 'Đẩy hông ra sau, căng đùi sau' },
        { exerciseName: 'Leg Press 45°', sets: 3, reps: 12, weightKg: 100, notes: 'Không khóa khớp gối khi duỗi' },
        { exerciseName: 'Plank', sets: 3, reps: 60, weightKg: 0, notes: 'Siết chặt bụng và mông 60 giây' },
      ],
    },
    {
      dayOfWeek: 5,
      title: 'Toàn thân & Cardio đốt mỡ',
      notes: 'Duy trì nhịp tim ổn định, kết thúc bằng 15 phút đi bộ dốc 10% trên máy chạy.',
      exercises: [
        { exerciseName: 'Goblet Squat', sets: 3, reps: 12, weightKg: 16, notes: 'Tốc độ kiểm soát' },
        { exerciseName: 'Dumbbell Bench Press', sets: 3, reps: 12, weightKg: 16, notes: 'Góc khuỷu tay 45 độ' },
        { exerciseName: 'Face Pull', sets: 3, reps: 15, weightKg: 20, notes: 'Cải thiện tư thế vai sau' },
        { exerciseName: 'Treadmill Incline Walk', sets: 1, reps: 15, weightKg: 0, notes: '15 phút, tốc độ 5.0 km/h, độ dốc 10%' },
      ],
    },
  ];

  const balancedMealDays = [
    {
      dayOfWeek: 1,
      notes: 'Mục tiêu 2.100 kcal | Đạm 145g | Tinh bột tốt 220g | Chất béo tốt 65g. Uống tối thiểu 2.5L nước.',
      meals: [
        { mealType: 'BREAKFAST', time: '07:00', food: 'Yến mạch nấu sữa tươi không đường + 2 trứng ốp la + 1 quả chuối', portion: '60g yến mạch, 2 trứng, 1 chuối', calories: 520, notes: 'Nạp năng lượng sạch đầu ngày' },
        { mealType: 'LUNCH', time: '12:00', food: 'Cơm gạo lứt + Ức gà áp chảo thảo mộc + Bông cải xanh hấp', portion: '150g cơm, 180g ức gà, 150g rau', calories: 640, notes: 'Dùng 1 muỗng dầu ô liu' },
        { mealType: 'SNACK', time: '16:30', food: 'Sữa chua Hy Lạp + Hạnh nhân rang mộc (trước tập 60 phút)', portion: '1 hũ 150g + 20g hạt', calories: 260, notes: 'Nhẹ bụng, đủ năng lượng trước buổi PT' },
        { mealType: 'DINNER', time: '20:30', food: 'Cá hồi áp chảo + Khoai lang hấp + Salad trộn dầu giấm', portion: '160g cá hồi, 150g khoai, 1 tô salad', calories: 660, notes: 'Bổ sung Omega-3 phục hồi cơ sau tập' },
      ],
    },
    {
      dayOfWeek: 3,
      notes: 'Ngày tập chân cường độ cao: tăng nhẹ tinh bột phức hợp lên 240g để tối ưu sức mạnh.',
      meals: [
        { mealType: 'BREAKFAST', time: '07:15', food: 'Bánh mì nguyên cám + 2 trứng luộc + Bơ tươi', portion: '2 lát bánh mì, 2 trứng, 1/2 trái bơ', calories: 550, notes: '' },
        { mealType: 'LUNCH', time: '12:15', food: 'Bún gạo lứt thịt bò xào nấm & rau cải ngọt', portion: '180g bún, 160g thăn bò', calories: 680, notes: 'Hạn chế nước sốt nhiều đường' },
        { mealType: 'SNACK', time: '16:45', food: '1 muỗng Whey Protein + 1 quả táo xanh', portion: '1 scoop + 1 táo', calories: 220, notes: 'Uống trước tập 45-60 phút' },
        { mealType: 'DINNER', time: '20:30', food: 'Tôm hấp + Cơm trắng vừa đủ + Canh bí đỏ thịt bằm', portion: '200g tôm, 120g cơm, 1 chén canh', calories: 620, notes: 'Dễ tiêu hóa buổi tối' },
      ],
    },
  ];

  const intermediateSessions = [
    {
      dayOfWeek: 2,
      title: 'Compound Squat & Lower Strength',
      notes: 'Khởi động cổ chân + khớp hông 10 phút trước khi vào tạ chính.',
      exercises: [
        { exerciseName: 'Barbell Back Squat', sets: 5, reps: 5, weightKg: 70, notes: 'Giữ bracing tốt, RPE 7.5-8' },
        { exerciseName: 'Romanian Deadlift', sets: 4, reps: 8, weightKg: 65, notes: 'Kiểm soát tempo 3-1-1' },
        { exerciseName: 'Bulgarian Split Squat', sets: 3, reps: 10, weightKg: 14, notes: 'Mỗi chân 10 reps' },
      ],
    },
    {
      dayOfWeek: 4,
      title: 'Upper Strength & Posture Control',
      notes: 'Tập trung biên độ vận động chuẩn và cân bằng đẩy - kéo.',
      exercises: [
        { exerciseName: 'Barbell Bench Press', sets: 4, reps: 6, weightKg: 65, notes: 'Chạm ngực có kiểm soát' },
        { exerciseName: 'Weighted Pull-up', sets: 4, reps: 8, weightKg: 5, notes: 'Duỗi hết tay ở điểm dưới' },
        { exerciseName: 'Overhead Press', sets: 3, reps: 8, weightKg: 40, notes: 'Không võng lưng dưới' },
      ],
    },
  ];

  const glutesCoreSessions = [
    {
      dayOfWeek: 2,
      title: 'Glutes Focus & Lower Body Shaping',
      notes: 'Kích hoạt cơ mông bằng dây kháng lực 5 phút trước khi vào Barbell Hip Thrust.',
      exercises: [
        { exerciseName: 'Barbell Hip Thrust', sets: 4, reps: 12, weightKg: 50, notes: 'Giữ 1 giây ở đỉnh, siết chặt cơ mông' },
        { exerciseName: 'Dumbbell Romanian Deadlift', sets: 4, reps: 12, weightKg: 14, notes: 'Giữ lưng thẳng, cảm nhận đùi sau' },
        { exerciseName: 'Cable Glute Kickback', sets: 3, reps: 15, weightKg: 10, notes: 'Mỗi chân 15 reps, không võng lưng' },
      ],
    },
    {
      dayOfWeek: 5,
      title: 'Upper Tone, Core & StairMaster Cardio',
      notes: 'Kết hợp kéo lưng mở vai và siết cơ bụng, kết thúc bằng 15 phút leo cầu thang.',
      exercises: [
        { exerciseName: 'Lat Pulldown', sets: 4, reps: 12, weightKg: 25, notes: 'Kéo xuống ngang xương đòn, giữ lưng thẳng' },
        { exerciseName: 'Cable Crunch', sets: 3, reps: 15, weightKg: 20, notes: 'Cuộn thân trên bằng cơ bụng' },
        { exerciseName: 'StairMaster Climb', sets: 1, reps: 15, weightKg: 0, notes: '15 phút tốc độ mức 6 đốt mỡ đều' },
      ],
    },
  ];

  // 4 Pure-Gym Workout Plan Templates
  const tplBeg = await prisma.workoutPlan.create({
    data: {
      coachId: coachMinh.user.id,
      title: 'Lộ trình Giảm mỡ & Nền tảng Gym 4 tuần (Beginner)',
      description: 'Giáo án mẫu chuẩn hóa kỹ thuật 6 chuyển động tập tạ cơ bản và đốt mỡ bền vững cho hội viên mới.',
      sessionsJson: JSON.stringify(beginnerSessions),
      mealsJson: JSON.stringify(balancedMealDays),
    },
  });
  const tplInt = await prisma.workoutPlan.create({
    data: {
      coachId: coachLan.user.id,
      title: 'Compound Strength & Mobility 6 tuần (Intermediate)',
      description: 'Tăng sức mạnh 3 bài Big 3 (Squat, Bench, Deadlift) kết hợp tối ưu độ linh hoạt khớp.',
      sessionsJson: JSON.stringify(intermediateSessions),
      mealsJson: JSON.stringify(balancedMealDays),
    },
  });
  const tplAdv = await prisma.workoutPlan.create({
    data: {
      coachId: coachDuc.user.id,
      title: 'Hypertrophy Upper/Lower Split 8 tuần (Advanced)',
      description: 'Chương trình phát triển khối cơ chuyên sâu với phân kỳ tải lũy tiến (Progressive Overload).',
      sessionsJson: JSON.stringify(intermediateSessions),
      mealsJson: JSON.stringify(balancedMealDays),
    },
  });
  const tplGlutes = await prisma.workoutPlan.create({
    data: {
      coachId: coachVy.user.id,
      title: 'Glutes & Core Body Recomposition 6 tuần (Nữ)',
      description: 'Giáo án chuyên biệt phòng gym giúp săn chắc vòng 3, thon gọn vòng eo và cải thiện tư thế lưng vai.',
      sessionsJson: JSON.stringify(glutesCoreSessions),
      mealsJson: JSON.stringify(balancedMealDays),
    },
  });

  // PT Training Assessments
  await prisma.ptTrainingAssessment.createMany({
    data: [
      {
        memberId: members.baolong.id,
        coachId: coachMinh.user.id,
        level: 'BEGINNER',
        kind: 'BASELINE',
        goal: 'Giảm 4kg mỡ thừa, tăng khối cơ nạc và nắm vững kỹ thuật tập tạ an toàn trong 8 tuần.',
        movementNotes: 'Cổ chân hơi hạn chế khi xuống sâu Squat, vai trước hơi căng do ngồi máy tính nhiều. Core ổn.',
        nextSteps: 'Tập trung khởi động khớp cổ chân, mở ngực và xây dựng nền tảng tập tạ 3 buổi/tuần.',
        createdAt: vnDate(-21, 18, 30),
      },
      {
        memberId: members.baolong.id,
        coachId: coachMinh.user.id,
        level: 'BEGINNER',
        kind: 'REVIEW',
        goal: 'Duy trì đà giảm mỡ ổn định và tăng dần tạ ở Squat & Bench Press.',
        movementNotes: 'Độ sâu Squat đạt song song rất tốt, lưng giữ trung lập ổn định, sức bền cải thiện rõ.',
        nextSteps: 'Nâng tạ Back Squat lên 60kg và Incline Dumbbell Press lên 18kg trong 2 tuần tới.',
        createdAt: vnDate(-5, 19, 10),
      },
      {
        memberId: members.baolong.id,
        coachId: coachLan.user.id,
        level: 'INTERMEDIATE',
        kind: 'BASELINE',
        goal: 'Chuẩn hóa kỹ thuật Squat 80kg và Deadlift 100kg không đau lưng.',
        movementNotes: 'Nền tảng tốt, cần tối ưu tốc độ hạ tạ và kỹ thuật nén hơi bụng (bracing).',
        metricName: 'Barbell Back Squat (5RM)',
        metricValue: 65,
        nextSteps: 'Thực hiện chu kỳ 4 tuần tăng sức mạnh thân dưới với tempo kiểm soát.',
        createdAt: vnDate(-3, 20, 10),
      },
      {
        memberId: members.an.id,
        coachId: coachLan.user.id,
        level: 'INTERMEDIATE',
        kind: 'BASELINE',
        goal: 'Tăng sức mạnh Deadlift lên 110kg và cải thiện tỷ lệ mỡ xuống dưới 15%.',
        movementNotes: 'Khớp hông linh hoạt tốt, vai phải hơi yếu hơn vai trái khi đẩy tạ.',
        metricName: 'Conventional Deadlift (5RM)',
        metricValue: 90,
        nextSteps: 'Bổ sung bài tập đơn tay (unilateral) và chu kỳ kéo tạ 2 buổi/tuần.',
        createdAt: vnDate(-18, 18, 0),
      },
      {
        memberId: members.linh.id,
        coachId: coachVy.user.id,
        level: 'BEGINNER',
        kind: 'BASELINE',
        goal: 'Phát triển cơ mông đùi, săn chắc vòng eo và giảm 3kg mỡ trong 10 tuần.',
        movementNotes: 'Cơ mông kích hoạt còn yếu khi gánh tạ, cần làm quen Barbell Hip Thrust và kéo xô mở lưng.',
        nextSteps: 'Kết hợp tập tạ thân dưới Glutes & Core 2 buổi/tuần cùng đi bộ dốc / StairMaster cuối buổi.',
        createdAt: vnDate(-12, 10, 0),
      },
      {
        memberId: members.huy.id,
        coachId: coachDuc.user.id,
        level: 'ADVANCED',
        kind: 'BASELINE',
        goal: 'Tăng 3kg cơ nạc sạch, chuẩn bị giai đoạn siết nét cơ bắp.',
        movementNotes: 'Kỹ thuật nền tảng vững, khả năng phục hồi tốt.',
        metricName: 'Barbell Bench Press (8RM)',
        metricValue: 80,
        phaseName: 'Giai đoạn 1 - Hypertrophy Accumulation',
        nextSteps: 'Duy trì thặng dư nhẹ +250 kcal/ngày, ưu tiên nhóm cơ ngực trên và lưng xô.',
        createdAt: vnDate(-14, 20, 0),
      },
    ],
  });

  // StudentWorkoutPlans + Revisions
  const blSessionsV1 = JSON.parse(JSON.stringify(beginnerSessions));
  blSessionsV1[1].exercises[0].weightKg = 50;

  await prisma.studentWorkoutPlan.create({
    data: {
      workoutPlanId: tplBeg.id,
      memberId: members.baolong.id,
      coachId: coachMinh.user.id,
      programName: 'PT BEGINNER - GIẢM MỠ TĂNG CƠ',
      status: 'ACTIVE',
      version: 2,
      title: 'Giáo án Cá nhân hóa 8 tuần — Bảo Long',
      description: 'Tập trung giảm mỡ vùng bụng, chuẩn hóa kỹ thuật Squat/Press và tăng thể lực nền tảng.',
      sessionsJson: JSON.stringify(beginnerSessions),
      mealsJson: JSON.stringify(balancedMealDays),
      createdAt: vnDate(-20, 19, 0),
      updatedAt: vnDate(-5, 19, 30),
      revisions: {
        create: [
          {
            version: 1,
            title: 'Giáo án Cá nhân hóa 8 tuần — Bảo Long',
            description: 'Phiên bản khởi đầu sau buổi đánh giá InBody đầu vào.',
            sessionsJson: JSON.stringify(blSessionsV1),
            mealsJson: JSON.stringify(balancedMealDays),
            changedById: coachMinh.user.id,
            reason: 'Gán giáo án đầu vào cho học viên sau khi hoàn tất Baseline Assessment',
            createdAt: vnDate(-20, 19, 0),
          },
          {
            version: 2,
            title: 'Giáo án Cá nhân hóa 8 tuần — Bảo Long',
            description: 'Tập trung giảm mỡ vùng bụng, chuẩn hóa kỹ thuật Squat/Press và tăng thể lực nền tảng.',
            sessionsJson: JSON.stringify(beginnerSessions),
            mealsJson: JSON.stringify(balancedMealDays),
            changedById: coachMinh.user.id,
            reason: 'Tăng mức tạ Back Squat từ 50kg lên 60kg và Incline Press lên 18kg sau kỳ đánh giá tuần 3',
            createdAt: vnDate(-5, 19, 30),
          },
        ],
      },
    },
  });

  await prisma.studentWorkoutPlan.create({
    data: {
      workoutPlanId: tplInt.id,
      memberId: members.an.id,
      coachId: coachLan.user.id,
      programName: 'PT INTERMEDIATE - STRENGTH',
      status: 'ACTIVE',
      version: 1,
      title: 'Lộ trình Sức mạnh Compound 6 tuần — Minh An',
      description: 'Tối ưu Deadlift & Bench Press kết hợp mobility hàng tuần.',
      sessionsJson: JSON.stringify(intermediateSessions),
      mealsJson: JSON.stringify(balancedMealDays),
      createdAt: vnDate(-17, 19, 0),
      revisions: {
        create: {
          version: 1,
          title: 'Lộ trình Sức mạnh Compound 6 tuần — Minh An',
          description: 'Tối ưu Deadlift & Bench Press kết hợp mobility hàng tuần.',
          sessionsJson: JSON.stringify(intermediateSessions),
          mealsJson: JSON.stringify(balancedMealDays),
          changedById: coachLan.user.id,
          reason: 'Gán giáo án cho học viên',
          createdAt: vnDate(-17, 19, 0),
        },
      },
    },
  });

  await prisma.studentWorkoutPlan.create({
    data: {
      workoutPlanId: tplGlutes.id,
      memberId: members.linh.id,
      coachId: coachVy.user.id,
      programName: 'PT GLUTES & CORE',
      status: 'ACTIVE',
      version: 1,
      title: 'Giáo án Săn chắc Glutes & Core — Khánh Linh',
      description: 'Phát triển cơ mông đùi, siết eo và tăng sức mạnh lưng trên với máy tập và tạ đòn.',
      sessionsJson: JSON.stringify(glutesCoreSessions),
      mealsJson: JSON.stringify(balancedMealDays),
      createdAt: vnDate(-11, 11, 0),
      revisions: {
        create: {
          version: 1,
          title: 'Giáo án Săn chắc Glutes & Core — Khánh Linh',
          description: 'Phát triển cơ mông đùi, siết eo và tăng sức mạnh lưng trên với máy tập và tạ đòn.',
          sessionsJson: JSON.stringify(glutesCoreSessions),
          mealsJson: JSON.stringify(balancedMealDays),
          changedById: coachVy.user.id,
          reason: 'Gán giáo án cho học viên',
          createdAt: vnDate(-11, 11, 0),
        },
      },
    },
  });

  await prisma.studentWorkoutPlan.create({
    data: {
      workoutPlanId: tplAdv.id,
      memberId: members.huy.id,
      coachId: coachDuc.user.id,
      programName: 'PT ADVANCED - HYPERTROPHY',
      status: 'ACTIVE',
      version: 1,
      title: 'Giáo án Tăng cơ Upper/Lower — Quốc Huy',
      description: 'Tối đa hóa phát triển cơ bắp và sức mạnh thân trên.',
      sessionsJson: JSON.stringify(intermediateSessions),
      mealsJson: JSON.stringify(balancedMealDays),
      createdAt: vnDate(-13, 21, 0),
      revisions: {
        create: {
          version: 1,
          title: 'Giáo án Tăng cơ Upper/Lower — Quốc Huy',
          description: 'Tối đa hóa phát triển cơ bắp và sức mạnh thân trên.',
          sessionsJson: JSON.stringify(intermediateSessions),
          mealsJson: JSON.stringify(balancedMealDays),
          changedById: coachDuc.user.id,
          reason: 'Gán giáo án cho học viên',
          createdAt: vnDate(-13, 21, 0),
        },
      },
    },
  });

  // Progress Logs
  const progressEntries = [
    { memberId: members.baolong.id, weight: 74.8, bodyFat: 21.8, muscleMass: 31.8, daysAgo: -35 },
    { memberId: members.baolong.id, weight: 74.1, bodyFat: 21.1, muscleMass: 32.0, daysAgo: -28 },
    { memberId: members.baolong.id, weight: 73.4, bodyFat: 20.3, muscleMass: 32.3, daysAgo: -21 },
    { memberId: members.baolong.id, weight: 72.7, bodyFat: 19.6, muscleMass: 32.6, daysAgo: -14 },
    { memberId: members.baolong.id, weight: 72.1, bodyFat: 19.0, muscleMass: 32.9, daysAgo: -7 },
    { memberId: members.baolong.id, weight: 71.5, bodyFat: 18.4, muscleMass: 33.1, daysAgo: -1 },
    { memberId: members.an.id, weight: 74.5, bodyFat: 17.8, muscleMass: 34.2, daysAgo: -21 },
    { memberId: members.an.id, weight: 73.8, bodyFat: 16.9, muscleMass: 34.7, daysAgo: -10 },
    { memberId: members.an.id, weight: 73.0, bodyFat: 16.1, muscleMass: 35.1, daysAgo: -2 },
    { memberId: members.linh.id, weight: 55.6, bodyFat: 25.4, muscleMass: 21.5, daysAgo: -14 },
    { memberId: members.linh.id, weight: 54.4, bodyFat: 24.3, muscleMass: 21.8, daysAgo: -7 },
    { memberId: members.linh.id, weight: 53.5, bodyFat: 23.5, muscleMass: 22.1, daysAgo: -1 },
    { memberId: members.huy.id, weight: 78.6, bodyFat: 14.5, muscleMass: 38.2, daysAgo: -15 },
    { memberId: members.huy.id, weight: 79.4, bodyFat: 14.3, muscleMass: 38.9, daysAgo: -7 },
    { memberId: members.huy.id, weight: 80.2, bodyFat: 14.1, muscleMass: 39.5, daysAgo: -1 },
  ];
  await prisma.progressLog.createMany({
    data: progressEntries.map((p) => ({
      memberId: p.memberId,
      weight: p.weight,
      bodyFat: p.bodyFat,
      muscleMass: p.muscleMass,
      loggedAt: vnDate(p.daysAgo, 8, 30),
    })),
  });
  console.log('✅ Đã nạp 4 giáo án mẫu Gym, 4 giáo án cá nhân hóa (+ revisions), 6 đánh giá PT và 15 mốc InBody.');

  // --------------------------------------------------------------------------
  // 11. CHECK-INS
  // --------------------------------------------------------------------------
  const activeMembershipsByKey = [
    { m: members.baolong, ms: blGym.membership },
    { m: members.an, ms: anGym.membership },
    { m: members.linh, ms: linhGym.membership },
    { m: members.huy, ms: huyGym.membership },
    { m: members.khoa, ms: khoaGym.membership },
    { m: members.mai, ms: maiGym.membership },
    { m: members.tuan, ms: tuanGym.membership },
    { m: members.nhi, ms: nhiGym.membership },
    { m: members.phuong, ms: phuongGym.membership },
  ];
  const realisticHours = [6, 7, 7, 9, 12, 15, 17, 18, 18, 19, 19, 20];
  const checkInRows = [];

  for (let d = -25; d <= -1; d++) {
    const dailyCount = d >= -7 ? 4 : 3;
    for (let k = 0; k < dailyCount; k++) {
      const pair = activeMembershipsByKey[(Math.abs(d) * 3 + k) % activeMembershipsByKey.length];
      const hr = realisticHours[(Math.abs(d) * 5 + k * 2) % realisticHours.length];
      const shiftId = d === -3 ? shiftDayMinus3.id : d === -2 ? shiftDayMinus2.id : d === -1 ? shiftDayMinus1.id : null;
      checkInRows.push({
        memberId: pair.m.id,
        membershipId: pair.ms.id,
        roomId: k % 3 === 0 ? roomPt.id : roomMain.id,
        staffId: k % 2 === 0 ? staff1.id : staff2.id,
        shiftId,
        checkInTime: vnDate(d, hr, (k * 13) % 55),
        method: k % 4 === 3 ? 'MANUAL' : 'QR_CODE',
        status: 'SUCCESS',
      });
    }
  }
  const todayCheckIns = [
    { idx: 0, h: 6, min: 18, method: 'QR_CODE', room: roomMain.id },
    { idx: 1, h: 6, min: 35, method: 'QR_CODE', room: roomMain.id },
    { idx: 2, h: 6, min: 52, method: 'QR_CODE', room: roomGroupStrength.id },
    { idx: 3, h: 7, min: 10, method: 'QR_CODE', room: roomMain.id },
    { idx: 5, h: 7, min: 28, method: 'QR_CODE', room: roomCardio.id },
    { idx: 6, h: 7, min: 45, method: 'MANUAL', room: roomFunctional.id },
    { idx: 7, h: 8, min: 12, method: 'QR_CODE', room: roomMain.id },
    { idx: 8, h: 8, min: 40, method: 'QR_CODE', room: roomPt.id },
  ];
  for (const tc of todayCheckIns) {
    const pair = activeMembershipsByKey[tc.idx];
    checkInRows.push({
      memberId: pair.m.id,
      membershipId: pair.ms.id,
      roomId: tc.room,
      staffId: staff1.id,
      shiftId: shiftToday.id,
      checkInTime: vnDate(0, tc.h, tc.min),
      method: tc.method,
      status: 'SUCCESS',
    });
  }
  await prisma.checkIn.createMany({ data: checkInRows });
  console.log(`✅ Đã nạp ${checkInRows.length} lượt Check-in.`);

  // --------------------------------------------------------------------------
  // 12. OPERATIONAL NOTES, SUPPORT TICKETS & NOTIFICATIONS (100% GYM)
  // --------------------------------------------------------------------------
  await prisma.operationalNote.createMany({
    data: [
      {
        staffId: staff1.id,
        shiftId: shiftToday.id,
        category: 'EQUIPMENT',
        content: 'Máy chạy bộ TM-003 khu Cardio đã bàn giao kỹ thuật viên thay băng tải, dự kiến hoàn tất lúc 16:00 hôm nay.',
        priority: 'HIGH',
        status: 'PENDING_REVIEW',
        createdAt: vnDate(0, 7, 30),
      },
      {
        staffId: staff1.id,
        shiftId: shiftToday.id,
        memberId: members.dat.id,
        memberName: members.dat.fullName,
        memberPhone: members.dat.phone,
        category: 'SERVICE',
        content: 'Hội viên Vũ Tiến Đạt hỏi thông tin gia hạn gói Gym 3 tháng ưu đãi cuối tháng, đã tư vấn hẹn chiều quay lại đóng phí.',
        priority: 'MEDIUM',
        status: 'PENDING_REVIEW',
        createdAt: vnDate(0, 8, 15),
      },
      {
        staffId: staff2.id,
        shiftId: shiftDayMinus2.id,
        category: 'FACILITY',
        content: 'Tủ khóa khu nam số 14 bị kẹt chốt từ, cần kiểm tra pin khóa điện tử.',
        priority: 'URGENT',
        status: 'PENDING_REVIEW',
        createdAt: vnDate(-2, 19, 20),
      },
      {
        staffId: staff1.id,
        shiftId: shiftDayMinus1.id,
        category: 'HYGIENE',
        content: 'Đã bổ sung đầy đủ khăn tập, dung dịch lau tạ và sắp xếp gọn giàn tạ đơn Dumbbell khu Main Gym.',
        priority: 'LOW',
        status: 'RESOLVED',
        managerFeedback: 'Tốt, tiếp tục duy trì kiểm tra đầu mỗi ca trực.',
        createdAt: vnDate(-1, 8, 0),
      },
      {
        staffId: staff2.id,
        shiftId: shiftDayMinus2.id,
        memberId: members.linh.id,
        memberName: members.linh.fullName,
        memberPhone: members.linh.phone,
        category: 'SERVICE',
        content: 'Hội viên Trần Khánh Linh gửi lời khen lớp Glutes & Legs và HLV Đặng Thảo Vy chỉnh kỹ thuật tạ rất tận tâm.',
        priority: 'LOW',
        status: 'RESOLVED',
        managerFeedback: 'Đã ghi nhận vào báo cáo chất lượng dịch vụ tuần.',
        createdAt: vnDate(-2, 20, 10),
      },
    ],
  });

  await prisma.supportRequest.createMany({
    data: [
      {
        memberId: members.baolong.id,
        staffId: staff1.id,
        subject: 'Hỏi về lịch đo InBody định kỳ tháng này',
        message: 'Chào Aura Fitness, gói Gym 12 tháng của mình có được đo InBody miễn phí hàng tháng không ạ?',
        reply: 'Chào anh Bảo Long! Gói hội viên 12 tháng được miễn phí đo InBody 2 lần/tháng tại khu PT tầng 2. Anh có thể nhờ HLV hoặc lễ tân hỗ trợ đo trước buổi tập tối nay nhé!',
        status: 'RESOLVED',
        createdAt: vnDate(-6, 14, 20),
      },
      {
        memberId: members.baolong.id,
        subject: 'Đăng ký thuê tủ gửi đồ cá nhân khu nam',
        message: 'Mình muốn đăng ký thuê cố định tủ để giày tập và đai lưng tập tạ theo tháng tại phòng gym, cho mình xin thông tin phí với ạ.',
        status: 'OPEN',
        createdAt: vnDate(0, 8, 5),
      },
      {
        memberId: members.nhi.id,
        subject: 'Tư vấn gia hạn thời hạn sử dụng gói PT Beginner',
        message: 'Gói PT 12 buổi của em sắp hết hạn sau 5 ngày nữa nhưng vẫn còn 11 buổi, em muốn gia hạn thêm 30 ngày thì thao tác thế nào ạ?',
        status: 'OPEN',
        createdAt: vnDate(-1, 16, 40),
      },
      {
        memberId: members.mai.id,
        staffId: staff2.id,
        subject: 'Đăng ký lớp BodyPump khung giờ tối bị đầy',
        message: 'Lớp BodyPump 18:30 ngày mai báo đầy chỗ rồi, phòng tập có mở thêm suất 19:30 không ạ?',
        reply: 'Chào chị Mai, Aura đã ghi nhận nhu cầu rất cao cho lớp BodyPump và sẽ bổ sung thêm ca tối thứ 6 tuần này. Chị nhớ bật thông báo để đặt chỗ sớm nhé!',
        status: 'IN_PROGRESS',
        createdAt: vnDate(-1, 11, 15),
      },
      {
        memberId: members.trang.id,
        staffId: staff1.id,
        subject: 'Xác nhận thời gian mở lại gói tập sau bảo lưu',
        message: 'Mình đã làm thủ tục bảo lưu 14 ngày tại quầy, cho mình hỏi ngày nào thẻ tự kích hoạt lại ạ?',
        reply: 'Chào chị Trang, gói 6 tháng của chị sẽ tự động mở lại sau 14 ngày kể từ ngày bảo lưu và ngày hết hạn đã được cộng bù tương ứng 14 ngày ạ.',
        status: 'RESOLVED',
        createdAt: vnDate(-3, 9, 50),
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: members.baolong.id,
        title: 'Nhắc lịch tập PT tối nay lúc 20:00',
        message: 'Bạn có buổi tập PT Beginner cùng HLV Nguyễn Minh PT lúc 20:00 - 21:00 hôm nay tại Private PT Zone. Đừng quên ăn nhẹ trước tập 60 phút nhé!',
        isRead: false,
        createdAt: vnDate(0, 8, 30),
      },
      {
        userId: members.baolong.id,
        title: 'Giáo án PT đã được cập nhật lên phiên bản 2',
        message: 'HLV Nguyễn Minh PT vừa nâng mức tạ Back Squat lên 60kg trong giáo án "Giáo án Cá nhân hóa 8 tuần — Bảo Long". Mở mục Giáo án để xem chi tiết.',
        isRead: false,
        createdAt: vnDate(-5, 19, 35),
      },
      {
        userId: members.baolong.id,
        title: 'Đặt lớp BodyPump thành công',
        message: 'Bạn đã giữ chỗ thành công lớp BodyPump — Tạ Nhóm Toàn Thân lúc 18:30 hôm nay tại Group Strength Studio.',
        isRead: false,
        createdAt: vnDate(-1, 10, 5),
      },
      {
        userId: members.baolong.id,
        title: 'Gia hạn thời hạn PT thành công',
        message: 'Gói PT Beginner 12 buổi của bạn đã được gia hạn thêm 15 ngày sử dụng.',
        isRead: true,
        createdAt: vnDate(-2, 16, 22),
      },
      {
        userId: members.baolong.id,
        title: 'Quyền học bù PT đang chờ sử dụng',
        message: 'Bạn có 1 quyền học bù PT (từ buổi báo vắng hợp lệ) có hiệu lực trong 5 ngày tới. Vào mục PT để chọn khung giờ mới.',
        isRead: false,
        createdAt: vnDate(-2, 14, 15),
      },
      {
        userId: members.nhi.id,
        title: 'Gói PT sắp hết hạn sử dụng',
        message: 'Gói PT Beginner 12 buổi của bạn còn 5 ngày sử dụng. Hãy đặt lịch tập hoặc gia hạn thêm thời hạn để không bỏ lỡ buổi tập!',
        isRead: false,
        createdAt: vnDate(0, 8, 0),
      },
      {
        userId: coachMinh.user.id,
        title: 'Lịch dạy hôm nay: 1 buổi PT đã xác nhận',
        message: 'Học viên Bảo Long có lịch tập PT lúc 20:00 tối nay. Chuẩn bị theo dõi mức tạ mới phiên bản 2.',
        isRead: false,
        createdAt: vnDate(0, 7, 0),
      },
      {
        userId: coachLan.user.id,
        title: 'Học viên mới gắn gói PT Intermediate',
        message: 'Hội viên Ngô Lan Phương vừa đăng ký gói PT Intermediate 12 buổi và đặt lịch buổi đầu tiên vào 20:00 ngày mai.',
        isRead: false,
        createdAt: vnDate(0, 9, 10),
      },
      {
        userId: admin.id,
        title: 'Có 1 yêu cầu đổi HLV PT đang chờ duyệt',
        message: 'Hội viên Lê Quốc Huy gửi yêu cầu chuyển từ Phạm Đức PT sang Võ Gia Khang cho gói PT Advanced 24 buổi.',
        isRead: false,
        createdAt: vnDate(-1, 15, 5),
      },
      {
        userId: null,
        title: 'Thông báo bảo trì định kỳ cuối tháng',
        message: 'Aura Fitness tạm ngưng phục vụ từ 12:00 đến 14:00 ngày 30/11/2026 để bảo trì thiết bị tạ và vệ sinh tổng thể phòng gym. Cảm ơn quý hội viên!',
        isRead: false,
        createdAt: vnDate(-1, 9, 0),
      },
    ],
  });
  console.log('✅ Đã nạp 5 ghi chú vận hành, 5 phiếu hỗ trợ và 10 thông báo (100% chuyên Gym).');

  // --------------------------------------------------------------------------
  // 13. MONGODB PT CHAT MESSAGES (100% GYM)
  // --------------------------------------------------------------------------
  if (process.env.MONGODB_URI) {
    try {
      const mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      await mongo.connect();
      const db = mongo.db();
      const msgCol = db.collection('pt_chat_messages');
      const counterCol = db.collection('counters');

      const conversations = [
        {
          memberId: members.baolong.id,
          coachId: coachMinh.user.id,
          bookingId: blTonightBooking.id,
          messages: [
            { sender: 'coach', hoursAgo: 48, text: 'Chào Bảo Long, buổi tập hôm trước anh thấy em kiểm soát nhịp thở khi đẩy ngực tốt hơn rất nhiều rồi đó!' },
            { sender: 'member', hoursAgo: 47, text: 'Dạ cảm ơn anh Minh, sáng nay cơ ngực hơi ê nhẹ nhưng rất dễ chịu ạ.' },
            { sender: 'coach', hoursAgo: 46, text: 'Anh vừa cập nhật giáo án lên phiên bản 2, nâng Back Squat lên 60kg. Em nhớ mở mục Giáo án xem thực đơn ngày tập chân nhé.' },
            { sender: 'member', hoursAgo: 20, text: 'Dạ em xem rồi ạ! Tối nay 20:00 em vẫn lên đúng giờ tập bình thường nhé anh.' },
            { sender: 'coach', hoursAgo: 2, text: 'Ok em! Tối nay nhớ ăn nhẹ trước tập tầm 18:30 (1 hộp sữa chua Hy Lạp hoặc 1 quả chuối) để đủ năng lượng vào bài Squat nhé.' },
          ],
        },
        {
          memberId: members.baolong.id,
          coachId: coachLan.user.id,
          bookingId: blLanUpcoming.id,
          messages: [
            { sender: 'coach', hoursAgo: 70, text: 'Chào Bảo Long, chị đã ghi nhận chỉ số đánh giá đầu vào 5RM Squat 65kg của em lên hệ thống rồi nhé.' },
            { sender: 'member', hoursAgo: 68, text: 'Dạ em cảm ơn chị Lan nhiều, tập theo cách chị chỉnh cổ chân em thấy xuống sâu thoải mái hẳn.' },
            { sender: 'coach', hoursAgo: 5, text: 'Buổi tới thứ 6 lúc 19:00 mình sẽ tập trung chỉnh nhịp bracing cho Romanian Deadlift nhé, em nhớ mang giày đế phẳng.' },
          ],
        },
        {
          memberId: members.an.id,
          coachId: coachLan.user.id,
          bookingId: anCompleted1.id,
          messages: [
            { sender: 'member', hoursAgo: 26, text: 'Chị Lan ơi tối nay 18:00 mình tập phần thân trên hay thân dưới ạ để em chuẩn bị dây kéo lưng?' },
            { sender: 'coach', hoursAgo: 25, text: 'Tối nay mình tập Upper Strength nhé An, mang thêm dây quấn cổ tay nếu có. Hẹn em 18:00 tại khu PT!' },
            { sender: 'member', hoursAgo: 3, text: 'Dạ ok chị, em đã ăn trưa đủ đạm rồi ạ.' },
          ],
        },
        {
          memberId: members.linh.id,
          coachId: coachVy.user.id,
          bookingId: linhCompleted1.id,
          messages: [
            { sender: 'coach', hoursAgo: 30, text: 'Khánh Linh ơi, buổi Hip Thrust 50kg hôm trước em cảm nhận cơ mông đùi tốt hơn chưa?' },
            { sender: 'member', hoursAgo: 28, text: 'Vào cơ mông rõ lắm chị Vy ơi, không còn bị mỏi lưng dưới như lúc em tự tập nữa ạ!' },
            { sender: 'coach', hoursAgo: 4, text: 'Tuyệt vời! Tối nay 19:00 mình giữ mức 50kg Hip Thrust và kết hợp thêm Cable Glute Kickback nhé.' },
          ],
        },
        {
          memberId: members.huy.id,
          coachId: coachDuc.user.id,
          bookingId: huyCompleted1.id,
          messages: [
            { sender: 'coach', hoursAgo: 36, text: 'Huy ơi buổi Pull hôm qua kéo Weighted Pull-up +10kg rất gọn gàng, tuần sau mình giữ form này và tăng 1 rep mỗi set.' },
            { sender: 'member', hoursAgo: 35, text: 'Dạ ok anh Đức, em cũng vừa cập nhật cân nặng 80.2kg và % mỡ lên mục Tiến độ rồi ạ.' },
          ],
        },
      ];

      let msgId = 0;
      const latest = await msgCol.findOne({}, { sort: { id: -1 }, projection: { id: 1 } });
      msgId = latest?.id ?? 0;

      let inserted = 0;
      const nowMs = Date.now();
      for (const conv of conversations) {
        const pairKey = `${conv.memberId}:${conv.coachId}`;
        for (const m of conv.messages) {
          msgId += 1;
          const createdAt = new Date(nowMs - m.hoursAgo * 3600 * 1000);
          await msgCol.insertOne({
            id: msgId,
            bookingId: conv.bookingId,
            senderId: m.sender === 'member' ? conv.memberId : conv.coachId,
            content: m.text,
            createdAt,
            pairKey,
            memberId: conv.memberId,
            coachId: conv.coachId,
          });
          inserted += 1;
        }
      }
      await counterCol.updateOne(
        { _id: 'pt-chat-message-id' },
        { $max: { seq: msgId } },
        { upsert: true }
      );
      await mongo.close();
      console.log(`✅ Đã nạp ${inserted} tin nhắn PT Chat thực tế vào MongoDB (${conversations.length} hội thoại).`);
    } catch (err) {
      console.warn('⚠️  Không thể nạp MongoDB chat:', err.message);
    }
  }

  console.log('\n🎉 HOÀN TẤT NẠP DỮ LIỆU DEMO CHUYÊN GYM 100% VÀO HỆ THỐNG AURA FITNESS!');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi nạp dữ liệu demo:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
