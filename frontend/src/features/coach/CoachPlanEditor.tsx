import React, { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CoachMealDay, CoachPlanDraft, CoachPlanExercise, CoachPlanMeal, CoachPlanSession, CoachWorkoutPlan } from '../../services/api/pt.api';

const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const mealLabels: Record<CoachPlanMeal['mealType'], string> = {
  BREAKFAST: 'Bữa sáng', LUNCH: 'Bữa trưa', DINNER: 'Bữa tối', SNACK: 'Bữa phụ',
};

const newExercise = (): CoachPlanExercise => ({ exerciseName: '', sets: 3, reps: 10, weightKg: null, notes: '' });
const newSession = (): CoachPlanSession => ({ dayOfWeek: 1, title: '', notes: '', exercises: [newExercise()] });
const newMeal = (): CoachPlanMeal => ({ mealType: 'BREAKFAST', time: '07:00', food: '', portion: '', calories: null, notes: '' });
const newMealDay = (): CoachMealDay => ({ dayOfWeek: 1, notes: '', meals: [newMeal()] });

type Props = {
  trainees: Array<{ id: number; name: string }>;
  busy: boolean;
  onSave: (draft: CoachPlanDraft) => Promise<boolean>;
};

const fieldLabel = 'block text-xs font-semibold text-muted-foreground mb-1';

