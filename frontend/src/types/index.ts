export type UserRole = 'admin' | 'staff' | 'coach' | 'member' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string;
}

export interface InBodyRecord {
  id: string;
  date: string;
  weightKg: number;
  muscleMassKg: number;
  bodyFatPercent: number;
  bmi: number;
  visceralFatLevel: number;
}

export interface Member {
  id: string;
  code: string; // e.g. "MEM-8891"
  name: string;
  phone: string;
  email: string;
  avatar: string;
  cccd: string;
  gender: 'male' | 'female' | 'other';
  birthYear: number;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  status: 'active' | 'expiring_soon' | 'expired' | 'frozen';
  activePackageId: string;
  packageName: string;
  packageType: 'standard_gym' | 'hybrid_pt' | 'specialized_course';
  packageStartDate: string;
  packageEndDate: string;
  daysRemaining: number;
  // Hybrid PT quota
  ptSessionsTotal: number;
  ptSessionsRemaining: number;
  assignedCoachId?: string;
  assignedCoachName?: string;
  // History & notes
  inBodyHistory: InBodyRecord[];
  notes?: string;
  healthConditions?: string[];
  fitnessGoals?: string[];
  totalCheckIns: number;
  lastCheckIn?: string;
}

export type CoachRank = 'junior' | 'senior' | 'master';

export interface Coach {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  rank: CoachRank;
  specialties: string[];
  hourlyRateVND: number; // Đơn giá riêng theo Coach (e.g. 250k, 400k, 650k)
  commissionPercent: number;
  rating: number;
  reviewCount: number;
  bio: string;
  certifications: string[];
  workingHours: {
    shift: string;
    start: string;
    end: string;
    daysOfWeek: number[]; // 1=Mon, 7=Sun
  };
  isAcceptingBookings: boolean;
  activeTraineeCount: number;
}

export interface PackagePlan {
  id: string;
  name: string;
  type: 'standard_gym' | 'hybrid_pt' | 'specialized_course';
  durationMonths: number;
  priceVND: number;
  unlimitedGymAccess: boolean;
  ptSessionsIncluded: number;
  trialPtSessions?: number;
  totalPtSessions?: number;
  description: string;
  features: string[];
  isActive?: boolean;
  isPopular?: boolean;
  // Specialized course properties
  courseDetails?: {
    totalSessions: number;
    coachId: string;
    coachName: string;
    startDate: string;
    endDate: string;
    maxStudents: number;
    enrolledStudents: number;
    scheduleDescription: string;
    locationRoom: string;
  };
}

export type SessionStatus = 
  | 'scheduled' 
  | 'in_progress' 
  | 'completed' 
  | 'absent_excused' 
  | 'absent_unexcused' 
  | 'cancelled';

export interface WorkoutLogEntry {
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg: number;
  notes?: string;
}

export interface BookingSession {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  memberAvatar: string;
  coachId: string;
  coachName: string;
  coachAvatar: string;
  type: 'pt_individual' | 'group_class' | 'specialized_course';
  title: string;
  room: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: SessionStatus;
  maxCapacity?: number;
  enrolledCount?: number;
  isMakeupSession?: boolean; // Buổi học bù
  pricePaidVND?: number;
  workoutLog?: {
    completedExercises: WorkoutLogEntry[];
    intensityRating: 1 | 2 | 3 | 4 | 5;
    coachFeedback: string;
    homeworkNote?: string;
  };
}

export interface CheckInRecord {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberAvatar: string;
  packageName: string;
  timestamp: string; // ISO
  status: 'approved' | 'rejected';
  reason?: string;
  staffName: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPriceVND: number;
  amountVND: number;
}

export interface Invoice {
  id: string;
  code: string; // "INV-2026-001"
  memberId: string;
  memberName: string;
  memberPhone: string;
  items: InvoiceItem[];
  subtotalVND: number;
  discountVND: number;
  totalVND: number;
  paymentMethod: 'cash_cod' | 'vietqr' | 'momo';
  status: 'paid' | 'pending';
  staffName: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketCode?: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  category: 'lost_found' | 'equipment' | 'coach_feedback' | 'freeze_request' | 'other';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  createdBy?: string;
  assignedStaff?: string;
  adminResponse?: string;
  actionRequiredBy?: 'staff' | 'coach' | 'admin' | 'technician';
  respondedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  details: string;
}

export interface NutritionTarget {
  memberId: string;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  waterLiters: number;
  coachNotes?: string;
  updatedAt: string;
}
