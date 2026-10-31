import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, type ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, sessionStore, SOCKET_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, list, timeLabel } from '../lib/theme';
import { Button, Empty } from './ui';
import { AuraLoader } from './AuraLoader';

export type PtChatBooking = {
  id?: number;
  memberId?: number;
  coachId?: number;
  member?: { fullName?: string };
  coach?: { fullName?: string };
  partner?: { id: number; fullName?: string };
  canSend?: boolean;
  reason?: string;
  chatType?: string;
};

export function PtConversation({ booking, onBack }: { booking: PtChatBooking; onBack: () => void }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [canSend, setCanSend] = useState(booking.canSend ?? false);
  const [reason, setReason] = useState<string | null>(booking.reason || null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef(0);
  const syncing = useRef(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const scrollOnChange = useRef(true);

  const isCoach = ['COACH', 'TRAINER'].includes(user?.role || '');
  const partnerId = booking.partner?.id || (isCoach ? booking.memberId : booking.coachId);
  const memberId = isCoach ? partnerId : user?.id;
  const coachId = isCoach ? user?.id : partnerId;

  const merge = useCallback((incoming: any[]) => setMessages(previous => {
    const byId = new Map([...previous, ...incoming].map(row => [Number(row.id), row]));
    return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }), []);

  const loadLatest = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let page: any;
      if (partnerId) {
        page = await api.pairChat(partnerId);
      } else if (booking.id) {
        page = await api.chat(Number(booking.id));
      } else {
        setLoading(false);
        return;
      }
      const rows = list<any>(page.data);
      merge(rows);
      if (rows.length) lastId.current = Math.max(lastId.current, Number(rows.at(-1).id));
      setCanSend(page.canSend === true);
      if (page.reason) setReason(page.reason);
      setHasMore(page.hasMore === true);
      scrollOnChange.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được tin nhắn.');
    } finally { setLoading(false); }
  }, [partnerId, booking.id, merge]);

  const syncNew = useCallback(async () => {
    if (syncing.current) return;
    if (!lastId.current) { await loadLatest(); return; }
    syncing.current = true;
    try {
      let cursor = lastId.current;
      while (true) {
        let page: any;
        if (partnerId) {
          page = await api.pairChat(partnerId, `?afterId=${cursor}`);
        } else if (booking.id) {
          page = await api.chat(Number(booking.id), `?afterId=${cursor}`);
        } else break;

        const rows = list<any>(page.data);
        if (rows.length) {
          merge(rows);
          cursor = Number(rows.at(-1).id);
          lastId.current = Math.max(lastId.current, cursor);
          scrollOnChange.current = true;
        }
        setCanSend(page.canSend === true);
        if (page.reason) setReason(page.reason);
        if (!page.hasMore || !rows.length) break;
      }
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đồng bộ được tin nhắn.'); }
    finally { syncing.current = false; }
  }, [partnerId, booking.id, loadLatest, merge]);

  useEffect(() => { setMessages([]); lastId.current = 0; void loadLatest(); }, [loadLatest]);
  useEffect(() => { const timer = setInterval(() => void syncNew(), 30000); return () => clearInterval(timer); }, [syncNew]);

  useEffect(() => {
    const token = sessionStore.token();
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      setConnected(true);
      if (memberId && coachId) {
        socket.emit('pair:join', { memberId, coachId }, (result: { ok: boolean; error?: string }) => {
          if (result.ok) void syncNew();
        });
      } else if (booking.id) {
        socket.emit('booking:join', Number(booking.id), (result: { ok: boolean; error?: string }) => {
          if (result.ok) void syncNew();
        });
      }
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', row => {
      merge([row]); lastId.current = Math.max(lastId.current, Number(row.id)); scrollOnChange.current = true;
    });
    socket.on('message:read', ({ ids, readAt }: { ids: number[]; readAt: string }) => {
      setMessages(previous => previous.map(row => ids.includes(Number(row.id)) ? { ...row, readAt } : row));
    });
    return () => {
      if (memberId && coachId) socket.emit('pair:leave', { memberId, coachId });
      else if (booking.id) socket.emit('booking:leave', Number(booking.id));
      socket.disconnect();
    };
  }, [memberId, coachId, booking.id, merge, syncNew]);

  const loadOlder = async () => {
    if (!hasMore || loadingMore || !messages.length) return;
    setLoadingMore(true); scrollOnChange.current = false;
    try {
      let page: any;
      if (partnerId) {
        page = await api.pairChat(partnerId, `?beforeId=${messages[0].id}`);
      } else if (booking.id) {
        page = await api.chat(Number(booking.id), `?beforeId=${messages[0].id}`);
      }
      if (page) {
        merge(list<any>(page.data));
        setHasMore(page.hasMore === true);
        setCanSend(page.canSend === true);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tin nhắn cũ.'); }
    finally { setLoadingMore(false); }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || busy || !canSend) return;
    setBusy(true);
    try {
      let result: any;
      if (partnerId) {
        result = await api.sendPairChat(partnerId, content, booking.id);
      } else if (booking.id) {
        result = await api.sendChat(Number(booking.id), content);
      }
      if (result?.data) {
        merge([result.data]);
        lastId.current = Math.max(lastId.current, Number(result.data.id));
        setDraft('');
        scrollOnChange.current = true;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Không gửi được tin nhắn.';
      setError(message);
      if (message.includes('chỉ đọc') || message.includes('kết thúc')) setCanSend(false);
    } finally { setBusy(false); }
  };

  const otherName = booking.partner?.fullName || (isCoach ? booking.member?.fullName || 'Hội viên' : booking.coach?.fullName || 'Huấn luyện viên PT');

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: aura.cream }}>
    <View style={{ paddingHorizontal: 17, paddingVertical: 12, backgroundColor: aura.white, borderBottomWidth: 1, borderColor: aura.border, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại danh sách tin nhắn" onPress={onBack} hitSlop={10} style={{ marginRight: 12 }}><Ionicons name="arrow-back" size={23} color={aura.darkCoffee} /></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }}>{otherName}</Text>
        <Text style={{ color: canSend ? aura.green : aura.muted, fontSize: 11, fontWeight: '700' }}>
          {canSend ? 'Quan hệ PT hợp lệ · Có thể gửi tin nhắn' : 'Chế độ chỉ đọc · Không thể gửi tin'}
        </Text>
      </View>
      <Pressable accessibilityLabel="Làm mới tin nhắn" onPress={() => void syncNew()} hitSlop={10}><Ionicons name="refresh" size={23} color={aura.darkCoffee} /></Pressable>
    </View>

    {!canSend && (
      <View style={{ backgroundColor: '#FDF6E2', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F5E3B5', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="information-circle-outline" size={18} color="#9C6B14" />
        <Text style={{ flex: 1, color: '#7A5200', fontSize: 11, lineHeight: 16 }}>
          {reason || 'Cuộc trò chuyện ở chế độ chỉ đọc (buổi Trial đã quá 24h hoặc gói PT đã hết hạn/hết số buổi).'}
        </Text>
      </View>
    )}

    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => { if (scrollOnChange.current) scroll.current?.scrollToEnd({ animated: true }); }}>
      {hasMore && <Button secondary compact title={loadingMore ? 'Đang tải...' : 'Xem tin nhắn cũ'} onPress={() => void loadOlder()} disabled={loadingMore} />}
      {loading && messages.length === 0 && <View style={{ alignSelf: 'center', margin: 28 }}><AuraLoader size={56} /></View>}
      {error && <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#FCEEE8' }}><Text style={{ color: aura.caramel, fontSize: 12 }}>{error}</Text><Text onPress={() => void loadLatest()} style={{ color: aura.darkCoffee, fontWeight: '800', marginTop: 5 }}>Thử lại</Text></View>}
      {!loading && !error && messages.length === 0 && <Empty title="Chưa có tin nhắn" message="Bắt đầu trao đổi cùng Huấn luyện viên của bạn." />}
      {messages.map(row => {
        const mine = Number(row.senderId) === Number(user?.id);
        return <View key={String(row.id)} style={{ maxWidth: '82%', alignSelf: mine ? 'flex-end' : 'flex-start', padding: 11, backgroundColor: mine ? aura.darkCoffee : aura.white, borderRadius: 15, borderWidth: mine ? 0 : 1, borderColor: aura.border }}>
          <Text style={{ color: mine ? '#fff' : aura.ink, lineHeight: 19 }}>{row.content}</Text>
          <Text style={{ color: mine ? aura.latte : aura.muted, fontSize: 9, marginTop: 5 }}>{timeLabel(row.createdAt)}{mine && row.readAt ? ' · Đã đọc' : ''}</Text>
        </View>;
      })}
    </ScrollView>

    {loading && messages.length === 0 ? (
      <Text style={{ color: aura.muted, textAlign: 'center', padding: 13, paddingBottom: 13 + insets.bottom, fontSize: 12 }}>Đang tải cuộc trò chuyện...</Text>
    ) : canSend ? (
      <View style={{ flexDirection: 'row', padding: 12, paddingBottom: 12 + insets.bottom, gap: 7, backgroundColor: aura.white, borderTopColor: aura.border, borderTopWidth: 1 }}>
        <TextInput value={draft} onChangeText={setDraft} maxLength={1000} placeholder="Nhập tin nhắn..." placeholderTextColor={aura.muted} style={{ flex: 1, minHeight: 44, borderColor: aura.border, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, color: aura.ink }} />
        <Pressable disabled={busy || !draft.trim()} onPress={() => void send()} style={{ backgroundColor: aura.darkCoffee, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 16, opacity: busy ? .5 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Gửi</Text>
        </Pressable>
      </View>
    ) : (
      <View style={{ padding: 14, paddingBottom: 14 + insets.bottom, backgroundColor: '#FAF7F2', borderTopWidth: 1, borderColor: aura.border, alignItems: 'center' }}>
        <Text style={{ color: aura.muted, fontSize: 12, textAlign: 'center' }}>
          Chế độ chỉ đọc. Bạn vẫn có thể xem lại lịch sử các buổi trao đổi trước đây.
        </Text>
      </View>
    )}
  </KeyboardAvoidingView>;
}
