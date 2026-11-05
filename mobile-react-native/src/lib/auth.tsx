import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, sessionStore, type Session, type User } from './api';
import { SOCKET_URL } from './api';
import { io, Socket } from 'socket.io-client';

export type InAppBannerPayload = {
  type: 'CHAT' | 'NOTIFICATION';
  title: string;
  content: string;
  partnerId?: number;
  notificationId?: number;
};

export type IncomingChatPayload = {
  senderName: string;
  content: string;
  partnerId: number;
};

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  unreadCount: number;
  unreadChatCount: number;
  incomingChat: IncomingChatPayload | null;
  inAppBanner: InAppBannerPayload | null;
  dismissBanner: () => void;
  dismissChatBanner: () => void;
  showInAppBanner: (payload: InAppBannerPayload) => void;
  refreshUnreadCount: () => Promise<void>;
  refreshUnreadChatCount: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setUnreadCount: (count: number) => void;
  setUnreadChatCount: (count: number) => void;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string, phone: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<User>;
  signOut: () => Promise<void>;
  completePasswordChange: () => Promise<void>;
};

const Context = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [inAppBanner, setInAppBanner] = useState<InAppBannerPayload | null>(null);

  const dismissBanner = useCallback(() => {
    setInAppBanner(null);
  }, []);

  const dismissChatBanner = useCallback(() => {
    setInAppBanner(null);
  }, []);

  const showInAppBanner = useCallback((payload: InAppBannerPayload) => {
    setInAppBanner(payload);
  }, []);

  const incomingChat: IncomingChatPayload | null = inAppBanner?.type === 'CHAT' ? {
    senderName: inAppBanner.title,
    content: inAppBanner.content,
    partnerId: inAppBanner.partnerId || 0,
  } : null;

  // Làm mới số lượng thông báo hệ thống (loại trừ thông báo tin nhắn)
  const refreshUnreadCount = useCallback(async () => {
    if (!sessionStore.token()) { setUnreadCount(0); return; }
    try {
      const result = await api.unreadNotifications();
      setUnreadCount(Number(result.unreadCount ?? result.data?.unreadCount ?? 0));
    } catch {
      setUnreadCount(0);
    }
  }, []);

  // Làm mới số lượng tin nhắn chưa đọc từ các cuộc trò chuyện
  const refreshUnreadChatCount = useCallback(async () => {
    if (!sessionStore.token()) { setUnreadChatCount(0); return; }
    try {
      const res = await api.ptConversations();
      const list = Array.isArray(res.data) ? res.data : [];
      const total = list.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
      setUnreadChatCount(total);
    } catch {
      // ignore
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const session = await sessionStore.restore();
    setUser(session?.user ?? null);
    if (session) {
      void refreshUnreadCount();
      void refreshUnreadChatCount();
    }
  }, [refreshUnreadCount, refreshUnreadChatCount]);

  useEffect(() => {
    sessionStore.restore().then(session => {
      setUser(session?.user ?? null);
      if (session) {
        void refreshUnreadCount();
        void refreshUnreadChatCount();
      }
    }).finally(() => setReady(true));
  }, [refreshUnreadCount, refreshUnreadChatCount]);

  // Socket kết nối realtime cho thông báo và tin nhắn
  useEffect(() => {
    const token = sessionStore.token();
    if (!user || user.mustChangePassword || !token) return;

    const socket: Socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });

    // Khi có thông báo hệ thống mới (loại trừ tin nhắn)
    socket.on('notification:new', (notif: any) => {
      const rawTitle = String(notif?.title || '').trim().toLowerCase();
      const rawContent = String(notif?.message || notif?.content || '').trim().toLowerCase();
      // Tin nhắn sẽ không hiển thị ở hộp thư thông báo và TUYỆT ĐỐI không tăng số đếm thông báo
      if (
        rawTitle.includes('tin nhắn') ||
        rawTitle.includes('tin nhan') ||
        rawTitle.includes('chat') ||
        rawContent.includes('tin nhắn mới')
      ) {
        return;
      }
      setUnreadCount(count => count + 1);
      // Hiển thị banner container thông báo nổi kiểu Messenger/Zalo (3 giây)
      setInAppBanner({
        type: 'NOTIFICATION',
        title: String(notif?.title || 'Thông báo mới').trim(),
        content: String(notif?.message || notif?.content || '').trim(),
        notificationId: Number(notif?.id) || undefined,
      });
    });

    // Khi có tin nhắn chat mới gửi tới
    socket.on('chat:message', (msg: any) => {
      if (Number(msg?.senderId) !== Number(user.id)) {
        setUnreadChatCount(c => c + 1);
        // Hiển thị banner container thông báo nổi kiểu Messenger/Zalo (3 giây)
        setInAppBanner({
          type: 'CHAT',
          title: msg.sender?.fullName || 'Tin nhắn mới',
          content: msg.content || '',
          partnerId: Number(msg.senderId),
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const accept = useCallback(async (session: Session) => {
    await sessionStore.save(session);
    setUser(session.user);
    void refreshUnreadCount();
    void refreshUnreadChatCount();
  }, [refreshUnreadCount, refreshUnreadChatCount]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    await accept(session);
    return session.user;
  }, [accept]);

  const signUp = useCallback(async (name: string, email: string, password: string, phone: string) =>
    accept(await api.register(name, email, password, phone)), [accept]);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    const session = await api.googleLogin(idToken);
    await accept(session);
    return session.user;
  }, [accept]);

  const signOut = useCallback(async () => {
    await sessionStore.clear();
    setUser(null);
    setUnreadCount(0);
    setUnreadChatCount(0);
    setInAppBanner(null);
  }, []);

  const completePasswordChange = useCallback(async () => {
    const token = sessionStore.token();
    if (!token || !user) throw new Error('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
    const updatedUser = { ...user, mustChangePassword: false };
    await sessionStore.save({ token, user: updatedUser });
    setUser(updatedUser);
  }, [user]);

  return (
    <Context.Provider
      value={{
        user,
        ready,
        unreadCount,
        unreadChatCount,
        incomingChat,
        inAppBanner,
        dismissBanner,
        dismissChatBanner,
        showInAppBanner,
        refreshUnreadCount,
        refreshUnreadChatCount,
        refreshSession,
        setUnreadCount,
        setUnreadChatCount,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        completePasswordChange,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider chưa khởi tạo.');
  return value;
}
