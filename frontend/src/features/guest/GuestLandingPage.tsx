import React, { useState, useEffect } from 'react';
import { PackagePlan, Coach } from '../../types';
import { INITIAL_PACKAGES, INITIAL_COACHES } from '../../mocks/mockData';
import { soundEffects } from '../../services/audioService';
import { 
  Dumbbell, 
  Flame, 
  Check, 
  Calendar, 
  Award, 
  ArrowRight, 
  Sparkles, 
  MapPin, 
  Clock, 
  Phone, 
  ShieldCheck, 
  Zap, 
  Users,
  Filter
} from 'lucide-react';

interface GuestLandingPageProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenRegister?: () => void;
}

export const GuestLandingPage: React.FC<GuestLandingPageProps> = ({
  activeTab,
  onTabChange,
  onOpenRegister
}) => {
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [trialForm, setTrialForm] = useState({
    name: '',
    phone: '',
    discipline: 'gym',
    branch: '108 Phố Thể Thao, Hà Nội'
  });
  const [trialSuccess, setTrialSuccess] = useState(false);

  // Class timetable filter
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');

  // Smooth scroll to section when activeTab changes
  useEffect(() => {
    if (activeTab) {
      const el = document.getElementById(activeTab);
      if (el) {
        const yOffset = -80; // Offset for sticky navbar
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }, [activeTab]);

  const handleRegisterTrial = (e: React.FormEvent) => {
    e.preventDefault();
    soundEffects.playSuccessBeep();
    setTrialSuccess(true);
    setTimeout(() => {
      setTrialSuccess(false);
      setIsTrialModalOpen(false);
      setTrialForm({
        name: '',
        phone: '',
        discipline: 'gym',
        branch: '108 Phố Thể Thao, Hà Nội'
      });
    }, 2000);
  };

  const publicClasses = [
    {
      id: 'c-1',
      title: 'Yoga Hatha Đánh Thức Năng Lượng',
      coach: 'Nguyễn Lan Anh (Yoga Alliance)',
      day: 'T2 - T4 - T6',
      time: '06:30 - 07:30',
      room: 'Lotus Studio 1',
      level: 'Mọi cấp độ',
      spotsLeft: 4,
      discipline: 'yoga'
    },
    {
      id: 'c-2',
      title: 'HIIT & Core Cardio Đốt Mỡ Cấp Tốc',
      coach: 'Võ Quang Dũng (ACE-CPT)',
      day: 'T3 - T5 - T7',
      time: '18:00 - 19:00',
      room: 'Functional Arena',
      level: 'Trung bình - Nâng cao',
      spotsLeft: 2,
      discipline: 'hiit'
    },
    {
      id: 'c-3',
      title: 'Kickboxing Padwork & Self Defense',
      coach: 'Võ Quang Dũng (Kiện tướng)',
      day: 'T3 - T5 - T7',
      time: '19:15 - 20:30',
      room: 'Khu Sàn Đấu Ring 1',
      level: 'Người mới - Trung cấp',
      spotsLeft: 5,
      discipline: 'boxing'
    },
    {
      id: 'c-4',
      title: 'Pilates Reformer Tạo Đường Cong',
      coach: 'Nguyễn Lan Anh (Stott Certified)',
      day: 'T2 - T4 - T6',
      time: '17:30 - 18:30',
      room: 'Studio Pilates Chuyên Dụng',
      level: 'Nữ giới',
      spotsLeft: 1,
      discipline: 'pilates'
    },
    {
      id: 'c-5',
      title: 'Hypertrophy Powerlifting Masterclass',
      coach: 'Trần Tuấn Hùng (Master Trainer)',
      day: 'Thứ 7 & Chủ Nhật',
      time: '09:00 - 10:30',
      room: 'Phòng Tạ Khối Tầng 1',
      level: 'Nâng cao',
      spotsLeft: 3,
      discipline: 'gym'
    }
  ];

  const filteredClasses = publicClasses.filter(c => {
    if (selectedDiscipline !== 'all' && c.discipline !== selectedDiscipline) return false;
    return true;
  });

  return (
    <div>
      {/* SECTION 1: HERO (id="home") */}
      <section 
        id="home"
        style={{
          position: 'relative',
          minHeight: '75vh',
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--space-6xl) var(--space-xl)',
          background: 'radial-gradient(circle at top right, rgba(254, 116, 19, 0.18), transparent 50%), radial-gradient(circle at bottom left, rgba(0, 200, 83, 0.1), var(--bg-app) 70%)',
          borderBottom: 'var(--border-subtle)',
          overflow: 'hidden'
        }}
      >
        <div style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-5xl)', alignItems: 'center' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-primary-glow)',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 20
            }}>
              <Zap size={14} />
              <span>Trung Tâm Thể Thao & Thể Hình Chuẩn Quốc Tế</span>
            </div>

            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.2rem)', fontWeight: 900, lineHeight: 1.08, marginBottom: 20 }}>
              BỨT PHÁ GIỚI HẠN.<br />
              <span style={{ color: 'var(--color-primary)' }}>RÈN LUYỆN VÓC DÁNG</span> ĐỈNH CAO.
            </h1>

            <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 580, marginBottom: 32 }}>
              Hệ thống phòng tập hiện đại bậc nhất. Trải nghiệm mô hình <strong>Hybrid độc quyền</strong>: Ra vào phòng tập tự do không giới hạn, kết hợp huấn luyện viên cá nhân và các khóa học chuyên sâu.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button 
                className="btn-primary" 
                style={{ padding: '14px 32px', fontSize: 16 }}
                onClick={() => setIsTrialModalOpen(true)}
              >
                <span>Đăng Ký Tập Thử Miễn Phí</span>
                <ArrowRight size={18} />
              </button>

              <button 
                className="btn-secondary" 
                style={{ padding: '14px 28px', fontSize: 15 }}
                onClick={() => onTabChange('pricing')}
              >
                <span>Xem Bảng Giá Gói Tập</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'flex', gap: 32, marginTop: 44, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24 }}>
              <div>
                <div className="metric-mono" style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>5.000+</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Hội viên tin chọn</div>
              </div>
              <div>
                <div className="metric-mono" style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-primary)' }}>50+</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>HLV Chuyên Nghiệp</div>
              </div>
              <div>
                <div className="metric-mono" style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-success)' }}>99.2%</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Độ hài lòng</div>
              </div>
            </div>
          </div>

          {/* Hero Athletic Image Banner */}
          <div style={{ position: 'relative' }}>
            <div style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
              border: '2px solid rgba(254,116,19,0.3)',
              position: 'relative'
            }}>
              <img 
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&auto=format&fit=crop&q=80" 
                alt="Gym Interior"
                style={{ width: '100%', height: 480, objectFit: 'cover', display: 'block' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, transparent 50%, rgba(13,22,25,0.95))'
              }} />

              {/* Floating Badge on Banner */}
              <div style={{
                position: 'absolute',
                bottom: 24,
                left: 24,
                right: 24,
                background: 'rgba(20, 32, 36, 0.9)',
                backdropFilter: 'blur(10px)',
                padding: '16px 20px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'var(--color-primary)', color: '#fff', padding: 8, borderRadius: 'var(--radius-full)' }}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <strong style={{ color: '#fff', fontSize: 15 }}>AURA Safe & Smart Fitness</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cổng check-in thông minh qua QR code tự động, không lo mất thẻ.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: PRICING (id="pricing") */}
      <section 
        id="pricing"
        style={{ padding: 'var(--space-6xl) var(--space-xl)', maxWidth: 'var(--max-content-width)', margin: '0 auto' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, color: '#fff', marginBottom: 12 }}>
            BẢNG GIÁ DỊCH VỤ & KHÓA HỌC NIÊM YẾT
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 650, margin: '0 auto' }}>
            Minh bạch quyền lợi. Đa dạng gói tập từ hội viên tự do tới gói kèm PT cá nhân và các khóa chuyên sâu phục hồi.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {INITIAL_PACKAGES.map(pkg => (
            <div 
              key={pkg.id} 
              className="card-athletic" 
              style={{
                position: 'relative',
                border: pkg.isPopular ? '2px solid var(--color-primary)' : 'var(--border-card)',
                background: pkg.isPopular ? 'linear-gradient(180deg, rgba(254,116,19,0.06), var(--bg-card))' : 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              {pkg.isPopular && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  right: 24,
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 11,
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  boxShadow: 'var(--shadow-glow)'
                }}>
                  LỰA CHỌN PHỔ BIẾN NHẤT
                </div>
              )}

              <div>
                <span className={`badge ${
                  pkg.type === 'hybrid_pt' ? 'badge-primary' :
                  pkg.type === 'specialized_course' ? 'badge' : ''
                }`} style={{
                  background: pkg.type === 'specialized_course' ? 'rgba(0,176,255,0.15)' : undefined,
                  color: pkg.type === 'specialized_course' ? 'var(--color-info)' : undefined,
                  marginBottom: 12
                }}>
                  {pkg.type === 'hybrid_pt' ? 'Mô hình Hybrid PT' :
                   pkg.type === 'specialized_course' ? 'Khóa Học Chuyên Biệt' : 'Thẻ Gym Standard'}
                </span>

                <h3 style={{ fontSize: 20, color: '#fff', marginBottom: 8 }}>{pkg.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                  {pkg.description}
                </p>

                <div style={{ marginBottom: 24 }}>
                  <span className="metric-mono" style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>
                    {pkg.priceVND.toLocaleString('vi-VN')}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}> VNĐ / {pkg.durationMonths} Tháng</span>
                </div>

                {/* Features List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {pkg.features.map((feat, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#fff' }}>
                      <Check size={16} color="var(--color-success)" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                className={pkg.isPopular ? 'btn-primary' : 'btn-secondary'}
                style={{ width: '100%', padding: '12px' }}
                onClick={() => setIsTrialModalOpen(true)}
              >
                <span>Đăng Ký Tư Vấn Gói Này</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: MEET OUR COACHES (id="coaches") */}
      <section 
        id="coaches"
        style={{ padding: 'var(--space-6xl) var(--space-xl)', background: 'var(--bg-panel)', borderTop: 'var(--border-subtle)' }}
      >
        <div style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 36, color: '#fff', marginBottom: 12 }}>
              ĐỘI NGŨ HUẤN LUYỆN VIÊN ĐỈNH CAO
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
              100% Coach có chứng chỉ quốc tế (NASM, ACE, Yoga Alliance). Bảng giá kèm riêng biệt, minh bạch.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {INITIAL_COACHES.map(c => (
              <div key={c.id} className="card-athletic" style={{ padding: 20 }}>
                <div style={{ position: 'relative', marginBottom: 16, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <img 
                    src={c.avatar} 
                    alt={c.name} 
                    style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    left: 12
                  }}>
                    <span className={`badge badge-rank-${c.rank}`}>{c.rank.toUpperCase()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <h4 style={{ fontSize: 18, color: '#fff' }}>{c.name}</h4>
                  <span style={{ fontSize: 13, color: 'var(--color-warning)' }}>⭐ {c.rating}</span>
                </div>

                <p style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, marginBottom: 8 }}>
                  {c.specialties[0]}
                </p>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                  {c.bio}
                </p>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Đơn giá dạy lẻ:</span>
                  <strong className="metric-mono" style={{ color: 'var(--color-primary)', fontSize: 16 }}>
                    {c.hourlyRateVND.toLocaleString('vi-VN')} đ/buổi
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: PUBLIC TIMETABLE (id="schedule") */}
      <section
        id="schedule"
        style={{ padding: 'var(--space-6xl) var(--space-xl)', maxWidth: 'var(--max-content-width)', margin: '0 auto', borderTop: 'var(--border-subtle)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 36, color: '#fff', marginBottom: 8 }}>
              LỊCH LỚP HỌC TRONG TUẦN
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
              Theo dõi lịch các lớp Yoga, HIIT, Boxing, Pilates mở cửa hàng ngày cho hội viên
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Tất Cả Lớp' },
              { id: 'yoga', label: 'Yoga' },
              { id: 'boxing', label: 'Kickboxing' },
              { id: 'hiit', label: 'HIIT Cardio' },
              { id: 'pilates', label: 'Pilates' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedDiscipline(f.id)}
                style={{
                  background: selectedDiscipline === f.id ? 'var(--color-primary)' : 'var(--bg-card)',
                  color: selectedDiscipline === f.id ? '#fff' : 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timetable Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {filteredClasses.map(cls => (
            <div key={cls.id} className="card-athletic" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="badge badge-primary" style={{ fontSize: 10 }}>
                  {cls.discipline.toUpperCase()}
                </span>
                <span className="metric-mono" style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 700 }}>
                  Còn {cls.spotsLeft} chỗ trống
                </span>
              </div>

              <h4 style={{ fontSize: 17, color: '#fff', marginBottom: 8 }}>{cls.title}</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={15} color="var(--color-primary)" />
                  <span style={{ color: '#fff', fontWeight: 600 }}>{cls.day}</span> • <span className="metric-mono">{cls.time}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={15} color="var(--color-info)" />
                  <span>{cls.room}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={15} color="var(--color-warning)" />
                  <span>HLV: <strong style={{ color: '#fff' }}>{cls.coach}</strong></span>
                </div>
              </div>

              <button
                className="btn-outline"
                style={{ width: '100%', padding: '10px' }}
                onClick={() => setIsTrialModalOpen(true)}
              >
                <span>Đăng Ký Đặt Chỗ Ngay</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Free Trial Registration Modal */}
      {isTrialModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div style={{ padding: '20px 24px', borderBottom: 'var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, color: '#fff' }}>Đăng Ký Trải Nghiệm Miễn Phí 01 Buổi</h3>
              <button className="btn-ghost" onClick={() => setIsTrialModalOpen(false)}>✕</button>
            </div>

            {trialSuccess ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ color: 'var(--color-success)', marginBottom: 12 }}>
                  <Sparkles size={48} style={{ margin: '0 auto' }} />
                </div>
                <h4 style={{ fontSize: 20, color: '#fff' }}>Đăng Ký Thành Công!</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                  Chuyên viên chăm sóc khách hàng của AURA Fitness sẽ liên hệ với bạn trong vòng 15 phút.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegisterTrial} style={{ padding: 24 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Họ và tên của bạn *:
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="VD: Hoàng Quốc Anh"
                    value={trialForm.name}
                    onChange={(e) => setTrialForm({ ...trialForm, name: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Số điện thoại nhận mã tập *:
                  </label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    placeholder="VD: 0988 123 456"
                    value={trialForm.phone}
                    onChange={(e) => setTrialForm({ ...trialForm, phone: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Bộ môn muốn trải nghiệm:
                  </label>
                  <select
                    className="form-input"
                    value={trialForm.discipline}
                    onChange={(e) => setTrialForm({ ...trialForm, discipline: e.target.value })}
                  >
                    <option value="gym">Gym & Thể Hình Cá Nhân</option>
                    <option value="yoga">Yoga Trị Liệu Phục Hồi</option>
                    <option value="boxing">Boxing / Kickboxing Đốt Mỡ</option>
                    <option value="pilates">Pilates Cải Thiện Vóc Dáng</option>
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Cơ sở trung tâm gần bạn:
                  </label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value={trialForm.branch}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }}>
                  <span>Nhận Mã Tập Thử Miễn Phí Ngay</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
