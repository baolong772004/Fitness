import { request } from './client';

export interface DeskDevice {
  id: number;
  deviceToken: string;
  deviceName: string;
  location?: string;
  isActive: boolean;
}

export interface StaffShift {
  shiftId: number;
  shiftCode: string;
  clockIn: string;
  clockOut?: string;
  systemCashAmount: number;
  actualCashAmount?: number;
  differenceAmount?: number;
  differenceReason?: string;
  status: string;
}

export interface StaffLoginResponse {
  success: boolean;
  message: string;
  data: {
    user: any;
    device: DeskDevice;
    shift: StaffShift;
    accessToken: string;
  };
}

export interface ScanQrCheckInResponse {
  success: boolean;
  status: 'SUCCESS' | 'EXPIRED' | 'ANTI_PASSBACK' | 'INVALID_QR' | 'BLOCKED' | 'NOT_FOUND' | 'SERVER_ERROR';
  color: 'GREEN' | 'RED';
  message: string;
  data: {
    checkInId?: number;
    member: {
      id: number;
      fullName: string;
      phone: string;
      avatar?: string;
      gender?: string;
    };
    membership?: {
      id: number;
      packageName: string;
      endDate: string;
      remainingDays: number;
    };
    expiredMembership?: {
      packageName: string;
      endDate: string;
    };
    ptSessionToday?: {
      hasPtToday: boolean;
      coachName: string;
      coachId: number;
      sessionTime: string;
      displayAlert: string;
    } | null;
    waitRemaining?: number;
    minutesAgo?: number;
    suggestion?: string;
  } | null;
}

export interface LookupMemberResponse {
  success: boolean;
  data: {
    member: {
      id: number;
      fullName: string;
      phone: string;
      email?: string;
      avatar?: string;
      gender?: string;
      dateOfBirth?: string;
      status: string;
    };
    hasActiveGymAccess: boolean;
    isFrozen?: boolean;
    frozenMembership?: {
      id: number;
      packageName: string;
      endDate: string;
      remainingDays: number;
      status?: string;
    } | null;
    activeMembership?: {
      id: number;
      packageName: string;
      endDate: string;
      remainingDays: number;
      status?: string;
    } | null;
  };
}

export interface WalkInCustomerInput {
  fullName: string;
  phone: string;
  email?: string;
  packageId: number;
  consultantStaffId?: number;
  paymentMethod: 'CASH' | 'POS';
  amountPaid?: number;
  traceRefNo?: string;
}

export interface PendingPaymentsResponse {
  success: boolean;
  data: {
    member: {
      id: number;
      fullName: string;
      phone: string;
      email?: string;
    };
    pendingPayments: Array<{
      id: number;
      amount: number;
      method: string;
      createdAt: string;
      membership?: {
        id: number;
        packageName: string;
        durationDays: number;
        type: string;
      } | null;
    }>;
  };
}

export interface OfflinePaymentInput {
  paymentId: number;
  paymentMethod: 'CASH' | 'POS';
  cashReceived?: number;
  traceRefNo?: string;
}

export interface FreezeMembershipInput {
  membershipId: number;
  freezeDays: number;
  reason: string;
}

export interface EquipmentItem {
  id: number;
  name: string;
  code: string;
  roomId: number;
  status: 'AVAILABLE' | 'UNDER_MAINTENANCE' | 'MAINTENANCE';
  note?: string;
  room: {
    id: number;
    name: string;
    type: string;
  };
}

export interface OperationalNoteInput {
  category: 'HYGIENE' | 'EQUIPMENT' | 'SERVICE' | 'FACILITY' | 'OTHER';
  content: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  memberId?: number;
  memberName?: string;
  memberPhone?: string;
}

export interface OperationalNoteItem {
  id: number;
  staffId: number;
  shiftId?: number;
  memberId?: number;
  memberName?: string;
  memberPhone?: string;
  category: string;
  content: string;
  priority: string;
  status: string;
  createdAt: string;
  staff: {
    id: number;
    fullName: string;
  };
}

