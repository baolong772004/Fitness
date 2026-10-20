import React, { useState, useEffect, useRef } from 'react';
import { UserRole, User } from '../../types';
import {
  Dumbbell,
  Home,
  Package,
  Users,
  Calendar,
  QrCode,
  CreditCard,
  LifeBuoy,
  UserCheck,
  Clock,
  BarChart3,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  LogIn,
  UserPlus,
  Settings,
  LogOut,
  ChevronDown,
  GripVertical,
  Wrench,
  Layers,
  Bell
} from 'lucide-react';
import { AuraLogo } from '../common/AuraLogo';
import { api, ApiNotification } from '../../services/api';

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
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

interface NavTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
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
  onLogout,
  theme,
  onToggleTheme
}) => {
  // Horizontal resize and collapse states
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('aura_sidebar_width');
    return saved ? Math.max(200, Math.min(420, Number(saved))) : 260;
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('aura_sidebar_collapsed');
    return saved === 'true';
  });

  const [isDragging, setIsDragging] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!showUserMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showUserMenu]);

  const loadNotifications = async () => {
    if (!currentUser || !api.auth.getToken()) return;
    try {
      const res = await api.notifications.getMyNotifications({ limit: 8 });
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // A notification failure must not interrupt normal navigation.
    }
  };

  useEffect(() => {
    loadNotifications();
    if (!currentUser || !api.auth.getToken()) return;
    const timer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(timer);
  }, [currentUser?.id]);

  const handleNotificationClick = async (notification: ApiNotification) => {
    if (!notification.isRead) {
      try {
        await api.notifications.markRead(notification.id);
        setNotifications(items => items.map(item => item.id === notification.id ? { ...item, isRead: true } : item));
        setUnreadCount(count => Math.max(0, count - 1));
      } catch { /* keep notification visible for a later retry */ }
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications(items => items.map(item => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch { /* leave state unchanged */ }
  };

  // Sync collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('aura_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Drag-to-resize listener
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth < 140) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
        const clamped = Math.max(200, Math.min(420, newWidth));
        setSidebarWidth(clamped);
        localStorage.setItem('aura_sidebar_width', String(clamped));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const roleLabels: Record<UserRole, string> = {
    admin: 'Quản Trị Viên (Admin)',
    staff: 'Nhân Viên Quầy (Staff)',
    coach: 'Huấn Luyện Viên (Coach)',
    member: 'Hội Viên (Member)',
    guest: 'Khách Vãng Lai'
  };

  const getTabsForRole = (role: UserRole): NavTabItem[] => {
    switch (role) {
      case 'staff':
        return [
          { id: 'checkin', label: 'Soát Vé Vào Cổng', icon: QrCode },
          { id: 'pos', label: 'Quầy POS & Thu Ngân', icon: CreditCard },
          { id: 'operations', label: 'Vận Hành & Sự Cố', icon: Wrench },
          { id: 'shift', label: 'Ca Trực & Chốt Ca', icon: Clock },
          { id: 'members', label: 'Hội Viên', icon: Users }
        ];
      case 'coach':
        return [
          { id: 'schedule', label: 'Lịch Dạy', icon: Calendar },
          { id: 'workclass', label: 'Workclass', icon: Layers },
          { id: 'trainees', label: 'Hồ Sơ Học Viên', icon: UserCheck },
          { id: 'ai-workout', label: 'Giáo Án & Dinh Dưỡng', icon: FileText },
          { id: 'availability', label: 'Đăng Lịch Rảnh', icon: Clock }
        ];
      case 'admin':
        return [
          { id: 'analytics', label: 'Tổng Quan & BI', icon: BarChart3 },
          { id: 'members-360', label: 'Quản Lý Hội Viên', icon: Users },
          { id: 'tickets-management', label: 'Xử Lý Yêu Cầu', icon: LifeBuoy },
          { id: 'coaches-config', label: 'Quản Lý HLV', icon: UserCheck },
          { id: 'pt-calendar', label: 'Lịch PT chung', icon: Calendar },
          { id: 'packages-engine', label: 'Gói Tập & Dịch Vụ', icon: Package },
          { id: 'facilities', label: 'Cơ Sở Vật Chất', icon: Wrench },
          { id: 'group-classes', label: 'Lớp Nhóm & Lịch', icon: Layers },
          { id: 'audit-rbac', label: 'Nhật Ký Hệ Thống', icon: FileText }
        ];
      case 'member':
      case 'guest':
        return [
          { id: 'home', label: 'Trang Chủ', icon: Home },
          { id: 'facilities', label: 'Khu Vực & Thiết Bị', icon: Dumbbell },
          { id: 'pricing', label: 'Gói Tập & Bảng Giá', icon: Package },
          { id: 'schedule', label: 'Lịch Lớp Tuần Này', icon: Calendar },
          { id: 'coaches', label: 'Đội Ngũ HLV', icon: Users },
          { id: 'checkin-portal', label: 'Check-in QR', icon: QrCode }
        ];
      default:
        return [];
    }
  };

  const currentTabs = getTabsForRole(currentRole);

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    if (tabId === 'checkin-portal') {
      window.dispatchEvent(new CustomEvent('aura:open-checkin-qr'));
      return;
    }
    if (currentRole === 'guest' || currentRole === 'member') {
      const el = document.getElementById(tabId);
      if (el) {
        const yOffset = -24;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  };

  const currentWidth = isCollapsed ? 76 : sidebarWidth;

  return (
    <aside
      style={{
        width: currentWidth,
        minWidth: currentWidth,
        maxWidth: currentWidth,
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 100,
        backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.84)' : 'rgba(32, 14, 7, 0.86)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: isDragging ? 'none' : 'width 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        userSelect: isDragging ? 'none' : 'auto',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* 1. TOP HEADER: BRAND LOGO & COLLAPSE / EXPAND BUTTON */}
      <div
        style={{
          minHeight: isCollapsed ? 82 : 68,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: isCollapsed ? '8px 10px' : '0 16px',
          borderBottom: '1px solid var(--aura-border)',
          gap: 10
        }}
      >
        {isCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
            <div
              onClick={() => handleTabClick('home')}
              style={{ cursor: 'pointer' }}
              title="Aura Fitness (Về Trang Chủ)"
            >
              <AuraLogo size={38} showText={false} />
            </div>
            <button
              onClick={() => setIsCollapsed(false)}
              title="Mở rộng sidebar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 24,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-app)',
                border: '1px solid var(--aura-border)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--aura-border)';
              }}
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        ) : (
          <>
            <div
              onClick={() => handleTabClick('home')}
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                flex: 1
              }}
              title="Aura Gym & Fitness Club"
            >
              <AuraLogo size={42} showText={true} />
            </div>

            <button
              onClick={() => setIsCollapsed(true)}
              title="Thu gọn sidebar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                minWidth: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-app)',
                border: '1px solid var(--aura-border)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--aura-border)';
              }}
            >
              <PanelLeftClose size={16} />
            </button>
          </>
        )}
      </div>

      {currentUser && (
        <div style={{ padding: isCollapsed ? '8px 10px 2px' : '10px 14px 2px', position: 'relative' }}>
          <button
            type="button"
            onClick={() => { setShowNotifications(open => !open); loadNotifications(); }}
            title="Thông báo"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', gap: 8, padding: '9px 10px', border: '1px solid var(--aura-border)', borderRadius: 'var(--radius-sm)', background: showNotifications ? 'var(--color-primary-light)' : 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bell size={16} /><span style={{ display: isCollapsed ? 'none' : 'inline' }}>Thông báo</span></span>
            {unreadCount > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', display: 'grid', placeItems: 'center', borderRadius: 9, background: 'var(--color-danger)', color: '#fff', fontSize: 10 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {showNotifications && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: isCollapsed ? 'calc(100% + 8px)' : 14, width: 320, maxWidth: 'calc(100vw - 100px)', zIndex: 500, padding: 10, background: 'var(--bg-panel)', border: '1px solid var(--aura-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px 10px' }}><strong style={{ fontSize: 13 }}>Thông báo</strong><button type="button" onClick={markAllNotificationsRead} disabled={!unreadCount} style={{ border: 0, background: 'transparent', color: 'var(--color-primary)', cursor: unreadCount ? 'pointer' : 'default', fontSize: 11, fontWeight: 700 }}>Đọc tất cả</button></div>
              {notifications.length ? notifications.map(item => <button type="button" key={item.id} onClick={() => handleNotificationClick(item)} style={{ width: '100%', textAlign: 'left', padding: '10px 8px', border: 0, borderTop: '1px solid var(--aura-border)', background: item.isRead ? 'transparent' : 'var(--color-primary-light)', color: 'var(--text-primary)', cursor: 'pointer' }}><div style={{ fontSize: 12, fontWeight: 800 }}>{item.title}</div><div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.message}</div><div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>{new Date(item.createdAt).toLocaleString('vi-VN')}</div></button>) : <div style={{ padding: '20px 8px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Chưa có thông báo.</div>}
            </div>
          )}
        </div>
      )}

      {/* 2. QUICK CTA (Check-in QR for Admin only) */}
      {currentRole === 'admin' && (
        <div style={{ padding: isCollapsed ? '12px 10px 4px' : '14px 16px 6px' }}>
          <button
            className="btn-primary"
            onClick={onOpenQuickCheckIn}
            title="Soát vé vào cổng"
            style={{
              width: '100%',
              padding: isCollapsed ? '10px 0' : '9px 12px',
              justifyContent: 'center',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <QrCode size={16} />
            {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Soát Vé Vào Cổng</span>}
          </button>
        </div>
      )}

      {/* 3. NAVIGATION ITEMS */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isCollapsed ? '12px 8px' : '12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}
      >
        {!isCollapsed && (
          <div
            style={{
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)'
            }}
          >
            {currentRole === 'guest' ? 'Khám Phá' : 'Menu Quản Trị'}
          </div>
        )}

        {currentTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const IconComponent = tab.icon;
          const isHovered = hoveredTabId === tab.id;

          return (
            <div
              key={tab.id}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
            >
              <button
                onClick={() => handleTabClick(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: isCollapsed ? '12px 0' : '10px 14px',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  background: isActive ? 'var(--color-primary)' : isHovered ? 'var(--bg-app)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 2px 8px var(--color-primary-glow)' : 'none',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 20
                  }}
                >
                  <IconComponent size={18} strokeWidth={isActive ? 2.4 : 2} />
                </div>

                {!isCollapsed && (
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1
                    }}
                  >
                    {tab.label}
                  </span>
                )}
              </button>

              {/* Floating Tooltip in Collapsed Mode */}
              {isCollapsed && isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    left: 'calc(100% + 10px)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: 'var(--bg-panel)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--aura-border)',
                    zIndex: 300,
                    pointerEvents: 'none'
                  }}
                >
                  {tab.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. BOTTOM SECTION: THEME TOGGLE & USER PROFILE */}
      <div
        style={{
          borderTop: '1px solid var(--aura-border)',
          padding: isCollapsed ? '12px 8px' : '14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--bg-panel)'
        }}
      >
        {/* Light / Dark Mode Toggle */}
        {isCollapsed ? (
          <button
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Chuyển sang nền Tối' : 'Chuyển sang nền Sáng'}
            style={{
              width: '100%',
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--aura-border)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} style={{ color: '#FFA726' }} />}
          </button>
        ) : (
          <div
            onClick={onToggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--aura-border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Nhấp để đổi giao diện Sáng / Tối"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {theme === 'light' ? (
                <>
                  <Sun size={16} color="var(--color-primary)" />
                  <span>Giao diện Sáng</span>
                </>
              ) : (
                <>
                  <Moon size={16} color="#FFA726" />
                  <span>Giao diện Tối</span>
                </>
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)'
              }}
            >
              {theme === 'light' ? 'Light' : 'Dark'}
            </span>
          </div>
        )}

        {/* User Profile or Guest Login/Register */}
        {currentUser ? (
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: isCollapsed ? '6px 0' : '6px 8px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                background: showUserMenu ? 'var(--color-primary-light)' : 'var(--bg-card)',
                border: showUserMenu ? '1px solid var(--color-primary)' : '1px solid var(--aura-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              title={currentUser.name}
            >
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
              />

              {!isCollapsed && (
                <>
                  <div style={{ textAlign: 'left', flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {currentUser.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 600 }}>
                      {roleLabels[currentUser.role] || currentUser.role.toUpperCase()}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    style={{
                      color: 'var(--text-muted)',
                      transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </>
              )}
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  left: isCollapsed ? 'calc(100% + 10px)' : 0,
                  bottom: isCollapsed ? 0 : '115%',
                  width: 240,
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--aura-border)',
                  borderRadius: 'var(--radius-md, 12px)',
                  boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                  padding: 10,
                  zIndex: 999,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  animation: 'auraToastSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--aura-border)', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{currentUser.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{currentUser.email}</div>
                  <span className="badge badge-primary" style={{ fontSize: 9.5, marginTop: 6, display: 'inline-block' }}>
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
                    gap: 10,
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 6px)',
                    color: 'var(--text-primary)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-light)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  <Settings size={16} color="var(--color-primary)" />
                  <span>Cài Đặt & Tài Khoản</span>
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
                    gap: 10,
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 6px)',
                    color: 'var(--color-danger)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginTop: 4,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <LogOut size={16} />
                  <span>Đăng Xuất Tài Khoản</span>
                </button>
              </div>
            )}
          </div>
        ) : isCollapsed ? (
          /* Collapsed Guest Login/Register Icons */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={onOpenLogin}
              title="Đăng Nhập"
              style={{
                width: '100%',
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-app)',
                border: '1px solid var(--aura-border)',
                color: 'var(--color-primary)',
                cursor: 'pointer'
              }}
            >
              <LogIn size={16} />
            </button>
            <button
              onClick={onOpenRegister}
              title="Đăng Ký Tài Khoản"
              style={{
                width: '100%',
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-primary)',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <UserPlus size={16} />
            </button>
          </div>
        ) : (
          /* Expanded Guest Buttons */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn-ghost"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, justifyContent: 'center' }}
              onClick={onOpenLogin}
            >
              <LogIn size={15} />
              <span>Đăng Nhập</span>
            </button>
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, justifyContent: 'center' }}
              onClick={onOpenRegister}
            >
              <UserPlus size={14} />
              <span>Đăng Ký Tài Khoản</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. INTERACTIVE HORIZONTAL RESIZER HANDLE (Right edge) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDoubleClick={() => setIsCollapsed(!isCollapsed)}
        title="Kéo sang trái/phải để điều chỉnh độ rộng, hoặc nhấp đúp để thu gọn/mở rộng"
        style={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.15s'
        }}
      >
        <div
          style={{
            width: 2,
            height: '100%',
            backgroundColor: isDragging ? 'var(--color-primary)' : 'transparent',
            transition: 'background-color 0.15s'
          }}
        />
        {/* Subtle Grip Icon hint */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--aura-border)',
            borderRadius: 'var(--radius-full)',
            width: 14,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDragging ? 1 : 0.4,
            color: 'var(--text-muted)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <GripVertical size={10} />
        </div>
      </div>
    </aside>
  );
};
