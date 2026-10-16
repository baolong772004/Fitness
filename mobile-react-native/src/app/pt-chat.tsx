import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dateLabel } from '../lib/theme';
import { Button, Empty } from '../components/ui';
import { AuraLoader } from '../components/AuraLoader';
import { PtConversation } from '../components/PtConversation';

type PtBooking = {
  id: number;
  memberId: number;
  coachId: number | null;
  startTime: string;
  member?: { fullName?: string };
  coach?: { fullName?: string };
};

export default function PtChat() {
  const { booking: rawBooking } = useLocalSearchParams<{ booking?: string }>();
  const { user, ready } = useAuth();
  const isCoach = ['COACH', 'TRAINER'].includes(user?.role || '');
  const [bookings, setBookings] = useState<PtBooking[]>([]);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const preferredBookingId = useMemo(() => {
    try { return Number(JSON.parse(rawBooking || '{}').id) || null; }
    catch { return null; }
  }, [rawBooking]);

  const load = useCallback(async () => {
    if (!user) { setBookings([]); setSelectedPair(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = (await api.ptBookings()) as PtBooking[];
      setBookings(rows);
      if (preferredBookingId) {
        const preferred = rows.find(row => Number(row.id) === preferredBookingId);
        if (preferred?.coachId) setSelectedPair(`${preferred.memberId}:${preferred.coachId}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách tin nhắn.');
    } finally { setLoading(false); }
  }, [user, preferredBookingId]);

  useFocusEffect(useCallback(() => { if (ready) void load(); }, [ready, load]));

  const conversations = useMemo(() => {
    const byPair = new Map<string, { booking: PtBooking; count: number }>();
    for (const booking of [...bookings].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())) {
      if (!booking.coachId || !booking.memberId) continue;
      const key = `${booking.memberId}:${booking.coachId}`;
      const existing = byPair.get(key);
      if (existing) existing.count += 1;
      else byPair.set(key, { booking, count: 1 });
    }
    return [...byPair.entries()].map(([key, value]) => ({ key, ...value }));
  }, [bookings]);

  const selected = conversations.find(row => row.key === selectedPair);
  if (selected && user) return <PtConversation key={selected.key} booking={selected.booking} onBack={() => setSelectedPair(null)} />;

  return <View style={{ flex: 1, backgroundColor: aura.cream }}>
    <View style={{ padding: 20, backgroundColor: aura.white, borderBottomWidth: 1, borderColor: aura.border }}>
      <Text style={{ color: aura.ink, fontSize: 22, fontWeight: '900' }}>Tin nhắn PT</Text>
      <Text style={{ color: aura.muted, fontSize: 12, marginTop: 4 }}>{isCoach ? 'Trò chuyện với hội viên của bạn' : 'Trò chuyện với Coach của bạn'}</Text>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}>
      {!ready || loading ? <View style={{ alignSelf: 'center', marginTop: 35 }}><AuraLoader size={56} /></View> : !user ? <><Empty icon="chatbubbles-outline" title="Đăng nhập để xem tin nhắn PT" /><Button title="Đăng nhập" onPress={() => router.push('/auth')} /></> : error ? <><Empty icon="wifi-outline" title="Không tải được tin nhắn" message={error} /><Button secondary title="Thử lại" onPress={() => void load()} /></> : conversations.length === 0 ? <><Empty icon="chatbubbles-outline" title="Chưa có cuộc trò chuyện PT" message={isCoach ? 'Cuộc trò chuyện sẽ xuất hiện khi bạn có lịch tập với hội viên.' : 'Sau khi có lịch tập PT với Coach, bạn có thể nhắn tin tại đây.'} />{!isCoach && <Button secondary title="Xem lịch PT" onPress={() => router.push('/pt')} />}</> : <>
        <Text style={{ color: aura.muted, fontSize: 12, marginBottom: 3 }}>{conversations.length} cuộc trò chuyện</Text>
        {conversations.map(({ key, booking, count }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Mở tin nhắn với ${isCoach ? booking.member?.fullName || 'hội viên' : booking.coach?.fullName || 'Coach'}`} onPress={() => setSelectedPair(key)} style={{ backgroundColor: aura.white, borderRadius: 16, borderWidth: 1, borderColor: aura.border, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chatbubble-ellipses-outline" size={23} color={aura.darkCoffee} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontSize: 15, fontWeight: '800' }}>{isCoach ? booking.member?.fullName || 'Hội viên' : booking.coach?.fullName || 'Coach Aura'}</Text><Text style={{ color: aura.muted, fontSize: 11, marginTop: 4 }}>{count} buổi PT · Lịch gần nhất {dateLabel(booking.startTime)}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={aura.caramel} />
        </Pressable>)}
      </>}
    </ScrollView>
  </View>;
}
