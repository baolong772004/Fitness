import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api, sessionStore, SOCKET_URL } from '../lib/api';
import { aura, dateLabel, dayKey } from '../lib/theme';
import { Button, Card, Empty, Page, Pill, Section, showError } from '../components/ui';

type PtSlot = { startTime: string; endTime: string; isAvailable: boolean };
type ChosenSlot = { bookingDate: string; day: string; startTime: string; endTime: string };

export default function PtBook() {
  const { subscription, makeupFor, deadline } = useLocalSearchParams<{ subscription?: string; makeupFor?: string; deadline?: string }>();
  const sub = useMemo(() => { try { return JSON.parse(subscription || '{}'); } catch { return {}; } }, [subscription]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);
  const coachId = makeupFor ? Number(sub.coachId) : selectedCoachId;
  const coachName = makeupFor ? sub.coach?.fullName : coaches.find(item => Number(item.userId) === coachId)?.fullName;
  const availableSessions = Number(sub.availableSessions ?? sub.remainingSessions ?? 0);
  const selectionLimit = makeupFor ? 1 : Math.min(20, Math.max(0, availableSessions));
  const [date, setDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    const limit = deadline ? new Date(deadline) : null;
    return limit && limit < tomorrow ? new Date() : tomorrow;
  });
  const [showDate, setShowDate] = useState(false);
  const [slots, setSlots] = useState<PtSlot[]>([]);
  const [creditSources, setCreditSources] = useState<Awaited<ReturnType<typeof api.ptWallet>>['sources']>([]);
  const [selected, setSelected] = useState<ChosenSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadId = useRef(0);

  useEffect(() => { if (!makeupFor) void api.ptTrainers(sub.level).then(setCoaches).catch(() => setCoaches([])); }, [makeupFor, sub.level]);
  useEffect(() => { if (!makeupFor) void api.ptWallet().then(wallet => setCreditSources(wallet.sources ?? [])).catch(() => setCreditSources([])); }, [makeupFor, sub.level]);
  useEffect(() => { setSelected([]); }, [coachId]);
  const gymInstant = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours - 7, minutes));
  };
  const load = useCallback(async () => {
    const currentId = ++loadId.current;
    if (!coachId) { setSlots([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const rows = await api.ptSlots(coachId, date) as PtSlot[];
      if (currentId !== loadId.current) return;
      setSlots(rows);
      const currentDay = dayKey(date);
      setSelected(current => current.filter(item => item.day !== currentDay || rows.some(slot =>
        slot.startTime === item.startTime && slot.isAvailable)));
    } catch (cause) { if (currentId === loadId.current) setError(cause instanceof Error ? cause.message : 'Không tải được ca tập.'); }
    finally { if (currentId === loadId.current) setLoading(false); }
  }, [coachId, date]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const token = sessionStore.token();
    if (!token || !coachId) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('coach:watch', coachId));
    socket.on('coach:schedule-changed', () => void load());
    return () => { socket.emit('coach:unwatch', coachId); socket.disconnect(); };
  }, [coachId, load]);

  const isSlotAvailable = (slot: PtSlot) => {
    if (!slot.isAvailable) return false;
    const start = gymInstant(slot.startTime).getTime();
    const end = gymInstant(slot.endTime).getTime();
    if (makeupFor) return !deadline || end <= new Date(deadline).getTime();
    return creditSources.some(source => source.level === sub.level && source.availableSessions > 0 &&
      (!source.startAt || new Date(source.startAt).getTime() <= start) &&
      (!source.endAt || new Date(source.endAt).getTime() >= end));
  };
  const chooseSlot = (slot: PtSlot) => {
    if (!isSlotAvailable(slot) || busy) return;
    const bookingDate = gymInstant(slot.startTime).toISOString();
    if (selected.some(item => item.bookingDate === bookingDate)) {
      setSelected(current => current.filter(item => item.bookingDate !== bookingDate));
      return;
    }
    if (selected.length >= selectionLimit) {
      Alert.alert('Đã chọn đủ buổi', makeupFor ? 'Lượt học bù chỉ đặt được một ca.' : availableSessions > 20
        ? 'Mỗi lần có thể đặt tối đa 20 buổi. Bạn có thể đặt tiếp sau.'
        : `Gói hiện còn ${selectionLimit} buổi có thể đặt.`);
      return;
    }
    setSelected(current => [...current, { bookingDate, day: dayKey(date), startTime: slot.startTime, endTime: slot.endTime }]
      .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate)));
  };
  const book = () => {
    if (!selected.length || busy) return;
    const summary = selected.slice(0, 5).map(item => `${item.day} · ${item.startTime}–${item.endTime}`).join('\n');
    Alert.alert('Xác nhận đặt lịch', `Đặt ${selected.length} buổi với ${coachName || 'Coach Aura'}?\n${summary}${selected.length > 5 ? '\n…' : ''}`, [
      { text: 'Để sau', style: 'cancel' },
      { text: `Đặt ${selected.length} buổi`, onPress: () => void (async () => {
        setBusy(true);
        try {
          if (makeupFor) await api.makeupPt(Number(makeupFor), selected[0].bookingDate);
          else await api.bookPtCredit(String(sub.level), Number(coachId), selected.map(item => item.bookingDate));
          Alert.alert('Thành công', makeupFor ? 'Đã đặt lịch học bù.' : `${selected.length} buổi PT đã được xác nhận.`);
          if (router.canGoBack()) router.back();
          else router.replace('/pt');
        } catch (cause) { showError(cause); await load(); }
        finally { setBusy(false); }
      })() },
    ]);
  };

  if (!makeupFor && !sub.level) return <Page><Empty title="Chưa chọn loại credit PT" /></Page>;
  if (deadline && new Date(deadline).getTime() < Date.now()) return <Page><Empty title="Lượt học bù đã hết hạn" message="Bạn không thể đặt thêm buổi học bù cho lịch này." /></Page>;
  return <Page loading={loading} refresh={() => void load()}>
    <LinearGradient colors={[aura.espresso, aura.darkCoffee]} style={{ borderRadius: 20, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="fitness-outline" size={25} color={aura.latte} /></View><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{coachName || (sub.isTrial ? 'Chọn Coach bên dưới' : 'Huấn luyện viên Aura')}</Text><Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 4 }}>{sub.package?.name || 'Gói PT'}</Text></View>{sub.remainingSessions != null && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{sub.availableSessions ?? sub.remainingSessions} buổi</Text>}</LinearGradient>
    {makeupFor && <Card><Text style={{ color: aura.caramel, fontWeight: '800', fontSize: 12 }}>BUỔI HỌC BÙ</Text><Text style={{ color: aura.muted, fontSize: 12, marginTop: 5 }}>Lượt học bù chỉ được chọn một ca trước khi hết hạn.</Text></Card>}
    {!makeupFor && <><Section title={`Chọn Coach chuyên ${sub.level}`} icon="people-outline" /><View style={{ gap: 8 }}>{coaches.map(coach => <Button key={String(coach.userId)} secondary={coachId !== Number(coach.userId)} title={coach.fullName || 'Coach'} onPress={() => setSelectedCoachId(Number(coach.userId))} />)}</View>{coaches.length === 0 && <Empty title="Chưa có Coach phù hợp" />}</>}
    <Section title={`Ngày tập · ${dateLabel(date)}`} subtitle={makeupFor ? 'Chọn một ca học bù' : 'Có thể chọn ca ở nhiều ngày khác nhau'} icon="calendar-outline" />
    {!makeupFor && creditSources.some(source => source.level === sub.level && source.remainingSessions > 0 && source.status === 'EXPIRED') && <Card><Text style={{ color: aura.caramel }}>Một số buổi PT đã hết hạn; chỉ các ca được nguồn còn hiệu lực bao phủ mới có thể đặt.</Text></Card>}
    <Button secondary title="Chọn ngày khác" onPress={() => setShowDate(true)} />
    {showDate && <DateTimePicker mode="date" value={date} minimumDate={new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())} maximumDate={deadline ? new Date(deadline) : new Date(Date.now() + 90 * 86400000)} onValueChange={(_, value) => { setShowDate(false); setDate(value); }} onDismiss={() => setShowDate(false)} />}
    <Section title="Ca tập còn trống" subtitle="Chạm nhiều ca rồi chuyển ngày để chọn tiếp" icon="time-outline" />
    {!makeupFor && <Text style={{ color: aura.muted, fontSize: 12 }}>Ca nằm ngoài thời hạn của mọi nguồn PT còn buổi sẽ bị khóa. Cần có Membership Gym hợp lệ cho toàn bộ ca.</Text>}
    {error && <><Empty title="Chưa tải được lịch Coach" message={error} icon="wifi-outline" /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && !loading && !!coachId && slots.length === 0 && <Empty title="Ngày này chưa có ca trống" message="Chọn ngày khác để xem lịch Coach." />}
    {!error && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{slots.map(slot => { const available = isSlotAvailable(slot); const chosen = selected.some(item => item.bookingDate === gymInstant(slot.startTime).toISOString()); return <Pressable key={slot.startTime} accessibilityRole="button" accessibilityLabel={`${slot.startTime} đến ${slot.endTime}${chosen ? ', đã chọn' : ''}`} accessibilityState={{ selected: chosen, disabled: !available }} disabled={!available || busy} onPress={() => chooseSlot(slot)} style={{ backgroundColor: chosen ? aura.darkCoffee : aura.white, borderColor: chosen ? aura.darkCoffee : aura.border, borderWidth: 1, borderRadius: 13, padding: 13, opacity: available ? 1 : .5 }}><Text style={{ color: chosen ? aura.white : available ? aura.darkCoffee : aura.muted, fontWeight: '800' }}>{chosen ? '✓ ' : ''}{slot.startTime}–{slot.endTime}</Text></Pressable>; })}</View>}
    {selected.length > 0 && <Card><Pill text={`${selected.length}/${selectionLimit} BUỔI ĐÃ CHỌN`} /><Text style={{ color: aura.ink, fontWeight: '900', marginTop: 12, marginBottom: 7 }}>Các ca sẽ đặt</Text>{selected.map(item => <Pressable key={item.bookingDate} onPress={() => setSelected(current => current.filter(row => row.bookingDate !== item.bookingDate))} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: aura.border }}><Text style={{ color: aura.ink }}>{item.day} · {item.startTime}–{item.endTime}</Text><Text style={{ color: aura.caramel, fontWeight: '800' }}>Bỏ chọn</Text></Pressable>)}<View style={{ height: 13 }} /><Button loading={busy} disabled={busy || selected.length > selectionLimit} title={busy ? 'Đang đặt lịch…' : `Xác nhận đặt ${selected.length} buổi`} onPress={book} /></Card>}
  </Page>;
}
