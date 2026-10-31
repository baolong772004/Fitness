import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import { api, tokenStorage, STORAGE_KEYS } from './services/api';
import { Navbar } from './components/layout/Navbar';
import { ReceptionistDashboard } from './features/receptionist/ReceptionistDashboard';
import { CoachDashboard } from './features/coach/CoachDashboard';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { GuestLandingPage } from './features/guest/GuestLandingPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { PaymentReturnPage } from './features/payment/PaymentReturnPage';
import { AuthModal } from './features/auth/AuthModal';
import { FloatingAIChatbot } from './features/ai-assistant/FloatingAIChatbot';
import { ToastContainer, toast, installGlobalAlertOverride } from './components/common/ToastNotification';
import { StaffLogoutCashModal } from './components/staff/StaffLogoutCashModal';
import { soundEffects } from './services/audioService';
import { Clock, Phone, MapPin, QrCode } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('guest');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [viewMode, setViewMode] = useState<'main' | 'settings'>('main');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [isStaffLogoutModalOpen, setIsStaffLogoutModalOpen] = useState(false);
  const [isSessionExpiredStaffModal, setIsSessionExpiredStaffModal] = useState(false);

  // Theme Management (Light mode is DEFAULT as requested by user)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    soundEffects.playSuccessBeep();
  };

  // Scope shadcn/ui base styles to staff dashboards (admin / staff / coach)
  useEffect(() => {
    installGlobalAlertOverride();
  }, []);

  useEffect(() => {
    const isStaffView = currentRole !== 'guest' && viewMode === 'main';
    document.body.classList.toggle('staff-ui', isStaffView);
    return () => document.body.classList.remove('staff-ui');
  }, [currentRole, viewMode]);

  // Initialize session from LocalStorage or Backend API
  useEffect(() => {
    const savedUserJson = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (savedUserJson) {
      try {
        const saved = JSON.parse(savedUserJson);
        const token = tokenStorage.getAccessToken();
        if (token && saved) {
          if (saved.mustChangePassword) {
            setIsAuthModalOpen(true);
            return;
          }
          let mappedRole: UserRole = 'guest';
          const r = (saved.role || '').toUpperCase().trim();
          if (r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'MANAGER') {
            mappedRole = 'admin';
          } else if (r === 'STAFF' || r === 'RECEPTIONIST' || r === 'LE_TAN' || r === 'FRONT_DESK') {
            mappedRole = 'staff';
          } else if (r === 'COACH' || r === 'TRAINER' || r === 'PT' || r === 'HLV') {
            mappedRole = 'coach';
          } else if (r === 'MEMBER' || r === 'HOI_VIEN' || r === 'CUSTOMER' || r === 'USER') {
            mappedRole = 'member';
          } else {
            mappedRole = 'member';
          }

          const formatted: User = {
            id: String(saved.id),
            name: saved.fullName || saved.name || saved.email,
            email: saved.email,
            phone: saved.phone || '',
            role: mappedRole,
            avatar: saved.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'
          };
          setCurrentUser(formatted);
          setCurrentRole(mappedRole);
          syncDefaultTab(mappedRole);
          return;
        }
      } catch (e) {
        console.error('Failed to parse current user session', e);
      }
    }

    // Default to guest landing page
    setCurrentUser(null);
    setCurrentRole('guest');
    setActiveTab('home');
  }, []);

  const syncDefaultTab = (role: UserRole) => {
    switch (role) {
      case 'staff':
        setActiveTab('checkin');
        break;
      case 'coach':
        setActiveTab('schedule');
        break;
      case 'admin':
        setActiveTab('analytics');
        break;
      case 'member':
      case 'guest':
        setActiveTab('home');
        break;
    }
  };

  const handleOpenQuickCheckIn = () => {
    setViewMode('main');
    setActiveTab('checkin');
    soundEffects.playSuccessBeep();
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setViewMode('main');
    syncDefaultTab(user.role);
    soundEffects.playSuccessBeep();
  };

  const performLogout = () => {
    api.auth.logout();
    setCurrentUser(null);
    setCurrentRole('guest');
    setViewMode('main');
    setActiveTab('home');
    soundEffects.playSuccessBeep();
    toast.success('Bạn đã đăng xuất tài khoản thành công! Hẹn gặp lại bạn tại AURA Fitness.', 'Đăng Xuất');
  };

  const handleLogout = () => {
    // Nếu là nhân viên lễ tân quầy, BẮT BUỘC phải đối soát và nhập số tiền mặt đang có sau ca làm trước khi đăng xuất
    if (currentUser?.role === 'staff') {
      setIsSessionExpiredStaffModal(false);
      setIsStaffLogoutModalOpen(true);
      return;
    }
    performLogout();
  };

  // Lắng nghe sự kiện hết hạn token từ backend và kiểm tra định kỳ thời hạn phiên đăng nhập
  useEffect(() => {
    const handleSessionExpired = (e: any) => {
      const detail = e.detail || {};
      const savedUser = tokenStorage.getUser();
      const roleStr = String(detail.role || savedUser?.role || currentRole || '').toUpperCase();
      const isStaff =
        roleStr === 'STAFF' ||
        roleStr === 'RECEPTIONIST' ||
        currentRole === 'staff';

      if (isStaff) {
        soundEffects.playErrorBeep();
        toast.warning(
          'Phiên làm việc ca trực đã hết thời gian. Bạn bắt buộc phải nhập số tiền mặt thực tế chốt ca để hoàn tất đăng xuất!',
          'Hết Giờ Làm / Bắt Buộc Chốt Ca'
        );
        setIsSessionExpiredStaffModal(true);
        setIsStaffLogoutModalOpen(true);
      } else {
        soundEffects.playErrorBeep();
        toast.info(
          'Thời gian đăng nhập đã hết hạn. Hệ thống đã tự động đưa bạn về Trang Chủ.',
          'Hết Hạn Phiên Đăng Nhập'
        );
        performLogout();
      }
    };

    window.addEventListener('aura:session-expired', handleSessionExpired);

    // Kiểm tra định kỳ token exp mỗi 10 giây
    const checkTokenExpiry = () => {
      const token = tokenStorage.getAccessToken();
      if (!token) return;
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return;
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          window.dispatchEvent(
            new CustomEvent('aura:session-expired', {
              detail: {
                code: 'TOKEN_EXPIRED',
                role: payload.role,
                requiresStaffCashout: payload.role === 'STAFF' || payload.role === 'RECEPTIONIST',
                redirectTo: '/'
              }
            })
          );
        }
      } catch (err) {
        // Ignore parse error
      }
    };

    const interval = setInterval(checkTokenExpiry, 10000);

    return () => {
      window.removeEventListener('aura:session-expired', handleSessionExpired);
      clearInterval(interval);
    };
  }, [currentRole]);

  if (['/payment-success', '/payment-cancel'].includes(window.location.pathname.replace(/\/+$/, ''))) {
    return <PaymentReturnPage />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row', backgroundColor: 'var(--bg-app)' }}>
      {/* Aura Fitness Vertical Sidebar Navbar */}
      <Navbar
        currentRole={currentRole}
        currentUser={currentUser}
        onOpenQuickCheckIn={handleOpenQuickCheckIn}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setViewMode('main');
          setActiveTab(tab);
        }}
        onOpenLogin={() => {
          setAuthModalTab('login');
          setIsAuthModalOpen(true);
        }}
        onOpenRegister={() => {
          setAuthModalTab('register');
          setIsAuthModalOpen(true);
        }}
        onOpenSettings={() => setViewMode('settings')}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {viewMode === 'settings' ? (
          <SettingsPage
            currentUser={currentUser}
            onBack={() => setViewMode('main')}
            onLogout={handleLogout}
            onUpdateUser={(updated) => setCurrentUser(updated)}
          />
        ) : (
          <>
            {currentRole === 'staff' && (
              <ReceptionistDashboard
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onLogout={handleLogout}
              />
            )}

            {currentRole === 'coach' && (
              <CoachDashboard
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {currentRole === 'admin' && activeTab === 'checkin' ? (
              <ReceptionistDashboard
                activeTab="checkin"
                onTabChange={setActiveTab}
                autoOpenScanner
                onLogout={handleLogout}
              />
            ) : currentRole === 'admin' && (
              <AdminDashboard
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {(currentRole === 'guest' || currentRole === 'member') && (
              <GuestLandingPage
                activeTab={activeTab}
                onTabChange={setActiveTab}
                currentUser={currentUser}
                onOpenLogin={() => {
                  setAuthModalTab('login');
                  setIsAuthModalOpen(true);
                }}
                onOpenRegister={() => {
                  setAuthModalTab('register');
                  setIsAuthModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Footer Condition: Full marketing footer for Guest, Compact operational footer for Admin & Staff */}
      {currentRole === 'guest' ? (
        <footer style={{
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--aura-border)',
          padding: '40px 36px 20px',
          marginTop: 'auto',
          borderRadius: 0
        }}>
          <div style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 28,
            marginBottom: 32
          }}>
            {/* Brand Info */}
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-primary)' }}>
                AURA FITNESS CLUB
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                Hệ thống phòng tập thể hình chuẩn quốc tế với trang thiết bị Rogue & Technogym cao cấp, Master Coach NASM và điểm danh 1 chạm.
              </p>
            </div>

            {/* Core Facilities */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: 8 }}>
                Khu Vực Tập Luyện
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <li>• Khu Tạ Tự Do Olympic (Free Weights)</li>
                <li>• Máy Khối Cô Lập (Technogym PureStrength)</li>
                <li>• Cỏ Thể Lực & Cardio HIIT (Functional Turf)</li>
                <li>• Xông Hơi Khô Sauna & Jacuzzi Thủy Lực</li>
              </ul>
            </div>

            {/* Hours & Hotline */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: 8 }}>
                Thời Gian & Hỗ Trợ
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={15} color="var(--color-primary)" />
                  <span>Mở cửa: <strong>05:30 - 22:30</strong> (24/7 check-in)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={15} color="var(--color-primary)" />
                  <span>Hotline: <strong style={{ color: 'var(--color-primary)' }}>1900 6868</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <QrCode size={15} color="var(--color-primary)" />
                  <span>Quét mã QR tự động tại cổng vào</span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: 8 }}>
                Địa Điểm Trung Tâm
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <MapPin size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Tầng 3, TTTM Royal City, 72A Nguyễn Trãi, Thanh Xuân, Hà Nội</span>
              </div>
            </div>
          </div>

          {/* Bottom copyright */}
          <div style={{
            width: '100%',
            paddingTop: 16,
            borderTop: '1px solid var(--aura-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: 12,
            color: 'var(--text-muted)'
          }}>
            <span>© 2026 AURA Gym & Fitness Club. Bản quyền thuộc về hệ thống quản lý AURA.</span>
            <span>Trang dành cho khách tham quan & quản lý hội viên</span>
          </div>
        </footer>
      ) : (
        <footer style={{
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--aura-border)',
          padding: '10px 24px',
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 12,
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.04em' }}>
              AURA MANAGEMENT
            </span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>Phiên làm việc vận hành & quản trị v2.4</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span>Hotline kỹ thuật: <strong style={{ color: 'var(--text-primary)' }}>1900 6868</strong></span>
            <span>© 2026 AURA Fitness</span>
          </div>
        </footer>
      )}
      </div>

      {/* Modal Bắt Buộc Nhập Tiền Mặt Trước Khi Đăng Xuất (Dành Cho Lễ Tân) */}
      <StaffLogoutCashModal
        isOpen={isStaffLogoutModalOpen}
        isSessionExpired={isSessionExpiredStaffModal}
        onClose={() => {
          setIsStaffLogoutModalOpen(false);
          setIsSessionExpiredStaffModal(false);
        }}
        onConfirmLogout={() => {
          setIsStaffLogoutModalOpen(false);
          setIsSessionExpiredStaffModal(false);
          performLogout();
        }}
      />

      {/* Auth Modal for Login, Register, and Forgot Password */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          if (tokenStorage.getUser()?.mustChangePassword) api.auth.logout();
          setIsAuthModalOpen(false);
        }}
        initialTab={authModalTab}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* AI Assistant Chatbot Floating Bubble */}
      <FloatingAIChatbot />

      {/* Global Toast Notification Container */}
      <ToastContainer />
    </div>
  );
}
