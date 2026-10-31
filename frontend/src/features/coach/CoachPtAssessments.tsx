import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CoachTraineeMembership } from '../../services/api/pt.api';
import type { PtTrainingAssessment } from '../../services/api/workoutLog.api';

const levelNames: Record<string, string> = {
  BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao',
};
export function CoachPtAssessments({ trainee, assessments, workoutLogs, reviewEverySessions, busy, onSave }: {
  trainee: CoachTraineeMembership;
  assessments: PtTrainingAssessment[];
  workoutLogs: any[];
  reviewEverySessions?: number;
  busy: boolean;
  onSave: (draft: {
    memberId: number; level: PtTrainingAssessment['level']; kind: PtTrainingAssessment['kind'];
    goal?: string; movementNotes?: string; metricName?: string; metricValue?: number;
    phaseName?: string; nextSteps: string;
  }) => Promise<boolean>;
}) {
  const level = trainee.level;
  const validLevel = level === 'BEGINNER' || level === 'INTERMEDIATE' || level === 'ADVANCED';
  const records = assessments.filter(row => row.level === level);
  const baseline = records.find(row => row.kind === 'BASELINE');
  const kind = baseline ? 'REVIEW' : 'BASELINE';
  const latest = records[0];
  const completedSinceReview = workoutLogs.filter(row => row.coachId === records[0]?.coachId &&
    row.startTime > (latest?.createdAt ?? '') &&
    (row.ptCreditAllocation?.batch?.level ?? row.membership?.package?.ptLevel) === level).length;
  const interval = reviewEverySessions;
  const [goal, setGoal] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [metricName, setMetricName] = useState('');
  const [metricValue, setMetricValue] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setGoal(''); setMovementNotes(''); setMetricName(''); setMetricValue('');
    setPhaseName(''); setNextSteps(''); setError('');
  }, [trainee.userId, level]);

  if (!validLevel) return <p className="text-sm text-muted-foreground">Gói PT này chưa xác định cấp để ghi đánh giá lộ trình.</p>;

  const save = async () => {
    if (kind === 'BASELINE' && !goal.trim()) return setError('Nhập mục tiêu ban đầu.');
    if (level === 'BEGINNER' && !movementNotes.trim()) return setError('Ghi nhận xét kỹ thuật và khả năng vận động.');
    if (level !== 'BEGINNER' && (!metricName.trim() || !metricValue.trim() || !Number.isFinite(Number(metricValue)))) {
      return setError('Nhập tên chỉ số và giá trị đo được.');
    }
    if (level === 'ADVANCED' && !phaseName.trim()) return setError('Nhập giai đoạn tập luyện.');
    if (!nextSteps.trim()) return setError('Nhập bước tập luyện tiếp theo.');
    setError('');
    const saved = await onSave({ memberId: trainee.userId, level, kind,
      goal: goal.trim(), movementNotes: movementNotes.trim(), metricName: metricName.trim(),
      ...(metricValue.trim() ? { metricValue: Number(metricValue) } : {}),
      phaseName: phaseName.trim(), nextSteps: nextSteps.trim() });
    if (saved) {
      setGoal(''); setMovementNotes(''); setMetricName(''); setMetricValue('');
      setPhaseName(''); setNextSteps('');
    }
  };

  return <div className="space-y-3 border-t pt-4">
    <div><h3 className="text-sm font-semibold">Lộ trình PT · {levelNames[level]}</h3>
      <p className="text-xs text-muted-foreground">{baseline
        ? `Đánh giá lại sau mỗi ${interval} buổi hoàn thành · ${completedSinceReview}/${interval} buổi từ lần đánh giá gần nhất.`
        : 'Ghi đánh giá đầu vào trước khi gán giáo án cho học viên.'}</p>
    </div>
    {baseline && interval && completedSinceReview >= interval && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">Đã đến mốc đánh giá tiến bộ.</p>}
    <div className="space-y-2 rounded-lg border p-3">
      <strong className="text-sm">{kind === 'BASELINE' ? 'Đánh giá đầu vào' : 'Đánh giá tiến bộ'}</strong>
      <Input maxLength={500} placeholder={kind === 'BASELINE' ? 'Mục tiêu của học viên' : 'Mục tiêu mới (nếu thay đổi)'} value={goal} onChange={event => setGoal(event.target.value)} />
      {(level === 'BEGINNER' || level === 'ADVANCED') && <Textarea maxLength={2000} placeholder="Kỹ thuật, khả năng vận động và điểm cần cải thiện" value={movementNotes} onChange={event => setMovementNotes(event.target.value)} />}
      {level !== 'BEGINNER' && <div className="grid grid-cols-2 gap-2"><Input maxLength={100} placeholder="Chỉ số đo (VD: squat kg)" value={metricName} onChange={event => setMetricName(event.target.value)} /><Input type="number" placeholder="Giá trị đo được" value={metricValue} onChange={event => setMetricValue(event.target.value)} /></div>}
      {level === 'ADVANCED' && <Input maxLength={100} placeholder="Giai đoạn tập luyện" value={phaseName} onChange={event => setPhaseName(event.target.value)} />}
      <Textarea maxLength={2000} placeholder="Bước tập luyện tiếp theo" value={nextSteps} onChange={event => setNextSteps(event.target.value)} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button size="sm" disabled={busy} onClick={() => void save()}>Lưu đánh giá</Button>
    </div>
    {records.map(record => <div key={record.id} className="rounded-lg border p-3 text-sm">
      <strong>{record.kind === 'BASELINE' ? 'Đầu vào' : 'Tiến bộ'} · {new Date(record.createdAt).toLocaleDateString('vi-VN')}</strong>
      {record.goal && <p>Mục tiêu: {record.goal}</p>}
      {record.phaseName && <p>Giai đoạn: {record.phaseName}</p>}
      {record.movementNotes && <p>Kỹ thuật: {record.movementNotes}</p>}
      {record.metricName && <p>{record.metricName}: {record.metricValue}</p>}
      <p>Bước tiếp theo: {record.nextSteps}</p>
    </div>)}
  </div>;
}
