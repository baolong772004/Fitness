import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const p = await prisma.payment.updateMany({ where: { status: 'PENDING' }, data: { status: 'PAID' } });
    const m = await prisma.membership.updateMany({ where: { status: 'PENDING' }, data: { status: 'ACTIVE' } });
    console.log('Đã cập nhật', p.count, 'payments và', m.count, 'memberships thành công!');
}

main().finally(() => prisma.$disconnect());
