import prisma from '../src/config/prisma.js';

async function ensurePackage(data: {
  name: string;
  description: string;
  type: 'MEMBERSHIP' | 'PT';
  price: number;
  durationDays: number;
  trialPtSessions?: number;
  totalPtSessions?: number | null;
  ptLevel?: string | null;
}) {
  const existing = await prisma.package.findFirst({ where: { name: data.name } });
  const payload = {
    description: data.description,
    type: data.type,
    price: data.price,
    durationDays: data.durationDays,
    trialPtSessions: data.trialPtSessions ?? 0,
    totalPtSessions: data.totalPtSessions ?? null,
    ptLevel: data.ptLevel ?? null,
    isActive: true,
  };
  if (existing) {
    return prisma.package.update({ where: { id: existing.id }, data: payload });
  }
  return prisma.package.create({ data: { name: data.name, ...payload } });
}

async function ensurePtProduct(data: {
  name: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  sessionCount: number;
  durationDays: number;
  price: number;
  singleSessionPrice: number;
  benefits: string;
}) {
  const existing = await prisma.ptProduct.findFirst({ where: { name: data.name } });
  if (existing) {
    return prisma.ptProduct.update({
      where: { id: existing.id },
      data: { ...data, isActive: true },
    });
  }
  return prisma.ptProduct.create({
    data: { ...data, isActive: true },
  });
}

async function ensureRoom(data: { name: string; type: string; capacity: number; legacyNames?: string[] }) {
  const namesToFind = [data.name, ...(data.legacyNames ?? [])];
  const existing = await prisma.room.findFirst({
    where: { name: { in: namesToFind } },
  });
  if (existing) {
    return prisma.room.update({
      where: { id: existing.id },
      data: { name: data.name, type: data.type, capacity: data.capacity, isActive: true },
    });
  }
  return prisma.room.create({
    data: { name: data.name, type: data.type, capacity: data.capacity, isActive: true },
  });
}

async function ensureGroupClass(data: {
  name: string;
  description: string;
  durationMin: number;
  imageUrl?: string;
}) {
  const existing = await prisma.groupClass.findFirst({ where: { name: data.name } });
  if (existing) {
    return prisma.groupClass.update({
      where: { id: existing.id },
      data: {
        description: data.description,
        durationMin: data.durationMin,
        imageUrl: data.imageUrl ?? existing.imageUrl ?? '',
      },
    });
  }
  return prisma.groupClass.create({
    data: {
      name: data.name,
      description: data.description,
      durationMin: data.durationMin,
      imageUrl: data.imageUrl ?? '',
    },
  });
}

async function removeUnrelatedCatalogData() {
  // Loại bỏ thiết bị không thuộc Gym & Fitness (Yoga, Pilates, Boxing)
  await prisma.equipment.deleteMany({
    where: { code: { in: ['EQ-YOG-01', 'EQ-YOG-02'] } },
  });

  // Loại bỏ phòng không thuộc Gym & Fitness nếu chưa có check-in / lịch học / thiết bị
  const yogaRooms = await prisma.room.findMany({
    where: { name: { in: ['Phòng Yoga & Pilates'] } },
    include: { _count: { select: { equipments: true, checkIns: true, schedules: true } } },
  });
  for (const room of yogaRooms) {
    if (room._count.equipments === 0 && room._count.checkIns === 0 && room._count.schedules === 0) {
      await prisma.room.delete({ where: { id: room.id } });
    }
  }

  // Loại bỏ lớp học nhóm không thuộc Gym & Fitness nếu chưa có lịch học
  const nonGymClasses = await prisma.groupClass.findMany({
    where: { name: { in: ['Yoga Vinyasa Flow', 'Zumba Dance Fitness'] } },
    include: { _count: { select: { schedules: true } } },
  });
  for (const gc of nonGymClasses) {
    if (gc._count.schedules === 0) {
      await prisma.groupClass.delete({ where: { id: gc.id } });
    }
  }
}

