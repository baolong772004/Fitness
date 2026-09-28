import React, { useState, useEffect } from 'react';
import { Member, Coach, PackagePlan, AuditLog, Invoice, SupportTicket } from '../../types';
import { MockDatabase } from '../../mocks/mockData';
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
  Filter
} from 'lucide-react';

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
  const [newPackageForm, setNewPackageForm] = useState({
    name: '',
    type: 'hybrid_pt' as const,
    durationMonths: 1,
    priceVND: 2500000,
    ptSessionsIncluded: 8,
    description: '',
    featuresText: 'Ra vào phòng tập 24/7\n8 Buổi tập cùng HLV\nXông hơi miễn phí'
  });

  const reloadData = () => {
    setMembers(MockDatabase.getMembers());
    setCoaches(MockDatabase.getCoaches());
    setPackages(MockDatabase.getPackages());
    setInvoices(MockDatabase.getInvoices());
    setAuditLogs(MockDatabase.getAuditLogs());
    setTickets(MockDatabase.getTickets());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Total Revenue Calculation
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalVND, 0);

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

  // Handle Create Package
  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    const newPkg: PackagePlan = {
      id: 'pkg-' + Date.now(),
      name: newPackageForm.name,
      type: newPackageForm.type,
      durationMonths: newPackageForm.durationMonths,
      priceVND: newPackageForm.priceVND,
      unlimitedGymAccess: true,
      ptSessionsIncluded: newPackageForm.ptSessionsIncluded,
      description: newPackageForm.description || 'Gói tập chất lượng cao tại AURA Fitness.',
      features: newPackageForm.featuresText.split('\n').filter(f => f.trim().length > 0)
    };

    MockDatabase.addPackage(newPkg);
    MockDatabase.logAction(
      'Hoàng Quản Lý',
      'admin',
      'Tạo gói tập mới',
      newPkg.name,
      `Giá: ${newPkg.priceVND.toLocaleString('vi-VN')}đ - ${newPkg.durationMonths} Tháng (${newPkg.ptSessionsIncluded} buổi PT)`
    );

    soundEffects.playSuccessBeep();
    reloadData();
    setIsCreatingPackage(false);
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

  return (
    <div style={{ padding: 'var(--space-xxl) var(--space-xl)', maxWidth: 'var(--max-content-width)', margin: '0 auto' }}>
      {/* Top BI Metric Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 'var(--space-lg)',
        marginBottom: 'var(--space-xxxl)'
      }}>
        <div className="card-athletic" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Tổng Doanh Thu Tháng Này
              </div>
              <div className="metric-mono" style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-primary)', marginTop: 4 }}>
                {totalRevenue.toLocaleString('vi-VN')} <span style={{ fontSize: 14 }}>đ</span>
              </div>
            </div>
            <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: 10, borderRadius: 'var(--radius-full)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-success)', marginTop: 10 }}>
            <TrendingUp size={14} />
            <span>+18.4% so với tháng trước</span>
          </div>
        </div>

        <div className="card-athletic" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Tổng Số Hội Viên
              </div>
              <div className="metric-mono" style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                {members.length} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>hội viên</span>
              </div>
            </div>
            <div style={{ background: 'rgba(0, 200, 83, 0.15)', color: 'var(--color-success)', padding: 10, borderRadius: 'var(--radius-full)' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Tỷ lệ gia hạn tái ký: <strong style={{ color: 'var(--color-success)' }}>86.5%</strong>
          </div>
        </div>

        <div className="card-athletic" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Đội Ngũ HLV
              </div>
              <div className="metric-mono" style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                {coaches.length} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>HLV active</span>
              </div>
            </div>
            <div style={{ background: 'rgba(0, 176, 255, 0.15)', color: 'var(--color-info)', padding: 10, borderRadius: 'var(--radius-full)' }}>
              <Dumbbell size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Trung bình: <strong>8.5 học viên / Coach</strong>
          </div>
        </div>

        <div className="card-athletic" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Gói Tập & Khóa Học
              </div>
              <div className="metric-mono" style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                {packages.length} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>gói</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255, 171, 0, 0.15)', color: 'var(--color-warning)', padding: 10, borderRadius: 'var(--radius-full)' }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Chiếm <strong style={{ color: '#fff' }}>42%</strong> doanh thu
          </div>
        </div>

        {/* 5th KPI Card: Tickets / Reports awaiting Admin action */}
        <div 
          className="card-athletic" 
          style={{ 
            padding: '18px 22px', 
            cursor: 'pointer',
            border: tickets.filter(t => t.status === 'open').length > 0 
              ? '1px solid var(--color-warning)' 
              : '1px solid rgba(255,255,255,0.06)'
          }}
          onClick={() => onTabChange('tickets-management')}
          title="Bấm để chuyển nhanh sang Xử Lý Báo Cáo & Yêu Cầu"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                Báo Cáo / Sự Cố Chờ Duyệt
              </div>
              <div className="metric-mono" style={{ fontSize: 26, fontWeight: 900, color: tickets.filter(t => t.status === 'open').length > 0 ? 'var(--color-warning)' : '#fff', marginTop: 4 }}>
                {tickets.filter(t => t.status === 'open').length} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>chờ BQL</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255, 61, 0, 0.15)', color: 'var(--color-danger)', padding: 10, borderRadius: 'var(--radius-full)' }}>
              <LifeBuoy size={20} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-primary)', marginTop: 10 }}>
            <span>{tickets.filter(t => t.status === 'in_progress').length} đang xử lý • Xem ngay →</span>
          </div>
        </div>
      </div>

      {/* TAB 1: BI Analytics & Reports */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-xxxl)' }}>
          {/* Revenue Breakdown */}
          <div className="card-athletic">
            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 6 }}>Cơ Cấu Doanh Thu Theo Loại Dịch Vụ</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Phân tích tỷ trọng đóng góp vào ngân sách trung tâm
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Hybrid Gold */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#fff' }}>Gói VIP Hybrid (Gym + PT Quota)</span>
                  <span className="metric-mono" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>52% (5.800.000 đ)</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg-app)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: '52%', height: '100%', background: 'var(--color-primary)' }} />
                </div>
              </div>

              {/* Specialized Courses */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#fff' }}>Khóa Học Chuyên Biệt (Yoga Trị Liệu, Boxing Bootcamp)</span>
                  <span className="metric-mono" style={{ color: 'var(--color-info)', fontWeight: 700 }}>34% (3.800.000 đ)</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg-app)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: '34%', height: '100%', background: 'var(--color-info)' }} />
                </div>
              </div>

              {/* Standard Gym */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#fff' }}>Thẻ Standard Gym Tự Do</span>
                  <span className="metric-mono" style={{ color: 'var(--color-success)', fontWeight: 700 }}>14% (1.550.000 đ)</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg-app)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: '14%', height: '100%', background: 'var(--color-success)' }} />
                </div>
              </div>
            </div>

            {/* Peak Hours Heatmap simulation */}
            <div style={{ marginTop: 32 }}>
              <h4 style={{ fontSize: 16, color: '#fff', marginBottom: 12 }}>Mật Độ Hội Viên Theo Khung Giờ (Peak Hours)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, textAlign: 'center' }}>
                {[
                  { time: '06:00 - 08:00', density: '65%', label: 'Vừa' },
                  { time: '08:00 - 11:00', density: '35%', label: 'Thấp' },
                  { time: '11:30 - 13:30', density: '50%', label: 'Vừa' },
                  { time: '14:00 - 17:00', density: '40%', label: 'Thấp' },
                  { time: '17:30 - 20:30', density: '95%', label: 'Rất Cao', peak: true },
                  { time: '20:30 - 22:00', density: '60%', label: 'Vừa' }
                ].map((slot, i) => (
                  <div key={i} style={{
                    padding: '12px 6px',
                    background: slot.peak ? 'rgba(254,116,19,0.2)' : 'var(--bg-app)',
                    border: slot.peak ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{slot.time}</div>
                    <div className="metric-mono" style={{ fontSize: 16, fontWeight: 800, color: slot.peak ? 'var(--color-primary)' : '#fff', marginTop: 4 }}>
                      {slot.density}
                    </div>
                    <span style={{ fontSize: 10, color: slot.peak ? 'var(--color-primary)' : 'var(--text-dim)' }}>
                      {slot.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Invoices Feed */}
          <div className="card-athletic">
            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 16 }}>Giao Dịch Gần Đây</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {invoices.map(inv => (
                <div key={inv.id} style={{
                  padding: 14,
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ color: '#fff', fontSize: 14 }}>{inv.memberName}</strong>
                    <span className="metric-mono" style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                      +{inv.totalVND.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {inv.items[0]?.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                    <span>PT: {inv.paymentMethod.toUpperCase()}</span>
                    <span>{new Date(inv.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Member Management 360 (Luồng 8) */}
      {activeTab === 'members-360' && (
        <div className="card-athletic">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 20, color: '#fff' }}>Quản Lý Hồ Sơ Hội Viên 360°</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Tra cứu đầy đủ thông tin cá nhân, gói tập, lịch sử check-in, hóa đơn và tiến độ tập luyện
              </p>
            </div>

            <div style={{ position: 'relative', width: 300 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Tìm theo tên, SĐT, mã HV..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
              />
              <Search size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-dim)' }} />
            </div>
          </div>

          {/* Members Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 8px' }}>Hội Viên</th>
                <th style={{ padding: '12px 8px' }}>Gói Đang Dùng</th>
                <th style={{ padding: '12px 8px' }}>Hạn Gói</th>
                <th style={{ padding: '12px 8px' }}>Buổi PT Còn</th>
                <th style={{ padding: '12px 8px' }}>HLV Phụ Trách</th>
                <th style={{ padding: '12px 8px' }}>Check-in</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Chi Tiết 360°</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={m.avatar} alt={m.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <strong style={{ color: '#fff' }}>{m.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.code} • {m.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', color: '#fff' }}>{m.packageName}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className="metric-mono" style={{ color: m.daysRemaining > 3 ? '#fff' : 'var(--color-danger)' }}>
                      {m.packageEndDate}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {m.ptSessionsTotal > 0 ? (
                      <span className="metric-mono" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                        {m.ptSessionsRemaining}/{m.ptSessionsTotal}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '12px 8px', color: '#fff' }}>
                    {m.assignedCoachName || 'Chưa gán'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className="metric-mono" style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                      {m.totalCheckIns} lượt
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button
                      className="btn-outline"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => setInspectingMember(m)}
                    >
                      <Eye size={14} />
                      <span>Xem Hồ Sơ 360°</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Member 360 Profile Modal (Luồng 8) */}
      {inspectingMember && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 720 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: 'var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={inspectingMember.avatar} alt={inspectingMember.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <h3 style={{ fontSize: 18, color: '#fff' }}>Hồ Sơ Toàn Diện Hội Viên (Member 360°)</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {inspectingMember.name} • {inspectingMember.code} • {inspectingMember.phone}
                  </p>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setInspectingMember(null)}>✕</button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* 4 Tabs Inside Member Profile */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
                {/* 1. Gói tập hiện tại */}
                <div style={{ background: 'var(--bg-app)', padding: 16, borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Thông tin Gói Tập
                  </div>
                  <strong style={{ color: '#fff', fontSize: 14 }}>{inspectingMember.packageName}</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Hạn dùng: {inspectingMember.packageStartDate} đến {inspectingMember.packageEndDate}
                  </div>
                  {inspectingMember.ptSessionsTotal > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-primary)', fontWeight: 700 }}>
                      Số buổi PT cá nhân: {inspectingMember.ptSessionsRemaining}/{inspectingMember.ptSessionsTotal} buổi
                    </div>
                  )}
                </div>

                {/* 2. HLV Phụ Trách & Đổi Coach */}
                <div style={{ background: 'var(--bg-app)', padding: 16, borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Huấn Luyện Viên Phụ Trách
                  </div>
                  <strong style={{ color: '#fff', fontSize: 14 }}>
                    {inspectingMember.assignedCoachName || 'Chưa gán HLV'}
                  </strong>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Học viên có quyền đổi Coach theo chính sách bù trừ chênh lệch giá.
                  </p>
                  <button
                    className="btn-outline"
                    style={{ padding: '4px 10px', fontSize: 11, marginTop: 8 }}
                    onClick={() => {
                      soundEffects.playSuccessBeep();
                      alert(`Đã mở quy trình hỗ trợ đổi Coach cho ${inspectingMember.name}!`);
                    }}
                  >
                    Hỗ Trợ Đổi Huấn Luyện Viên
                  </button>
                </div>
              </div>

              {/* InBody Records */}
              <div style={{ background: 'var(--bg-app)', padding: 16, borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Lịch Sử Tiến Trình Thể Thao & InBody
                </div>
                {inspectingMember.inBodyHistory.length > 0 ? (
                  <div style={{ display: 'flex', gap: 16 }}>
                    {inspectingMember.inBodyHistory.map(ib => (
                      <div key={ib.id} style={{
                        background: 'var(--bg-panel)',
                        padding: 12,
                        borderRadius: 8,
                        fontSize: 12,
                        flex: 1
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{ib.date}</div>
                        <div style={{ color: '#fff', marginTop: 4 }}>Cân nặng: <strong>{ib.weightKg} kg</strong></div>
                        <div style={{ color: 'var(--color-success)' }}>Khối cơ: <strong>{ib.muscleMassKg} kg</strong></div>
                        <div style={{ color: 'var(--color-warning)' }}>Tỷ lệ mỡ: <strong>{ib.bodyFatPercent}%</strong></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chưa có lần đo InBody nào được ghi nhận.</p>
                )}
              </div>

              <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setInspectingMember(null)}>
                Đóng Hồ Sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Incident & Support Ticket Command Center (Tiếp nhận & Chỉ đạo xử lý sự cố từ Lễ tân) */}
      {activeTab === 'tickets-management' && (
        <div>
          {/* Main Console Card */}
          <div className="card-athletic" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(254, 116, 19, 0.15)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <LifeBuoy size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 20, color: '#fff', margin: 0 }}>
                      Trung Tâm Xử Lý Báo Cáo & Yêu Cầu Hỗ Trợ
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                      Tiếp nhận sự cố, yêu cầu bảo lưu thẻ và khiếu nại từ quầy Lễ tân • Phê duyệt & Giao việc xử lý
                    </p>
                  </div>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 280 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tìm mã ticket, tên khách, SĐT..."
                    value={ticketSearchQuery}
                    onChange={(e) => setTicketSearchQuery(e.target.value)}
                  />
                  <Search size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-dim)' }} />
                </div>

                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={ticketCategoryFilter}
                  onChange={(e) => setTicketCategoryFilter(e.target.value)}
                >
                  <option value="all">Tất cả danh mục</option>
                  <option value="lost_found">Đồ thất lạc (Lost & Found)</option>
                  <option value="freeze_request">Yêu cầu bảo lưu gói tập</option>
                  <option value="equipment">Hỏng máy / CSVC</option>
                  <option value="coach_feedback">Phản ánh Huấn luyện viên</option>
                  <option value="other">Yêu cầu khác</option>
                </select>
              </div>
            </div>

            {/* Status Filter Tabs Bar */}
            <div style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              paddingBottom: 12,
              marginBottom: 20,
              overflowX: 'auto'
            }}>
              <button
                type="button"
                style={{
                  background: ticketStatusFilter === 'all' ? 'var(--color-primary)' : 'transparent',
                  color: ticketStatusFilter === 'all' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                onClick={() => setTicketStatusFilter('all')}
              >
                Tất Cả ({tickets.length})
              </button>

              <button
                type="button"
                style={{
                  background: ticketStatusFilter === 'open' ? 'var(--color-danger)' : 'transparent',
                  color: ticketStatusFilter === 'open' ? '#fff' : 'var(--color-danger)',
                  border: '1px solid rgba(255, 61, 0, 0.3)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                onClick={() => setTicketStatusFilter('open')}
              >
                Chờ BQL Duyệt ({tickets.filter(t => t.status === 'open').length})
              </button>

              <button
                type="button"
                style={{
                  background: ticketStatusFilter === 'in_progress' ? 'var(--color-warning)' : 'transparent',
                  color: ticketStatusFilter === 'in_progress' ? '#000' : 'var(--color-warning)',
                  border: '1px solid rgba(255, 171, 0, 0.3)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                onClick={() => setTicketStatusFilter('in_progress')}
              >
                Đang Xử Lý / Giao Việc ({tickets.filter(t => t.status === 'in_progress').length})
              </button>

              <button
                type="button"
                style={{
                  background: ticketStatusFilter === 'resolved' ? 'var(--color-success)' : 'transparent',
                  color: ticketStatusFilter === 'resolved' ? '#fff' : 'var(--color-success)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                onClick={() => setTicketStatusFilter('resolved')}
              >
                Đã Giải Quyết Xong ({tickets.filter(t => t.status === 'resolved').length})
              </button>
            </div>

            {/* Ticket List */}
            {filteredTickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={42} style={{ color: 'var(--color-success)', margin: '0 auto 12px auto' }} />
                <h4 style={{ color: '#fff', fontSize: 16 }}>Không có báo cáo nào trong danh mục này!</h4>
                <p style={{ fontSize: 13, marginTop: 4 }}>Hệ thống vận hành ổn định, không có sự cố nào cần xử lý thêm.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredTickets.map(t => (
                  <div
                    key={t.id}
                    style={{
                      background: 'var(--bg-app)',
                      border: t.status === 'open' 
                        ? '1px solid rgba(255, 61, 0, 0.4)' 
                        : t.status === 'in_progress'
                        ? '1px solid rgba(255, 171, 0, 0.3)'
                        : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 18,
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    {/* Top Row: Code, Category, Priority, Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="metric-mono" style={{ fontSize: 13, fontWeight: 900, color: 'var(--color-primary)' }}>
                          {t.ticketCode || t.id.toUpperCase()}
                        </span>

                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.06)',
                          color: t.category === 'lost_found' ? 'var(--color-warning)' :
                                 t.category === 'freeze_request' ? 'var(--color-info)' :
                                 t.category === 'equipment' ? 'var(--color-danger)' : '#fff'
                        }}>
                          {t.category === 'lost_found' ? '📦 Đồ thất lạc' :
                           t.category === 'freeze_request' ? '⏸️ Bảo lưu gói tập' :
                           t.category === 'equipment' ? '⚠️ Hỏng máy tập / CSVC' :
                           t.category === 'coach_feedback' ? '💬 Phản ánh HLV' : '📋 Yêu cầu khác'}
                        </span>

                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          background: t.priority === 'high' ? 'rgba(255, 61, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                          color: t.priority === 'high' ? 'var(--color-danger)' : 'var(--text-muted)'
                        }}>
                          Ưu tiên {t.priority === 'high' ? 'Cao' : t.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${
                          t.status === 'open' ? 'badge-warning' :
                          t.status === 'in_progress' ? 'badge-primary' : 'badge-success'
                        }`}>
                          {t.status === 'open' ? '🔴 Chờ BQL Phê Duyệt' :
                           t.status === 'in_progress' ? '🟡 Đang Chỉ Đạo Xử Lý' : '🟢 Đã Giải Quyết'}
                        </span>
                      </div>
                    </div>

                    {/* Incident Title & Description */}
                    <h4 style={{ fontSize: 16, color: '#fff', marginBottom: 6 }}>
                      {t.title}
                    </h4>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                      {t.description}
                    </p>

                    {/* Member & Submitter Info */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-panel)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--text-dim)',
                      flexWrap: 'wrap',
                      gap: 8
                    }}>
                      <div>
                        <span>Hội viên liên quan: <strong style={{ color: '#fff' }}>{t.memberName}</strong> ({t.memberPhone})</span>
                      </div>
                      <div>
                        <span>Người tiếp nhận: <strong style={{ color: 'var(--color-primary)' }}>{t.createdBy || 'Thu Ngân (Lễ tân)'}</strong> • lúc {new Date(t.createdAt).toLocaleTimeString('vi-VN')} {new Date(t.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>

                    {/* Existing Admin Response Box (if already responded) */}
                    {t.adminResponse && (
                      <div style={{
                        marginTop: 12,
                        padding: '12px 14px',
                        background: 'rgba(254, 116, 19, 0.08)',
                        border: '1px solid rgba(254, 116, 19, 0.3)',
                        borderRadius: 6
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            👨‍💼 CHỈ ĐẠO CỦA QUẢN LÝ TRUNG TÂM (ADMIN):
                          </span>
                          <span className="badge badge-warning" style={{ fontSize: 9 }}>
                            {t.actionRequiredBy === 'receptionist' ? '⚡ Yêu cầu Lễ tân xử lý tiếp' :
                             t.actionRequiredBy === 'technician' ? '🔧 Đã chuyển Kỹ thuật viên' :
                             t.actionRequiredBy === 'coach' ? '🏋️ Đã chuyển Huấn luyện viên' : '👑 BQL trực tiếp xử lý'}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: '#fff', margin: 0, lineHeight: 1.4 }}>
                          {t.adminResponse}
                        </p>
                        {t.respondedAt && (
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
                            Đã ban hành chỉ đạo lúc: {new Date(t.respondedAt).toLocaleTimeString('vi-VN')} {new Date(t.respondedAt).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                      <button
                        className="btn-primary"
                        style={{ padding: '7px 16px', fontSize: 12 }}
                        onClick={() => handleOpenResponseModal(t)}
                      >
                        <MessageSquare size={14} />
                        <span>{t.adminResponse ? 'Sửa / Bổ Sung Chỉ Đạo' : 'Chỉ Đạo & Phản Hồi Xử Lý'}</span>
                      </button>

                      {t.status !== 'resolved' && (
                        <button
                          className="btn-outline"
                          style={{ padding: '7px 14px', fontSize: 12, color: 'var(--color-success)', borderColor: 'rgba(0, 200, 83, 0.4)' }}
                          onClick={() => handleQuickResolveTicket(t)}
                        >
                          <CheckCircle2 size={14} />
                          <span>Duyệt & Đóng Ticket Xong</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Coach Management & Pricing (Luồng 9) */}
      {activeTab === 'coaches-config' && (
        <div className="card-athletic">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 20, color: '#fff' }}>Quản Trị Huấn Luyện Viên & Bảng Giá Dạy Lẻ</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Thiết lập cấp bậc (Junior/Senior/Master), đơn giá riêng từng Coach và tỷ lệ chia sẻ hoa hồng
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {coaches.map(c => (
              <div key={c.id} style={{
                background: 'var(--bg-app)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-sm)',
                padding: 18
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <img src={c.avatar} alt={c.name} style={{ width: 50, height: 50, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: '#fff', fontSize: 15 }}>{c.name}</strong>
                      <span className={`badge badge-rank-${c.rank}`}>{c.rank.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.code} • {c.phone}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Chuyên môn: <strong style={{ color: '#fff' }}>{c.specialties.join(', ')}</strong>
                </div>

                <div style={{
                  background: 'var(--bg-panel)',
                  padding: 12,
                  borderRadius: 6,
                  marginBottom: 14
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Đơn giá buổi dạy lẻ:</span>
                    <strong className="metric-mono" style={{ color: 'var(--color-primary)', fontSize: 15 }}>
                      {c.hourlyRateVND.toLocaleString('vi-VN')} đ
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Hoa hồng Coach nhận:</span>
                    <strong style={{ color: 'var(--color-success)', fontSize: 13 }}>{c.commissionPercent}%</strong>
                  </div>
                </div>

                <button
                  className="btn-outline"
                  style={{ width: '100%', padding: '8px' }}
                  onClick={() => {
                    setEditingCoach(c);
                    setNewHourlyRate(c.hourlyRateVND);
                    setNewCommission(c.commissionPercent);
                    setNewRank(c.rank);
                  }}
                >
                  <Edit3 size={14} />
                  <span>Cấu Hình Giá & Cấp Bậc</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Coach Pricing Modal */}
      {editingCoach && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div style={{ padding: '20px 24px', borderBottom: 'var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, color: '#fff' }}>Thiết Lập Đơn Giá Cho HLV {editingCoach.name}</h3>
              <button className="btn-ghost" onClick={() => setEditingCoach(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveCoachPricing} style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Cấp Bậc Chuyên Môn:
                </label>
                <select
                  className="form-input"
                  value={newRank}
                  onChange={(e) => setNewRank(e.target.value as any)}
                >
                  <option value="junior">JUNIOR COACH (Khởi điểm)</option>
                  <option value="senior">SENIOR COACH (Kinh nghiệm &gt; 3 năm)</option>
                  <option value="master">MASTER COACH (Vận động viên / Bằng Quốc tế)</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Đơn Giá Dạy Lẻ 1 Buổi (VNĐ) *:
                </label>
                <input
                  type="number"
                  step="50000"
                  className="form-input"
                  value={newHourlyRate}
                  onChange={(e) => setNewHourlyRate(parseInt(e.target.value) || 250000)}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Tỷ Lệ Hoa Hồng Thực Nhận (%):
                </label>
                <input
                  type="number"
                  min="30"
                  max="80"
                  className="form-input"
                  value={newCommission}
                  onChange={(e) => setNewCommission(parseInt(e.target.value) || 50)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditingCoach(null)}>
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  <span>Lưu Cấu Hình Giá</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: Packages & Specialized Courses */}
      {activeTab === 'packages-engine' && (
        <div className="card-athletic">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 20, color: '#fff' }}>Quản Lý Gói Tập & Khóa Học Chuyên Biệt</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Cấu hình mô hình Hybrid (Vào tập không giới hạn + Quota buổi PT) và Khóa học chuyên sâu
              </p>
            </div>
            <button className="btn-primary" onClick={() => setIsCreatingPackage(true)}>
              <Plus size={16} />
              <span>Tạo Gói Dịch Vụ Mới</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            {packages.map(pkg => (
              <div key={pkg.id} style={{
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                padding: 20,
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 17, color: '#fff' }}>{pkg.name}</h4>
                  {pkg.type === 'hybrid_pt' ? (
                    <span className="badge badge-primary">Hybrid PT</span>
                  ) : pkg.type === 'specialized_course' ? (
                    <span className="badge" style={{ background: 'rgba(0,176,255,0.15)', color: 'var(--color-info)' }}>Chuyên Biệt</span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Standard</span>
                  )}
                </div>

                <div className="metric-mono" style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-primary)', marginBottom: 8 }}>
                  {pkg.priceVND.toLocaleString('vi-VN')} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>đ / {pkg.durationMonths} Tháng</span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  {pkg.description}
                </p>

                {pkg.ptSessionsIncluded > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600, marginBottom: 12 }}>
                    ✓ Bao gồm: {pkg.ptSessionsIncluded} buổi tập cùng HLV cá nhân
                  </div>
                )}

                <div style={{ fontSize: 12, color: 'var(--text-dim)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                  {pkg.features.slice(0, 3).map((f, i) => (
                    <div key={i}>• {f}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Package Modal */}
      {isCreatingPackage && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div style={{ padding: '20px 24px', borderBottom: 'var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, color: '#fff' }}>Tạo Gói Tập / Khóa Học Mới</h3>
              <button className="btn-ghost" onClick={() => setIsCreatingPackage(false)}>✕</button>
            </div>

            <form onSubmit={handleSavePackage} style={{ padding: 24 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Tên Gói Tập *:
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="VD: Gói VIP Hybrid Platinum (3 Tháng + 24 Buổi PT)"
                  value={newPackageForm.name}
                  onChange={(e) => setNewPackageForm({ ...newPackageForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Loại Gói:
                  </label>
                  <select
                    className="form-input"
                    value={newPackageForm.type}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, type: e.target.value as any })}
                  >
                    <option value="hybrid_pt">Hybrid (Gym + Quota PT)</option>
                    <option value="specialized_course">Khóa học chuyên biệt</option>
                    <option value="standard_gym">Standard Gym thường</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Thời hạn (Tháng):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    value={newPackageForm.durationMonths}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, durationMonths: parseFloat(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Giá Niêm Yết (VNĐ) *:
                  </label>
                  <input
                    type="number"
                    step="100000"
                    required
                    className="form-input"
                    value={newPackageForm.priceVND}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, priceVND: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Số Buổi PT Kèm Theo:
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPackageForm.ptSessionsIncluded}
                    onChange={(e) => setNewPackageForm({ ...newPackageForm, ptSessionsIncluded: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Mô Tả Ngắn:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={newPackageForm.description}
                  onChange={(e) => setNewPackageForm({ ...newPackageForm, description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Danh sách đặc quyền (Mỗi dòng một mục):
                </label>
                <textarea
                  rows={3}
                  className="form-input"
                  value={newPackageForm.featuresText}
                  onChange={(e) => setNewPackageForm({ ...newPackageForm, featuresText: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsCreatingPackage(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  <span>Tạo Gói Mới</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: RBAC & Audit Trail */}
      {activeTab === 'audit-rbac' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 'var(--space-xxxl)' }}>
          {/* RBAC Matrix */}
          <div className="card-athletic">
            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 14 }}>Ma Trận Phân Quyền (RBAC)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 6 }}>
                <strong style={{ color: 'var(--color-primary)' }}>1. Center Manager (Quản lý)</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  Toàn quyền hệ thống: Doanh thu BI, cấu hình bảng giá Coach, tạo gói tập, phân quyền và duyệt ngoại lệ.
                </p>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 6 }}>
                <strong style={{ color: 'var(--color-success)' }}>2. Receptionist (Lễ tân)</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  Quét check-in QR, đăng ký thành viên mới tại quầy, thu tiền mặt/chuyển khoản, in hóa đơn K80, tiếp nhận yêu cầu hỗ trợ.
                </p>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 6 }}>
                <strong style={{ color: 'var(--color-info)' }}>3. Coach (Huấn luyện viên)</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  Xem lịch dạy, điểm danh buổi tập, xử lý vắng mặt/học bù, ghi nhận tạ/rep, tạo kế hoạch dinh dưỡng và gợi ý bài tập bằng AI.
                </p>
              </div>
            </div>
          </div>

          {/* Audit Trail Real-time logs */}
          <div className="card-athletic">
            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 14 }}>Nhật Ký Thao Tác Hệ Thống (Audit Trail)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {auditLogs.map(log => (
                <div key={log.id} style={{
                  padding: 12,
                  background: 'var(--bg-app)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ color: 'var(--color-primary)' }}>{log.action}</strong>
                    <span className="metric-mono" style={{ color: 'var(--text-dim)' }}>
                      {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  <div style={{ color: '#fff' }}>
                    Thực hiện bởi: <strong>{log.actorName}</strong> ({log.actorRole.toUpperCase()})
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                    Mục tiêu: <strong style={{ color: '#fff' }}>{log.target}</strong>
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4 }}>
                    "{log.details}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Incident & Ticket Directive Modal (Modal Chỉ Đạo & Phản Hồi) */}
      {respondingTicket && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: 'var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: 18, color: '#fff', margin: 0 }}>
                  Chỉ Đạo & Phản Hồi Xử Lý Báo Cáo
                </h3>
                <span className="metric-mono" style={{ fontSize: 12, color: 'var(--color-primary)' }}>
                  Mã yêu cầu: {respondingTicket.ticketCode || respondingTicket.id}
                </span>
              </div>
              <button className="btn-ghost" onClick={() => setRespondingTicket(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveAdminResponse} style={{ padding: 24 }}>
              {/* Incident Summary Card */}
              <div style={{
                background: 'var(--bg-app)',
                padding: 14,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 18
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Nội dung Lễ tân ghi nhận:
                </div>
                <strong style={{ color: '#fff', fontSize: 14, display: 'block', marginBottom: 4 }}>
                  {respondingTicket.title}
                </strong>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginBottom: 8, lineHeight: 1.4 }}>
                  "{respondingTicket.description}"
                </p>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Hội viên: <strong style={{ color: '#fff' }}>{respondingTicket.memberName}</strong> ({respondingTicket.memberPhone}) • Người gửi: <strong>{respondingTicket.createdBy || 'Lễ tân'}</strong>
                </div>
              </div>

              {/* Quick Template Directives (Tiện lợi cho Admin bấm 1 chạm) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                  ⚡ Chỉ đạo mẫu nhanh (Bấm để tự động điền):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 12,
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setAdminResponseText('Đã phê duyệt bảo lưu gói tập 10 ngày. Yêu cầu Lễ tân cập nhật ngày hết hạn trên phần mềm và gọi điện thông báo hội viên.');
                      setTargetAssignee('receptionist');
                      setTargetStatus('in_progress');
                    }}
                  >
                    👉 <strong>Duyệt bảo lưu thẻ:</strong> Giao Lễ tân cập nhật hạn thẻ & báo khách
                  </button>

                  <button
                    type="button"
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 12,
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setAdminResponseText('Đã tìm thấy đồ thất lạc tại quầy gửi đồ. Yêu cầu Lễ tân gọi điện liên hệ khách hẹn giờ đến quầy nhận lại.');
                      setTargetAssignee('receptionist');
                      setTargetStatus('in_progress');
                    }}
                  >
                    👉 <strong>Đồ thất lạc:</strong> Đã tìm thấy, giao Lễ tân liên hệ khách nhận lại
                  </button>

                  <button
                    type="button"
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 12,
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setAdminResponseText('Đã gọi kỹ thuật viên Technogym hẹn đến bảo dưỡng lúc 14:00 hôm nay. Lễ tân duy trì biển báo tạm ngưng sử dụng thiết bị.');
                      setTargetAssignee('technician');
                      setTargetStatus('in_progress');
                    }}
                  >
                    👉 <strong>Hỏng máy tập:</strong> Đã báo bảo trì hãng, giao Lễ tân giữ biển báo
                  </button>

                  <button
                    type="button"
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 12,
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setAdminResponseText('BQL đã trực tiếp làm việc và giải quyết dứt điểm với các bên liên quan. Đóng ticket sự cố.');
                      setTargetAssignee('admin');
                      setTargetStatus('resolved');
                    }}
                  >
                    👉 <strong>BQL giải quyết dứt điểm:</strong> Đóng ticket hoàn tất
                  </button>
                </div>
              </div>

              {/* Directive Textarea */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Nội Dung Chỉ Đạo Của Quản Lý (Admin Response) *:
                </label>
                <textarea
                  required
                  rows={3}
                  className="form-input"
                  style={{ resize: 'vertical' }}
                  placeholder="Nhập nội dung chỉ đạo, phương án giải quyết hoặc hướng dẫn nhân sự..."
                  value={adminResponseText}
                  onChange={(e) => setAdminResponseText(e.target.value)}
                />
              </div>

              {/* Assignment (Phân công người xử lý) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Phân Công / Yêu Cầu Bộ Phận Xử Lý:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-app)',
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: targetAssignee === 'receptionist' ? '1px solid var(--color-primary)' : '1px solid transparent'
                  }}>
                    <input
                      type="radio"
                      name="assignee"
                      checked={targetAssignee === 'receptionist'}
                      onChange={() => setTargetAssignee('receptionist')}
                    />
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                      ⚡ Yêu cầu Lễ Tân xử lý tiếp
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-app)',
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: targetAssignee === 'technician' ? '1px solid var(--color-primary)' : '1px solid transparent'
                  }}>
                    <input
                      type="radio"
                      name="assignee"
                      checked={targetAssignee === 'technician'}
                      onChange={() => setTargetAssignee('technician')}
                    />
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                      🔧 Chuyển Kỹ Thuật Viên bảo trì
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-app)',
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: targetAssignee === 'coach' ? '1px solid var(--color-primary)' : '1px solid transparent'
                  }}>
                    <input
                      type="radio"
                      name="assignee"
                      checked={targetAssignee === 'coach'}
                      onChange={() => setTargetAssignee('coach')}
                    />
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                      🏋️ Chuyển Huấn Luyện Viên
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-app)',
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: targetAssignee === 'admin' ? '1px solid var(--color-primary)' : '1px solid transparent'
                  }}>
                    <input
                      type="radio"
                      name="assignee"
                      checked={targetAssignee === 'admin'}
                      onChange={() => setTargetAssignee('admin')}
                    />
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                      👑 Ban Quản Lý trực tiếp xử lý
                    </span>
                  </label>
                </div>
              </div>

              {/* Status Update */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Cập Nhật Trạng Thái Báo Cáo:
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-app)',
                    padding: '8px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: targetStatus === 'in_progress' ? '1px solid var(--color-warning)' : '1px solid transparent'
                  }}>
                    <input
                      type="radio"
                      name="status"
                      checked={targetStatus === 'in_progress'}
                      onChange={() => setTargetStatus('in_progress')}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-warning)', fontWeight: 700 }}>
                      🟡 Đang Chỉ Đạo Xử Lý (Giao việc)
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-app)',
                    padding: '8px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: targetStatus === 'resolved' ? '1px solid var(--color-success)' : '1px solid transparent'
                  }}>
                    <input
                      type="radio"
                      name="status"
                      checked={targetStatus === 'resolved'}
                      onChange={() => setTargetStatus('resolved')}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 700 }}>
                      🟢 Phê Duyệt & Đóng Hoàn Tất (Resolved)
                    </span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn-secondary" onClick={() => setRespondingTicket(null)}>
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>
                  <Send size={15} />
                  <span>Ban Hành Chỉ Đạo & Gửi Lệnh</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
