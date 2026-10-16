import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, sessionStore, type Session, type User } from './api';
import { SOCKET_URL } from './api';
import { io } from 'socket.io-client';

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, phone: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
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
  useEffect(() => { sessionStore.restore().then(session => { setUser(session?.user ?? null); if (session) void refreshUnreadCount(); }).finally(() => setReady(true)); }, [refreshUnreadCount]);
  useEffect(() => {
    const token = sessionStore.token();
    if (!user || !token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('notification:new', () => setUnreadCount(count => count + 1));
    return () => { socket.disconnect(); };
  }, [user]);
  const accept = useCallback(async (session: Session) => { await sessionStore.save(session); setUser(session.user); void refreshUnreadCount(); }, [refreshUnreadCount]);
  const signIn = useCallback(async (email: string, password: string) => accept(await api.login(email, password)), [accept]);
  const signUp = useCallback(async (name: string, email: string, password: string, phone: string) => accept(await api.register(name, email, password, phone)), [accept]);
  const signInWithGoogle = useCallback(async (idToken: string) => accept(await api.googleLogin(idToken)), [accept]);
  const signOut = useCallback(async () => { await sessionStore.clear(); setUser(null); setUnreadCount(0); }, []);
  return <Context.Provider value={{ user, ready, unreadCount, refreshUnreadCount, setUnreadCount, signIn, signUp, signInWithGoogle, signOut }}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider chưa khởi tạo.');
  return value;
}
