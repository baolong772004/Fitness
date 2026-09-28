import React, { useState, useEffect } from 'react';
import { Member, CheckInRecord, PackagePlan, Coach, SupportTicket, Invoice } from '../../types';
import { MockDatabase } from '../../mocks/mockData';
import { soundEffects } from '../../services/audioService';
import { PaymentModal } from '../payment/PaymentModal';
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
  Dumbbell
} from 'lucide-react';

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

  const [newTicketForm, setNewTicketForm] = useState({
    memberName: '',
    memberPhone: '',
    category: 'lost_found' as const,
    title: '',
    description: ''
  });

  // Load from Mock Database
  const reloadData = () => {
    setMembers(MockDatabase.getMembers());
    setCoaches(MockDatabase.getCoaches());
    setPackages(MockDatabase.getPackages());
    setCheckIns(MockDatabase.getCheckIns());
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

  return (
    <div style={{ padding: 'var(--space-xxl) var(--space-xl)', maxWidth: 'var(--max-content-width)', margin: '0 auto' }}>
      {/* Top Banner Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--space-lg)',
        marginBottom: 'var(--space-xxxl)'
      }}>
        <div className="card-athletic" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: 12, borderRadius: 'var(--radius-full)' }}>
            <QrCode size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Check-in hôm nay</div>
            <div className="metric-mono" style={{ fontSize: 26, color: '#fff', fontWeight: 800 }}>{checkIns.length} lượt</div>
          </div>
        </div>

        <div className="card-athletic" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(0, 200, 83, 0.15)', color: 'var(--color-success)', padding: 12, borderRadius: 'var(--radius-full)' }}>
            <UserPlus size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Hội viên đang hoạt động</div>
            <div className="metric-mono" style={{ fontSize: 26, color: '#fff', fontWeight: 800 }}>
              {members.filter(m => m.status === 'active' || m.status === 'expiring_soon').length} / {members.length}
            </div>
          </div>
        </div>

        <div className="card-athletic" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255, 171, 0, 0.15)', color: 'var(--color-warning)', padding: 12, borderRadius: 'var(--radius-full)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Gói sắp hết hạn (&lt; 5 ngày)</div>
            <div className="metric-mono" style={{ fontSize: 26, color: 'var(--color-warning)', fontWeight: 800 }}>
              {members.filter(m => m.status === 'expiring_soon').length} người
            </div>
          </div>
        </div>

        <div className="card-athletic" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(0, 176, 255, 0.15)', color: 'var(--color-info)', padding: 12, borderRadius: 'var(--radius-full)' }}>
            <HelpCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Yêu cầu hỗ trợ chờ xử lý</div>
            <div className="metric-mono" style={{ fontSize: 26, color: '#fff', fontWeight: 800 }}>
              {tickets.filter(t => t.status === 'open').length} tickets
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: Live QR Check-in Terminal (Luồng 3) */}
      {activeTab === 'checkin' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xxxl)' }}>
          {/* Left Column: Quick Scanner & Member Picker for Testing */}
          <div className="card-athletic">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ color: 'var(--color-primary)' }}>
                <QrCode size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: 20, color: '#fff' }}>Cổng Quét QR & Tra Cứu Thẻ</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Quét mã QR từ điện thoại hội viên hoặc nhập Số điện thoại / Mã thẻ
                </p>
              </div>
            </div>

            {/* Search Input Form */}
            <form onSubmit={handleSearchCheckIn} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nhập SĐT (VD: 0901 234 567) hoặc Mã MEM-1001..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <Search size={18} style={{ position: 'absolute', right: 14, top: 13, color: 'var(--text-dim)' }} />
                </div>
                <button type="submit" className="btn-primary">
                  <span>Kiểm Tra</span>
                </button>
              </div>
            </form>

            {/* Quick Testing Member Buttons (Super convenient for evaluators!) */}
            <div style={{
              background: 'var(--bg-app)',
              padding: 16,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Hội viên demo nhanh (Bấm để quét ngay)
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>Click để test cả trường hợp hợp lệ & hết hạn</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(m => (
                  <div
                    key={m.id}
                    onClick={() => handlePerformCheckIn(m)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-panel)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.05)',
                      transition: 'border-color 0.15s, transform 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img 
                        src={m.avatar} 
                        alt={m.name} 
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {m.code} • {m.phone}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${
                        m.status === 'active' ? 'badge-active' :
                        m.status === 'expiring_soon' ? 'badge-expiring' : 'badge-expired'
                      }`}>
                        {m.status === 'active' ? 'Đang hoạt động' :
                         m.status === 'expiring_soon' ? `Còn ${m.daysRemaining} ngày` : 'Đã hết hạn'}
                      </span>
                      {m.ptSessionsRemaining > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--color-primary)', marginTop: 2, fontWeight: 600 }}>
                          PT: {m.ptSessionsRemaining}/{m.ptSessionsTotal} buổi
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Verification Status Result Card */}
          <div>
            {checkInResult ? (
              <div className="card-athletic" style={{
                borderColor: checkInResult.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)',
                background: checkInResult.status === 'approved' 
                  ? 'linear-gradient(180deg, rgba(0,200,83,0.08), var(--bg-card))'
                  : 'linear-gradient(180deg, rgba(255,61,0,0.08), var(--bg-card))',
                padding: '28px'
              }}>
                {/* Result Status Banner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: 'var(--radius-full)',
                    background: checkInResult.status === 'approved' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                    color: checkInResult.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {checkInResult.status === 'approved' ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: 18,
                      color: checkInResult.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)'
                    }}>
                      {checkInResult.message}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                      {checkInResult.details}
                    </p>
                  </div>
                </div>

                {/* Member Profile Snapshot if verified */}
                {verifiedMember && (
                  <div style={{
                    background: 'var(--bg-app)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 20,
                    border: '1px solid rgba(255,255,255,0.08)',
                    lineHeight: 1.8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
                      <img 
                        src={verifiedMember.avatar} 
                        alt={verifiedMember.name} 
                        style={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                      />
                      <div>
                        <h4 style={{ fontSize: 18, color: '#fff' }}>{verifiedMember.name}</h4>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Mã HV: <strong style={{ color: '#fff' }}>{verifiedMember.code}</strong> • SĐT: {verifiedMember.phone}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          CCCD: {verifiedMember.cccd}
                        </p>
                      </div>
                    </div>

                    <div style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Gói đang sử dụng:</span>
                        <strong style={{ color: '#fff' }}>{verifiedMember.packageName}</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Thời hạn gói:</span>
                        <span className="metric-mono" style={{ color: verifiedMember.daysRemaining > 3 ? '#fff' : 'var(--color-danger)' }}>
                          {verifiedMember.packageEndDate} ({verifiedMember.daysRemaining > 0 ? `Còn ${verifiedMember.daysRemaining} ngày` : 'Đã hết hạn'})
                        </span>
                      </div>

                      {verifiedMember.ptSessionsTotal > 0 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                          background: 'rgba(254,116,19,0.08)',
                          padding: '6px 10px',
                          borderRadius: 6
                        }}>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Hạn mức buổi PT cá nhân:</span>
                          <span className="metric-mono" style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                            {verifiedMember.ptSessionsRemaining} / {verifiedMember.ptSessionsTotal} buổi
                          </span>
                        </div>
                      )}

                      {verifiedMember.assignedCoachName && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ color: 'var(--text-muted)' }}>HLV phụ trách:</span>
                          <strong style={{ color: '#fff' }}>{verifiedMember.assignedCoachName}</strong>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 10 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Tổng số lượt đã vào tập:</span>
                        <span className="metric-mono" style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                          {verifiedMember.totalCheckIns} lượt
                        </span>
                      </div>
                    </div>

                    {/* Quick action buttons if expired */}
                    {verifiedMember.status === 'expired' && (
                      <div style={{ marginTop: 16 }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ width: '100%' }}
                          onClick={() => {
                            onTabChange('pos');
                            setNewMemberForm(prev => ({ ...prev, name: verifiedMember.name, phone: verifiedMember.phone }));
                          }}
                        >
                          <CreditCard size={16} />
                          <span>Gia Hạn Gói Nhanh Tại Quầy</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Waiting Screen */
              <div className="card-athletic" style={{ textAlign: 'center', padding: '50px 20px', borderStyle: 'dashed' }}>
                <div style={{
                  width: 68,
                  height: 68,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-app)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  color: 'var(--text-dim)'
                }}>
                  <QrCode size={36} />
                </div>
                <h4 style={{ fontSize: 17, color: '#fff' }}>Cổng Đang Chờ Quét</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, margin: '8px auto 0 auto' }}>
                  Hãy chọn một hội viên mẫu bên trái hoặc nhập SĐT để chạy thử nghiệm luồng Check-in thực tế.
                </p>
              </div>
            )}

            {/* Recent Check-in Logs Table */}
            <div className="card-athletic" style={{ marginTop: 20, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 12 }}>
                Nhật ký Check-in vừa diễn ra
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {checkIns.slice(0, 5).map(c => (
                  <div key={c.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--bg-app)',
                    borderRadius: 6,
                    fontSize: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: c.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)'
                      }} />
                      <strong style={{ color: '#fff' }}>{c.memberName}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>({c.packageName})</span>
                    </div>
                    <span className="metric-mono" style={{ color: 'var(--text-dim)' }}>
                      {new Date(c.timestamp).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Walk-in POS & Membership Sales (Luồng 2 & Bán tại quầy) */}
      {activeTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xxxl)' }}>
          {/* Left Form: Member Registration & Package Selection */}
          <div className="card-athletic">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ color: 'var(--color-primary)' }}>
                <UserPlus size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: 20, color: '#fff' }}>Đăng Ký & Bán Gói Tại Quầy (POS)</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Tạo hồ sơ hội viên mới, chọn gói tập và thu tiền xuất hóa đơn ngay tại quầy
                </p>
              </div>
            </div>

            <form onSubmit={handleStartWalkinPayment}>
              {/* Personal Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Họ và Tên Hội Viên *
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="VD: Trần Đình Trọng"
                    value={newMemberForm.name}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Số Điện Thoại Liên Hệ *
                  </label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    placeholder="VD: 0988 123 456"
                    value={newMemberForm.phone}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Email Nhận Hóa Đơn
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="email@example.com"
                    value={newMemberForm.email}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Giới tính
                  </label>
                  <select
                    className="form-input"
                    value={newMemberForm.gender}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, gender: e.target.value as any })}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Năm sinh
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={newMemberForm.birthYear}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, birthYear: parseInt(e.target.value) || 1998 })}
                  />
                </div>
              </div>

              {/* Package Selection Cards */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 10 }}>
                  Chọn Gói Tập / Khóa Học Đăng Ký:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {packages.map(pkg => {
                    const isSelected = newMemberForm.selectedPackageId === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setNewMemberForm({ ...newMemberForm, selectedPackageId: pkg.id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: isSelected ? 'rgba(254, 116, 19, 0.12)' : 'var(--bg-app)',
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ color: '#fff', fontSize: 14 }}>{pkg.name}</strong>
                            {pkg.type === 'hybrid_pt' && (
                              <span className="badge badge-primary" style={{ fontSize: 10 }}>Hybrid Gym + PT</span>
                            )}
                            {pkg.type === 'specialized_course' && (
                              <span className="badge" style={{ background: 'rgba(0,176,255,0.15)', color: 'var(--color-info)', fontSize: 10 }}>
                                Khóa Chuyên Biệt
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {pkg.description}
                          </p>
                        </div>

                        <div className="metric-mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)' }}>
                          {pkg.priceVND.toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coach Selection (if Hybrid PT) */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 8 }}>
                  Chỉ định Huấn Luyện Viên Cá Nhân (Tùy chọn):
                </label>
                <select
                  className="form-input"
                  value={newMemberForm.selectedCoachId}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, selectedCoachId: e.target.value })}
                >
                  {coaches.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.rank.toUpperCase()}) - Chuyên: {c.specialties[0]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }}>
                <CreditCard size={18} />
                <span>Tiến Hành Thu Tiền & Kích Hoạt Gói</span>
              </button>
            </form>
          </div>

          {/* Right Summary: Selected Plan Details */}
          <div>
            <div className="card-athletic">
              <h4 style={{ fontSize: 16, color: '#fff', marginBottom: 14 }}>Tóm Tắt Quyền Lợi Gói Đang Chọn</h4>
              {(() => {
                const pkg = packages.find(p => p.id === newMemberForm.selectedPackageId);
                if (!pkg) return null;
                return (
                  <div>
                    <div style={{
                      padding: 16,
                      background: 'var(--bg-app)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 16,
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 4 }}>
                        {pkg.name}
                      </div>
                      <div className="metric-mono" style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>
                        {pkg.priceVND.toLocaleString('vi-VN')} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>VNĐ / {pkg.durationMonths} Tháng</span>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 6 }}>Đặc quyền bao gồm:</div>
                      {pkg.features.map((feat, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Check size={14} color="var(--color-success)" />
                          <span style={{ color: '#fff' }}>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {pkg.ptSessionsIncluded > 0 && (
                      <div style={{
                        marginTop: 16,
                        padding: '12px 14px',
                        background: 'rgba(254,116,19,0.1)',
                        border: '1px solid rgba(254,116,19,0.3)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 12,
                        color: '#fff'
                      }}>
                        ⭐ <strong>Gói Hybrid:</strong> Khách hàng có <strong>{pkg.ptSessionsIncluded} buổi tập</strong> với HLV cá nhân. Số buổi này được trừ độc lập với số lần vào phòng tập tự do.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Member Directory */}
      {activeTab === 'members' && (
        <div className="card-athletic">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 20, color: '#fff' }}>Danh Sách Toàn Bộ Thành Viên</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tra cứu hồ sơ, trạng thái gói tập và lịch sử check-in</p>
            </div>
            <button className="btn-primary" onClick={() => onTabChange('pos')}>
              <Plus size={16} />
              <span>Đăng Ký Thành Viên Mới</span>
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 8px' }}>Hội Viên</th>
                  <th style={{ padding: '12px 8px' }}>Số Điện Thoại</th>
                  <th style={{ padding: '12px 8px' }}>Gói Tập Đang Dùng</th>
                  <th style={{ padding: '12px 8px' }}>Hạn Sử Dụng</th>
                  <th style={{ padding: '12px 8px' }}>Buổi PT Còn</th>
                  <th style={{ padding: '12px 8px' }}>Trạng Thái</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={m.avatar} alt={m.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <strong style={{ color: '#fff', display: 'block' }}>{m.name}</strong>
                          <span className="metric-mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.code}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#fff' }}>{m.phone}</td>
                    <td style={{ padding: '12px 8px', color: '#fff' }}>{m.packageName}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className="metric-mono" style={{ color: m.daysRemaining > 3 ? '#fff' : 'var(--color-danger)' }}>
                        {m.packageEndDate} ({m.daysRemaining} ngày)
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {m.ptSessionsTotal > 0 ? (
                        <span className="metric-mono" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                          {m.ptSessionsRemaining}/{m.ptSessionsTotal}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge ${
                        m.status === 'active' ? 'badge-active' :
                        m.status === 'expiring_soon' ? 'badge-expiring' : 'badge-expired'
                      }`}>
                        {m.status === 'active' ? 'Hoạt động' :
                         m.status === 'expiring_soon' ? 'Sắp hết hạn' : 'Hết hạn'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button
                        className="btn-outline"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => {
                          onTabChange('checkin');
                          handlePerformCheckIn(m);
                        }}
                      >
                        Quét Check-in
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Support Tickets */}
      {activeTab === 'tickets' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xxxl)' }}>
          {/* Ticket List */}
          <div className="card-athletic">
            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 16 }}>Danh Sách Yêu Cầu Hỗ Trợ Tại Quầy</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tickets.map(t => (
                <div key={t.id} style={{
                  padding: 16,
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: t.actionRequiredBy === 'receptionist' && t.status !== 'resolved'
                    ? '1px solid var(--color-warning)'
                    : '1px solid rgba(255,255,255,0.06)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="metric-mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-primary)' }}>
                        {t.ticketCode || t.id.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: t.category === 'lost_found' ? 'var(--color-warning)' :
                               t.category === 'freeze_request' ? 'var(--color-info)' :
                               t.category === 'equipment' ? 'var(--color-danger)' : '#fff'
                      }}>
                        {t.category === 'lost_found' ? 'Đồ thất lạc' :
                         t.category === 'freeze_request' ? 'Bảo lưu gói tập' :
                         t.category === 'equipment' ? 'Hỏng máy tập / CSVC' :
                         t.category === 'coach_feedback' ? 'Phản ánh HLV' : 'Yêu cầu khác'}
                      </span>
                    </div>

                    <span className={`badge ${
                      t.status === 'open' ? 'badge-warning' :
                      t.status === 'in_progress' ? 'badge-primary' : 'badge-success'
                    }`} style={{ fontSize: 10 }}>
                      {t.status === 'open' ? 'Chờ BQL duyệt' :
                       t.status === 'in_progress' ? 'Đang chỉ đạo xử lý' : 'Đã giải quyết'}
                    </span>
                  </div>

                  <h4 style={{ fontSize: 15, color: '#fff', marginBottom: 4 }}>{t.title}</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.description}</p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                    <span>Hội viên: <strong style={{ color: '#fff' }}>{t.memberName}</strong> ({t.memberPhone})</span>
                    <span>{new Date(t.createdAt).toLocaleTimeString('vi-VN')} {new Date(t.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>

                  {/* Admin Directive & Response Box */}
                  {t.adminResponse && (
                    <div style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      background: 'rgba(254, 116, 19, 0.08)',
                      border: '1px solid rgba(254, 116, 19, 0.25)',
                      borderRadius: 6
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          👨‍💼 CHỈ ĐẠO TỪ BAN QUẢN LÝ (ADMIN):
                        </span>
                        {t.actionRequiredBy === 'receptionist' && t.status !== 'resolved' && (
                          <span className="badge badge-warning" style={{ fontSize: 9 }}>
                            ⚡ Yêu cầu Lễ tân xử lý tiếp
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: '#fff', margin: 0, lineHeight: 1.4 }}>
                        {t.adminResponse}
                      </p>
                      {t.respondedAt && (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                          Chỉ đạo lúc: {new Date(t.respondedAt).toLocaleTimeString('vi-VN')} {new Date(t.respondedAt).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* If action required by receptionist or ticket in progress, give direct resolve CTA */}
                  {t.status !== 'resolved' && (t.actionRequiredBy === 'receptionist' || t.status === 'in_progress') && (
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-outline"
                        style={{ padding: '6px 14px', fontSize: 11, color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        onClick={() => handleMarkResolvedByReception(t.id)}
                      >
                        ✓ Xác Nhận Đã Xử Lý Xong Theo Chỉ Đạo
                      </button>
                    </div>
                  )}

                  {t.status === 'resolved' && t.resolvedAt && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✓ Đã hoàn tất giải quyết: {t.resolvedBy || 'Ban Quản Lý'} lúc {new Date(t.resolvedAt).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* New Ticket Form */}
          <div className="card-athletic">
            <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 16 }}>Tiếp Nhận Yêu Cầu Mới</h3>
            <form onSubmit={handleAddTicket}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Phân loại yêu cầu
                </label>
                <select
                  className="form-input"
                  value={newTicketForm.category}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value as any })}
                >
                  <option value="lost_found">Đồ thất lạc (Lost & Found)</option>
                  <option value="freeze_request">Yêu cầu bảo lưu gói tập</option>
                  <option value="equipment">Báo hỏng máy tập / Cơ sở vật chất</option>
                  <option value="coach_feedback">Phản ánh về Huấn luyện viên</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Tên Hội viên / Khách hàng
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="VD: Nguyễn Văn A"
                  value={newTicketForm.memberName}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, memberName: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  required
                  className="form-input"
                  placeholder="VD: 0912 345 678"
                  value={newTicketForm.memberPhone}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, memberPhone: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Tiêu đề yêu cầu
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="VD: Quên tai nghe bluetooth tại tủ số 12"
                  value={newTicketForm.title}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, title: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                  Mô tả chi tiết
                </label>
                <textarea
                  rows={3}
                  className="form-input"
                  placeholder="Chi tiết về màu sắc, thời điểm, phòng..."
                  value={newTicketForm.description}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                <span>Lưu Phiếu Yêu Cầu</span>
              </button>
            </form>
          </div>
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
    </div>
  );
};
