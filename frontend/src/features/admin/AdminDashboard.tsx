import React, { useState, useEffect, useRef } from 'react';
import { Member, Coach, PackagePlan, AuditLog, Invoice, SupportTicket } from '../../types';
import { api, ApiPackage, ApiUser, ApiCoachProfile, ApiCoachDeactivationCheck, ApiSubscription, ApiRoom, ApiEquipment, ApiGroupClass, ApiGroupClassSchedule, ApiMemberProfile360, ApiAdminAnalytics } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import { toast } from '@/components/common/ToastNotification';
import {
  BarChart3,
  Users,
  Dumbbell,
  Layers,
  ShieldAlert,
  TrendingUp,
  Calendar,
  Coins,
  Edit3,
  Trash2,
  Plus,
  Search,
  Check,
  AlertCircle,
  Eye,
  FileSpreadsheet,
  Lock,
  ArrowUpRight,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  LifeBuoy,
  UserCheck,
  Wrench,
  AlertTriangle,
  CornerDownRight,
  Filter,
  Activity,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { StaffPage, Field } from '@/components/staff/StaffKit';
import { PtMasterCalendar } from './PtMasterCalendar';
import { PtCreditAdmin } from './PtCreditAdmin';

const ptLevels = ['TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const memberDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const isMemberAccountLocked = (status?: string | null) =>
  ['BANNED', 'SUSPENDED', 'INACTIVE', 'BLOCKED'].includes(String(status || '').trim().toUpperCase());
const isMemberAccountPending = (status?: string | null) =>
  String(status || '').trim().toUpperCase() === 'PENDING';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  MEMBER_LOCKED: 'Khóa hội viên',
  MEMBER_UNLOCKED: 'Mở khóa hội viên',
  USER_ACCOUNT_LOCKED: 'Khóa tài khoản',
  USER_ACCOUNT_ACTIVATED: 'Mở khóa tài khoản',
  USER_STATUS_UPDATED: 'Đổi trạng thái TK',
  STAFF_CLOCK_IN: 'Mở ca lễ tân',
  STAFF_CLOCK_OUT: 'Đóng ca lễ tân',
  GYM_CALENDAR_UPDATE: 'Đổi lịch phòng tập',
  COACH_WEEKLY_AVAILABILITY: 'Lịch tuần HLV',
  COACH_DATE_AVAILABILITY: 'Lịch ngày HLV',
  COACH_DATE_RESET: 'Đặt lại lịch ngày HLV',
  COACH_SPECIALIZATION_UPDATE: 'Đổi cấp độ HLV',
  COACH_PRICING_UPDATE: 'Cập nhật giá & hoa hồng HLV',
  COACH_STATUS_UPDATE: 'Đổi trạng thái HLV',
  GROUP_CLASS_TRAINER_REASSIGN: 'Đổi HLV lớp nhóm',
  GROUP_CLASS_CANCELLED: 'Hủy ca lớp nhóm',
  MEMBERSHIP_FREEZE_BY_STAFF: 'Bảo lưu gói tập',
  MEMBERSHIP_UNFREEZE_BY_STAFF: 'Mở lại gói bảo lưu',
  EQUIPMENT_STATUS_UPDATE: 'Cập nhật thiết bị',
  FACILITY_EQUIPMENT_CREATE: 'Thêm thiết bị',
  FACILITY_EQUIPMENT_UPDATE: 'Cập nhật thiết bị',
  FACILITY_EQUIPMENT_DELETE: 'Xóa thiết bị',
  FACILITY_ROOM_CREATE: 'Tạo phòng tập',
  FACILITY_ROOM_UPDATE: 'Cập nhật phòng tập',
  WALK_IN_REGISTRATION: 'Đăng ký Walk-in',
  OFFLINE_PAYMENT_PROCESSED: 'Thu tiền tại quầy',
  STAFF_CREATE_MEMBER_ACCOUNT: 'Tạo TK hội viên',
  PT_MANUAL_CHECKIN: 'Check-in PT thủ công',
};

const formatAuditDisplay = (log: AuditLog) => {
  const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action;
  let target = log.target;
  let details = log.details || '';

  // Dự phòng format gọn nếu server chưa restart và trả về JSON thô hoặc key model (membershipId, coachId...)
  if (details.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(details);
      if (log.action === 'GYM_CALENDAR_UPDATE' && (parsed.before || parsed.after)) {
        const b = parsed.before || {};
        const a = parsed.after || {};
        const diffs: string[] = [];
        if (b.openTime !== a.openTime || b.closeTime !== a.closeTime) {
          diffs.push(`Giờ mở cửa: ${b.openTime ?? '?'}–${b.closeTime ?? '?'} → ${a.openTime ?? '?'}–${a.closeTime ?? '?'}`);
        }
        if (b.slotMinutes !== a.slotMinutes) diffs.push(`Thời lượng ca: ${b.slotMinutes ?? '?'}p → ${a.slotMinutes ?? '?'}p`);
        if (b.breakMinutes !== a.breakMinutes) diffs.push(`Nghỉ giữa ca: ${b.breakMinutes ?? '?'}p → ${a.breakMinutes ?? '?'}p`);
        target = 'Lịch hoạt động Gym';
        details = diffs.join(' • ') || `Mở ${a.openTime || '06:00'}–${a.closeTime || '22:00'}`;
      } else if (log.action === 'COACH_WEEKLY_AVAILABILITY' && (parsed.before !== undefined || parsed.after !== undefined)) {
        target = 'Lịch rảnh tuần HLV';
        details = `Số ca rảnh/tuần: ${Array.isArray(parsed.before) ? parsed.before.length : 0} → ${Array.isArray(parsed.after) ? parsed.after.length : 0} ca`;
      } else if (parsed.after?.date || parsed.before?.date) {
        const dStr = parsed.after?.date || parsed.before?.date;
        target = `Lịch HLV ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`;
        const shifts = Array.isArray(parsed.after?.shifts) ? parsed.after.shifts : [];
        details = shifts.length > 0 ? `${shifts.length} ca (${shifts[0].startTime}–${shifts[shifts.length - 1].endTime})` : 'Đặt lại ca trong ngày';
      } else if (log.action === 'MEMBERSHIP_FREEZE_BY_STAFF') {
        target = parsed.userId ? `HV #${parsed.userId}` : target;
        const parts: string[] = [];
        if (parsed.freezeDays !== undefined) parts.push(`Bảo lưu ${parsed.freezeDays} ngày`);
        if (parsed.projectedEndDate) parts.push(`Hạn mới: ${memberDate(parsed.projectedEndDate)}`);
        if (parsed.reason) parts.push(`Lý do: ${parsed.reason}`);
        details = parts.join(' • ') || 'Tạm bảo lưu gói tập';
      } else if (log.action === 'MEMBERSHIP_UNFREEZE_BY_STAFF') {
        target = parsed.membershipId ? `Gói #${parsed.membershipId}` : target;
        const parts: string[] = [];
        if (parsed.unusedDaysRecovered !== undefined) parts.push(`Hoàn ${parsed.unusedDaysRecovered} ngày`);
        if (parsed.adjustedEndDate) parts.push(`Hạn mới: ${memberDate(parsed.adjustedEndDate)}`);
        if (parsed.notes) parts.push(String(parsed.notes));
        details = parts.join(' • ') || 'Mở lại gói bảo lưu';
      } else if (log.action === 'COACH_SPECIALIZATION_UPDATE' && Array.isArray(parsed.levels)) {
        target = parsed.coachId ? `HLV #${parsed.coachId}` : target;
        details = `Cấp độ PT: ${parsed.levels.join(', ')}`;
      }
    } catch {
      // ignore
    }
  } else if (/(?:^|\b)(?:type|membershipId|actualFrozenDays|unusedDaysRecovered|coachId|userId):/i.test(details)) {
    // Chuyển fallback "key: value • ..." từ server cũ sang ngôn ngữ tự nhiên
    if (log.action === 'MEMBERSHIP_UNFREEZE_BY_STAFF') {
      const recovered = details.match(/unusedDaysRecovered:\s*(\d+)/)?.[1];
      const adjusted = details.match(/adjustedEndDate:\s*([^\s•]+)/)?.[1];
      const mId = details.match(/membershipId:\s*(\d+)/)?.[1];
      if (mId && target === 'Hệ thống') target = `Gói #${mId}`;
      const parts: string[] = [];
      if (recovered !== undefined) parts.push(`Hoàn ${recovered} ngày`);
      if (adjusted) parts.push(`Hạn mới: ${memberDate(adjusted)}`);
      if (parts.length > 0) details = parts.join(' • ');
    } else if (log.action === 'COACH_SPECIALIZATION_UPDATE') {
      const cId = details.match(/coachId:\s*(\d+)/)?.[1];
      if (cId && target === 'Hệ thống') target = `HLV #${cId}`;
      details = 'Cập nhật cấp độ giảng dạy PT';
    }
  }

  const formattedDetails = details
    .replace(/\s*•\s*/g, '\n')
    .trim();

  return { actionLabel, target, details: formattedDetails };
};

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab,
  onTabChange
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [packages, setPackages] = useState<PackagePlan[]>([]);
  const [ptProducts, setPtProducts] = useState<Awaited<ReturnType<typeof api.adminTrainers.getPtProducts>>>([]);
  const [packageStatusFilter, setPackageStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [packageLoadError, setPackageLoadError] = useState<string | null>(null);
  const [ptProductLoadError, setPtProductLoadError] = useState<string | null>(null);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [isLoadingPtProducts, setIsLoadingPtProducts] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [analyticsData, setAnalyticsData] = useState<ApiAdminAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'checkins'>('revenue');

  // Member 360 Modal State (Luồng 8)
  const [inspectingMember, setInspectingMember] = useState<Member | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(5);

  // Coach Price Editing Modal State (Luồng 9)
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [newHourlyRate, setNewHourlyRate] = useState<number | ''>(400000);
  const [newCommission, setNewCommission] = useState<number | ''>(50);
  const [newRank, setNewRank] = useState<'junior' | 'senior' | 'master'>('senior');
  const [newPtLevels, setNewPtLevels] = useState<string[]>([]);
  const [savingCoachConfig, setSavingCoachConfig] = useState(false);
  const [coachFormError, setCoachFormError] = useState('');

  // Coach Deactivation Check Modal State
  const [deactivatingCoach, setDeactivatingCoach] = useState<Coach | null>(null);
  const [deactivationCheck, setDeactivationCheck] = useState<ApiCoachDeactivationCheck | null>(null);
  const [deactivationLoading, setDeactivationLoading] = useState(false);
  const [deactivationSubmitting, setDeactivationSubmitting] = useState(false);
  const [deactivationError, setDeactivationError] = useState('');
  const [forceDeactivateCoach, setForceDeactivateCoach] = useState(false);
  const [groupClassActionLoadingId, setGroupClassActionLoadingId] = useState<number | null>(null);
  const [reassignTrainerBySchedule, setReassignTrainerBySchedule] = useState<Record<number, number>>({});
  const [editingScheduleForReassign, setEditingScheduleForReassign] = useState<ApiGroupClassSchedule | null>(null);
  const [nextScheduleTrainerId, setNextScheduleTrainerId] = useState<number>(0);

  // Incident & Support Ticket Management State
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [respondingTicket, setRespondingTicket] = useState<SupportTicket | null>(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [targetAssignee, setTargetAssignee] = useState<'staff' | 'coach' | 'admin' | 'technician'>('staff');
  const [targetStatus, setTargetStatus] = useState<'in_progress' | 'resolved'>('in_progress');

  // New Package Modal
  const [isCreatingPackage, setIsCreatingPackage] = useState(false);
  const [isPtCreditOpen, setIsPtCreditOpen] = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);
  const [newPackageForm, setNewPackageForm] = useState({
    name: '',
    type: 'MEMBERSHIP' as 'MEMBERSHIP' | 'PT',
    durationDays: 30,
    price: 1500000,
    trialPtSessions: 2,
    totalPtSessions: 0,
    description: 'Gói tập chất lượng cao toàn bộ hệ thống AURA Fitness.'
  });

  // Facility & Equipment State
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [roomForm, setRoomForm] = useState({ name: '', type: 'FITNESS', capacity: 30, isActive: true });
  const [isCreatingEquipment, setIsCreatingEquipment] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState<number | null>(null);
  const [equipmentForm, setEquipmentForm] = useState({ name: '', code: '', roomId: 0, status: 'AVAILABLE', note: '' });

  // Group Classes & Schedules State
  const [groupClasses, setGroupClasses] = useState<ApiGroupClass[]>([]);
  const [groupClassSchedules, setGroupClassSchedules] = useState<ApiGroupClassSchedule[]>([]);
  const [isLoadingGroupClasses, setIsLoadingGroupClasses] = useState(false);
  const [groupClassError, setGroupClassError] = useState<string | null>(null);
  const [groupClassTrainers, setGroupClassTrainers] = useState<ApiCoachProfile[]>([]);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', description: '', durationMin: 60, imageUrl: '' });
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<{
    classId: number;
    trainerId: number;
    roomId: number;
    startTime: string;
    capacity: number;
    repeatMode: 'SINGLE' | 'DAILY' | 'WEEKLY';
    repeatCount: number;
    repeatDays: number[];
  }>({
    classId: 0,
    trainerId: 1,
    roomId: 0,
    startTime: '',
    capacity: 20,
    repeatMode: 'SINGLE',
    repeatCount: 1,
    repeatDays: [],
  });

  const VIETNAM_OFFSET_MS = 7 * 3600000;
  const DAY_MS = 24 * 3600000;
  const VN_WEEKDAY_LABELS: Array<{ day: number; label: string }> = [
    { day: 1, label: 'T2' },
    { day: 2, label: 'T3' },
    { day: 3, label: 'T4' },
    { day: 4, label: 'T5' },
    { day: 5, label: 'T6' },
    { day: 6, label: 'T7' },
    { day: 7, label: 'CN' },
  ];
  const toGymDateTimeLocal = (date: Date) =>
    new Date(date.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 16);
  const parseGymDateTimeLocal = (value: string) => {
    if (!value) return new Date(NaN);
    const normalized = value.length === 16 ? `${value}:00` : value;
    return new Date(`${normalized}+07:00`);
  };
  const getGymIsoWeekday = (date: Date) =>
    new Date(date.getTime() + VIETNAM_OFFSET_MS).getUTCDay() || 7;
  const getDefaultScheduleStartLocal = () => {
    const vnNow = new Date(Date.now() + VIETNAM_OFFSET_MS);
    const nextHour = vnNow.getUTCHours() + 1;
    if (nextHour >= 6 && nextHour <= 20) {
      vnNow.setUTCHours(nextHour, 0, 0, 0);
      return vnNow.toISOString().slice(0, 16);
    }
    const base = new Date(Date.now() + VIETNAM_OFFSET_MS);
    if (nextHour > 20) {
      base.setUTCDate(base.getUTCDate() + 1);
    }
    base.setUTCHours(9, 0, 0, 0);
    return base.toISOString().slice(0, 16);
  };
  const computeScheduleEndLocal = (startLocal: string, durationMin: number) => {
    const start = parseGymDateTimeLocal(startLocal);
    if (Number.isNaN(start.getTime())) return '';
    return toGymDateTimeLocal(new Date(start.getTime() + durationMin * 60_000));
  };
  const buildSchedulePreviewSlots = (
    startLocal: string,
    durationMin: number,
    repeatMode: 'SINGLE' | 'DAILY' | 'WEEKLY',
    repeatCount: number,
    repeatDays: number[],
  ) => {
    const firstStart = parseGymDateTimeLocal(startLocal);
    if (Number.isNaN(firstStart.getTime())) return [] as Array<{ start: Date; end: Date }>;
    const durationMs = durationMin * 60_000;
    const count = repeatMode === 'SINGLE' ? 1 : Math.min(30, Math.max(1, Number(repeatCount) || 1));
    if (repeatMode === 'SINGLE' || count === 1) {
      return [{ start: firstStart, end: new Date(firstStart.getTime() + durationMs) }];
    }
    if (repeatMode === 'DAILY') {
      return Array.from({ length: count }, (_, idx) => {
        const start = new Date(firstStart.getTime() + idx * DAY_MS);
        return { start, end: new Date(start.getTime() + durationMs) };
      });
    }
    const firstWeekday = getGymIsoWeekday(firstStart);
    const daySet = new Set(repeatDays.length > 0 ? [...repeatDays, firstWeekday] : [firstWeekday]);
    const slots: Array<{ start: Date; end: Date }> = [];
    for (let offset = 0; slots.length < count && offset < 366; offset++) {
      const start = new Date(firstStart.getTime() + offset * DAY_MS);
      if (daySet.has(getGymIsoWeekday(start))) {
        slots.push({ start, end: new Date(start.getTime() + durationMs) });
      }
    }
    return slots;
  };

  // Package Edit State
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [editPackageForm, setEditPackageForm] = useState({
    name: '',
    type: 'MEMBERSHIP' as 'MEMBERSHIP' | 'PT',
    durationDays: 30,
    price: 1500000,
    trialPtSessions: 2,
    totalPtSessions: 0,
    description: '',
    isActive: true
  });

  // Member 360 Full Profile State
  const [inspectingMember360, setInspectingMember360] = useState<ApiMemberProfile360 | null>(null);
  const [isLoadingMember360, setIsLoadingMember360] = useState(false);
  const [memberProfileError, setMemberProfileError] = useState('');
  const memberProfileRequestId = useRef(0);
  const [correctingNoShowId, setCorrectingNoShowId] = useState<number | null>(null);
  const [confirmToggleMember, setConfirmToggleMember] = useState<Member | null>(null);
  const [isTogglingMemberStatus, setIsTogglingMemberStatus] = useState(false);

  const loadPackages = async () => {
    setIsLoadingPackages(true);
    setPackageLoadError(null);
    try {
      const livePkgs = await api.packages.getPackages({ includeInactive: true });
      if (Array.isArray(livePkgs)) {
        const mappedPkgs: PackagePlan[] = livePkgs.map(p => ({
          id: String(p.id),
          name: p.name,
          type: p.type === 'PT' ? 'hybrid_pt' : 'standard_gym',
          durationMonths: Math.max(1, Math.round(p.durationDays / 30)),
          priceVND: Number(p.price),
          unlimitedGymAccess: p.type === 'MEMBERSHIP',
          ptSessionsIncluded: p.type === 'PT' ? (p.totalPtSessions || 0) : (p.trialPtSessions || 0),
          trialPtSessions: p.trialPtSessions || 0,
          totalPtSessions: p.totalPtSessions || 0,
          description: p.description || '',
          isActive: p.isActive,
          features: p.type === 'PT'
            ? [`${p.totalPtSessions || 0} buổi PT 1:1`, `${p.durationDays} ngày hiệu lực`]
            : ['Ra vào phòng tập 24/7', `${p.durationDays} ngày hiệu lực`, `${p.trialPtSessions || 0} buổi PT tặng kèm`]
        }));
        setPackages(mappedPkgs);
      } else {
        throw new Error('API trả về danh sách gói không hợp lệ.');
      }
    } catch (e: any) {
      console.warn('Lỗi tải gói tập admin:', e);
      setPackageLoadError(e?.message || 'Không thể tải gói tập từ máy chủ.');
    } finally {
      setIsLoadingPackages(false);
    }
  };

  const loadPtProducts = async () => {
    setIsLoadingPtProducts(true);
    setPtProductLoadError(null);
    try {
      setPtProducts(await api.adminTrainers.getPtProducts());
    } catch (error) {
      setPtProductLoadError(error instanceof Error ? error.message : 'Không tải được gói PT.');
    } finally {
      setIsLoadingPtProducts(false);
    }
  };

  const loadAuditLogs = async (searchValue?: string) => {
    setIsLoadingAuditLogs(true);
    setAuditLogError(null);
    try {
      const term = searchValue !== undefined ? searchValue : auditSearchQuery;
      const logs = await api.admin.getAuditLogs({
        limit: 80,
        search: term.trim() || undefined,
      });
      setAuditLogs((logs || []) as AuditLog[]);
    } catch (e: any) {
      setAuditLogError(e?.message || 'Không tải được nhật ký kiểm toán.');
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const reloadData = async () => {
    setIsLoadingGroupClasses(true);
    setGroupClassError(null);
    // 1. Fetch live Gym packages and PT products from backend
    await Promise.all([loadPackages(), loadPtProducts()]);

    // 2. Fetch live Members from backend
    try {
      const membersRes = await api.admin.getMembersList({ limit: 200 });
      if (membersRes.data) {
        const mappedMembers: Member[] = membersRes.data.map(u => ({
          id: String(u.id),
          code: 'MEM-' + u.id,
          name: u.fullName || u.email,
          phone: u.phone || '',
          email: u.email,
          avatar: u.avatar || '',
          cccd: '',
          gender: u.gender === 'male' || u.gender === 'female' ? u.gender : 'other',
          birthYear: u.dateOfBirth ? new Date(u.dateOfBirth).getFullYear() : 0,
          emergencyContact: { name: '', phone: '', relationship: '' },
          status: u.status === 'ACTIVE' ? 'active' : 'expired',
          accountStatus: u.status,
          activePackageId: String(u.currentGymMembership?.id ?? ''),
          packageName: u.currentGymMembership?.package?.name || 'Chưa có gói Gym',
          packageType: 'standard_gym',
          packageStartDate: u.currentGymMembership ? memberDate(u.currentGymMembership.startDate) : '',
          packageEndDate: u.currentGymMembership ? memberDate(u.currentGymMembership.endDate) : '—',
          daysRemaining: u.currentGymMembership ? Math.max(0, Math.ceil((new Date(u.currentGymMembership.endDate).getTime() - Date.now()) / 86400000)) : 0,
          ptSessionsTotal: u.ptCredit.total,
          ptSessionsRemaining: u.ptCredit.available,
          legacyPtSessions: u.legacyPtSessions,
          assignedCoachName: u.currentCoachName || undefined,
          totalCheckIns: u.checkInCount,
          inBodyHistory: []
        }));
        setMembers(mappedMembers);
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách member admin:', e);
    }

    // 3. Fetch live Coaches from backend
    try {
      const liveTrainers = await api.adminTrainers.getTrainers({ limit: 50 });
      if (liveTrainers.data) {
        setGroupClassTrainers(liveTrainers.data);
        const mappedCoaches: Coach[] = liveTrainers.data.map((t) => ({
          id: String(t.id),
          code: `COACH-${t.id}`,
          name: t.user?.fullName || `Coach #${t.id}`,
          email: t.user?.email || `coach${t.id}@aurafitness.vn`,
          phone: t.user?.phone || '0901234567',
          avatar: t.user?.avatar || 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&auto=format&fit=crop&q=80',
          rank: t.rank,
          specialties: t.specialization ? t.specialization.split(',').map(s => s.trim()) : ['Gym & PT'],
          ptLevels: t.specializations?.map(item => item.level) ?? [],
          rating: t.rating || 5.0,
          reviewCount: 24,
          bio: t.bio || 'Huấn luyện viên chuyên nghiệp AURA Fitness',
          certifications: ['NASM-CPT', 'CSCS Specialist'],
          hourlyRateVND: Number(t.hourlyRate),
          commissionPercent: t.commissionPercent,
          workingHours: { shift: 'Toàn thời gian', start: '07:00', end: '21:00', daysOfWeek: [1, 2, 3, 4, 5, 6] },
          isAcceptingBookings: t.status === 'ACTIVE' && (!t.user?.status || t.user.status === 'ACTIVE'),
          userAccountStatus: t.user?.status,
          activeTraineeCount: 8
        }));
        setCoaches(mappedCoaches);
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách HLV admin:', e);
    }

    // 4. Fetch Live Payments & Analytics from backend
    try {
      const analyticsRes = await api.admin.getAnalytics(timeFilter);
      if (analyticsRes) {
        setAnalyticsData(analyticsRes);
        if (Array.isArray(analyticsRes.recentPayments) && analyticsRes.recentPayments.length > 0) {
          setInvoices(analyticsRes.recentPayments as Invoice[]);
        }
      }
    } catch (e) {
      console.warn('Lỗi tải thống kê analytics admin:', e);
    }

    // 5. Fetch Support Tickets from backend
    try {
      const ticketsRes = await api.support.getTickets();
      if (Array.isArray(ticketsRes)) {
        const mappedTickets: SupportTicket[] = ticketsRes.map((t) => ({
          id: String(t.id),
          ticketCode: `TCK-${t.id}`,
          memberId: String(t.memberId),
          memberName: t.member?.fullName || `Hội viên #${t.memberId}`,
          memberPhone: '0900000000',
          category: 'other',
          title: t.subject,
          description: t.message,
          status: t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'resolved' : 'open',
          priority: 'medium',
          createdAt: t.createdAt,
          createdBy: t.member?.fullName || 'Hội viên'
        }));
        setTickets(mappedTickets);
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách tickets admin:', e);
    }

    // 6. Fetch Rooms & Equipments
    try {
      const liveRooms = await api.facility.getRooms();
      if (liveRooms) setRooms(liveRooms);
    } catch (e) {
      console.warn('Lỗi tải cơ sở vật chất admin:', e);
    }

    // 7. Fetch Group Classes & Schedules
    try {
      setIsLoadingGroupClasses(true);
      const [liveClasses, liveSchedules] = await Promise.all([
        api.groupClasses.getAdminClasses().catch((err) => {
          console.warn('Lỗi tải danh mục lớp học admin:', err);
          return [];
        }),
        api.groupClasses.getAllSchedules().catch((err) => {
          console.warn('Lỗi tải lịch lớp học nhóm admin:', err);
          return [];
        }),
      ]);
      setGroupClasses(liveClasses || []);
      setGroupClassSchedules(liveSchedules || []);
    } catch (e: any) {
      console.warn('Lỗi tải lịch lớp học nhóm admin:', e);
      setGroupClassError(e.message || 'Không tải được lịch lớp học nhóm');
    } finally {
      setIsLoadingGroupClasses(false);
    }

    await loadAuditLogs();
  };

  useEffect(() => {
    reloadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'packages-engine') {
      void loadPackages();
      void loadPtProducts();
    }
    if (activeTab === 'group-classes') {
      void reloadData();
    }
    if (activeTab === 'audit-rbac') {
      void loadAuditLogs();
    }
  }, [activeTab]);

  // Global Time Range Filter State
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | 'month' | 'quarter' | 'year'>('month');

  // Load analytics when timeFilter changes
  const loadAnalytics = async (filter: string) => {
    setIsLoadingAnalytics(true);
    try {
      const data = await api.admin.getAnalytics(filter);
      if (data) {
        setAnalyticsData(data);
        if (Array.isArray(data.recentPayments) && data.recentPayments.length > 0) {
          setInvoices(data.recentPayments as Invoice[]);
        }
      }
    } catch (e) {
      console.warn('Lỗi tải thống kê analytics admin:', e);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    void loadAnalytics(timeFilter);
  }, [timeFilter]);

  // Total Revenue Calculation from live payments
  const totalRevenue = analyticsData ? analyticsData.revenue : invoices.reduce((sum, inv) => sum + inv.totalVND, 0);

  // Dynamic metrics & trend series based on timeFilter and real API data
  const timeFilteredData = React.useMemo(() => {
    if (analyticsData) {
      return {
        label: analyticsData.label,
        subLabel: analyticsData.subLabel,
        revenue: analyticsData.revenue,
        growth: analyticsData.growth,
        membersCount: analyticsData.totalMembers,
        activeCheckIns: analyticsData.activeCheckIns,
        chartData: analyticsData.chartData && analyticsData.chartData.length > 0
          ? analyticsData.chartData
          : [
            { label: '06:00', rev: 0, checkins: 0 },
            { label: '12:00', rev: 0, checkins: 0 },
            { label: '18:00', rev: 0, checkins: 0 },
          ],
      };
    }

    return {
      label: timeFilter === 'today' ? 'Hôm Nay' : timeFilter === '7days' ? '7 Ngày Qua' : timeFilter === 'quarter' ? 'Quý Này' : timeFilter === 'year' ? 'Năm Nay' : 'Tháng Này',
      subLabel: 'Đang tải dữ liệu thời gian thực...',
      revenue: 0,
      growth: '+0.0%',
      membersCount: members.length,
      activeCheckIns: 0,
      chartData: [
        { label: 'Bắt đầu', rev: 0, checkins: 0 },
        { label: 'Hiện tại', rev: 0, checkins: 0 },
      ]
    };
  }, [analyticsData, timeFilter, members.length]);

  // Filtered & paginated members for Member 360
  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    m.phone.includes(memberSearchQuery) ||
    m.code.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );
  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / memberPageSize));
  const safeMemberPage = Math.min(memberPage, totalMemberPages);
  const paginatedMembers = filteredMembers.slice(
    (safeMemberPage - 1) * memberPageSize,
    safeMemberPage * memberPageSize
  );

  // Handle Save Coach Pricing (Luồng 9)
  const handleSaveCoachPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoach) return;

    const rateValue = Number(newHourlyRate);
    const commissionValue = Number(newCommission);
    if (newHourlyRate === '' || !Number.isFinite(rateValue) || rateValue < 0) {
      setCoachFormError('Đơn giá buổi dạy phải là số không âm.');
      return;
    }
    if (newCommission === '' || !Number.isInteger(commissionValue) || commissionValue < 0 || commissionValue > 100) {
      setCoachFormError('Tỷ lệ hoa hồng phải là số nguyên từ 0% đến 100%.');
      return;
    }

    setSavingCoachConfig(true);
    setCoachFormError('');
    try {
      await api.adminTrainers.updateTrainerPricing(editingCoach.id, {
        hourlyRate: rateValue,
        commissionPercent: commissionValue,
        rank: newRank,
        levels: newPtLevels,
      });
      soundEffects.playSuccessBeep();
      toast.success(`Đã lưu cấu hình HLV ${editingCoach.name}.`, 'Cập Nhật HLV');
      setEditingCoach(null);
      await reloadData();
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setCoachFormError(err.message || 'Không thể lưu cấu hình HLV.');
    } finally {
      setSavingCoachConfig(false);
    }
  };

  // Handle Create Package via Live Backend REST API
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setPackageLoading(true);
    try {
      await api.packages.createPackage({
        name: newPackageForm.name,
        type: newPackageForm.type,
        durationDays: newPackageForm.durationDays,
        price: newPackageForm.price,
        trialPtSessions: newPackageForm.type === 'PT' ? 0 : newPackageForm.trialPtSessions,
        totalPtSessions: newPackageForm.type === 'PT' ? newPackageForm.totalPtSessions : undefined,
        description: newPackageForm.description
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingPackage(false);
      alert(`Đã tạo thành công gói tập "${newPackageForm.name}" lên cơ sở dữ liệu!`);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi khi tạo gói tập: ${err.message}`);
    } finally {
      setPackageLoading(false);
    }
  };

  // Handle Delete Package via Live Backend REST API
  const handleTogglePackageStatus = async (pkg: PackagePlan) => {
    const currentlyActive = pkg.isActive !== false;
    const confirmation = currentlyActive
      ? `Ngừng bán gói "${pkg.name}"? Gói sẽ không còn xuất hiện để mua mới; thông tin và lịch sử sử dụng vẫn được giữ.`
      : `Bật bán lại gói "${pkg.name}"? Hội viên sẽ có thể mua gói này.`;
    if (!window.confirm(confirmation)) return;
    try {
      if (currentlyActive) await api.packages.deletePackage(pkg.id);
      else await api.packages.updatePackage(pkg.id, { isActive: true });
      soundEffects.playSuccessBeep();
      await reloadData();
      alert(currentlyActive ? `Đã ngừng bán gói "${pkg.name}".` : `Đã bật bán lại gói "${pkg.name}".`);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi cập nhật trạng thái gói: ${err.message}`);
    }
  };

  const handleArchivePtProduct = async (product: (typeof ptProducts)[number]) => {
    if (!window.confirm(`Ngừng bán gói PT "${product.name}"? Các đơn đã mua vẫn được giữ.`)) return;
    try {
      await api.adminTrainers.archivePtProduct(product.id);
      await loadPtProducts();
      soundEffects.playSuccessBeep();
    } catch (error) {
      soundEffects.playErrorBeep();
      alert(error instanceof Error ? error.message : 'Không thể ngừng bán gói PT.');
    }
  };

  // Handle Update User Role via Live Backend REST API
  const handleChangeUserRole = async (userId: string | number, newRole: 'ADMIN' | 'STAFF' | 'COACH' | 'MEMBER' | string) => {
    try {
      await api.users.updateUserRole(userId, newRole);
      soundEffects.playSuccessBeep();
      await reloadData();
      alert(`Đã cập nhật vai trò thành công sang ${newRole}!`);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi cập nhật quyền: ${err.message}`);
    }
  };

  // Inspect Member 360 with live details from API
  const handleInspectMember = async (m: Member) => {
    const requestId = ++memberProfileRequestId.current;
    setInspectingMember(m);
    setInspectingMember360(null);
    setMemberProfileError('');
    setIsLoadingMember360(true);
    try {
      const p360 = await api.admin.getMemberDetailProfile(m.id);
      if (requestId === memberProfileRequestId.current) setInspectingMember360(p360);
    } catch (e) {
      console.warn('Lỗi tải 360 profile:', e);
      if (requestId === memberProfileRequestId.current) {
        setMemberProfileError(e instanceof Error ? e.message : 'Không tải được hồ sơ hội viên.');
        setInspectingMember360(null);
      }
    } finally {
      if (requestId === memberProfileRequestId.current) setIsLoadingMember360(false);
    }
  };

  const handleResolveNoShow = async (bookingId: number, resolution: 'ATTENDED' | 'EXCUSED') => {
    const reason = window.prompt(resolution === 'ATTENDED'
      ? 'Lý do xác nhận hội viên đã tham gia buổi tập:'
      : 'Lý do hoàn lại buổi PT cho hội viên:')?.trim();
    if (!reason) return;

    setCorrectingNoShowId(bookingId);
    try {
      const result = await api.pt.resolveNoShow(bookingId, resolution, reason);
      soundEffects.playSuccessBeep();
      alert(result.message);
      if (inspectingMember) {
        try {
          setInspectingMember360(await api.admin.getMemberDetailProfile(inspectingMember.id));
        } catch (refreshError) {
          console.warn('Đã điều chỉnh buổi PT nhưng chưa tải lại hồ sơ:', refreshError);
        }
      }
    } catch (error: any) {
      soundEffects.playErrorBeep();
      alert(error.message || 'Không thể điều chỉnh buổi PT vắng');
    } finally {
      setCorrectingNoShowId(null);
    }
  };

  const handleManualPtCheckIn = async (bookingId: number) => {
    const reason = window.prompt('Lý do nhân viên xác nhận check-in PT thủ công:')?.trim();
    if (!reason) return;
    setCorrectingNoShowId(bookingId);
    try {
      await api.pt.manualCheckIn(bookingId, reason);
      if (inspectingMember) setInspectingMember360(await api.admin.getMemberDetailProfile(inspectingMember.id));
      soundEffects.playSuccessBeep();
    } catch (error: any) {
      soundEffects.playErrorBeep();
      alert(error.message || 'Không thể check-in PT thủ công');
    } finally {
      setCorrectingNoShowId(null);
    }
  };

  // Toggle Member Status (ACTIVE / BANNED) with confirmation dialog
  const handleToggleMemberStatus = (member: Member) => {
    if (isMemberAccountPending(member.accountStatus)) {
      soundEffects.playErrorBeep();
      toast.warning('Tài khoản hội viên đang chờ xác thực email OTP, chưa thể mở khóa thủ công.', 'Chưa Xác Thực Email');
      return;
    }
    setConfirmToggleMember(member);
  };

  const executeToggleMemberStatus = async () => {
    if (!confirmToggleMember || isTogglingMemberStatus) return;
    const isLocked = isMemberAccountLocked(confirmToggleMember.accountStatus);
    const nextStatus = isLocked ? 'ACTIVE' : 'BANNED';
    setIsTogglingMemberStatus(true);
    try {
      await api.users.updateUserStatus(confirmToggleMember.id, nextStatus);
      soundEffects.playSuccessBeep();
      toast.success(
        nextStatus === 'BANNED'
          ? `Đã khóa tài khoản hội viên ${confirmToggleMember.name}.`
          : `Đã mở khóa tài khoản hội viên ${confirmToggleMember.name}.`,
        nextStatus === 'BANNED' ? 'Đã Khóa Hội Viên' : 'Đã Mở Khóa Hội Viên'
      );
      if (inspectingMember?.id === confirmToggleMember.id) {
        setInspectingMember(null);
      }
      setConfirmToggleMember(null);
      await reloadData();
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể cập nhật trạng thái tài khoản.', 'Lỗi Cập Nhật');
    } finally {
      setIsTogglingMemberStatus(false);
    }
  };

  const activeGroupClassTrainers = groupClassTrainers.filter(
    (t) => t.status === 'ACTIVE' && (!t.user?.status || t.user.status === 'ACTIVE')
  );

  // Toggle Coach Status (ACTIVE / INACTIVE) with deactivation obligation check
  const handleToggleCoachStatus = async (coach: Coach) => {
    if (coach.isAcceptingBookings) {
      setDeactivatingCoach(coach);
      setDeactivationCheck(null);
      setDeactivationError('');
      setForceDeactivateCoach(false);
      setDeactivationLoading(true);
      try {
        const res = await api.adminTrainers.getDeactivationCheck(coach.id);
        setDeactivationCheck(res.data);
      } catch (err: any) {
        soundEffects.playErrorBeep();
        setDeactivationError(err.message || 'Không thể kiểm tra lịch dạy và học viên của HLV.');
      } finally {
        setDeactivationLoading(false);
      }
      return;
    }

    if (!coach.isAcceptingBookings && coach.userAccountStatus && coach.userAccountStatus !== 'ACTIVE') {
      soundEffects.playErrorBeep();
      toast.warning(
        `Tài khoản người dùng của HLV ${coach.name} đang ở trạng thái ${coach.userAccountStatus}, không thể kích hoạt nhận lịch.`,
        'Tài Khoản Đang Khóa'
      );
      return;
    }

    try {
      await api.adminTrainers.toggleTrainerStatus(coach.id, 'ACTIVE');
      soundEffects.playSuccessBeep();
      await reloadData();
      toast.success(`Đã kích hoạt lại HLV ${coach.name} thành công!`, 'Kích Hoạt HLV');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể cập nhật trạng thái HLV.', 'Lỗi Cập Nhật HLV');
    }
  };

  const handleConfirmDeactivateCoach = async () => {
    if (!deactivatingCoach || (!deactivationCheck?.canDeactivate && !forceDeactivateCoach)) return;
    setDeactivationSubmitting(true);
    setDeactivationError('');
    try {
      await api.adminTrainers.toggleTrainerStatus(deactivatingCoach.id, 'INACTIVE', forceDeactivateCoach);
      soundEffects.playSuccessBeep();
      const coachName = deactivatingCoach.name;
      setDeactivatingCoach(null);
      setDeactivationCheck(null);
      setForceDeactivateCoach(false);
      await reloadData();
      toast.success(`Đã tạm ngưng HLV ${coachName} thành công!`, 'Tạm Ngưng HLV');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setDeactivationError(err.message || 'Không thể tạm ngưng HLV.');
      try {
        const refreshed = await api.adminTrainers.getDeactivationCheck(deactivatingCoach.id);
        setDeactivationCheck(refreshed.data);
      } catch {}
    } finally {
      setDeactivationSubmitting(false);
    }
  };

  const handleReassignGroupClassSchedule = async (scheduleId: number, trainerId: number) => {
    if (!trainerId) {
      toast.warning('Vui lòng chọn HLV thay thế đang hoạt động.', 'Thiếu HLV');
      return;
    }
    setGroupClassActionLoadingId(scheduleId);
    try {
      await api.groupClasses.reassignScheduleTrainer(scheduleId, trainerId);
      soundEffects.playSuccessBeep();
      toast.success('Đã chuyển HLV phụ trách lớp học nhóm.', 'Đổi HLV Thành Công');
      setEditingScheduleForReassign(null);
      await reloadData();
      if (deactivatingCoach) {
        const refreshed = await api.adminTrainers.getDeactivationCheck(deactivatingCoach.id);
        setDeactivationCheck(refreshed.data);
      }
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể đổi HLV lớp học nhóm.', 'Lỗi Đổi HLV');
    } finally {
      setGroupClassActionLoadingId(null);
    }
  };

  const handleCancelGroupClassSchedule = async (scheduleId: number) => {
    setGroupClassActionLoadingId(scheduleId);
    try {
      await api.groupClasses.cancelSchedule(scheduleId);
      soundEffects.playSuccessBeep();
      toast.success('Đã hủy ca lớp học nhóm.', 'Hủy Ca Lớp');
      await reloadData();
      if (deactivatingCoach) {
        const refreshed = await api.adminTrainers.getDeactivationCheck(deactivatingCoach.id);
        setDeactivationCheck(refreshed.data);
      }
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể hủy ca lớp học nhóm.', 'Lỗi Hủy Ca');
    } finally {
      setGroupClassActionLoadingId(null);
    }
  };

  // Edit Package Handlers
  const handleOpenEditPackage = (pkg: PackagePlan) => {
    setEditingPackageId(Number(pkg.id));
    setEditPackageForm({
      name: pkg.name,
      type: pkg.type === 'hybrid_pt' ? 'PT' : 'MEMBERSHIP',
      durationDays: pkg.durationMonths * 30,
      price: pkg.priceVND,
      trialPtSessions: pkg.trialPtSessions ?? (pkg.type === 'standard_gym' ? pkg.ptSessionsIncluded : 0),
      totalPtSessions: pkg.totalPtSessions ?? (pkg.type === 'hybrid_pt' ? pkg.ptSessionsIncluded : 0),
      description: pkg.description,
      isActive: pkg.isActive !== false
    });
    setIsEditingPackage(true);
  };

  const handleSaveEditPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackageId) return;
    setPackageLoading(true);
    try {
      await api.packages.updatePackage(editingPackageId, {
        name: editPackageForm.name,
        type: editPackageForm.type,
        durationDays: editPackageForm.durationDays,
        price: editPackageForm.price,
        trialPtSessions: editPackageForm.type === 'PT' ? 0 : editPackageForm.trialPtSessions,
        totalPtSessions: editPackageForm.type === 'PT' ? editPackageForm.totalPtSessions : undefined,
        description: editPackageForm.description,
        isActive: editPackageForm.isActive
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsEditingPackage(false);
      alert('Đã cập nhật gói tập thành công!');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi cập nhật gói: ${err.message}`);
    } finally {
      setPackageLoading(false);
    }
  };

  // Facility & Equipment Handlers
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.facility.upsertRoom({
        ...(editingRoomId ? { id: editingRoomId } : {}),
        name: roomForm.name,
        type: roomForm.type,
        capacity: Number(roomForm.capacity),
        isActive: roomForm.isActive,
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingRoom(false);
      setEditingRoomId(null);
      setRoomForm({ name: '', type: 'FITNESS', capacity: 30, isActive: true });
      toast.success(editingRoomId ? 'Đã cập nhật thông tin phòng tập.' : 'Đã thêm phòng tập mới.', 'Phòng Tập');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể lưu phòng tập.', 'Lỗi Phòng Tập');
    }
  };

  const handleToggleRoomActive = async (room: ApiRoom) => {
    try {
      const nextActive = room.isActive === false;
      await api.facility.upsertRoom({
        id: room.id,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        isActive: nextActive,
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      toast.success(nextActive ? `Đã kích hoạt lại phòng ${room.name}.` : `Đã tạm ngưng phòng ${room.name}.`, 'Phòng Tập');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể đổi trạng thái phòng tập.', 'Lỗi Phòng Tập');
    }
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetRoomId = Number(equipmentForm.roomId || rooms[0]?.id || 0);
    if (!targetRoomId) {
      soundEffects.playErrorBeep();
      toast.warning('Vui lòng tạo ít nhất 1 phòng tập trước khi thêm thiết bị.', 'Thiếu Phòng Tập');
      return;
    }
    try {
      if (editingEquipmentId) {
        await api.facility.updateEquipment(editingEquipmentId, {
          name: equipmentForm.name,
          code: equipmentForm.code,
          roomId: targetRoomId,
          status: equipmentForm.status,
          note: equipmentForm.note,
        });
        toast.success('Đã cập nhật thông tin & ghi chú thiết bị.', 'Thiết Bị');
      } else {
        await api.facility.createEquipment({
          name: equipmentForm.name,
          code: equipmentForm.code,
          roomId: targetRoomId,
          note: equipmentForm.note
        });
        toast.success('Đã thêm thiết bị mới vào hệ thống.', 'Thiết Bị');
      }
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingEquipment(false);
      setEditingEquipmentId(null);
      setEquipmentForm({ name: '', code: '', roomId: 0, status: 'AVAILABLE', note: '' });
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể lưu thiết bị.', 'Lỗi Thiết Bị');
    }
  };

  const handleUpdateEquipmentStatus = async (id: number, status: 'AVAILABLE' | 'MAINTENANCE' | 'BROKEN') => {
    try {
      await api.facility.updateEquipmentStatus(id, { status });
      soundEffects.playSuccessBeep();
      await reloadData();
      toast.success('Đã cập nhật trạng thái thiết bị.', 'Thiết Bị');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Lỗi cập nhật trạng thái thiết bị.', 'Lỗi Thiết Bị');
    }
  };

  const handleDeleteEquipment = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xoá thiết bị này khỏi danh sách?')) return;
    try {
      await api.facility.deleteEquipment(id);
      soundEffects.playSuccessBeep();
      await reloadData();
      toast.success('Đã xóa thiết bị khỏi danh sách.', 'Thiết Bị');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Lỗi xóa thiết bị.', 'Lỗi Thiết Bị');
    }
  };

  // Group Classes Handlers
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.groupClasses.createClass({
        name: classForm.name,
        description: classForm.description,
        durationMin: Number(classForm.durationMin || 60),
        imageUrl: classForm.imageUrl
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingClass(false);
      setClassForm({ name: '', description: '', durationMin: 60, imageUrl: '' });
      if (res?.data?.id) {
        setScheduleForm(prev => ({ ...prev, classId: res.data.id }));
      }
      toast.success('Đã tạo danh mục lớp học mới thành công!', 'Lớp Học Nhóm');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể tạo lớp học.', 'Lỗi Tạo Lớp Học');
    }
  };

  const openCreateScheduleModal = (preferredClassId?: number) => {
    const defaultStartLocal = getDefaultScheduleStartLocal();
    const firstDt = parseGymDateTimeLocal(defaultStartLocal);
    const firstWeekday = Number.isNaN(firstDt.getTime()) ? 1 : getGymIsoWeekday(firstDt);
    setScheduleForm(prev => ({
      ...prev,
      classId:
        preferredClassId ??
        (prev.classId && groupClasses.some(c => c.id === prev.classId) ? prev.classId : (groupClasses[0]?.id ?? 0)),
      trainerId: activeGroupClassTrainers[0]?.userId ?? 0,
      roomId: rooms.find(r => r.isActive !== false)?.id ?? 0,
      startTime: defaultStartLocal,
      repeatMode: 'SINGLE',
      repeatCount: 1,
      repeatDays: [firstWeekday],
    }));
    setIsCreatingSchedule(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClass = groupClasses.find(c => c.id === Number(scheduleForm.classId));
    const durationMin = selectedClass?.durationMin || 60;
    const startDt = parseGymDateTimeLocal(scheduleForm.startTime);
    if (Number.isNaN(startDt.getTime())) {
      soundEffects.playErrorBeep();
      toast.error('Vui lòng chọn ngày và giờ bắt đầu hợp lệ.', 'Giờ Bắt Đầu');
      return;
    }
    if (startDt.getTime() <= Date.now()) {
      soundEffects.playErrorBeep();
      toast.error('Không thể mở ca lịch cho thời điểm trong quá khứ.', 'Giờ Bắt Đầu');
      return;
    }
    const isRecurring = scheduleForm.repeatMode !== 'SINGLE';
    const parsedRepeatCount = isRecurring ? Number(scheduleForm.repeatCount || 0) : 1;
    if (isRecurring && (!Number.isInteger(parsedRepeatCount) || parsedRepeatCount < 2 || parsedRepeatCount > 30)) {
      soundEffects.playErrorBeep();
      toast.error('Số buổi lặp lại phải từ 2 đến 30 buổi.', 'Số Buổi Lặp Lại');
      return;
    }
    const firstWeekday = getGymIsoWeekday(startDt);
    const normalizedRepeatDays =
      scheduleForm.repeatMode === 'WEEKLY'
        ? [...new Set([...scheduleForm.repeatDays, firstWeekday])].sort((a, b) => a - b)
        : undefined;
    const endDt = new Date(startDt.getTime() + durationMin * 60_000);
    try {
      const res = await api.groupClasses.createSchedule({
        classId: Number(scheduleForm.classId),
        trainerId: Number(scheduleForm.trainerId),
        roomId: scheduleForm.roomId ? Number(scheduleForm.roomId) : undefined,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        capacity: Number(scheduleForm.capacity || 20),
        repeatCount: parsedRepeatCount,
        repeatFrequency: scheduleForm.repeatMode === 'SINGLE' ? 'NONE' : scheduleForm.repeatMode,
        repeatDays: normalizedRepeatDays,
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingSchedule(false);
      setScheduleForm(prev => ({ ...prev, startTime: '', repeatMode: 'SINGLE', repeatCount: 1 }));
      toast.success(res.message || 'Đã mở lịch ca tập mới thành công!', 'Lịch Lớp Nhóm');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không thể lên lịch ca tập.', 'Lỗi Lên Lịch');
    }
  };

  // Handle Open Ticket Response Modal
  const handleOpenResponseModal = (t: SupportTicket) => {
    setRespondingTicket(t);
    setAdminResponseText(t.adminResponse || '');
    setTargetAssignee((t.actionRequiredBy as any) === 'receptionist' ? 'staff' : (t.actionRequiredBy || 'staff'));
    setTargetStatus(t.status === 'open' ? 'in_progress' : t.status as 'in_progress' | 'resolved');
    soundEffects.playSuccessBeep();
  };

  // Handle Save Admin Response
  const handleSaveAdminResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingTicket || !adminResponseText.trim()) return;

    try {
      await api.support.replyTicket(respondingTicket.id.replace('TCK-', ''), {
        reply: `[Chỉ đạo BQL -> ${targetAssignee.toUpperCase()}]: ${adminResponseText.trim()}`,
        status: targetStatus === 'resolved' ? 'RESOLVED' : 'IN_PROGRESS'
      });
      soundEffects.playSuccessBeep();
      reloadData();
      setRespondingTicket(null);
      alert(`Đã gửi chỉ đạo thành công cho báo cáo "${respondingTicket.title}"! Lễ tân và bộ phận liên quan đã nhận được trên hệ thống.`);
    } catch (err: any) {
      alert(`Lỗi phản hồi ticket: ${err.message}`);
    }
  };

  // Quick Resolve Ticket
  const handleQuickResolveTicket = async (t: SupportTicket) => {
    try {
      await api.support.replyTicket(t.id.replace('TCK-', ''), {
        reply: 'Ban Quản Lý duyệt và đóng ticket trực tiếp.',
        status: 'RESOLVED'
      });
      soundEffects.playSuccessBeep();
      reloadData();
      alert(`Đã hoàn tất đóng báo cáo ${t.ticketCode || t.title}!`);
    } catch (err: any) {
      alert(`Lỗi đóng ticket: ${err.message}`);
    }
  };

  // Filtered Tickets
  const filteredTickets = tickets.filter(t => {
    const matchesStatus = ticketStatusFilter === 'all' || t.status === ticketStatusFilter;
    const matchesCategory = ticketCategoryFilter === 'all' || t.category === ticketCategoryFilter;
    const q = ticketSearchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      t.title.toLowerCase().includes(q) ||
      t.memberName.toLowerCase().includes(q) ||
      t.memberPhone.includes(q) ||
      (t.ticketCode && t.ticketCode.toLowerCase().includes(q)) ||
      t.description.toLowerCase().includes(q);
    return matchesStatus && matchesCategory && matchesQuery;
  });

  const categoryMeta = (c: string) => {
    switch (c) {
      case 'lost_found': return { label: 'Đồ thất lạc', variant: 'warning' as const };
      case 'freeze_request': return { label: 'Bảo lưu gói tập', variant: 'info' as const };
      case 'equipment': return { label: 'Hỏng máy / CSVC', variant: 'destructive' as const };
      case 'coach_feedback': return { label: 'Phản ánh HLV', variant: 'soft' as const };
      default: return { label: 'Yêu cầu khác', variant: 'secondary' as const };
    }
  };

  const rankVariant = (rank: string) => (rank === 'master' ? 'default' : rank === 'senior' ? 'success' : 'secondary') as 'default' | 'success' | 'secondary';

  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const inProgressTicketsCount = tickets.filter(t => t.status === 'in_progress').length;
  const visiblePackages = packages.filter(pkg => packageStatusFilter === 'all' ||
    (packageStatusFilter === 'active' ? pkg.isActive !== false : pkg.isActive === false));
  const visiblePtProducts = ptProducts.filter(product => packageStatusFilter === 'all' ||
    (packageStatusFilter === 'active' ? product.isActive : !product.isActive));
  const catalogCount = packages.length + ptProducts.length;
  const activeCatalogCount = packages.filter(pkg => pkg.isActive !== false).length + ptProducts.filter(product => product.isActive).length;

  return (
    <StaffPage>
      {/* Top Global Time Range Filter Bar */}
      <div className="flex flex-col gap-2 pb-3 border-b border-border/80">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
          <Calendar className="size-4 text-primary" />
          <span>Kỳ Thống Kê</span>
        </div>
        <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-muted/60 p-1 sm:grid-cols-5">
          {[
            { id: 'today', label: 'Hôm Nay' },
            { id: '7days', label: '7 Ngày Qua' },
            { id: 'month', label: 'Tháng Này' },
            { id: 'quarter', label: 'Quý Này' },
            { id: 'year', label: 'Cả Năm' },
          ].map((tf, idx) => {
            const isActive = timeFilter === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => {
                  setTimeFilter(tf.id as any);
                  soundEffects.playSuccessBeep();
                }}
                className={`w-full px-3 py-1.5 text-center text-xs font-bold rounded-md transition-all cursor-pointer ${idx === 4 ? 'col-span-2 sm:col-span-1' : ''} ${isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/60'
                  }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top BI Metric Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            tab: 'analytics',
            icon: Coins,
            label: 'Doanh thu',
            value: `${timeFilteredData.revenue.toLocaleString('vi-VN')}đ`,
            meta: (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="size-3 shrink-0" />
                {timeFilteredData.growth}
              </span>
            ),
            iconTone: 'bg-primary/10 text-primary',
            activeCls: 'ring-2 ring-primary/40 border-primary',
            hoverCls: 'hover:border-primary/60',
          },
          {
            tab: 'members-360',
            icon: Users,
            label: 'Hội viên',
            value: String(analyticsData?.totalMembers ?? members.length),
            meta: (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {analyticsData?.renewalRate ?? '100%'}
              </span>
            ),
            iconTone: 'bg-success/15 text-success',
            activeCls: 'ring-2 ring-success/40 border-success',
            hoverCls: 'hover:border-success/60',
          },
          {
            tab: 'coaches-config',
            icon: Dumbbell,
            label: 'HLV',
            value: String(analyticsData?.totalCoaches ?? coaches.length),
            meta: (
              <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                TB {analyticsData?.avgMembersPerCoach ?? '—'}
              </span>
            ),
            iconTone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
            activeCls: 'ring-2 ring-sky-500/40 border-sky-500',
            hoverCls: 'hover:border-sky-500/60',
          },
          {
            tab: 'packages-engine',
            icon: Layers,
            label: 'Gói tập',
            value: String(analyticsData?.catalogCount ?? catalogCount),
            meta: (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                PT {analyticsData?.ptRevenueShare ?? '0%'}
              </span>
            ),
            iconTone: 'bg-warning/15 text-warning',
            activeCls: 'ring-2 ring-amber-500/40 border-amber-500',
            hoverCls: 'hover:border-amber-500/60',
          },
          {
            tab: 'tickets-management',
            icon: AlertTriangle,
            label: 'Sự cố',
            value: String(openTicketsCount),
            meta: openTicketsCount > 0 ? (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-bold">
                Khẩn
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {inProgressTicketsCount > 0 ? `${inProgressTicketsCount} xử lý` : 'Ổn định'}
              </span>
            ),
            iconTone: openTicketsCount > 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary',
            activeCls: openTicketsCount > 0 ? 'border-destructive bg-destructive/10 ring-2 ring-destructive/40' : 'ring-2 ring-primary/40 border-primary',
            hoverCls: openTicketsCount > 0 ? 'border-destructive/80 bg-destructive/10 hover:border-destructive' : 'hover:border-primary/60',
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => {
                onTabChange(item.tab);
                soundEffects.playSuccessBeep();
              }}
              className={`group flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left transition-all duration-150 cursor-pointer active:scale-[0.98] hover:shadow-sm focus:outline-none ${item.hoverCls} ${isActive ? item.activeCls : ''}`}
            >
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${item.iconTone}`}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[11px] font-semibold text-muted-foreground">{item.label}</span>
                  <span className="shrink-0">{item.meta}</span>
                </div>
                <p className="mt-0.5 truncate text-base font-bold leading-tight tracking-tight text-foreground sm:text-lg">
                  {item.value}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BI Analytics & Reports */}
      {activeTab === 'analytics' && (
        <div className="grid gap-6">
          {/* 1. Full-Width Interactive Area & Line Growth Chart */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  Xu Hướng Tăng Trưởng Doanh Thu & Lượng Khách Check-in
                </CardTitle>
              </div>

              {/* Chart Legend & Summary Toggle Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setChartMetric('revenue');
                    soundEffects.playSuccessBeep();
                  }}
                  aria-pressed={chartMetric === 'revenue'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    chartMetric === 'revenue'
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs'
                      : 'bg-muted/40 border-border opacity-75 hover:opacity-100 hover:bg-muted/70'
                  }`}
                >
                  <span className="size-2.5 rounded-full bg-primary" />
                  <span className="text-foreground">Doanh Thu:</span>
                  <span className="text-primary font-bold">{timeFilteredData.revenue.toLocaleString('vi-VN')} đ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChartMetric('checkins');
                    soundEffects.playSuccessBeep();
                  }}
                  aria-pressed={chartMetric === 'checkins'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    chartMetric === 'checkins'
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/40 shadow-xs'
                      : 'bg-muted/40 border-border opacity-75 hover:opacity-100 hover:bg-muted/70'
                  }`}
                >
                  <span className="size-2.5 rounded-full bg-sky-500" />
                  <span className="text-foreground">Check-in:</span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold">{timeFilteredData.activeCheckIns} lượt</span>
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {/* SVG Growth Curve Area & Line Chart */}
              <div className="w-full overflow-x-auto overflow-y-hidden">
                <div className="min-w-[580px] h-[220px] w-full">
                  {(() => {
                    const data = timeFilteredData.chartData;
                    const isCheckins = chartMetric === 'checkins';
                    const topY = 34;
                    const midY = 102;
                    const botY = 170;
                    const plotHeight = botY - topY; // 136px
                    const plotLeft = 72;
                    const plotRight = 672;
                    const innerLeft = 92;
                    const innerRight = 656;

                    const seriesValues = data.map(d => (isCheckins ? (d.checkins ?? 0) : d.rev));
                    const maxVal = Math.max(...seriesValues, 0);

                    const formatValue = (val: number) => {
                      if (isCheckins) {
                        const rounded = Number.isInteger(val) ? val : Number(val.toFixed(1));
                        return `${rounded} lượt`;
                      }
                      if (val >= 1) return `${Number(val.toFixed(2))}M`;
                      if (val > 0) return `${Math.round(val * 1000)}k`;
                      return '0đ';
                    };

                    const strokeColor = isCheckins ? '#0284c7' : 'var(--color-primary)';
                    const gradId = isCheckins ? 'auraCheckinGrad' : 'auraRevenueGrad';

                    const stepX = data.length > 1 ? (innerRight - innerLeft) / (data.length - 1) : 0;
                    const points = data.map((d, i) => {
                      const val = isCheckins ? (d.checkins ?? 0) : d.rev;
                      const x = data.length === 1 ? (innerLeft + innerRight) / 2 : innerLeft + i * stepX;
                      const y = maxVal > 0 ? botY - (val / maxVal) * plotHeight : botY;
                      return { x, y, val, isPeak: maxVal > 0 && val === maxVal, label: d.label };
                    });

                    const pathD = points.reduce((acc, p, i) => {
                      if (i === 0) return `M ${p.x} ${p.y}`;
                      const prev = points[i - 1];
                      const cx = prev.x + (p.x - prev.x) / 2;
                      return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
                    }, '');

                    const areaD = points.length
                      ? `${pathD} L ${points[points.length - 1].x} ${botY} L ${points[0].x} ${botY} Z`
                      : '';

                    return (
                      <svg viewBox="0 0 700 205" className="block w-full h-full">
                        <defs>
                          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={strokeColor} stopOpacity={isCheckins ? '0.26' : '0.32'} />
                            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Grid lines (34, 68, 102, 136, 170) */}
                        <line x1={plotLeft} y1={topY} x2={plotRight} y2={topY} stroke={strokeColor} strokeOpacity={maxVal > 0 ? 0.35 : 0.1} strokeDasharray="4 3" />
                        <line x1={plotLeft} y1={68} x2={plotRight} y2={68} stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 3" />
                        <line x1={plotLeft} y1={midY} x2={plotRight} y2={midY} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" />
                        <line x1={plotLeft} y1={136} x2={plotRight} y2={136} stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 3" />
                        <line x1={plotLeft} y1={botY} x2={plotRight} y2={botY} stroke="currentColor" strokeOpacity="0.18" />

                        {/* Y-axis labels anchored to highest value = Cao */}
                        <text x={plotLeft - 8} y={topY + 4} textAnchor="end" fill={strokeColor} className="text-[10px] font-bold">
                          {maxVal > 0 ? `Cao · ${formatValue(maxVal)}` : 'Cao'}
                        </text>
                        <text x={plotLeft - 8} y={midY + 4} textAnchor="end" className="text-[10px] fill-foreground/60 font-semibold">
                          {maxVal > 0 ? `TB · ${formatValue(maxVal / 2)}` : 'TB'}
                        </text>
                        <text x={plotLeft - 8} y={botY + 4} textAnchor="end" className="text-[10px] fill-foreground/60 font-semibold">
                          {isCheckins ? '0' : '0đ'}
                        </text>

                        {points.length > 0 && (
                          <>
                            <path d={areaD} fill={`url(#${gradId})`} />
                            <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
                            {points.map((p, i) => (
                              <g key={i}>
                                {p.isPeak && (
                                  <circle cx={p.x} cy={p.y} r="8" fill={strokeColor} fillOpacity="0.18" />
                                )}
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={p.isPeak ? 5.5 : 4.5}
                                  fill={p.isPeak ? strokeColor : 'var(--bg-card)'}
                                  stroke={strokeColor}
                                  strokeWidth="2.5"
                                />
                                <text
                                  x={p.x}
                                  y={p.y - 11}
                                  textAnchor="middle"
                                  fill={p.isPeak ? strokeColor : undefined}
                                  className={`text-[10px] font-bold ${p.isPeak ? '' : 'fill-foreground/80'}`}
                                >
                                  {formatValue(p.val)}
                                </text>
                                <text x={p.x} y="192" textAnchor="middle" className="text-[11px] font-semibold fill-foreground/80">
                                  {p.label}
                                </text>
                              </g>
                            ))}
                          </>
                        )}
                      </svg>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Operational Breakdown Grid: Service Mix & Peak Hours vs Recent Invoices */}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Cơ Cấu Doanh Thu Theo Loại Dịch Vụ</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4">
                  {(analyticsData?.serviceMix ?? [
                    { name: 'Gói Hội Viên Gym Tiêu Chuẩn', amount: 0, percentage: 0 },
                    { name: 'Gói Tập PT 1:1 & Gia Hạn Buổi PT', amount: 0, percentage: 0 },
                    { name: 'Khóa Học & Dịch Vụ Khác', amount: 0, percentage: 0 }
                  ]).map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-1.5 font-semibold text-foreground">
                        <span>{item.name}</span>
                        <span className={idx === 0 ? "text-primary font-bold" : idx === 1 ? "text-sky-600 dark:text-sky-400 font-bold" : "text-success font-bold"}>
                          {item.percentage}% ({item.amount.toLocaleString('vi-VN')} đ)
                        </span>
                      </div>
                      <Progress value={item.percentage} className="h-2.5" />
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-bold text-foreground mb-3">Mật Độ Hội Viên Theo Khung Giờ (Peak Hours)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 text-center">
                    {(analyticsData?.peakHours ?? [
                      { time: '06:00 - 08:00', count: 0, density: '0%', label: 'Thấp', peak: false },
                      { time: '08:00 - 11:00', count: 0, density: '0%', label: 'Thấp', peak: false },
                      { time: '11:30 - 13:30', count: 0, density: '0%', label: 'Thấp', peak: false },
                      { time: '14:00 - 17:00', count: 0, density: '0%', label: 'Thấp', peak: false },
                      { time: '17:30 - 20:30', count: 0, density: '0%', label: 'Thấp', peak: false },
                      { time: '20:30 - 22:00', count: 0, density: '0%', label: 'Thấp', peak: false }
                    ]).map((slot, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border text-xs transition-all ${slot.peak
                          ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-xs'
                          : 'bg-muted/50 border-border'
                          }`}
                      >
                        <div className="text-foreground/75 font-semibold text-[11px]">{slot.time}</div>
                        <div className={`text-base font-extrabold my-1 ${slot.peak ? 'text-primary' : 'text-foreground'}`}>
                          {slot.density}
                        </div>
                        <Badge variant={slot.peak ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 font-bold">
                          {slot.label}
                        </Badge>
                        {slot.count !== undefined && (
                          <div className="text-[10px] text-muted-foreground mt-1">{slot.count} lượt</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Giao Dịch Gần Đây</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 max-h-[500px] overflow-y-auto">
                  {invoices.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">Chưa có giao dịch thanh toán nào được ghi nhận.</div>
                  ) : (
                    invoices.map(inv => (
                      <div key={inv.id} className="p-3.5 rounded-lg border bg-card/90 hover:border-primary/50 transition-all text-xs shadow-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-sm text-foreground">{inv.memberName}</span>
                          <span className="font-extrabold text-sm text-primary">+{inv.totalVND.toLocaleString('vi-VN')} đ</span>
                        </div>
                        <div className="text-foreground/80 font-medium line-clamp-1">{inv.items[0]?.name || 'Dịch vụ'}</div>
                        <div className="flex justify-between items-center text-foreground/75 mt-2.5 text-[11px] font-medium">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold border-border/80">{inv.paymentMethod}</Badge>
                          <span>{new Date(inv.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Member Management 360 */}
      {activeTab === 'members-360' && (
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Quản Lý Hồ Sơ Hội Viên</CardTitle>
            <CardAction>
              <div className="relative w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Tìm theo tên, SĐT, mã HV..."
                  value={memberSearchQuery}
                  onChange={(e) => {
                    setMemberSearchQuery(e.target.value);
                    setMemberPage(1);
                  }}
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hội Viên</TableHead>
                  <TableHead>Gói Đang Dùng</TableHead>
                  <TableHead>Hạn Gói</TableHead>
                  <TableHead>Buổi PT Còn</TableHead>
                  <TableHead>HLV Phụ Trách</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Chi Tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Không tìm thấy hội viên phù hợp.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMembers.map(m => {
                    const isLocked = isMemberAccountLocked(m.accountStatus);
                    const isPending = isMemberAccountPending(m.accountStatus);
                    return (
                  <TableRow key={m.id} className={isLocked ? 'bg-destructive/5' : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={m.avatar} alt={m.name} />
                          <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-foreground">{m.name}</span>
                            {isLocked ? (
                              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Đã khóa</Badge>
                            ) : isPending ? (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400">Chờ OTP</Badge>
                            ) : (
                              <Badge variant="success" className="px-1.5 py-0 text-[10px]">Hoạt động</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{m.code}{m.phone ? ` • ${m.phone}` : ''}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{m.packageName}</TableCell>
                    <TableCell className={m.activePackageId && m.daysRemaining <= 3 ? 'text-destructive font-medium' : ''}>
                      {m.packageEndDate}
                    </TableCell>
                    <TableCell>
                      {m.ptSessionsTotal > 0 ? (
                        <span className="font-semibold text-primary">{m.ptSessionsRemaining}/{m.ptSessionsTotal}</span>
                      ) : m.legacyPtSessions ? `${m.legacyPtSessions} buổi PT cũ` : '—'}
                    </TableCell>
                    <TableCell>{m.assignedCoachName || <span className="text-muted-foreground">Chưa gán</span>}</TableCell>
                    <TableCell className="font-semibold text-success">{m.totalCheckIns} lượt</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => handleInspectMember(m)}>
                          <Eye className="size-4" /> Chi Tiết
                        </Button>
                        <Button
                          variant={isLocked ? 'outline' : 'ghost'}
                          size="sm"
                          disabled={isPending}
                          title={isPending ? 'Hội viên chưa xác thực email OTP' : undefined}
                          className={
                            isPending
                              ? 'text-muted-foreground'
                              : isLocked
                              ? 'text-success border-success/40 hover:text-success'
                              : 'text-destructive hover:text-destructive'
                          }
                          onClick={() => handleToggleMemberStatus(m)}
                        >
                          {isPending ? 'Chờ OTP' : isLocked ? 'Mở khóa' : 'Khóa'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <Select
                  value={String(memberPageSize)}
                  onValueChange={(value) => {
                    setMemberPageSize(Number(value));
                    setMemberPage(1);
                  }}
                >
                  <SelectTrigger size="sm" className="w-[104px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 / bảng</SelectItem>
                    <SelectItem value="10">10 / bảng</SelectItem>
                    <SelectItem value="20">20 / bảng</SelectItem>
                    <SelectItem value="50">50 / bảng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeMemberPage <= 1}
                  onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Trước
                </Button>
                <span className="px-2 font-semibold text-foreground">
                  {safeMemberPage} / {totalMemberPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeMemberPage >= totalMemberPages}
                  onClick={() => setMemberPage((p) => Math.min(totalMemberPages, p + 1))}
                >
                  Sau
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member Modal Dialog */}
      <Dialog open={!!inspectingMember} onOpenChange={(open) => { if (!open) { memberProfileRequestId.current += 1; setInspectingMember(null); } }}>
        <DialogContent className="max-w-2xl">
          {inspectingMember && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarImage src={inspectingMember.avatar} alt={inspectingMember.name} />
                    <AvatarFallback>{inspectingMember.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>Hồ Sơ Hội Viên - {inspectingMember.name}</DialogTitle>
                    <DialogDescription>{inspectingMember.code} • {inspectingMember.phone ? `SĐT: ${inspectingMember.phone}` : 'Chưa có SĐT'} • {inspectingMember.email}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                {isLoadingMember360 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                    <div>Đang tải hồ sơ từ máy chủ...</div>
                  </div>
                ) : memberProfileError ? (
                  <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{memberProfileError}</div>
                ) : inspectingMember360 ? (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border bg-muted/40">
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Thông tin Gói Tập</div>
                        <div className="font-semibold text-foreground text-sm">
                          {inspectingMember360.currentGymMembership?.package?.name || 'Chưa có gói Gym đang hiệu lực'}
                        </div>
                        {inspectingMember360.currentGymMembership && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {memberDate(inspectingMember360.currentGymMembership.startDate)} đến {memberDate(inspectingMember360.currentGymMembership.endDate)}
                          </div>
                        )}
                        <div className="text-xs font-bold text-primary mt-2">
                          {inspectingMember360.ptWalletSummary.total > 0
                            ? `PT Credit: ${inspectingMember360.ptWalletSummary.available} buổi khả dụng, ${inspectingMember360.ptWalletSummary.held} buổi đã đặt`
                            : inspectingMember360.legacyPtSessions > 0
                              ? `PT cũ: ${inspectingMember360.legacyPtSessions} buổi chưa chuyển ví`
                              : 'Chưa có PT Credit'}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg border bg-muted/40">
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Lịch Sử Điểm Danh Gần Nhất</div>
                        <div className="font-semibold text-foreground text-sm">
                          {inspectingMember360.checkInTotal} lượt
                        </div>
                        {inspectingMember360.checkInHistory[0] && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Lần cuối: {new Date(inspectingMember360.checkInHistory[0].checkInTime).toLocaleString('vi-VN')}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              isMemberAccountLocked(inspectingMember.accountStatus)
                                ? 'destructive'
                                : isMemberAccountPending(inspectingMember.accountStatus)
                                ? 'outline'
                                : 'success'
                            }
                          >
                            {isMemberAccountLocked(inspectingMember.accountStatus)
                              ? 'Tài khoản đang khóa'
                              : isMemberAccountPending(inspectingMember.accountStatus)
                              ? 'Chờ xác thực OTP'
                              : 'Đang hoạt động'}
                          </Badge>
                          <Button
                            variant={isMemberAccountLocked(inspectingMember.accountStatus) ? 'default' : 'destructive'}
                            size="sm"
                            disabled={isMemberAccountPending(inspectingMember.accountStatus)}
                            onClick={() => handleToggleMemberStatus(inspectingMember)}
                          >
                            {isMemberAccountPending(inspectingMember.accountStatus)
                              ? 'Chờ xác thực OTP'
                              : isMemberAccountLocked(inspectingMember.accountStatus)
                              ? 'Mở Khóa Tài Khoản'
                              : 'Khóa Tài Khoản Hội Viên'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border bg-muted/40">
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Lịch Sử Buổi Tập & Huấn Luyện</div>
                      {(inspectingMember360?.trainingHistory?.ptSessions && inspectingMember360.trainingHistory.ptSessions.length > 0) ? (
                        <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                          {inspectingMember360.trainingHistory.ptSessions.map((pt: any) => (
                            <div key={pt.id} className="p-3 rounded-md border bg-card text-xs">
                              <div className="font-bold text-primary">{new Date(pt.startTime).toLocaleDateString('vi-VN')}</div>
                              <div className="flex justify-between mt-1 text-muted-foreground">
                                <span>HLV: <strong className="text-foreground">{pt.coach?.fullName || 'HLV'}</strong></span>
                                <span>Trạng thái: <strong className="text-success">{pt.status}</strong></span>
                              </div>
                              {pt.cancelledBy === 'SYSTEM_NO_SHOW_NO_DEBIT' && (
                                <p className="mt-2 text-amber-700">Hệ thống ghi nhận vắng nhưng gói đã hết buổi; chưa trừ lượt. Cần kiểm tra thủ công.</p>
                              )}
                              {pt.status === 'CONFIRMED' && <Button size="sm" variant="outline"
                                className="mt-3" disabled={correctingNoShowId !== null}
                                onClick={() => handleManualPtCheckIn(pt.id)}>Check-in thủ công</Button>}
                              {pt.status === 'ABSENT_NO_REFUND' && pt.cancelledBy === 'SYSTEM_NO_SHOW' && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  <Button size="sm" variant="outline" disabled={correctingNoShowId !== null}
                                    onClick={() => handleResolveNoShow(pt.id, 'ATTENDED')}>
                                    Ghi nhận đã tập
                                  </Button>
                                  <Button size="sm" variant="outline" disabled={correctingNoShowId !== null}
                                    onClick={() => handleResolveNoShow(pt.id, 'EXCUSED')}>
                                    Hoàn lại 1 buổi
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Chưa có lịch sử buổi tập PT nào được ghi nhận.</p>
                      )}
                    </div>
                  </>
                ) : null}

                <div className="p-4 rounded-lg border bg-muted/40">
                  <Field label="Phân Quyền Vai Trò">
                    <div className="flex flex-wrap items-center gap-3">
                      <Select defaultValue="MEMBER" onValueChange={(val) => handleChangeUserRole(inspectingMember.id, val as any)}>
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">MEMBER (Hội Viên Thường)</SelectItem>
                          <SelectItem value="COACH">COACH (Huấn Luyện Viên)</SelectItem>
                          <SelectItem value="STAFF">STAFF (Lễ Tân / Thu Ngân)</SelectItem>
                          <SelectItem value="ADMIN">ADMIN (Ban Quản Lý)</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">Cập nhật quyền tài khoản tức thời</span>
                    </div>
                  </Field>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setInspectingMember(null)}>Đóng Hồ Sơ</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Member Lock / Unlock Dialog */}
      <Dialog open={!!confirmToggleMember} onOpenChange={(open) => { if (!open && !isTogglingMemberStatus) setConfirmToggleMember(null); }}>
        <DialogContent className="max-w-md">
          {confirmToggleMember && (() => {
            const willUnlock = isMemberAccountLocked(confirmToggleMember.accountStatus);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lock className={`size-5 ${willUnlock ? 'text-success' : 'text-destructive'}`} />
                    {willUnlock ? 'Xác nhận mở khóa hội viên' : 'Xác nhận khóa tài khoản hội viên'}
                  </DialogTitle>
                  <DialogDescription>
                    {willUnlock
                      ? `Bạn có chắc muốn mở khóa tài khoản của ${confirmToggleMember.name} (${confirmToggleMember.code})? Hội viên sẽ có thể đăng nhập và check-in trở lại.`
                      : `Bạn có chắc muốn khóa tài khoản của ${confirmToggleMember.name} (${confirmToggleMember.code})?`}
                  </DialogDescription>
                </DialogHeader>
                {!willUnlock && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle className="text-xs font-bold">Hiệu lực ngay lập tức</AlertTitle>
                    <AlertDescription className="text-xs">
                      Hội viên sẽ bị đăng xuất khỏi phiên hiện tại, không thể đăng nhập lại và bị chặn check-in (cả QR lẫn thủ công tại quầy).
                    </AlertDescription>
                  </Alert>
                )}
                <DialogFooter>
                  <Button variant="outline" disabled={isTogglingMemberStatus} onClick={() => setConfirmToggleMember(null)}>
                    Hủy
                  </Button>
                  <Button
                    variant={willUnlock ? 'default' : 'destructive'}
                    disabled={isTogglingMemberStatus}
                    onClick={executeToggleMemberStatus}
                  >
                    {isTogglingMemberStatus && <Loader2 className="size-4 animate-spin" />}
                    {willUnlock ? 'Xác nhận mở khóa' : 'Xác nhận khóa'}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* TAB 3: Incident & Support Ticket Command Center */}
      {activeTab === 'tickets-management' && (
        <Card>
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="size-5 text-primary" /> Trung Tâm Xử Lý Báo Cáo & Yêu Cầu Hỗ Trợ
            </CardTitle>
            <CardAction className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Tìm mã ticket, tên khách..."
                  value={ticketSearchQuery}
                  onChange={(e) => setTicketSearchQuery(e.target.value)}
                />
              </div>
              <Select value={ticketCategoryFilter} onValueChange={setTicketCategoryFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  <SelectItem value="lost_found">Đồ thất lạc (Lost & Found)</SelectItem>
                  <SelectItem value="freeze_request">Yêu cầu bảo lưu gói tập</SelectItem>
                  <SelectItem value="equipment">Hỏng máy / CSVC</SelectItem>
                  <SelectItem value="coach_feedback">Phản ánh Huấn luyện viên</SelectItem>
                  <SelectItem value="other">Yêu cầu khác</SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            {/* Status Filter Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              <Button
                variant={ticketStatusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTicketStatusFilter('all')}
              >
                Tất Cả ({tickets.length})
              </Button>
              <Button
                variant={ticketStatusFilter === 'open' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setTicketStatusFilter('open')}
              >
                Chờ BQL Duyệt ({tickets.filter(t => t.status === 'open').length})
              </Button>
              <Button
                variant={ticketStatusFilter === 'in_progress' ? 'secondary' : 'outline'}
                size="sm"
                className={ticketStatusFilter === 'in_progress' ? 'bg-warning/20 text-warning border-warning' : ''}
                onClick={() => setTicketStatusFilter('in_progress')}
              >
                Đang Xử Lý / Giao Việc ({tickets.filter(t => t.status === 'in_progress').length})
              </Button>
              <Button
                variant={ticketStatusFilter === 'resolved' ? 'secondary' : 'outline'}
                size="sm"
                className={ticketStatusFilter === 'resolved' ? 'bg-success/20 text-success border-success' : ''}
                onClick={() => setTicketStatusFilter('resolved')}
              >
                Đã Giải Quyết Xong ({tickets.filter(t => t.status === 'resolved').length})
              </Button>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="size-10 text-success mx-auto mb-2" />
                <h4 className="font-semibold text-foreground">Không có báo cáo nào trong danh mục này!</h4>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTickets.map(t => {
                  const cat = categoryMeta(t.category);
                  return (
                    <div key={t.id} className="p-4 rounded-lg border bg-card text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-primary">{t.ticketCode || t.id.toUpperCase()}</span>
                          <Badge variant={cat.variant}>{cat.label}</Badge>
                        </div>
                        <Badge variant={t.status === 'open' ? 'destructive' : t.status === 'in_progress' ? 'warning' : 'success'}>
                          {t.status === 'open' ? 'Chờ BQL duyệt' : t.status === 'in_progress' ? 'Đang xử lý' : 'Đã giải quyết'}
                        </Badge>
                      </div>

                      <h4 className="font-semibold text-foreground text-base">{t.title}</h4>
                      <p className="text-muted-foreground text-sm mt-1">{t.description}</p>

                      <div className="flex flex-wrap justify-between items-center text-xs text-muted-foreground mt-3 pt-3 border-t">
                        <div>
                          Hội viên: <strong className="text-foreground">{t.memberName}</strong> ({t.memberPhone}) • Người tạo: {t.createdBy}
                        </div>
                        <div>{new Date(t.createdAt).toLocaleString('vi-VN')}</div>
                      </div>

                      {t.adminResponse && (
                        <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20 text-xs">
                          <div className="flex justify-between items-center font-semibold text-primary mb-1">
                            <span>CHỈ ĐẠO CỦA BQL (Giao cho: {t.actionRequiredBy?.toUpperCase()})</span>
                            {t.respondedAt && <span>{new Date(t.respondedAt).toLocaleTimeString('vi-VN')}</span>}
                          </div>
                          <p className="text-foreground">{t.adminResponse}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 mt-3 pt-2">
                        {t.status !== 'resolved' && (
                          <Button variant="outline" size="sm" onClick={() => handleQuickResolveTicket(t)}>
                            <Check className="size-3.5" /> Đóng Trực Tiếp
                          </Button>
                        )}
                        <Button size="sm" onClick={() => handleOpenResponseModal(t)}>
                          <Send className="size-3.5" /> Chỉ Đạo / Giao Việc
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ticket Response Modal Dialog */}
      <Dialog open={!!respondingTicket} onOpenChange={(open) => { if (!open) setRespondingTicket(null); }}>
        <DialogContent className="max-w-xl">
          {respondingTicket && (
            <form onSubmit={handleSaveAdminResponse}>
              <DialogHeader>
                <DialogTitle>Chỉ Đạo Xử Lý: {respondingTicket.title}</DialogTitle>
                <DialogDescription>Mã: {respondingTicket.ticketCode} • Hội viên: {respondingTicket.memberName}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-3">
                <Field label="Ý kiến chỉ đạo & Phương án giải quyết *">
                  <Textarea
                    rows={4}
                    required
                    placeholder="VD: Lễ tân liên hệ trả đồ cho khách; Kỹ thuật kiểm tra dây cáp..."
                    value={adminResponseText}
                    onChange={(e) => setAdminResponseText(e.target.value)}
                  />
                </Field>

                <Field label="Bộ phận chịu trách nhiệm xử lý (Assignee)">
                  <Select value={targetAssignee} onValueChange={(v) => setTargetAssignee(v as any)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Nhân Viên Quầy (Staff)</SelectItem>
                      <SelectItem value="technician">Bộ Phận Kỹ Thuật & Bảo Trì</SelectItem>
                      <SelectItem value="coach">Huấn Luyện Viên</SelectItem>
                      <SelectItem value="admin">Ban Quản Lý trực tiếp</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Cập nhật trạng thái">
                  <Select value={targetStatus} onValueChange={(v) => setTargetStatus(v as any)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_progress">🟡 Đang Chỉ Đạo Xử Lý (Giao việc)</SelectItem>
                      <SelectItem value="resolved">🟢 Phê Duyệt & Đóng Hoàn Tất (Resolved)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRespondingTicket(null)}>Hủy Bỏ</Button>
                <Button type="submit"><Send className="size-4" /> Ban Hành Chỉ Đạo</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {activeTab === 'pt-calendar' && <PtMasterCalendar />}
      {/* TAB 4: Coaches Management & Pricing */}
      {activeTab === 'coaches-config' && (
        <Card>
          <CardHeader>
            <CardTitle>Quản Trị Huấn Luyện Viên & Bảng Giá Dạy Lẻ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map(c => {
                const isUserLocked = Boolean(c.userAccountStatus && c.userAccountStatus !== 'ACTIVE');
                return (
                <div key={c.id} className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-sm">
                  <div>
                    <div className="mb-4 flex items-start gap-3">
                      <Avatar className="size-12 shrink-0">
                        <AvatarImage src={c.avatar} alt={c.name} />
                        <AvatarFallback>{c.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{c.name}</span>
                          <Badge variant={rankVariant(c.rank)}>{c.rank.toUpperCase()}</Badge>
                          {isUserLocked ? (
                            <Badge variant="destructive" className="text-[10px]">TK BỊ KHÓA</Badge>
                          ) : (
                            <Badge variant={c.isAcceptingBookings ? "success" : "secondary"} className="text-[10px]">
                              {c.isAcceptingBookings ? "ACTIVE" : "OFF"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.code} • {c.phone}</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Cấp độ PT được hướng dẫn</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.ptLevels?.length ? ptLevels.filter(level => c.ptLevels?.includes(level)).map(level =>
                          <Badge key={level} variant="outline" className="border-primary/30 bg-primary/5 text-primary">{level}</Badge>
                        ) : <span className="text-xs text-muted-foreground">Chưa cấu hình cấp độ</span>}
                      </div>
                    </div>

                    <div className="p-3 rounded-md bg-muted/50 text-xs mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Đơn giá buổi dạy lẻ:</span>
                        <strong className="text-primary font-bold text-sm">{c.hourlyRateVND.toLocaleString('vi-VN')} đ</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hoa hồng Coach nhận:</span>
                        <strong className="text-success font-semibold">{c.commissionPercent}%</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingCoach(c);
                        setNewHourlyRate(c.hourlyRateVND);
                        setNewCommission(c.commissionPercent);
                        setNewRank(c.rank);
                        setNewPtLevels(c.ptLevels ?? []);
                        setCoachFormError('');
                      }}
                    >
                      <Edit3 className="size-3.5" /> Chỉnh sửa HLV
                    </Button>
                    <Button
                      variant={c.isAcceptingBookings ? "ghost" : "outline"}
                      size="sm"
                      disabled={isUserLocked && !c.isAcceptingBookings}
                      title={isUserLocked ? 'Tài khoản HLV đang bị khóa ở cấp hệ thống' : undefined}
                      className={
                        isUserLocked && !c.isAcceptingBookings
                          ? 'text-muted-foreground'
                          : c.isAcceptingBookings
                          ? 'text-destructive hover:text-destructive'
                          : 'text-success'
                      }
                      onClick={() => handleToggleCoachStatus(c)}
                    >
                      {c.isAcceptingBookings ? "Tạm Ngưng" : "Kích Hoạt"}
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coach configuration: pricing and allowed PT levels share one save. */}
      <Dialog open={!!editingCoach} onOpenChange={(open) => { if (!open) setEditingCoach(null); }}>
        <DialogContent className="max-w-lg">
          {editingCoach && (
            <form onSubmit={handleSaveCoachPricing}>
              <DialogHeader>
                <DialogTitle>Cấu hình HLV {editingCoach.name}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-3">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Cấp độ PT được phép hướng dẫn</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {ptLevels.map(level => <label key={level} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${newPtLevels.includes(level) ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-border hover:bg-muted/40'}`}>
                      <input type="checkbox" className="size-4 accent-primary" checked={newPtLevels.includes(level)}
                        onChange={event => setNewPtLevels(current => event.target.checked ? [...current, level] : current.filter(item => item !== level))} />
                      {level}
                    </label>)}
                  </div>
                </fieldset>
                <Field label="Cấp Bậc Chuyên Môn">
                  <Select value={newRank} onValueChange={(v) => setNewRank(v as any)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">JUNIOR COACH (Khởi điểm)</SelectItem>
                      <SelectItem value="senior">SENIOR COACH (Kinh nghiệm &gt; 3 năm)</SelectItem>
                      <SelectItem value="master">MASTER COACH (Vận động viên / Bằng Quốc tế)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Đơn Giá Dạy Lẻ 1 Buổi (VNĐ) *">
                  <Input
                    type="number"
                    min={0}
                    required
                    placeholder="250000"
                    value={newHourlyRate}
                    onChange={(e) => setNewHourlyRate(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </Field>

                <Field label="Tỷ Lệ Hoa Hồng Thực Nhận (% — từ 0 đến 100)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    required
                    placeholder="50"
                    value={newCommission}
                    onChange={(e) => setNewCommission(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  />
                </Field>
              </div>

              {coachFormError && <p role="alert" className="mb-3 text-sm text-destructive">{coachFormError}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" disabled={savingCoachConfig} onClick={() => setEditingCoach(null)}>Hủy Bỏ</Button>
                <Button type="submit" disabled={savingCoachConfig}>{savingCoachConfig ? 'Đang lưu...' : 'Lưu cấu hình HLV'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Coach Deactivation Check Modal: full wide view, no clipping, no cramped inner scroll */}
      <Dialog
        open={!!deactivatingCoach}
        onOpenChange={(open) => {
          if (!open && !deactivationSubmitting) {
            setDeactivatingCoach(null);
            setDeactivationCheck(null);
            setDeactivationError('');
          }
        }}
      >
        <DialogContent className="flex w-[95vw] max-w-[95vw] sm:max-w-5xl max-h-[94vh] flex-col gap-0 overflow-hidden p-0">
          {deactivatingCoach && (
            <>
              <DialogHeader className="border-b px-5 py-3 text-left">
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <span className="flex size-7 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <ShieldAlert className="size-4" />
                  </span>
                  <span>Tạm Ngưng HLV — {deactivatingCoach.name}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3.5">
                {deactivationLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                    Đang kiểm tra học viên và lịch dạy của HLV...
                  </div>
                ) : !deactivationCheck ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>Không tải được dữ liệu kiểm tra</AlertTitle>
                    <AlertDescription>
                      {deactivationError || 'Không thể kiểm tra học viên và lịch dạy của HLV lúc này. Vui lòng thử lại.'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* 3 Clean Summary KPI Cards */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${deactivationCheck.summary.activePtStudentCount > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-emerald-200 bg-emerald-50/70'}`}>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Học viên chưa hết hạn gói PT</p>
                          <p className={`mt-1 text-2xl font-bold tracking-tight ${deactivationCheck.summary.activePtStudentCount > 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                            {deactivationCheck.summary.activePtStudentCount} người
                          </p>
                        </div>
                        <Users className={`size-6 opacity-70 ${deactivationCheck.summary.activePtStudentCount > 0 ? 'text-destructive' : 'text-emerald-600'}`} />
                      </div>

                      {(() => {
                        const ptPendingExtra =
                          deactivationCheck.summary.pendingMakeupCount +
                          (deactivationCheck.summary.pendingCoachChangeCount ?? 0) +
                          (deactivationCheck.summary.pendingAttendanceReviewCount ?? 0);
                        const hasPtObligation = deactivationCheck.summary.upcomingPtBookingCount > 0 || ptPendingExtra > 0;
                        return (
                          <div className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${hasPtObligation ? 'border-destructive/30 bg-destructive/5' : 'border-emerald-200 bg-emerald-50/70'}`}>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Lịch dạy PT & yêu cầu chờ</p>
                              <p className={`mt-1 text-2xl font-bold tracking-tight ${hasPtObligation ? 'text-destructive' : 'text-emerald-700'}`}>
                                {deactivationCheck.summary.upcomingPtBookingCount} buổi
                                {ptPendingExtra > 0 && (
                                  <span className="ml-1.5 text-sm font-semibold">+{ptPendingExtra} chờ xử lý</span>
                                )}
                              </p>
                            </div>
                            <Calendar className={`size-6 opacity-70 ${hasPtObligation ? 'text-destructive' : 'text-emerald-600'}`} />
                          </div>
                        );
                      })()}

                      <div className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${deactivationCheck.summary.upcomingGroupClassCount > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-emerald-200 bg-emerald-50/70'}`}>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Lớp nhóm sắp diễn ra</p>
                          <p className={`mt-1 text-2xl font-bold tracking-tight ${deactivationCheck.summary.upcomingGroupClassCount > 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                            {deactivationCheck.summary.upcomingGroupClassCount} lớp
                          </p>
                        </div>
                        <Dumbbell className={`size-6 opacity-70 ${deactivationCheck.summary.upcomingGroupClassCount > 0 ? 'text-destructive' : 'text-emerald-600'}`} />
                      </div>
                    </div>

                    {/* Status Banner */}
                    {deactivationCheck.canDeactivate ? (
                      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <div>
                          <p className="font-semibold">Đủ điều kiện tạm ngưng HLV</p>
                          <p className="text-xs text-emerald-800/90 mt-0.5">
                            HLV không còn học viên nào có gói PT đang hiệu lực và không có lịch dạy PT hay lớp nhóm nào sắp tới.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <div>
                          <p className="font-semibold">Không thể tạm ngưng HLV lúc này</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-destructive/90">
                            {deactivationCheck.blockingMessage}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Detailed Full Sections (2-column grid on desktop, no cramped scroll boxes) */}
                    {!deactivationCheck.canDeactivate && (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Column 1: Active PT Students + Pending Makeups */}
                        <div className="space-y-4">
                          {deactivationCheck.activePtPackages.length > 0 && (
                            <div className="rounded-xl border bg-card">
                              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                                <h4 className="flex items-center gap-2 text-sm font-semibold">
                                  <Users className="size-4 text-primary" />
                                  Học viên chưa hết hạn gói PT
                                </h4>
                                <Badge variant="secondary">{deactivationCheck.summary.activePtStudentCount} người</Badge>
                              </div>
                              <div className="divide-y">
                                {deactivationCheck.activePtPackages.map((pkg) => (
                                  <div key={`${pkg.sourceType}-${pkg.sourceId}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-foreground">{pkg.memberName}</div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                                        {pkg.memberPhone && <span>{pkg.memberPhone}</span>}
                                        <span>•</span>
                                        <span>{pkg.packageName}</span>
                                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{pkg.level}</Badge>
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <div className="font-semibold text-foreground">
                                        Còn {pkg.remainingSessions} buổi
                                        {pkg.heldSessions > 0 && <span className="font-normal text-muted-foreground"> (+{pkg.heldSessions} đã đặt)</span>}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">HSD: {memberDate(pkg.endAt)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {deactivationCheck.pendingMakeupRequests.length > 0 && (
                            <div className="rounded-xl border bg-card">
                              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                                <h4 className="flex items-center gap-2 text-sm font-semibold">
                                  <Clock className="size-4 text-amber-600" />
                                  Yêu cầu học bù PT chờ xử lý
                                </h4>
                                <Badge variant="secondary">{deactivationCheck.pendingMakeupRequests.length}</Badge>
                              </div>
                              <div className="divide-y">
                                {deactivationCheck.pendingMakeupRequests.map((mk) => (
                                  <div key={mk.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                                    <span className="font-medium">
                                      {mk.memberName} <span className="text-muted-foreground">(Booking #{mk.originalBookingId})</span>
                                    </span>
                                    <span className="shrink-0 text-muted-foreground">Hạn bù: {memberDate(mk.expiresAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column 2: Upcoming PT Bookings + Upcoming Group Classes */}
                        <div className="space-y-4">
                          {deactivationCheck.upcomingPtBookings.length > 0 && (
                            <div className="rounded-xl border bg-card">
                              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                                <h4 className="flex items-center gap-2 text-sm font-semibold">
                                  <Calendar className="size-4 text-primary" />
                                  Lịch dạy PT chưa hoàn thành
                                </h4>
                                <Badge variant="secondary">{deactivationCheck.upcomingPtBookings.length} buổi</Badge>
                              </div>
                              <div className="divide-y">
                                {deactivationCheck.upcomingPtBookings.map((b) => (
                                  <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-foreground">{b.memberName}</div>
                                      <div className="mt-0.5 text-muted-foreground">
                                        {new Date(b.startTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}
                                        {' - '}
                                        {new Date(b.endTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}
                                        {' • '}
                                        {new Date(b.startTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="shrink-0 text-[10px]">{b.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {deactivationCheck.upcomingGroupClasses.length > 0 && (
                            <div className="rounded-xl border bg-card">
                              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                                <h4 className="flex items-center gap-2 text-sm font-semibold">
                                  <Dumbbell className="size-4 text-primary" />
                                  Lịch lớp nhóm đang phụ trách
                                </h4>
                                <Badge variant="secondary">{deactivationCheck.upcomingGroupClasses.length} lớp</Badge>
                              </div>
                              <div className="divide-y">
                                {deactivationCheck.upcomingGroupClasses.map((cls) => {
                                  const otherActiveTrainers = activeGroupClassTrainers.filter(
                                    (t) => t.userId !== deactivationCheck.coachUserId
                                  );
                                  const selectedTarget =
                                    reassignTrainerBySchedule[cls.id] ?? otherActiveTrainers[0]?.userId ?? 0;
                                  const isBusy = groupClassActionLoadingId === cls.id;
                                  return (
                                  <div key={cls.id} className="space-y-2 px-4 py-2.5 text-xs">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="font-semibold text-foreground">{cls.className}</div>
                                        <div className="mt-0.5 text-muted-foreground">
                                          {new Date(cls.startTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}
                                          {' - '}
                                          {new Date(cls.endTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}
                                          {' • '}
                                          {new Date(cls.startTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' })}
                                          {cls.roomName ? ` • ${cls.roomName}` : ''}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="shrink-0 text-[10px]">{cls.bookedCount}/{cls.capacity}</Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {otherActiveTrainers.length > 0 && (
                                        <>
                                          <Select
                                            value={String(selectedTarget)}
                                            onValueChange={(v) =>
                                              setReassignTrainerBySchedule((prev) => ({ ...prev, [cls.id]: Number(v) }))
                                            }
                                            disabled={isBusy}
                                          >
                                            <SelectTrigger size="sm" className="h-7 flex-1 min-w-[140px] text-xs">
                                              <SelectValue placeholder="Chọn HLV thay" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {otherActiveTrainers.map((t) => (
                                                <SelectItem key={t.userId} value={String(t.userId)}>
                                                  {t.user?.fullName || `HLV #${t.userId}`}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            disabled={isBusy || !selectedTarget}
                                            onClick={() => void handleReassignGroupClassSchedule(cls.id, selectedTarget)}
                                          >
                                            {isBusy ? <Loader2 className="size-3 animate-spin" /> : 'Đổi HLV'}
                                          </Button>
                                        </>
                                      )}
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-destructive hover:text-destructive"
                                        disabled={isBusy}
                                        onClick={() => void handleCancelGroupClassSchedule(cls.id)}
                                      >
                                        Hủy ca
                                      </Button>
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {(deactivationCheck.pendingCoachChangeRequests?.length > 0 ||
                            deactivationCheck.pendingAttendanceReviews?.length > 0) && (
                            <div className="rounded-xl border bg-card">
                              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                                <h4 className="flex items-center gap-2 text-sm font-semibold">
                                  <AlertCircle className="size-4 text-amber-600" />
                                  Yêu cầu đổi HLV / điểm danh chờ chốt
                                </h4>
                                <Badge variant="secondary">
                                  {(deactivationCheck.pendingCoachChangeRequests?.length || 0) +
                                    (deactivationCheck.pendingAttendanceReviews?.length || 0)}
                                </Badge>
                              </div>
                              <div className="divide-y">
                                {(deactivationCheck.pendingCoachChangeRequests || []).map((req) => (
                                  <div key={`cc-${req.id}`} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                                    <span>Xin đổi sang HLV này: <strong>{req.memberName}</strong> ({req.level})</span>
                                    <Badge variant="outline" className="text-[10px]">Chờ duyệt</Badge>
                                  </div>
                                ))}
                                {(deactivationCheck.pendingAttendanceReviews || []).map((rev) => (
                                  <div key={`ar-${rev.id}`} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                                    <span>Buổi #{rev.bookingId} — <strong>{rev.memberName}</strong></span>
                                    <Badge variant="outline" className="text-[10px]">Chờ điểm danh</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {!deactivationCheck.canDeactivate && (
                      <label className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-destructive cursor-pointer"
                          checked={forceDeactivateCoach}
                          onChange={(e) => setForceDeactivateCoach(e.target.checked)}
                        />
                        <span className="leading-relaxed text-foreground">
                          <strong>Bỏ qua ràng buộc nghĩa vụ và tạm ngưng ngay</strong> (dùng khi HLV nghỉ đột xuất/vi phạm kỷ luật; học viên còn gói PT sẽ tự động được miễn phí đổi HLV).
                        </span>
                      </label>
                    )}
                  </>
                )}

                {deactivationCheck && deactivationError && (
                  <p role="alert" className="text-sm text-destructive">{deactivationError}</p>
                )}
              </div>

              <DialogFooter className="border-t bg-muted/20 px-6 py-3.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={deactivationSubmitting}
                  onClick={() => {
                    setDeactivatingCoach(null);
                    setDeactivationCheck(null);
                    setDeactivationError('');
                    setForceDeactivateCoach(false);
                  }}
                >
                  Đóng
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deactivationLoading || deactivationSubmitting || (!deactivationCheck?.canDeactivate && !forceDeactivateCoach)}
                  onClick={handleConfirmDeactivateCoach}
                >
                  {deactivationSubmitting ? 'Đang xử lý...' : 'Xác nhận Tạm Ngưng HLV'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* TAB 5: Packages & Services */}
      {activeTab === 'packages-engine' && (
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Quản lý gói tập Gym và buổi tập PT</CardTitle>
            <CardAction className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsPtCreditOpen(true)}>
                Quản lý buổi PT
              </Button>
              <Button onClick={() => setIsCreatingPackage(true)}>
                <Plus className="size-4" /> Tạo gói Gym
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {packageLoadError && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <span>Không tải được gói tập: {packageLoadError}</span>
                <Button size="sm" variant="outline" onClick={() => void loadPackages()}>Thử lại</Button>
              </div>
            )}
            {ptProductLoadError && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <span>Không tải được gói PT: {ptProductLoadError}</span>
                <Button size="sm" variant="outline" onClick={() => void loadPtProducts()}>Thử lại</Button>
              </div>
            )}
            <div className="mb-5 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold">Trạng thái kinh doanh</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={isLoadingPackages || isLoadingPtProducts} onClick={() => { void loadPackages(); void loadPtProducts(); }}>
                  {isLoadingPackages || isLoadingPtProducts ? 'Đang tải...' : 'Tải lại'}
                </Button>
                <Button size="sm" variant={packageStatusFilter === 'all' ? 'default' : 'outline'} onClick={() => setPackageStatusFilter('all')}>
                  Tất cả ({catalogCount})
                </Button>
                <Button size="sm" variant={packageStatusFilter === 'active' ? 'default' : 'outline'} onClick={() => setPackageStatusFilter('active')}>
                  Đang bán ({activeCatalogCount})
                </Button>
                <Button size="sm" variant={packageStatusFilter === 'inactive' ? 'default' : 'outline'} onClick={() => setPackageStatusFilter('inactive')}>
                  Đã ngừng bán ({catalogCount - activeCatalogCount})
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePackages.map(pkg => (
                <div key={pkg.id} className={`flex flex-col justify-between rounded-lg border bg-card p-4 ${pkg.isActive === false ? 'border-dashed border-muted-foreground/50 bg-muted/30' : ''}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-foreground text-base">{pkg.name}</h4>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge variant={pkg.type === 'hybrid_pt' ? 'soft' : pkg.type === 'specialized_course' ? 'info' : 'secondary'}>
                          {pkg.type === 'hybrid_pt' ? 'Gói PT cũ' : pkg.type === 'specialized_course' ? 'Khóa học' : 'Gói Gym'}
                        </Badge>
                        <Badge className={pkg.isActive === false ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}>
                          {pkg.type === 'hybrid_pt' ? 'PT LỊCH SỬ' : pkg.isActive === false ? 'ĐÃ NGỪNG BÁN' : 'ĐANG BÁN'}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-xl font-bold text-primary mb-2">
                      {pkg.priceVND.toLocaleString('vi-VN')} <span className="text-xs font-normal text-muted-foreground">đ / {pkg.durationMonths} Tháng</span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3">{pkg.description}</p>

                    {pkg.ptSessionsIncluded > 0 && (
                      <div className="text-xs text-success font-medium mb-3">
                        ✓ Bao gồm: {pkg.ptSessionsIncluded} buổi tập cùng HLV cá nhân
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
                    <div>
                      {pkg.features.slice(0, 2).map((f, i) => (
                        <div key={i}>• {f}</div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pkg.type === 'hybrid_pt'}
                        onClick={() => handleOpenEditPackage(pkg)}
                        title="Chỉnh sửa gói tập"
                        aria-label={`Chỉnh sửa gói ${pkg.name}`}
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pkg.type === 'hybrid_pt'}
                        className={pkg.isActive === false ? 'text-emerald-700 hover:text-emerald-800' : 'text-destructive hover:text-destructive'}
                        onClick={() => handleTogglePackageStatus(pkg)}
                        title={pkg.isActive === false ? 'Bật bán lại gói' : 'Ngừng bán gói'}
                        aria-label={pkg.isActive === false ? `Bật bán lại gói ${pkg.name}` : `Ngừng bán gói ${pkg.name}`}
                      >
                        {pkg.isActive === false ? <CheckCircle2 className="size-4" /> : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {visiblePtProducts.map(product => (
                <div key={`pt-${product.id}`} className={`flex flex-col justify-between rounded-lg border bg-card p-4 ${!product.isActive ? 'border-dashed border-muted-foreground/50 bg-muted/30' : ''}`}>
                  <div>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h4 className="text-base font-semibold text-foreground">{product.name}</h4>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge variant="soft">Gói buổi PT</Badge>
                        <Badge className={product.isActive ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}>
                          {product.isActive ? 'ĐANG BÁN' : 'ĐÃ NGỪNG BÁN'}
                        </Badge>
                      </div>
                    </div>
                    <div className="mb-2 text-xl font-bold text-primary">{Number(product.price).toLocaleString('vi-VN')} <span className="text-xs font-normal text-muted-foreground">đ / gói</span></div>
                    <p className="text-sm text-muted-foreground">{product.sessionCount} buổi tập cùng HLV · Cấp độ {product.level === 'BEGINNER' ? 'Cơ bản' : product.level === 'INTERMEDIATE' ? 'Trung cấp' : product.level === 'ADVANCED' ? 'Nâng cao' : product.level} · {product.durationDays ? `${product.durationDays} ngày sử dụng` : 'Chưa cấu hình thời hạn'}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span>Hội viên mua để đặt lịch PT</span>
                    {product.isActive && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => void handleArchivePtProduct(product)} title="Ngừng bán gói PT" aria-label={`Ngừng bán gói PT ${product.name}`}>
                      <Trash2 className="size-4" />
                    </Button>}
                  </div>
                </div>
              ))}
              {!packageLoadError && !ptProductLoadError && visiblePackages.length + visiblePtProducts.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {isLoadingPackages || isLoadingPtProducts ? 'Đang tải gói tập...' : catalogCount === 0 ? 'Chưa có gói Gym hoặc PT nào trong cơ sở dữ liệu.' : 'Không có gói nào trong trạng thái này.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Package Dialog */}
      <Dialog open={isCreatingPackage} onOpenChange={setIsCreatingPackage}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSavePackage}>
            <DialogHeader>
              <DialogTitle>Tạo Gói Tập Mới</DialogTitle>
              <DialogDescription>Gói Gym được bán theo thời hạn. Số buổi PT tặng kèm là buổi trải nghiệm, không phải gói PT mua riêng.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              <Field label="Tên Gói Tập *">
                <Input
                  required
                  placeholder="VD: Gói Gym 30 ngày"
                  value={newPackageForm.name}
                  onChange={(e) => setNewPackageForm({ ...newPackageForm, name: e.target.value })}
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Loại Gói">
                  <Select value={newPackageForm.type} onValueChange={(v) => setNewPackageForm(current => ({ ...current, type: v as 'MEMBERSHIP' | 'PT' }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBERSHIP">Gói Gym (thẻ hội viên)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Thời Hạn Sử Dụng (Ngày) *">
                  <Input
                    type="number"
                    min="1"
                    required
                    placeholder="30"
                    value={newPackageForm.durationDays === 0 ? '' : newPackageForm.durationDays}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, durationDays: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0 })}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Giá Niêm Yết (VNĐ) *">
                  <Input
                    type="number"
                    step="50000"
                    required
                    placeholder="0"
                    value={newPackageForm.price === 0 ? '' : newPackageForm.price}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, price: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0 })}
                  />
                </Field>

                <Field label={newPackageForm.type === 'PT' ? 'Tổng Số Buổi PT 1:1 *' : 'Số Buổi PT Tặng Kèm'}>
                  <Input
                    type="number"
                    min={newPackageForm.type === 'PT' ? 1 : 0}
                    required={newPackageForm.type === 'PT'}
                    placeholder="0"
                    value={
                      newPackageForm.type === 'PT'
                        ? (newPackageForm.totalPtSessions === 0 ? '' : newPackageForm.totalPtSessions)
                        : (newPackageForm.trialPtSessions === 0 ? '' : newPackageForm.trialPtSessions)
                    }
                    onChange={(e) => {
                      const value = e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10) || 0;
                      setNewPackageForm(current => current.type === 'PT'
                        ? { ...current, totalPtSessions: value }
                        : { ...current, trialPtSessions: value });
                    }}
                  />
                </Field>
              </div>
              {newPackageForm.type === 'MEMBERSHIP' && <p className="text-xs text-muted-foreground">Nhập 0 nếu gói Gym không tặng buổi PT trải nghiệm. Buổi PT mua riêng được tạo trong “Quản lý buổi PT”.</p>}
              {newPackageForm.type === 'PT' && <p className="text-xs text-muted-foreground">Đây là số buổi PT khách mua trong gói, không phải số buổi tặng kèm.</p>}

              <Field label="Mô Tả Gói">
                <Textarea
                  rows={3}
                  value={newPackageForm.description}
                  onChange={(e) => setNewPackageForm({ ...newPackageForm, description: e.target.value })}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatingPackage(false)}>Hủy Bỏ</Button>
              <Button type="submit" disabled={packageLoading}>
                {packageLoading ? 'Đang lưu...' : 'Lưu Gói Tập'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Package Dialog */}
      <Dialog open={isEditingPackage} onOpenChange={setIsEditingPackage}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveEditPackage}>
            <DialogHeader>
              <DialogTitle>Cập Nhật Gói Tập (REST API)</DialogTitle>
              <DialogDescription>Chỉnh sửa giá tiền, số ngày sử dụng và số buổi kèm PT.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              <Field label="Tên Gói Tập *">
                <Input
                  required
                  value={editPackageForm.name}
                  onChange={(e) => setEditPackageForm({ ...editPackageForm, name: e.target.value })}
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Loại Gói">
                  <Select value={editPackageForm.type} onValueChange={(v) => setEditPackageForm({ ...editPackageForm, type: v as any })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBERSHIP">MEMBERSHIP (Thẻ Hội Viên)</SelectItem>
                      <SelectItem value="PT">PT (Gói Kèm 1:1 Riêng)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Thời Hạn Sử Dụng (Ngày) *">
                  <Input
                    type="number"
                    min="1"
                    required
                    placeholder="30"
                    value={editPackageForm.durationDays === 0 ? '' : editPackageForm.durationDays}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, durationDays: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0 })}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Giá Bán Niêm Yết (VNĐ) *">
                  <Input
                    type="number"
                    step="50000"
                    required
                    placeholder="0"
                    value={editPackageForm.price === 0 ? '' : editPackageForm.price}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, price: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0 })}
                  />
                </Field>

                <Field label={editPackageForm.type === 'PT' ? 'Tổng Số Buổi PT 1:1 *' : 'Số Buổi PT Tặng Thử'}>
                  <Input
                    type="number"
                    min={editPackageForm.type === 'PT' ? 1 : 0}
                    required={editPackageForm.type === 'PT'}
                    placeholder="0"
                    value={
                      editPackageForm.type === 'PT'
                        ? (editPackageForm.totalPtSessions === 0 ? '' : editPackageForm.totalPtSessions)
                        : (editPackageForm.trialPtSessions === 0 ? '' : editPackageForm.trialPtSessions)
                    }
                    onChange={(e) => {
                      const val = e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0;
                      if (editPackageForm.type === 'PT') {
                        setEditPackageForm({ ...editPackageForm, totalPtSessions: val });
                      } else {
                        setEditPackageForm({ ...editPackageForm, trialPtSessions: val });
                      }
                    }}
                  />
                </Field>
              </div>

              <Field label="Mô Tả Gói">
                <Textarea
                  rows={3}
                  value={editPackageForm.description}
                  onChange={(e) => setEditPackageForm({ ...editPackageForm, description: e.target.value })}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditingPackage(false)}>Hủy Bỏ</Button>
              <Button type="submit" disabled={packageLoading}>
                {packageLoading ? 'Đang lưu...' : 'Lưu Cập Nhật'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPtCreditOpen} onOpenChange={setIsPtCreditOpen}>
        <DialogContent className="max-h-[92vh] min-w-0 overflow-y-auto sm:max-w-5xl">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Dumbbell className="size-5 text-primary" />
              Quản Lý Buổi Tập PT & Ví Hội Viên
            </DialogTitle>
            <DialogDescription>
              Thiết lập danh mục gói buổi tập, cấu hình bảng giá gia hạn và tra cứu, kiểm soát ví số buổi của hội viên.
            </DialogDescription>
          </DialogHeader>
          {isPtCreditOpen && <PtCreditAdmin onProductsChanged={loadPtProducts} />}
        </DialogContent>
      </Dialog>

      {/* TAB: Facilities & Equipments Management */}
      {activeTab === 'facilities' && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <CardTitle>Quản Lý Cơ Sở Vật Chất & Thiết Bị Phòng Tập</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingRoomId(null);
                      setRoomForm({ name: '', type: 'FITNESS', capacity: 30, isActive: true });
                      setIsCreatingRoom(true);
                    }}
                  >
                    <Plus className="size-4" /> Thêm Phòng Mới
                  </Button>
                  <Button
                    disabled={rooms.length === 0}
                    title={rooms.length === 0 ? 'Vui lòng tạo phòng tập trước khi thêm thiết bị' : undefined}
                    onClick={() => {
                      setEditingEquipmentId(null);
                      setEquipmentForm({ name: '', code: '', roomId: rooms[0]?.id ?? 0, status: 'AVAILABLE', note: '' });
                      setIsCreatingEquipment(true);
                    }}
                  >
                    <Plus className="size-4" /> Thêm Thiết Bị
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                  <Wrench className="size-10 mx-auto text-primary mb-2 opacity-60" />
                  <p className="font-semibold text-foreground">Chưa có dữ liệu phòng tập trong cơ sở dữ liệu</p>
                  <p className="text-xs mt-1">Bấm nút "Thêm Phòng Mới" để thiết lập không gian tập luyện đầu tiên.</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {rooms.map(room => (
                    <div key={room.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                            #{room.id}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-base">{room.name}</div>
                            <div className="text-xs text-muted-foreground">Loại: {room.type} • Sức chứa: {room.capacity} người</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={room.isActive !== false ? "success" : "secondary"}>
                            {room.isActive !== false ? "ĐANG HOẠT ĐỘNG" : "TẠM NGƯNG"}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditingRoomId(room.id);
                              setRoomForm({
                                name: room.name,
                                type: room.type,
                                capacity: room.capacity,
                                isActive: room.isActive !== false,
                              });
                              setIsCreatingRoom(true);
                            }}
                          >
                            <Edit3 className="size-3" /> Sửa
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={`h-7 text-xs ${room.isActive !== false ? 'text-destructive hover:text-destructive' : 'text-success hover:text-success'}`}
                            onClick={() => void handleToggleRoomActive(room)}
                          >
                            {room.isActive !== false ? 'Tạm ngưng' : 'Kích hoạt'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t">
                        <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
                          Danh Sách Thiết Bị ({room.equipments?.length || 0})
                        </div>
                        {!room.equipments || room.equipments.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic py-2">
                            Chưa có thiết bị nào trong phòng này. Bấm "Thêm Thiết Bị" để bổ sung máy tập.
                          </div>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {room.equipments.map(eq => {
                              const isAvailable = eq.status === 'AVAILABLE';
                              const isMaint = eq.status === 'MAINTENANCE' || eq.status === 'UNDER_MAINTENANCE';
                              const normalizedSelectValue = eq.status === 'UNDER_MAINTENANCE' ? 'MAINTENANCE' : eq.status;
                              const badgeLabel = isAvailable ? 'SẴN SÀNG' : isMaint ? 'BẢO TRÌ' : 'HỎNG HÓC';
                              return (
                                <div key={eq.id} className="p-3 rounded-md border bg-muted/30 flex flex-col justify-between text-xs">
                                  <div>
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                      <strong className="text-foreground">{eq.name}</strong>
                                      <Badge variant={isAvailable ? "success" : isMaint ? "warning" : "destructive"}>
                                        {badgeLabel}
                                      </Badge>
                                    </div>
                                    <div className="text-muted-foreground text-[11px] mb-1">Mã: {eq.code}</div>
                                    <div className="text-muted-foreground text-[11px] italic">
                                      Ghi chú: {eq.note || 'Chưa có ghi chú'}
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center gap-1.5 mt-3 pt-2 border-t border-border/50">
                                    <Select
                                      value={normalizedSelectValue}
                                      onValueChange={(val) => handleUpdateEquipmentStatus(eq.id, val as any)}
                                    >
                                      <SelectTrigger className="h-7 text-[11px] w-28">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="AVAILABLE">SẴN SÀNG</SelectItem>
                                        <SelectItem value="MAINTENANCE">BẢO TRÌ</SelectItem>
                                        <SelectItem value="BROKEN">HỎNG HÓC</SelectItem>
                                      </SelectContent>
                                    </Select>

                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-primary hover:text-primary"
                                        onClick={() => {
                                          setEditingEquipmentId(eq.id);
                                          setEquipmentForm({
                                            name: eq.name,
                                            code: eq.code,
                                            roomId: eq.roomId || room.id,
                                            status: normalizedSelectValue,
                                            note: eq.note || '',
                                          });
                                          setIsCreatingEquipment(true);
                                        }}
                                        title="Sửa thông tin & ghi chú"
                                      >
                                        <Edit3 className="size-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteEquipment(eq.id)}
                                        title="Xóa thiết bị"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: Group Classes & Schedules Management */}
      {activeTab === 'group-classes' && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <CardTitle>Danh Mục Lớp Học ({groupClasses.length})</CardTitle>
                </div>
                <Button onClick={() => setIsCreatingClass(true)}>
                  <Plus className="size-4" /> Tạo Lớp Học Mới
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {groupClasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <p className="font-semibold text-foreground">Chưa có lớp học nào</p>
                  <p className="text-xs mt-1">Bấm nút "Tạo Lớp Học Mới" ở trên để tạo lớp học đầu tiên.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên Lớp Học</TableHead>
                      <TableHead>Thời Lượng</TableHead>
                      <TableHead>Mô Tả</TableHead>
                      <TableHead className="text-center">Số Ca Đã Xếp Lịch</TableHead>
                      <TableHead className="text-right">Thao Tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupClasses.map(groupClass => {
                      const scheduleCount = groupClassSchedules.filter(s => s.classId === groupClass.id).length;
                      return (
                        <TableRow key={groupClass.id}>
                          <TableCell className="font-bold text-foreground">
                            {groupClass.name}
                            <span className="text-xs text-muted-foreground ml-1.5 font-normal">#{groupClass.id}</span>
                          </TableCell>
                          <TableCell>{groupClass.durationMin} phút</TableCell>
                          <TableCell className="max-w-md truncate text-muted-foreground text-xs">{groupClass.description || '—'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="text-xs font-semibold">
                              {scheduleCount} ca tập
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => openCreateScheduleModal(groupClass.id)}
                            >
                              <Plus className="size-3" /> Mở ca lịch
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <CardTitle>Quản Lý Lớp Học Nhóm & Lên Lịch Ca Tập</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => openCreateScheduleModal()}>
                    <Plus className="size-4" /> Mở Ca Lịch Tập
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingGroupClasses ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" /> Đang tải lịch lớp học nhóm...
                </div>
              ) : groupClassError ? (
                <div className="text-center py-10 text-destructive">
                  <p>{groupClassError}</p>
                  <Button variant="outline" className="mt-3" onClick={() => void reloadData()}>Thử lại</Button>
                </div>
              ) : groupClassSchedules.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                  <Layers className="size-10 mx-auto text-primary mb-2 opacity-60" />
                  <p className="font-semibold text-foreground">Chưa có lịch ca tập nào trong hệ thống</p>
                  <p className="text-xs mt-1">Bấm nút "Mở Ca Lịch Tập" ở trên để bắt đầu lên lịch.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên Lớp Học</TableHead>
                      <TableHead>HLV Phụ Trách</TableHead>
                      <TableHead>Phòng Tập</TableHead>
                      <TableHead>Khung Giờ</TableHead>
                      <TableHead>Chỗ Đã Đặt</TableHead>
                      <TableHead>Trạng Thái</TableHead>
                      <TableHead className="text-right">Thao Tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupClassSchedules.map(sch => {
                      const startTimeStr = new Date(sch.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
                      const endTimeStr = new Date(sch.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const canManageSchedule = ['OPEN', 'FULL'].includes(sch.status) && new Date(sch.endTime) > new Date();
                      const isRowBusy = groupClassActionLoadingId === sch.id;
                      return (
                        <TableRow key={sch.id}>
                          <TableCell className="font-bold text-foreground">
                            {sch.groupClass?.name || `Lớp #${sch.classId}`}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7">
                                <AvatarImage src={sch.trainer?.avatar || undefined} />
                                <AvatarFallback>{sch.trainer?.fullName?.slice(0, 1) || 'C'}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-xs">{sch.trainer?.fullName || 'Coach'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{sch.room?.name || 'Phòng Chung'}</TableCell>
                          <TableCell className="font-mono text-xs">{startTimeStr} - {endTimeStr}</TableCell>
                          <TableCell>
                            <span className="font-bold text-primary">{sch.bookedCount || 0}</span> / {sch.capacity}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sch.status === 'OPEN' ? 'success' : sch.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                              {sch.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canManageSchedule ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={isRowBusy}
                                  onClick={() => {
                                    const fallbackTrainer = activeGroupClassTrainers.find((t) => t.userId !== sch.trainerId)?.userId ?? 0;
                                    setEditingScheduleForReassign(sch);
                                    setNextScheduleTrainerId(fallbackTrainer);
                                  }}
                                >
                                  Đổi HLV
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-destructive hover:text-destructive"
                                  disabled={isRowBusy}
                                  onClick={() => void handleCancelGroupClassSchedule(sch.id)}
                                >
                                  Hủy ca
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create / Edit Room Dialog */}
      <Dialog open={isCreatingRoom} onOpenChange={(open) => { setIsCreatingRoom(open); if (!open) setEditingRoomId(null); }}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveRoom}>
            <DialogHeader>
              <DialogTitle>{editingRoomId ? 'Chỉnh Sửa Phòng Tập' : 'Thêm Phòng Tập Mới'}</DialogTitle>
              <DialogDescription>
                {editingRoomId ? 'Cập nhật tên, loại không gian, sức chứa hoặc trạng thái hoạt động.' : 'Tạo phòng tập mới vào hệ thống cơ sở vật chất AURA Fitness.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <Field label="Tên Phòng *">
                <Input
                  required
                  placeholder="VD: Phòng Gym Khu Tạ Rogue"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                />
              </Field>
              <Field label="Loại Không Gian">
                <Select value={roomForm.type} onValueChange={(v) => setRoomForm({ ...roomForm, type: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FITNESS">FITNESS / GYM (Tạ & Máy)</SelectItem>
                    <SelectItem value="YOGA">YOGA & PILATES</SelectItem>
                    <SelectItem value="CYCLING">CYCLING (Đạp Xe Trong Nhà)</SelectItem>
                    <SelectItem value="BOXING">BOXING & MARTIAL ARTS</SelectItem>
                    <SelectItem value="SAUNA">SAUNA & SPA</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sức Chứa Tối Đa (Người) *">
                <Input
                  type="number"
                  min="1"
                  required
                  placeholder="20"
                  value={roomForm.capacity === 0 ? '' : roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0 })}
                />
              </Field>
              {editingRoomId && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={roomForm.isActive}
                    onChange={(e) => setRoomForm({ ...roomForm, isActive: e.target.checked })}
                  />
                  <span>Phòng đang hoạt động (cho phép mở lịch lớp nhóm)</span>
                </label>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsCreatingRoom(false); setEditingRoomId(null); }}>Hủy Bỏ</Button>
              <Button type="submit">{editingRoomId ? 'Lưu Thay Đổi' : 'Lưu Phòng Tập'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Equipment Dialog */}
      <Dialog open={isCreatingEquipment} onOpenChange={(open) => { setIsCreatingEquipment(open); if (!open) setEditingEquipmentId(null); }}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEquipment}>
            <DialogHeader>
              <DialogTitle>{editingEquipmentId ? 'Cập Nhật Thiết Bị & Ghi Chú' : 'Thêm Thiết Bị Vào Phòng Tập'}</DialogTitle>
              <DialogDescription>
                {editingEquipmentId ? 'Chỉnh sửa tên, mã định danh, phòng đặt máy, trạng thái hoặc ghi chú bảo trì.' : 'Ghi nhận máy tập mới hoặc tạ đơn vào danh mục quản lý.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <Field label="Tên Thiết Bị *">
                <Input
                  required
                  placeholder="VD: Máy Kéo Cáp Đôi Technogym"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                />
              </Field>
              <Field label="Mã Định Danh (Code) *">
                <Input
                  required
                  placeholder="VD: EQ-CABLE-01"
                  value={equipmentForm.code}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, code: e.target.value })}
                />
              </Field>
              <Field label="Phòng Đặt Máy *">
                <Select
                  value={equipmentForm.roomId ? String(equipmentForm.roomId) : (rooms[0] ? String(rooms[0].id) : undefined)}
                  onValueChange={(v) => setEquipmentForm({ ...equipmentForm, roomId: parseInt(v) })}
                  disabled={rooms.length === 0}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn phòng tập" /></SelectTrigger>
                  <SelectContent>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name} (#{r.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {editingEquipmentId && (
                <Field label="Trạng Thái Hiện Tại">
                  <Select
                    value={equipmentForm.status}
                    onValueChange={(v) => setEquipmentForm({ ...equipmentForm, status: v })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">SẴN SÀNG</SelectItem>
                      <SelectItem value="MAINTENANCE">BẢO TRÌ</SelectItem>
                      <SelectItem value="BROKEN">HỎNG HÓC</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Ghi Chú Kỹ Thuật / Tình Trạng">
                <Textarea
                  rows={2}
                  placeholder="VD: Trọng lượng tạ tối đa 120kg, hoặc ghi rõ lỗi hỏng cần sửa..."
                  value={equipmentForm.note}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, note: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsCreatingEquipment(false); setEditingEquipmentId(null); }}>Hủy Bỏ</Button>
              <Button type="submit" disabled={rooms.length === 0}>{editingEquipmentId ? 'Lưu Thiết Bị' : 'Thêm Thiết Bị'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Class Dialog */}
      <Dialog open={isCreatingClass} onOpenChange={setIsCreatingClass}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveClass}>
            <DialogHeader>
              <DialogTitle>Tạo Danh Mục Lớp Học Mới</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <Field label="Tên Lớp Học *">
                <Input
                  required
                  placeholder="VD: HIIT Burn Fat 45', Power Yoga"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                />
              </Field>
              <Field label="Thời Lượng (Phút) *">
                <Input
                  type="number"
                  min="15"
                  max="180"
                  required
                  placeholder="60"
                  value={classForm.durationMin === 0 ? '' : classForm.durationMin}
                  onChange={(e) => setClassForm({ ...classForm, durationMin: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Mô Tả Lớp">
                <Textarea
                  rows={2}
                  placeholder="Mô tả nội dung bài tập và đối tượng phù hợp..."
                  value={classForm.description}
                  onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatingClass(false)}>Hủy Bỏ</Button>
              <Button type="submit">Lưu Lớp Học</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Schedule Dialog */}
      <Dialog open={isCreatingSchedule} onOpenChange={setIsCreatingSchedule}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveSchedule}>
            <DialogHeader>
              <DialogTitle>Mở Lịch Ca Tập Lớp Học Nhóm</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <Field label="Lớp Học *">
                <Select
                  value={scheduleForm.classId ? String(scheduleForm.classId) : undefined}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, classId: parseInt(v) })}
                  disabled={groupClasses.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={groupClasses.length === 0 ? "Chưa có lớp học nào" : "Chọn lớp học"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groupClasses.map(groupClass => (
                      <SelectItem key={groupClass.id} value={String(groupClass.id)}>
                        {groupClass.name} ({groupClass.durationMin} phút)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Huấn Luyện Viên Phụ Trách *">
                <Select
                  value={scheduleForm.trainerId ? String(scheduleForm.trainerId) : undefined}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, trainerId: parseInt(v) })}
                  disabled={activeGroupClassTrainers.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={activeGroupClassTrainers.length === 0 ? 'Không có HLV đang hoạt động' : 'Chọn HLV phụ trách'} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGroupClassTrainers.map(trainer => (
                      <SelectItem key={trainer.userId} value={String(trainer.userId)}>
                        {trainer.user?.fullName || `HLV #${trainer.userId}`} (User #{trainer.userId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Phòng Tập">
                {(() => {
                  const activeRooms = rooms.filter((r) => r.isActive !== false);
                  return (
                    <Select
                      value={scheduleForm.roomId ? String(scheduleForm.roomId) : (activeRooms[0] ? String(activeRooms[0].id) : undefined)}
                      onValueChange={(v) => setScheduleForm({ ...scheduleForm, roomId: parseInt(v) })}
                      disabled={activeRooms.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={activeRooms.length === 0 ? 'Không có phòng đang hoạt động' : 'Chọn phòng tập'} />
                      </SelectTrigger>
                      <SelectContent>
                        {activeRooms.map(r => (
                          <SelectItem key={r.id} value={String(r.id)}>{r.name} (Tối đa {r.capacity} người)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </Field>
              {(() => {
                const selectedClass = groupClasses.find(c => c.id === Number(scheduleForm.classId));
                const durationMin = selectedClass?.durationMin || 60;
                const autoEndTime = scheduleForm.startTime
                  ? computeScheduleEndLocal(scheduleForm.startTime, durationMin)
                  : '';
                const firstStartDt = parseGymDateTimeLocal(scheduleForm.startTime);
                const firstWeekday = Number.isNaN(firstStartDt.getTime()) ? null : getGymIsoWeekday(firstStartDt);
                const previewSlots = buildSchedulePreviewSlots(
                  scheduleForm.startTime,
                  durationMin,
                  scheduleForm.repeatMode,
                  scheduleForm.repeatCount,
                  scheduleForm.repeatDays,
                );
                return (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Giờ Bắt Đầu (Buổi đầu) *">
                          <Input
                            type="datetime-local"
                            required
                            min={toGymDateTimeLocal(new Date())}
                            value={scheduleForm.startTime}
                            onChange={(e) => {
                              const nextStart = e.target.value;
                              const nextDt = parseGymDateTimeLocal(nextStart);
                              const nextWeekday = Number.isNaN(nextDt.getTime()) ? null : getGymIsoWeekday(nextDt);
                              setScheduleForm(prev => ({
                                ...prev,
                                startTime: nextStart,
                                repeatDays:
                                  nextWeekday && !prev.repeatDays.includes(nextWeekday)
                                    ? [...prev.repeatDays, nextWeekday].sort((a, b) => a - b)
                                    : prev.repeatDays,
                              }));
                            }}
                          />
                        </Field>
                        <Field label="Giờ Kết Thúc (Tự động)">
                          <Input
                            type="datetime-local"
                            readOnly
                            disabled
                            value={autoEndTime}
                          />
                        </Field>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Tự động tính theo thời lượng lớp ({durationMin} phút) · Giờ phòng tập (UTC+7).
                      </p>
                    </div>

                    <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">Lặp Lại Nhiều Buổi</span>
                        <div className="inline-flex rounded-md border bg-background p-0.5">
                          {(
                            [
                              { id: 'SINGLE', label: '1 buổi' },
                              { id: 'DAILY', label: 'Hằng ngày' },
                              { id: 'WEEKLY', label: 'Hằng tuần' },
                            ] as const
                          ).map(mode => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() =>
                                setScheduleForm(prev => ({
                                  ...prev,
                                  repeatMode: mode.id,
                                  repeatCount:
                                    mode.id === 'SINGLE'
                                      ? 1
                                      : prev.repeatCount < 2
                                      ? 4
                                      : prev.repeatCount,
                                  repeatDays:
                                    mode.id === 'WEEKLY' && firstWeekday && !prev.repeatDays.includes(firstWeekday)
                                      ? [...prev.repeatDays, firstWeekday].sort((a, b) => a - b)
                                      : prev.repeatDays,
                                }))
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                                scheduleForm.repeatMode === mode.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {scheduleForm.repeatMode !== 'SINGLE' && (
                        <div className="space-y-2.5 pt-1">
                          <div className="grid sm:grid-cols-2 gap-3 items-end">
                            <Field label="Tổng Số Buổi Cần Mở (2–30) *">
                              <Input
                                type="number"
                                min={2}
                                max={30}
                                required
                                value={scheduleForm.repeatCount === 0 ? '' : scheduleForm.repeatCount}
                                onChange={(e) =>
                                  setScheduleForm(prev => ({
                                    ...prev,
                                    repeatCount: e.target.value === '' ? 0 : Math.min(30, parseInt(e.target.value, 10) || 0),
                                  }))
                                }
                              />
                            </Field>
                            {scheduleForm.repeatMode === 'WEEKLY' && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-medium text-muted-foreground block">
                                  Các thứ trong tuần
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {VN_WEEKDAY_LABELS.map(item => {
                                    const isFirstDay = firstWeekday === item.day;
                                    const active = isFirstDay || scheduleForm.repeatDays.includes(item.day);
                                    return (
                                      <button
                                        key={item.day}
                                        type="button"
                                        disabled={isFirstDay}
                                        title={isFirstDay ? 'Ngày bắt đầu luôn được chọn' : undefined}
                                        onClick={() => {
                                          if (isFirstDay) return;
                                          setScheduleForm(prev => ({
                                            ...prev,
                                            repeatDays: prev.repeatDays.includes(item.day)
                                              ? prev.repeatDays.filter(d => d !== item.day)
                                              : [...prev.repeatDays, item.day].sort((a, b) => a - b),
                                          }));
                                        }}
                                        className={`px-2 py-1 text-[11px] font-semibold rounded border transition-colors ${
                                          active
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background text-muted-foreground border-input hover:text-foreground'
                                        } ${isFirstDay ? 'opacity-80 cursor-not-allowed' : ''}`}
                                      >
                                        {item.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {previewSlots.length > 0 && (
                            <div className="rounded border bg-background/80 px-2.5 py-2 space-y-1">
                              <p className="text-[11px] font-semibold text-foreground">
                                Xem trước {previewSlots.length} ca sẽ tạo:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {previewSlots.slice(0, 6).map((slot, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-[10px] font-normal">
                                    #{idx + 1}:{' '}
                                    {slot.start.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit' })}{' '}
                                    ({slot.start.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}–
                                    {slot.end.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })})
                                  </Badge>
                                ))}
                                {previewSlots.length > 6 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    +{previewSlots.length - 6} buổi nữa
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              <Field label="Sức Chứa Giới Hạn (Chỗ Ngồi) *">
                <Input
                  type="number"
                  min="5"
                  max="100"
                  required
                  placeholder="20"
                  value={scheduleForm.capacity === 0 ? '' : scheduleForm.capacity}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, capacity: e.target.value === '' ? ('' as any) : parseInt(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatingSchedule(false)}>Hủy Bỏ</Button>
              <Button type="submit" disabled={groupClasses.length === 0 || activeGroupClassTrainers.length === 0 || !scheduleForm.trainerId}>
                {scheduleForm.repeatMode !== 'SINGLE' && scheduleForm.repeatCount > 1
                  ? `Tạo ${scheduleForm.repeatCount} Ca Lịch`
                  : 'Lên Lịch Ngay'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reassign Group Class Trainer Dialog */}
      <Dialog open={!!editingScheduleForReassign} onOpenChange={(open) => { if (!open && groupClassActionLoadingId === null) setEditingScheduleForReassign(null); }}>
        <DialogContent className="max-w-md">
          {editingScheduleForReassign && (() => {
            const candidates = activeGroupClassTrainers.filter((t) => t.userId !== editingScheduleForReassign.trainerId);
            const busy = groupClassActionLoadingId === editingScheduleForReassign.id;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Đổi HLV Phụ Trách Lớp Nhóm</DialogTitle>
                  <DialogDescription>
                    {editingScheduleForReassign.groupClass?.name || `Lớp #${editingScheduleForReassign.classId}`} • Hiện tại: {editingScheduleForReassign.trainer?.fullName || 'Coach'}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Field label="Chọn HLV thay thế đang hoạt động">
                    <Select
                      value={nextScheduleTrainerId ? String(nextScheduleTrainerId) : undefined}
                      onValueChange={(v) => setNextScheduleTrainerId(Number(v))}
                      disabled={candidates.length === 0 || busy}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={candidates.length === 0 ? 'Không còn HLV hoạt động khác' : 'Chọn HLV mới'} />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map((t) => (
                          <SelectItem key={t.userId} value={String(t.userId)}>
                            {t.user?.fullName || `HLV #${t.userId}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setEditingScheduleForReassign(null)}>
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    disabled={busy || !nextScheduleTrainerId || candidates.length === 0}
                    onClick={() => void handleReassignGroupClassSchedule(editingScheduleForReassign.id, nextScheduleTrainerId)}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Xác nhận đổi HLV
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* TAB 6: RBAC & Audit Trail */}
      {activeTab === 'audit-rbac' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Card>
            <CardHeader>
              <CardTitle>Ma Trận Phân Quyền (RBAC)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-xs">
              <div className="p-3.5 rounded-lg border bg-muted/40">
                <strong className="text-primary text-sm">1. Center Manager (Quản lý)</strong>
                <p className="text-muted-foreground mt-1">
                  Toàn quyền hệ thống: Doanh thu BI, cấu hình bảng giá Coach, tạo gói tập, phân quyền và duyệt ngoại lệ.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border bg-muted/40">
                <strong className="text-success text-sm">2. Staff (Nhân viên lễ tân quầy)</strong>
                <p className="text-muted-foreground mt-1">
                  Quét check-in QR, đăng ký thành viên mới tại quầy, thu tiền mặt/chuyển khoản, in hóa đơn K80, tiếp nhận yêu cầu hỗ trợ.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border bg-muted/40">
                <strong className="text-sky-600 dark:text-sky-400 text-sm">3. Coach (Huấn luyện viên)</strong>
                <p className="text-muted-foreground mt-1">
                  Xem lịch dạy, điểm danh buổi tập, xử lý vắng mặt/học bù, ghi nhận tạ/rep, tạo kế hoạch dinh dưỡng và gợi ý bài tập bằng AI.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Nhật Ký Kiểm Toán (Audit Trail)</CardTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isLoadingAuditLogs}
                  onClick={() => void loadAuditLogs()}
                >
                  {isLoadingAuditLogs ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Làm mới
                </Button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void loadAuditLogs(auditSearchQuery);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-8 text-xs"
                    placeholder="Tìm theo action (VD: MEMBER_LOCKED), tên người thao tác hoặc đối tượng..."
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" variant="secondary" className="h-8 text-xs">
                  Tìm
                </Button>
              </form>
            </CardHeader>
            <CardContent>
              {auditLogError ? (
                <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
                  {auditLogError}
                </div>
              ) : isLoadingAuditLogs && auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                  Đang tải nhật ký kiểm toán...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground rounded-lg border border-dashed">
                  Chưa có bản ghi nhật ký kiểm toán nào phù hợp.
                </div>
              ) : (
                <div className="grid gap-2 max-h-[460px] overflow-y-auto pr-1 pb-12">
                  {auditLogs.map(log => {
                    const isLockAction = log.action.includes('LOCKED');
                    const isUnlockAction = log.action.includes('UNLOCKED') || log.action.includes('ACTIVATED');
                    const { actionLabel, target, details } = formatAuditDisplay(log);
                    const compactTime = new Date(log.timestamp).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    });
                    return (
                      <div key={log.id} className="px-3 py-2.5 rounded-lg border bg-muted/40 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <Badge
                              variant={isLockAction ? 'destructive' : isUnlockAction ? 'success' : 'secondary'}
                              className="px-1.5 py-0 text-[10px] font-semibold"
                            >
                              {actionLabel}
                            </Badge>
                            <span className="font-semibold text-foreground truncate">{target}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
                            <span>{log.actorName}</span>
                            <Badge variant="outline" className="px-1 py-0 text-[9px]">{String(log.actorRole).toUpperCase()}</Badge>
                            <span title={new Date(log.timestamp).toLocaleString('vi-VN')}>• {compactTime}</span>
                          </div>
                        </div>
                        <div className="text-muted-foreground break-words whitespace-pre-line leading-relaxed pt-0.5">{details}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </StaffPage>
  );
};
