import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, sessionStore, type Session, type User } from './api';
import { SOCKET_URL } from './api';
import { io } from 'socket.io-client';

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setUnreadCount: (count: number) => void;
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
  const refreshUnreadCount = useCallback(async () => {
    if (!sessionStore.token()) { setUnreadCount(0); return; }
    try { const result = await api.unreadNotifications(); setUnreadCount(Number(result.unreadCount ?? result.data?.unreadCount ?? 0)); }
    catch { setUnreadCount(0); }
  }, []);
  const refreshSession = useCallback(async () => {
    const session = await sessionStore.restore();
    setUser(session?.user ?? null);
    if (session) void refreshUnreadCount();
  }, [refreshUnreadCount]);
  useEffect(() => { sessionStore.restore().then(session => { setUser(session?.user ?? null); if (session) void refreshUnreadCount(); }).finally(() => setReady(true)); }, [refreshUnreadCount]);
  useEffect(() => {
    const token = sessionStore.token();
    if (!user || user.mustChangePassword || !token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('notification:new', () => setUnreadCount(count => count + 1));
    return () => { socket.disconnect(); };
  }, [user]);
  const accept = useCallback(async (session: Session) => { await sessionStore.save(session); setUser(session.user); void refreshUnreadCount(); }, [refreshUnreadCount]);
  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    await accept(session);
    return session.user;
  }, [accept]);
  const signUp = useCallback(async (name: string, email: string, password: string, phone: string) => accept(await api.register(name, email, password, phone)), [accept]);
  const signInWithGoogle = useCallback(async (idToken: string) => {
    const session = await api.googleLogin(idToken);
    await accept(session);
    return session.user;
  }, [accept]);
  const signOut = useCallback(async () => { await sessionStore.clear(); setUser(null); setUnreadCount(0); }, []);
  const completePasswordChange = useCallback(async () => {
    const token = sessionStore.token();
    if (!token || !user) throw new Error('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
    const updatedUser = { ...user, mustChangePassword: false };
    await sessionStore.save({ token, user: updatedUser });
    setUser(updatedUser);
  }, [user]);
  return <Context.Provider value={{ user, ready, unreadCount, refreshUnreadCount, refreshSession, setUnreadCount, signIn, signUp, signInWithGoogle, signOut, completePasswordChange }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider chưa khởi tạo.');
  return value;
}
