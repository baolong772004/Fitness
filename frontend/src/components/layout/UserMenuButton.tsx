import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Settings } from 'lucide-react';
import { User, UserRole } from '../../types';

interface UserMenuButtonProps {
  currentUser: User | null;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản Trị Viên (Admin)',
  staff: 'Nhân Viên Quầy (Staff)',
  coach: 'Huấn Luyện Viên (Coach)',
  member: 'Hội Viên (Member)',
  guest: 'Khách Vãng Lai'
};

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';

export const UserMenuButton: React.FC<UserMenuButtonProps> = ({
  currentUser,
  onOpenSettings,
  onLogout
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUserMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) {
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

  if (!currentUser) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowUserMenu((open) => !open)}
        aria-label={currentUser.name}
        title={currentUser.name}
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          padding: 0,
          borderRadius: 'var(--radius-full)',
          border: showUserMenu ? '1.5px solid var(--color-primary)' : '1px solid var(--aura-border)',
          background: showUserMenu ? 'var(--color-primary-light)' : 'var(--bg-card)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <img
          src={currentUser.avatar || DEFAULT_AVATAR}
          alt={currentUser.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            display: 'block'
          }}
        />
      </button>

      {showUserMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Menu tài khoản"
          style={{
            position: 'fixed',
            top: 74,
            right: 24,
            width: 240,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--aura-border)',
            borderRadius: 'var(--radius-md, 12px)',
            boxShadow: 'var(--shadow-lg)',
            padding: 10,
            zIndex: 1200,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            animation: 'auraToastSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--aura-border)', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{currentUser.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{currentUser.email}</div>
            <span className="badge badge-primary" style={{ fontSize: 9.5, marginTop: 6, display: 'inline-block' }}>
              {ROLE_LABELS[currentUser.role] || currentUser.role.toUpperCase()}
            </span>
          </div>

          <button
            type="button"
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
            type="button"
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
        </div>,
        document.body
      )}
    </>
  );
};
