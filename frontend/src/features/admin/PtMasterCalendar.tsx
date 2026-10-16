import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Calendar = { openTime: string; closeTime: string; slotMinutes: number; breakMinutes: number };
type Closure = { id: number; startAt: string; endAt: string; kind: string; reason: string };
type CoachDay = Awaited<ReturnType<typeof api.adminTrainers.getCalendarCoaches>>[number];
const localDate = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const localInput = (value: string) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16);

export function PtMasterCalendar() {
  const [calendar, setCalendar] = useState<Calendar>({ openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 });
  const [masterSlots, setMasterSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [coaches, setCoaches] = useState<CoachDay[]>([]);
  const [audit, setAudit] = useState<Array<{ id: number; action: string; createdAt: string; user: { fullName: string } }>>([]);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof api.adminTrainers.getCalendarChangeRequests>>>([]);
  const [date, setDate] = useState(localDate);
  const [kind, setKind] = useState('HOLIDAY');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const [master, rows, logs, changes] = await Promise.all([api.adminTrainers.getCalendar(), api.adminTrainers.getCalendarCoaches(date), api.adminTrainers.getCalendarAudit(), api.adminTrainers.getCalendarChangeRequests()]);
    setCalendar(master.calendar); setMasterSlots(master.slots); setClosures(master.closures); setCoaches(rows); setAudit(logs); setRequests(changes);
  };
  useEffect(() => { void refresh().catch(error => setNotice(error.message)); }, [date]);
  const save = async (action: () => Promise<unknown>) => {
    setBusy(true); setNotice('');
    try { await action(); await refresh(); setNotice('Đã cập nhật lịch.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể cập nhật lịch.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">Lịch chung PT</h2><p className="text-sm text-muted-foreground">Coach tự đăng ký ca trong khung giờ này; ca hợp lệ được công bố ngay.</p></div>
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Giờ hoạt động</CardTitle><CardDescription>Ca PT cố định 60 phút, có thể thêm thời gian nghỉ giữa các ca.</CardDescription></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3"><label className="text-sm">Mở cửa<Input type="time" value={calendar.openTime} onChange={e => setCalendar(c => ({ ...c, openTime: e.target.value }))} /></label><label className="text-sm">Đóng cửa<Input type="time" value={calendar.closeTime} onChange={e => setCalendar(c => ({ ...c, closeTime: e.target.value }))} /></label><label className="text-sm">Nghỉ (phút)<Input type="number" min={0} max={60} value={calendar.breakMinutes} onChange={e => setCalendar(c => ({ ...c, breakMinutes: Number(e.target.value) }))} /></label></div>
        <Button disabled={busy} onClick={() => void save(() => api.adminTrainers.saveCalendar(calendar))}>Lưu lịch chung</Button>
        <div className="border-t pt-3"><p className="mb-2 text-sm font-semibold">Các ca theo lịch đang áp dụng ({masterSlots.length})</p><div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{masterSlots.map(slot => <span key={slot.startTime} className="rounded-lg border bg-amber-50 px-2 py-1 text-xs">{slot.startTime}–{slot.endTime}</span>)}</div><p className="mt-2 text-xs text-muted-foreground">Coach sẽ chọn trực tiếp những ô ca này trên lịch tuần.</p></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Ngày nghỉ / bảo trì</CardTitle><CardDescription>Không thể thêm thời gian trùng Booking PT đã xác nhận.</CardDescription></CardHeader><CardContent className="space-y-3">
        <select className="h-9 rounded-md border bg-background px-2" value={kind} onChange={e => setKind(e.target.value)}><option value="HOLIDAY">Ngày lễ</option><option value="CLOSED">Đóng cửa</option><option value="MAINTENANCE">Bảo trì</option></select>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Từ (giờ Việt Nam)<Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label className="text-sm">Đến<Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label></div>
        <Input placeholder="Lý do" value={reason} onChange={e => setReason(e.target.value)} />
        <Button disabled={busy || !start || !end || !reason.trim()} onClick={() => void save(() => api.adminTrainers.addClosure({ startAt: new Date(`${start}:00+07:00`).toISOString(), endAt: new Date(`${end}:00+07:00`).toISOString(), kind, reason }))}>Thêm thời gian đóng cửa</Button>
        <div className="max-h-44 space-y-2 overflow-auto">{closures.map(c => <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"><span>{c.kind} · {localInput(c.startAt).replace('T', ' ')}–{localInput(c.endAt).replace('T', ' ')} · {c.reason}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void save(() => api.adminTrainers.removeClosure(c.id))}>Xóa</Button></div>)}</div>
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Lịch tất cả Coach</CardTitle></CardHeader><CardContent className="space-y-3"><Input className="max-w-48" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <div className="grid gap-3 lg:grid-cols-2">{coaches.map(coach => <div key={coach.coachId} className="rounded-lg border p-3"><strong>{coach.coachName}</strong><span className="ml-2 text-xs text-muted-foreground">{coach.coachStatus}</span><div className="mt-2 flex flex-wrap gap-2">{coach.slots.length === 0 ? <span className="text-sm text-muted-foreground">Chưa đăng ký ca</span> : coach.slots.map(slot => <span key={slot.startTime} className={`rounded-md px-2 py-1 text-xs ${slot.booking ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900'}`}>{slot.startTime}–{slot.endTime} {slot.booking ? `· ${slot.booking.member.fullName}` : '· Trống'}</span>)}</div>{coach.bookings.filter(booking => !coach.slots.some(slot => slot.booking?.id === booking.id)).map(booking => <p key={booking.id} className="mt-2 text-xs text-red-700">Booking #{booking.id} · {new Date(booking.startTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {booking.memberName} (ngoài lịch rảnh)</p>)}</div>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Coach báo vắng / yêu cầu đổi ca</CardTitle><CardDescription>Ca đã có hội viên đặt chỉ thay đổi sau khi Admin xử lý. Duyệt báo vắng cấp quyền học bù cho hội viên.</CardDescription></CardHeader><CardContent className="space-y-2">{requests.filter(row => row.status === 'PENDING').length === 0 && <p className="text-sm text-muted-foreground">Không có yêu cầu chờ xử lý.</p>}{requests.filter(row => row.status === 'PENDING').map(row => <div key={row.id} className="rounded-md border p-3 text-sm"><p>{row.coachName || `Coach #${row.coachId}`} · {row.memberName || `Booking #${row.bookingId}`} · {row.startTime ? new Date(row.startTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''}</p><p className="text-muted-foreground">{row.reason}</p><Input className="mt-2" maxLength={500} placeholder="Ghi chú xử lý cho Coach" value={reviewNotes[row.id] || ''} onChange={e => setReviewNotes(current => ({ ...current, [row.id]: e.target.value }))} /><div className="mt-2 flex gap-2"><Button disabled={busy} size="sm" onClick={() => void save(() => api.adminTrainers.resolveCalendarChangeRequest(row.id, 'APPROVED', reviewNotes[row.id] || 'Đã duyệt báo vắng'))}>Duyệt báo vắng</Button><Button disabled={busy} size="sm" variant="outline" onClick={() => void save(() => api.adminTrainers.resolveCalendarChangeRequest(row.id, 'REJECTED', reviewNotes[row.id] || 'Yêu cầu chưa được chấp thuận'))}>Từ chối</Button></div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Nhật ký thay đổi lịch</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{audit.map(row => <p key={row.id} className="border-b py-1">{new Date(row.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {row.user.fullName} · {row.action}</p>)}</CardContent></Card>
  </div>;
}
