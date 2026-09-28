import React, { useState } from 'react';
import { UserRole, User } from '../../types';
import { 
  Dumbbell, 
  QrCode, 
  ChevronDown, 
  LogIn, 
  UserPlus, 
  Settings, 
  LogOut
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  currentUser: User | null;
  onOpenQuickCheckIn: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentUser,
  onOpenQuickCheckIn,
  activeTab,
  onTabChange,
  onOpenLogin,
  onOpenRegister,
  onOpenSettings,
  onLogout
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const roleLabels: Record<UserRole, string> = {
    admin: 'Center Manager',
    receptionist: 'Lễ Tân',
    coach: 'Huấn Luyện Viên',
    guest: 'Hội Viên / Khách'
  };

  const getTabsForRole = (role: UserRole) => {
    switch (role) {
      case 'receptionist':
        return [
          { id: 'checkin', label: 'Quầy Check-in QR' },
          { id: 'pos', label: 'Bán Gói Tại Quầy (POS)' },
          { id: 'members', label: 'Danh Sách Hội Viên' },
          { id: 'tickets', label: 'Hỗ Trợ & Yêu Cầu' }
        ];
      case 'coach':
        return [
          { id: 'schedule', label: 'Lịch Dạy & Điểm Danh' },
          { id: 'trainees', label: 'Hồ Sơ Học Viên PT' },
          { id: 'ai-workout', label: 'Gợi Ý Giáo Án (AI)' },
          { id: 'availability', label: 'Ca Rảnh & Đơn Giá' }
        ];
      case 'admin':
        return [
          { id: 'analytics', label: 'Tổng Quan & BI Báo Cáo' },
          { id: 'members-360', label: 'Quản Lý Member 360°' },
          { id: 'tickets-management', label: 'Xử Lý Báo Cáo & Yêu Cầu' },
          { id: 'coaches-config', label: 'Quản Lý & Giá Coach' },
          { id: 'packages-engine', label: 'Gói Tập & Khóa Học' },
          { id: 'audit-rbac', label: 'Nhật Ký & Phân Quyền' }
        ];
      case 'guest':
        return [
          { id: 'home', label: 'Trang Chủ' },
          { id: 'pricing', label: 'Bảng Giá & Khóa Học' },
          { id: 'coaches', label: 'Đội Ngũ Huấn Luyện Viên' },
          { id: 'schedule', label: 'Lịch Lớp Tuần Này' }
        ];
      default:
        return [];
    }
  };

  const currentTabs = getTabsForRole(currentRole);

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    // If in guest mode, smooth scroll directly to target section
    if (currentRole === 'guest') {
      const el = document.getElementById(tabId);
      if (el) {
        const yOffset = -80;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: 'rgba(13, 22, 25, 0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: 'var(--border-subtle)',
      height: 'var(--header-height)'
    }}>
      <div style={{
        maxWidth: 'var(--max-content-width)',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-xl)'
      }}>
        {/* Brand / Logo */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer' }}
          onClick={() => handleTabClick('home')}
        >
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, #FE7413, #FF3D00)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Dumbbell size={24} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 19,
                letterSpacing: '-0.03em',
                color: '#fff'
              }}>
                AURA<span style={{ color: 'var(--color-primary)' }}>FITNESS</span>
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-primary-glow)'
              }}>
                PRO
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
              Sports Center Management System
            </p>
          </div>
        </div>

        {/* Dynamic Navigation Tabs based on Role */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {currentTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                style={{
                  background: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '8px 16px',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 10px rgba(254, 116, 19, 0.3)' : 'none'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Quick QR (Admin/Lễ tân), User Profile / Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {/* Quick Check-in CTA Button (Chỉ hiển thị cho vai trò Admin và Lễ Tân) */}
          {(currentRole === 'admin' || currentRole === 'receptionist') && (
            <button 
              className="btn-primary" 
              style={{ padding: '7px 14px', fontSize: 12 }}
              onClick={onOpenQuickCheckIn}
              title="Mở cổng quét QR Check-in mô phỏng"
            >
              <QrCode size={15} />
              <span>Quét QR Test</span>
            </button>
          )}

          {/* User Profile Menu OR Login/Register buttons */}
          {currentUser ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-full)',
                  padding: '4px 14px 4px 4px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'block' }}>
                    {currentUser.name}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 600 }}>
                    {roleLabels[currentUser.role] || currentUser.role.toUpperCase()}
                  </span>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: 2 }} />
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '120%',
                  width: 230,
                  background: 'var(--bg-panel)',
                  border: 'var(--border-card)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: 8,
                  zIndex: 200,
                  animation: 'fadeIn 0.15s ease'
                }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{currentUser.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{currentUser.email}</div>
                    <span className="badge badge-primary" style={{ fontSize: 9, marginTop: 4 }}>
                      {roleLabels[currentUser.role]}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onOpenSettings();
                      setShowUserMenu(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Settings size={15} color="var(--color-primary)" />
                    <span>Cài Đặt & Cấu Hình</span>
                  </button>

                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserMenu(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      color: 'var(--color-danger)',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={15} />
                    <span>Đăng Xuất Tài Khoản</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn-ghost"
                style={{ padding: '8px 14px', fontSize: 13 }}
                onClick={onOpenLogin}
              >
                <LogIn size={15} />
                <span>Đăng Nhập</span>
              </button>

              <button
                className="btn-outline"
                style={{ padding: '6px 16px', fontSize: 12 }}
                onClick={onOpenRegister}
              >
                <UserPlus size={14} />
                <span>Đăng Ký</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
