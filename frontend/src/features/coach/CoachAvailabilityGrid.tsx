import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Data = Awaited<ReturnType<typeof api.pt.getCoachAvailability>>;
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
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Không thể cập nhật lịch.';

export function CoachAvailabilityGrid({ onSaved }: { onSaved: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<Mode>('dates');
  const [weekStart, setWeekStart] = useState(() => monday(today()));
  const [dateDrafts, setDateDrafts] = useState<Record<string, string[]>>({});
  const [weeklyDraft, setWeeklyDraft] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setData(await api.pt.getCoachAvailability());
    setDateDrafts({});
    setWeeklyDraft(null);
  };
  useEffect(() => { void refresh().catch(error => setMessage(errorMessage(error))).finally(() => setLoading(false)); }, []);
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
    const booking = data.bookings.find(row => {
      if (Date.parse(row.startTime) < end && Date.parse(row.endTime) > start) return true;
      if (mode !== 'weekly' || !recurring.has(key(weekday(date), slot.startTime))) return false;
      const localStart = new Date(Date.parse(row.startTime) + 7 * 3600000).toISOString();
      return weekday(localStart.slice(0, 10)) === weekday(date) && localStart.slice(11, 16) === slot.startTime;
    });
    if (booking) return { label: 'Đã đặt', reason: `Booking #${booking.id}` };
    if (mode === 'dates' && data.closures.some(row => Date.parse(row.startAt) < end && Date.parse(row.endAt) > start)) return { label: 'Đóng cửa', reason: 'Gym đóng cửa hoặc bảo trì' };
    if (mode === 'dates' && start <= Date.now()) return { label: 'Đã qua', reason: 'Ca đã bắt đầu' };
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
    setMessage('');
  };
  const save = async () => {
    if (!data) return;
    setBusy(true); setMessage('');
    try {
      if (mode === 'weekly') {
        if (weeklyDraft === null) return;
        await api.pt.updateCoachAvailability(Array.from({ length: 7 }, (_, i) => i + 1).flatMap(dayOfWeek => data.slots.filter(slot => selectedWeek.has(key(dayOfWeek, slot.startTime))).map(slot => ({ dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, isAvailable: true }))));
      } else {
        const changed = Object.keys(dateDrafts).sort();
        if (!changed.length) return;
        await api.pt.saveCoachDates(changed.map(date => ({ date, shifts: data.slots.filter(slot => dateDrafts[date].includes(slot.startTime) && !data.closures.some(row => Date.parse(row.startAt) < instant(date, slot.endMinute) && Date.parse(row.endAt) > instant(date, slot.startMinute))).map(slot => ({ startTime: slot.startTime, endTime: slot.endTime })) })));
      }
      await refresh(); onSaved(); setMessage('Lịch đã được công bố cho hội viên đặt PT.');
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const resetDay = async (date: string) => {
    setBusy(true); setMessage('');
    try { await api.pt.resetCoachDate(date); await refresh(); onSaved(); setMessage(`${shortDate(date)} đã trở về lịch lặp hằng tuần.`); }
    catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const pending = mode === 'weekly' ? weeklyDraft !== null : Object.keys(dateDrafts).length > 0;
  return <Card className="overflow-hidden">
    <CardHeader className="gap-3 border-b bg-amber-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5" /> Lịch đăng ký làm việc PT</CardTitle><CardDescription className="mt-2">Chạm vào ô để mở hoặc hủy ca của bạn. Ca đã có hội viên đặt sẽ được khóa.</CardDescription></div><div className="rounded-xl border bg-white px-4 py-2 text-sm"><strong>{data?.calendar.openTime ?? '…'}–{data?.calendar.closeTime ?? '…'}</strong><span className="ml-2 text-muted-foreground">Ca {data?.calendar.slotMinutes ?? 60} phút · Nghỉ {data?.calendar.breakMinutes ?? 0} phút</span></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-xl border bg-white p-1 text-sm"><button type="button" aria-pressed={mode === 'dates'} className={`rounded-lg px-3 py-2 ${mode === 'dates' ? 'bg-stone-800 text-white' : 'text-muted-foreground'}`} onClick={() => setMode('dates')}>Chọn theo ngày</button><button type="button" aria-pressed={mode === 'weekly'} className={`rounded-lg px-3 py-2 ${mode === 'weekly' ? 'bg-stone-800 text-white' : 'text-muted-foreground'}`} onClick={() => setMode('weekly')}>Lặp hằng tuần</button></div><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Tuần trước" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="size-4" /></Button><strong className="min-w-36 text-center text-sm">{shortDate(weekStart)} – {shortDate(dates[6])}</strong><Button size="icon" variant="outline" aria-label="Tuần sau" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="size-4" /></Button></div></div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>🟡 Chưa đăng ký</span><span>🟢 Đã đăng ký</span><span>🔵 Đã đặt</span><span>⚪ Đóng cửa / đã qua</span></div>
    </CardHeader>
    <CardContent className="space-y-4 pt-5">
      {message && <p role="status" className="rounded-lg border bg-background px-3 py-2 text-sm">{message}</p>}
      <p className="text-sm text-muted-foreground">{mode === 'weekly' ? 'Các ô đã chọn lặp lại mỗi tuần. Ngày nghỉ Gym vẫn tự động đóng; ca đã đặt không thể hủy.' : 'Ô chọn theo ngày có hiệu lực ngay sau khi lưu. Lịch riêng của ngày sẽ thay lịch lặp hằng tuần.'}</p>
      <div className="max-h-[670px] overflow-auto rounded-xl border"><div className="grid min-w-[940px]" style={{ gridTemplateColumns: '94px repeat(7, minmax(120px, 1fr))' }}>
        <div className="sticky left-0 top-0 z-30 border-b border-r bg-stone-50 px-3 py-4 text-xs font-semibold">Giờ ca</div>
        {dates.map((date, index) => <div key={date} className="sticky top-0 z-20 min-h-16 border-b border-r bg-stone-50 px-2 py-2 text-center text-sm"><strong>{labels[index]}</strong><span className="ml-1 text-muted-foreground">{shortDate(date)}</span>{mode === 'dates' && data?.dates.some(row => row.date === date) && <button type="button" disabled={busy || date < today()} onClick={() => void resetDay(date)} className="mx-auto mt-1 block text-xs text-amber-800 hover:underline disabled:opacity-50" title="Trở về lịch lặp hằng tuần">↺ Lịch riêng</button>}</div>)}
        {data?.slots.map(slot => <div key={slot.startTime} className="contents"><div className="sticky left-0 z-10 flex items-center border-b border-r bg-white px-2 text-xs font-semibold">{slot.startTime}<span className="text-muted-foreground">–{slot.endTime}</span></div>{dates.map(date => { const status = cellStatus(date, slot); const selected = mode === 'weekly' ? selectedWeek.has(key(weekday(date), slot.startTime)) : selectedDate(date).has(slot.startTime); const color = status?.label === 'Đã đặt' ? 'border-blue-200 bg-blue-50 text-blue-800' : status ? 'border-stone-200 bg-stone-100 text-stone-400' : selected ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600' : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'; return <div key={`${date}-${slot.startTime}`} className="border-b border-r p-1.5"><button type="button" disabled={busy || !!status || loading} aria-label={`${labels[weekday(date) - 1]} ${date} ${slot.startTime}–${slot.endTime}: ${status?.label ?? (selected ? 'Đã đăng ký' : 'Chưa đăng ký')}`} aria-pressed={selected} title={status?.reason ?? `${date} ${slot.startTime}–${slot.endTime}`} onClick={() => toggle(date, slot)} className={`flex h-12 w-full items-center justify-center rounded-lg border text-xs font-semibold transition-colors disabled:cursor-not-allowed ${color}`}>{status?.label ?? (selected ? '✓ Đã chọn' : '+ Chọn ca')}</button></div>; })}</div>)}
      </div>{!loading && data?.slots.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Giờ mở cửa hiện không đủ cho một ca PT. Admin cần cập nhật lịch chung.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{mode === 'weekly' ? `${selectedWeek.size} ca lặp mỗi tuần` : `${Object.keys(dateDrafts).length} ngày có thay đổi chưa lưu`} · Giờ Việt Nam</p><Button disabled={busy || loading || !pending} onClick={() => void save()}><Save className="mr-2 size-4" /> {busy ? 'Đang lưu…' : 'Lưu lịch đã chọn'}</Button></div>
    </CardContent>
  </Card>;
}
