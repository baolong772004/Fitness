import { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;

const ACTIVE_PT_BOOKING_STATUSES = ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS', 'MAKEUP_BOOKED'];
const PAID_PT_BATCH_SOURCES = ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE', 'ADMIN_ADJUSTMENT', 'LEGACY_MIGRATION', 'LEGACY_PT'];

export interface CoachActivePtPackage {
  sourceType: 'WALLET_BATCH' | 'LEGACY_MEMBERSHIP';
  sourceId: number;
  memberId: number;
  memberName: string;
  memberPhone: string | null;
  level: string;
  packageName: string;
  remainingSessions: number;
  heldSessions: number;
  endAt: string | null;
}

export interface CoachUpcomingPtBooking {
  id: number;
  memberId: number;
  memberName: string;
  memberPhone: string | null;
  startTime: string;
  endTime: string;
  status: string;
}

export interface CoachPendingMakeup {
  id: number;
  originalBookingId: number;
  memberName: string;
  originalStartTime: string;
  expiresAt: string;
  status: string;
}

export interface CoachUpcomingGroupClass {
  id: number;
  className: string;
  roomName: string | null;
  startTime: string;
  endTime: string;
  bookedCount: number;
  capacity: number;
  status: string;
}

export interface CoachPendingCoachChangeRequest {
  id: number;
  batchId: number;
  memberName: string;
  level: string;
  requestedAt: string;
}

export interface CoachPendingAttendanceReview {
  id: number;
  bookingId: number;
  memberName: string;
  startTime: string;
  deadlineAt: string;
  status: string;
}

export interface CoachDeactivationCheckResult {
  coachUserId: number;
  canDeactivate: boolean;
  blockingMessage: string | null;
  summary: {
    activePtStudentCount: number;
    activePtPackageCount: number;
    upcomingPtBookingCount: number;
    pendingMakeupCount: number;
    upcomingGroupClassCount: number;
    pendingCoachChangeCount: number;
    pendingAttendanceReviewCount: number;
  };
  activePtPackages: CoachActivePtPackage[];
  upcomingPtBookings: CoachUpcomingPtBooking[];
  pendingMakeupRequests: CoachPendingMakeup[];
  upcomingGroupClasses: CoachUpcomingGroupClass[];
  pendingCoachChangeRequests: CoachPendingCoachChangeRequest[];
  pendingAttendanceReviews: CoachPendingAttendanceReview[];
}

export async function getCoachDeactivationCheck(
  db: Db,
  coachUserId: number,
  now = new Date(),
): Promise<CoachDeactivationCheckResult> {
  const [batches, legacyPtMemberships, ptBookings, makeups, groupSchedules, coachChangeRequests, attendanceReviews] = await Promise.all([
    db.ptCreditBatch.findMany({
      where: {
        coachId: coachUserId,
        source: { in: PAID_PT_BATCH_SOURCES },
        OR: [{ endAt: null }, { endAt: { gt: now } }],
      },
      include: {
        wallet: {
          include: {
            member: { select: { id: true, fullName: true, phone: true } },
          },
        },
        payment: {
          select: {
            ptProduct: { select: { name: true } },
          },
        },
      },
      orderBy: [{ endAt: 'asc' }, { id: 'asc' }],
    }),

    db.membership.findMany({
      where: {
        coachId: coachUserId,
        package: { type: 'PT' },
        status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'FROZEN'] },
        endDate: { gt: now },
        OR: [{ remainingSessions: null }, { remainingSessions: { gt: 0 } }],
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        package: { select: { name: true, ptLevel: true } },
      },
      orderBy: { endDate: 'asc' },
    }),

    db.booking.findMany({
      where: {
        coachId: coachUserId,
        type: 'PT',
        status: { in: ACTIVE_PT_BOOKING_STATUSES },
      },
      include: {
        member: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { startTime: 'asc' },
    }),

    db.makeUpRequest.findMany({
      where: {
        status: { in: ['PENDING', 'ESCALATED'] },
        expiresAt: { gt: now },
        OR: [
          { assignedCoachId: coachUserId },
          { requestedCoachId: coachUserId },
          { assignedCoachId: null, originalBooking: { coachId: coachUserId } },
        ],
      },
      include: {
        originalBooking: {
          select: {
            id: true,
            startTime: true,
            member: { select: { fullName: true } },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    }),

    db.groupClassSchedule.findMany({
      where: {
        trainerId: coachUserId,
        status: { in: ['OPEN', 'FULL'] },
        endTime: { gt: now },
      },
      include: {
        groupClass: { select: { name: true } },
        room: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    }),

    db.ptCoachChangeRequest.findMany({
      where: {
        status: 'PENDING_ADMIN',
        newCoachId: coachUserId,
      },
      include: {
        batch: { select: { level: true } },
      },
      orderBy: { requestedAt: 'asc' },
    }),

    db.ptAttendanceReview.findMany({
      where: {
        status: { in: ['PENDING_COACH', 'PENDING_ADMIN'] },
        booking: { coachId: coachUserId },
      },
      include: {
        booking: {
          select: {
            id: true,
            startTime: true,
            member: { select: { fullName: true } },
          },
        },
      },
      orderBy: { deadlineAt: 'asc' },
    }),
  ]);

  const activePtPackages: CoachActivePtPackage[] = [];

  for (const batch of batches) {
    const unusedSessions = batch.initialCount - batch.usedCount;
    if (unusedSessions <= 0) continue;
    const member = batch.wallet?.member;
    if (!member) continue;
    activePtPackages.push({
      sourceType: 'WALLET_BATCH',
      sourceId: batch.id,
      memberId: member.id,
      memberName: member.fullName,
      memberPhone: member.phone ?? null,
      level: batch.level,
      packageName:
        batch.payment?.ptProduct?.name ||
        (batch.source === 'SINGLE_PURCHASE' ? `PT lẻ ${batch.level}` : `Gói PT ${batch.level}`),
      remainingSessions: Math.max(0, unusedSessions - batch.heldCount),
      heldSessions: batch.heldCount,
      endAt: batch.endAt ? batch.endAt.toISOString() : null,
    });
  }

  for (const ms of legacyPtMemberships) {
    activePtPackages.push({
      sourceType: 'LEGACY_MEMBERSHIP',
      sourceId: ms.id,
      memberId: ms.user.id,
      memberName: ms.user.fullName,
      memberPhone: ms.user.phone ?? null,
      level: ms.package.ptLevel || 'PT',
      packageName: ms.package.name,
      remainingSessions: ms.remainingSessions ?? 0,
      heldSessions: 0,
      endAt: ms.endDate.toISOString(),
    });
  }

  const upcomingPtBookings: CoachUpcomingPtBooking[] = ptBookings.map((b) => ({
    id: b.id,
    memberId: b.member.id,
    memberName: b.member.fullName,
    memberPhone: b.member.phone ?? null,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    status: b.status,
  }));

  const pendingMakeupRequests: CoachPendingMakeup[] = makeups.map((mk) => ({
    id: mk.id,
    originalBookingId: mk.originalBookingId,
    memberName: mk.originalBooking.member.fullName,
    originalStartTime: mk.originalBooking.startTime.toISOString(),
    expiresAt: mk.expiresAt.toISOString(),
    status: mk.status,
  }));

  const upcomingGroupClasses: CoachUpcomingGroupClass[] = groupSchedules.map((sc) => ({
    id: sc.id,
    className: sc.groupClass.name,
    roomName: sc.room?.name ?? null,
    startTime: sc.startTime.toISOString(),
    endTime: sc.endTime.toISOString(),
    bookedCount: sc.bookedCount,
    capacity: sc.capacity,
    status: sc.status,
  }));

  const changeMemberIds = [...new Set(coachChangeRequests.map((item) => item.memberId))];
  const changeMembers = changeMemberIds.length
    ? await db.user.findMany({ where: { id: { in: changeMemberIds } }, select: { id: true, fullName: true } })
    : [];
  const changeMemberMap = new Map(changeMembers.map((u) => [u.id, u.fullName]));

  const pendingCoachChangeRequests: CoachPendingCoachChangeRequest[] = coachChangeRequests.map((item) => ({
    id: item.id,
    batchId: item.batchId,
    memberName: changeMemberMap.get(item.memberId) || `Hội viên #${item.memberId}`,
    level: item.batch.level,
    requestedAt: item.requestedAt.toISOString(),
  }));

  const pendingAttendanceReviews: CoachPendingAttendanceReview[] = attendanceReviews.map((rev) => ({
    id: rev.id,
    bookingId: rev.booking.id,
    memberName: rev.booking.member.fullName,
    startTime: rev.booking.startTime.toISOString(),
    deadlineAt: rev.deadlineAt.toISOString(),
    status: rev.status,
  }));

  const activePtStudentCount = new Set(activePtPackages.map((item) => item.memberId)).size;
  const activePtPackageCount = activePtPackages.length;
  const upcomingPtBookingCount = upcomingPtBookings.length;
  const pendingMakeupCount = pendingMakeupRequests.length;
  const upcomingGroupClassCount = upcomingGroupClasses.length;
  const pendingCoachChangeCount = pendingCoachChangeRequests.length;
  const pendingAttendanceReviewCount = pendingAttendanceReviews.length;

  const canDeactivate =
    activePtStudentCount === 0 &&
    upcomingPtBookingCount === 0 &&
    pendingMakeupCount === 0 &&
    upcomingGroupClassCount === 0 &&
    pendingCoachChangeCount === 0 &&
    pendingAttendanceReviewCount === 0;

  const parts: string[] = [];
  if (activePtStudentCount > 0) {
    parts.push(`${activePtStudentCount} học viên chưa hết hạn gói PT`);
  }
  if (upcomingPtBookingCount > 0) {
    parts.push(`${upcomingPtBookingCount} lịch dạy PT chưa hoàn thành`);
  }
  if (pendingMakeupCount > 0) {
    parts.push(`${pendingMakeupCount} yêu cầu học bù PT đang chờ xử lý`);
  }
  if (upcomingGroupClassCount > 0) {
    parts.push(`${upcomingGroupClassCount} lớp học nhóm sắp diễn ra`);
  }
  if (pendingCoachChangeCount > 0) {
    parts.push(`${pendingCoachChangeCount} yêu cầu đổi sang HLV này đang chờ duyệt`);
  }
  if (pendingAttendanceReviewCount > 0) {
    parts.push(`${pendingAttendanceReviewCount} buổi PT đang chờ xác nhận điểm danh`);
  }

  const blockingMessage = canDeactivate
    ? null
    : `Không thể tạm ngưng HLV vì vẫn còn ${parts.join(', ')}. Vui lòng hoàn thành các lịch dạy hoặc chuyển học viên sang HLV khác trước khi ngưng.`;

  return {
    coachUserId,
    canDeactivate,
    blockingMessage,
    summary: {
      activePtStudentCount,
      activePtPackageCount,
      upcomingPtBookingCount,
      pendingMakeupCount,
      upcomingGroupClassCount,
      pendingCoachChangeCount,
      pendingAttendanceReviewCount,
    },
    activePtPackages,
    upcomingPtBookings,
    pendingMakeupRequests,
    upcomingGroupClasses,
    pendingCoachChangeRequests,
    pendingAttendanceReviews,
  };
}
