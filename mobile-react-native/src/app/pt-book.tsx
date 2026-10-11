import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../lib/api';
import { aura, dateLabel } from '../lib/theme';
import { Button, Card, Empty, Page, Pill, Section, showError } from '../components/ui';

export default function PtBook() {
  const { subscription, makeupFor, deadline } = useLocalSearchParams<{ subscription?: string; makeupFor?: string; deadline?: string }>();
  const sub = useMemo(() => { try { return JSON.parse(subscription || '{}'); } catch { return {}; } }, [subscription]);
  const [date, setDate] = useState(() => { const tomorrow = new Date(Date.now() + 86400000); const limit = deadline ? new Date(deadline) : null; return limit && limit < tomorrow ? new Date() : tomorrow; }); const [showDate, setShowDate] = useState(false); const [slots, setSlots] = useState<any[]>([]); const [selected, setSelected] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!sub.coachId) return; setLoading(true); setSelected(null); setError(null); try { setSlots(await api.ptSlots(Number(sub.coachId), date)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được ca tập.'); } finally { setLoading(false); } }, [sub.coachId, date]);
  useEffect(() => { void load(); }, [load]);
  const gymInstant = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours - 7, minutes)); };
  const book = async () => { if (!selected) return; const when = gymInstant(selected).toISOString(); Alert.alert('Xác nhận đặt lịch', `Tập với ${sub.coach?.fullName || 'Coach Aura'} vào ${dateLabel(date)} lúc ${selected}?`, [{ text: 'Để sau' }, { text: 'Đặt lịch', onPress: () => void (async () => { setBusy(true); try { if (makeupFor) await api.makeupPt(Number(makeupFor), when); else await api.bookPt(Number(sub.id), when); Alert.alert('Thành công', makeupFor ? 'Đã đặt lịch học bù.' : 'Đã gửi yêu cầu đặt lịch.'); router.back(); } catch (error) { showError(error); await load(); } finally { setBusy(false); } })() }]); };
  if (!sub.coachId) return <Page><Empty title="Gói PT chưa có Coach được gán" /></Page>;
  if (deadline && new Date(deadline).getTime() < Date.now()) return <Page><Empty title="Lượt học bù đã hết hạn" message="Bạn không thể đặt thêm buổi học bù cho lịch này." /></Page>;
  return <Page loading={loading} refresh={() => void load()}><LinearGradient colors={[aura.espresso, aura.darkCoffee]} style={{ borderRadius: 20, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="fitness-outline" size={25} color={aura.latte} /></View><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{sub.coach?.fullName || 'Huấn luyện viên Aura'}</Text><Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 4 }}>{sub.package?.name || 'Gói PT'}</Text></View>{sub.remainingSessions != null && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{sub.remainingSessions} buổi</Text>}</LinearGradient>
    {makeupFor && <Card><Text style={{ color: aura.caramel, fontWeight: '800', fontSize: 12 }}>BUỔI HỌC BÙ</Text><Text style={{ color: aura.muted, fontSize: 12, marginTop: 5 }}>Chọn ca trước khi lượt học bù hết hạn.</Text></Card>}
    <Section title={`Ngày tập · ${dateLabel(date)}`} icon="calendar-outline" /><Button secondary title="Chọn ngày" onPress={() => setShowDate(true)} />
    {showDate && <DateTimePicker mode="date" value={date} minimumDate={new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())} maximumDate={deadline ? new Date(deadline) : new Date(Date.now() + 90 * 86400000)} onChange={(_, value) => { setShowDate(false); if (value) setDate(value); }} />}
    <Section title="Ca tập còn trống" subtitle="Thời gian theo giờ phòng tập" icon="time-outline" />
    {error && <><Empty title="Chưa tải được lịch Coach" message={error} icon="wifi-outline" /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && !loading && slots.length === 0 && <Empty title="Ngày này chưa có ca trống" message="Chọn ngày khác để xem lịch Coach." />}
    {!error && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{slots.map((slot, index) => { const available = slot.isAvailable === true && (!deadline || gymInstant(slot.startTime).getTime() <= new Date(deadline).getTime()); return <Text key={`${slot.startTime}-${index}`} onPress={available ? () => setSelected(slot.startTime) : undefined} style={{ color: selected === slot.startTime ? aura.white : available ? aura.darkCoffee : aura.muted, backgroundColor: selected === slot.startTime ? aura.darkCoffee : aura.white, borderColor: aura.border, borderWidth: 1, borderRadius: 13, padding: 13, fontWeight: '800', opacity: available ? 1 : .5 }}>{slot.startTime}–{slot.endTime}</Text>; })}</View>}
    {selected && <Card><Pill text="CA ĐÃ CHỌN" /><Text style={{ color: aura.ink, fontWeight: '900', marginVertical: 11 }}>{dateLabel(date)} · {selected}</Text><Button loading={busy} disabled={busy} title={busy ? 'Đang đặt lịch...' : 'Xác nhận đặt lịch'} onPress={() => void book()} /></Card>}
  </Page>;
}
