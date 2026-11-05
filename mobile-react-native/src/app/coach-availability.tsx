import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura } from '../lib/theme';
import { Button, Card, Hero, Page, Section, showError } from '../components/ui';

type Data = Awaited<ReturnType<typeof api.coachAvailability>>;
type Slot = Data['slots'][number];
type Mode = 'dates' | 'weekly';
const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
const monday = (date: string) => addDays(date, 1 - weekday(date));
const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const instant = (date: string, offset: number) => Date.parse(`${date}T00:00:00Z`) + offset * 60000 - 7 * 3600000;
const covers = (shift: { startTime: string; endTime: string }, slot: Slot) => minute(shift.startTime) <= slot.startMinute && minute(shift.endTime) >= slot.endMinute;
const key = (day: number, startTime: string) => `${day}:${startTime}`;
const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export default function CoachAvailability() {
  const { user } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<Mode>('dates');
  const [weekStart, setWeekStart] = useState(() => monday(today()));
  const [dateDrafts, setDateDrafts] = useState<Record<string, string[]>>({});
  const [weeklyDraft, setWeeklyDraft] = useState<string[] | null>(null);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof api.coachChangeRequests>>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [availability, changes] = await Promise.all([api.coachAvailability(), api.coachChangeRequests()]);
      setData(availability);
      setRequests(changes);
      setDateDrafts({});
      setWeeklyDraft(null);
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { if (['COACH', 'TRAINER'].includes(user?.role ?? '')) void load(); }, [user?.role, load]));

  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const recurring = data ? new Set(data.slots.flatMap(slot => data.schedules.filter(row => row.isAvailable !== false && covers(row, slot)).map(row => key(row.dayOfWeek, slot.startTime)))) : new Set<string>();
  const selectedWeek = new Set(weeklyDraft ?? [...recurring]);
  const selectedDate = (date: string) => {
    if (!data) return new Set<string>();
    if (dateDrafts[date]) return new Set(dateDrafts[date]);
    const override = data.dates.find(row => row.date === date);
    return new Set(data.slots.filter(slot => override ? override.shifts.some(row => covers(row, slot)) : recurring.has(key(weekday(date), slot.startTime))).map(slot => slot.startTime));
  };
  const cellStatus = (date: string, slot: Slot) => {
    if (!data) return null;
    const start = instant(date, slot.startMinute), end = instant(date, slot.endMinute);
    if (data.bookings.some(row => {
      if (Date.parse(row.startTime) < end && Date.parse(row.endTime) > start) return true;
      if (mode !== 'weekly' || !recurring.has(key(weekday(date), slot.startTime))) return false;
      const localStart = new Date(Date.parse(row.startTime) + 7 * 3600000).toISOString();
      return weekday(localStart.slice(0, 10)) === weekday(date) && localStart.slice(11, 16) === slot.startTime;
    })) return 'Đã đặt';
    if (mode === 'dates' && data.closures.some(row => Date.parse(row.startAt) < end && Date.parse(row.endAt) > start)) return 'Đóng cửa';
    if (mode === 'dates' && start <= Date.now()) return 'Đã qua';
    return null;
  };
  const toggle = (date: string, slot: Slot) => {
    if (!data || busy || cellStatus(date, slot)) return;
    if (mode === 'weekly') {
      const next = new Set(selectedWeek), cell = key(weekday(date), slot.startTime);
      if (next.has(cell)) next.delete(cell); else next.add(cell);
      setWeeklyDraft([...next]);
    } else {
      const next = selectedDate(date);
      if (next.has(slot.startTime)) next.delete(slot.startTime); else next.add(slot.startTime);
      setDateDrafts(current => ({ ...current, [date]: [...next] }));
    }
  };
  const save = async () => {
    if (!data) return;
    setBusy(true);
    try {
      if (mode === 'weekly') {
        if (weeklyDraft === null) return;
        await api.saveCoachWeekly(Array.from({ length: 7 }, (_, i) => i + 1).flatMap(dayOfWeek => data.slots.filter(slot => selectedWeek.has(key(dayOfWeek, slot.startTime))).map(slot => ({ dayOfWeek, startTime: slot.startTime, endTime: slot.endTime }))));
      } else {
        const changed = Object.keys(dateDrafts).sort();
        if (!changed.length) return;
        await api.saveCoachDates(changed.map(date => ({ date, shifts: data.slots.filter(slot => dateDrafts[date].includes(slot.startTime) && !data.closures.some(row => Date.parse(row.startAt) < instant(date, slot.endMinute) && Date.parse(row.endAt) > instant(date, slot.startMinute))).map(slot => ({ startTime: slot.startTime, endTime: slot.endTime })) })));
      }
      await load();
      Alert.alert('Lịch PT', 'Lịch đã được công bố cho hội viên đặt PT.');
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };
  const resetDay = async (date: string) => {
    setBusy(true);
    try { await api.resetCoachDate(date); await load(); Alert.alert('Lịch PT', `${shortDate(date)} đã trở về lịch lặp hằng tuần.`); }
    catch (error) { showError(error); }
    finally { setBusy(false); }
  };

  if (!['COACH', 'TRAINER'].includes(user?.role ?? '')) return <Page><Hero eyebrow="COACH" title="Lịch làm việc" subtitle="Chức năng dành cho Coach." /><Button title="Quay lại trang chủ" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} /></Page>;
  const pending = mode === 'weekly' ? weeklyDraft !== null : Object.keys(dateDrafts).length > 0;
  return <Page loading={loading} refresh={() => void load()}>
    <Hero eyebrow="COACH" title="Lịch đăng ký làm việc PT" subtitle="Chọn trực tiếp các ô giờ trong lịch chung. Ca hợp lệ được mở cho hội viên đặt ngay." />
    <Card><Text style={{ color: aura.ink, fontSize: 16, fontWeight: '900' }}>Lịch chung do Admin thiết lập</Text><Text style={{ color: aura.muted, marginTop: 5 }}>{data?.calendar.openTime ?? '…'}–{data?.calendar.closeTime ?? '…'} · Ca {data?.calendar.slotMinutes ?? 60} phút · Nghỉ {data?.calendar.breakMinutes ?? 0} phút · Giờ Việt Nam</Text></Card>
    <Section title="Chọn ca trên lịch" subtitle="Vuốt ngang để xem đủ bảy ngày; chạm ô để đăng ký hoặc bỏ chọn." icon="calendar-outline" />
    <View style={{ marginHorizontal: -16, backgroundColor: aura.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: aura.border, paddingVertical: 14 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 13 }}>
          <Button compact title="Theo ngày" secondary={mode !== 'dates'} onPress={() => setMode('dates')} />
          <Button compact title="Lặp hằng tuần" secondary={mode !== 'weekly'} onPress={() => setMode('weekly')} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tuần trước"
            onPress={() => setWeekStart(addDays(weekStart, -7))}
            hitSlop={12}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <Text style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 13.5 }}>‹ </Text>
            <Text style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 13.5, textDecorationLine: 'underline' }}>
              Tuần trước
            </Text>
          </Pressable>

          <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 13.5 }}>
            {shortDate(weekStart)} – {shortDate(dates[6])}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tuần sau"
            onPress={() => setWeekStart(addDays(weekStart, 7))}
            hitSlop={12}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <Text style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 13.5, textDecorationLine: 'underline' }}>
              Tuần sau
            </Text>
            <Text style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 13.5 }}> ›</Text>
          </Pressable>
        </View>

        <Text style={{ color: aura.muted, fontSize: 11, marginBottom: 12 }}>
          🟡 Chưa đăng ký   🟢 Đã chọn   🔵 Đã đặt   ⚪ Đóng cửa / đã qua
        </Text>
      </View>

      {/* Bảng lịch đăng ký ca: Toàn màn hình, cột 'Giờ ca' bên trái cố định khi vuốt ngang */}
      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: aura.border, flexDirection: 'row', backgroundColor: aura.white }}>
        {/* Cột trái cố định: Giờ ca */}
        <View style={{ width: 76, backgroundColor: '#FAF7F5', borderRightWidth: 1, borderColor: aura.border, zIndex: 2 }}>
          <View style={{ height: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: aura.border, backgroundColor: '#F8F5F2' }}>
            <Text style={{ color: aura.ink, fontSize: 11.5, fontWeight: '900' }}>Giờ ca</Text>
          </View>
          {data?.slots.map(slot => (
            <View
              key={slot.startTime}
              style={{
                height: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: 1,
                borderColor: aura.border,
                paddingHorizontal: 2,
              }}
            >
              <Text style={{ color: aura.darkCoffee, fontSize: 12, fontWeight: '900' }}>{slot.startTime}</Text>
              <Text style={{ color: aura.muted, fontSize: 10, fontWeight: '600' }}>–{slot.endTime}</Text>
            </View>
          ))}
        </View>

        {/* Các cột ngày lướt ngang: T2 -> CN */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ flex: 1 }}>
          <View>
            {/* Header các ngày */}
            <View style={{ flexDirection: 'row', height: 48, borderBottomWidth: 1, borderColor: aura.border, backgroundColor: '#F8F5F2' }}>
              {dates.map((date, index) => {
                const isToday = date === today();
                return (
                  <View
                    key={date}
                    style={{
                      width: 90,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRightWidth: index < 6 ? 1 : 0,
                      borderColor: aura.border,
                      backgroundColor: isToday ? '#F5ECE3' : 'transparent',
                    }}
                  >
                    <Text style={{ color: isToday ? aura.darkCoffee : aura.ink, fontWeight: '900', fontSize: 13 }}>
                      {labels[index]}
                    </Text>
                    <Text style={{ color: isToday ? aura.caramel : aura.muted, fontSize: 11, fontWeight: isToday ? '700' : '500' }}>
                      {shortDate(date)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Các ô chọn ca */}
            {data?.slots.map(slot => (
              <View
                key={slot.startTime}
                style={{
                  flexDirection: 'row',
                  height: 56,
                  borderBottomWidth: 1,
                  borderColor: aura.border,
                }}
              >
                {dates.map((date, index) => {
                  const status = cellStatus(date, slot);
                  const selected =
                    mode === 'weekly'
                      ? selectedWeek.has(key(weekday(date), slot.startTime))
                      : selectedDate(date).has(slot.startTime);

                  const backgroundColor =
                    status === 'Đã đặt'
                      ? '#DBEAFE'
                      : status
                      ? '#E7E5E4'
                      : selected
                      ? '#16A34A'
                      : '#FEF3C7';

                  const color =
                    selected && !status
                      ? '#FFFFFF'
                      : status === 'Đã đặt'
                      ? '#1D4ED8'
                      : status
                      ? '#78716C'
                      : '#78350F';

                  return (
                    <View
                      key={`${date}-${slot.startTime}`}
                      style={{
                        width: 90,
                        padding: 3,
                        borderRightWidth: index < 6 ? 1 : 0,
                        borderColor: aura.border,
                        justifyContent: 'center',
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${date} ${slot.startTime} đến ${slot.endTime}: ${status ?? (selected ? 'Đã chọn' : 'Chưa đăng ký')}`}
                        accessibilityState={{ disabled: !!status || busy, selected }}
                        disabled={!!status || busy}
                        onPress={() => toggle(date, slot)}
                        style={{
                          flex: 1,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor,
                          padding: 2,
                        }}
                      >
                        <Text style={{ color, fontSize: 10.5, fontWeight: '800', textAlign: 'center' }}>
                          {status ?? (selected ? '✓ Đã chọn' : '+ Chọn ca')}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {data?.slots.length === 0 && (
          <Text style={{ color: aura.muted, marginTop: 4 }}>Admin cần thiết lập giờ mở cửa đủ cho một ca PT.</Text>
        )}
        {mode === 'dates' &&
          dates
            .filter(date => data?.dates.some(row => row.date === date) && date >= today())
            .map(date => (
              <Pressable key={date} disabled={busy} onPress={() => void resetDay(date)} style={{ paddingVertical: 7 }}>
                <Text style={{ color: aura.darkCoffee, textDecorationLine: 'underline', fontSize: 12 }}>
                  ↺ {shortDate(date)}: trở về lịch lặp hằng tuần
                </Text>
              </Pressable>
            ))}
        <Text style={{ color: aura.muted, marginTop: 8, marginBottom: 12, fontSize: 12 }}>
          {mode === 'weekly'
            ? `${selectedWeek.size} ca lặp mỗi tuần`
            : `${Object.keys(dateDrafts).length} ngày có thay đổi chưa lưu`}
        </Text>
        <Button
          title={busy ? 'Đang lưu…' : 'Lưu lịch đã chọn'}
          disabled={busy || loading || !pending}
          onPress={() => void save()}
        />
      </View>
    </View>
    {requests.length > 0 && <Card><Text style={{ color: aura.ink, fontWeight: '800' }}>Yêu cầu đổi ca / báo vắng</Text>{requests.slice(0, 5).map(row => <Text key={row.id} style={{ color: aura.muted, marginTop: 6, fontSize: 12 }}>Booking #{row.bookingId} · {row.status} · {row.reason}</Text>)}</Card>}
  </Page>;
}
