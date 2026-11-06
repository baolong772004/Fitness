import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma.js';

async function seedPackage(data: {
  name: string;
  description: string;
  type: string;
  price: number;
  durationDays: number;
  trialPtSessions?: number;
}) {
  const existing = await prisma.package.findFirst({ where: { name: data.name } });
  const payload = { ...data, isActive: true };
  if (existing) return prisma.package.update({ where: { id: existing.id }, data: payload });
  return prisma.package.create({ data: payload });
}

async function seedCoach(email: string, fullName: string, data: {
  bio: string;
  specialization: string;
  experience: number;
  certifications: string;
  rating: number;
  hourlyRate: number;
}) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash('Coach@123456', 10),
        fullName,
        phone: `090${String(await prisma.user.count()).padStart(7, '0').slice(-7)}`,
        role: 'COACH',
        status: 'ACTIVE',
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { fullName, role: 'COACH', status: 'ACTIVE' },
    });
  }

  const existing = await prisma.coachProfile.findUnique({ where: { userId: user.id } });
  if (existing) return prisma.coachProfile.update({ where: { id: existing.id }, data });
  return prisma.coachProfile.create({ data: { ...data, userId: user.id, status: 'ACTIVE' } });
}

async function main() {
  await seedPackage({
    name: 'Gói 1 tháng', description: 'Phù hợp để thử thói quen tập luyện đều đặn với quyền truy cập phòng gym trong 30 ngày.',
    type: 'MEMBERSHIP', price: 500000, durationDays: 30, trialPtSessions: 0,
  });
  await seedPackage({
    name: 'Gói 3 tháng', description: 'Gói tiết kiệm cho người muốn duy trì mục tiêu tập luyện kéo dài 90 ngày.',
    type: 'MEMBERSHIP', price: 1200000, durationDays: 90, trialPtSessions: 1,
  });
  await seedPackage({
    name: 'Gói 6 tháng', description: 'Gói dài hạn, tiết kiệm chi phí cho hội viên cam kết 180 ngày.',
    type: 'MEMBERSHIP', price: 2100000, durationDays: 180, trialPtSessions: 2,
  });
  await seedPackage({
    name: 'Gói 12 tháng', description: 'Gói ưu đãi năm cho hội viên tập dài hạn và ổn định trong 365 ngày.',
    type: 'MEMBERSHIP', price: 3600000, durationDays: 365, trialPtSessions: 3,
  });

  await seedCoach('minh.pt@aura.local', 'Nguyễn Minh PT', {
    bio: 'Huấn luyện viên giảm cân và tăng sức mạnh cơ bản, phù hợp với người mới bắt đầu.',
    specialization: 'Giảm cân, tăng sức mạnh, kỹ thuật gym cơ bản', experience: 5,
    certifications: 'ACE Certified Personal Trainer', rating: 4.8, hourlyRate: 180000,
  });
  await seedCoach('lan.pt@aura.local', 'Trần Lan PT', {
    bio: 'Tập trung cải thiện tư thế, mobility và kỹ thuật các bài compound.',
    specialization: 'Mobility, tư thế, squat, deadlift, bench press', experience: 7,
    certifications: 'NASM CPT, Personal Training Specialist', rating: 4.9, hourlyRate: 220000,
  });
  await seedCoach('duc.pt@aura.local', 'Phạm Đức PT', {
    bio: 'Xây dựng chương trình tăng cơ và thể lực cho hội viên trung cấp.',
    specialization: 'Tăng cơ, thể lực, strength training', experience: 6,
    certifications: 'ISSA Certified Strength Coach', rating: 4.7, hourlyRate: 200000,
  });

  const ptProducts = [
    { name: 'PT Beginner 12 buổi', level: 'BEGINNER', sessionCount: 12, durationDays: 60, price: 3000000, benefits: '12 buổi 1 kèm 1, đánh giá thể trạng, chương trình tập cơ bản' },
    { name: 'PT Beginner 24 buổi', level: 'BEGINNER', sessionCount: 24, durationDays: 90, price: 5400000, benefits: '24 buổi 1 kèm 1, đánh giá thể trạng, theo dõi tiến độ' },
    { name: 'PT Intermediate 12 buổi', level: 'INTERMEDIATE', sessionCount: 12, durationDays: 60, price: 3600000, benefits: '12 buổi nâng cao kỹ thuật và chỉnh tư thế' },
    { name: 'PT Advanced 24 buổi', level: 'ADVANCED', sessionCount: 24, durationDays: 90, price: 7200000, benefits: '24 buổi cá nhân hóa, tăng sức mạnh và hiệu suất tập luyện' },
  ];
  for (const product of ptProducts) {
    const existing = await prisma.ptProduct.findFirst({ where: { name: product.name } });
    if (existing) await prisma.ptProduct.update({ where: { id: existing.id }, data: { ...product, isActive: true } });
    else await prisma.ptProduct.create({ data: { ...product, isActive: true } });
  }

  const offers = [
    { level: 'BEGINNER', price: 280000, durationDays: 30, maxQuantity: 20, benefits: 'Buổi PT lẻ cho người mới' },
    { level: 'INTERMEDIATE', price: 320000, durationDays: 30, maxQuantity: 20, benefits: 'Buổi PT lẻ nâng cao kỹ thuật' },
    { level: 'ADVANCED', price: 380000, durationDays: 30, maxQuantity: 20, benefits: 'Buổi PT lẻ chuyên sâu' },
  ];
  for (const offer of offers) {
    const existing = await prisma.ptSingleOffer.findUnique({ where: { level: offer.level } });
    if (existing) await prisma.ptSingleOffer.update({ where: { level: offer.level }, data: { ...offer, isActive: true } });
    else await prisma.ptSingleOffer.create({ data: { ...offer, isActive: true } });
  }

  await prisma.gymCalendarConfig.upsert({
    where: { id: 1 },
    update: { openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 },
    create: { id: 1, openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 },
  });

  console.log('Seeded gym packages, coaches, PT products, PT offers, and calendar configuration.');
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