export function CoachPlanEditor({ trainees, busy, onSave }: Props) {
  const [memberId, setMemberId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessions, setSessions] = useState<CoachPlanSession[]>([newSession()]);
  const [mealDays, setMealDays] = useState<CoachMealDay[]>([newMealDay()]);
  const [error, setError] = useState('');

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
    const id = Number(memberId);
    if (!Number.isSafeInteger(id) || id <= 0 || !title.trim()) {
      setError('Chọn học viên và nhập tên giáo án.');
      return;
    }
    if (sessions.length === 0 || mealDays.length === 0) {
      setError('Cần ít nhất một buổi tập và một ngày thực đơn.');
      return;
    }
    if (sessions.some(session => !session.title.trim() || session.exercises.length === 0 || session.exercises.some(exercise => !exercise.exerciseName.trim() || !Number.isInteger(exercise.sets) || exercise.sets < 1 || !Number.isInteger(exercise.reps) || exercise.reps < 1)) ||
      mealDays.some(day => day.meals.length === 0 || day.meals.some(meal => !meal.food.trim() || !meal.portion.trim()))) {
      setError('Điền tên buổi tập, bài tập, số hiệp/lần, món ăn và khẩu phần.');
      return;
    }
    if (new Set(mealDays.map(day => day.dayOfWeek)).size !== mealDays.length) {
      setError('Mỗi ngày chỉ tạo một thực đơn; hãy thêm nhiều bữa vào cùng ngày.');
      return;
    }
    setError('');
    const saved = await onSave({ memberId: id, title: title.trim(), description: description.trim(), sessions, mealDays });
    if (saved) {
      setTitle('');
      setDescription('');
      setSessions([newSession()]);
      setMealDays([newMealDay()]);
    }
  };

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className={fieldLabel}>Học viên</label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">Chọn học viên được phân công</option>{trainees.map(trainee => <option key={trainee.id} value={trainee.id}>{trainee.name}</option>)}</select></div>
      <div><label className={fieldLabel}>Tên giáo án</label><Input placeholder="Ví dụ: Tăng sức bền 4 tuần" value={title} onChange={event => setTitle(event.target.value)} /></div>
    </div>
    <div><label className={fieldLabel}>Mục tiêu và lưu ý chung</label><Textarea rows={3} placeholder="Mục tiêu, lịch dự kiến, điều chỉnh theo thể trạng..." value={description} onChange={event => setDescription(event.target.value)} /></div>

    <section className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Giáo án theo buổi</h3><p className="text-xs text-muted-foreground">Chọn thứ trong tuần, bài tập, số hiệp và số lần.</p></div><Button type="button" size="sm" variant="outline" disabled={sessions.length >= 21} onClick={() => setSessions(rows => [...rows, newSession()])}><Plus className="size-4" /> Thêm buổi</Button></div>
      {sessions.map((session, sessionIndex) => <div key={sessionIndex} className="space-y-3 rounded-lg border bg-background p-3">
        <div className="flex items-center justify-between"><strong className="text-sm">Buổi {sessionIndex + 1}</strong><Button type="button" size="icon" variant="ghost" aria-label={`Xóa buổi ${sessionIndex + 1}`} onClick={() => setSessions(rows => rows.filter((_, i) => i !== sessionIndex))}><Trash2 className="size-4" /></Button></div>
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={session.dayOfWeek} onChange={event => updateSession(sessionIndex, { dayOfWeek: Number(event.target.value) })}>{weekdays.map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</select><Input placeholder="Tên buổi, ví dụ: Thân trên" value={session.title} onChange={event => updateSession(sessionIndex, { title: event.target.value })} /></div>
        <Textarea rows={2} placeholder="Ghi chú buổi tập, khởi động, thời gian nghỉ..." value={session.notes} onChange={event => updateSession(sessionIndex, { notes: event.target.value })} />
        <div className="space-y-2">{session.exercises.map((exercise, exerciseIndex) => <div key={exerciseIndex} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_6rem_auto]">
          <Input aria-label="Tên bài tập" placeholder="Bài tập" value={exercise.exerciseName} onChange={event => updateExercise(sessionIndex, exerciseIndex, { exerciseName: event.target.value })} />
          <Input aria-label="Số hiệp" type="number" min="1" placeholder="Hiệp" value={exercise.sets} onChange={event => updateExercise(sessionIndex, exerciseIndex, { sets: Number(event.target.value) })} />
          <Input aria-label="Số lần" type="number" min="1" placeholder="Lần" value={exercise.reps} onChange={event => updateExercise(sessionIndex, exerciseIndex, { reps: Number(event.target.value) })} />
          <Input aria-label="Mức tạ kg" type="number" min="0" step="0.5" placeholder="Tạ kg" value={exercise.weightKg ?? ''} onChange={event => updateExercise(sessionIndex, exerciseIndex, { weightKg: event.target.value === '' ? null : Number(event.target.value) })} />
          <Button type="button" size="icon" variant="ghost" aria-label="Xóa bài tập" onClick={() => updateSession(sessionIndex, { exercises: session.exercises.filter((_, i) => i !== exerciseIndex) })}><Trash2 className="size-4" /></Button>
          <Input className="sm:col-span-5" placeholder="Ghi chú bài tập, ví dụ: nhịp độ, kỹ thuật..." value={exercise.notes} onChange={event => updateExercise(sessionIndex, exerciseIndex, { notes: event.target.value })} />
        </div>)}</div>
        <Button type="button" size="sm" variant="outline" disabled={session.exercises.length >= 20} onClick={() => updateSession(sessionIndex, { exercises: [...session.exercises, newExercise()] })}><Plus className="size-4" /> Thêm bài tập</Button>
      </div>)}
    </section>

    <section className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Kế hoạch ăn uống</h3><p className="text-xs text-muted-foreground">Thêm từng ngày và các bữa ăn với khẩu phần cụ thể.</p></div><Button type="button" size="sm" variant="outline" disabled={mealDays.length >= 7} onClick={() => setMealDays(rows => [...rows, { ...newMealDay(), dayOfWeek: [1, 2, 3, 4, 5, 6, 7].find(day => !rows.some(row => row.dayOfWeek === day)) ?? 1 }])}><Plus className="size-4" /> Thêm ngày</Button></div>
      {mealDays.map((day, dayIndex) => <div key={dayIndex} className="space-y-3 rounded-lg border bg-background p-3">
        <div className="flex items-center justify-between"><strong className="text-sm">Thực đơn ngày {dayIndex + 1}</strong><Button type="button" size="icon" variant="ghost" aria-label={`Xóa thực đơn ngày ${dayIndex + 1}`} onClick={() => setMealDays(rows => rows.filter((_, i) => i !== dayIndex))}><Trash2 className="size-4" /></Button></div>
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={day.dayOfWeek} onChange={event => updateMealDay(dayIndex, { dayOfWeek: Number(event.target.value) })}>{weekdays.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}</select>
        <Textarea rows={2} placeholder="Ghi chú chung cho ngày, ví dụ: uống đủ nước..." value={day.notes} onChange={event => updateMealDay(dayIndex, { notes: event.target.value })} />
        <div className="space-y-2">{day.meals.map((meal, mealIndex) => <div key={mealIndex} className="space-y-2 rounded-lg border p-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]"><select className="h-10 rounded-md border bg-background px-2 text-sm" value={meal.mealType} onChange={event => updateMeal(dayIndex, mealIndex, { mealType: event.target.value as CoachPlanMeal['mealType'] })}>{Object.entries(mealLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Input aria-label="Giờ ăn" type="time" value={meal.time} onChange={event => updateMeal(dayIndex, mealIndex, { time: event.target.value })} /><Button type="button" size="icon" variant="ghost" aria-label="Xóa bữa ăn" onClick={() => updateMealDay(dayIndex, { meals: day.meals.filter((_, i) => i !== mealIndex) })}><Trash2 className="size-4" /></Button></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_7rem]"><Input placeholder="Món ăn / thực phẩm" value={meal.food} onChange={event => updateMeal(dayIndex, mealIndex, { food: event.target.value })} /><Input placeholder="Khẩu phần, ví dụ: 150 g" value={meal.portion} onChange={event => updateMeal(dayIndex, mealIndex, { portion: event.target.value })} /><Input aria-label="Calories" type="number" min="0" placeholder="Kcal" value={meal.calories ?? ''} onChange={event => updateMeal(dayIndex, mealIndex, { calories: event.target.value === '' ? null : Number(event.target.value) })} /></div>
          <Input placeholder="Ghi chú bữa ăn" value={meal.notes} onChange={event => updateMeal(dayIndex, mealIndex, { notes: event.target.value })} />
        </div>)}</div>
        <Button type="button" size="sm" variant="outline" disabled={day.meals.length >= 8} onClick={() => updateMealDay(dayIndex, { meals: [...day.meals, newMeal()] })}><Plus className="size-4" /> Thêm bữa ăn</Button>
      </div>)}
    </section>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" disabled={busy} onClick={() => void submit()}><Save className="size-4" /> Lưu và gửi cho học viên</Button>
  </div>;
}

