import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@gym.com';
  const password = 'admin';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const admin = await prisma.user.upsert({
      where: { email },
      update: { 
        role: 'ADMIN',
        status: 'ACTIVE',
        password: hashedPassword
      },
      create: {
        email,
        password: hashedPassword,
        fullName: 'Super Admin',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Đã cấp quyền ADMIN thành công!');
    console.log(`Tài khoản: ${admin.email}`);
    console.log(`Mật khẩu: ${password}`);
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

createAdmin();
