import React, { useState, useEffect, useRef } from 'react';
import { Member, Coach, PackagePlan, AuditLog, Invoice, SupportTicket } from '../../types';
import { api, ApiPackage, ApiUser, ApiCoachProfile, ApiSubscription, ApiRoom, ApiEquipment, ApiGroupClass, ApiGroupClassSchedule, ApiMemberProfile360 } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import {
  BarChart3,
  Users,
  Dumbbell,
  Layers,
  ShieldAlert,
  TrendingUp,
  Calendar,
  DollarSign,
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
  Loader2
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
import { StatCard, StaffPage, Field } from '@/components/staff/StaffKit';
import { PtMasterCalendar } from './PtMasterCalendar';
import { PtCreditAdmin } from './PtCreditAdmin';

const ptLevels = ['TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const memberDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

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
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  // Member 360 Modal State (Luồng 8)
  const [inspectingMember, setInspectingMember] = useState<Member | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Coach Price Editing Modal State (Luồng 9)
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [newHourlyRate, setNewHourlyRate] = useState(400000);
  const [newCommission, setNewCommission] = useState(50);
  const [newRank, setNewRank] = useState<'junior' | 'senior' | 'master'>('senior');
  const [newPtLevels, setNewPtLevels] = useState<string[]>([]);
  const [savingCoachConfig, setSavingCoachConfig] = useState(false);
  const [coachFormError, setCoachFormError] = useState('');

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
  const [roomForm, setRoomForm] = useState({ name: '', type: 'FITNESS', capacity: 30 });
  const [isCreatingEquipment, setIsCreatingEquipment] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState({ name: '', code: '', roomId: 0, note: '' });

  // Group Classes & Schedules State
  const [groupClasses, setGroupClasses] = useState<ApiGroupClass[]>([]);
  const [groupClassSchedules, setGroupClassSchedules] = useState<ApiGroupClassSchedule[]>([]);
  const [isLoadingGroupClasses, setIsLoadingGroupClasses] = useState(false);
  const [groupClassError, setGroupClassError] = useState<string | null>(null);
  const [groupClassTrainers, setGroupClassTrainers] = useState<ApiCoachProfile[]>([]);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', description: '', durationMin: 60, imageUrl: '' });
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    classId: 0,
    trainerId: 1,
    roomId: 0,
    startTime: '',
    endTime: '',
    capacity: 20
  });

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

  const reloadData = async () => {
    setIsLoadingGroupClasses(true);
    setGroupClassError(null);
    // 1. Fetch live Gym packages and PT products from backend
    await Promise.all([loadPackages(), loadPtProducts()]);

    // 2. Fetch live Members from backend
    try {
      const membersRes = await api.admin.getMembersList({ limit: 50 });
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
          isAcceptingBookings: t.status === 'ACTIVE',
          activeTraineeCount: 8
        }));
        setCoaches(mappedCoaches);
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách HLV admin:', e);
    }

    // 4. Fetch Subscriptions / Invoices from backend
    try {
      const subsRes = await api.subscriptions.getAllSubscriptions({ limit: 50 });
      if (subsRes.data) {
        const mappedInvoices: Invoice[] = subsRes.data.map((s) => ({
          id: 'inv-' + s.id,
          code: `INV-${1000 + s.id}`,
          memberId: String(s.userId),
          memberName: s.user?.fullName || `Hội viên #${s.userId}`,
          memberPhone: '0900000000',
          items: [{
            name: s.package?.name || 'Gói tập',
            quantity: 1,
            unitPriceVND: Number(s.package?.price || 500000),
            amountVND: Number(s.package?.price || 500000)
          }],
          subtotalVND: Number(s.package?.price || 500000),
          discountVND: 0,
          totalVND: Number(s.package?.price || 500000),
          paymentMethod: 'vietqr',
          status: 'paid',
          staffName: 'Admin Hệ Thống',
          createdAt: s.createdAt || new Date().toISOString()
        }));
        setInvoices(mappedInvoices);
      }
    } catch (e) {
      console.warn('Lỗi tải hóa đơn admin:', e);
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
      const liveSchedules = await api.groupClasses.getAllSchedules();
      setGroupClassSchedules(liveSchedules || []);
    } catch (e: any) {
      console.warn('Lỗi tải lịch lớp học nhóm admin:', e);
      setGroupClassError(e.message || 'Không tải được lịch lớp học nhóm');
    } finally {
      setIsLoadingGroupClasses(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'packages-engine') {
      void loadPackages();
      void loadPtProducts();
    }
  }, [activeTab]);

  // Total Revenue Calculation
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalVND, 0);

  // Global Time Range Filter State
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | 'month' | 'quarter' | 'year'>('month');

  // Dynamic metrics & trend series based on timeFilter
  const timeFilteredData = React.useMemo(() => {
    const baseRev = totalRevenue > 0 ? totalRevenue : 11250000;
    switch (timeFilter) {
      case 'today':
        return {
          label: 'Hôm Nay',
          subLabel: 'Số liệu 24 giờ qua',
          revenue: Math.round(baseRev * 0.12),
          growth: '+8.4%',
          membersCount: members.length,
          activeCheckIns: 142,
          chartData: [
            { label: '06:00', rev: 1.2, checkins: 28 },
            { label: '09:00', rev: 0.8, checkins: 14 },
            { label: '12:00', rev: 1.5, checkins: 32 },
            { label: '15:00', rev: 0.9, checkins: 18 },
            { label: '18:00', rev: 3.4, checkins: 76 },
            { label: '21:00', rev: 0.8, checkins: 22 },
          ]
        };
      case '7days':
        return {
          label: '7 Ngày Qua',
          subLabel: 'Tuần vận hành hiện tại',
          revenue: Math.round(baseRev * 0.42),
          growth: '+14.6%',
          membersCount: members.length,
          activeCheckIns: 840,
          chartData: [
            { label: 'Thứ 2', rev: 5.4, checkins: 110 },
            { label: 'Thứ 3', rev: 6.8, checkins: 125 },
            { label: 'Thứ 4', rev: 5.9, checkins: 118 },
            { label: 'Thứ 5', rev: 7.2, checkins: 134 },
            { label: 'Thứ 6', rev: 8.5, checkins: 146 },
            { label: 'Thứ 7', rev: 9.6, checkins: 162 },
            { label: 'Chủ Nhật', rev: 8.2, checkins: 145 },
          ]
        };
      case 'quarter':
        return {
          label: 'Quý Này (Q4)',
          subLabel: 'Tháng 10 - Tháng 12/2026',
          revenue: Math.round(baseRev * 2.8),
          growth: '+22.5%',
          membersCount: members.length,
          activeCheckIns: 3250,
          chartData: [
            { label: 'Tháng 10', rev: 38.5, checkins: 980 },
            { label: 'Tháng 11', rev: 44.2, checkins: 1120 },
            { label: 'Tháng 12', rev: 52.8, checkins: 1290 },
          ]
        };
      case 'year':
        return {
          label: 'Năm 2026',
          subLabel: 'Lũy kế cả năm tài chính',
          revenue: Math.round(baseRev * 9.5),
          growth: '+31.2%',
          membersCount: members.length,
          activeCheckIns: 12800,
          chartData: [
            { label: 'Quý 1', rev: 95.0, checkins: 2800 },
            { label: 'Quý 2', rev: 112.5, checkins: 3100 },
            { label: 'Quý 3', rev: 128.0, checkins: 3450 },
            { label: 'Quý 4 (Dự kiến)', rev: 145.2, checkins: 3890 },
          ]
        };
      case 'month':
      default:
        return {
          label: 'Tháng Này',
          subLabel: 'Tháng 10/2026',
          revenue: baseRev,
          growth: '+18.4%',
          membersCount: members.length,
          activeCheckIns: 1250,
          chartData: [
            { label: 'Tuần 1', rev: 2.4, checkins: 280 },
            { label: 'Tuần 2', rev: 3.1, checkins: 315 },
            { label: 'Tuần 3', rev: 3.6, checkins: 340 },
            { label: 'Tuần 4', rev: 4.2, checkins: 395 },
          ]
        };
    }
  }, [timeFilter, totalRevenue, members.length]);

  // Filtered members for Member 360
  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    m.phone.includes(memberSearchQuery) ||
    m.code.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  // Handle Save Coach Pricing (Luồng 9)
  const handleSaveCoachPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoach) return;

    setSavingCoachConfig(true);
    setCoachFormError('');
    try {
      await api.adminTrainers.updateTrainerPricing(editingCoach.id, {
        hourlyRate: newHourlyRate,
        commissionPercent: newCommission,
        rank: newRank,
        levels: newPtLevels,
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setEditingCoach(null);
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

  // Toggle Member Status (ACTIVE / BANNED)
  const handleToggleMemberStatus = async (userId: string | number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'BANNED' : 'ACTIVE';
    try {
      await api.users.updateUserStatus(userId, nextStatus);
      soundEffects.playSuccessBeep();
      await reloadData();
      alert(`Đã đổi trạng thái tài khoản thành công sang ${nextStatus}!`);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi đổi trạng thái: ${err.message}`);
    }
  };

  // Toggle Coach Status (ACTIVE / INACTIVE)
  const handleToggleCoachStatus = async (coachId: string | number, currentAccepting: boolean) => {
    const nextStatus = currentAccepting ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.adminTrainers.toggleTrainerStatus(coachId, nextStatus);
      soundEffects.playSuccessBeep();
      await reloadData();
      alert(`Đã cập nhật trạng thái HLV sang ${nextStatus}!`);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi cập nhật trạng thái HLV: ${err.message}`);
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
        name: roomForm.name,
        type: roomForm.type,
        capacity: Number(roomForm.capacity)
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingRoom(false);
      setRoomForm({ name: '', type: 'FITNESS', capacity: 30 });
      alert('Đã lưu phòng tập mới vào cơ sở dữ liệu!');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi tạo phòng tập: ${err.message}`);
    }
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.facility.createEquipment({
        name: equipmentForm.name,
        code: equipmentForm.code,
        roomId: Number(equipmentForm.roomId || (rooms[0]?.id || 1)),
        note: equipmentForm.note
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingEquipment(false);
      setEquipmentForm({ name: '', code: '', roomId: 0, note: '' });
      alert('Đã thêm thiết bị mới vào hệ thống!');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi thêm thiết bị: ${err.message}`);
    }
  };

  const handleUpdateEquipmentStatus = async (id: number, status: 'AVAILABLE' | 'MAINTENANCE' | 'BROKEN') => {
    try {
      await api.facility.updateEquipmentStatus(id, { status });
      soundEffects.playSuccessBeep();
      await reloadData();
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi cập nhật thiết bị: ${err.message}`);
    }
  };

  const handleDeleteEquipment = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xoá thiết bị này khỏi danh sách?')) return;
    try {
      await api.facility.deleteEquipment(id);
      soundEffects.playSuccessBeep();
      await reloadData();
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi xoá thiết bị: ${err.message}`);
    }
  };

  // Group Classes Handlers
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.groupClasses.createClass({
        name: classForm.name,
        description: classForm.description,
        durationMin: Number(classForm.durationMin || 60),
        imageUrl: classForm.imageUrl
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingClass(false);
      setClassForm({ name: '', description: '', durationMin: 60, imageUrl: '' });
      alert('Đã tạo lớp học nhóm mới thành công!');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi tạo lớp học: ${err.message}`);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.groupClasses.createSchedule({
        classId: Number(scheduleForm.classId),
        trainerId: Number(scheduleForm.trainerId),
        roomId: scheduleForm.roomId ? Number(scheduleForm.roomId) : undefined,
        startTime: new Date(scheduleForm.startTime).toISOString(),
        endTime: new Date(scheduleForm.endTime).toISOString(),
        capacity: Number(scheduleForm.capacity || 20)
      });
      soundEffects.playSuccessBeep();
      await reloadData();
      setIsCreatingSchedule(false);
      alert('Đã mở lịch ca tập mới thành công!');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi lên lịch: ${err.message}`);
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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
            <Calendar className="size-4 text-primary" />
            <span>Kỳ Thống Kê:</span>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {[
              { id: 'today', label: 'Hôm Nay' },
              { id: '7days', label: '7 Ngày Qua' },
              { id: 'month', label: 'Tháng Này' },
              { id: 'quarter', label: 'Quý Này' },
              { id: 'year', label: 'Cả Năm' },
            ].map(tf => {
              const isActive = timeFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => {
                    setTimeFilter(tf.id as any);
                    soundEffects.playSuccessBeep();
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${isActive
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

        <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
          <span className="inline-block size-2 rounded-full bg-success animate-pulse" />
          <span>{timeFilteredData.subLabel} • Dữ liệu thời gian thực</span>
        </div>
      </div>

      {/* Top BI Metric Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => {
            onTabChange('analytics');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={DollarSign}
            tone="primary"
            label={`Tổng Doanh Thu (${timeFilteredData.label})`}
            value={`${timeFilteredData.revenue.toLocaleString('vi-VN')} đ`}
            hint={
              <span className="text-success font-semibold flex items-center justify-between gap-1 text-xs">
                <span className="flex items-center gap-1">
                  <TrendingUp className="size-3.5" /> {timeFilteredData.growth}
                </span>
                <span className="text-primary font-semibold group-hover:underline">Chi tiết BI →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-primary/60 h-full ${activeTab === 'analytics' ? 'ring-2 ring-primary/40 border-primary shadow-xs' : ''
              }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange('members-360');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={Users}
            tone="success"
            label="Tổng Số Hội Viên"
            value={`${members.length} hội viên`}
            hint={
              <span className="flex items-center justify-between text-xs">
                <span>Tái ký: <strong className="text-success font-bold">86.5%</strong></span>
                <span className="text-success font-semibold group-hover:underline ml-1">Xem danh sách →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-success/60 h-full ${activeTab === 'members-360' ? 'ring-2 ring-success/40 border-success shadow-xs' : ''
              }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange('coaches-config');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={Dumbbell}
            tone="info"
            label="Đội Ngũ HLV"
            value={`${coaches.length} HLV active`}
            hint={
              <span className="flex items-center justify-between text-xs">
                <span>8.5 hv / Coach</span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold group-hover:underline ml-1">Quản lý HLV →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-sky-500/60 h-full ${activeTab === 'coaches-config' ? 'ring-2 ring-sky-500/40 border-sky-500 shadow-xs' : ''
              }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange('packages-engine');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={Layers}
            tone="warning"
            label="Gói Gym & PT"
            value={`${catalogCount} gói`}
            hint={
              <span className="flex items-center justify-between text-xs">
                <span>42% doanh thu</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:underline ml-1">Cấu hình gói →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-amber-500/60 h-full ${activeTab === 'packages-engine' ? 'ring-2 ring-amber-500/40 border-amber-500 shadow-xs' : ''
              }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange('tickets-management');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          {openTicketsCount > 0 && (
            <div className="absolute -top-2.5 right-2 z-10">
              <Badge variant="destructive" className="animate-pulse shadow-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border-2 border-background">
                ⚠ CẦN XỬ LÝ GẤP
              </Badge>
            </div>
          )}
          <StatCard
            icon={LifeBuoy}
            tone={openTicketsCount > 0 ? 'danger' : 'primary'}
            label="Báo Cáo / Sự Cố Chờ Duyệt"
            value={`${openTicketsCount} chờ BQL`}
            hint={
              <span className={openTicketsCount > 0 ? 'text-destructive font-bold flex items-center justify-between text-xs' : 'text-primary font-medium flex items-center justify-between text-xs'}>
                <span>{openTicketsCount > 0 ? `${openTicketsCount} sự cố khẩn cấp` : `${inProgressTicketsCount} đang xử lý`}</span>
                <span className="font-semibold group-hover:underline ml-1">Xem ngay →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md h-full ${openTicketsCount > 0
              ? 'border-destructive/80 bg-destructive/10 ring-2 ring-destructive/40 group-hover:border-destructive'
              : activeTab === 'tickets-management'
                ? 'ring-2 ring-primary/40 border-primary shadow-xs'
                : 'group-hover:border-primary/60'
              }`}
          />
        </button>
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
                <CardDescription className="text-foreground/75 font-medium">
                  Biểu đồ phân tích tương quan giữa doanh số bán thẻ và mật độ tập luyện ({timeFilteredData.label})
                </CardDescription>
              </div>

              {/* Chart Legend & Summary Chips */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50 text-xs font-semibold">
                  <span className="size-2.5 rounded-full bg-primary" />
                  <span className="text-foreground">Doanh Thu:</span>
                  <span className="text-primary font-bold">{timeFilteredData.revenue.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50 text-xs font-semibold">
                  <span className="size-2.5 rounded-full bg-sky-500" />
                  <span className="text-foreground">Check-in:</span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold">{timeFilteredData.activeCheckIns} lượt</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* SVG Growth Curve Area & Line Chart */}
              <div className="w-full overflow-x-auto">
                <div className="min-w-[580px] h-[210px] w-full pt-2">
                  <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="auraRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="auraSkyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="40" y1="30" x2="680" y2="30" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                    <line x1="40" y1="80" x2="680" y2="80" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                    <line x1="40" y1="130" x2="680" y2="130" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                    <line x1="40" y1="170" x2="680" y2="170" stroke="currentColor" strokeOpacity="0.15" />

                    {/* Y-axis labels */}
                    <text x="32" y="34" textAnchor="end" className="text-[10px] fill-foreground/60 font-semibold">Cao</text>
                    <text x="32" y="104" textAnchor="end" className="text-[10px] fill-foreground/60 font-semibold">TB</text>
                    <text x="32" y="174" textAnchor="end" className="text-[10px] fill-foreground/60 font-semibold">0</text>

                    {/* Area Polygon & Curve for Revenue */}
                    {(() => {
                      const data = timeFilteredData.chartData;
                      const stepX = (640 / Math.max(1, data.length - 1));
                      const maxRev = Math.max(...data.map(d => d.rev), 1);
                      const points = data.map((d, i) => {
                        const x = 50 + i * stepX;
                        const y = 170 - (d.rev / maxRev) * 135;
                        return { x, y, ...d };
                      });

                      const pathD = points.reduce((acc, p, i) => {
                        if (i === 0) return `M ${p.x} ${p.y}`;
                        const prev = points[i - 1];
                        const cx1 = prev.x + (p.x - prev.x) / 2;
                        const cx2 = cx1;
                        return `${acc} C ${cx1} ${prev.y}, ${cx2} ${p.y}, ${p.x} ${p.y}`;
                      }, '');

                      const areaD = `${pathD} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;

                      return (
                        <>
                          <path d={areaD} fill="url(#auraRevenueGrad)" />
                          <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
                          {points.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="5" fill="var(--bg-card)" stroke="var(--color-primary)" strokeWidth="2.5" />
                              <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[10px] font-bold fill-primary">
                                {p.rev}M
                              </text>
                              {/* Bottom X-axis label */}
                              <text x={p.x} y="190" textAnchor="middle" className="text-[11px] font-semibold fill-foreground/80">
                                {p.label}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Operational Breakdown Grid: Service Mix & Peak Hours vs Recent Invoices */}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Cơ Cấu Doanh Thu Theo Loại Dịch Vụ</CardTitle>
                <CardDescription className="text-foreground/75 font-medium">Phân tích tỷ trọng đóng góp vào ngân sách trung tâm</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5 font-semibold text-foreground">
                      <span>Gói VIP Hybrid (Gym + PT Quota)</span>
                      <span className="text-primary font-bold">52% (5.800.000 đ)</span>
                    </div>
                    <Progress value={52} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5 font-semibold text-foreground">
                      <span>Khóa Học Chuyên Biệt (Yoga, Boxing Bootcamp)</span>
                      <span className="text-sky-600 dark:text-sky-400 font-bold">34% (3.800.000 đ)</span>
                    </div>
                    <Progress value={34} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5 font-semibold text-foreground">
                      <span>Thẻ Standard Gym Tự Do</span>
                      <span className="text-success font-bold">14% (1.550.000 đ)</span>
                    </div>
                    <Progress value={14} className="h-2.5" />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-bold text-foreground mb-3">Mật Độ Hội Viên Theo Khung Giờ (Peak Hours)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 text-center">
                    {[
                      { time: '06:00 - 08:00', density: '65%', label: 'Vừa' },
                      { time: '08:00 - 11:00', density: '35%', label: 'Thấp' },
                      { time: '11:30 - 13:30', density: '50%', label: 'Vừa' },
                      { time: '14:00 - 17:00', density: '40%', label: 'Thấp' },
                      { time: '17:30 - 20:30', density: '95%', label: 'Rất Cao', peak: true },
                      { time: '20:30 - 22:00', density: '60%', label: 'Vừa' }
                    ].map((slot, i) => (
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
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Giao Dịch Gần Đây</CardTitle>
                <CardDescription className="text-foreground/75 font-medium">Nhật ký hóa đơn vừa thanh toán</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
                {invoices.map(inv => (
                  <div key={inv.id} className="p-3.5 rounded-lg border bg-card/90 hover:border-primary/50 transition-all text-xs shadow-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-foreground">{inv.memberName}</span>
                      <span className="font-extrabold text-sm text-primary">+{inv.totalVND.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="text-foreground/80 font-medium line-clamp-1">{inv.items[0]?.name}</div>
                    <div className="flex justify-between items-center text-foreground/75 mt-2.5 text-[11px] font-medium">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold border-border/80">{inv.paymentMethod}</Badge>
                      <span>{new Date(inv.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Member Management 360 */}
      {activeTab === 'members-360' && (
        <Card>
          <CardHeader>
            <CardTitle>Quản Lý Hồ Sơ Hội Viên</CardTitle>
            <CardDescription>Tra cứu đầy đủ thông tin cá nhân, gói tập, lịch sử check-in, hóa đơn và tiến độ</CardDescription>
            <CardAction>
              <div className="relative w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Tìm theo tên, SĐT, mã HV..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
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
                {filteredMembers.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={m.avatar} alt={m.name} />
                          <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground">{m.name}</div>
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
                          variant={m.status === 'active' ? 'ghost' : 'outline'}
                          size="sm"
                          className={m.status === 'active' ? 'text-destructive hover:text-destructive' : 'text-success'}
                          onClick={() => handleToggleMemberStatus(m.id, m.status)}
                        >
                          {m.status === 'active' ? 'Khóa' : 'Mở'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                        <div className="mt-3">
                          <Button
                            variant={inspectingMember.status === 'active' ? 'destructive' : 'default'}
                            size="sm"
                            onClick={() => {
                              handleToggleMemberStatus(inspectingMember.id, inspectingMember.status);
                              setInspectingMember(null);
                            }}
                          >
                            {inspectingMember.status === 'active' ? 'Khóa Tài Khoản Hội Viên' : 'Kích Hoạt Tài Khoản'}
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

      {/* TAB 3: Incident & Support Ticket Command Center */}
      {activeTab === 'tickets-management' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="size-5 text-primary" /> Trung Tâm Xử Lý Báo Cáo & Yêu Cầu Hỗ Trợ
            </CardTitle>
            <CardDescription>
              Tiếp nhận sự cố, bảo lưu và khiếu nại từ Lễ tân • Phê duyệt & Giao việc xử lý
            </CardDescription>
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
                <p className="text-xs mt-1">Hệ thống vận hành ổn định, không có sự cố nào tồn đọng.</p>
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
            <CardDescription>Quản lý cấp độ PT được phép hướng dẫn, cấp bậc, đơn giá và hoa hồng của từng HLV.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map(c => (
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
                          <Badge variant={c.isAcceptingBookings ? "success" : "secondary"} className="text-[10px]">
                            {c.isAcceptingBookings ? "ACTIVE" : "OFF"}
                          </Badge>
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
                      className={c.isAcceptingBookings ? "text-destructive hover:text-destructive" : "text-success"}
                      onClick={() => handleToggleCoachStatus(c.id, c.isAcceptingBookings)}
                    >
                      {c.isAcceptingBookings ? "Tạm Ngưng" : "Kích Hoạt"}
                    </Button>
                  </div>
                </div>
              ))}
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
                <DialogDescription>{editingCoach.code} • Cấp độ PT, cấp bậc và đơn giá được lưu cùng lúc.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-3">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Cấp độ PT được phép hướng dẫn</legend>
                  <p className="text-xs text-muted-foreground">Chỉ chọn cấp độ HLV đủ điều kiện. Lịch đã đặt sẽ được kiểm tra trước khi gỡ cấp độ.</p>
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
                    step="50000"
                    required
                    value={newHourlyRate}
                    onChange={(e) => setNewHourlyRate(parseInt(e.target.value) || 250000)}
                  />
                </Field>

                <Field label="Tỷ Lệ Hoa Hồng Thực Nhận (%)">
                  <Input
                    type="number"
                    min="30"
                    max="80"
                    required
                    value={newCommission}
                    onChange={(e) => setNewCommission(parseInt(e.target.value) || 50)}
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

      {/* TAB 5: Packages & Services */}
      {activeTab === 'packages-engine' && (
        <Card>
          <CardHeader>
            <CardTitle>Quản lý gói tập Gym và buổi tập PT</CardTitle>
            <CardDescription>Gói Gym cho hội viên vào phòng tập theo thời hạn. Buổi PT được mua riêng theo số buổi.</CardDescription>
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
            <div className="mb-5 grid gap-3 sm:grid-cols-2" aria-label="Giải thích các loại gói tập">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="font-semibold text-sm">Gói Gym</p>
                <p className="mt-1 text-sm text-muted-foreground">Hội viên mua để vào phòng tập trong số ngày đã chọn. Có thể tặng kèm buổi PT trải nghiệm.</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-semibold text-sm">Buổi tập PT với huấn luyện viên</p>
                <p className="mt-1 text-sm text-muted-foreground">Hội viên mua theo cấp độ và số buổi. Dùng nút “Quản lý buổi PT” để tạo sản phẩm hoặc xem số buổi còn lại.</p>
              </div>
            </div>
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
              <div>
                <p className="text-sm font-semibold">Trạng thái kinh doanh</p>
                <p className="text-xs text-muted-foreground">Ngừng bán chỉ ẩn gói khỏi danh sách mua; dữ liệu và lịch sử vẫn được giữ.</p>
              </div>
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
                    value={newPackageForm.durationDays}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, durationDays: parseInt(e.target.value) || 30 })}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Giá Niêm Yết (VNĐ) *">
                  <Input
                    type="number"
                    step="50000"
                    required
                    value={newPackageForm.price}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, price: parseInt(e.target.value) || 0 })}
                  />
                </Field>

                <Field label={newPackageForm.type === 'PT' ? 'Tổng Số Buổi PT 1:1 *' : 'Số Buổi PT Tặng Kèm'}>
                  <Input
                    type="number"
                    min={newPackageForm.type === 'PT' ? 1 : 0}
                    required={newPackageForm.type === 'PT'}
                    value={newPackageForm.type === 'PT' ? newPackageForm.totalPtSessions : newPackageForm.trialPtSessions}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10) || 0;
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
                    value={editPackageForm.durationDays}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, durationDays: parseInt(e.target.value) || 30 })}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Giá Bán Niêm Yết (VNĐ) *">
                  <Input
                    type="number"
                    step="50000"
                    required
                    value={editPackageForm.price}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, price: parseInt(e.target.value) || 0 })}
                  />
                </Field>

                <Field label={editPackageForm.type === 'PT' ? 'Tổng Số Buổi PT 1:1 *' : 'Số Buổi PT Tặng Thử'}>
                  <Input
                    type="number"
                    min={editPackageForm.type === 'PT' ? 1 : 0}
                    required={editPackageForm.type === 'PT'}
                    value={editPackageForm.type === 'PT' ? editPackageForm.totalPtSessions : editPackageForm.trialPtSessions}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
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
        <DialogContent className="max-h-[90vh] min-w-0 overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Quản lý buổi tập PT</DialogTitle>
            <DialogDescription>Tạo gói buổi tập theo cấp độ huấn luyện viên và xem số buổi của từng hội viên.</DialogDescription>
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
                  <CardDescription>Theo dõi danh sách phòng tập chức năng, tình trạng máy tập và quản lý bảo trì</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIsCreatingRoom(true)}>
                    <Plus className="size-4" /> Thêm Phòng Mới
                  </Button>
                  <Button onClick={() => setIsCreatingEquipment(true)}>
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
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                            #{room.id}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-base">{room.name}</div>
                            <div className="text-xs text-muted-foreground">Loại: {room.type} • Sức chứa: {room.capacity} người</div>
                          </div>
                        </div>
                        <Badge variant={room.isActive !== false ? "success" : "secondary"}>
                          {room.isActive !== false ? "ĐANG HOẠT ĐỘNG" : "TẠM NGƯNG"}
                        </Badge>
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
                              const isMaint = eq.status === 'MAINTENANCE';
                              return (
                                <div key={eq.id} className="p-3 rounded-md border bg-muted/30 flex flex-col justify-between text-xs">
                                  <div>
                                    <div className="flex justify-between items-start mb-1">
                                      <strong className="text-foreground">{eq.name}</strong>
                                      <Badge variant={isAvailable ? "success" : isMaint ? "warning" : "destructive"}>
                                        {eq.status}
                                      </Badge>
                                    </div>
                                    <div className="text-muted-foreground text-[11px] mb-1">Mã: {eq.code}</div>
                                    {eq.note && <div className="text-muted-foreground text-[11px] italic">Ghi chú: {eq.note}</div>}
                                  </div>

                                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/50">
                                    <Select
                                      defaultValue={eq.status}
                                      onValueChange={(val) => handleUpdateEquipmentStatus(eq.id, val as any)}
                                    >
                                      <SelectTrigger className="h-7 text-[11px] w-28">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="AVAILABLE">AVAILABLE</SelectItem>
                                        <SelectItem value="MAINTENANCE">BẢO TRÌ</SelectItem>
                                        <SelectItem value="BROKEN">HỎNG HÓC</SelectItem>
                                      </SelectContent>
                                    </Select>

                                    <Button
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
              <CardTitle>Danh Mục Lớp Học ({groupClasses.length})</CardTitle>
              <CardDescription>Các lớp đã tạo, kể cả lớp chưa được xếp lịch.</CardDescription>
            </CardHeader>
            <CardContent>
              {groupClasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <p className="font-semibold text-foreground">Chưa có lớp học nào</p>
                  <p className="text-xs mt-1">Lớp vừa tạo sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên Lớp Học</TableHead>
                      <TableHead>Thời Lượng</TableHead>
                      <TableHead>Mô Tả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupClasses.map(groupClass => (
                      <TableRow key={groupClass.id}>
                        <TableCell className="font-bold text-foreground">{groupClass.name}</TableCell>
                        <TableCell>{groupClass.durationMin} phút</TableCell>
                        <TableCell>{groupClass.description || '—'}</TableCell>
                      </TableRow>
                    ))}
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
                  <CardDescription>Tạo danh mục lớp học nhóm và lên thời khóa biểu theo phòng tập & HLV</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIsCreatingClass(true)}>
                    <Plus className="size-4" /> Tạo Lớp Học Mới
                  </Button>
                  <Button onClick={() => {
                    setScheduleForm(prev => ({ ...prev, trainerId: groupClassTrainers[0]?.userId ?? 0, roomId: rooms[0]?.id ?? 0 }));
                    setIsCreatingSchedule(true);
                  }}>
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
                  <p className="text-xs mt-1">Bấm nút "Tạo Lớp Học Mới" hoặc "Mở Ca Lịch Tập" để bắt đầu thiết lập.</p>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupClassSchedules.map(sch => {
                      const startTimeStr = new Date(sch.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
                      const endTimeStr = new Date(sch.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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
                            <Badge variant={sch.status === 'OPEN' ? 'success' : 'secondary'}>
                              {sch.status}
                            </Badge>
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

      {/* Create Room Dialog */}
      <Dialog open={isCreatingRoom} onOpenChange={setIsCreatingRoom}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveRoom}>
            <DialogHeader>
              <DialogTitle>Thêm Phòng Tập Mới</DialogTitle>
              <DialogDescription>Tạo phòng tập mới vào hệ thống cơ sở vật chất AURA Fitness.</DialogDescription>
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
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) || 20 })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatingRoom(false)}>Hủy Bỏ</Button>
              <Button type="submit">Lưu Phòng Tập</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Equipment Dialog */}
      <Dialog open={isCreatingEquipment} onOpenChange={setIsCreatingEquipment}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEquipment}>
            <DialogHeader>
              <DialogTitle>Thêm Thiết Bị Vào Phòng Tập</DialogTitle>
              <DialogDescription>Ghi nhận máy tập mới hoặc tạ đơn vào danh mục quản lý.</DialogDescription>
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
                  value={equipmentForm.roomId ? String(equipmentForm.roomId) : (rooms[0] ? String(rooms[0].id) : '1')}
                  onValueChange={(v) => setEquipmentForm({ ...equipmentForm, roomId: parseInt(v) })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name} (#{r.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Ghi Chú Kỹ Thuật">
                <Input
                  placeholder="VD: Trọng lượng tạ tối đa 120kg, bảo trì định kỳ 6 tháng"
                  value={equipmentForm.note}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, note: e.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatingEquipment(false)}>Hủy Bỏ</Button>
              <Button type="submit">Thêm Thiết Bị</Button>
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
              <DialogDescription>Định nghĩa tên lớp, thời lượng và mô tả nội dung buổi tập.</DialogDescription>
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
                  value={classForm.durationMin}
                  onChange={(e) => setClassForm({ ...classForm, durationMin: parseInt(e.target.value) || 60 })}
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
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveSchedule}>
            <DialogHeader>
              <DialogTitle>Mở Lịch Ca Tập Lớp Học Nhóm</DialogTitle>
              <DialogDescription>Lên lịch cho lớp học và phân công Huấn luyện viên phụ trách.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <Field label="Lớp Học *">
                <Select
                  value={String(scheduleForm.classId)}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, classId: parseInt(v) })}
                  disabled={groupClasses.length === 0}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Chọn lớp học" /></SelectTrigger>
                  <SelectContent>
                    {groupClasses.map(groupClass => (
                      <SelectItem key={groupClass.id} value={String(groupClass.id)}>
                        {groupClass.name} (#{groupClass.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Huấn Luyện Viên Phụ Trách *">
                <Select
                  value={String(scheduleForm.trainerId)}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, trainerId: parseInt(v) })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {groupClassTrainers.map(trainer => (
                      <SelectItem key={trainer.userId} value={String(trainer.userId)}>
                        {trainer.user?.fullName || `HLV #${trainer.userId}`} (User #{trainer.userId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Phòng Tập">
                <Select
                  value={scheduleForm.roomId ? String(scheduleForm.roomId) : (rooms[0] ? String(rooms[0].id) : '1')}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, roomId: parseInt(v) })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Giờ Bắt Đầu *">
                  <Input
                    type="datetime-local"
                    required
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                  />
                </Field>
                <Field label="Giờ Kết Thúc *">
                  <Input
                    type="datetime-local"
                    required
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Sức Chứa Giới Hạn (Chỗ Ngồi) *">
                <Input
                  type="number"
                  min="5"
                  max="100"
                  required
                  value={scheduleForm.capacity}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, capacity: parseInt(e.target.value) || 20 })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatingSchedule(false)}>Hủy Bỏ</Button>
              <Button type="submit" disabled={groupClasses.length === 0}>Lên Lịch Ngay</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* TAB 6: RBAC & Audit Trail */}
      {activeTab === 'audit-rbac' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Card>
            <CardHeader>
              <CardTitle>Ma Trận Phân Quyền (RBAC)</CardTitle>
              <CardDescription>Cơ chế bảo mật và phân quyền theo cấp bậc nhân sự</CardDescription>
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
            <CardHeader>
              <CardTitle>Nhật Ký Kiểm Toán (Audit Trail)</CardTitle>
              <CardDescription>Ghi nhận mọi hành động nhạy cảm của nhân viên</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 max-h-[460px] overflow-y-auto pr-1">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-lg border bg-muted/40 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-foreground">{log.actorName}</span>
                      <Badge variant="outline" className="text-[10px]">{log.actorRole.toUpperCase()}</Badge>
                    </div>
                    <div className="font-medium text-primary">{log.action}: {log.target}</div>
                    <div className="text-muted-foreground mt-0.5">{log.details}</div>
                    <div className="text-muted-foreground text-[10px] mt-1 text-right">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </StaffPage>
  );
};
