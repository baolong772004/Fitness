import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import { api, sessionStore, SOCKET_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, list, timeLabel } from '../lib/theme';
import { Button, Empty } from './ui';
import { AuraLoader } from './AuraLoader';

type PtChatBooking = {
  id: number;
  member?: { fullName?: string };
  coach?: { fullName?: string };
};

export function PtConversation({ booking, onBack }: { booking: PtChatBooking; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [canSend, setCanSend] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef(0);
  const syncing = useRef(false);
  const scroll = useRef<ScrollView | null>(null);
  const scrollOnChange = useRef(true);

  const merge = useCallback((incoming: any[]) => setMessages(previous => {
    const byId = new Map([...previous, ...incoming].map(row => [Number(row.id), row]));
    return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }), []);

  const loadLatest = useCallback(async () => {
    if (!booking.id) return;
    setLoading(true); setError(null);
    try {
      const page = await api.chat(Number(booking.id));
      const rows = list<any>(page.data);
      merge(rows);
      if (rows.length) lastId.current = Math.max(lastId.current, Number(rows.at(-1).id));
      setCanSend(page.canSend === true);
      setHasMore(page.hasMore === true);
      scrollOnChange.current = true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tin nhắn.'); }
    finally { setLoading(false); }
  }, [booking.id, merge]);

  const syncNew = useCallback(async () => {
    if (!booking.id || syncing.current) return;
    if (!lastId.current) { await loadLatest(); return; }
    syncing.current = true;
    try {
      let cursor = lastId.current;
      while (true) {
        const page = await api.chat(Number(booking.id), `?afterId=${cursor}`);
        const rows = list<any>(page.data);
        if (rows.length) {
          merge(rows);
          cursor = Number(rows.at(-1).id);
          lastId.current = Math.max(lastId.current, cursor);
          scrollOnChange.current = true;
        }
        setCanSend(page.canSend === true);
        if (!page.hasMore || !rows.length) break;
      }
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đồng bộ được tin nhắn.'); }
    finally { syncing.current = false; }
  }, [booking.id, loadLatest, merge]);

  useEffect(() => { setMessages([]); lastId.current = 0; void loadLatest(); }, [loadLatest]);
  useEffect(() => { const timer = setInterval(() => void syncNew(), 60000); return () => clearInterval(timer); }, [syncNew]);
  useEffect(() => {
    const token = sessionStore.token();
    if (!token || !booking.id) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('booking:join', Number(booking.id), (result: { ok: boolean; error?: string }) => {
      setConnected(result.ok);
      if (result.ok) void syncNew();
      else if (result.error) setError(result.error);
    }));
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', row => {
      merge([row]); lastId.current = Math.max(lastId.current, Number(row.id)); scrollOnChange.current = true;
    });
    socket.on('message:read', ({ ids, readAt }: { ids: number[]; readAt: string }) => {
      setMessages(previous => previous.map(row => ids.includes(Number(row.id)) ? { ...row, readAt } : row));
    });
    return () => { socket.emit('booking:leave', Number(booking.id)); socket.disconnect(); };
  }, [booking.id, merge, syncNew]);

  const loadOlder = async () => {
    if (!hasMore || loadingMore || !messages.length) return;
    setLoadingMore(true); scrollOnChange.current = false;
    try {
      const page = await api.chat(Number(booking.id), `?beforeId=${messages[0].id}`);
      merge(list<any>(page.data)); setHasMore(page.hasMore === true); setCanSend(page.canSend === true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tin nhắn cũ.'); }
    finally { setLoadingMore(false); }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || busy || !canSend) return;
    setBusy(true);
    try {
      const result = await api.sendChat(Number(booking.id), content);
      merge([result.data]); lastId.current = Math.max(lastId.current, Number(result.data.id));
      setDraft(''); scrollOnChange.current = true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Không gửi được tin nhắn.';
      setError(message);
      if (message.includes('đã đóng')) setCanSend(false);
    } finally { setBusy(false); }
  };

  const isCoach = ['COACH', 'TRAINER'].includes(user?.role || '');
  const otherName = isCoach ? booking.member?.fullName || 'Hội viên' : booking.coach?.fullName || 'Huấn luyện viên PT';
  const open = canSend;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: aura.cream }}>
    <View style={{ paddingHorizontal: 17, paddingVertical: 12, backgroundColor: aura.white, borderBottomWidth: 1, borderColor: aura.border, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại danh sách tin nhắn" onPress={onBack} hitSlop={10} style={{ marginRight: 12 }}><Ionicons name="arrow-back" size={23} color={aura.darkCoffee} /></Pressable>
      <View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }}>{otherName}</Text><Text style={{ color: aura.muted, fontSize: 11 }}>Lịch sử trò chuyện PT</Text></View>
      <Pressable accessibilityLabel="Làm mới tin nhắn" onPress={() => void syncNew()} hitSlop={10}><Ionicons name="refresh" size={23} color={aura.darkCoffee} /></Pressable>
    </View>
    <Text style={{ paddingVertical: 7, textAlign: 'center', backgroundColor: connected ? '#EAF4E9' : aura.latte, color: connected ? aura.green : aura.caramel, fontSize: 11, fontWeight: '700' }}>{connected ? 'Đang kết nối trực tiếp' : 'Đang kết nối lại · có thể tải tin bằng nút làm mới'}</Text>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => { if (scrollOnChange.current) scroll.current?.scrollToEnd({ animated: true }); }}>
      {hasMore && <Button secondary compact title={loadingMore ? 'Đang tải...' : 'Xem tin nhắn cũ'} onPress={() => void loadOlder()} disabled={loadingMore} />}
      {loading && messages.length === 0 && <View style={{ alignSelf: 'center', margin: 28 }}><AuraLoader size={56} /></View>}
      {error && <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#FCEEE8' }}><Text style={{ color: aura.caramel, fontSize: 12 }}>{error}</Text><Text onPress={() => void loadLatest()} style={{ color: aura.darkCoffee, fontWeight: '800', marginTop: 5 }}>Thử lại</Text></View>}
      {!loading && !error && messages.length === 0 && <Empty title="Chưa có tin nhắn" message="Bắt đầu trò chuyện với Coach của bạn." />}
      {messages.map(row => { const mine = Number(row.senderId) === Number(user?.id); return <View key={String(row.id)} style={{ maxWidth: '82%', alignSelf: mine ? 'flex-end' : 'flex-start', padding: 11, backgroundColor: mine ? aura.darkCoffee : aura.white, borderRadius: 15, borderWidth: mine ? 0 : 1, borderColor: aura.border }}><Text style={{ color: mine ? '#fff' : aura.ink, lineHeight: 19 }}>{row.content}</Text><Text style={{ color: mine ? aura.latte : aura.muted, fontSize: 9, marginTop: 5 }}>{timeLabel(row.createdAt)}{mine && row.readAt ? ' · Đã đọc' : ''}</Text></View>; })}
    </ScrollView>
    {loading && messages.length === 0 ? <Text style={{ color: aura.muted, textAlign: 'center', padding: 13, fontSize: 12 }}>Đang tải cuộc trò chuyện...</Text> : open ? <View style={{ flexDirection: 'row', padding: 12, gap: 7, backgroundColor: aura.white, borderTopColor: aura.border, borderTopWidth: 1 }}><TextInput value={draft} onChangeText={setDraft} maxLength={1000} placeholder="Nhập tin nhắn..." placeholderTextColor={aura.muted} style={{ flex: 1, borderColor: aura.border, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, color: aura.ink }} /><Pressable disabled={busy || !draft.trim()} onPress={() => void send()} style={{ backgroundColor: aura.darkCoffee, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 16, opacity: busy ? .5 : 1 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Gửi</Text></Pressable></View> : <Text style={{ color: aura.muted, textAlign: 'center', padding: 13, fontSize: 12 }}>{error ? 'Không thể tải quyền nhắn tin. Hãy thử lại.' : 'Cuộc trò chuyện đã đóng. Bạn vẫn có thể xem tin nhắn cũ.'}</Text>}
  </KeyboardAvoidingView>;
}
