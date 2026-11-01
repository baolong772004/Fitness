import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, sessionStore, SOCKET_URL } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { aura, dateLabel, list, timeLabel } from '../../lib/theme';
import { Button, Card, Empty, Page, showError } from '../../components/ui';

function isChatNotif(title: unknown, message: unknown) {
  const t = String(title || '').toLowerCase();
  const m = String(message || '').toLowerCase();
  return t.includes('tin nhắn') || t.includes('tin nhan') || t.includes('chat') || m.includes('tin nhắn mới');
}

function dateText(value: unknown) {
  const date = new Date(String(value || '')); if (Number.isNaN(date.getTime())) return '';
  const today = new Date(); const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (day === start) return `Hôm nay · ${timeLabel(value)}`;
  if (day === start - 86400000) return `Hôm qua · ${timeLabel(value)}`;
  return `${dateLabel(value)} · ${timeLabel(value)}`;
}

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const { user, unreadCount, setUnreadCount } = useAuth();
  const { highlightId } = useLocalSearchParams<{ highlightId?: string }>();
  const [rows, setRows] = useState<any[]>([]); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false); const [markingAll, setMarkingAll] = useState(false); const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(highlightId ? Number(highlightId) : null);

  const load = useCallback(async (next = 1) => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const result = await api.notifications(next);
      const data = list<any>(result.data).filter(item => !isChatNotif(item.title, item.message));
      const unread = data.filter(item => !item.isRead).length;
      setRows(previous => next === 1 ? data : [...previous, ...data]);
      setPage(next);
      setTotalPages(Number(result.pagination?.totalPages || 1));
      setUnreadCount(unread);

      // Nếu có highlightId từ banner, tự động đánh dấu đã đọc thông báo đó
      if (highlightId && Number(highlightId) > 0) {
        const targetId = Number(highlightId);
        setSelectedId(targetId);
        const targetItem = data.find(item => Number(item.id) === targetId);
        if (targetItem && !targetItem.isRead) {
          void api.readNotification(targetId);
          setRows(previous => previous.map(item => Number(item.id) === targetId ? { ...item, isRead: true } : item));
          setUnreadCount(Math.max(0, unread - 1));
        }
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải thông báo.'); }
    finally { setLoading(false); }
  }, [user, setUnreadCount, highlightId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    const token = sessionStore.token();
    if (!user || !token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('notification:new', (notification: any) => {
      if (isChatNotif(notification?.title, notification?.message)) return;
      setRows(previous => previous.some(row => Number(row.id) === Number(notification.id)) ? previous : [notification, ...previous]);
    });
    return () => { socket.disconnect(); };
  }, [user]);
  const markRead = async (row: any) => {
    setSelectedId(Number(row.id));
    if (row.isRead) return;
    try {
      await api.readNotification(Number(row.id));
      setRows(previous => previous.map(item => Number(item.id) === Number(row.id) ? { ...item, isRead: true } : item));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (cause) { showError(cause); }
  };
  const markAll = async () => { setMarkingAll(true); try { await api.readAllNotifications(); setRows(previous => previous.map(item => ({ ...item, isRead: true }))); setUnreadCount(0); } catch (cause) { showError(cause); } finally { setMarkingAll(false); } };
  return (
    <View style={{ flex: 1, backgroundColor: aura.cream }}>
      {/* Header an toàn tuyệt đối khỏi tai thỏ / status bar */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 11,
          paddingHorizontal: 16,
          backgroundColor: aura.white,
          borderBottomWidth: 1,
          borderBottomColor: '#EAD8C7',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ width: 60 }} />
        <Text style={{ fontSize: 18, fontWeight: '900', color: aura.darkCoffee, letterSpacing: 0.4 }}>
          Thông báo
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAll()} hitSlop={10} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
            <Text style={{ color: aura.caramel, fontWeight: '800', fontSize: 12.5 }}>Đọc tất cả</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <Page refresh={user ? () => void load() : undefined} loading={loading}>
    <LinearGradient colors={[aura.darkCoffee, aura.caramel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 52, height: 52, backgroundColor: '#FFFFFF26', borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="notifications" size={27} color="#fff" /></View><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 21 }}>Thông báo</Text><Text style={{ color: '#FFFFFFD4', fontSize: 13, marginTop: 3 }}>{user ? `${unreadCount} thông báo chưa đọc` : 'Đăng nhập để xem thông báo của bạn'}</Text></View></LinearGradient>
    {!user ? <><Empty icon="mail-unread-outline" title="Đăng nhập để xem thông báo" message="Thông báo lịch tập và cập nhật tài khoản sẽ được lưu tại đây." /><Button title="Đăng nhập" icon="log-in-outline" onPress={() => router.push('/auth')} /></> : <>
      {error && rows.length === 0 && <><Empty icon="cloud-offline-outline" title="Chưa tải được thông báo" message={error} /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
      {!error && !loading && rows.length === 0 && <Empty icon="notifications-outline" title="Bạn chưa có thông báo" message="Khi có cập nhật về lịch tập, thông báo sẽ xuất hiện ở đây." />}
      {rows.length > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}><Text style={{ color: aura.ink, fontSize: 18, fontWeight: '900', flex: 1 }}>Gần đây</Text>{unreadCount > 0 && <Text onPress={() => void markAll()} style={{ color: aura.caramel, fontWeight: '800', opacity: markingAll ? .5 : 1 }}>{markingAll ? 'Đang xử lý...' : 'Đọc tất cả'}</Text>}</View>}
      {rows.map(row => {
        const isSelected = selectedId === Number(row.id);
        return (
          <Pressable key={String(row.id)} onPress={() => void markRead(row)}>
            <Card
              style={{
                flexDirection: 'row',
                gap: 12,
                backgroundColor: isSelected ? '#FFF6ED' : (row.isRead ? aura.white : '#FFF8F1'),
                borderColor: isSelected ? aura.caramel : (row.isRead ? aura.border : aura.latte),
                borderWidth: isSelected ? 2 : 1,
              }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: isSelected ? aura.latte : (row.isRead ? aura.cream : aura.latte), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={String(row.title || '').toLowerCase().includes('lịch') ? 'calendar-outline' : 'notifications-outline'} size={21} color={isSelected ? aura.caramel : aura.coffee} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: aura.ink, fontSize: 15, fontWeight: '900' }}>{row.title}</Text>
                  {!row.isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: aura.caramel }} />}
                </View>
                <Text style={{ color: aura.muted, fontSize: 13, lineHeight: 19, marginTop: 5 }}>{row.message}</Text>
                <Text style={{ color: aura.caramel, fontSize: 11, fontWeight: '700', marginTop: 9 }}>{dateText(row.createdAt)}</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {error && rows.length > 0 && <Button secondary title="Tải thêm chưa thành công · Thử lại" onPress={() => void load(page + 1)} />}
      {!error && page < totalPages && <Button secondary disabled={loading} title="Xem thêm" onPress={() => void load(page + 1)} />}
    </>}
  </Page>
    </View>
  );
}
