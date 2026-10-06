import React, { useState, useEffect } from 'react';
import { Member, Coach, PackagePlan, AuditLog, Invoice, SupportTicket } from '../../types';
import { MockDatabase } from '../../mocks/mockData';
import { api, ApiPackage, ApiUser } from '../../services/api';
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

  // Incident & Support Ticket Management State
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  const [respondingTicket, setRespondingTicket] = useState<SupportTicket | null>(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [targetAssignee, setTargetAssignee] = useState<'receptionist' | 'coach' | 'admin' | 'technician'>('receptionist');
  const [targetStatus, setTargetStatus] = useState<'in_progress' | 'resolved'>('in_progress');

  // New Package Modal
  const [isCreatingPackage, setIsCreatingPackage] = useState(false);
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

  const reloadData = async () => {
    // 1. Fetch live Packages from backend
    try {
      const livePkgs = await api.packages.getPackages({ includeInactive: true });
      if (livePkgs && livePkgs.length > 0) {
        const mappedPkgs: PackagePlan[] = livePkgs.map(p => ({
          id: String(p.id),
          name: p.name,
          type: p.type === 'PT' ? 'hybrid_pt' : 'standard_gym',
          durationMonths: Math.max(1, Math.round(p.durationDays / 30)),
          priceVND: Number(p.price),
          unlimitedGymAccess: true,
          ptSessionsIncluded: p.trialPtSessions || p.totalPtSessions || 0,
          description: p.description || '',
          features: ['Ra vào phòng tập 24/7', `${p.durationDays} ngày hiệu lực`, `${p.trialPtSessions || 0} buổi PT`]
        }));
        setPackages(mappedPkgs);
      } else {
        setPackages(MockDatabase.getPackages());
      }
    } catch {
      setPackages(MockDatabase.getPackages());
    }

    // 2. Fetch live Users from backend
    try {
      const liveUsers = await api.users.getUsers({ limit: 50 });
      if (liveUsers.data && liveUsers.data.length > 0) {
        const mappedMembers: Member[] = liveUsers.data.map(u => ({
          id: String(u.id),
          code: 'MEM-' + u.id,
          name: u.fullName || u.email,
          phone: u.phone || '0900000000',
          email: u.email,
          avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
          cccd: '0012026' + u.id,
          gender: (u.gender === 'female' ? 'female' : 'male') as any,
          birthYear: 1996,
          emergencyContact: { name: 'Người thân', phone: u.phone || '', relationship: 'Gia đình' },
          status: 'active',
          activePackageId: 'pkg-standard',
          packageName: 'Gói Tiêu Chuẩn',
          packageType: 'standard_gym',
          packageStartDate: new Date().toISOString().slice(0, 10),
          packageEndDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          daysRemaining: 30,
          ptSessionsTotal: 2,
          ptSessionsRemaining: 2,
          totalCheckIns: 1,
          inBodyHistory: []
        }));
        setMembers(mappedMembers);
      } else {
        setMembers(MockDatabase.getMembers());
      }
    } catch {
      setMembers(MockDatabase.getMembers());
    }

    setCoaches(MockDatabase.getCoaches());
    setInvoices(MockDatabase.getInvoices());
    setAuditLogs(MockDatabase.getAuditLogs());
    setTickets(MockDatabase.getTickets());
  };

  useEffect(() => {
    reloadData();
  }, []);

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
  const handleSaveCoachPricing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoach) return;

    const oldRate = editingCoach.hourlyRateVND;
    const updatedCoach: Coach = {
      ...editingCoach,
      hourlyRateVND: newHourlyRate,
      commissionPercent: newCommission,
      rank: newRank
    };

    MockDatabase.updateCoach(updatedCoach);
    MockDatabase.logAction(
      'Hoàng Quản Lý',
      'admin',
      'Cập nhật giá Coach',
      `HLV ${editingCoach.name}`,
      `Đổi đơn giá từ ${oldRate.toLocaleString('vi-VN')}đ sang ${newHourlyRate.toLocaleString('vi-VN')}đ (Hạng: ${newRank.toUpperCase()})`
    );

    soundEffects.playSuccessBeep();
    reloadData();
    setEditingCoach(null);
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
        trialPtSessions: newPackageForm.trialPtSessions,
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
  const handleDeletePackage = async (packageId: string | number, packageName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xoá gói tập "${packageName}"?`)) return;
    try {
      await api.packages.deletePackage(packageId);
      soundEffects.playSuccessBeep();
      await reloadData();
      alert(`Đã xoá gói tập "${packageName}" thành công.`);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi khi xoá: ${err.message}`);
    }
  };

  // Handle Update User Role via Live Backend REST API
  const handleChangeUserRole = async (userId: string | number, newRole: 'ADMIN' | 'STAFF' | 'RECEPTIONIST' | 'COACH' | 'MEMBER' | string) => {
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

  // Handle Open Ticket Response Modal
  const handleOpenResponseModal = (t: SupportTicket) => {
    setRespondingTicket(t);
    setAdminResponseText(t.adminResponse || '');
    setTargetAssignee(t.actionRequiredBy || 'receptionist');
    setTargetStatus(t.status === 'open' ? 'in_progress' : t.status as 'in_progress' | 'resolved');
    soundEffects.playSuccessBeep();
  };

  // Handle Save Admin Response
  const handleSaveAdminResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingTicket || !adminResponseText.trim()) return;

    const updated: SupportTicket = {
      ...respondingTicket,
      adminResponse: adminResponseText.trim(),
      actionRequiredBy: targetAssignee,
      status: targetStatus,
      respondedAt: new Date().toISOString(),
      resolvedAt: targetStatus === 'resolved' ? new Date().toISOString() : undefined,
      resolvedBy: targetStatus === 'resolved' ? 'Hoàng Quản Lý (Admin)' : undefined
    };

    MockDatabase.updateTicket(updated);
    MockDatabase.logAction(
      'Hoàng Quản Lý',
      'admin',
      'Chỉ đạo xử lý báo cáo / sự cố',
      updated.title,
      `Mã: ${updated.ticketCode || updated.id} - Phân công: ${targetAssignee.toUpperCase()} - Trạng thái: ${targetStatus}`
    );

    soundEffects.playSuccessBeep();
    reloadData();
    setRespondingTicket(null);
    alert(`Đã gửi chỉ đạo thành công cho báo cáo "${updated.title}"! Lễ tân và bộ phận liên quan đã nhận được.`);
  };

  // Quick Resolve Ticket
  const handleQuickResolveTicket = (t: SupportTicket) => {
    const updated: SupportTicket = {
      ...t,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'Hoàng Quản Lý (Admin)'
    };

    MockDatabase.updateTicket(updated);
    MockDatabase.logAction(
      'Hoàng Quản Lý',
      'admin',
      'Duyệt hoàn tất báo cáo',
      t.title,
      `Mã: ${t.ticketCode || t.id} - BQL đóng ticket trực tiếp`
    );

    soundEffects.playSuccessBeep();
    reloadData();
    alert(`Đã hoàn tất đóng báo cáo ${t.ticketCode || t.title}!`);
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
            label="Gói Tập & Khóa Học"
            value={`${packages.length} gói`}
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
                          <div className="text-xs text-muted-foreground">{m.code} • {m.phone}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{m.packageName}</TableCell>
                    <TableCell className={m.daysRemaining > 3 ? '' : 'text-destructive font-medium'}>
                      {m.packageEndDate}
                    </TableCell>
                    <TableCell>
                      {m.ptSessionsTotal > 0 ? (
                        <span className="font-semibold text-primary">{m.ptSessionsRemaining}/{m.ptSessionsTotal}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{m.assignedCoachName || <span className="text-muted-foreground">Chưa gán</span>}</TableCell>
                    <TableCell className="font-semibold text-success">{m.totalCheckIns} lượt</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setInspectingMember(m)}>
                        <Eye className="size-4" /> Xem 360°
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Member 360 Modal Dialog */}
      <Dialog open={!!inspectingMember} onOpenChange={(open) => { if (!open) setInspectingMember(null); }}>
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
                    <DialogTitle>{inspectingMember.name} (Member 360°)</DialogTitle>
                    <DialogDescription>{inspectingMember.code} • SĐT: {inspectingMember.phone} • CCCD: {inspectingMember.cccd}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/40">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Thông tin Gói Tập</div>
                    <div className="font-semibold text-foreground text-sm">{inspectingMember.packageName}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {inspectingMember.packageStartDate} đến {inspectingMember.packageEndDate}
                    </div>
                    {inspectingMember.ptSessionsTotal > 0 && (
                      <div className="text-xs font-bold text-primary mt-2">
                        PT cá nhân: {inspectingMember.ptSessionsRemaining}/{inspectingMember.ptSessionsTotal} buổi
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-lg border bg-muted/40">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Huấn Luyện Viên Phụ Trách</div>
                    <div className="font-semibold text-foreground text-sm">{inspectingMember.assignedCoachName || 'Chưa gán HLV'}</div>
                    <p className="text-xs text-muted-foreground mt-1">Học viên có quyền đổi Coach theo chính sách bù trừ chênh lệch.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        soundEffects.playSuccessBeep();
                        alert(`Đã mở quy trình hỗ trợ đổi Coach cho ${inspectingMember.name}!`);
                      }}
                    >
                      Hỗ Trợ Đổi HLV
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/40">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Lịch Sử Tiến Trình InBody</div>
                  {inspectingMember.inBodyHistory.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {inspectingMember.inBodyHistory.map(ib => (
                        <div key={ib.id} className="p-3 rounded-md border bg-card text-xs">
                          <div className="font-bold text-primary">{ib.date}</div>
                          <div className="flex justify-between mt-1 text-muted-foreground">
                            <span>Cân nặng: <strong className="text-foreground">{ib.weightKg}kg</strong></span>
                            <span>Cơ: <strong className="text-success">{ib.muscleMassKg}kg</strong></span>
                            <span>Mỡ: <strong className="text-warning">{ib.bodyFatPercent}%</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Chưa có lần đo InBody nào được ghi nhận.</p>
                  )}
                </div>

                <div className="p-4 rounded-lg border bg-muted/40">
                  <Field label="Phân Quyền Vai Trò (Live Backend API Role)">
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
                      <span className="text-xs text-muted-foreground">Cập nhật quyền tức thời vào database qua REST API</span>
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
                      <SelectItem value="receptionist">Lễ Tân / Quầy Thu Ngân</SelectItem>
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

      {/* TAB 4: Coaches Management & Pricing */}
      {activeTab === 'coaches-config' && (
        <Card>
          <CardHeader>
            <CardTitle>Quản Trị Huấn Luyện Viên & Bảng Giá Dạy Lẻ</CardTitle>
            <CardDescription>Thiết lập cấp bậc (Junior/Senior/Master), đơn giá riêng từng Coach và tỷ lệ chia sẻ hoa hồng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map(c => (
                <div key={c.id} className="p-4 rounded-lg border bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="size-12">
                        <AvatarImage src={c.avatar} alt={c.name} />
                        <AvatarFallback>{c.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{c.name}</span>
                          <Badge variant={rankVariant(c.rank)}>{c.rank.toUpperCase()}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{c.code} • {c.phone}</div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3">
                      Chuyên môn: <strong className="text-foreground">{c.specialties.join(', ')}</strong>
                    </p>

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

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEditingCoach(c);
                      setNewHourlyRate(c.hourlyRateVND);
                      setNewCommission(c.commissionPercent);
                      setNewRank(c.rank);
                    }}
                  >
                    <Edit3 className="size-3.5" /> Cấu Hình Giá & Cấp Bậc
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Coach Pricing Dialog */}
      <Dialog open={!!editingCoach} onOpenChange={(open) => { if (!open) setEditingCoach(null); }}>
        <DialogContent className="max-w-md">
          {editingCoach && (
            <form onSubmit={handleSaveCoachPricing}>
              <DialogHeader>
                <DialogTitle>Thiết Lập Đơn Giá Cho HLV {editingCoach.name}</DialogTitle>
                <DialogDescription>Mã HLV: {editingCoach.code}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-3">
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingCoach(null)}>Hủy Bỏ</Button>
                <Button type="submit">Lưu Cấu Hình Giá</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* TAB 5: Packages & Services */}
      {activeTab === 'packages-engine' && (
        <Card>
          <CardHeader>
            <CardTitle>Quản Lý Gói Tập & Khóa Học Chuyên Biệt</CardTitle>
            <CardDescription>Cấu hình mô hình Hybrid (Vào tập không giới hạn + Quota buổi PT) và Khóa học chuyên sâu</CardDescription>
            <CardAction>
              <Button onClick={() => setIsCreatingPackage(true)}>
                <Plus className="size-4" /> Tạo Gói Dịch Vụ Mới
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map(pkg => (
                <div key={pkg.id} className="p-4 rounded-lg border bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-foreground text-base">{pkg.name}</h4>
                      <Badge variant={pkg.type === 'hybrid_pt' ? 'soft' : pkg.type === 'specialized_course' ? 'info' : 'secondary'}>
                        {pkg.type === 'hybrid_pt' ? 'Hybrid PT' : pkg.type === 'specialized_course' ? 'Chuyên Biệt' : 'Standard'}
                      </Badge>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Package Dialog */}
      <Dialog open={isCreatingPackage} onOpenChange={setIsCreatingPackage}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSavePackage}>
            <DialogHeader>
              <DialogTitle>Tạo Gói Tập Mới (Lưu Vào Database)</DialogTitle>
              <DialogDescription>Gói tập mới sẽ đồng bộ trực tiếp tới bảng giá của khách hàng và quầy POS.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              <Field label="Tên Gói Tập *">
                <Input
                  required
                  placeholder="VD: Gói Hybrid VIP 3 Tháng + 12 Buổi PT"
                  value={newPackageForm.name}
                  onChange={(e) => setNewPackageForm({ ...newPackageForm, name: e.target.value })}
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Loại Gói">
                  <Select value={newPackageForm.type} onValueChange={(v) => setNewPackageForm({ ...newPackageForm, type: v as any })}>
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

                <Field label="Số Buổi PT Tặng Kèm">
                  <Input
                    type="number"
                    min="0"
                    value={newPackageForm.trialPtSessions}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, trialPtSessions: parseInt(e.target.value) || 0 })}
                  />
                </Field>
              </div>

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
                {packageLoading ? 'Đang lưu...' : 'Lưu Gói Vào Database'}
              </Button>
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
                <strong className="text-success text-sm">2. Receptionist (Lễ tân)</strong>
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
