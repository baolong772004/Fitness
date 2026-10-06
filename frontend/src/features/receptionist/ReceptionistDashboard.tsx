import React, { useState, useEffect } from 'react';
import { Member, CheckInRecord, PackagePlan, Coach, SupportTicket, Invoice } from '../../types';
import { MockDatabase } from '../../mocks/mockData';
import { api, ApiPackage, ApiUser } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import { PaymentModal } from '../payment/PaymentModal';
import { WebcamQrScanner } from '@/components/common/WebcamQrScanner';
import { 
  QrCode, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  UserPlus, 
  CreditCard, 
  Clock, 
  Check, 
  Plus, 
  Printer, 
  HelpCircle,
  Sparkles,
  Phone,
  Calendar,
  Layers,
  Dumbbell,
  Camera,
  ShieldCheck,
  RefreshCw,
  AlertCircle
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, StaffPage, Field } from '@/components/staff/StaffKit';

interface ReceptionistDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({
  activeTab,
  onTabChange
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [packages, setPackages] = useState<PackagePlan[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);

  // Check-in terminal state
  const [searchInput, setSearchInput] = useState('');
  const [verifiedMember, setVerifiedMember] = useState<Member | null>(null);
  const [useWebcamScanner, setUseWebcamScanner] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    status: 'approved' | 'rejected';
    message: string;
    details: string;
  } | null>(null);

  // Walk-in Registration POS State
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'male' as 'male' | 'female',
    birthYear: 1998,
    selectedPackageId: 'pkg-hybrid-gold',
    selectedCoachId: 'coach-1'
  });

  // Payment Modal Trigger
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState<{
    memberId: string;
    memberName: string;
    memberPhone: string;
    items: { name: string; quantity: number; unitPriceVND: number; amountVND: number }[];
  } | null>(null);

  // Tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [memberStatusFilter, setMemberStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');

  const [newTicketForm, setNewTicketForm] = useState({
    memberName: '',
    memberPhone: '',
    category: 'lost_found' as const,
    title: '',
    description: ''
  });

  // Load from Backend REST API (with local fallback if offline)
  const reloadData = async () => {
    // 1. Load Packages from Live Backend
    try {
      const livePkgs = await api.packages.getPackages();
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
          features: ['Ra vào không giới hạn', `${p.durationDays} ngày sử dụng`]
        }));
        setPackages(mappedPkgs);
      } else {
        setPackages(MockDatabase.getPackages());
      }
    } catch {
      setPackages(MockDatabase.getPackages());
    }

    // 2. Load Check-in history from Live Backend
    try {
      const liveCheckins = await api.checkin.getHistory({ limit: 20 });
      if (liveCheckins.data && liveCheckins.data.length > 0) {
        const mappedCheckins: CheckInRecord[] = liveCheckins.data.map(c => ({
          id: 'chk-' + c.id,
          memberId: String(c.memberId),
          memberCode: 'MEM-' + c.memberId,
          memberName: `Hội Viên #${c.memberId}`,
          memberAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
          packageName: c.membership?.package?.name || 'Gói Hội Viên',
          timestamp: c.checkInTime,
          status: c.status === 'SUCCESS' ? 'approved' : 'rejected',
          reason: c.rejectReason || undefined,
          staffName: 'Quầy Lễ Tân'
        }));
        setCheckIns(mappedCheckins);
      } else {
        setCheckIns(MockDatabase.getCheckIns());
      }
    } catch {
      setCheckIns(MockDatabase.getCheckIns());
    }

    // 3. Load Members from Live Backend Users API
    try {
      const liveUsers = await api.users.getUsers({ role: 'MEMBER' });
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
    setTickets(MockDatabase.getTickets());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Handle Live Check-In Check (Luồng 3: Smart QR Check-in)
  const handlePerformCheckIn = (member: Member) => {
    setVerifiedMember(member);

    // Business Logic for Check-in:
    // 1. Check if package is active or expired
    if (member.status === 'expired' || member.daysRemaining <= 0) {
      soundEffects.playErrorBeep();
      const failLog: CheckInRecord = {
        id: 'chk-' + Date.now(),
        memberId: member.id,
        memberCode: member.code,
        memberName: member.name,
        memberAvatar: member.avatar,
        packageName: member.packageName,
        timestamp: new Date().toISOString(),
        status: 'rejected',
        reason: 'Gói tập đã hết hạn sử dụng',
        staffName: 'Quầy Lễ Tân 1'
      };
      MockDatabase.recordCheckIn(failLog);
      setCheckIns(MockDatabase.getCheckIns());

      setCheckInResult({
        status: 'rejected',
        message: 'TỪ CHỐI CHECK-IN: GÓI TẬP ĐÃ HẾT HẠN!',
        details: 'Gói của hội viên đã hết hạn. Vui lòng hướng dẫn gia hạn tại quầy.'
      });
      return;
    }

    if (member.status === 'frozen') {
      soundEffects.playErrorBeep();
      setCheckInResult({
        status: 'rejected',
        message: 'TỪ CHỐI CHECK-IN: THẺ ĐANG BẢO LƯU',
        details: 'Thẻ đang trong thời gian bảo lưu dịch vụ.'
      });
      return;
    }

    // Success Check-in
    soundEffects.playSuccessBeep();
    const successLog: CheckInRecord = {
      id: 'chk-' + Date.now(),
      memberId: member.id,
      memberCode: member.code,
      memberName: member.name,
      memberAvatar: member.avatar,
      packageName: member.packageName,
      timestamp: new Date().toISOString(),
      status: 'approved',
      staffName: 'Quầy Lễ Tân 1'
    };
    MockDatabase.recordCheckIn(successLog);

    // Update total checkins count for member
    const updatedMember: Member = {
      ...member,
      totalCheckIns: member.totalCheckIns + 1,
      lastCheckIn: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    MockDatabase.updateMember(updatedMember);
    reloadData();

    setCheckInResult({
      status: 'approved',
      message: 'CHECK-IN THÀNH CÔNG! CỬA ĐÃ MỞ',
      details: member.ptSessionsRemaining > 0 
        ? `Lưu ý: Hội viên còn ${member.ptSessionsRemaining} buổi PT với HLV ${member.assignedCoachName || 'Chưa gán'}.`
        : 'Quyền vào cửa không giới hạn hợp lệ. Chúc buổi tập hiệu quả!'
    });
  };

  // Real Webcam QR Scan handler via html5-qrcode
  const handleWebcamScanSuccess = (decodedText: string) => {
    const clean = decodedText.trim();
    const matched = members.find(m => 
      m.code.toLowerCase() === clean.toLowerCase() ||
      m.phone === clean ||
      m.id === clean ||
      clean.toLowerCase().includes(m.code.toLowerCase()) ||
      clean.includes(m.phone)
    );

    if (matched) {
      handlePerformCheckIn(matched);
    } else {
      soundEffects.playErrorBeep();
      setCheckInResult({
        status: 'rejected',
        message: 'MÃ QR KHÔNG TỒN TẠI TRONG HỆ THỐNG!',
        details: `Đã đọc mã: "${clean}". Không khớp với mã thẻ hoặc số điện thoại của bất kỳ hội viên nào.`
      });
    }
  };

  // Search input trigger
  const handleSearchCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const term = searchInput.trim().toLowerCase();
    const found = members.find(m => 
      m.phone.includes(term) || 
      m.code.toLowerCase().includes(term) || 
      m.name.toLowerCase().includes(term)
    );

    if (found) {
      handlePerformCheckIn(found);
      setSearchInput('');
    } else {
      soundEffects.playErrorBeep();
      setVerifiedMember(null);
      setCheckInResult({
        status: 'rejected',
        message: 'KHÔNG TÌM THẤY HỘI VIÊN',
        details: `Không có thông tin khớp với từ khóa: "${searchInput}"`
      });
    }
  };

  // Quick Renew / Buy Package for a member directly without switching tabs
  const handleQuickRenew = (m: Member) => {
    const pkg = packages.find(p => p.id === m.activePackageId) || packages[0];
    setPendingPaymentData({
      memberId: m.id,
      memberName: m.name,
      memberPhone: m.phone,
      items: [
        {
          name: `Gia Hạn Gói: ${pkg?.name || m.packageName}`,
          quantity: 1,
          unitPriceVND: pkg?.priceVND || 1500000,
          amountVND: pkg?.priceVND || 1500000
        }
      ]
    });
    setIsPaymentOpen(true);
    soundEffects.playSuccessBeep();
  };

  // Handle Walk-in Registration POS
  const handleStartWalkinPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPkg = packages.find(p => p.id === newMemberForm.selectedPackageId);
    if (!selectedPkg) return;

    const newMemberId = 'mem-' + Date.now();
    setPendingPaymentData({
      memberId: newMemberId,
      memberName: newMemberForm.name,
      memberPhone: newMemberForm.phone,
      items: [
        {
          name: selectedPkg.name,
          quantity: 1,
          unitPriceVND: selectedPkg.priceVND,
          amountVND: selectedPkg.priceVND
        }
      ]
    });
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = (invoice: Invoice) => {
    // 1. If it's a renewal for an existing member
    const existing = members.find(m => m.id === invoice.memberId);
    if (existing) {
      const addedDays = 30;
      const currentDays = Math.max(0, existing.daysRemaining);
      const newDays = currentDays + addedDays;
      const newEndDate = new Date(Date.now() + newDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      
      const updatedMember: Member = {
        ...existing,
        status: 'active',
        daysRemaining: newDays,
        packageEndDate: newEndDate
      };

      MockDatabase.updateMember(updatedMember);
      MockDatabase.addInvoice(invoice);
      reloadData();
      soundEffects.playSuccessBeep();

      if (verifiedMember && verifiedMember.id === existing.id) {
        setVerifiedMember(updatedMember);
      }

      alert(`Đã gia hạn thành công cho hội viên ${existing.name}! Thẻ đã được kích hoạt thêm ${addedDays} ngày.`);
      return;
    }

    // 2. Otherwise it's a new walk-in member registration
    const selectedPkg = packages.find(p => p.id === newMemberForm.selectedPackageId);
    const selectedCoach = coaches.find(c => c.id === newMemberForm.selectedCoachId);

    const createdMember: Member = {
      id: invoice.memberId,
      code: 'MEM-' + Math.floor(1000 + Math.random() * 9000),
      name: newMemberForm.name,
      phone: newMemberForm.phone,
      email: newMemberForm.email || 'member@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
      cccd: '0012026' + Math.floor(10000 + Math.random() * 90000),
      gender: newMemberForm.gender,
      birthYear: newMemberForm.birthYear,
      emergencyContact: {
        name: 'Người thân',
        phone: newMemberForm.phone,
        relationship: 'Gia đình'
      },
      status: 'active',
      activePackageId: selectedPkg?.id || 'pkg-standard-1m',
      packageName: selectedPkg?.name || 'Gói Hội Viên',
      packageType: selectedPkg?.type || 'standard_gym',
      packageStartDate: new Date().toISOString().slice(0, 10),
      packageEndDate: new Date(Date.now() + (selectedPkg?.durationMonths || 1) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      daysRemaining: (selectedPkg?.durationMonths || 1) * 30,
      ptSessionsTotal: selectedPkg?.ptSessionsIncluded || 0,
      ptSessionsRemaining: selectedPkg?.ptSessionsIncluded || 0,
      assignedCoachId: selectedCoach?.id,
      assignedCoachName: selectedCoach?.name,
      totalCheckIns: 0,
      inBodyHistory: []
    };

    MockDatabase.addMember(createdMember);
    MockDatabase.addInvoice(invoice);
    reloadData();

    // Reset Form
    setNewMemberForm({
      name: '',
      phone: '',
      email: '',
      gender: 'male',
      birthYear: 1998,
      selectedPackageId: 'pkg-hybrid-gold',
      selectedCoachId: 'coach-1'
    });
  };

  // Quick Support Ticket Submission
  const handleAddTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.title.trim()) return;

    const newTicket: SupportTicket = {
      id: 't-' + Date.now(),
      ticketCode: 'TCK-' + Math.floor(1000 + Math.random() * 9000),
      memberId: 'mem-custom',
      memberName: newTicketForm.memberName || 'Khách vãng lai',
      memberPhone: newTicketForm.memberPhone || 'N/A',
      category: newTicketForm.category,
      title: newTicketForm.title,
      description: newTicketForm.description,
      status: 'open',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      createdBy: 'Thu Ngân (Lễ tân)'
    };

    MockDatabase.addTicket(newTicket);
    MockDatabase.logAction(
      'Thu Ngân (Lễ tân)',
      'receptionist',
      'Tiếp nhận & Báo cáo sự cố',
      newTicket.title,
      `Mã: ${newTicket.ticketCode} - Hội viên: ${newTicket.memberName} - Danh mục: ${newTicket.category}`
    );

    setTickets(MockDatabase.getTickets());
    setNewTicketForm({
      memberName: '',
      memberPhone: '',
      category: 'lost_found',
      title: '',
      description: ''
    });
    soundEffects.playSuccessBeep();
    alert(`Đã gửi báo cáo "${newTicket.title}" tới Ban Quản Lý (Admin) thành công! BQL sẽ xem xét và chỉ đạo xử lý.`);
  };

  // Receptionist marks ticket resolved after completing Admin directive
  const handleMarkResolvedByReception = (ticketId: string) => {
    const target = tickets.find(t => t.id === ticketId);
    if (!target) return;

    const updated: SupportTicket = {
      ...target,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'Thu Ngân (Lễ tân quầy)'
    };

    MockDatabase.updateTicket(updated);
    MockDatabase.logAction(
      'Thu Ngân (Lễ tân)',
      'receptionist',
      'Hoàn tất xử lý báo cáo theo chỉ đạo',
      target.title,
      `Mã: ${target.ticketCode || target.id} - Lễ tân đã hoàn tất xử lý theo chỉ đạo của Ban Quản Lý`
    );

    setTickets(MockDatabase.getTickets());
    soundEffects.playSuccessBeep();
    alert(`Đã hoàn tất xử lý báo cáo ${target.ticketCode || target.title}! Trạng thái chuyển thành "Đã giải quyết".`);
  };

  const memberStatusBadge = (m: Member) => {
    if (m.status === 'active') return <Badge variant="success">Hoạt động</Badge>;
    if (m.status === 'expiring_soon') return <Badge variant="warning">Sắp hết hạn</Badge>;
    if (m.status === 'frozen') return <Badge variant="info">Bảo lưu</Badge>;
    return <Badge variant="destructive">Hết hạn</Badge>;
  };

  const categoryMeta = (c: string) => {
    switch (c) {
      case 'lost_found': return { label: 'Đồ thất lạc', variant: 'warning' as const };
      case 'freeze_request': return { label: 'Bảo lưu gói tập', variant: 'info' as const };
      case 'equipment': return { label: 'Hỏng máy tập / CSVC', variant: 'destructive' as const };
      case 'coach_feedback': return { label: 'Phản ánh HLV', variant: 'soft' as const };
      default: return { label: 'Yêu cầu khác', variant: 'secondary' as const };
    }
  };

  const selectedPackage = packages.find(p => p.id === newMemberForm.selectedPackageId);

  return (
    <StaffPage>
      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            onTabChange('checkin');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={QrCode}
            tone="primary"
            label="Check-in hôm nay"
            value={`${checkIns.length} lượt`}
            hint={
              <span className="flex items-center justify-between text-xs">
                <span>Cổng kiểm soát</span>
                <span className="text-primary font-semibold group-hover:underline ml-1">Quét thẻ ngay →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-primary/60 h-full ${
              activeTab === 'checkin' ? 'ring-2 ring-primary/40 border-primary shadow-xs' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setMemberStatusFilter('all');
            onTabChange('members');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={UserPlus}
            tone="success"
            label="Hội viên đang hoạt động"
            value={`${members.filter(m => m.status === 'active' || m.status === 'expiring_soon').length} / ${members.length}`}
            hint={
              <span className="flex items-center justify-between text-xs">
                <span>Tỷ lệ hoạt động: <strong className="text-success font-bold">{members.length > 0 ? Math.round((members.filter(m => m.status === 'active' || m.status === 'expiring_soon').length / members.length) * 100) : 100}%</strong></span>
                <span className="text-success font-semibold group-hover:underline ml-1">Danh sách →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-success/60 h-full ${
              activeTab === 'members' && memberStatusFilter === 'all' ? 'ring-2 ring-success/40 border-success shadow-xs' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setMemberStatusFilter('expiring_soon');
            onTabChange('members');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={AlertTriangle}
            tone="warning"
            label="Gói sắp hết hạn (< 5 ngày)"
            value={`${members.filter(m => m.status === 'expiring_soon').length} người`}
            hint={
              <span className="flex items-center justify-between text-xs">
                <span>Cần nhắc gia hạn</span>
                <span className="text-warning font-semibold group-hover:underline ml-1">Lọc xử lý ngay →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-warning/60 h-full ${
              activeTab === 'members' && memberStatusFilter === 'expiring_soon' ? 'ring-2 ring-warning/40 border-warning shadow-xs' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange('tickets');
            soundEffects.playSuccessBeep();
          }}
          className="text-left transition-all active:scale-[0.98] hover:-translate-y-0.5 group relative block w-full focus:outline-none cursor-pointer"
        >
          <StatCard
            icon={HelpCircle}
            tone="info"
            label="Yêu cầu hỗ trợ chờ xử lý"
            value={`${tickets.filter(t => t.status === 'open').length} tickets`}
            hint={
              <span className="flex items-center justify-between text-xs">
                <span>Chờ BQL & Quầy</span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold group-hover:underline ml-1">Xem chi tiết →</span>
              </span>
            }
            className={`transition-all duration-200 group-hover:shadow-md group-hover:border-sky-500/60 h-full ${
              activeTab === 'tickets' ? 'ring-2 ring-sky-500/40 border-sky-500 shadow-xs' : ''
            }`}
          />
        </button>
      </div>

      {/* TAB 1: Live QR Check-in Terminal */}
      {activeTab === 'checkin' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-5 text-primary" /> Cổng Quét QR & Tra Cứu Thẻ
              </CardTitle>
              <CardDescription>Quét mã QR từ điện thoại hội viên hoặc nhập Số điện thoại / Mã thẻ</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <form onSubmit={handleSearchCheckIn} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Nhập SĐT (VD: 0901 234 567) hoặc Mã MEM-1001..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
                <Button type="submit">Kiểm Tra</Button>
              </form>

              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hội viên trong hệ thống (Bấm để quét thẻ)
                  </span>
                  <span className="text-xs text-primary">Kiểm tra thông tin thẻ & gói tập</span>
                </div>
                <div className="grid max-h-[440px] gap-2 overflow-y-auto pr-1">
                  {members.map(m => (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handlePerformCheckIn(m)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePerformCheckIn(m); }}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/80 hover:bg-accent/60 cursor-pointer group"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-10 border group-hover:border-primary">
                          <AvatarImage src={m.avatar} alt={m.name} />
                          <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{m.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{m.code} • {m.phone}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {m.status === 'active' && <Badge variant="success">Đang hoạt động</Badge>}
                          {m.status === 'expiring_soon' && (
                            <>
                              <Badge variant="warning">Còn {m.daysRemaining} ngày</Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] font-bold border-warning/60 text-warning hover:bg-warning hover:text-white transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickRenew(m);
                                }}
                              >
                                Gia hạn nhanh →
                              </Button>
                            </>
                          )}
                          {m.status !== 'active' && m.status !== 'expiring_soon' && (
                            <>
                              <Badge variant="destructive">{m.status === 'frozen' ? 'Bảo lưu' : 'Đã hết hạn'}</Badge>
                              {m.status !== 'frozen' && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 px-2 text-[10px] font-bold shadow-xs hover:bg-destructive/90 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickRenew(m);
                                  }}
                                >
                                  Gia hạn nhanh →
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                        {m.ptSessionsRemaining > 0 && (
                          <span className="text-[11px] font-medium text-primary">
                            PT: {m.ptSessionsRemaining}/{m.ptSessionsTotal} buổi
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid content-start gap-6">
            {checkInResult ? (
              <Card className={checkInResult.status === 'approved' ? 'border-success/60 shadow-md ring-1 ring-success/20' : 'border-destructive/60 shadow-md ring-1 ring-destructive/20'}>
                <CardHeader className="pb-3 border-b border-border/80">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className={checkInResult.status === 'approved' ? 'size-5 text-success' : 'size-5 text-destructive'} />
                      Đối Soát Hội Viên Qua Cổng
                    </CardTitle>
                    <Badge variant={checkInResult.status === 'approved' ? 'success' : 'destructive'} className="text-[11px] font-bold uppercase px-2.5 py-0.5">
                      {checkInResult.status === 'approved' ? '✓ CỬA ĐÃ MỞ (APPROVED)' : '✕ TỪ CHỐI (REJECTED)'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5 pt-4">
                  <Alert variant={checkInResult.status === 'approved' ? 'default' : 'destructive'}
                    className={checkInResult.status === 'approved' ? 'border-success/40 bg-success/10 text-success' : ''}>
                    {checkInResult.status === 'approved' ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                    <AlertTitle className="font-bold text-sm">{checkInResult.message}</AlertTitle>
                    <AlertDescription className="text-xs">{checkInResult.details}</AlertDescription>
                  </Alert>

                  {verifiedMember && (
                    <div className="rounded-xl border bg-card p-4 shadow-xs">
                      {/* Big Face Match Verification Display */}
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b">
                        <div className="relative group shrink-0">
                          <Avatar className={`size-28 sm:size-32 rounded-xl border-4 shadow-md ${verifiedMember.status === 'active' || verifiedMember.status === 'expiring_soon' ? 'border-success ring-2 ring-success/30' : 'border-destructive ring-2 ring-destructive/30'}`}>
                            <AvatarImage src={verifiedMember.avatar} alt={verifiedMember.name} className="object-cover" />
                            <AvatarFallback className="rounded-xl text-3xl font-bold bg-muted">{verifiedMember.name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-2 inset-x-0 mx-auto w-fit">
                            <span className="px-2 py-0.5 rounded-full bg-background/95 border text-[10px] font-bold text-foreground shadow-xs flex items-center gap-1">
                              <Camera className="size-3 text-primary" /> ĐỐI SOÁT MẶT
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 text-center sm:text-left min-w-0">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                            <h3 className="text-xl font-extrabold tracking-tight text-foreground truncate">{verifiedMember.name}</h3>
                            {memberStatusBadge(verifiedMember)}
                          </div>
                          <p className="text-xs font-semibold text-primary">
                            Mã Thẻ: <span className="font-mono">{verifiedMember.code}</span>
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
                            <div>SĐT: <strong className="text-foreground">{verifiedMember.phone}</strong></div>
                            <div>CCCD: <strong className="text-foreground">{verifiedMember.cccd}</strong></div>
                            <div>Giới tính: <strong className="text-foreground">{verifiedMember.gender === 'female' ? 'Nữ' : 'Nam'}</strong></div>
                            <div>Năm sinh: <strong className="text-foreground">{verifiedMember.birthYear}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* Package Details Breakdown */}
                      <dl className="grid gap-2 text-sm pt-4">
                        <div className="flex justify-between gap-4 py-1 border-b border-dashed">
                          <dt className="text-muted-foreground">Gói tập đăng ký:</dt>
                          <dd className="font-bold text-foreground">{verifiedMember.packageName}</dd>
                        </div>
                        <div className="flex justify-between gap-4 py-1 border-b border-dashed">
                          <dt className="text-muted-foreground">Hiệu lực gói:</dt>
                          <dd className={verifiedMember.daysRemaining > 3 ? 'font-semibold text-foreground' : 'font-bold text-destructive'}>
                            {verifiedMember.packageEndDate} ({verifiedMember.daysRemaining > 0 ? `Còn ${verifiedMember.daysRemaining} ngày` : 'Đã hết hạn'})
                          </dd>
                        </div>
                        {verifiedMember.ptSessionsTotal > 0 && (
                          <div className="flex justify-between gap-4 py-2 px-3 rounded-lg bg-primary/10 text-primary border border-primary/20">
                            <dt className="font-semibold text-xs">Buổi PT kèm riêng 1:1:</dt>
                            <dd className="font-extrabold text-sm">{verifiedMember.ptSessionsRemaining} / {verifiedMember.ptSessionsTotal} buổi</dd>
                          </div>
                        )}
                        {verifiedMember.assignedCoachName && (
                          <div className="flex justify-between gap-4 py-1 border-b border-dashed">
                            <dt className="text-muted-foreground">HLV phụ trách:</dt>
                            <dd className="font-semibold text-foreground">{verifiedMember.assignedCoachName}</dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-4 py-1">
                          <dt className="text-muted-foreground">Tổng lượt vào tập:</dt>
                          <dd className="font-extrabold text-success">{verifiedMember.totalCheckIns} lượt</dd>
                        </div>
                      </dl>

                      {/* Quick Action buttons */}
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        {(verifiedMember.status === 'expired' || verifiedMember.status === 'expiring_soon') && (
                          <Button
                            type="button"
                            className="flex-1 font-bold bg-primary text-primary-foreground shadow-sm"
                            onClick={() => handleQuickRenew(verifiedMember)}
                          >
                            <CreditCard className="size-4" /> Gia Hạn Gói Nhanh Tại Quầy
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          className={verifiedMember.status === 'active' ? 'w-full' : 'sm:w-auto'}
                          onClick={() => {
                            setCheckInResult(null);
                            setVerifiedMember(null);
                          }}
                        >
                          <RefreshCw className="size-3.5" /> Quét Khách Tiếp Theo
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* High-tech Viewfinder / Webcam Scanner State */
              <Card className="border-primary/40 bg-card/80 overflow-hidden relative shadow-sm">
                <CardHeader className="pb-3 border-b border-border/80 bg-muted/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <QrCode className="size-4 text-primary" />
                      Cổng Quét Smart Gate (Webcam QR)
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={useWebcamScanner ? 'default' : 'outline'}
                        className="h-7 px-2.5 text-[11px] gap-1 font-semibold"
                        onClick={() => setUseWebcamScanner(!useWebcamScanner)}
                      >
                        <Camera className="size-3.5" />
                        {useWebcamScanner ? 'Webcam Đang Bật' : 'Bật Webcam'}
                      </Button>
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/15 border border-success/30 text-[10px] font-bold text-success">
                        <span className="size-2 rounded-full bg-success animate-pulse" /> SẴN SÀNG
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 py-6 text-center relative">
                  {useWebcamScanner ? (
                    /* Live html5-qrcode Webcam Reader */
                    <div className="w-full flex flex-col items-center">
                      <WebcamQrScanner onScanSuccess={handleWebcamScanSuccess} autoStart={true} />
                      <p className="text-[11px] text-muted-foreground mt-3 max-w-xs">
                        Đang sử dụng camera thiết bị để quét trực tiếp mã QR từ ứng dụng hoặc thẻ hội viên.
                      </p>
                    </div>
                  ) : (
                    /* High-tech Simulation & Prompt to Turn On Webcam */
                    <>
                      <div className="relative size-44 rounded-2xl border-2 border-dashed border-primary/50 bg-muted/40 flex flex-col items-center justify-center p-4 overflow-hidden group">
                        {/* Viewfinder 4-corner brackets */}
                        <div className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-primary" />
                        <div className="absolute top-2 right-2 size-4 border-t-2 border-r-2 border-primary" />
                        <div className="absolute bottom-2 left-2 size-2 border-b-2 border-l-2 border-primary" />
                        <div className="absolute bottom-2 right-2 size-2 border-b-2 border-r-2 border-primary" />

                        {/* Animated laser scan bar */}
                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-bounce opacity-75" />

                        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
                          <Camera className="size-8 animate-pulse" />
                        </div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Camera AI Scanner</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">Nhận diện QR & Mặt</span>
                      </div>

                      <div className="max-w-xs">
                        <h4 className="text-base font-bold text-foreground">Sẵn Sàng Tiếp Đón Khách</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Bấm nút bên dưới để mở Webcam quét QR thực tế, hoặc bấm vào danh sách bên trái để mô phỏng quẹt thẻ.
                        </p>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="gap-2 bg-primary text-white shadow-md hover:bg-primary/90 font-semibold"
                        onClick={() => setUseWebcamScanner(true)}
                      >
                        <Camera className="size-4" /> Bật Webcam Quét QR Ngay
                      </Button>
                    </>
                  )}

                  <div className="w-full rounded-lg border border-dashed bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    <span>Hệ thống tự động đối soát khuôn mặt & kiểm tra thời hạn gói tập</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Nhật ký Check-in vừa diễn ra</CardTitle>
              </CardHeader>
              <CardContent className="grid max-h-[260px] gap-2 overflow-y-auto">
                {checkIns.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${c.status === 'approved' ? 'bg-success' : 'bg-destructive'}`} />
                      <span className="truncate font-semibold text-foreground">{c.memberName}</span>
                      <span className="truncate text-muted-foreground">({c.packageName})</span>
                    </div>
                    <span className="shrink-0 text-muted-foreground">{new Date(c.timestamp).toLocaleTimeString('vi-VN')}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Walk-in POS & Membership Sales */}
      {activeTab === 'pos' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-primary" /> Đăng Ký & Bán Gói Tại Quầy (POS)
              </CardTitle>
              <CardDescription>Tạo hồ sơ hội viên mới, chọn gói tập và thu tiền xuất hóa đơn ngay tại quầy</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStartWalkinPayment} className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Họ và Tên Hội Viên *">
                    <Input
                      required
                      placeholder="VD: Trần Đình Trọng"
                      value={newMemberForm.name}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Số Điện Thoại Liên Hệ *">
                    <Input
                      type="tel"
                      required
                      placeholder="VD: 0988 123 456"
                      value={newMemberForm.phone}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
                  <Field label="Email Nhận Hóa Đơn">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newMemberForm.email}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                    />
                  </Field>
                  <Field label="Giới tính">
                    <Select
                      value={newMemberForm.gender}
                      onValueChange={(v) => setNewMemberForm({ ...newMemberForm, gender: v as 'male' | 'female' })}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Nam</SelectItem>
                        <SelectItem value="female">Nữ</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Năm sinh">
                    <Input
                      type="number"
                      value={newMemberForm.birthYear}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, birthYear: parseInt(e.target.value) || 1998 })}
                    />
                  </Field>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Chọn Gói Tập / Khóa Học Đăng Ký</label>
                  <div className="grid gap-2">
                    {packages.map(pkg => {
                      const isSelected = newMemberForm.selectedPackageId === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setNewMemberForm({ ...newMemberForm, selectedPackageId: pkg.id })}
                          className={`flex items-center justify-between gap-4 rounded-lg border p-3.5 text-left transition-colors ${
                            isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{pkg.name}</span>
                              {pkg.type === 'hybrid_pt' && <Badge variant="soft">Hybrid Gym + PT</Badge>}
                              {pkg.type === 'specialized_course' && <Badge variant="info">Khóa Chuyên Biệt</Badge>}
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{pkg.description}</p>
                          </div>
                          <div className="shrink-0 text-sm font-bold text-primary">{pkg.priceVND.toLocaleString('vi-VN')} đ</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="Chỉ định Huấn Luyện Viên Cá Nhân (Tùy chọn)">
                  <Select
                    value={newMemberForm.selectedCoachId}
                    onValueChange={(v) => setNewMemberForm({ ...newMemberForm, selectedCoachId: v })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {coaches.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.rank.toUpperCase()}) - Chuyên: {c.specialties[0]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Button type="submit" size="lg" className="w-full">
                  <CreditCard /> Tiến Hành Thu Tiền & Kích Hoạt Gói
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Tóm Tắt Quyền Lợi Gói Đang Chọn</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {selectedPackage && (
                <>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <div className="text-base font-semibold text-primary">{selectedPackage.name}</div>
                    <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                      {selectedPackage.priceVND.toLocaleString('vi-VN')}{' '}
                      <span className="text-sm font-normal text-muted-foreground">VNĐ / {selectedPackage.durationMonths} Tháng</span>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="font-semibold text-foreground">Đặc quyền bao gồm:</div>
                    {selectedPackage.features.map((feat, i) => (
                      <div key={i} className="flex items-center gap-2 text-foreground">
                        <Check className="size-4 text-success" /> <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {selectedPackage.ptSessionsIncluded > 0 && (
                    <Alert className="border-primary/30 bg-primary/5">
                      <Sparkles />
                      <AlertTitle>Gói Hybrid</AlertTitle>
                      <AlertDescription>
                        Khách hàng có <strong>{selectedPackage.ptSessionsIncluded} buổi tập</strong> với HLV cá nhân. Số buổi này được trừ độc lập với số lần vào phòng tập tự do.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: Member Directory */}
      {activeTab === 'members' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Danh Sách Toàn Bộ Thành Viên</CardTitle>
                <CardDescription>Tra cứu hồ sơ, trạng thái gói tập và lịch sử check-in</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'active', label: 'Hoạt động' },
                    { id: 'expiring_soon', label: 'Sắp hết hạn' },
                    { id: 'expired', label: 'Đã hết hạn' },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setMemberStatusFilter(f.id as any)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                        memberStatusFilter === f.id
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <Button onClick={() => onTabChange('pos')}>
                  <Plus /> Đăng Ký Thành Viên Mới
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hội Viên</TableHead>
                  <TableHead>Số Điện Thoại</TableHead>
                  <TableHead>Gói Tập Đang Dùng</TableHead>
                  <TableHead>Hạn Sử Dụng</TableHead>
                  <TableHead>Buổi PT Còn</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                  <TableHead className="text-right">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members
                  .filter(m => memberStatusFilter === 'all' || m.status === memberStatusFilter)
                  .map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={m.avatar} alt={m.name} />
                          <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{m.phone}</TableCell>
                    <TableCell>{m.packageName}</TableCell>
                    <TableCell className={m.daysRemaining > 3 ? '' : 'font-medium text-destructive'}>
                      {m.packageEndDate} ({m.daysRemaining} ngày)
                    </TableCell>
                    <TableCell>
                      {m.ptSessionsTotal > 0 ? (
                        <span className="font-semibold text-primary">{m.ptSessionsRemaining}/{m.ptSessionsTotal}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{memberStatusBadge(m)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onTabChange('checkin');
                          handlePerformCheckIn(m);
                        }}
                      >
                        Quét Check-in
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Support Tickets */}
      {activeTab === 'tickets' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Danh Sách Yêu Cầu Hỗ Trợ Tại Quầy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {tickets.map(t => {
                const cat = categoryMeta(t.category);
                const needsAction = t.actionRequiredBy === 'receptionist' && t.status !== 'resolved';
                return (
                  <div key={t.id} className={`rounded-lg border p-4 ${needsAction ? 'border-warning/60 bg-warning/5' : 'bg-card'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">{t.ticketCode || t.id.toUpperCase()}</span>
                        <Badge variant={cat.variant}>{cat.label}</Badge>
                      </div>
                      <Badge variant={t.status === 'open' ? 'warning' : t.status === 'in_progress' ? 'soft' : 'success'}>
                        {t.status === 'open' ? 'Chờ BQL duyệt' : t.status === 'in_progress' ? 'Đang chỉ đạo xử lý' : 'Đã giải quyết'}
                      </Badge>
                    </div>

                    <h4 className="mt-2 text-sm font-semibold text-foreground">{t.title}</h4>
                    <p className="text-sm text-muted-foreground">{t.description}</p>

                    <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>Hội viên: <span className="font-semibold text-foreground">{t.memberName}</span> ({t.memberPhone})</span>
                      <span>{new Date(t.createdAt).toLocaleTimeString('vi-VN')} {new Date(t.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>

                    {t.adminResponse && (
                      <div className="mt-3 rounded-md border border-primary/25 bg-primary/5 p-3">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-primary">CHỈ ĐẠO TỪ BAN QUẢN LÝ (ADMIN)</span>
                          {needsAction && <Badge variant="warning">Yêu cầu Lễ tân xử lý tiếp</Badge>}
                        </div>
                        <p className="text-sm text-foreground">{t.adminResponse}</p>
                        {t.respondedAt && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Chỉ đạo lúc: {new Date(t.respondedAt).toLocaleTimeString('vi-VN')} {new Date(t.respondedAt).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </div>
                    )}

                    {t.status !== 'resolved' && (t.actionRequiredBy === 'receptionist' || t.status === 'in_progress') && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-success text-success hover:bg-success/10 hover:text-success"
                          onClick={() => handleMarkResolvedByReception(t.id)}
                        >
                          <Check /> Xác Nhận Đã Xử Lý Xong Theo Chỉ Đạo
                        </Button>
                      </div>
                    )}

                    {t.status === 'resolved' && t.resolvedAt && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-success">
                        <Check className="size-3.5" /> Đã hoàn tất giải quyết: {t.resolvedBy || 'Ban Quản Lý'} lúc {new Date(t.resolvedAt).toLocaleTimeString('vi-VN')}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Tiếp Nhận Yêu Cầu Mới</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddTicket} className="grid gap-4">
                <Field label="Phân loại yêu cầu">
                  <Select
                    value={newTicketForm.category}
                    onValueChange={(v) => setNewTicketForm({ ...newTicketForm, category: v as any })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lost_found">Đồ thất lạc (Lost & Found)</SelectItem>
                      <SelectItem value="freeze_request">Yêu cầu bảo lưu gói tập</SelectItem>
                      <SelectItem value="equipment">Báo hỏng máy tập / Cơ sở vật chất</SelectItem>
                      <SelectItem value="coach_feedback">Phản ánh về Huấn luyện viên</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tên Hội viên / Khách hàng">
                  <Input
                    required
                    placeholder="VD: Nguyễn Văn A"
                    value={newTicketForm.memberName}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, memberName: e.target.value })}
                  />
                </Field>
                <Field label="Số điện thoại">
                  <Input
                    type="tel"
                    required
                    placeholder="VD: 0912 345 678"
                    value={newTicketForm.memberPhone}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, memberPhone: e.target.value })}
                  />
                </Field>
                <Field label="Tiêu đề yêu cầu">
                  <Input
                    required
                    placeholder="VD: Quên tai nghe bluetooth tại tủ số 12"
                    value={newTicketForm.title}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, title: e.target.value })}
                  />
                </Field>
                <Field label="Mô tả chi tiết">
                  <Textarea
                    rows={3}
                    placeholder="Chi tiết về màu sắc, thời điểm, phòng..."
                    value={newTicketForm.description}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                  />
                </Field>
                <Button type="submit" className="w-full">Lưu Phiếu Yêu Cầu</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Modal if initiated */}
      {pendingPaymentData && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          memberId={pendingPaymentData.memberId}
          memberName={pendingPaymentData.memberName}
          memberPhone={pendingPaymentData.memberPhone}
          items={pendingPaymentData.items}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </StaffPage>
  );
};