async function main() {
  await removeUnrelatedCatalogData();

  // 1. Gói Membership chuẩn (không đụng tới bảng User)
  const packages = [
    {
      name: 'Gói 1 tháng',
      description: 'Phù hợp để làm quen thói quen tập luyện đều đặn với toàn bộ khu vực gym & cardio trong 30 ngày.',
      type: 'MEMBERSHIP' as const,
      price: 500000,
      durationDays: 30,
      trialPtSessions: 0,
    },
    {
      name: 'Gói 3 tháng',
      description: 'Gói tiết kiệm cho hội viên duy trì mục tiêu tập luyện 90 ngày, tặng kèm 1 buổi PT đánh giá thể trạng.',
      type: 'MEMBERSHIP' as const,
      price: 1200000,
      durationDays: 90,
      trialPtSessions: 1,
    },
    {
      name: 'Gói 6 tháng',
      description: 'Gói dài hạn 180 ngày tối ưu chi phí, tặng kèm 2 buổi PT 1-1 xây dựng lộ trình cá nhân.',
      type: 'MEMBERSHIP' as const,
      price: 2100000,
      durationDays: 180,
      trialPtSessions: 2,
    },
    {
      name: 'Gói 12 tháng',
      description: 'Gói ưu đãi trọn năm 365 ngày cho hội viên cam kết dài hạn, tặng kèm 3 buổi PT 1-1 chuyên sâu.',
      type: 'MEMBERSHIP' as const,
      price: 3600000,
      durationDays: 365,
      trialPtSessions: 3,
    },
  ];
  for (const pkg of packages) {
    await ensurePackage(pkg);
  }

  // 2. Gói PT 1-1 (PtProduct)
  const ptProductsData = [
    {
      name: 'PT Beginner 12 buổi',
      level: 'BEGINNER' as const,
      sessionCount: 12,
      durationDays: 60,
      price: 3000000,
      singleSessionPrice: 280000,
      benefits: '12 buổi 1 kèm 1, đo InBody, hướng dẫn kỹ thuật gym cơ bản và lịch tập cá nhân hóa',
    },
    {
      name: 'PT Beginner 24 buổi',
      level: 'BEGINNER' as const,
      sessionCount: 24,
      durationDays: 90,
      price: 5400000,
      singleSessionPrice: 280000,
      benefits: '24 buổi 1 kèm 1, theo dõi chỉ số định kỳ và điều chỉnh dinh dưỡng cơ bản',
    },
    {
      name: 'PT Intermediate 12 buổi',
      level: 'INTERMEDIATE' as const,
      sessionCount: 12,
      durationDays: 60,
      price: 3600000,
      singleSessionPrice: 320000,
      benefits: '12 buổi nâng cao kỹ thuật compound, tối ưu hypertrophy và sức bền',
    },
    {
      name: 'PT Intermediate 24 buổi',
      level: 'INTERMEDIATE' as const,
      sessionCount: 24,
      durationDays: 90,
      price: 6500000,
      singleSessionPrice: 320000,
      benefits: '24 buổi chuyên sâu tăng cơ giảm mỡ, phân tích form tập với HLV',
    },
    {
      name: 'PT Advanced 12 buổi',
      level: 'ADVANCED' as const,
      sessionCount: 12,
      durationDays: 60,
      price: 4200000,
      singleSessionPrice: 380000,
      benefits: '12 buổi tối ưu hiệu suất sức mạnh, periodization và phục hồi chuyên sâu',
    },
    {
      name: 'PT Advanced 24 buổi',
      level: 'ADVANCED' as const,
      sessionCount: 24,
      durationDays: 90,
      price: 7200000,
      singleSessionPrice: 380000,
      benefits: '24 buổi huấn luyện hiệu suất cao, cá nhân hóa hoàn toàn giáo án và dinh dưỡng',
    },
  ];
  const seededPtProducts = [];
  for (const product of ptProductsData) {
    seededPtProducts.push(await ensurePtProduct(product));
  }

  // 3. Buổi PT lẻ (PtSingleOffer - chỉ thêm level còn thiếu để không ghi đè dữ liệu hiện có)
  const singleOffers = [
    {
      level: 'BEGINNER',
      price: 280000,
      durationDays: 30,
      maxQuantity: 20,
      benefits: 'Buổi PT lẻ 1-1 dành cho hội viên mới làm quen kỹ thuật gym',
    },
    {
      level: 'INTERMEDIATE',
      price: 320000,
      durationDays: 30,
      maxQuantity: 20,
      benefits: 'Buổi PT lẻ 1-1 nâng cao kỹ thuật và tối ưu khối lượng tạ',
    },
    {
      level: 'ADVANCED',
      price: 380000,
      durationDays: 30,
      maxQuantity: 20,
      benefits: 'Buổi PT lẻ 1-1 chuyên sâu sức mạnh và hiệu suất tập luyện',
    },
  ];
  for (const offer of singleOffers) {
    const existing = await prisma.ptSingleOffer.findUnique({ where: { level: offer.level } });
    if (!existing) {
      await prisma.ptSingleOffer.create({ data: { ...offer, isActive: true } });
    }
  }

  // 4. Tùy chọn gia hạn gói PT (PtRenewalOption)
  const renewalPriceByLevel: Record<string, number> = {
    BEGINNER: 300000,
    INTERMEDIATE: 380000,
    ADVANCED: 450000,
  };
  for (const product of seededPtProducts) {
    const optionName = `Gia hạn 30 ngày - ${product.name}`;
    const existing = await prisma.ptRenewalOption.findFirst({
      where: { name: optionName, ptProductId: product.id },
    });
    if (!existing) {
      await prisma.ptRenewalOption.create({
        data: {
          name: optionName,
          level: product.level,
          durationDays: 30,
          price: renewalPriceByLevel[product.level] ?? 350000,
          isActive: true,
          ptProductId: product.id,
          purchaseMode: 'PACKAGE',
        },
      });
    }
  }

  // 5. Cấu hình lịch mở cửa phòng gym
  const existingCalendar = await prisma.gymCalendarConfig.findUnique({ where: { id: 1 } });
  if (!existingCalendar) {
    await prisma.gymCalendarConfig.create({
      data: { id: 1, openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 },
    });
  }

  // 6. Phòng tập & Thiết bị chuyên Gym & Fitness
  const cardioRoom = await ensureRoom({ name: 'Phòng Gym Cardio', type: 'GYM', capacity: 50 });
  const strengthRoom = await ensureRoom({ name: 'Phòng Gym khu tạ', type: 'FITNESS', capacity: 30 });
  const groupFitnessRoom = await ensureRoom({
    name: 'Phòng Tập Nhóm Fitness',
    type: 'FITNESS',
    capacity: 35,
    legacyNames: ['Studio Group X'],
  });
  const functionalRoom = await ensureRoom({
    name: 'Khu Functional Fitness',
    type: 'FITNESS',
    capacity: 20,
    legacyNames: ['Khu Functional & Boxing'],
  });

  const equipments = [
    { code: 'EQ-CRD-01', name: 'Máy chạy bộ Technogym Run #1', roomId: cardioRoom.id, status: 'AVAILABLE', note: 'Kiểm tra định kỳ tháng 11' },
    { code: 'EQ-CRD-02', name: 'Máy chạy bộ Technogym Run #2', roomId: cardioRoom.id, status: 'AVAILABLE', note: 'Hoạt động ổn định' },
    { code: 'EQ-CRD-03', name: 'Xe đạp tập Elliptical Cross #1', roomId: cardioRoom.id, status: 'AVAILABLE', note: 'Hoạt động ổn định' },
    { code: 'EQ-CRD-04', name: 'Máy chèo thuyền Concept2 RowErg', roomId: cardioRoom.id, status: 'MAINTENANCE', note: 'Đang bảo dưỡng dây xích định kỳ' },
    { code: 'EQ-CRD-05', name: 'Xe đạp kháng lực Assault AirBike', roomId: cardioRoom.id, status: 'AVAILABLE', note: 'Phục vụ bài tập HIIT Cardio' },
    { code: 'EQ-STR-01', name: 'Khung Squat Rack Power Cage #1', roomId: strengthRoom.id, status: 'AVAILABLE', note: 'Kèm thanh đòn Olympic 20kg' },
    { code: 'EQ-STR-02', name: 'Ghế đẩy ngực Bench Press #1', roomId: strengthRoom.id, status: 'AVAILABLE', note: 'Bọc da mới' },
    { code: 'EQ-STR-03', name: 'Giàn kéo xô Lat Pulldown & Cable', roomId: strengthRoom.id, status: 'AVAILABLE', note: 'Hoạt động ổn định' },
    { code: 'EQ-STR-04', name: 'Bộ tạ tay Dumbbell 2kg - 40kg', roomId: strengthRoom.id, status: 'AVAILABLE', note: 'Đủ cặp từ 2kg đến 40kg' },
    { code: 'EQ-STR-05', name: 'Máy đạp đùi Leg Press 45°', roomId: strengthRoom.id, status: 'AVAILABLE', note: 'Tải trọng tối đa 400kg' },
    { code: 'EQ-GRP-01', name: 'Hệ thống âm thanh & ánh sáng Fitness', roomId: groupFitnessRoom.id, status: 'AVAILABLE', note: 'Loa JBL + micro không dây' },
    { code: 'EQ-GRP-02', name: 'Bộ tạ BodyPump & bục Step (30 bộ)', roomId: groupFitnessRoom.id, status: 'AVAILABLE', note: 'Phục vụ lớp BodyPump' },
    { code: 'EQ-FNC-01', name: 'Khung xà đơn Pull-up & dây TRX', roomId: functionalRoom.id, status: 'AVAILABLE', note: 'Tập thân trên và core' },
    { code: 'EQ-FNC-02', name: 'Dàn Kettlebell & dây Battle Rope', roomId: functionalRoom.id, status: 'AVAILABLE', note: 'Tạ ấm 8kg - 24kg' },
  ];

  for (const eq of equipments) {
    await prisma.equipment.upsert({
      where: { code: eq.code },
      update: { name: eq.name, roomId: eq.roomId, status: eq.status, note: eq.note },
      create: eq,
    });
  }

  // 7. Danh mục lớp học nhóm thuần Gym & Fitness
  const groupClasses = [
    {
      name: 'HIIT Burn 45',
      description: 'Tập luyện cường độ cao ngắt quãng 45 phút giúp đốt mỡ hiệu quả và tăng sức bền tim mạch.',
      durationMin: 45,
    },
    {
      name: 'Core & Mobility',
      description: 'Tăng cường cơ trung tâm (core) và độ linh hoạt khớp hỗ trợ các bài tập tạ nặng.',
      durationMin: 45,
    },
    {
      name: 'BodyPump Strength',
      description: 'Lớp tập tạ nhẹ kết hợp nhịp độ chuẩn giúp săn chắc toàn thân và tăng sức bền cơ bắp.',
      durationMin: 60,
    },
    {
      name: 'Circuit Strength Training',
      description: 'Huấn luyện vòng tròn kết hợp tạ ấm, TRX và cardio đốt calo toàn thân.',
      durationMin: 60,
    },
  ];
  for (const gc of groupClasses) {
    await ensureGroupClass(gc);
  }

  // 8. Thiết bị quầy lễ tân (DeskDevice)
  const deskDevices = [
    {
      deviceToken: 'DESK-POS-DEFAULT-001',
      deviceName: 'Quầy Lễ Tân Số 1 (Front Desk 01)',
      location: 'Tầng 1 - Cổng chính',
      isActive: true,
    },
    {
      deviceToken: 'DESK-POS-DEFAULT-002',
      deviceName: 'Quầy Lễ Tân Số 2 (Khu PT & Tư vấn)',
      location: 'Tầng 2 - Khu vực PT',
      isActive: true,
    },
  ];
  for (const dev of deskDevices) {
    await prisma.deskDevice.upsert({
      where: { deviceToken: dev.deviceToken },
      update: { deviceName: dev.deviceName, location: dev.location, isActive: dev.isActive },
      create: dev,
    });
  }

  const summary = {
    usersCountUnchanged: await prisma.user.count(),
    packages: await prisma.package.count(),
    ptProducts: await prisma.ptProduct.count(),
    ptSingleOffers: await prisma.ptSingleOffer.count(),
    ptRenewalOptions: await prisma.ptRenewalOption.count(),
    gymCalendarConfigs: await prisma.gymCalendarConfig.count(),
    rooms: await prisma.room.count(),
    equipments: await prisma.equipment.count(),
    groupClasses: await prisma.groupClass.count(),
    deskDevices: await prisma.deskDevice.count(),
  };

  console.log('Seeded Gym & Fitness catalog data successfully:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('Seed catalog data failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
