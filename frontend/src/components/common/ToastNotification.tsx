import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toast: ToastItem) => void;
const listeners: Set<ToastListener> = new Set();

/**
 * Imperative Toast API callable anywhere in the codebase.
 */
export const toast = {
  show: (item: Omit<ToastItem, 'id'>) => {
    const fullItem: ToastItem = {
      ...item,
      id: 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      duration: item.duration ?? 3500
    };
    listeners.forEach((listener) => listener(fullItem));
  },
  success: (message: string, title: string = 'Thành công') => {
    toast.show({ type: 'success', title, message });
  },
  error: (message: string, title: string = 'Thất bại') => {
    toast.show({ type: 'error', title, message });
  },
  warning: (message: string, title: string = 'Cảnh báo') => {
    toast.show({ type: 'warning', title, message });
  },
  info: (message: string, title: string = 'Thông báo') => {
    toast.show({ type: 'info', title, message });
  }
};

/**
 * Automatically intercepts standard window.alert calls and converts them into
 * modern, non-blocking auto-dismissing toast notifications.
 */
export const installGlobalAlertOverride = () => {
  if (typeof window === 'undefined') return;
  
  window.alert = (message: any) => {
    const text = String(message ?? '');
    const lower = text.toLowerCase();
    
    if (
      lower.includes('lỗi') || 
      lower.includes('thất bại') || 
      lower.includes('không thể') || 
      lower.includes('error') ||
      lower.includes('failed')
    ) {
      toast.error(text, 'Thông Báo');
    } else if (
      lower.includes('thành công') || 
      lower.includes('hoàn tất') || 
      lower.includes('kích hoạt') ||
      lower.includes('success')
    ) {
      toast.success(text, 'Thành Công');
    } else if (
      lower.includes('cảnh báo') || 
      lower.includes('chú ý') || 
      lower.includes('vui lòng') ||
      lower.includes('warning')
    ) {
      toast.warning(text, 'Lưu Ý');
    } else {
      toast.info(text, 'Thông Báo');
    }
  };
};

interface ToastProps {
  item: ToastItem;
  onClose: (id: string) => void;
}

const ToastElement: React.FC<ToastProps> = ({ item, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const duration = item.duration || 3500;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(item.id);
    }, 250);
  };

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration]);

  // Color config according to AURA Fitness Design Tokens
  const config = {
    success: {
      icon: <CheckCircle2 size={20} color="#2E7D32" />,
      accentColor: '#2E7D32',
      bgGlow: 'rgba(46, 125, 50, 0.12)',
      border: 'rgba(46, 125, 50, 0.35)',
      defaultTitle: 'Thành công'
    },
    error: {
      icon: <AlertCircle size={20} color="#C62828" />,
      accentColor: '#C62828',
      bgGlow: 'rgba(198, 40, 40, 0.12)',
      border: 'rgba(198, 40, 40, 0.35)',
      defaultTitle: 'Lỗi'
    },
    warning: {
      icon: <AlertTriangle size={20} color="#E65100" />,
      accentColor: '#E65100',
      bgGlow: 'rgba(230, 81, 0, 0.12)',
      border: 'rgba(230, 81, 0, 0.35)',
      defaultTitle: 'Lưu ý'
    },
    info: {
      icon: <Info size={20} color="#8C3E26" />,
      accentColor: '#8C3E26',
      bgGlow: 'rgba(140, 62, 38, 0.12)',
      border: 'rgba(140, 62, 38, 0.35)',
      defaultTitle: 'Thông báo'
    }
  }[item.type];

  return (
    <div
      role="alert"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px 16px 16px',
        minWidth: 320,
        maxWidth: 420,
        background: 'var(--bg-panel)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--radius-md, 12px)',
        border: `1.5px solid ${config.border}`,
        boxShadow: `0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 0 15px 0 ${config.bgGlow}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        pointerEvents: 'auto',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: isExiting ? 'translateX(100px) scale(0.95)' : 'translateX(0) scale(1)',
        opacity: isExiting ? 0 : 1,
        animation: 'auraToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Icon with glowing badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: config.bgGlow,
          flexShrink: 0
        }}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5, lineHeight: 1.3, color: 'var(--text-primary)' }}>
          {item.title || config.defaultTitle}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            marginTop: 4,
            lineHeight: 1.45,
            wordBreak: 'break-word'
          }}
        >
          {item.message}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        aria-label="Đóng thông báo"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          padding: 4,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s, background-color 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.backgroundColor = 'var(--color-primary-light)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-dim)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <X size={15} />
      </button>

      {/* Auto-dismiss countdown bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'rgba(0, 0, 0, 0.05)'
        }}
      >
        <div
          style={{
            height: '100%',
            background: config.accentColor,
            width: '100%',
            animation: `auraToastProgress ${duration}ms linear forwards`
          }}
        />
      </div>
    </div>
  );
};

/**
 * Global Toast Container to be rendered at root level in App.tsx
 */
export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleNewToast = (toastItem: ToastItem) => {
      setToasts((prev) => [...prev, toastItem]);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  const handleClose = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      <style>{`
        @keyframes auraToastSlideIn {
          from {
            opacity: 0;
            transform: translateX(40px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes auraToastProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none'
        }}
      >
        {toasts.map((item) => (
          <ToastElement key={item.id} item={item} onClose={handleClose} />
        ))}
      </div>
    </>
  );
};
