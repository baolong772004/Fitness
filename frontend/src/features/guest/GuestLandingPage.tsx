import React, { useState, useEffect } from 'react';
import { api, ApiPackage } from '../../services/api';
import { soundEffects } from '../../services/audioService';
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
  Phone
} from 'lucide-react';

interface GuestLandingPageProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
  currentUser?: { name: string; email: string } | null;
}

export const GuestLandingPage: React.FC<GuestLandingPageProps> = ({
  onTabChange,
  onOpenLogin,
  onOpenRegister,
  currentUser
}) => {
  // Live Packages from Backend API
  const [livePackages, setLivePackages] = useState<ApiPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<number | null>(null);

  // QR Check-in Modal
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrData, setQrData] = useState<{ token: string; qrCodeImage: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [selfCheckinMsg, setSelfCheckinMsg] = useState<string | null>(null);

  // Interactive Class Schedule State
  const [selectedDayIndex, setSelectedDayIndex] = useState(3); // Default T5
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [bookedSessions, setBookedSessions] = useState<Set<string>>(new Set(['session-strength']));

  // Fetch Live Packages from Backend API
  const fetchLivePackages = async () => {
    setIsLoadingPackages(true);
    try {
      const data = await api.packages.getPackages();
      if (data && data.length > 0) {
        setLivePackages(data);
      } else {
        setLivePackages(defaultPackages);
      }
    } catch {
      setLivePackages(defaultPackages);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  useEffect(() => {
    fetchLivePackages();
  }, []);

  const defaultPackages: ApiPackage[] = [
    {
      id: 1,
      name: 'Gói Cơ Bản (Starter Member)',
      type: 'MEMBERSHIP',
      description: 'Toàn quyền sử dụng hệ thống máy tập mọi khung giờ, phòng tắm nóng lạnh, nước ion kiềm miễn phí và 1 buổi định hướng thể lực.',
      price: 500000,
      durationDays: 30,
      trialPtSessions: 1,
      isActive: true
    },
    {
      id: 2,
      name: 'Gói Nâng Cao (Pro Fitness)',
      type: 'MEMBERSHIP',
      description: 'Đặc quyền Starter kèm khăn tập kháng khuẩn mỗi buổi, tủ đồ cá nhân riêng và 3 buổi huấn luyện 1-1 chuyên sâu cùng Coach.',
      price: 1200000,
      durationDays: 90,
      trialPtSessions: 3,
      isActive: true
    },
    {
      id: 3,
      name: 'Gói VIP Hoàng Gia (Royal Elite VIP)',
      type: 'MEMBERSHIP',
      description: 'Truy cập toàn bộ khu vực VIP, phòng xông hơi khô Sauna & Jacuzzi thủy lực, nước điện giải bổ sung năng lượng và tủ đồ riêng 365 ngày.',
      price: 3600000,
      durationDays: 365,
      trialPtSessions: 5,
      isActive: true
    },
    {
      id: 4,
      name: 'Khóa Huấn Luyện PT 1-1 Chuyên Nghiệp',
      type: 'PT',
      description: 'Lộ trình cá nhân hóa 100%: Tăng cơ giảm mỡ chuẩn y khoa, đo quét chỉ số InBody 3D hàng tuần và thực đơn dinh dưỡng riêng.',
      price: 2500000,
      durationDays: 60,
      trialPtSessions: 0,
      totalPtSessions: 12,
      isActive: true
    }
  ];

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

  // Schedule Days
  const weekDays = [
    { day: 'T2', date: '06', label: 'Thứ Hai' },
    { day: 'T3', date: '07', label: 'Thứ Ba' },
    { day: 'T4', date: '08', label: 'Thứ Tư' },
    { day: 'T5', date: '09', label: 'Thứ Năm' },
    { day: 'T6', date: '10', label: 'Thứ Sáu' },
    { day: 'T7', date: '11', label: 'Thứ Bảy' },
    { day: 'CN', date: '12', label: 'Chủ Nhật' }
  ];

  const categories = ['ALL', 'STRENGTH', 'HYPERTROPHY', 'HIIT', 'CARDIO', 'POWERLIFTING'];

  const classesList = [
    {
      id: 'session-strength',
      category: 'STRENGTH',
      title: 'Barbell Squat & Lower Body Power',
      time: '07:30 - 08:45',
      coach: 'Coach David Vũ',
      avatar: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=120&auto=format&fit=crop&q=80',
      room: 'Khu Tạ Tự Do (Free Weights)',
      spots: 12,
      maxSpots: 15,
      level: 'Mọi cấp độ'
    },
    {
      id: 'session-hypertrophy',
      category: 'HYPERTROPHY',
      title: 'Chest & Upper Body Hypertrophy',
      time: '09:30 - 10:45',
      coach: 'Coach Alex Trần',
      avatar: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=120&auto=format&fit=crop&q=80',
      room: 'Khu Máy Khối (Resistance Machines)',
      spots: 10,
      maxSpots: 12,
      level: 'Trung bình'
    },
    {
      id: 'session-hiit',
      category: 'HIIT',
      title: 'Metabolic Conditioning & Fat Burn HIIT',
      time: '17:30 - 18:30',
      coach: 'Coach Minh Anh',
      avatar: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=120&auto=format&fit=crop&q=80',
      room: 'Khu Cỏ Thể Lực (Functional Turf)',
      spots: 18,
      maxSpots: 20,
      level: 'Nâng cao'
    },
    {
      id: 'session-power',
      category: 'POWERLIFTING',
      title: 'Deadlift & Bench Press Masterclass',
      time: '19:00 - 20:00',
      coach: 'Coach Tuấn Kiệt',
      avatar: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=120&auto=format&fit=crop&q=80',
      room: 'Khu Bục Nâng Tạ (Deadlift Platform)',
      spots: 8,
      maxSpots: 10,
      level: 'Mọi cấp độ'
    }
  ];

  const filteredClasses = classesList.filter(c => {
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
    return true;
  });

  const toggleBookSession = (id: string) => {
    setBookedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        soundEffects.playSuccessBeep();
      }
      return next;
    });
  };

  // Master Gym Coaches List
  const coaches = [
    {
      name: 'David Vũ',
      role: 'Master Coach Strength & Hypertrophy',
      experience: '10+ năm kinh nghiệm',
      certs: 'NASM-CPT • CSCS Specialist',
      image: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=600&auto=format&fit=crop&q=80',
      rating: '5.0'
    },
    {
      name: 'Alex Trần',
      role: 'Senior Coach Body Recomposition & Fat Loss',
      experience: '8+ năm kinh nghiệm',
      certs: 'ACE Certified Personal Trainer',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80',
      rating: '4.98'
    },
    {
      name: 'Trần Minh Anh',
      role: 'Coach Functional Fitness & Mobility',
      experience: '6+ năm kinh nghiệm',
      certs: 'ISSA Fitness & Rehab Specialist',
      image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&auto=format&fit=crop&q=80',
      rating: '4.95'
    },
    {
      name: 'Hoàng Tuấn Kiệt',
      role: 'Olympic Weightlifting & Powerlifting',
      experience: '9+ năm kinh nghiệm',
      certs: 'USAW Sports Performance Coach',
      image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&auto=format&fit=crop&q=80',
      rating: '4.96'
    }
  ];

  // 4 Core Gym Pillars for the Freeletics Interactive Reveal Grid
  const gymPillars = [
    {
      id: 'pillar-weights',
      number: '01',
      title: 'Free Weights & Dumbbells',
      tag: 'Khu Tạ Tự Do',
      image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop&q=80',
      summary: '100+ đầu tạ đơn Rogue & đĩa Olympic Eleiko. 4 bục Deadlift cao su chuyên dụng chống chấn động.',
      actionText: 'Khám Phá Khu Tạ'
    },
    {
      id: 'pillar-machines',
      number: '02',
      title: 'Resistance & Machines',
      tag: 'Khu Máy Khối',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
      summary: 'Dàn máy Technogym PureStrength cơ sinh học chính xác, cô lập nhóm cơ tối đa và phòng ngừa chấn thương.',
      actionText: 'Xem Dàn Máy Tập'
    },
    {
      id: 'pillar-hiit',
      number: '03',
      title: 'Metabolic & Cardio HIIT',
      tag: 'Thể Lực & Sức Bền',
      image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
      summary: 'Dàn máy Skillmill, Assault Bike kết hợp thảm cỏ thể lực tập đẩy tạ trượt Sled & Dây thừng Battle Rope.',
      actionText: 'Xem Lịch Tập Thể Lực'
    },
    {
      id: 'pillar-pt',
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
      <section style={{ padding: '0', borderBottom: '1px solid var(--border-subtle)' }}>
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
            Rê chuột vào từng khu vực để xem chi tiết thiết bị và lộ trình tập luyện.
          </p>
        </div>

        {/* 4 Pillars - Full chiều ngang, không kẽ hở, 2 hàng x 2 cột */}
        <div className="fl-pillar-grid">
          {gymPillars.map(pillar => (
            <div
              key={pillar.id}
              className="fl-reveal-card"
              onClick={() => {
                const el = document.getElementById('schedule');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
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
          3. FREELETICS SHARP PRICING MATRIX (Live SQL Database Data)
          ========================================================================= */}
      <section
        id="pricing"
        className="section-atmosphere"
        style={{
          padding: '52px 44px 60px',
          width: '100%',
          position: 'relative'
        }}
      >
        {/* Atmospheric Aura Glow, Athletic Dot Grid & Watermark */}
        <div className="aura-glow-top-right" />
        <div className="aura-glow-bottom-left" />
        <div className="athletic-dot-grid" />
        <div className="athletic-watermark" style={{ top: 20, right: 30 }}>
          MEMBERSHIP
        </div>

        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: 'var(--color-primary)',
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
                margin: 0
              }}
            >
              Lựa Chọn Gói Tập Phù Hợp
            </h2>
          </div>

          {isLoadingPackages ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Đang tải danh sách gói tập từ máy chủ...
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
                      padding: '24px 20px',
                      borderRadius: 0,
                      background: 'var(--bg-app)',
                      border: isPopular ? '2px solid var(--color-primary)' : '1px solid var(--border-subtle)',
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
                          color: 'var(--aura-caramel)',
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
                          textTransform: 'uppercase'
                        }}
                      >
                        {pkg.name}
                      </h3>
                      <p
                        style={{
                          fontSize: 13,
                          color: 'var(--text-muted)',
                          marginTop: 8,
                          lineHeight: 1.5,
                          minHeight: 40
                        }}
                      >
                        {pkg.description}
                      </p>
                    </div>

                    {/* Price Block */}
                    <div style={{ padding: '16px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 32,
                            fontWeight: 900,
                            fontFamily: 'var(--font-display)',
                            color: 'var(--color-primary)'
                          }}
                        >
                          {formattedPrice} ₫
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                          / {pkg.durationDays} ngày
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--aura-caramel)', fontWeight: 700, marginTop: 4 }}>
                        {pkg.type === 'PT'
                          ? `Bao gồm ${pkg.totalPtSessions || 12} buổi kèm riêng 1:1`
                          : `Tặng ${pkg.trialPtSessions || 1} buổi định hướng cùng Coach`}
                      </div>
                    </div>

                    {/* Feature Bullets */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                        <Check size={15} color="var(--aura-green)" strokeWidth={2.5} />
                        <span>Sử dụng máy tập Rogue & Technogym 24/7</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                        <Check size={15} color="var(--aura-green)" strokeWidth={2.5} />
                        <span>Xông hơi Sauna & Tủ đồ riêng</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                        <Check size={15} color="var(--aura-green)" strokeWidth={2.5} />
                        <span>Điểm danh bằng mã QR không chạm</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                        <Check size={15} color="var(--aura-green)" strokeWidth={2.5} />
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
        className="section-atmosphere-dark"
        style={{
          padding: '52px 44px 60px',
          width: '100%',
          position: 'relative'
        }}
      >
        {/* Atmospheric Aura Glow, Athletic Dot Grid & Watermark */}
        <div className="aura-glow-center" />
        <div className="athletic-dot-grid" />
        <div className="athletic-watermark" style={{ top: 20, left: 30 }}>
          TIMETABLE
        </div>

        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: 'var(--color-primary)',
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
              margin: 0
            }}
          >
            Khung Giờ Tập Luyện Tuần Này
          </h2>
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
                  soundEffects.playSuccessBeep();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 20px',
                  borderRadius: 16,
                  border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--color-primary)' : 'var(--bg-card)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  minWidth: 76,
                  boxShadow: isSelected ? '0 4px 14px var(--color-primary-glow)' : 'var(--shadow-sm)'
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, opacity: isSelected ? 0.9 : 0.6 }}>{w.day}</span>
                <span style={{ fontSize: 19, fontWeight: 900, marginTop: 2 }}>{w.date}</span>
              </button>
            );
          })}
        </div>

        {/* Category Pills (Làm tròn hoàn toàn dạng Pill) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
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
                  border: isCatActive ? '1.5px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  background: isCatActive ? 'var(--color-primary)' : 'var(--bg-card)',
                  color: isCatActive ? '#FFFFFF' : 'var(--text-muted)',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, width: '100%' }}>
          {filteredClasses.map(session => {
            const isBooked = bookedSessions.has(session.id);
            return (
              <div
                key={session.id}
                style={{
                  padding: '20px 20px',
                  borderRadius: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
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
                        background: 'var(--color-primary-light)',
                        color: 'var(--color-primary)',
                        padding: '4px 10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase'
                      }}
                    >
                      {session.category}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{session.level}</span>
                  </div>

                  <h4 style={{ fontSize: 18, fontWeight: 900, marginTop: 12, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                    {session.title}
                  </h4>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                    <img
                      src={session.avatar}
                      alt={session.coach}
                      style={{ width: 38, height: 38, borderRadius: 0, objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                    />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{session.coach}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{session.room}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color="var(--color-primary)" />
                      <span>{session.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} color="var(--aura-caramel)" />
                      <span>Còn {session.spots} / {session.maxSpots} chỗ</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <button
                    onClick={() => toggleBookSession(session.id)}
                    className={isBooked ? 'btn-secondary' : 'btn-primary'}
                    style={{ width: '100%', padding: '11px 0', fontSize: 12 }}
                  >
                    {isBooked ? '✓ ĐÃ ĐẶT CHỖ THÀNH CÔNG' : 'ĐẶT CHỖ THAM GIA'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </section>

      {/* Luminous Accent Divider */}
      <div className="luminous-divider" />

      {/* =========================================================================
          5. MASTER GYM COACHES & TRAINERS (Sharp Freeletics Cards)
          ========================================================================= */}
      <section
        id="coaches"
        className="section-atmosphere"
        style={{
          padding: '52px 44px 60px',
          width: '100%',
          position: 'relative'
        }}
      >
        {/* Atmospheric Aura Glow, Athletic Dot Grid & Watermark */}
        <div className="aura-glow-bottom-left" />
        <div className="aura-glow-top-right" />
        <div className="athletic-dot-grid" />
        <div className="athletic-watermark" style={{ top: 20, right: 30 }}>
          ATHLETES
        </div>

        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                color: 'var(--color-primary)',
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
                margin: 0
              }}
            >
              Master Coach Đồng Hành 1-1
            </h2>
          </div>

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
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ height: 230, position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={c.image}
                    alt={c.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      background: 'rgba(20, 8, 3, 0.88)',
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
                </div>

                <div style={{ padding: '16px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase' }}>{c.name}</h4>
                    <p style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 800, marginTop: 4, textTransform: 'uppercase' }}>
                      {c.role}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {c.certs} • {c.experience}
                    </p>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <button
                      className="btn-outline"
                      onClick={() => {
                        alert(`Đăng ký buổi tư vấn thể lực 1-1 miễn phí cùng ${c.name}`);
                      }}
                      style={{ width: '100%', padding: '9px 0', fontSize: 11 }}
                    >
                      ĐĂNG KÝ TẬP THỬ 1-1
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. SHARP QR CHECK-IN MODAL (Góc vuông, không bo tròn container)
          ========================================================================= */}
      {isQRModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
          onClick={() => setIsQRModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              padding: '36px 32px',
              borderRadius: 0,
              background: 'var(--bg-card)',
              border: '2px solid var(--color-primary)',
              textAlign: 'center',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsQRModalOpen(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                borderRadius: 0,
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)'
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
                margin: '0 auto 16px'
              }}
            >
              <QrCode size={26} />
            </div>

            <h3 style={{ fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
              Mã QR Điểm Danh Cá Nhân
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              Quét mã tại cổng xoay ra vào phòng tập
            </p>

            <div
              style={{
                margin: '26px auto',
                width: 220,
                height: 220,
                borderRadius: 0,
                background: '#FFFFFF',
                padding: 16,
                border: '2px dashed var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {qrLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Đang tạo mã QR...</div>
              ) : qrData?.qrCodeImage ? (
                <img
                  src={qrData.qrCodeImage}
                  alt="QR Code Điểm danh"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 12 }}>
                  <QrCode size={64} color="var(--color-primary)" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mã cá nhân bảo mật</div>
                </div>
              )}
            </div>

            {selfCheckinMsg && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '10px 14px',
                  borderRadius: 0,
                  background: selfCheckinMsg.includes('✅')
                    ? 'var(--color-success-bg)'
                    : 'var(--color-primary-light)',
                  color: selfCheckinMsg.includes('✅')
                    ? 'var(--color-success)'
                    : 'var(--color-primary)',
                  marginBottom: 18
                }}
              >
                {selfCheckinMsg}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={handleSelfCheckIn}
              style={{ width: '100%', padding: '12px 0', fontSize: 12 }}
            >
              Mô Phỏng Quét Cổng Vào
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
