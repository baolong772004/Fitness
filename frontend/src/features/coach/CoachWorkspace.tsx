import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, FileText, LoaderCircle, MessageSquare, QrCode, RefreshCw, Save, Search, SendHorizontal, UserRound } from 'lucide-react';
import { api, type ApiBooking, type ApiCoachProfile, type ApiCoachSchedule, type ApiGroupClassSchedule, type ApiProgressLog } from '../../services/api';
import type { CoachPlanDraft, CoachTraineeMembership, CoachWorkoutPlan } from '../../services/api/pt.api';
import { CoachPlanEditor, CoachSavedPlan } from './CoachPlanEditor';
import { CoachPtAssessments } from './CoachPtAssessments';
import { CoachSharedExerciseAnalyses } from './CoachSharedExerciseAnalyses';
import type { PtTrainingAssessment } from '../../services/api/workoutLog.api';
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
  const [planSearch, setPlanSearch] = useState('');
  const [showUnassignedPlans, setShowUnassignedPlans] = useState(false);
  const [showArchivedPlans, setShowArchivedPlans] = useState(false);
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
  const [progress, setProgress] = useState<{ inbodyLogs: ApiProgressLog[]; workoutLogs: any[]; assessments: PtTrainingAssessment[]; trainingPolicy: Record<PtTrainingAssessment['level'], { reviewEverySessions: number }> } | null>(null);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [qr, setQr] = useState<{ booking: ApiBooking; image: string } | null>(null);
  const [chatBooking, setChatBooking] = useState<ApiBooking | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [draft, setDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
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
    setProgress(null);
    void api.workouts.getMemberProgress(selectedMemberId)
      .then(setProgress).catch(error => setNotice(errorText(error)));
  }, [selectedMemberId]);
  useEffect(() => {
    if (chatBooking && !chatLoading) {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
    }
  }, [chatBooking?.id, chatLoading, messages.length]);

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
    setCanSend(false);
    setChatError('');
    setChatLoading(true);
    try {
      const result = await api.pt.getBookingMessages(booking.id);
      setMessages(result.data);
      setCanSend(result.canSend);
    } catch (error) {
      setChatError(errorText(error));
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatBooking || !canSend || busy || !draft.trim()) return;
    setBusy(true);
    setChatError('');
    try {
      await api.pt.sendBookingMessage(chatBooking.id, draft.trim());
      setDraft('');
      const result = await api.pt.getBookingMessages(chatBooking.id);
      setMessages(result.data);
      setCanSend(result.canSend);
    } catch (error) {
      setChatError(errorText(error));
    } finally {
      setBusy(false);
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
    run(() => api.pt.createCoachPlan(draft), 'Đã lưu giáo án mẫu.');

  const mutatePlan = async (work: () => Promise<{ data: CoachWorkoutPlan }>, success: string) => {
    setBusy(true);
    try {
      const { data: updated } = await work();
      setPlans(rows => [...rows.filter(row => row.kind !== updated.kind || row.id !== updated.id).map(row =>
        updated.status === 'ACTIVE' && row.kind === 'ASSIGNED' && row.memberId === updated.memberId && row.coachId === updated.coachId && row.programName === updated.programName
          ? { ...row, status: 'ARCHIVED' as const } : row), updated]);
      setNotice(success);
      await load();
      return true;
    } finally { setBusy(false); }
  };

  const assignPlan = (plan: CoachWorkoutPlan, memberId: number, programName: string) =>
    mutatePlan(() => api.pt.assignCoachPlan(plan.id, memberId, programName), 'Đã gán giáo án riêng cho học viên.');
  const updatePlan = (plan: CoachWorkoutPlan, draft: CoachPlanDraft) =>
    mutatePlan(() => api.pt.updateStudentPlan(plan.id, draft, plan.version!), 'Đã cập nhật giáo án và thông báo cho học viên.');
  const restorePlan = (plan: CoachWorkoutPlan, revisionId: number, reason: string) =>
    mutatePlan(() => api.pt.restoreStudentPlan(plan.id, revisionId, plan.version!, reason), 'Đã khôi phục giáo án thành phiên bản mới.');

  const generatePlan = (memberId: number | null, request: string) => api.pt.generateCoachPlan(memberId, request);
  const savedPlanActions = { onAssign: assignPlan, onUpdate: updatePlan, onRestore: restorePlan,
    onHistory: (plan: CoachWorkoutPlan) => api.pt.getStudentPlanRevisions(plan.id), onGenerate: generatePlan };

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

  const saveAssessment = async (draft: Parameters<typeof api.workouts.createPtAssessment>[0]) => {
    const saved = await run(() => api.workouts.createPtAssessment(draft), 'Đã lưu đánh giá lộ trình PT.', false);
    if (saved) {
      try { setProgress(await api.workouts.getMemberProgress(draft.memberId)); }
      catch (error) { setNotice(`Đã lưu đánh giá nhưng chưa tải lại tiến độ: ${errorText(error)}`); }
    }
    return saved;
  };

  const dayBookings = bookings.filter(booking => gymDay(booking.startTime) === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const selectedTrainee = trainees.find(row => row.userId === selectedMemberId);
  const assignableTrainees = [...new Map(trainees.map(row => [row.user.id, row.user])).values()];
  const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi-VN');
  const unassignedPlans = plans.filter(plan => plan.memberId == null && !plan.member);
  const assignedPlans = plans.filter(plan => plan.memberId != null || !!plan.member);
  const matchingPlans = assignedPlans.filter(plan => normalizeSearch(`${plan.title} ${plan.member?.fullName || ''} ${plan.programName || ''}`).includes(normalizeSearch(planSearch.trim())));
  const filteredAssignedPlans = matchingPlans.filter(plan => plan.status !== 'ARCHIVED');
  const archivedPlans = matchingPlans.filter(plan => plan.status === 'ARCHIVED');

  return (
    <StaffPage>
      <div className="space-y-5">
        <Card className="gap-0 py-0"><CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">{(profile?.user?.fullName || currentUser?.fullName || 'PT').trim().split(/\s+/).map(word => word[0]).slice(-2).join('')}</span>
            <div className="min-w-0"><h1 className="truncate text-base font-semibold text-foreground">{profile?.user?.fullName || currentUser?.fullName || 'Quản lý Coach'}</h1>
            <p className="text-sm text-muted-foreground">
              {profile ? <span className="inline-flex items-center gap-1.5 text-xs"><span className={`size-1.5 rounded-full ${profile.status === 'ACTIVE' ? 'bg-success' : 'bg-muted-foreground'}`} />{profile.status === 'ACTIVE' ? 'Đang nhận lịch' : 'Hồ sơ chưa hoạt động'}</span> : profileError || 'Đang tải hồ sơ Coach...'}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && <Badge variant="outline">{Number(profile.hourlyRate).toLocaleString('vi-VN')} đ / buổi</Badge>}
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading || busy}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Tải lại</Button>
          </div>
        </CardContent></Card>

        {notice && <div role="status" className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">{notice}</div>}

        {activeTab === 'schedule' && <div className="space-y-5">
          <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5" /> Lịch dạy PT</CardTitle><CardDescription>Chọn ngày để xem ca PT và lớp nhóm được phân công.</CardDescription></div><Input type="date" className="w-44" value={date} onChange={event => setDate(event.target.value)} /></div></CardHeader>
            <CardContent className="space-y-3">
              {dayBookings.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Không có buổi PT trong ngày này.</p>}
              {dayBookings.map(booking => {
                const canQr = booking.status === 'CONFIRMED' && Date.now() >= new Date(booking.startTime).getTime() - 15 * 60000 && Date.now() <= new Date(booking.endTime).getTime();
                const canAbsence = booking.status === 'CONFIRMED' && Date.now() < new Date(booking.startTime).getTime();
                return <div key={booking.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{booking.member?.fullName || `Hội viên #${booking.memberId}`}</strong><p className="text-sm text-muted-foreground">{gymTime(booking.startTime)}–{gymTime(booking.endTime)} · {booking.ptCreditAllocation?.batch?.level ? `PT ${booking.ptCreditAllocation.batch.level}` : booking.membership?.package?.name || 'PT lịch sử'}</p></div><Badge variant="outline">{statusText[booking.status] || booking.status}</Badge></div>
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

        {activeTab === 'trainees' && <div className="space-y-5"><CoachSharedExerciseAnalyses /><div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-5" /> Học viên PT phụ trách</CardTitle></CardHeader><CardContent className="space-y-2">
            {trainees.length === 0 && <p className="text-sm text-muted-foreground">Chưa có học viên nào được phân gói PT.</p>}
            {trainees.map(row => <button key={row.id} type="button" onClick={() => setSelectedMemberId(row.userId)} className={`w-full rounded-lg border p-3 text-left text-sm hover:border-primary ${selectedMemberId === row.userId ? 'border-primary bg-primary/5' : ''}`}>
              <strong>{row.user.fullName}</strong><p className="text-muted-foreground">{row.package.name} · {row.level === 'BEGINNER' ? 'Cơ bản' : row.level === 'INTERMEDIATE' ? 'Trung cấp' : row.level === 'ADVANCED' ? 'Nâng cao' : row.level || 'Chưa rõ cấp'} · Còn {row.remainingSessions ?? '—'} buổi · {row.status}</p>
              <p className="text-xs text-muted-foreground">{row.user.phone || row.user.email}</p>
            </button>)}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>{selectedTrainee ? `Tiến độ: ${selectedTrainee.user.fullName}` : 'Chọn học viên để xem tiến độ'}</CardTitle></CardHeader><CardContent className="space-y-4">
            {selectedTrainee && <>{bookings.find(booking => booking.memberId === selectedTrainee.userId && ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'].includes(booking.ptCreditAllocation?.batch.source ?? '')) && <Button variant="outline" onClick={() => { const booking = bookings.find(item => item.memberId === selectedTrainee.userId && ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'].includes(item.ptCreditAllocation?.batch.source ?? '')); if (booking) void openChat(booking); }}><MessageSquare className="size-4" /> Chat hỗ trợ học viên Paid</Button>}<CoachPtAssessments trainee={selectedTrainee} assessments={progress?.assessments ?? []} workoutLogs={progress?.workoutLogs ?? []} reviewEverySessions={selectedTrainee.level === 'BEGINNER' || selectedTrainee.level === 'INTERMEDIATE' || selectedTrainee.level === 'ADVANCED' ? progress?.trainingPolicy?.[selectedTrainee.level]?.reviewEverySessions : undefined} busy={busy || !progress} onSave={saveAssessment} /><div className="space-y-2"><h3 className="text-sm font-semibold">Chỉ số InBody gần đây</h3>
              {!progress && <p className="text-sm text-muted-foreground">Đang tải tiến độ...</p>}
              {progress?.inbodyLogs.length === 0 && <p className="text-sm text-muted-foreground">Chưa có chỉ số InBody.</p>}
              {progress?.inbodyLogs.map(log => <div key={log.id} className="rounded-lg border p-2 text-sm">{gymDay(log.loggedAt)} · {log.weight} kg · Mỡ {log.bodyFat ?? '—'}% · Cơ {log.muscleMass ?? '—'} kg</div>)}
            </div><div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Ghi chỉ số mới</h3><div className="grid grid-cols-3 gap-2"><Input type="number" placeholder="Cân nặng kg" value={weight} onChange={e => setWeight(e.target.value)} /><Input type="number" placeholder="Mỡ %" value={bodyFat} onChange={e => setBodyFat(e.target.value)} /><Input type="number" placeholder="Cơ kg" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} /></div><Button size="sm" disabled={busy} onClick={() => void saveInBody()}><Save className="size-4" /> Lưu InBody</Button></div>
              <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Buổi PT hoàn thành</h3>{progress?.workoutLogs.length === 0 && <p className="text-sm text-muted-foreground">Chưa có nhật ký buổi tập.</p>}{progress?.workoutLogs.map(row => <div key={row.id} className="rounded-lg border p-2 text-sm">{gymDay(row.startTime)} · {row.sessionResult?.notes || 'Chưa ghi nhật ký'}</div>)}</div>
            </>}
          </CardContent></Card>
        </div></div>}

        {activeTab === 'ai-workout' && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="min-w-0 gap-0 overflow-hidden py-0"><CardHeader className="border-b px-4 py-4 sm:px-5 [.border-b]:pb-4"><CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4 text-primary" />Soạn giáo án</CardTitle></CardHeader><CardContent className="p-4 sm:p-5">
            <CoachPlanEditor busy={busy} onSave={savePlan} onGenerate={generatePlan} trainees={[...new Map(trainees.map(row => [row.userId, { id: row.userId, fullName: row.user.fullName, level: row.level }])).values()]} />
          </CardContent></Card>
          <Card className="min-w-0 gap-4 py-5"><CardHeader className="gap-4 px-4 sm:px-5">
            <div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Giáo án đã lưu</CardTitle><Badge variant="secondary" className="tabular-nums">{plans.length}</Badge></div>
            <Button type="button" variant="outline" className="h-11 w-full justify-start gap-2.5 bg-primary/5 px-3 text-left shadow-none" aria-expanded={showUnassignedPlans} aria-controls="coach-unassigned-plans" onClick={() => setShowUnassignedPlans(open => !open)}>
              <FileText className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">Giáo án chưa gán</span><Badge variant="secondary" className="tabular-nums">{unassignedPlans.length}</Badge><ChevronDown className={`size-4 text-muted-foreground transition-transform ${showUnassignedPlans ? 'rotate-180' : ''}`} />
            </Button>
          </CardHeader><CardContent className="max-h-[42rem] space-y-4 overflow-y-auto px-4 sm:px-5">
            <div id="coach-unassigned-plans" hidden={!showUnassignedPlans} className="space-y-2 border-b pb-4">
              {unassignedPlans.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">Không có giáo án chưa gán.</p>}
              {unassignedPlans.map(plan => <CoachSavedPlan key={`template-${plan.id}`} plan={plan} trainees={assignableTrainees} busy={busy} {...savedPlanActions} />)}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">Đang áp dụng</h3><span className="text-xs text-muted-foreground tabular-nums">{assignedPlans.filter(plan => plan.status !== 'ARCHIVED').length}</span></div>
              <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 pl-9" placeholder="Tìm giáo án đã gán, học viên..." aria-label="Tìm giáo án đã gán" value={planSearch} onChange={event => setPlanSearch(event.target.value)} /></div>
              {filteredAssignedPlans.length === 0 && <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{!planSearch.trim() ? 'Chưa có giáo án đang áp dụng.' : 'Không tìm thấy giáo án phù hợp.'}</p>}
              {filteredAssignedPlans.map(plan => <CoachSavedPlan key={`assigned-${plan.id}`} plan={plan} trainees={assignableTrainees} busy={busy} {...savedPlanActions} />)}
              <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground" aria-expanded={showArchivedPlans} aria-controls="coach-archived-plans" onClick={() => setShowArchivedPlans(value => !value)}>Giáo án cũ ({archivedPlans.length})<ChevronDown className={`size-4 transition-transform ${showArchivedPlans ? 'rotate-180' : ''}`} /></Button>
              <div id="coach-archived-plans" hidden={!showArchivedPlans} className="space-y-2">{archivedPlans.map(plan => <CoachSavedPlan key={`archived-${plan.id}`} plan={plan} trainees={assignableTrainees} busy={busy} {...savedPlanActions} />)}{archivedPlans.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Chưa có giáo án cũ phù hợp.</p>}</div>
            </div>
          </CardContent></Card>
        </div>}

        {activeTab === 'availability' && <div className="space-y-5">
          <CoachAvailabilityGrid onSaved={() => { void load(); }} />
          <Card><CardHeader><CardTitle>Hồ sơ PT</CardTitle><CardDescription>Admin cấu hình thông tin Coach; bạn tự chọn ca rảnh trong giờ hoạt động ở lịch phía trên.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-x-8 gap-y-2 text-sm"><p>Chuyên môn: {profile?.specialization || 'Chưa cập nhật'}</p><p>Kinh nghiệm: {profile?.experience ?? '—'} năm</p><p>Giá mỗi buổi: {profile ? `${Number(profile.hourlyRate).toLocaleString('vi-VN')} đ` : 'Chưa cập nhật'}</p></CardContent></Card>
        </div>}
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
      <Dialog open={!!chatBooking} onOpenChange={open => { if (!open) setChatBooking(null); }}>
        <DialogContent className="grid h-[min(680px,calc(100dvh-2rem))] w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-border/70 bg-card p-0 shadow-2xl sm:max-w-xl">
          <DialogHeader className="border-b border-border/70 px-5 py-5 pr-12 text-left sm:px-6 sm:pr-12">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary" aria-hidden="true">
                {chatBooking?.member?.fullName?.trim().charAt(0).toUpperCase() || 'H'}
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Hội thoại PT</p>
                <DialogTitle className="truncate text-lg leading-tight">{chatBooking?.member?.fullName || 'Hội viên'}</DialogTitle>
                {chatBooking && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" /> Buổi tập {new Date(chatBooking.startTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' })} · {gymTime(chatBooking.startTime)}–{gymTime(chatBooking.endTime)}</p>}
              </div>
            </div>
          </DialogHeader>

          <div ref={chatScrollRef} role="log" aria-label="Lịch sử tin nhắn PT" className="min-h-0 space-y-4 overflow-y-auto overscroll-contain bg-muted/40 px-4 py-5 sm:px-6">
            {chatLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />Đang tải tin nhắn...</div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageSquare className="size-7" aria-hidden="true" /></div>
                <div><p className="font-semibold">Chưa có tin nhắn</p><p className="mt-1 text-sm text-muted-foreground">Bắt đầu cuộc trò chuyện với hội viên tại đây.</p></div>
              </div>
            ) : messages.map((message, index) => {
              const isMine = Number(message.senderId) === Number(currentUser?.id);
              const showDay = index === 0 || gymDay(message.createdAt) !== gymDay(messages[index - 1].createdAt);
              return <React.Fragment key={message.id}>
                {showDay && <div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-border/70" /><span className="text-[11px] font-medium text-muted-foreground">{new Date(message.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' })}</span><span className="h-px flex-1 bg-border/70" /></div>}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] space-y-1 sm:max-w-[75%] ${isMine ? 'text-right' : 'text-left'}`}>
                    {!isMine && <p className="px-1 text-xs font-medium text-muted-foreground">{message.sender.fullName}</p>}
                    <div className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed shadow-sm ${isMine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border/70 bg-card text-foreground'}`}>{message.content}</div>
                    <p className="px-1 text-[11px] text-muted-foreground">{gymTime(message.createdAt)}</p>
                  </div>
                </div>
              </React.Fragment>;
            })}
          </div>

          <div className="border-t border-border/70 bg-card px-4 py-4 sm:px-6">
            {chatError && <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{chatError}</p>}
            {canSend ? (
              <form className="flex items-center gap-2" onSubmit={event => { event.preventDefault(); void sendMessage(); }}>
                <Input aria-label="Nhập tin nhắn" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Viết tin nhắn cho hội viên..." maxLength={1000} className="h-11 rounded-xl bg-background px-4" />
                <Button type="submit" disabled={busy || !draft.trim()} className="h-11 shrink-0 rounded-xl px-4"><SendHorizontal className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Gửi</span><span className="sr-only sm:hidden">Gửi tin nhắn</span></Button>
              </form>
            ) : !chatLoading && (chatError ? (
              <Button variant="outline" className="w-full" onClick={() => { if (chatBooking) void openChat(chatBooking); }}>Thử tải lại tin nhắn</Button>
            ) : <p className="text-center text-sm text-muted-foreground">Đã hết thời gian nhắn tin của buổi PT.</p>)}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!finishBooking} onOpenChange={open => { if (!open) setFinishBooking(null); }}><DialogContent><DialogHeader><DialogTitle>{finishBooking?.status === 'COMPLETED' ? 'Ghi nhật ký buổi PT' : 'Kết thúc buổi PT'}</DialogTitle></DialogHeader><div className="space-y-3"><Textarea rows={4} placeholder="Nhận xét buổi tập" value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} /><div className="grid grid-cols-3 gap-2"><Input placeholder="Bài tập" value={exerciseName} onChange={e => setExerciseName(e.target.value)} /><Input type="number" placeholder="Số hiệp" value={sets} onChange={e => setSets(e.target.value)} /><Input type="number" placeholder="Số lần" value={reps} onChange={e => setReps(e.target.value)} /></div><p className="text-xs text-muted-foreground">Kết thúc buổi sẽ trừ 1 lượt PT. Nhật ký có thể ghi sau nếu chưa có nội dung.</p></div><DialogFooter><Button disabled={busy} onClick={() => void saveSession()}>{finishBooking?.status === 'COMPLETED' ? 'Lưu nhật ký' : 'Kết thúc và lưu'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!absenceBooking} onOpenChange={open => { if (!open) setAbsenceBooking(null); }}><DialogContent><DialogHeader><DialogTitle>Coach báo vắng buổi PT</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Hội viên được đặt học bù trong 7 ngày và không bị trừ buổi.</p><Textarea rows={3} placeholder="Lý do báo vắng" value={absenceReason} onChange={e => setAbsenceReason(e.target.value)} /><DialogFooter><Button disabled={busy} onClick={() => { if (!absenceBooking) return; void run(() => api.pt.markAbsent(absenceBooking.id, absenceReason), 'Đã báo vắng và cấp quyền học bù.').then(saved => { if (saved) setAbsenceBooking(null); }); }}>Xác nhận báo vắng</Button></DialogFooter></DialogContent></Dialog>
    </StaffPage>
  );
};
