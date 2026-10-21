import React, { useState, useEffect } from 'react';
import { api, ApiPackage, ApiGroupClassSchedule, ApiCoachProfile, tokenStorage } from '../../services/api';
import type { MemberScheduleEvent } from '../../services/api/member.api';
import { soundEffects } from '../../services/audioService';
import { WebcamQrScanner } from '../../components/common/WebcamQrScanner';

import {
  QrCode,
  Calendar,
  Clock,
  Shield,
  Users,
  Award,
  ArrowRight,
  CreditCard,
  X,
  Star,
  Check,
  Dumbbell,
  MapPin,
  Phone,
  Loader2
} from 'lucide-react';

interface GuestLandingPageProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
  currentUser?: { name: string; email: string } | null;
}

export const GuestLandingPage: React.FC<GuestLandingPageProps> = ({
  activeTab,
  onTabChange,
  onOpenLogin,
  onOpenRegister,
  currentUser
}) => {
  // Live Packages from Backend API
  const [livePackages, setLivePackages] = useState<ApiPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<number | null>(null);

  // Live Schedules and Trainers from Backend API
  const [liveSchedules, setLiveSchedules] = useState<ApiGroupClassSchedule[]>([]);
  const [liveTrainers, setLiveTrainers] = useState<any[]>([]);
  const [isLoadingCoaches, setIsLoadingCoaches] = useState(false);

  // QR Check-in Modal
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrData, setQrData] = useState<{ token: string; qrCodeImage: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [selfCheckinMsg, setSelfCheckinMsg] = useState<string | null>(null);

  // Interactive Class Schedule State
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => (new Date().getDay() + 6) % 7);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [myGroupBookings, setMyGroupBookings] = useState<MemberScheduleEvent[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isLoadingMyBookings, setIsLoadingMyBookings] = useState(false);
  const [bookingStatusError, setBookingStatusError] = useState(false);
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0);
  const [bookingLoadingId, setBookingLoadingId] = useState<number | null>(null);
  const [classCheckInBooking, setClassCheckInBooking] = useState<MemberScheduleEvent | null>(null);

  // Fetch Live Data from Backend API
  const fetchLiveData = async () => {
    setIsLoadingPackages(true);
    try {
      const pkgs = await api.packages.getPackages();
      setLivePackages(pkgs || []);
    } catch (e) {
      console.warn('API packages fetch warning:', e);
      setLivePackages([]);
    } finally {
      setIsLoadingPackages(false);
    }

    setIsLoadingCoaches(true);
    try {
      const trainersRes = await api.pt.getAvailableTrainers();
      if (trainersRes && trainersRes.data) {
        setLiveTrainers(trainersRes.data);
      } else {
        setLiveTrainers([]);
      }
    } catch (e) {
      console.warn('API coaches fetch warning:', e);
      setLiveTrainers([]);
    } finally {
      setIsLoadingCoaches(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
  }, []);

  const localDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const weekDays = React.useMemo(() => {
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return labels.map((day, index) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
      return { day, date: String(date.getDate()).padStart(2, '0'), fullDate: localDateKey(date) };
    });
  }, []);

  const selectedDate = weekDays[selectedDayIndex].fullDate;

  useEffect(() => {
    let active = true;
    setIsLoadingSchedules(true);
    setScheduleError(null);
    setLiveSchedules([]);
    setMyGroupBookings([]);
    setIsLoadingMyBookings(Boolean(currentUser && api.auth.getToken()));
    setBookingStatusError(false);

    const loadSchedules = async () => {
      if (!api.auth.getToken()) {
        if (active) {
          setScheduleError('Vui lòng đăng nhập để xem lịch lớp học nhóm.');
          setIsLoadingSchedules(false);
        }
        return;
      }
      try {
        const schedules = await api.groupClasses.getSchedules(selectedDate);
        if (active) setLiveSchedules(schedules || []);
      } catch (error: any) {
        if (active) setScheduleError(error.message || 'Không tải được lịch lớp học.');
      } finally {
        if (active) setIsLoadingSchedules(false);
      }
    };

    const loadBookings = async () => {
      if (!currentUser || !api.auth.getToken()) return;
      try {
        const dayStart = new Date(`${selectedDate}T00:00:00`);
        const dayEnd = new Date(`${selectedDate}T23:59:59.999`);
        const bookings = await api.member.getMySchedule({
          fromDate: dayStart.toISOString(),
          toDate: dayEnd.toISOString(),
          type: 'GROUP'
        });
        if (active) setMyGroupBookings(bookings.filter(item => item.bookingType === 'GROUP_CLASS'));
      } catch (error) {
        if (active) {
          console.warn('Không tải được lịch đăng ký lớp nhóm:', error);
          setBookingStatusError(true);
        }
      } finally {
        if (active) setIsLoadingMyBookings(false);
      }
    };

    void loadSchedules();
    void loadBookings();
    return () => { active = false; };
  }, [selectedDate, currentUser?.email, scheduleReloadKey]);

  // Listen to tab changes or navbar event for QR Check-in
  useEffect(() => {
    if (activeTab === 'checkin-portal') {
      handleOpenLiveQR();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleOpenQRFromEvent = () => {
      handleOpenLiveQR();
    };
    window.addEventListener('aura:open-checkin-qr', handleOpenQRFromEvent);
    return () => {
      window.removeEventListener('aura:open-checkin-qr', handleOpenQRFromEvent);
    };
  }, []);

  const handleCloseQRModal = () => {
    setIsQRModalOpen(false);
    if (activeTab === 'checkin-portal') {
      onTabChange('home');
    }
  };

  // PayOS Checkout Session Trigger
  const handleCheckoutPackage = async (pkg: ApiPackage) => {
    setCheckoutLoadingId(pkg.id);
    soundEffects.playSuccessBeep();
    try {
      const res = await api.payments.createCheckoutSession(pkg.id);
      if (res.checkoutUrl) {
        window.open(res.checkoutUrl, '_blank');
      } else {
        alert(`Tạo đơn hàng thành công #${res.subscriptionId}. Bạn có thể quét mã PayOS để thanh toán.`);
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Unauthorized') || err.message.includes('401'))) {
        soundEffects.playErrorBeep();
        alert('Vui lòng đăng nhập tài khoản trước khi thực hiện thanh toán gói tập!');
        onOpenLogin?.();
      } else {
        alert(err.message || 'Lỗi khi tạo liên kết thanh toán PayOS');
      }
    } finally {
      setCheckoutLoadingId(null);
    }
  };

  // Live QR Code Generation from Backend
  const handleOpenLiveQR = async () => {
    setIsQRModalOpen(true);
    setSelfCheckinMsg(null);

    const token = api.auth.getToken();
    if (!token) {
      setQrData(null);
      setQrLoading(false);
      setSelfCheckinMsg('Vui lòng đăng nhập tài khoản để nhận mã QR điểm danh cá nhân.');
      return;
    }

    setQrLoading(true);
    try {
      const data = await api.checkin.generateQR();
      setQrData(data);
      soundEffects.playSuccessBeep();
    } catch (err: any) {
      setQrData(null);
      if (err.message && err.message.includes('401')) {
        setSelfCheckinMsg('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else {
        setSelfCheckinMsg(err.message || 'Không thể tạo mã QR điểm danh. Vui lòng thử lại sau.');
      }
    } finally {
      setQrLoading(false);
    }
  };

  const handleSelfCheckIn = async () => {
    try {
      const res = await api.checkin.checkIn(qrData?.token);
      soundEffects.playSuccessBeep();
      setSelfCheckinMsg(`✅ ${res.message || 'Check-in thành công! Chúc bạn tập luyện hứng khởi.'}`);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setSelfCheckinMsg(`❌ ${err.message || 'Check-in thất bại: Chưa có gói tập hoạt động hoặc đã hết hạn.'}`);
    }
  };

  const categories = ['ALL', ...new Set(liveSchedules.map(s => s.groupClass?.name).filter((name): name is string => Boolean(name)))];

  // Dynamic mapped classes strictly from live backend
  const classesList = liveSchedules.map((s) => ({
    scheduleId: s.id,
    category: s.groupClass?.name || 'Lớp nhóm',
    title: s.groupClass?.name || `Lớp Nhóm #${s.classId}`,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    time: `${new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
    coach: s.trainer?.fullName ? `Coach ${s.trainer.fullName}` : 'Coach Chuyên Nghiệp',
    avatar: s.trainer?.avatar || 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=120&auto=format&fit=crop&q=80',
    room: s.room?.name || 'Phòng Tập Đa Năng',
    spots: Math.max(0, s.capacity - (s.bookedCount || 0)),
    maxSpots: s.capacity,
    level: 'Mọi cấp độ'
  }));

  const filteredClasses = classesList.filter(c => {
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
    return true;
  });

  const refreshSchedule = async () => {
    const dayStart = new Date(`${selectedDate}T00:00:00`);
    const dayEnd = new Date(`${selectedDate}T23:59:59.999`);
    const [schedules, bookings] = await Promise.all([
      api.groupClasses.getSchedules(selectedDate),
      api.member.getMySchedule({ fromDate: dayStart.toISOString(), toDate: dayEnd.toISOString(), type: 'GROUP' })
    ]);
    setLiveSchedules(schedules || []);
    setMyGroupBookings(bookings.filter(item => item.bookingType === 'GROUP_CLASS'));
    setBookingStatusError(false);
  };

  const bookSession = async (session: { scheduleId: number; title: string }) => {
    if (!api.auth.getToken()) {
      soundEffects.playErrorBeep();
      alert('Vui lòng đăng nhập tài khoản để đặt chỗ tham gia lớp học nhóm!');
      onOpenLogin?.();
      return;
    }
    setBookingLoadingId(session.scheduleId);
    try {
      const result = await api.groupClasses.book(session.scheduleId);
      setMyGroupBookings(prev => [...prev.filter(item => item.scheduleId !== session.scheduleId), {
        id: result.data.booking.id,
        scheduleId: session.scheduleId,
        bookingType: 'GROUP_CLASS',
        title: session.title,
        startTime: '',
        endTime: '',
        status: 'BOOKED'
      }]);
      soundEffects.playSuccessBeep();
      alert(`Đặt chỗ thành công lớp "${session.title}"! Vui lòng có mặt trước giờ tập 10 phút.`);
      await refreshSchedule().catch(error => console.warn('Không làm mới được lịch lớp:', error));
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Không thể đặt chỗ: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setBookingLoadingId(null);
    }
  };

  const updateBooking = async (booking: MemberScheduleEvent) => {
    setBookingLoadingId(booking.scheduleId ?? null);
    try {
      const result = await api.groupClasses.cancel(booking.id);
      setMyGroupBookings(prev => prev.map(item => item.id === booking.id
        ? { ...item, status: 'CANCELLED' }
        : item));
      soundEffects.playSuccessBeep();
      alert(result.message);
      await refreshSchedule().catch(error => console.warn('Không làm mới được lịch lớp:', error));
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(err.message || 'Không thể cập nhật đăng ký lớp học.');
    } finally {
      setBookingLoadingId(null);
    }
  };

  const scanClassQr = async (qrToken: string) => {
    const booking = classCheckInBooking;
    if (!booking) return;
    setClassCheckInBooking(null);
    setBookingLoadingId(booking.scheduleId ?? null);
    try {
      const result = await api.groupClasses.checkIn(booking.id, qrToken);
      setMyGroupBookings(prev => prev.map(item => item.id === booking.id ? { ...item, status: 'CHECKED_IN' } : item));
      soundEffects.playSuccessBeep();
      alert(result.message);
      await refreshSchedule();
    } catch (error: any) {
      soundEffects.playErrorBeep();
      alert(error?.message || 'Không thể điểm danh lớp học bằng mã QR.');
    } finally {
      setBookingLoadingId(null);
    }
  };

  // Master Gym Coaches List strictly from live backend
  const coaches = liveTrainers.map((t: any) => ({
    id: t.id,
    userId: t.userId,
    name: t.fullName || t.user?.fullName || `Coach #${t.userId}`,
    role: t.specialization || '',
    experience: t.experience ? `${t.experience}+ năm kinh nghiệm` : '',
    certs: t.certifications || t.bio || '',
    image: t.avatar || t.user?.avatar || '',
    rating: t.rating !== undefined && t.rating !== null ? Number(t.rating).toFixed(1) : '',
    hourlyRate: t.hourlyRate ? Number(t.hourlyRate) : 0
  }));

  // Smooth scroll helper with header offset
  const scrollToTarget = (targetId: string) => {
    const el = document.getElementById(targetId);
    if (el) {
      const yOffset = -24;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // 4 Core Gym Pillars for the Freeletics Interactive Reveal Grid
  const gymPillars = [
    {
      id: 'pillar-weights',
      targetId: 'free-weights',
      number: '01',
      title: 'Free Weights & Dumbbells',
      tag: 'Khu Tạ Tự Do',
      image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop&q=80',
      summary: '100+ đầu tạ đơn Rogue & đĩa Olympic Eleiko. 4 bục Deadlift cao su chuyên dụng chống chấn động.',
      actionText: 'Khám Phá Khu Tạ'
    },
    {
      id: 'pillar-machines',
      targetId: 'machines',
      number: '02',
      title: 'Resistance & Machines',
      tag: 'Khu Máy Khối',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
      summary: 'Dàn máy Technogym PureStrength cơ sinh học chính xác, cô lập nhóm cơ tối đa và phòng ngừa chấn thương.',
      actionText: 'Xem Dàn Máy Tập'
    },
    {
      id: 'pillar-hiit',
      targetId: 'schedule',
      number: '03',
      title: 'Metabolic & Cardio HIIT',
      tag: 'Thể Lực & Sức Bền',
      image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
      summary: 'Dàn máy Skillmill, Assault Bike kết hợp thảm cỏ thể lực tập đẩy tạ trượt Sled & Dây thừng Battle Rope.',
      actionText: 'Xem Lịch Tập Thể Lực'
    },
    {
      id: 'pillar-pt',
      targetId: 'coaches',
      number: '04',
      title: '1-1 Personal Coaching',
      tag: 'Huấn Luyện Viên Riêng',
      image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop&q=80',
      summary: 'Lộ trình cá nhân hóa 100% cùng Master Coach NASM. Đo quét chỉ số InBody 3D và thiết lập thực đơn Macros.',
      actionText: 'Đăng Ký Test Form'
    }
  ];

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div id="checkin-portal" style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none', opacity: 0 }} />
      {/* =========================================================================
          1. FREELETICS-INSPIRED FULL-BLEED ATHLETIC HERO (No Border Radius)
          ========================================================================= */}
      <section
        id="home"
        style={{
          position: 'relative',
          minHeight: '75vh',
          display: 'flex',
          alignItems: 'center',
          padding: '64px 44px 80px',
          borderRadius: 0,
          backgroundImage: 'linear-gradient(180deg, rgba(20, 8, 3, 0.72) 0%, rgba(44, 18, 9, 0.88) 100%), url(https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1600&auto=format&fit=crop&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#FFFFFF',
          width: '100%'
        }}
      >
        <div style={{ width: '100%', position: 'relative', zIndex: 2 }}>
          {/* Top Sharp Tagline */}
          <div style={{ marginBottom: 18 }}>
            <span
              style={{
                display: 'inline-block',
                background: 'var(--color-primary)',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(255, 255, 255, 0.25)'
              }}
            >
              Hệ Thống Gym & Fitness 24/7 • Điểm Danh 1 Chạm
            </span>
          </div>

          {/* Hero Headline */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 5.8vw, 68px)',
              fontWeight: 900,
              lineHeight: 1.25,
              letterSpacing: '-0.015em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              margin: '0 0 20px'
            }}
          >
            <span style={{ display: 'block' }}>Vươn Tầm Thể Lực.</span>
            <span style={{ display: 'block', color: 'var(--aura-caramel)' }}>Thống Trị Mục Tiêu.</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(15px, 1.6vw, 19px)',
              lineHeight: 1.6,
              color: '#FAF7F2',
              maxWidth: 680,
              margin: '0 0 36px',
              opacity: 0.9,
              fontWeight: 500
            }}
          >
            Không gian tập luyện thể hình chuẩn quốc tế với trang thiết bị Technogym & Rogue cao cấp,
            đội ngũ Master Coach chuyên sâu và hệ thống quét mã QR không chạm hiện đại.
          </p>

          {/* Sharp Freeletics Buttons */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => {
                const el = document.getElementById('pricing');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{ padding: '14px 34px', fontSize: 13 }}
            >
              <span>Khám Phá Gói Tập</span>
              <ArrowRight size={15} />
            </button>

            <button
              className="btn-secondary"
              onClick={handleOpenLiveQR}
              style={{
                padding: '14px 28px',
                fontSize: 13,
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <QrCode size={16} />
              <span>Mã QR Điểm Danh</span>
            </button>
          </div>

          {/* Bottom Sharp Metric Strip */}
          <div
            style={{
              marginTop: 54,
              paddingTop: 28,
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 24
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--aura-caramel)' }}>15,000+</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, marginTop: 4 }}>
                Hội viên tập luyện
              </div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF' }}>100%</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, marginTop: 4 }}>
                Máy Technogym & Rogue
              </div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--aura-caramel)' }}>50+</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, marginTop: 4 }}>
                Master Coach NASM
              </div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF' }}>24/7</div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, marginTop: 4 }}>
                Check-in QR tự động
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. FREELETICS INTERACTIVE REVEAL PANELS (Background As Boundary, Hover Reveal)
          ========================================================================= */}
      <section id="facilities" style={{ padding: '0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ padding: '48px 36px 32px', textAlign: 'center', background: 'var(--bg-app)' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: 'var(--color-primary)',
              marginBottom: 8
            }}
          >
            Hệ Thống Không Gian Tập Luyện
          </div>
          <h2
            style={{
              fontSize: 'clamp(26px, 3.5vw, 40px)',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              margin: 0
            }}
          >
            4 Khu Vực Thể Hình Chuyên Sâu
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
            Rê chuột vào từng khu vực để xem chi tiết thiết bị và bấm để điều hướng trực tiếp đến khu vực tương ứng.
          </p>
        </div>

        {/* 4 Pillars - Full chiều ngang, không kẽ hở, 2 hàng x 2 cột */}
        <div className="fl-pillar-grid">
          {gymPillars.map(pillar => (
            <div
              key={pillar.id}
              className="fl-reveal-card"
              onClick={() => scrollToTarget(pillar.targetId)}
            >
              {/* Background Photo acting as visual boundary */}
              <img
                src={pillar.image}
                alt={pillar.title}
                className="fl-reveal-bg"
              />

              {/* Dark Gradient Scrim */}
              <div className="fl-reveal-scrim" />

              {/* Content Block */}
              <div className="fl-reveal-content">
                <span className="fl-reveal-tag">
                  {pillar.number} // {pillar.tag}
                </span>

                {/* Always-visible Title */}
                <h3 className="fl-reveal-title">
                  {pillar.title}
                </h3>

                {/* Details revealed only on hover - Concise text */}
                <div className="fl-reveal-details">
                  <p
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: '#FAF7F2',
                      margin: '0 0 16px',
                      opacity: 0.95
                    }}
                  >
                    {pillar.summary}
                  </p>

                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollToTarget(pillar.targetId);
                    }}
                    style={{
                      padding: '9px 18px',
                      fontSize: 11,
                      width: 'auto',
                      display: 'inline-flex'
                    }}
                  >
                    <span>{pillar.actionText}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Luminous Accent Divider */}
      <div className="luminous-divider" />

      {/* =========================================================================
          2B. SHOWCASE CHI TIẾT: KHU TẠ TỰ DO (Free Weights Zone)
          ========================================================================= */}
      <section
        id="free-weights"
        style={{
          padding: '64px 44px 72px',
          width: '100%',
          position: 'relative',
          backgroundImage: `linear-gradient(180deg, rgba(14, 6, 2, 0.94) 0%, rgba(24, 10, 4, 0.96) 50%, rgba(12, 5, 2, 0.98) 100%), url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          overflow: 'hidden'
        }}
      >
        <div className="aura-glow-top-right" />
        <div className="athletic-dot-grid" style={{ opacity: 0.12 }} />
        <div className="athletic-watermark" style={{ top: 20, right: 30, color: 'rgba(255, 255, 255, 0.04)' }}>
          ROGUE ELEIKO
        </div>

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#FFA050',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ display: 'inline-block', width: 24, height: 2, background: 'var(--color-primary)' }} />
              01 // TIÊU CHUẨN OLYMPIC & HARDCORE
            </div>
            <h2
              style={{
                fontSize: 'clamp(26px, 3.5vw, 40px)',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                margin: '0 0 12px',
                color: '#FFFFFF'
              }}
            >
              Khu Tạ Tự Do (Free Weights Arena)
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 15, maxWidth: 780, margin: 0, lineHeight: 1.6 }}>
              Được trang bị 100% thiết bị Rogue Fitness & Eleiko đạt chuẩn thi đấu cử tạ quốc tế. Không gian rộng rãi, thoáng đãng với sàn cao su chống rung đa tầng, đáp ứng mọi bài tập phức hợp từ căn bản đến mức tạ tối thượng.
            </p>
          </div>

          {/* Grid Layout: Photo Showcase + Specs List */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 28,
              alignItems: 'stretch'
            }}
          >
            {/* Visual Box with Badges */}
            <div
              style={{
                position: 'relative',
                minHeight: 380,
                borderRadius: 0,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#120704'
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1000&auto=format&fit=crop&q=80"
                alt="Khu Tạ Tự Do"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'brightness(0.85) contrast(1.1)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(20,8,3,0.85) 100%)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 24,
                  left: 24,
                  right: 24,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 800, color: '#FAF7F2' }}>
                  ⚡ Rogue Urethane Dumbbells (2 - 60KG)
                </div>
                <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 800, color: '#FAF7F2' }}>
                  🛡️ 4 Bục Deadlift Giảm Chấn Eleiko
                </div>
              </div>
            </div>

            {/* Equipment Features Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  title: '100+ Cặp Tạ Đơn Urethane Đúc Liền Khối',
                  desc: 'Dải tạ từ 2kg đến 60kg bước nhảy 2kg chuẩn mực. Khía kim cương bám tay, bọc cao su PU cao cấp chống va đập, bảo vệ tối đa cổ tay và khớp.',
                  highlight: 'Rogue Fitness USA'
                },
                {
                  title: '4 Bục Chuyên Dụng Nâng Tạ Deadlift & Olympic',
                  desc: 'Gỗ sồi Bắc Âu dày 50mm kết hợp 2 bên cao su hấp thụ xung lực đa tầng, triệt tiêu 98% tiếng ồn và chống nảy tạ khi thả tự do từ trên cao.',
                  highlight: 'Eleiko Sweden Certified'
                },
                {
                  title: '6 Dàn Khung Gánh Power Racks & Squat Stand',
                  desc: 'Thép hộp dày 3x3 inch chuẩn Monster Lite, trang bị chốt đỡ an toàn chịu tải 1.200kg, thanh xà đơn đa góc độ tập Chin-up/Pull-up.',
                  highlight: 'Tải trọng 1.200kg'
                },
                {
                  title: 'Bộ Đòn Tạ Olympic Thép Luyện Thủy Lực',
                  desc: 'Hệ thống đòn 20kg nam (đường kính 28mm) và 15kg nữ (25mm) chuẩn thi đấu cử tạ, trang bị 8 ổ bi bạc đạn kim (needle bearings) xoay siêu êm.',
                  highlight: 'IPF / IWF Approved'
                }
              ].map((feat, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(28, 12, 5, 0.72)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#FFFFFF' }}>
                      {feat.title}
                    </h4>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', background: 'rgba(224, 90, 43, 0.2)', color: '#FFA050', border: '1px solid rgba(224, 90, 43, 0.35)', whiteSpace: 'nowrap' }}>
                      {feat.highlight}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.7)' }}>
                    {feat.desc}
                  </p>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => scrollToTarget('pricing')}
                  style={{ padding: '12px 24px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <span>Xem Gói Hội Viên Khu Tạ</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => scrollToTarget('schedule')}
                  style={{
                    padding: '12px 20px',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#FAF7F2',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    cursor: 'pointer'
                  }}
                >
                  Xem Lịch Tập
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Luminous Accent Divider */}
      <div className="luminous-divider" />

      {/* =========================================================================
          2C. SHOWCASE CHI TIẾT: KHU MÁY KHỐI (Resistance & Machines Zone)
          ========================================================================= */}
      <section
        id="machines"
        style={{
          padding: '64px 44px 72px',
          width: '100%',
          position: 'relative',
          backgroundImage: `linear-gradient(180deg, rgba(12, 5, 2, 0.95) 0%, rgba(26, 11, 4, 0.96) 50%, rgba(14, 6, 2, 0.98) 100%), url('https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1920&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          overflow: 'hidden'
        }}
      >
        <div className="aura-glow-bottom-left" />
        <div className="athletic-dot-grid" style={{ opacity: 0.12 }} />
        <div className="athletic-watermark" style={{ top: 20, left: 30, color: 'rgba(255, 255, 255, 0.04)' }}>
          TECHNOGYM
        </div>

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#FFA050',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ display: 'inline-block', width: 24, height: 2, background: 'var(--color-primary)' }} />
              02 // CƠ SINH HỌC CHÍNH XÁC & AN TOÀN TUYỆT ĐỐI
            </div>
            <h2
              style={{
                fontSize: 'clamp(26px, 3.5vw, 40px)',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                margin: '0 0 12px',
                color: '#FFFFFF'
              }}
            >
              Khu Máy Khối (Resistance & Cable Matrix)
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 15, maxWidth: 780, margin: 0, lineHeight: 1.6 }}>
              Trang bị toàn diện dàn máy Technogym PureStrength và Selection 900 nhập khẩu nguyên chiếc từ Ý. Đường quỹ đạo chuyển động hội tụ và phân kỳ giúp cô lập nhóm cơ mục tiêu hoàn hảo, loại bỏ áp lực xấu lên khớp cổ tay và cột sống.
            </p>
          </div>

          {/* Grid Layout: Features List + Photo Showcase */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 28,
              alignItems: 'stretch'
            }}
          >
            {/* Equipment Features Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  title: 'Dàn Máy Khối Technogym PureStrength Độc Lập',
                  desc: 'Hỗ trợ chuyển động Iso-Lateral độc lập cho từng bên tay/chân. Cân bằng lực và khắc phục tình trạng lệch cơ triệt để cho người tập từ mới đến nâng cao.',
                  highlight: 'Technogym Italy'
                },
                {
                  title: 'Hệ Thống Dual Cable Matrix & Trục Xoay 360°',
                  desc: 'Dây cáp hàng không chịu tải cao kết hợp ròng rọc mượt mà. Đa dạng bài tập ngực (Cable Fly), vai (Lateral Raise) và xô lưng không góc chết.',
                  highlight: 'Đa góc độ 360°'
                },
                {
                  title: 'Khu Máy Chân Chuyên Sâu 45° Leg Press & Hack Squat',
                  desc: 'Bàn đạp góc 45 độ chịu tải 800kg, bảo vệ cột sống thắt lưng. Trang bị máy Pendulum Squat, Seated & Lying Leg Curl tập đùi sau chuyên sâu.',
                  highlight: 'Tải trọng 800KG'
                },
                {
                  title: 'Smart-Pin Tinh Chỉnh Mức Tạ Vi Mô & Đệm Da Kháng Khuẩn',
                  desc: 'Chốt chọn tạ nam châm thông minh kèm tạ phụ gia số 2.5kg. Đệm mút nhớ hình học bọc da cao cấp chống thấm mồ hôi và dễ dàng vệ sinh.',
                  highlight: 'Micro-load 2.5kg'
                }
              ].map((feat, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(28, 12, 5, 0.72)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#FFFFFF' }}>
                      {feat.title}
                    </h4>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', background: 'rgba(224, 90, 43, 0.2)', color: '#FFA050', border: '1px solid rgba(224, 90, 43, 0.35)', whiteSpace: 'nowrap' }}>
                      {feat.highlight}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.7)' }}>
                    {feat.desc}
                  </p>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  className="btn-primary"
                  onClick={() => scrollToTarget('pricing')}
                  style={{ padding: '12px 24px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <span>Khám Phá Gói Tập Máy Khối</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => scrollToTarget('coaches')}
                  style={{
                    padding: '12px 20px',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#FAF7F2',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    cursor: 'pointer'
                  }}
                >
                  Tư Vấn HLV Riêng
                </button>
              </div>
            </div>

            {/* Visual Box with Badges */}
            <div
              style={{
                position: 'relative',
                minHeight: 380,
                borderRadius: 0,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#120704'
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1000&auto=format&fit=crop&q=80"
                alt="Khu Máy Khối"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'brightness(0.85) contrast(1.1)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(20,8,3,0.85) 100%)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 24,
                  left: 24,
                  right: 24,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 800, color: '#FAF7F2' }}>
                  ⚙️ 40+ Dàn Máy Technogym Chuyên Biệt
                </div>
                <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 800, color: '#FAF7F2' }}>
                  🎯 Cô Lập Cơ Bắp Chuẩn Cơ Sinh Học
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Luminous Accent Divider */}
      <div className="luminous-divider" />

      {/* =========================================================================
          3. FREELETICS SHARP PRICING MATRIX
          ========================================================================= */}
      <section
        id="pricing"
        style={{
          padding: '64px 44px 72px',
          width: '100%',
          position: 'relative',
          backgroundImage: `linear-gradient(180deg, rgba(16, 7, 3, 0.88) 0%, rgba(28, 12, 5, 0.91) 50%, rgba(14, 6, 2, 0.95) 100%), url('https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1920&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          overflow: 'hidden'
        }}
      >
        {/* Atmospheric Aura Glow, Athletic Dot Grid & Watermark */}
        <div className="aura-glow-top-right" />
        <div className="aura-glow-bottom-left" />
        <div className="athletic-dot-grid" style={{ opacity: 0.15 }} />
        <div className="athletic-watermark" style={{ top: 20, right: 30, color: 'rgba(255, 255, 255, 0.05)' }}>
          MEMBERSHIP
        </div>

        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#FFA050',
                marginBottom: 6
              }}
            >
              Bảng Giá Niêm Yết Minh Bạch
            </div>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.2vw, 36px)',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                margin: 0,
                color: '#FFFFFF'
              }}
            >
              Lựa Chọn Gói Tập Phù Hợp
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 14, marginTop: 8 }}>
              Tất cả gói tập bao gồm quyền sử dụng toàn bộ trang thiết bị và dịch vụ tiện ích cao cấp.
            </p>
          </div>

          {isLoadingPackages ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255, 255, 255, 0.7)' }}>
              Đang tải danh sách gói tập từ máy chủ...
            </div>
          ) : livePackages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'rgba(26, 11, 5, 0.82)',
              backdropFilter: 'blur(16px)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <CreditCard size={36} color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>
                Chưa có gói tập nào khả dụng trên hệ thống
              </h4>
              <p style={{ fontSize: 13, margin: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
                Vui lòng quay lại sau hoặc liên hệ quầy lễ tân để được hỗ trợ đăng ký thẻ tập.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 20,
                alignItems: 'stretch',
                width: '100%'
              }}
            >
              {livePackages.map((pkg, idx) => {
                const isPopular = pkg.id === 2 || idx === 1;
                const priceNum = Number(pkg.price);
                const formattedPrice = isNaN(priceNum)
                  ? String(pkg.price)
                  : priceNum.toLocaleString('vi-VN');

                return (
                  <div
                    key={pkg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '28px 22px',
                      borderRadius: 0,
                      background: isPopular ? 'rgba(38, 16, 7, 0.88)' : 'rgba(24, 10, 4, 0.82)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: isPopular ? '2px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.16)',
                      boxShadow: isPopular ? '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(224, 90, 43, 0.25)' : '0 12px 32px rgba(0, 0, 0, 0.45)',
                      position: 'relative'
                    }}
                  >
                    {isPopular && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -13,
                          left: 24,
                          background: 'var(--color-primary)',
                          color: '#FFFFFF',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '3px 12px',
                          borderRadius: 0,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase'
                        }}
                      >
                        Khuyên Dùng Nhiều Nhất
                      </div>
                    )}

                    <div style={{ marginBottom: 18 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#FFB87A',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em'
                        }}
                      >
                        {pkg.type === 'PT' ? 'Huấn Luyện 1-1' : 'Hội Viên Gym'}
                      </span>
                      <h3
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          marginTop: 6,
                          letterSpacing: '-0.01em',
                          textTransform: 'uppercase',
                          color: '#FFFFFF'
                        }}
                      >
                        {pkg.name}
                      </h3>
                      <p
                        style={{
                          fontSize: 13,
                          color: 'rgba(255, 255, 255, 0.76)',
                          marginTop: 8,
                          lineHeight: 1.5,
                          minHeight: 40
                        }}
                      >
                        {pkg.description}
                      </p>
                    </div>

                    {/* Price Block */}
                    <div style={{ padding: '16px 0', borderTop: '1px solid rgba(255, 255, 255, 0.14)', borderBottom: '1px solid rgba(255, 255, 255, 0.14)', marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 32,
                            fontWeight: 900,
                            fontFamily: 'var(--font-display)',
                            color: '#FF7A30'
                          }}
                        >
                          {formattedPrice} ₫
                        </span>
                        <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>
                          / {pkg.durationDays} ngày
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#FFC58D', fontWeight: 700, marginTop: 4 }}>
                        {pkg.type === 'PT'
                          ? `Bao gồm ${pkg.totalPtSessions || 12} buổi kèm riêng 1:1`
                          : `Tặng ${pkg.trialPtSessions || 1} buổi định hướng cùng Coach`}
                      </div>
                    </div>

                    {/* Feature Bullets */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#FAF7F2' }}>
                        <Check size={15} color="#4ADE80" strokeWidth={2.5} />
                        <span>Sử dụng máy tập Rogue & Technogym 24/7</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#FAF7F2' }}>
                        <Check size={15} color="#4ADE80" strokeWidth={2.5} />
                        <span>Xông hơi Sauna & Tủ đồ riêng</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#FAF7F2' }}>
                        <Check size={15} color="#4ADE80" strokeWidth={2.5} />
                        <span>Điểm danh bằng mã QR không chạm</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#FAF7F2' }}>
                        <Check size={15} color="#4ADE80" strokeWidth={2.5} />
                        <span>Đo quét chỉ số InBody 3D định kỳ</span>
                      </div>
                    </div>

                    {/* PayOS Checkout CTA */}
                    <button
                      className="btn-primary"
                      onClick={() => handleCheckoutPackage(pkg)}
                      disabled={checkoutLoadingId === pkg.id}
                      style={{ width: '100%', padding: '13px 0' }}
                    >
                      {checkoutLoadingId === pkg.id ? (
                        <span>Đang kết nối PayOS...</span>
                      ) : (
                        <>
                          <span>Đăng Ký & Thanh Toán</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Luminous Accent Divider */}
      <div className="luminous-divider" />

      {/* =========================================================================
          4. ATHLETIC DAILY TRAINING SCHEDULE (Sharp Geometry)
          ========================================================================= */}
      <section
        id="schedule"
        style={{
          padding: '64px 44px 72px',
          width: '100%',
          position: 'relative',
          backgroundImage: `linear-gradient(180deg, rgba(14, 6, 2, 0.88) 0%, rgba(26, 11, 4, 0.91) 50%, rgba(12, 5, 2, 0.95) 100%), url('https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1920&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          overflow: 'hidden'
        }}
      >
        {/* Atmospheric Aura Glow, Athletic Dot Grid & Watermark */}
        <div className="aura-glow-center" />
        <div className="athletic-dot-grid" style={{ opacity: 0.15 }} />
        <div className="athletic-watermark" style={{ top: 20, left: 30, color: 'rgba(255, 255, 255, 0.05)' }}>
          TIMETABLE
        </div>

        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#FFA050',
                marginBottom: 6
              }}
            >
              Thời Khóa Biểu Tập Luyện
            </div>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.2vw, 36px)',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                margin: 0,
                color: '#FFFFFF'
              }}
            >
              Khung Giờ Tập Luyện Tuần Này
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 14, marginTop: 8 }}>
              Đăng ký giữ chỗ trước lớp học nhóm yêu thích cùng đội ngũ Master Coach.
            </p>
          </div>

          {/* Day Selector Rounded Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 10,
              marginBottom: 20
            }}
          >
            {weekDays.map((w, index) => {
              const isSelected = selectedDayIndex === index;
              return (
                <button
                  key={w.day}
                  onClick={() => {
                    setSelectedDayIndex(index);
                    setSelectedCategory('ALL');
                    soundEffects.playSuccessBeep();
                  }}
                  disabled={bookingLoadingId !== null}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '12px 20px',
                    borderRadius: 16,
                    border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.18)',
                    background: isSelected ? 'var(--color-primary)' : 'rgba(28, 12, 5, 0.82)',
                    backdropFilter: 'blur(12px)',
                    color: isSelected ? '#FFFFFF' : '#FAF7F2',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    minWidth: 76,
                    boxShadow: isSelected ? '0 4px 14px var(--color-primary-glow)' : '0 4px 12px rgba(0, 0, 0, 0.35)'
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, opacity: isSelected ? 0.95 : 0.7 }}>{w.day}</span>
                  <span style={{ fontSize: 19, fontWeight: 900, marginTop: 2 }}>{w.date}</span>
                </button>
              );
            })}
          </div>

          {/* Category Pills (Làm tròn hoàn toàn dạng Pill) */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {categories.map(cat => {
              const isCatActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    soundEffects.playSuccessBeep();
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 9999,
                    border: isCatActive ? '1.5px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.15)',
                    background: isCatActive ? 'var(--color-primary)' : 'rgba(28, 12, 5, 0.72)',
                    color: isCatActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.78)',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isCatActive ? '0 4px 12px var(--color-primary-glow)' : 'none'
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Classes List Cards */}
          {isLoadingSchedules ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#FFFFFF' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Đang tải lịch lớp học...
            </div>
          ) : scheduleError ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#FFFFFF' }}>
              <p>{scheduleError}</p>
              <button className="btn-secondary" onClick={() => api.auth.getToken() ? setScheduleReloadKey(key => key + 1) : onOpenLogin?.()}>
                {api.auth.getToken() ? 'Thử lại' : 'Đăng nhập'}
              </button>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'rgba(26, 11, 5, 0.82)',
              backdropFilter: 'blur(16px)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <Calendar size={36} color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>
                Chưa có lịch lớp học nhóm trong ngày này
              </h4>
              <p style={{ fontSize: 13, margin: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
                Hệ thống đang cập nhật lịch tập tuần mới. Vui lòng chọn ngày khác hoặc liên hệ hotline 1900 6868.
              </p>
            </div>
          ) : (
            <>
            {bookingStatusError && (
              <div style={{ textAlign: 'center', padding: 16, color: '#FFFFFF', marginBottom: 16, background: 'rgba(80, 28, 10, 0.85)' }}>
                Không tải được trạng thái đăng ký của bạn. <button className="btn-secondary" onClick={() => setScheduleReloadKey(key => key + 1)}>Thử lại</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, width: '100%' }}>
              {filteredClasses.map(session => {
                const booking = myGroupBookings.find(item => item.scheduleId === session.scheduleId &&
                  (item.status === 'BOOKED' || item.status === 'CHECKED_IN'));
                const now = Date.now();
                const hasStarted = new Date(session.startTime).getTime() <= now;
                const hasEnded = new Date(session.endTime).getTime() <= now;
                const canCheckIn = now >= new Date(session.startTime).getTime() - 15 * 60 * 1000 && !hasEnded;
                const isFull = session.status === 'FULL' || session.spots <= 0;
                const canCancel = booking?.status === 'BOOKED' && new Date(session.startTime).getTime() - now >= 2 * 60 * 60 * 1000;
                return (
                  <div
                    key={session.scheduleId}
                    style={{
                      padding: '22px 22px',
                      borderRadius: 0,
                      background: 'rgba(26, 11, 5, 0.84)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            background: 'rgba(224, 90, 43, 0.22)',
                            color: '#FFA066',
                            border: '1px solid rgba(224, 90, 43, 0.4)',
                            padding: '4px 10px',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase'
                          }}
                        >
                          {session.category}
                        </span>
                        <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>{session.level}</span>
                      </div>

                      <h4 style={{ fontSize: 18, fontWeight: 900, marginTop: 12, letterSpacing: '-0.01em', textTransform: 'uppercase', color: '#FFFFFF' }}>
                        {session.title}
                      </h4>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                        <img
                          src={session.avatar}
                          alt={session.coach}
                          style={{ width: 40, height: 40, borderRadius: 0, objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                        />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>{session.coach}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)' }}>{session.room}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, fontSize: 12, color: 'rgba(255, 255, 255, 0.8)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color="#FF7A30" />
                          <span>{session.time}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Users size={14} color="#FFB87A" />
                          <span>Còn {session.spots} / {session.maxSpots} chỗ</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                      {booking ? (
                        <>
                          <div style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                            {booking.status === 'CHECKED_IN' ? '✓ ĐÃ CHECK-IN' : '✓ ĐÃ ĐẶT CHỖ'}
                          </div>
                          {booking.status === 'BOOKED' && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn-secondary"
                                style={{ flex: 1, padding: '11px 8px', fontSize: 12 }}
                                disabled={bookingLoadingId !== null || !canCancel}
                                title={!canCancel ? 'Chỉ có thể hủy trước giờ học ít nhất 2 tiếng' : undefined}
                                onClick={() => updateBooking(booking)}
                              >
                                HỦY ĐĂNG KÝ
                              </button>
                              <button
                                className="btn-primary"
                                style={{ flex: 1, padding: '11px 8px', fontSize: 12 }}
                                disabled={bookingLoadingId !== null || !canCheckIn}
                                onClick={() => setClassCheckInBooking(booking)}
                              >
                                QUÉT QR ĐIỂM DANH
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <button
                          disabled={bookingLoadingId !== null || isLoadingMyBookings || bookingStatusError || isFull || hasStarted}
                          onClick={() => bookSession(session)}
                          className="btn-primary"
                          style={{ width: '100%', padding: '11px 0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          {bookingLoadingId === session.scheduleId ? (
                            <><Loader2 size={14} className="animate-spin" /> ĐANG XỬ LÝ...</>
                          ) : isLoadingMyBookings ? 'ĐANG KIỂM TRA ĐĂNG KÝ...' : hasStarted ? 'LỚP ĐÃ BẮT ĐẦU' : isFull ? 'ĐÃ HẾT CHỖ' : 'ĐẶT CHỖ THAM GIA'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      </section>

      {/* Luminous Accent Divider */}
      <div className="luminous-divider" />

      {/* =========================================================================
          5. MASTER GYM COACHES & TRAINERS (Sharp Freeletics Cards)
          ========================================================================= */}
      <section
        id="coaches"
        style={{
          padding: '64px 44px 72px',
          width: '100%',
          position: 'relative',
          backgroundImage: `linear-gradient(180deg, rgba(14, 6, 2, 0.88) 0%, rgba(28, 12, 5, 0.91) 50%, rgba(14, 6, 2, 0.95) 100%), url('https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1920&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          overflow: 'hidden'
        }}
      >
        {/* Atmospheric Aura Glow, Athletic Dot Grid & Watermark */}
        <div className="aura-glow-bottom-left" />
        <div className="aura-glow-top-right" />
        <div className="athletic-dot-grid" style={{ opacity: 0.15 }} />
        <div className="athletic-watermark" style={{ top: 20, right: 30, color: 'rgba(255, 255, 255, 0.05)' }}>
          ATHLETES
        </div>

        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: '#FFA050',
                marginBottom: 6
              }}
            >
              Đội Ngũ Huấn Luyện Viên Thể Hình
            </div>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.2vw, 36px)',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                margin: 0,
                color: '#FFFFFF'
              }}
            >
              Master Coach Đồng Hành 1-1
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 14, marginTop: 8 }}>
              100% huấn luyện viên sở hữu chứng chỉ quốc tế và kinh nghiệm thi đấu thể hình đỉnh cao.
            </p>
          </div>

          {isLoadingCoaches ? (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'rgba(255, 255, 255, 0.7)' }}>
              <Loader2 size={32} className="animate-spin" color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14 }}>Đang tải danh sách Huấn luyện viên từ máy chủ...</div>
            </div>
          ) : coaches.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'rgba(26, 11, 5, 0.82)',
              backdropFilter: 'blur(16px)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <Award size={36} color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>
                Đội ngũ Huấn Luyện Viên đang được cập nhật
              </h4>
              <p style={{ fontSize: 13, margin: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
                Hệ thống đang đồng bộ danh sách HLV chuyên nghiệp. Vui lòng liên hệ quầy lễ tân để được tư vấn gói tập PT 1-1.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 20,
                width: '100%'
              }}
            >
              {coaches.map((c, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 0,
                    background: 'rgba(26, 11, 5, 0.84)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div
                    style={{
                      height: 230,
                      position: 'relative',
                      overflow: 'hidden',
                      background: 'rgba(20, 8, 3, 0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {c.image ? (
                      <img
                        src={c.image}
                        alt={c.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                          color: 'rgba(255, 255, 255, 0.4)'
                        }}
                      >
                        <Users size={52} color="var(--color-primary)" />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          Aura Coach
                        </span>
                      </div>
                    )}
                    {c.rating && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          background: 'rgba(20, 8, 3, 0.92)',
                          color: '#FFFFFF',
                          padding: '4px 10px',
                          borderRadius: 0,
                          fontSize: 10.5,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Star size={11} color="#FFB300" fill="#FFB300" />
                        <span>{c.rating} / 5.0</span>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '18px 18px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', color: '#FFFFFF' }}>{c.name}</h4>
                      {c.role && (
                        <p style={{ fontSize: 12, color: '#FFA050', fontWeight: 800, marginTop: 4, textTransform: 'uppercase' }}>
                          {c.role}
                        </p>
                      )}
                      {(c.certs || c.experience) && (
                        <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 6, lineHeight: 1.5 }}>
                          {[c.certs, c.experience].filter(Boolean).join(' • ')}
                        </p>
                      )}
                      {c.hourlyRate > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11.5, color: '#FFB87A', fontWeight: 700 }}>
                          Kèm riêng 1-1: {Number(c.hourlyRate).toLocaleString('vi-VN')} ₫ / buổi
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 22 }}>
                      <button
                        className="btn-outline"
                        onClick={() => {
                          soundEffects.playSuccessBeep();
                          if (!api.auth.getToken()) {
                            alert(`Vui lòng đăng ký tài khoản thành viên để nhận 01 buổi tư vấn thể lực 1-1 miễn phí cùng ${c.name}!`);
                            onOpenRegister?.();
                          } else {
                            alert(`Đã ghi nhận yêu cầu tư vấn thể lực 1-1 miễn phí cùng ${c.name}. Huấn luyện viên sẽ liên hệ với bạn trong 15 phút!`);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 0',
                          fontSize: 11,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: '#FFFFFF'
                        }}
                      >
                        ĐĂNG KÝ TẬP THỬ 1-1
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          6. SHARP QR CHECK-IN MODAL (Góc vuông, Luxury High-Tech Style)
          ========================================================================= */}
      {classCheckInBooking && (
        <div role="dialog" aria-modal="true" aria-label="Quét QR điểm danh Workclass" style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.75)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ width: 'min(100%, 420px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-app)', color: 'var(--text-primary)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong>Quét QR điểm danh Workclass</strong>
              <button type="button" aria-label="Đóng" onClick={() => setClassCheckInBooking(null)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 13, marginBottom: 12 }}>Quét mã QR ca học do Coach hiển thị.</p>
            <WebcamQrScanner onScanSuccess={scanClassQr} autoStart />
          </div>
        </div>
      )}

      {isQRModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
          onClick={handleCloseQRModal}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              padding: '36px 32px',
              borderRadius: 0,
              background: 'rgba(28, 12, 6, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '2px solid var(--color-primary)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75), 0 0 32px rgba(224, 90, 43, 0.3)',
              textAlign: 'center',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseQRModal}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                borderRadius: 0,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            >
              <X size={16} />
            </button>

            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 0,
                background: 'var(--color-primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 16px var(--color-primary-glow)'
              }}
            >
              <QrCode size={26} />
            </div>

            <h3 style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#FFFFFF' }}>
              Mã QR Điểm Danh Cá Nhân
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.75)', marginTop: 6 }}>
              {api.auth.getToken()
                ? `Hội Viên: ${currentUser?.name || 'Khách Hàng'} • Quét tại cổng xoay thông minh`
                : 'Cổng xoay kiểm soát ra vào thông minh Aura Fitness'}
            </p>

            {/* QR Card Container */}
            <div
              style={{
                margin: '24px auto',
                width: 230,
                height: 230,
                borderRadius: 0,
                background: '#FFFFFF',
                padding: 16,
                border: '2px dashed var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
              }}
            >
              {qrLoading ? (
                <div style={{ fontSize: 13, color: '#333333', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={28} className="animate-spin" color="var(--color-primary)" />
                  <span>Đang tạo mã QR...</span>
                </div>
              ) : qrData?.qrCodeImage ? (
                <img
                  src={qrData.qrCodeImage}
                  alt="QR Code Điểm danh"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 12 }}>
                  <QrCode size={64} color="var(--color-primary)" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 12, color: '#444444', fontWeight: 700 }}>Mã QR Hội Viên</div>
                  <div style={{ fontSize: 11, color: '#777777', marginTop: 4 }}>Mở cổng xoay tự động</div>
                </div>
              )}
            </div>

            {/* Messages / Status */}
            {selfCheckinMsg && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '10px 14px',
                  borderRadius: 0,
                  background: selfCheckinMsg.includes('✅')
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: selfCheckinMsg.includes('✅')
                    ? '#4ade80'
                    : '#f87171',
                  border: `1px solid ${selfCheckinMsg.includes('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  marginBottom: 18
                }}
              >
                {selfCheckinMsg}
              </div>
            )}

            {/* Action Buttons for Logged-in Member vs Guest */}
            {api.auth.getToken() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={handleSelfCheckIn}
                  style={{ width: '100%', padding: '12px 0', fontSize: 13, fontWeight: 800 }}
                >
                  Mô Phỏng Quét Cổng Vào (Tự Check-in)
                </button>
                <button
                  onClick={handleOpenLiveQR}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    padding: '9px 0',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Làm Mới Mã QR (1 Phút)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 4px' }}>
                  Bạn cần đăng nhập tài khoản Hội Viên để hiển thị mã QR ra/vào phòng tập:
                </p>
                <button
                  className="btn-primary"
                  onClick={() => {
                    handleCloseQRModal();
                    onOpenLogin?.();
                  }}
                  style={{ width: '100%', padding: '12px 0', fontSize: 13, fontWeight: 800 }}
                >
                  Đăng Nhập Tài Khoản Ngay
                </button>
                <button
                  onClick={() => {
                    handleCloseQRModal();
                    onOpenRegister?.();
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#FFA050',
                    padding: '9px 0',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Chưa Có Tài Khoản? Đăng Ký Hội Viên Mới
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
