import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dayKey, dateLabel, timeLabel } from '../lib/theme';
import { Button, Card, Empty, Hero, Page, Pill, Section } from '../components/ui';

function Detail({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 }}><Ionicons name={icon} size={16} color={aura.caramel} /><Text style={{ color: aura.ink, fontSize: 12, flex: 1 }}>{text}</Text></View>;
}

export default function Classes() {
  const params = useLocalSearchParams<{ category?: string }>(); const { user } = useAuth();
  const [date, setDate] = useState(new Date()); const [category, setCategory] = useState(params.category || ''); const [showDate, setShowDate] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]); const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); const [busyId, setBusyId] = useState<number | null>(null); const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try { const [rows, reserved] = await Promise.all([api.classSchedules(date), api.classBookings(date)]); setSchedules(rows); setBookings(reserved); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải lịch lớp học.'); }
    finally { setLoading(false); }
  }, [user, date]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const act = async (id: number, action: () => Promise<any>, success: string) => { setBusyId(id); try { await action(); Alert.alert('Thành công', success); await load(); } catch (cause) { Alert.alert('Aura Fitness', cause instanceof Error ? cause.message : 'Không thể xử lý yêu cầu.'); } finally { setBusyId(null); } };
  const today = new Date(); const days = Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const filtered = schedules.filter(row => !category || String(row.groupClass?.name || '').toLowerCase().includes(category.toLowerCase()));
  return <Page loading={loading} refresh={user ? () => void load() : undefined}><Hero eyebrow="WORKOUT CLASS" title="Lớp học nhóm" subtitle="Chọn ngày, giữ chỗ và check-in cho buổi tập của bạn." />
    {!user ? <><Empty title="Đăng nhập để xem lớp học" message="Lịch Workout Class và chỗ đã đặt sẽ hiển thị sau khi đăng nhập." /><Button title="Đăng nhập" onPress={() => router.push('/auth')} /></> : <>
      <Section title={`Lịch ngày ${dateLabel(date)}`} subtitle="Chọn ngày bạn muốn tham gia" icon="calendar-outline" /><Button secondary compact title="Chọn ngày" icon="calendar-outline" onPress={() => setShowDate(true)} />
      {showDate && <DateTimePicker value={date} mode="date" minimumDate={new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)} maximumDate={new Date(today.getFullYear(), today.getMonth(), today.getDate() + 180)} onValueChange={(_, value) => { setShowDate(false); setDate(value); }} onDismiss={() => setShowDate(false)} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{days.map(item => <Pressable key={dayKey(item)} onPress={() => setDate(item)} style={{ width: 57, height: 68, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: dayKey(item) === dayKey(date) ? aura.coffee : aura.border, backgroundColor: dayKey(item) === dayKey(date) ? aura.coffee : aura.white, borderRadius: 15 }}><Text style={{ color: dayKey(item) === dayKey(date) ? aura.latte : aura.muted, fontSize: 11 }}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][item.getDay()]}</Text><Text style={{ color: dayKey(item) === dayKey(date) ? aura.white : aura.ink, fontWeight: '900', fontSize: 21 }}>{item.getDate()}</Text></Pressable>)}</ScrollView>
      {!!category && <Button title={`Đang lọc: ${category} · Bỏ lọc`} secondary compact onPress={() => setCategory('')} />}
      {error && <><Empty icon="wifi-outline" title="Không tải được lớp học" message={error} /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
      {!error && !loading && filtered.length === 0 && <Empty icon="calendar-outline" title="Chưa có lớp trong ngày này" message="Chọn ngày khác để xem các lớp sắp mở." />}
      {!error && filtered.map(row => {
        const reserved = bookings.find(booking => Number(booking.scheduleId) === Number(row.id) && ['BOOKED', 'CHECKED_IN'].includes(booking.status));
        const start = new Date(row.startTime).getTime(); const end = new Date(row.endTime).getTime();
        const canCheckIn = now >= start - 15 * 60000 && now < end; const canCancel = reserved?.status === 'BOOKED' && start - now >= 2 * 3600000;
        const spots = Math.max(0, Number(row.capacity) - Number(row.bookedCount)); const started = now >= start; const full = row.status === 'FULL' || spots <= 0;
        return <Card key={String(row.id)} style={{ padding: 0, overflow: 'hidden' }}>
          {row.groupClass?.imageUrl && <Image source={{ uri: row.groupClass.imageUrl }} style={{ width: '100%', height: 126 }} />}
          <View style={{ padding: 17 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Text style={{ color: aura.ink, fontSize: 19, fontWeight: '900', flex: 1 }}>{row.groupClass?.name || 'Lớp học nhóm'}</Text>{reserved && <Pill text={reserved.status === 'CHECKED_IN' ? 'Đã check-in' : 'Đã đặt'} color={aura.green} />}</View>
            {!!row.groupClass?.description && <Text numberOfLines={2} style={{ color: aura.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{row.groupClass.description}</Text>}
            <View style={{ marginTop: 7 }}><Detail icon="time-outline" text={`${timeLabel(row.startTime)} – ${timeLabel(row.endTime)} · ${dateLabel(row.startTime)}`} /><Detail icon="person-outline" text={row.trainer?.fullName || 'Huấn luyện viên'} /><Detail icon="business-outline" text={row.room?.name || 'Phòng tập nhóm'} /><Detail icon="people-outline" text={`Còn ${spots}/${row.capacity} chỗ`} /></View>
            {!reserved ? <View style={{ marginTop: 14 }}><Button disabled={busyId != null || started || full} title={started ? 'Lớp đã bắt đầu' : full ? 'Đã hết chỗ' : 'Đặt chỗ tham gia'} onPress={() => void act(row.id, () => api.bookClass(row.id), `Đã đặt chỗ lớp ${row.groupClass?.name || ''}.`)} /></View> : reserved.status === 'BOOKED' ? <><View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}><View style={{ flex: 1 }}><Button secondary compact disabled={busyId != null || !canCancel} title="Hủy đăng ký" onPress={() => Alert.alert('Hủy đăng ký lớp?', `Bạn sẽ nhường chỗ trong lớp ${row.groupClass?.name || ''}.`, [{ text: 'Giữ chỗ' }, { text: 'Hủy đăng ký', onPress: () => void act(row.id, () => api.cancelClass(reserved.id), 'Đã hủy đăng ký.') }])} /></View><View style={{ flex: 1 }}><Button compact disabled={busyId != null || !canCheckIn} title="Quét QR điểm danh" onPress={() => router.push({ pathname: '/scanner', params: { kind: 'class', bookingId: String(reserved.id) } })} /></View></View>{!canCheckIn && now < end && <Text style={{ color: aura.muted, fontSize: 11, marginTop: 7 }}>QR điểm danh mở từ 15 phút trước giờ học.</Text>}{!canCancel && <Text style={{ color: aura.muted, fontSize: 11, marginTop: 5 }}>Chỉ có thể hủy trước giờ học ít nhất 2 tiếng.</Text>}</> : <Text style={{ color: aura.green, fontWeight: '900', marginTop: 14 }}>Bạn đã check-in cho lớp này.</Text>}
          </View>
        </Card>;
      })}
    </>}
  </Page>;
}
