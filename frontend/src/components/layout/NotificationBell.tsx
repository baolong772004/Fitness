import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { User, UserRole } from '../../types';
import { api, ApiNotification } from '../../services/api';

interface NotificationBellProps {
  currentUser: User | null;
  currentRole: UserRole;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  currentUser,
  currentRole
}) => {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = async () => {
    if (!currentUser || !api.auth.getToken()) return;
    try {
      const res = await api.notifications.getMyNotifications({ limit: 20 });
      let list = res.data || [];
      if (currentRole === 'coach') {
        list = list.filter((item) => !item.title.toLowerCase().includes('tin nhắn'));
        const unread = list.filter((item) => !item.isRead).length;
        setNotifications(list);
        setUnreadCount(unread);
      } else {
        setNotifications(list);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // A notification failure must not interrupt normal navigation.
    }
  };

  useEffect(() => {
    loadNotifications();
    if (!currentUser || !api.auth.getToken()) return;
    const timer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(timer);
  }, [currentUser?.id, currentRole]);

  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsidePanel = notificationPanelRef.current?.contains(target);
      const clickedToggleButton = notificationButtonRef.current?.contains(target);
      if (!clickedInsidePanel && !clickedToggleButton) {
        setShowNotifications(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications]);

  const handleNotificationClick = async (notification: ApiNotification) => {
    if (!notification.isRead) {
      try {
        await api.notifications.markRead(notification.id);
        setNotifications((items) =>
          items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // Keep notification visible for a later retry.
      }
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Leave state unchanged.
    }
  };

  if (!currentUser) return null;

  return (
    <>
      <button
        ref={notificationButtonRef}
        type="button"
        onClick={() => {
          const nextOpen = !showNotifications;
          setShowNotifications(nextOpen);
          if (nextOpen) loadNotifications();
        }}
        aria-label="Thông báo"
        title="Thông báo"
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          borderRadius: 'var(--radius-full)',
          border: showNotifications ? '1px solid var(--color-primary)' : '1px solid var(--aura-border)',
          background: showNotifications ? 'var(--color-primary-light)' : 'var(--bg-card)',
          color: showNotifications ? 'var(--color-primary)' : 'var(--text-primary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
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
              boxShadow: '0 0 0 2px var(--bg-panel)'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && typeof document !== 'undefined' && createPortal(
        <div
          ref={notificationPanelRef}
          role="dialog"
          aria-label="Bảng thông báo"
          style={{
            position: 'fixed',
            top: 74,
            right: 24,
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100dvh - 74px)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-panel)',
            border: '1px solid var(--aura-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '12px 14px',
              borderBottom: '1px solid var(--aura-border)',
              background: 'var(--bg-panel)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={15} style={{ color: 'var(--color-primary)' }} />
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Thông báo</strong>
              {unreadCount > 0 && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 6px',
                    display: 'inline-grid',
                    placeItems: 'center',
                    borderRadius: 9,
                    background: 'var(--color-danger)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={markAllNotificationsRead}
                disabled={!unreadCount}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: unreadCount ? 'var(--color-primary)' : 'var(--text-muted)',
                  cursor: unreadCount ? 'pointer' : 'default',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: 0
                }}
              >
                Đọc tất cả
              </button>
              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                aria-label="Đóng bảng thông báo"
                title="Đóng"
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 2
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '4px 10px 10px'
            }}
          >
            {notifications.length ? (
              notifications.map((item, idx) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 8px',
                    border: 0,
                    borderTop: idx === 0 ? 'none' : '1px solid var(--aura-border)',
                    borderRadius: 'var(--radius-sm)',
                    background: item.isRead ? 'transparent' : 'var(--color-primary-light)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{item.title}</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {item.message}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: '24px 8px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                Chưa có thông báo.
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
