import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, MessageSquare, QrCode, RefreshCw, Save, UserRound, X } from 'lucide-react';
import { api, type ApiBooking, type ApiCoachProfile, type ApiCoachSchedule, type ApiGroupClassSchedule, type ApiProgressLog } from '../../services/api';
import type { CoachPlanDraft, CoachTraineeMembership, CoachWorkoutPlan } from '../../services/api/pt.api';
import { CoachPlanEditor, CoachSavedPlan } from './CoachPlanEditor';
import { CoachAvailabilityGrid } from './CoachAvailabilityGrid';
import { StaffPage } from '@/components/staff/StaffKit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type CoachProfile = ApiCoachProfile & { schedules: ApiCoachSchedule[] };
type Message = { id: number; senderId: number; content: string; createdAt: string; sender: { fullName: string } };

const gymDay = (value: string | Date) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 10);
const today = () => gymDay(new Date());
const gymTime = (value: string) => new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.';

const statusText: Record<string, string> = {
  PENDING: 'Chờ xác nhận', UPCOMING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang tập', COMPLETED: 'Hoàn thành', REJECTED: 'Đã từ chối',
  ABSENT_ELIGIBLE: 'Vắng, được học bù', ABSENT_NO_REFUND: 'Vắng, đã trừ buổi',
  ABSENT_EXCUSED: 'Vắng được điều chỉnh', MAKEUP_BOOKED: 'Đã đặt học bù', CANCELLED: 'Đã hủy',
};

