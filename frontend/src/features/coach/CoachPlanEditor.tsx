import React, { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Dumbbell, FileText, History, LoaderCircle, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2, UserRound, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { CoachMealDay, CoachPlanDraft, CoachPlanExercise, CoachPlanMeal, CoachPlanSession, CoachWorkoutPlan, GeneratedCoachPlan, WorkoutPlanRevision } from '../../services/api/pt.api';

const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const mealLabels: Record<CoachPlanMeal['mealType'], string> = {
  BREAKFAST: 'Bữa sáng', LUNCH: 'Bữa trưa', DINNER: 'Bữa tối', SNACK: 'Bữa phụ',
};

const newExercise = (): CoachPlanExercise => ({ exerciseName: '', sets: 3, reps: 10, weightKg: null, notes: '' });
const newSession = (): CoachPlanSession => ({ dayOfWeek: 1, title: '', notes: '', exercises: [newExercise()] });
const newMeal = (): CoachPlanMeal => ({ mealType: 'BREAKFAST', time: '07:00', food: '', portion: '', calories: null, notes: '' });
const newMealDay = (): CoachMealDay => ({ dayOfWeek: 1, notes: '', meals: [newMeal()] });

type Props = {
  busy: boolean;
  onSave: (draft: CoachPlanDraft) => Promise<boolean>;
  onGenerate: (memberId: number | null, request: string) => Promise<GeneratedCoachPlan>;
  trainees?: Array<{ id: number; fullName: string; level?: string | null }>;
  initialPlan?: CoachWorkoutPlan;
  onCancel?: () => void;
};

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block min-w-0 space-y-1.5 ${className}`}>
    <span className="block text-xs font-medium text-muted-foreground">{label}</span>
    {children}
  </label>;
}

function Notes({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <details className="group/notes">
    <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
      <ChevronDown className="size-3.5 transition-transform group-open/notes:rotate-180" />{label}{value.trim() && <span className="size-1.5 rounded-full bg-primary" aria-label="Đã có ghi chú" />}
    </summary>
    <Textarea className="mt-2 min-h-16" rows={2} aria-label={label} placeholder="Nhập ghi chú..." value={value} onChange={event => onChange(event.target.value)} />
  </details>;
}

const selectClass = 'h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50';

export function CoachPlanEditor({ busy, onSave, onGenerate, trainees = [], initialPlan, onCancel }: Props) {
  const [title, setTitle] = useState(initialPlan?.title ?? '');
  const [description, setDescription] = useState(initialPlan?.description ?? '');
  const [sessions, setSessions] = useState<CoachPlanSession[]>(initialPlan?.sessions ?? [newSession()]);
  const [mealDays, setMealDays] = useState<CoachMealDay[]>(initialPlan?.mealDays ?? []);
  const [changeReason, setChangeReason] = useState('');
  const [error, setError] = useState('');
  const [aiRequest, setAiRequest] = useState('');
  const [aiMemberId, setAiMemberId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState('workout');
  const [aiOpen, setAiOpen] = useState(false);

  const updateSession = (index: number, patch: Partial<CoachPlanSession>) =>
    setSessions(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const updateExercise = (sessionIndex: number, exerciseIndex: number, patch: Partial<CoachPlanExercise>) =>
    setSessions(rows => rows.map((row, i) => i === sessionIndex
      ? { ...row, exercises: row.exercises.map((exercise, j) => j === exerciseIndex ? { ...exercise, ...patch } : exercise) }
      : row));
  const updateMealDay = (index: number, patch: Partial<CoachMealDay>) =>
    setMealDays(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const updateMeal = (dayIndex: number, mealIndex: number, patch: Partial<CoachPlanMeal>) =>
    setMealDays(rows => rows.map((row, i) => i === dayIndex
      ? { ...row, meals: row.meals.map((meal, j) => j === mealIndex ? { ...meal, ...patch } : meal) }
      : row));

  const submit = async () => {
    if (!title.trim()) {
      setError('Nhập tên giáo án.');
      return;
    }
    if (sessions.length === 0) {
      setActiveSection('workout');
      setError('Cần ít nhất một buổi tập.');
      return;
    }
    if (sessions.some(session => !session.title.trim() || session.exercises.length === 0 || session.exercises.some(exercise => !exercise.exerciseName.trim() || !Number.isInteger(exercise.sets) || exercise.sets < 1 || !Number.isInteger(exercise.reps) || exercise.reps < 1))) {
      setActiveSection('workout');
      setError('Điền tên buổi tập, bài tập và số hiệp/lần hợp lệ.');
      return;
    }
    if (mealDays.some(day => day.meals.length === 0 || day.meals.some(meal => !meal.food.trim() || !meal.portion.trim()))) {
      setActiveSection('nutrition');
      setError('Điền món ăn và khẩu phần cho từng bữa.');
      return;
    }
    if (new Set(mealDays.map(day => day.dayOfWeek)).size !== mealDays.length) {
      setActiveSection('nutrition');
      setError('Mỗi ngày chỉ tạo một thực đơn; hãy thêm nhiều bữa vào cùng ngày.');
      return;
    }
    if (initialPlan && !changeReason.trim()) {
      setError('Nhập lý do cập nhật giáo án.');
      return;
    }
    setError('');
    const saved = await onSave({ title: title.trim(), description: description.trim(), sessions, mealDays, ...(initialPlan ? { changeReason: changeReason.trim() } : {}) });
    if (saved && !initialPlan) {
      setTitle('');
      setDescription('');
      setSessions([newSession()]);
      setMealDays([]);
      setActiveSection('workout');
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const plan = await onGenerate(aiMemberId ? Number(aiMemberId) : null, aiRequest.trim());
      setTitle(plan.title);
      setDescription(plan.description);
      setSessions(plan.sessions);
      setMealDays(plan.mealDays);
      setActiveSection('workout');
      setAiOpen(false);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Không thể tạo giáo án bằng AI.');
    } finally {
      setGenerating(false);
    }
  };

  return <div className="space-y-5">
    <fieldset disabled={busy || generating} className="min-w-0 space-y-4">
      <Field label="Tên giáo án"><Input className="h-10" placeholder="Ví dụ: Tăng sức bền 4 tuần" value={title} onChange={event => setTitle(event.target.value)} /></Field>
      <Field label="Mục tiêu"><Textarea rows={2} className="min-h-16" placeholder="Mục tiêu và lưu ý của giáo án..." value={description} onChange={event => setDescription(event.target.value)} /></Field>
    </fieldset>

    {!initialPlan && <section className="overflow-hidden rounded-xl border border-primary/15 bg-primary/5">
      <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-expanded={aiOpen} aria-controls="coach-plan-ai" onClick={() => setAiOpen(open => !open)}>
        <Sparkles className="size-4" /><span className="flex-1">Soạn nhanh với AI</span><ChevronDown className={`size-4 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
      </button>
      <div id="coach-plan-ai" hidden={!aiOpen} className="space-y-3 px-4 pb-4">
        {trainees.length > 0 && <select className={`${selectClass} w-full`} aria-label="Chọn học viên để soạn theo cấp PT" value={aiMemberId} disabled={busy || generating} onChange={event => setAiMemberId(event.target.value)}>
          <option value="">Giáo án mẫu (chưa chọn học viên)</option>
          {trainees.map(trainee => <option key={trainee.id} value={trainee.id}>{trainee.fullName}{trainee.level ? ` · ${trainee.level === 'BEGINNER' ? 'Cơ bản' : trainee.level === 'INTERMEDIATE' ? 'Trung cấp' : trainee.level === 'ADVANCED' ? 'Nâng cao' : trainee.level}` : ''}</option>)}
        </select>}
        <Textarea rows={2} maxLength={2000} aria-label="Yêu cầu soạn giáo án bằng AI" placeholder="Ví dụ: Giảm mỡ trong 8 tuần, 3 buổi/tuần..." value={aiRequest} disabled={busy || generating} onChange={event => setAiRequest(event.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Kiểm tra bản nháp trước khi lưu.</span>
          <Button type="button" size="sm" disabled={busy || generating} onClick={() => void generate()}>{generating ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating ? 'Đang tạo...' : 'Tạo bản nháp'}</Button>
        </div>
      </div>
    </section>}

    <fieldset disabled={busy || generating} className="min-w-0">
      <Tabs value={activeSection} onValueChange={setActiveSection} className="gap-4">
        <TabsList className="h-11 w-full p-1">
          <TabsTrigger value="workout" className="gap-1 text-xs sm:gap-2 sm:text-sm"><Dumbbell className="hidden size-4 sm:block" />Bài tập<span className="rounded bg-background/60 px-1.5 text-xs tabular-nums">{sessions.length}</span></TabsTrigger>
          <TabsTrigger value="nutrition" className="gap-1 text-xs sm:gap-2 sm:text-sm"><Utensils className="hidden size-4 sm:block" />Dinh dưỡng<span className="rounded bg-background/60 px-1.5 text-xs tabular-nums">{mealDays.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="workout" className="space-y-3">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Lịch tập trong tuần</h3><Button type="button" size="sm" variant="outline" disabled={sessions.length >= 21} onClick={() => setSessions(rows => [...rows, newSession()])}><Plus className="size-4" />Thêm buổi</Button></div>
          {sessions.length === 0 && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Thêm buổi tập để bắt đầu.</p>}
          {sessions.map((session, sessionIndex) => <section key={sessionIndex} className="overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs text-primary">{String(sessionIndex + 1).padStart(2, '0')}</span>Buổi tập</h4>
              <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label={`Xóa buổi ${sessionIndex + 1}`} onClick={() => setSessions(rows => rows.filter((_, i) => i !== sessionIndex))}><Trash2 className="size-3.5" /></Button>
            </div>
            <div className="space-y-4 p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <Field label="Ngày tập"><select className={`${selectClass} w-full`} value={session.dayOfWeek} onChange={event => updateSession(sessionIndex, { dayOfWeek: Number(event.target.value) })}>{weekdays.map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</select></Field>
                <Field label="Tên buổi tập"><Input placeholder="Ví dụ: Thân trên" value={session.title} onChange={event => updateSession(sessionIndex, { title: event.target.value })} /></Field>
              </div>
              <Notes label="Ghi chú buổi tập" value={session.notes} onChange={notes => updateSession(sessionIndex, { notes })} />
              <div className="space-y-3">{session.exercises.map((exercise, exerciseIndex) => <div key={exerciseIndex} className="space-y-2 rounded-lg bg-muted/35 p-3">
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_2rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_3.75rem_3.75rem_4.5rem_2rem]">
                  <Field label={`Bài tập ${exerciseIndex + 1}`} className="col-span-4 sm:col-span-1"><Input placeholder="Tên bài tập" value={exercise.exerciseName} onChange={event => updateExercise(sessionIndex, exerciseIndex, { exerciseName: event.target.value })} /></Field>
                  <Field label="Hiệp"><Input type="number" min="1" value={exercise.sets} onChange={event => updateExercise(sessionIndex, exerciseIndex, { sets: Number(event.target.value) })} /></Field>
                  <Field label="Lần"><Input type="number" min="1" value={exercise.reps} onChange={event => updateExercise(sessionIndex, exerciseIndex, { reps: Number(event.target.value) })} /></Field>
                  <Field label="Tạ (kg)"><Input type="number" min="0" step="0.5" placeholder="—" value={exercise.weightKg ?? ''} onChange={event => updateExercise(sessionIndex, exerciseIndex, { weightKg: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
                  <Button type="button" size="icon-sm" variant="ghost" className="mb-0.5 text-muted-foreground hover:text-destructive" aria-label={`Xóa bài tập ${exerciseIndex + 1} của buổi ${sessionIndex + 1}`} onClick={() => updateSession(sessionIndex, { exercises: session.exercises.filter((_, i) => i !== exerciseIndex) })}><Trash2 className="size-3.5" /></Button>
                </div>
                <Notes label="Ghi chú bài tập" value={exercise.notes} onChange={notes => updateExercise(sessionIndex, exerciseIndex, { notes })} />
              </div>)}</div>
              <Button type="button" size="sm" variant="ghost" className="text-primary" disabled={session.exercises.length >= 20} onClick={() => updateSession(sessionIndex, { exercises: [...session.exercises, newExercise()] })}><Plus className="size-4" />Thêm bài tập</Button>
            </div>
          </section>)}
        </TabsContent>

        <TabsContent value="nutrition" className="space-y-3">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Thực đơn trong tuần</h3><Button type="button" size="sm" variant="outline" disabled={mealDays.length >= 7} onClick={() => setMealDays(rows => [...rows, { ...newMealDay(), dayOfWeek: [1, 2, 3, 4, 5, 6, 7].find(day => !rows.some(row => row.dayOfWeek === day)) ?? 1 }])}><Plus className="size-4" />Thêm ngày</Button></div>
          {mealDays.length === 0 && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Thêm ngày để lên thực đơn.</p>}
          {mealDays.map((day, dayIndex) => <section key={dayIndex} className="overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-xs text-primary">{String(dayIndex + 1).padStart(2, '0')}</span>Thực đơn</h4>
              <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label={`Xóa thực đơn ngày ${dayIndex + 1}`} onClick={() => setMealDays(rows => rows.filter((_, i) => i !== dayIndex))}><Trash2 className="size-3.5" /></Button>
            </div>
            <div className="space-y-4 p-3 sm:p-4">
              <Field label="Ngày áp dụng"><select className={`${selectClass} w-full sm:w-40`} value={day.dayOfWeek} onChange={event => updateMealDay(dayIndex, { dayOfWeek: Number(event.target.value) })}>{weekdays.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}</select></Field>
              <Notes label="Ghi chú thực đơn" value={day.notes} onChange={notes => updateMealDay(dayIndex, { notes })} />
              <div className="space-y-3">{day.meals.map((meal, mealIndex) => <div key={mealIndex} className="space-y-3 rounded-lg bg-muted/35 p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_7rem_2rem] items-end gap-2">
                  <Field label="Bữa ăn"><select className={`${selectClass} w-full`} value={meal.mealType} onChange={event => updateMeal(dayIndex, mealIndex, { mealType: event.target.value as CoachPlanMeal['mealType'] })}>{Object.entries(mealLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                  <Field label="Giờ ăn"><Input type="time" value={meal.time} onChange={event => updateMeal(dayIndex, mealIndex, { time: event.target.value })} /></Field>
                  <Button type="button" size="icon-sm" variant="ghost" className="mb-0.5 text-muted-foreground hover:text-destructive" aria-label={`Xóa bữa ăn ${mealIndex + 1} của ngày ${dayIndex + 1}`} onClick={() => updateMealDay(dayIndex, { meals: day.meals.filter((_, i) => i !== mealIndex) })}><Trash2 className="size-3.5" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_5rem]">
                  <Field label="Món ăn" className="col-span-2 sm:col-span-1"><Input placeholder="Tên món / thực phẩm" value={meal.food} onChange={event => updateMeal(dayIndex, mealIndex, { food: event.target.value })} /></Field>
                  <Field label="Khẩu phần"><Input placeholder="Ví dụ: 150 g" value={meal.portion} onChange={event => updateMeal(dayIndex, mealIndex, { portion: event.target.value })} /></Field>
                  <Field label="Kcal"><Input type="number" min="0" placeholder="—" value={meal.calories ?? ''} onChange={event => updateMeal(dayIndex, mealIndex, { calories: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
                </div>
                <Notes label="Ghi chú bữa ăn" value={meal.notes} onChange={notes => updateMeal(dayIndex, mealIndex, { notes })} />
              </div>)}</div>
              <Button type="button" size="sm" variant="ghost" className="text-primary" disabled={day.meals.length >= 8} onClick={() => updateMealDay(dayIndex, { meals: [...day.meals, newMeal()] })}><Plus className="size-4" />Thêm bữa ăn</Button>
            </div>
          </section>)}
        </TabsContent>
      </Tabs>
    </fieldset>
    {initialPlan && <Field label="Lý do cập nhật"><Textarea rows={2} maxLength={1000} disabled={busy} placeholder="Ví dụ: Điều chỉnh bài tập theo thể lực của học viên" value={changeReason} onChange={event => setChangeReason(event.target.value)} /></Field>}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">{sessions.length} buổi tập · {mealDays.length} ngày thực đơn</p>
      <div className="flex w-full gap-2 sm:w-auto">{onCancel && <Button type="button" variant="outline" disabled={busy || generating} onClick={onCancel}>Hủy</Button>}<Button type="button" className="flex-1 sm:flex-none" disabled={busy || generating} onClick={() => void submit()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{initialPlan ? 'Lưu & cập nhật cho học viên' : 'Lưu giáo án'}</Button></div>
    </div>
  </div>;
}

export function CoachSavedPlan({ plan, trainees, busy, onAssign, onUpdate, onRestore, onHistory, onGenerate }: {
  plan: CoachWorkoutPlan;
  trainees: Array<{ id: number; fullName: string }>;
  busy: boolean;
  onAssign: (plan: CoachWorkoutPlan, memberId: number, programName: string) => Promise<boolean>;
  onUpdate: (plan: CoachWorkoutPlan, draft: CoachPlanDraft) => Promise<boolean>;
  onRestore: (plan: CoachWorkoutPlan, revisionId: number, reason: string) => Promise<boolean>;
  onHistory: (plan: CoachWorkoutPlan) => Promise<WorkoutPlanRevision[]>;
  onGenerate: Props['onGenerate'];
}) {
  const [memberId, setMemberId] = useState('');
  const [programName, setProgramName] = useState('PT');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'details' | 'edit' | 'history'>('details');
  const [history, setHistory] = useState<WorkoutPlanRevision[] | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [restoreReason, setRestoreReason] = useState('');
  const assigned = plan.kind === 'ASSIGNED';
  const disabled = busy || working;
  const perform = async (work: () => Promise<boolean>) => {
    setWorking(true);
    setError('');
    try {
      const saved = await work();
      if (saved) { setView('details'); setHistory(null); setRestoreReason(''); }
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật giáo án.');
      return false;
    } finally { setWorking(false); }
  };
  const loadHistory = async () => {
    setView('history'); setWorking(true); setError(''); setHistory(null);
    try { setHistory(await onHistory(plan)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử.'); }
    finally { setWorking(false); }
  };
  return <Dialog open={open} onOpenChange={value => {
    if (disabled) return;
    setOpen(value); setView('details'); setError(''); setHistory(null); setRestoreReason('');
  }}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" className="h-auto min-h-11 w-full justify-start gap-2.5 px-3 py-2.5 text-left shadow-none" title={plan.title}>
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1"><span className="block truncate">{plan.title}</span>{assigned && <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{plan.member?.fullName} · {plan.programName} · V{plan.version}{plan.status === 'ARCHIVED' ? ' · Đã lưu trữ' : ''}</span>}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader className="pr-6 text-left">
        <DialogTitle className="break-words leading-snug">{plan.title}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{new Date(plan.updatedAt || plan.createdAt).toLocaleDateString('vi-VN')}</span>
          <span>{plan.sessions.length} buổi · {plan.mealDays.length} ngày ăn</span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><UserRound className="size-3 shrink-0" /><span className="break-words">{plan.member?.fullName || 'Chưa gán học viên'}</span></span>
          {assigned && <span>{plan.programName} · Phiên bản {plan.version} · {plan.status === 'ACTIVE' ? 'Đang áp dụng' : 'Đã lưu trữ'}</span>}
        </DialogDescription>
      </DialogHeader>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {view === 'edit' ? <CoachPlanEditor key={plan.version} initialPlan={plan} busy={disabled} onGenerate={onGenerate} onSave={draft => perform(() => onUpdate(plan, draft))} onCancel={() => { setView('details'); setError(''); }} /> : view === 'history' ? <div className="space-y-4">
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => { setView('details'); setError(''); }}>Quay lại giáo án</Button>
      {working && <p role="status" className="text-sm text-muted-foreground">Đang tải lịch sử...</p>}
      {history?.some(revision => revision.version !== plan.version) && plan.status === 'ACTIVE' && <Field label="Lý do khôi phục"><Input maxLength={1000} disabled={disabled} value={restoreReason} onChange={event => setRestoreReason(event.target.value)} placeholder="Nhập lý do trước khi chọn phiên bản cần khôi phục" /></Field>}
      {history?.map(revision => <details key={revision.id} className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Phiên bản {revision.version}{revision.version === plan.version ? ' · Hiện tại' : ''} · {new Date(revision.createdAt).toLocaleString('vi-VN')}</summary>
        <div className="mt-3 space-y-3"><p className="text-xs text-muted-foreground">{revision.changedBy.fullName} · {revision.reason}</p><h3 className="font-semibold">{revision.title}</h3><PlanContent plan={revision} />
          {revision.version !== plan.version && plan.status === 'ACTIVE' && <Button size="sm" variant="outline" disabled={disabled || !restoreReason.trim()} onClick={() => void perform(() => onRestore(plan, revision.id, restoreReason.trim()))}><RotateCcw className="size-4" />Khôi phục nội dung này</Button>}
        </div>
      </details>)}
    </div> : <div className="space-y-4 border-t pt-4 text-sm break-words">
    {assigned && <div className="flex flex-wrap gap-2">
      {plan.status === 'ACTIVE' && <Button size="sm" disabled={disabled} onClick={() => { setView('edit'); setError(''); }}><Pencil className="size-4" />Chỉnh sửa & cập nhật</Button>}
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => void loadHistory()}><History className="size-4" />Lịch sử phiên bản</Button>
    </div>}
    {!assigned && <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <Field label="Học viên"><select className={`${selectClass} w-full`} disabled={disabled || trainees.length === 0} aria-label={`Chọn học viên nhận giáo án ${plan.title}`} value={memberId} onChange={event => setMemberId(event.target.value)}>
        <option value="">Chọn học viên PT</option>
        {trainees.map(trainee => <option key={trainee.id} value={trainee.id}>{trainee.fullName}</option>)}
      </select></Field>
      <Field label="Chương trình huấn luyện"><Input maxLength={120} disabled={disabled} value={programName} onChange={event => setProgramName(event.target.value)} placeholder="Ví dụ: PT, Tăng sức bền..." /></Field>
      <p className="text-xs text-muted-foreground">Giáo án cũ cùng chương trình sẽ được chuyển vào lịch sử.</p>
      <Button type="button" className="w-full" disabled={disabled || !memberId || !programName.trim()} onClick={() => void perform(async () => { const saved = await onAssign(plan, Number(memberId), programName.trim()); if (saved) setOpen(false); return saved; })}>Gán cho học viên</Button>
      {trainees.length === 0 && <p className="text-xs text-muted-foreground">Chưa có học viên PT được gán cho bạn.</p>}
    </div>}
    <PlanContent plan={plan} />
    </div>}
    </DialogContent>
  </Dialog>;
}

function PlanContent({ plan }: { plan: Pick<CoachWorkoutPlan, 'description' | 'sessions' | 'mealDays'> }) {
  return <div className="space-y-3 text-sm break-words">
    {plan.description && <p className="whitespace-pre-wrap break-words text-muted-foreground">{plan.description}</p>}
    {plan.sessions.length > 0 && <div className="mt-3 space-y-2"><strong>Buổi tập</strong>{plan.sessions.map((session, i) => <div key={i} className="rounded-md bg-muted/50 p-2"><strong>{weekdays[session.dayOfWeek - 1]} · {session.title}</strong>{session.notes && <p>{session.notes}</p>}{session.exercises.map((exercise, j) => <p key={j}>• {exercise.exerciseName}: {exercise.sets} hiệp × {exercise.reps} lần{exercise.weightKg != null ? ` · ${exercise.weightKg} kg` : ''}{exercise.notes ? ` · ${exercise.notes}` : ''}</p>)}</div>)}</div>}
    {plan.mealDays.length > 0 && <div className="mt-3 space-y-2"><strong>Thực đơn</strong>{plan.mealDays.map((day, i) => <div key={i} className="rounded-md bg-muted/50 p-2"><strong>{weekdays[day.dayOfWeek - 1]}</strong>{day.notes && <p>{day.notes}</p>}{day.meals.map((meal, j) => <p key={j}>• {mealLabels[meal.mealType]}{meal.time ? ` ${meal.time}` : ''}: {meal.food} · {meal.portion}{meal.calories != null ? ` · ${meal.calories} kcal` : ''}{meal.notes ? ` · ${meal.notes}` : ''}</p>)}</div>)}</div>}
  </div>;
}
