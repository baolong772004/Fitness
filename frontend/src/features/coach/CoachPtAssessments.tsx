import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CoachTraineeMembership } from '../../services/api/pt.api';
import type { PtTrainingAssessment } from '../../services/api/workoutLog.api';

const levelNames: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
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
    if (kind === 'BASELINE' && !goal.trim()) return setError('Vui lòng nhập mục tiêu tập luyện của học viên.');
    if (level === 'BEGINNER' && !movementNotes.trim()) return setError('Vui lòng ghi nhận xét kỹ thuật và khả năng vận động.');
    if (level !== 'BEGINNER' && (!metricName.trim() || !metricValue.trim() || !Number.isFinite(Number(metricValue)))) {
      return setError('Vui lòng nhập tên chỉ số và kết quả đo được.');
    }
    if (level === 'ADVANCED' && !phaseName.trim()) return setError('Vui lòng nhập giai đoạn tập luyện.');
    if (!nextSteps.trim()) return setError('Vui lòng nhập kế hoạch tập tiếp theo.');
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

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">Lộ trình PT · Gói {levelNames[level]}</h3>
      {baseline && interval && (
        <Badge variant="outline" className="text-[11px]">
          {completedSinceReview}/{interval} buổi từ lần đánh giá gần nhất
        </Badge>
      )}
    </div>

    {baseline && interval && completedSinceReview >= interval && (
      <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs font-medium text-amber-900">
        Đã đến mốc đánh giá tiến bộ.
      </p>
    )}

    <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <strong className="block text-sm font-semibold text-foreground">
        {kind === 'BASELINE' ? 'Đánh giá đầu vào' : 'Đánh giá tiến bộ'}
      </strong>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-foreground">
          {kind === 'BASELINE' ? 'Mục tiêu tập luyện' : 'Mục tiêu mới (nếu thay đổi)'}
        </Label>
        <Input
          maxLength={500}
          value={goal}
          onChange={event => setGoal(event.target.value)}
        />
      </div>

      {level === 'ADVANCED' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Giai đoạn phân kỳ tập luyện
          </Label>
          <Input
            maxLength={100}
            value={phaseName}
            onChange={event => setPhaseName(event.target.value)}
          />
        </div>
      )}

      {(level === 'BEGINNER' || level === 'ADVANCED') && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Nhận xét kỹ thuật & khả năng vận động
          </Label>
          <Textarea
            maxLength={2000}
            value={movementNotes}
            onChange={event => setMovementNotes(event.target.value)}
          />
        </div>
      )}

      {level !== 'BEGINNER' && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Tên bài tập / chỉ số đo</Label>
            <Input
              maxLength={100}
              value={metricName}
              onChange={event => setMetricName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Kết quả đo được</Label>
            <Input
              type="number"
              value={metricValue}
              onChange={event => setMetricValue(event.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-foreground">
          Kế hoạch tập tiếp theo
        </Label>
        <Textarea
          maxLength={2000}
          value={nextSteps}
          onChange={event => setNextSteps(event.target.value)}
        />
      </div>

      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
      <Button size="sm" disabled={busy} onClick={() => void save()}>
        Lưu đánh giá
      </Button>
    </div>

    {records.length > 0 && (
      <div className="space-y-2 pt-1">
        {records.map(record => (
          <div key={record.id} className="space-y-1 rounded-xl border bg-card p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-foreground">
                {record.kind === 'BASELINE' ? 'Đầu vào' : 'Tiến bộ'} · {new Date(record.createdAt).toLocaleDateString('vi-VN')}
              </strong>
            </div>
            {record.goal && <p><strong className="text-foreground">Mục tiêu:</strong> {record.goal}</p>}
            {record.phaseName && <p><strong className="text-foreground">Giai đoạn:</strong> {record.phaseName}</p>}
            {record.movementNotes && <p><strong className="text-foreground">Kỹ thuật:</strong> {record.movementNotes}</p>}
            {record.metricName && <p><strong className="text-foreground">{record.metricName}:</strong> {record.metricValue}</p>}
            <p><strong className="text-foreground">Kế hoạch tiếp theo:</strong> {record.nextSteps}</p>
          </div>
        ))}
      </div>
    )}
  </div>;
}
