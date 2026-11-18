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
  LogIn,
  UserPlus,
  GripVertical,
  Wrench,
  Layers,
  MessageSquare
} from 'lucide-react';
import { AuraLogo } from '../common/AuraLogo';
import { api } from '../../services/api';

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
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const loadUnreadMessages = async () => {
    if (currentRole !== 'coach' || !currentUser || !api.auth.getToken()) return;
    try {
      const res = await api.pt.getPtConversations();
      const total = (res.data || []).reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0);
      setUnreadMessageCount(total);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    if (currentRole !== 'coach' || !currentUser || !api.auth.getToken()) return;
    loadUnreadMessages();
    const timer = window.setInterval(loadUnreadMessages, 15000);

    const handleChatUpdated = (e: any) => {
      if (e.detail?.unreadCount !== undefined) {
        setUnreadMessageCount(e.detail.unreadCount);
      } else {
        loadUnreadMessages();
      }
    };
    window.addEventListener('aura:chat-updated', handleChatUpdated);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('aura:chat-updated', handleChatUpdated);
    };
  }, [currentRole, currentUser?.id, activeTab]);

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
          height: 68,
          minHeight: 68,
          maxHeight: 68,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: isCollapsed ? '4px 8px' : '0 16px',
          borderBottom: '1px solid var(--aura-border)',
          gap: 10
        }}
      >
        {isCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
            <div
              onClick={() => handleTabClick('home')}
              style={{ cursor: 'pointer' }}
              title="Aura Fitness (Về Trang Chủ)"
            >
              <AuraLogo size={34} showText={false} />
            </div>
            <button
              onClick={() => setIsCollapsed(false)}
              title="Mở rộng sidebar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 20,
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

      {currentUser && currentRole === 'coach' && (
        <div style={{ padding: isCollapsed ? '8px 10px 2px' : '10px 14px 2px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              handleTabClick('messages');
            }}
            title="Tin nhắn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              gap: 8,
              padding: '9px 10px',
              border: activeTab === 'messages' ? '1px solid var(--color-primary)' : '1px solid var(--aura-border)',
              borderRadius: 'var(--radius-sm)',
              background: activeTab === 'messages' ? 'var(--color-primary-light)' : 'var(--bg-card)',
              color: activeTab === 'messages' ? 'var(--color-primary)' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              position: 'relative',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} />
              <span style={{ display: isCollapsed ? 'none' : 'inline' }}>Tin nhắn</span>
            </span>
            {unreadMessageCount > 0 && (
              <span style={{
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 9,
                background: 'var(--color-danger)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                ...(isCollapsed ? { position: 'absolute', top: 2, right: 4 } : {})
              }}>
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </button>
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

      {/* 4. BOTTOM SECTION: GUEST LOGIN / REGISTER */}
      {!currentUser && (
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
          {isCollapsed ? (
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
      )}

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
