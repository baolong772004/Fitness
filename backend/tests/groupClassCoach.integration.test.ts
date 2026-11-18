import 'dotenv/config';
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/prisma.js';
import groupClassRoutes from '../src/routes/groupClass.route.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/group-classes', groupClassRoutes);
  return app;
}

test('Coach receives assigned group classes across dates and notification when Admin schedules a class', async (t) => {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  const coach = await prisma.user.findFirst({ where: { role: 'COACH' }, select: { id: true } });
  const groupClass = await prisma.groupClass.findFirst({ select: { id: true, name: true, durationMin: true } });
  const room = await prisma.room.findFirst({ select: { id: true, name: true } });
  assert.ok(admin && coach && groupClass, 'Requires at least one ADMIN, COACH and GroupClass in DB');

  let createdScheduleId: number | null = null;
  let createdNotifIds: number[] = [];

  t.after(async () => {
    if (createdScheduleId) {
      await prisma.groupClassSchedule.deleteMany({ where: { id: createdScheduleId } });
    }
    if (createdNotifIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: createdNotifIds } } });
    }
    await prisma.$disconnect();
  });

  const app = createTestApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const adminToken = jwt.sign({ userId: admin.id, role: 'ADMIN' }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '5m' });
    const coachToken = jwt.sign({ userId: coach.id, role: 'COACH' }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '5m' });

    const beforeNotifs = await prisma.notification.findMany({
      where: { userId: coach.id },
      select: { id: true },
    });
    const beforeIds = new Set(beforeNotifs.map((n) => n.id));

    const vnFutureDate = new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    const futureStart = new Date(`${vnFutureDate}T10:00:00+07:00`);
    const futureEnd = new Date(futureStart.getTime() + (groupClass.durationMin || 60) * 60000);

    const createRes = await fetch(`${baseUrl}/api/group-classes/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        classId: groupClass.id,
        trainerId: coach.id,
        roomId: room?.id ?? null,
        startTime: futureStart.toISOString(),
        endTime: futureEnd.toISOString(),
        capacity: 15,
      }),
    });
    const createJson = await createRes.json();
    assert.equal(createRes.status, 201);
    createdScheduleId = createJson.data.id;

    // 1. Coach fetches all assigned schedules without having to guess future date
    const coachRes = await fetch(`${baseUrl}/api/group-classes/coach/my-schedules`, {
      headers: { Authorization: `Bearer ${coachToken}` },
    });
    const coachJson = await coachRes.json();
    assert.equal(coachRes.status, 200);
    const found = (coachJson.data as any[]).find((s) => s.id === createdScheduleId);
    assert.ok(found, 'Newly scheduled class must appear in coach/my-schedules');
    assert.equal(found.groupClass.name, groupClass.name);

    // 2. Coach received notification for the assignment
    const afterNotifs = await prisma.notification.findMany({
      where: { userId: coach.id },
      orderBy: { id: 'desc' },
    });
    const newNotifs = afterNotifs.filter((n) => !beforeIds.has(n.id));
    createdNotifIds = newNotifs.map((n) => n.id);
    assert.ok(
      newNotifs.some((n) => n.title === 'Phân công lớp học nhóm mới' && n.message.includes(groupClass.name)),
      'Coach must receive notification containing assigned class name'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