interface CoachDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const CoachDashboard: React.FC<CoachDashboardProps> = ({ activeTab }) => {
  const currentUser = api.auth.getCurrentUser();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [trainees, setTrainees] = useState<CoachTraineeMembership[]>([]);
  const [plans, setPlans] = useState<CoachWorkoutPlan[]>([]);
  const [classes, setClasses] = useState<ApiGroupClassSchedule[]>([]);
  const [classQr, setClassQr] = useState<{ schedule: ApiGroupClassSchedule; image: string } | null>(null);
  const [classAttendees, setClassAttendees] = useState<Array<{ id: number; status: 'BOOKED' | 'CHECKED_IN'; user: { id: number; fullName: string } }>>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ inbodyLogs: ApiProgressLog[]; workoutLogs: any[] } | null>(null);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [qr, setQr] = useState<{ booking: ApiBooking; image: string } | null>(null);
  const [chatBooking, setChatBooking] = useState<ApiBooking | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [draft, setDraft] = useState('');
  const [finishBooking, setFinishBooking] = useState<ApiBooking | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [absenceBooking, setAbsenceBooking] = useState<ApiBooking | null>(null);
  const [absenceReason, setAbsenceReason] = useState('');

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.pt.getCoachWorkspace(),
      api.pt.getMyBookings(),
      api.pt.getCoachTrainees(),
      api.pt.getCoachPlans(),
    ]);
    if (results[0].status === 'fulfilled') {
      setProfile(results[0].value);
      setProfileError('');
    } else {
      setProfileError(errorText(results[0].reason));
    }
    if (results[1].status === 'fulfilled') setBookings(results[1].value);
    if (results[2].status === 'fulfilled') setTrainees(results[2].value);
    if (results[3].status === 'fulfilled') setPlans(results[3].value);
    const failed = results.slice(1).find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') setNotice(errorText(failed.reason));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (activeTab !== 'schedule') return;
    const timer = window.setInterval(() => {
      void api.pt.getMyBookings().then(setBookings).catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [activeTab]);
  useEffect(() => {
    if (!['schedule', 'workclass'].includes(activeTab) || !currentUser) return;
    setClasses([]);
    void api.groupClasses.getSchedules(date)
      .then(rows => setClasses(rows.filter(row => Number(row.trainerId) === Number(currentUser.id))))
      .catch(error => setNotice(errorText(error)));
  }, [activeTab, date, currentUser?.id]);
  useEffect(() => {
    if (!classQr) return;
    const scheduleId = classQr.schedule.id;
    const refresh = () => {
      void api.groupClasses.getAttendees(scheduleId).then(setClassAttendees).catch(error => setNotice(errorText(error)));
    };
    refresh();
    const attendeesTimer = window.setInterval(refresh, 10000);
    const qrTimer = window.setInterval(() => {
      void api.groupClasses.getCheckInQr(scheduleId)
        .then(result => setClassQr(current => current?.schedule.id === scheduleId ? { ...current, image: result.qrCodeImage } : current))
        .catch(error => { setNotice(errorText(error)); setClassQr(null); });
    }, 60000);
    return () => { window.clearInterval(attendeesTimer); window.clearInterval(qrTimer); };
  }, [classQr?.schedule.id]);
  useEffect(() => {
    if (activeTab !== 'workclass') return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [activeTab]);
  useEffect(() => {
    if (!selectedMemberId) { setProgress(null); return; }
    void api.workouts.getMemberProgress(selectedMemberId)
      .then(setProgress).catch(error => setNotice(errorText(error)));
  }, [selectedMemberId]);
  const run = async (action: () => Promise<unknown>, success: string, refresh = true) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice(success);
      if (refresh) await load();
      return true;
    } catch (error) {
      setNotice(errorText(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openClassQr = async (schedule: ApiGroupClassSchedule) => {
    setBusy(true);
    setNotice('');
    try {
      const result = await api.groupClasses.getCheckInQr(schedule.id);
      setClassAttendees([]);
      setClassQr({ schedule, image: result.qrCodeImage });
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const openChat = async (booking: ApiBooking) => {
    setChatBooking(booking);
    setMessages([]);
    setDraft('');
    try {
      const result = await api.pt.getBookingMessages(booking.id);
      setMessages(result.data);
      setCanSend(result.canSend);
    } catch (error) {
      setChatBooking(null);
      setNotice(errorText(error));
    }
  };

  const sendMessage = async () => {
    if (!chatBooking || !draft.trim()) return;
    const sent = await run(() => api.pt.sendBookingMessage(chatBooking.id, draft.trim()), 'Đã gửi tin nhắn.', false);
    if (sent) {
      setDraft('');
      try {
        const result = await api.pt.getBookingMessages(chatBooking.id);
        setMessages(result.data);
        setCanSend(result.canSend);
      } catch (error) {
        setNotice(errorText(error));
      }
    }
  };

  const saveSession = async () => {
    if (!finishBooking) return;
    if (finishBooking.status === 'COMPLETED' && !sessionNotes.trim() && !exerciseName.trim()) {
      setNotice('Nhập nhận xét hoặc bài tập để ghi nhật ký.');
      return;
    }
    setBusy(true);
    setNotice('');
    let completed = finishBooking.status === 'COMPLETED';
    try {
      if (!completed) {
        await api.pt.completeSession(finishBooking.id);
        completed = true;
      }
      const exercises = exerciseName.trim() && Number(sets) > 0 && Number(reps) > 0
        ? [{ exerciseName: exerciseName.trim(), sets: Number(sets), reps: Number(reps) }]
        : [];
      if (sessionNotes.trim() || exercises.length > 0) {
        await api.workouts.logSessionResult({
          bookingId: finishBooking.id,
          notes: sessionNotes.trim(),
          durationMin: Math.max(1, Math.round((new Date(finishBooking.endTime).getTime() - new Date(finishBooking.startTime).getTime()) / 60000)),
          exercises,
        });
      }
      setFinishBooking(null);
      setNotice('Đã kết thúc buổi PT và cập nhật số buổi trong gói.');
    } catch (error) {
      setNotice(completed ? `Buổi đã kết thúc, nhưng chưa lưu được nhật ký: ${errorText(error)}` : errorText(error));
      if (completed) setFinishBooking({ ...finishBooking, status: 'COMPLETED' });
    } finally {
      await load();
      setBusy(false);
    }
  };

  const savePlan = (draft: CoachPlanDraft) =>
    run(() => api.pt.createCoachPlan(draft), 'Đã lưu giáo án và thực đơn cho học viên.');

  const saveInBody = async () => {
    if (!selectedMemberId || !Number.isFinite(Number(weight)) || Number(weight) <= 0) {
      setNotice('Nhập cân nặng hợp lệ.');
      return;
    }
    const saved = await run(() => api.workouts.logInBody({
      memberId: selectedMemberId,
      weight: Number(weight),
      ...(bodyFat ? { bodyFat: Number(bodyFat) } : {}),
      ...(muscleMass ? { muscleMass: Number(muscleMass) } : {}),
    }), 'Đã lưu chỉ số InBody.', false);
    if (saved) {
      try {
        setProgress(await api.workouts.getMemberProgress(selectedMemberId));
      } catch (error) {
        setNotice(`Đã lưu InBody nhưng chưa tải lại tiến độ: ${errorText(error)}`);
      }
      setWeight(''); setBodyFat(''); setMuscleMass('');
    }
  };

  const dayBookings = bookings.filter(booking => gymDay(booking.startTime) === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const pending = bookings.filter(booking => ['PENDING', 'UPCOMING'].includes(booking.status) && new Date(booking.startTime) > new Date());
  const selectedTrainee = trainees.find(row => row.userId === selectedMemberId);

  return (
    <StaffPage>
      <div className="space-y-5">
        <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile?.user?.fullName || currentUser?.fullName || 'Quản lý Coach'}</h1>
            <p className="text-sm text-muted-foreground">
              {profile ? `${profile.specialization || 'Chưa cập nhật chuyên môn'} · ${profile.status === 'ACTIVE' ? 'Đang nhận lịch' : 'Hồ sơ chưa hoạt động'}` : profileError || 'Đang tải hồ sơ Coach...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {profile && <Badge variant="outline">{Number(profile.hourlyRate).toLocaleString('vi-VN')} đ / buổi</Badge>}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}><RefreshCw className="size-4" /> Tải lại</Button>
          </div>
        </CardContent></Card>

        {notice && <div role="status" className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">{notice}</div>}

        {activeTab === 'schedule' && <div className="space-y-5">
          {pending.length > 0 && <Card><CardHeader><CardTitle>Yêu cầu đặt lịch chờ duyệt ({pending.length})</CardTitle></CardHeader><CardContent className="space-y-3">
            {pending.map(booking => <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="text-sm"><strong>{booking.member?.fullName || `Hội viên #${booking.memberId}`}</strong><p className="text-muted-foreground">{gymDay(booking.startTime)} · {gymTime(booking.startTime)}–{gymTime(booking.endTime)}</p></div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => void run(() => api.pt.updateBookingStatus(booking.id, 'CONFIRMED'), 'Đã xác nhận lịch PT.')}><Check className="size-4" /> Xác nhận</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api.pt.updateBookingStatus(booking.id, 'REJECTED'), 'Đã từ chối lịch PT.')}><X className="size-4" /> Từ chối</Button>
              </div>
            </div>)}
          </CardContent></Card>}
          <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5" /> Lịch dạy PT</CardTitle><CardDescription>Chọn ngày để xem ca PT và lớp nhóm được phân công.</CardDescription></div><Input type="date" className="w-44" value={date} onChange={event => setDate(event.target.value)} /></div></CardHeader>
            <CardContent className="space-y-3">
              {dayBookings.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Không có buổi PT trong ngày này.</p>}
              {dayBookings.map(booking => {
                const canQr = booking.status === 'CONFIRMED' && Date.now() >= new Date(booking.startTime).getTime() - 15 * 60000 && Date.now() <= new Date(booking.endTime).getTime();
                const canAbsence = booking.status === 'CONFIRMED' && Date.now() < new Date(booking.startTime).getTime();
                return <div key={booking.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{booking.member?.fullName || `Hội viên #${booking.memberId}`}</strong><p className="text-sm text-muted-foreground">{gymTime(booking.startTime)}–{gymTime(booking.endTime)} · {booking.membership?.package?.name || 'Gói PT'}</p></div><Badge variant="outline">{statusText[booking.status] || booking.status}</Badge></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {booking.status === 'CONFIRMED' && <Button size="sm" disabled={!canQr || busy} onClick={() => void run(async () => { const result = await api.pt.generateSessionQr(booking.id); setQr({ booking, image: result.data.qrCodeImage }); }, 'Đã tạo mã QR. Hội viên dùng ứng dụng để quét.', false)}><QrCode className="size-4" /> Tạo QR</Button>}
                    {['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && Date.now() < new Date(booking.endTime).getTime() && <Button size="sm" variant="outline" onClick={() => void openChat(booking)}><MessageSquare className="size-4" /> Nhắn tin</Button>}
                    {canAbsence && <Button size="sm" variant="outline" onClick={() => { setAbsenceReason(''); setAbsenceBooking(booking); }}>Báo vắng</Button>}
                    {booking.status === 'IN_PROGRESS' && <Button size="sm" onClick={() => { setFinishBooking(booking); setSessionNotes(''); }}>Kết thúc buổi</Button>}
                    {booking.status === 'COMPLETED' && !booking.sessionResult && <Button size="sm" variant="outline" onClick={() => { setFinishBooking(booking); setSessionNotes(''); }}>Ghi nhật ký</Button>}
                  </div>
                  {booking.status === 'CONFIRMED' && !canQr && <p className="mt-2 text-xs text-muted-foreground">Mã QR mở từ 15 phút trước giờ tập đến hết ca.</p>}
                </div>;
              })}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Lớp học nhóm được phân công</CardTitle></CardHeader><CardContent className="space-y-2">
            {classes.length === 0 ? <p className="text-sm text-muted-foreground">Không có lớp nhóm trong ngày này.</p> : classes.map(item => <div key={item.id} className="flex justify-between rounded-lg border p-3 text-sm"><span>{item.groupClass.name} · {item.room?.name || 'Chưa xếp phòng'}</span><span>{gymTime(item.startTime)}–{gymTime(item.endTime)} · {item.bookedCount}/{item.capacity}</span></div>)}
          </CardContent></Card>
        </div>}

        {activeTab === 'workclass' && <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><CardTitle className="flex items-center gap-2"><QrCode className="size-5" /> Workclass · Lớp học nhóm</CardTitle><CardDescription>Hiển thị QR của ca học để hội viên đã đặt chỗ quét bằng ứng dụng mobile.</CardDescription></div>
              <Input type="date" className="w-44" value={date} onChange={event => setDate(event.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Không có lớp nhóm được phân công trong ngày này.</p>}
            {classes.map(schedule => {
              const canShowQr = ['OPEN', 'FULL'].includes(schedule.status) && nowMs >= new Date(schedule.startTime).getTime() - 15 * 60000 && nowMs <= new Date(schedule.endTime).getTime();
              return <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
                <div>
                  <strong className="text-sm">{schedule.groupClass.name}</strong>
                  <p className="text-sm text-muted-foreground">{gymTime(schedule.startTime)}–{gymTime(schedule.endTime)} · {schedule.room?.name || 'Chưa xếp phòng'}</p>
                  <p className="text-xs text-muted-foreground">Đã đặt {schedule.bookedCount}/{schedule.capacity} chỗ · {schedule.status === 'FULL' ? 'Đã đủ chỗ' : 'Đang mở'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <Button size="sm" disabled={!canShowQr || busy} onClick={() => void openClassQr(schedule)}><QrCode className="size-4" /> Hiển thị QR điểm danh</Button>
                  {!canShowQr && <p className="text-xs text-muted-foreground">Mở từ 15 phút trước giờ học đến hết ca</p>}
                </div>
              </div>;
            })}
          </CardContent>
        </Card>}

        {activeTab === 'trainees' && <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-5" /> Học viên PT phụ trách</CardTitle></CardHeader><CardContent className="space-y-2">
            {trainees.length === 0 && <p className="text-sm text-muted-foreground">Chưa có học viên nào được phân gói PT.</p>}
            {trainees.map(row => <button key={row.id} type="button" onClick={() => setSelectedMemberId(row.userId)} className={`w-full rounded-lg border p-3 text-left text-sm hover:border-primary ${selectedMemberId === row.userId ? 'border-primary bg-primary/5' : ''}`}>
              <strong>{row.user.fullName}</strong><p className="text-muted-foreground">{row.package.name} · Còn {row.remainingSessions ?? '—'} buổi · {row.status}</p>
              <p className="text-xs text-muted-foreground">{row.user.phone || row.user.email}</p>
            </button>)}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>{selectedTrainee ? `Tiến độ: ${selectedTrainee.user.fullName}` : 'Chọn học viên để xem tiến độ'}</CardTitle></CardHeader><CardContent className="space-y-4">
            {selectedTrainee && <><div className="space-y-2"><h3 className="text-sm font-semibold">Chỉ số InBody gần đây</h3>
              {!progress && <p className="text-sm text-muted-foreground">Đang tải tiến độ...</p>}
              {progress?.inbodyLogs.length === 0 && <p className="text-sm text-muted-foreground">Chưa có chỉ số InBody.</p>}
              {progress?.inbodyLogs.map(log => <div key={log.id} className="rounded-lg border p-2 text-sm">{gymDay(log.loggedAt)} · {log.weight} kg · Mỡ {log.bodyFat ?? '—'}% · Cơ {log.muscleMass ?? '—'} kg</div>)}
            </div><div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Ghi chỉ số mới</h3><div className="grid grid-cols-3 gap-2"><Input type="number" placeholder="Cân nặng kg" value={weight} onChange={e => setWeight(e.target.value)} /><Input type="number" placeholder="Mỡ %" value={bodyFat} onChange={e => setBodyFat(e.target.value)} /><Input type="number" placeholder="Cơ kg" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} /></div><Button size="sm" disabled={busy} onClick={() => void saveInBody()}><Save className="size-4" /> Lưu InBody</Button></div>
              <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Buổi PT hoàn thành</h3>{progress?.workoutLogs.length === 0 && <p className="text-sm text-muted-foreground">Chưa có nhật ký buổi tập.</p>}{progress?.workoutLogs.map(row => <div key={row.id} className="rounded-lg border p-2 text-sm">{gymDay(row.startTime)} · {row.sessionResult?.notes || 'Chưa ghi nhật ký'}</div>)}</div>
            </>}
          </CardContent></Card>
        </div>}

        {activeTab === 'ai-workout' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card><CardHeader><CardTitle>Giáo án & Dinh dưỡng</CardTitle><CardDescription>Lên bài tập theo buổi và bữa ăn theo ngày cho học viên được phân công.</CardDescription></CardHeader><CardContent>
            <CoachPlanEditor trainees={[...new Map(trainees.map(row => [row.userId, row])).values()].map(row => ({ id: row.userId, name: row.user.fullName }))} busy={busy} onSave={savePlan} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Giáo án đã lưu</CardTitle></CardHeader><CardContent className="max-h-[48rem] space-y-2 overflow-y-auto">
            {plans.length === 0 && <p className="text-sm text-muted-foreground">Chưa có giáo án nào.</p>}
            {plans.map(plan => <CoachSavedPlan key={plan.id} plan={plan} />)}
          </CardContent></Card>
        </div>}

        {activeTab === 'availability' && <CoachAvailabilityGrid onSaved={() => void load()} />}
      </div>

      <Dialog open={!!classQr} onOpenChange={open => { if (!open) setClassQr(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Điểm danh Workclass · {classQr?.schedule.groupClass.name}</DialogTitle></DialogHeader>
          {classQr && <div className="space-y-4">
            <div className="grid justify-items-center gap-2">
              <p className="text-sm text-muted-foreground">{gymTime(classQr.schedule.startTime)}–{gymTime(classQr.schedule.endTime)} · {classQr.schedule.room?.name || 'Phòng học nhóm'}</p>
              <img src={classQr.image} alt="Mã QR điểm danh lớp nhóm" className="size-56 rounded-lg border bg-white p-2" />
              <p className="text-center text-xs text-muted-foreground">Mã được tự làm mới mỗi 60 giây. Hội viên mở Workclass trên mobile và quét mã này.</p>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void openClassQr(classQr.schedule)}><RefreshCw className="size-4" /> Tạo mã mới</Button>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto border-t pt-3">
              <p className="text-sm font-semibold">Đã điểm danh {classAttendees.filter(row => row.status === 'CHECKED_IN').length}/{classAttendees.length}</p>
              {classAttendees.length === 0 && <p className="text-xs text-muted-foreground">Chưa có hội viên đặt lớp.</p>}
              {classAttendees.map(row => <div key={row.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>{row.user.fullName}</span><Badge variant="outline">{row.status === 'CHECKED_IN' ? 'Đã điểm danh' : 'Đã đặt chỗ'}</Badge></div>)}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!qr} onOpenChange={open => { if (!open) setQr(null); }}><DialogContent><DialogHeader><DialogTitle>Mã QR buổi PT</DialogTitle></DialogHeader><div className="grid justify-items-center gap-3 py-4">{qr && <><p className="text-sm">{qr.booking.member?.fullName} · {gymTime(qr.booking.startTime)}</p><img src={qr.image} alt="Mã QR điểm danh PT" className="size-56" /><p className="text-xs text-muted-foreground">Mã có hiệu lực 90 giây. Hội viên quét bằng ứng dụng mobile.</p></>}</div></DialogContent></Dialog>
      <Dialog open={!!chatBooking} onOpenChange={open => { if (!open) setChatBooking(null); }}><DialogContent><DialogHeader><DialogTitle>Nhắn tin với {chatBooking?.member?.fullName}</DialogTitle></DialogHeader><div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">{messages.length === 0 && <p className="text-sm text-muted-foreground">Chưa có tin nhắn.</p>}{messages.map(message => <div key={message.id} className="text-sm"><strong>{message.sender.fullName}: </strong>{message.content}</div>)}</div>{canSend ? <div className="flex gap-2"><Input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void sendMessage(); }} placeholder="Nhập tin nhắn" maxLength={1000} /><Button disabled={busy || !draft.trim()} onClick={() => void sendMessage()}>Gửi</Button></div> : <p className="text-sm text-muted-foreground">Đã hết thời gian nhắn tin của buổi PT.</p>}</DialogContent></Dialog>
      <Dialog open={!!finishBooking} onOpenChange={open => { if (!open) setFinishBooking(null); }}><DialogContent><DialogHeader><DialogTitle>{finishBooking?.status === 'COMPLETED' ? 'Ghi nhật ký buổi PT' : 'Kết thúc buổi PT'}</DialogTitle></DialogHeader><div className="space-y-3"><Textarea rows={4} placeholder="Nhận xét buổi tập" value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} /><div className="grid grid-cols-3 gap-2"><Input placeholder="Bài tập" value={exerciseName} onChange={e => setExerciseName(e.target.value)} /><Input type="number" placeholder="Số hiệp" value={sets} onChange={e => setSets(e.target.value)} /><Input type="number" placeholder="Số lần" value={reps} onChange={e => setReps(e.target.value)} /></div><p className="text-xs text-muted-foreground">Kết thúc buổi sẽ trừ 1 lượt PT. Nhật ký có thể ghi sau nếu chưa có nội dung.</p></div><DialogFooter><Button disabled={busy} onClick={() => void saveSession()}>{finishBooking?.status === 'COMPLETED' ? 'Lưu nhật ký' : 'Kết thúc và lưu'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!absenceBooking} onOpenChange={open => { if (!open) setAbsenceBooking(null); }}><DialogContent><DialogHeader><DialogTitle>Coach báo vắng buổi PT</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Yêu cầu sẽ chuyển đến Admin. Sau khi duyệt, hội viên được đặt học bù trong 7 ngày và không bị trừ buổi.</p><Textarea rows={3} placeholder="Lý do báo vắng" value={absenceReason} onChange={e => setAbsenceReason(e.target.value)} /><DialogFooter><Button disabled={busy} onClick={() => { if (!absenceBooking) return; void run(() => api.pt.markAbsent(absenceBooking.id, absenceReason), 'Đã gửi yêu cầu cho Admin.').then(saved => { if (saved) setAbsenceBooking(null); }); }}>Gửi yêu cầu</Button></DialogFooter></DialogContent></Dialog>
    </StaffPage>
  );
};