export function CoachSavedPlan({ plan }: { plan: CoachWorkoutPlan }) {
  return <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">{plan.title} <span className="font-normal text-muted-foreground">· {plan.member.fullName} · {new Date(plan.createdAt).toLocaleDateString('vi-VN')}</span></summary>
    {plan.description && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{plan.description}</p>}
    {plan.sessions.length > 0 && <div className="mt-3 space-y-2"><strong>Buổi tập</strong>{plan.sessions.map((session, i) => <div key={i} className="rounded-md bg-muted/50 p-2"><strong>{weekdays[session.dayOfWeek - 1]} · {session.title}</strong>{session.notes && <p>{session.notes}</p>}{session.exercises.map((exercise, j) => <p key={j}>• {exercise.exerciseName}: {exercise.sets} hiệp × {exercise.reps} lần{exercise.weightKg != null ? ` · ${exercise.weightKg} kg` : ''}{exercise.notes ? ` · ${exercise.notes}` : ''}</p>)}</div>)}</div>}
    {plan.mealDays.length > 0 && <div className="mt-3 space-y-2"><strong>Thực đơn</strong>{plan.mealDays.map((day, i) => <div key={i} className="rounded-md bg-muted/50 p-2"><strong>{weekdays[day.dayOfWeek - 1]}</strong>{day.notes && <p>{day.notes}</p>}{day.meals.map((meal, j) => <p key={j}>• {mealLabels[meal.mealType]}{meal.time ? ` ${meal.time}` : ''}: {meal.food} · {meal.portion}{meal.calories != null ? ` · ${meal.calories} kcal` : ''}{meal.notes ? ` · ${meal.notes}` : ''}</p>)}</div>)}</div>}
  </details>;
}