export interface ShiftSummaryData {
  shiftId: number;
  shiftCode: string;
  clockIn: string;
  deviceName: string;
  systemCashAmount: number;
  totalPosAmount: number;
  totalRevenue: number;
  stats: {
    totalCheckIns: number;
    totalPayments: number;
    totalOperationalNotes: number;
  };
  payments: Array<{
    id: number;
    amount: number;
    method: string;
    status: string;
    customerName: string;
    customerPhone?: string;
    createdAt: string;
  }>;
  checkIns?: Array<{
    id: number;
    name: string;
    packageName: string;
    time: string;
    status: string;
    color: string;
    method?: string;
  }>;
}

export interface CloseShiftInput {
  actualCashAmount: number;
  differenceReason?: string;
}

export const staffApi = {
  // GIAI ĐOẠN 1: ĐĂNG NHẬP & TỰ ĐỘNG CHẤM CÔNG (Clock-in)
  login: (data: { email: string; password: string; deviceToken: string }) =>
    request<StaffLoginResponse>('/staff/login', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getDevices: () =>
    request<{ success: boolean; data: DeskDevice[] }>('/staff/devices'),

  registerDevice: (data: { deviceToken: string; deviceName: string; location?: string }) =>
    request<{ success: boolean; data: DeskDevice }>('/staff/devices', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // GIAI ĐOẠN 2: SOÁT VÉ VÀO CỔNG (Venue Check-in)
  scanQrCheckIn: (qrToken: string) =>
    request<ScanQrCheckInResponse>('/staff/checkin/scan-qr', {
      method: 'POST',
      body: JSON.stringify({ qrToken })
    }),

  lookupMember: (phone: string) =>
    request<LookupMemberResponse>(`/staff/checkin/lookup-member?phone=${encodeURIComponent(phone)}`),

  manualCheckIn: (data: { memberId: number; notes?: string }) =>
    request<{ success: boolean; message: string; data: any }>('/staff/checkin/manual', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // GIAI ĐOẠN 3: HỖ TRỢ THANH TOÁN TẠI QUẦY (Offline POS Fallback)
  createMemberAccount: (data: { fullName: string; phone: string; email?: string }) =>
    request<{ success: boolean; message: string; data: { member: { id: number; fullName: string; phone: string; email: string }; account: { created: boolean; loginEmail: string; temporaryPassword: string; mustChangePassword: boolean } } }>('/staff/members', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  walkInRegistration: (data: WalkInCustomerInput) =>
    request<{ success: boolean; message: string; data: any }>('/staff/pos/walk-in', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getPendingPayments: (phone: string) =>
    request<PendingPaymentsResponse>(`/staff/pos/pending-payments?phone=${encodeURIComponent(phone)}`),

  processOfflinePayment: (data: OfflinePaymentInput) =>
    request<{ success: boolean; message: string; data: any }>('/staff/pos/pay', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  freezeMembership: (data: FreezeMembershipInput) =>
    request<{ success: boolean; message: string; data: any }>('/staff/pos/freeze', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  unfreezeMembership: (data: { membershipId: number; notes?: string }) =>
    request<{ success: boolean; message: string; data: any }>('/staff/pos/unfreeze', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU
  getEquipment: (roomId?: number) =>
    request<{ success: boolean; data: EquipmentItem[] }>(
      roomId ? `/staff/equipment?roomId=${roomId}` : '/staff/equipment'
    ),

  updateEquipmentStatus: (id: number, data: { status: 'AVAILABLE' | 'UNDER_MAINTENANCE'; note?: string }) =>
    request<{ success: boolean; message: string; data: EquipmentItem }>(`/staff/equipment/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  createOperationalNote: (data: OperationalNoteInput) =>
    request<{ success: boolean; message: string; data: OperationalNoteItem }>('/staff/support-notes', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getOperationalNotes: (status?: string) =>
    request<{ success: boolean; data: { items: OperationalNoteItem[]; pagination: any } }>(
      status ? `/staff/support-notes?status=${status}` : '/staff/support-notes'
    ),

  // GIAI ĐOẠN 5: CHỐT CA & TỰ ĐỘNG CHẤM CÔNG RA (Clock-out)
  getCurrentShift: () =>
    request<{ success: boolean; data: ShiftSummaryData }>('/staff/shift/current'),

  closeShift: (data: CloseShiftInput) =>
    request<{ success: boolean; message: string; data: any }>('/staff/shift/close', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};
