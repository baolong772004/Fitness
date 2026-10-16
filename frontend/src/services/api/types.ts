/**
 * AURA FITNESS - API Types
 * Mirrors Prisma Database Models and Backend DTOs
 */

export interface ApiUser {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  avatar?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  role: 'ADMIN' | 'STAFF' | 'RECEPTIONIST' | 'COACH' | 'MEMBER' | string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiPackage {
  id: number;
  name: string;
  type: 'MEMBERSHIP' | 'PT';
  description?: string | null;
  price: number | string;
  durationDays: number;
  trialPtSessions: number;
  totalPtSessions?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiSubscription {
  id: number;
  userId: number;
  packageId: number;
  coachId?: number | null;
  startDate: string;
  endDate: string;
  remainingSessions?: number | null;
  usedMakeupCount?: number;
  maxMakeupAllowed?: number;
  status: 'PENDING' | 'PENDING_ACTIVATION' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'COMPLETED';
  createdAt?: string;
  updatedAt?: string;
  package?: ApiPackage;
  coach?: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
  };
  user?: {
    id: number;
    fullName: string;
    email: string;
    phone?: string | null;
  };
}

export interface ApiCheckIn {
  id: number;
  memberId: number;
  membershipId?: number | null;
  roomId?: number | null;
  staffId?: number | null;
  checkInTime: string;
  method: string;
  status: 'SUCCESS' | 'FAILED';
  rejectReason?: string | null;
  membership?: {
    package?: ApiPackage;
  };
  room?: {
    name: string;
  };
  staff?: {
    fullName: string;
  };
}

export interface ApiSessionExercise {
  id?: number;
  sessionResultId?: number;
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg?: number | null;
}

export interface ApiSessionResult {
  id: number;
  bookingId: number;
  notes?: string | null;
  calories?: number | null;
  durationMin?: number | null;
  exercises?: ApiSessionExercise[];
}

export interface ApiBooking {
  id: number;
  type: 'PT' | string;
  memberId: number;
  coachId: number;
  membershipId?: number | null;
  startTime: string;
  endTime: string;
  status: 'UPCOMING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ABSENT_ELIGIBLE' | 'ABSENT_NO_REFUND' | 'MAKEUP_BOOKED' | string;
  sessionQrToken?: string | null;
  absenceReason?: string | null;
  absenceReportedAt?: string | null;
  cancelledBy?: string | null;
  isMakeup?: boolean;
  makeupFromId?: number | null;
  member?: {
    id?: number;
    fullName: string;
    phone?: string | null;
    avatar?: string | null;
    email?: string | null;
  };
  coach?: {
    id?: number;
    fullName: string;
    phone?: string | null;
    avatar?: string | null;
    email?: string | null;
  };
  membership?: {
    id?: number;
    remainingSessions?: number | null;
    package?: {
      id?: number;
      name: string;
      type: string;
    };
  };
  sessionResult?: ApiSessionResult | null;
}

export interface ApiCoachSchedule {
  id?: number;
  coachProfileId?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
}

export interface ApiCoachProfile {
  id: number;
  userId: number;
  bio?: string | null;
  specialization?: string | null;
  hourlyRate: number;
  experience: number;
  rating?: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | string;
  createdAt?: string;
  user?: {
    fullName: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
  };
  schedules?: ApiCoachSchedule[];
}

export interface ApiCoachTrainee {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  memberships: Array<{
    id: number;
    startDate: string;
    endDate: string;
    remainingSessions?: number | null;
    package: {
      id: number;
      name: string;
      totalPtSessions?: number | null;
    };
  }>;
}

export interface ApiGroupClass {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  durationMin: number;
  createdAt?: string;
}

export interface ApiGroupClassSchedule {
  id: number;
  classId: number;
  trainerId: number;
  roomId?: number | null;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | string;
  groupClass: ApiGroupClass;
  trainer: {
    id: number;
    fullName: string;
    avatar?: string | null;
    phone?: string | null;
  };
  room?: {
    id: number;
    name: string;
  } | null;
}

export interface ApiGroupClassBooking {
  id: number;
  scheduleId: number;
  userId: number;
  status: 'BOOKED' | 'CHECKED_IN' | 'CANCELLED';
  createdAt?: string;
  schedule: ApiGroupClassSchedule;
}

export interface ApiProgressLog {
  id: number;
  memberId: number;
  weight: number;
  bodyFat?: number | null;
  muscleMass?: number | null;
  loggedAt: string;
}

export interface ApiEquipment {
  id: number;
  name: string;
  code: string;
  roomId: number;
  status: 'AVAILABLE' | 'MAINTENANCE' | 'BROKEN' | string;
  note?: string | null;
  createdAt?: string;
}

export interface ApiRoom {
  id: number;
  name: string;
  type: string;
  capacity: number;
  isActive: boolean;
  equipments?: ApiEquipment[];
}

export interface ApiSupportTicket {
  id: number;
  memberId: number;
  staffId?: number | null;
  subject: string;
  message: string;
  reply?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  createdAt: string;
  updatedAt: string;
  member?: {
    fullName: string;
    email: string;
  };
  staff?: {
    fullName: string;
  };
}

export interface ApiReview {
  id: number;
  memberId: number;
  coachProfileId: number;
  rating: number;
  comment?: string | null;
  createdAt: string;
  member?: {
    fullName: string;
    avatar?: string | null;
  };
}

export interface ApiMemberProfile360 {
  profile: ApiUser;
  membershipSubscriptions: any[];
  ptSubscriptions: any[];
  paymentHistory: any[];
  checkInHistory: any[];
  trainingHistory: {
    ptSessions: any[];
    groupClasses: any[];
  };
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}
