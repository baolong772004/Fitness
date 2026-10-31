import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, request, tokenStorage } from '../../services/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type PerRepMeasurement = {
  repNumber: number;
  startSeconds: number;
  endSeconds: number;
  timestampSeconds: number;
  side?: string;
  observedValue?: Record<string, unknown>;
  measurementQuality?: { sufficientForExperimentalComparison?: boolean; reasonCode?: string };
};

type EditHistoryEntry = {
  id: number;
  revision: number;
  outcome: string;
  repNumber: number | null;
  startSeconds: number;
  endSeconds: number;
  timestampSeconds: number | null;
  cameraView: string;
  reviewerId: number | string | null;
  standardVersion: string | null;
  reviewerNotes: string;
  createdAt: string | null;
};

type ComparisonRow = {
  id: number;
  criterionId: string;
  repNumber: number | null;
  cameraView?: string;
  reviewerId?: number | string | null;
  standardVersion?: string | null;
  revision?: number;
  editHistory?: EditHistoryEntry[];
  startSeconds: number;
  endSeconds: number;
  timestampSeconds: number | null;
  coachOutcome: string;
  officialStatus: string;
  candidateStatus: string;
  aiComparableStatus: string;
  observedValue: Record<string, unknown> | null;
  agreement: string;
  reviewerNotes: string;
  createdAt?: string;
};

type AiCoachComparison = {
  totalLabels: number;
  totalRevisions?: number;
  agreeCount: number;
  disagreeFalsePositiveCount: number;
  disagreeFalseNegativeCount: number;
  aiAbstainedCount: number;
  coachUnassessableCount: number;
  rows: ComparisonRow[];
};

type CriterionReviewRow = {
  id: number;
  exerciseType: string;
  exerciseVariant: string;
  standardVersion: string;
  criterionId: string;
  decision: string;
  status: string;
  reviewRecordId: string;
  approvedConditions: string;
  thresholds: Record<string, unknown>;
  reviewedAt: string;
};

type Shared = {
  id: number;
  sharedAt: string;
  aiCoachComparison?: AiCoachComparison;
  analysis: {
    id: number; status: string; studentPlanId: number | null; videoAvailable?: boolean;
    member: { id: number; fullName: string };
    result: {
      detectedRepetitions: number | null;
      repetitions?: { number: number; startSeconds: number; bottomSeconds: number; endSeconds: number }[];
      observations: { message: string; timestampSeconds: number; suggestion: string }[];
      limitations: string[];
      video?: { durationSeconds?: number };
      cameraView?: { detected?: string; requested?: string };
      exerciseVariant?: string;
      modelVersion?: string;
      ruleVersion?: string;
      techniqueEvaluation?: {
        exercise: string;
        exerciseVariant: string;
        referenceStandardVersion: string;
        referenceStandardDigest: string;
        criteria: {
          criterionId: string;
          title: string;
          status: string;
          reason?: string | null;
          measurement?: { perRep?: PerRepMeasurement[] } | null;
        }[];
      };
    } | null;
    feedback: { id: number; comment: string; createdAt: string }[];
  };
};

function SharedVideo({
  analysis,
  comparison,
  candidatePolicies,
  savedReviews,
  onReload,
}: {
  analysis: Shared['analysis'];
  comparison?: AiCoachComparison;
  candidatePolicies: Record<string, unknown>;
  savedReviews: CriterionReviewRow[];
  onReload: () => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    if (!requested || !analysis.videoAvailable) return;
    const controller = new AbortController();
    let objectUrl = '';
    void fetch(`${API_BASE_URL}/coach/shared-exercise-analyses/${analysis.id}/video`, { headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}` }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('Video hết hạn hoặc quyền xem đã thay đổi.'); return response.blob(); })
      .then(blob => { if (controller.signal.aborted) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [analysis.id, analysis.videoAvailable, requested]);
  if (!analysis.videoAvailable) return <p className="text-xs text-muted-foreground">Video chưa được cho phép chia sẻ hoặc đã hết hạn lưu trữ.</p>;
  return <div className="space-y-2">
    {!requested && <Button variant="outline" onClick={() => setRequested(true)}>Xem video học viên đã cho phép chia sẻ & Gắn nhãn / Duyệt tiêu chí</Button>}
    {requested && !url && !error && <p className="text-sm">Đang tải video...</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {url && <><video ref={video} src={url} controls playsInline preload="metadata" onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} className="max-h-96 w-full rounded-lg bg-black" />
      <p className="text-xs text-muted-foreground">Thời điểm video: {currentTime.toFixed(2)}s</p>
      <div className="flex flex-wrap gap-2">{analysis.result?.observations.map((item, index) => <Button key={index} variant="outline" size="sm" onClick={() => { if (video.current) { video.current.pause(); video.current.currentTime = item.timestampSeconds; } }}>{item.timestampSeconds.toFixed(1)}s · Dấu hiệu {index + 1}</Button>)}</div></>}
    {url && <TechniqueReviewTools analysis={analysis} video={video} comparison={comparison} candidatePolicies={candidatePolicies} savedReviews={savedReviews} onReload={onReload} />}
  </div>;
}

function TechniqueReviewTools({
  analysis,
  video,
  comparison,
  candidatePolicies,
  savedReviews,
  onReload,
}: {
  analysis: Shared['analysis'];
  video: { current: HTMLVideoElement | null };
  comparison?: AiCoachComparison;
  candidatePolicies: Record<string, unknown>;
  savedReviews: CriterionReviewRow[];
  onReload: () => Promise<void>;
}) {
  const criteria = analysis.result?.techniqueEvaluation?.criteria || [];
  const repetitions = analysis.result?.repetitions || [];
  const detectedView = analysis.result?.cameraView?.detected || 'SIDE';
  const [criterionId, setCriterionId] = useState('');
  const [outcome, setOutcome] = useState('IMPROVE');
  const [cameraView, setCameraView] = useState(detectedView);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('1');
  const [stamp, setStamp] = useState('0.5');
  const [rep, setRep] = useState('1');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState('');
  const [qualification, setQualification] = useState('');
  const [recordId, setRecordId] = useState('');
  const [scope, setScope] = useState('BODYWEIGHT · Camera SIDE/FRONT · Pose Landmarker Lite');
  const [conditions, setConditions] = useState('');
  const [thresholds, setThresholds] = useState('{"status":"PROPOSED_PENDING_VALIDATION"}');
  const [releaseReviewId, setReleaseReviewId] = useState('');
  const [reportPath, setReportPath] = useState('');
  const [reportSha256, setReportSha256] = useState('');
  const [acceptanceCriteriaId, setAcceptanceCriteriaId] = useState('');
  const [releaseModelVersion, setReleaseModelVersion] = useState('');
  const [releaseRuleVersion, setReleaseRuleVersion] = useState('');
  const [releaseViews, setReleaseViews] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [signaturePassword, setSignaturePassword] = useState('');
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!criterionId && criteria[0]) setCriterionId(criteria[0].criterionId);
  }, [criteria, criterionId]);

  useEffect(() => {
    if (!criterionId) return;
    const candidate = candidatePolicies[criterionId];
    if (candidate) {
      setThresholds(JSON.stringify(candidate, null, 2));
    } else {
      setThresholds('{"status":"PROPOSED_PENDING_VALIDATION"}');
    }
  }, [criterionId, candidatePolicies]);

  const selectedCriterion = criteria.find(item => item.criterionId === criterionId);
  const perRepMeasurements = selectedCriterion?.measurement?.perRep || [];
  const releasableReviews = savedReviews.filter(item => item.criterionId === criterionId &&
    item.standardVersion === analysis.result?.techniqueEvaluation?.referenceStandardVersion &&
    item.status === 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION');

  useEffect(() => {
    if (!releasableReviews.some(item => String(item.id) === releaseReviewId)) {
      setReleaseReviewId(releasableReviews[0] ? String(releasableReviews[0].id) : '');
    }
  }, [criterionId, savedReviews, releaseReviewId]);

  const selectRep = (repItem: { number: number; startSeconds: number; bottomSeconds: number; endSeconds: number }) => {
    setRep(String(repItem.number));
    setStart(repItem.startSeconds.toFixed(2));
    setEnd(repItem.endSeconds.toFixed(2));
    setStamp(repItem.bottomSeconds.toFixed(2));
    if (video.current) {
      video.current.pause();
      video.current.currentTime = repItem.bottomSeconds;
    }
  };

  const capture = (field: 'start' | 'end' | 'stamp') => {
    const time = video.current?.currentTime;
    if (time == null) return;
    const formatted = time.toFixed(2);
    if (field === 'start') setStart(formatted);
    else if (field === 'end') setEnd(formatted);
    else setStamp(formatted);
  };

  const saveLabel = async () => {
    const startSec = Number(start);
    const endSec = Number(end);
    const parsedStamp = stamp.trim() === '' ? null : Number(stamp);
    const currentVideoTime = video.current?.currentTime;
    const timestampSeconds = parsedStamp != null && Number.isFinite(parsedStamp)
      ? parsedStamp
      : currentVideoTime != null && currentVideoTime >= startSec && currentVideoTime <= endSec
        ? Number(currentVideoTime.toFixed(2))
        : outcome === 'UNASSESSABLE'
          ? null
          : Number(((startSec + endSec) / 2).toFixed(2));
    if (!criterionId || !notes.trim() || !evidence.trim() || (outcome !== 'UNASSESSABLE' && timestampSeconds == null)) {
      setMessage('Chọn tiêu chí, thời điểm bằng chứng và ghi căn cứ/ghi chú Coach.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      await request(`/coach/shared-exercise-analyses/${analysis.id}/technique-labels`, {
        method: 'POST',
        body: JSON.stringify({
          labels: [{
            criterionId,
            outcome,
            cameraView,
            repNumber: Number(rep) || null,
            startSeconds: startSec,
            endSeconds: endSec,
            timestampSeconds,
            reviewerNotes: notes.trim(),
            evidence: {
              observation: evidence.trim(),
              sampledAtSeconds: timestampSeconds,
              cameraView,
            },
          }],
        }),
      });
      setMessage('Đã lưu nhãn Coach (kèm góc quay, phiên bản tiêu chí & lịch sử chỉnh sửa) và cập nhật bảng đối chiếu AI/Coach.');
      setNotes(''); setEvidence('');
      await onReload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không lưu được nhãn Coach.'); }
    finally { setBusy(false); }
  };

  const saveReview = async () => {
    const standard = analysis.result?.techniqueEvaluation;
    if (!standard || !criterionId || !qualification.trim() || !recordId.trim() || !scope.trim() || !conditions.trim()) {
      setMessage('Cần chuẩn, Coach, hồ sơ rà soát, phạm vi và điều kiện đề xuất.');
      return;
    }
    let proposedThresholds: unknown;
    try { proposedThresholds = JSON.parse(thresholds); } catch { setMessage('Ngưỡng đề xuất phải là JSON hợp lệ.'); return; }
    setBusy(true); setMessage('');
    try {
      await request('/coach/shared-exercise-analyses/criteria-review', {
        method: 'POST',
        body: JSON.stringify({
          exerciseType: standard.exercise,
          exerciseVariant: standard.exerciseVariant,
          standardVersion: standard.referenceStandardVersion,
          standardDigest: standard.referenceStandardDigest,
          criterionId,
          decision: 'CONTENT_REVIEWED_PENDING_VIDEO_VALIDATION',
          qualification: qualification.trim(),
          reviewRecordId: recordId.trim(),
          reviewScope: scope.trim(),
          approvedConditions: conditions.trim(),
          proposedThresholds,
        }),
      });
      setMessage('Đã lưu rà soát tiêu chí vào hệ thống (trạng thái COACH_REVIEWED_PENDING_VIDEO_VALIDATION).');
      await onReload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không lưu được rà soát tiêu chí.'); }
    finally { setBusy(false); }
  };

  const exportHoldoutBundle = async () => {
    setBusy(true); setMessage('');
    try {
      const res = await request<{ data: Record<string, unknown> }>(`/coach/shared-exercise-analyses/${analysis.id}/export-holdout-bundle`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const dlUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = dlUrl;
      anchor.download = `holdout-analysis-${analysis.id}.json`;
      anchor.click();
      URL.revokeObjectURL(dlUrl);
      setMessage('Đã xuất gói Holdout JSON (manifestEntry + coachLabelsDocument) cho evaluate_technique.py.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không xuất được gói Holdout JSON.'); }
    finally { setBusy(false); }
  };

  const releaseCriterion = async () => {
    const reviewId = Number(releaseReviewId);
    if (!Number.isSafeInteger(reviewId) || !reportPath.trim() || !reportSha256.trim() ||
        !acceptanceCriteriaId.trim() || !releaseModelVersion.trim() || !releaseRuleVersion.trim() ||
        !releaseViews.trim() || !signatureName.trim() || !signaturePassword || !releaseConfirmed) {
      setMessage('Cần hồ sơ Coach, báo cáo holdout, phạm vi model/rule/camera và xác nhận bằng mật khẩu.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      await request(`/coach/shared-exercise-analyses/criteria-reviews/${reviewId}/release`, {
        method: 'POST', body: JSON.stringify({
          password: signaturePassword, signatureName: signatureName.trim(),
          confirmation: 'I_APPROVE_THIS_CRITERION_AFTER_INDEPENDENT_VALIDATION',
          reportPath: reportPath.trim(), reportSha256: reportSha256.trim(),
          acceptanceCriteriaId: acceptanceCriteriaId.trim(),
          scope: { exerciseVariant: analysis.result?.techniqueEvaluation?.exerciseVariant,
            cameraViews: releaseViews.split(',').map(item => item.trim().toUpperCase()).filter(Boolean),
            modelVersion: releaseModelVersion.trim(), ruleVersion: releaseRuleVersion.trim() },
        }),
      });
      setMessage('Coach đã ký duyệt; báo cáo holdout được kiểm tra và tiêu chí đã phát hành cho đúng phạm vi.');
      setSignaturePassword(''); setReleaseConfirmed(false);
      await onReload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không thể phát hành tiêu chí.'); }
    finally { setBusy(false); }
  };

  if (!criteria.length) return <p className="text-xs text-muted-foreground">Kết quả này không có snapshot tiêu chí kỹ thuật để gắn nhãn.</p>;
  return <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">Gắn nhãn, Đối chiếu AI/Coach & Duyệt tiêu chí kỹ thuật</h4>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void exportHoldoutBundle()}>
        Xuất gói Holdout JSON (evaluate_technique.py)
      </Button>
    </div>

    {!!repetitions.length && (
      <div className="space-y-1">
        <p className="text-xs font-medium">Chọn nhanh Rep từ AI để điền khoảng thời gian và nhảy tới đáy rep:</p>
        <div className="flex flex-wrap gap-1.5">
          {repetitions.map(r => (
            <Button key={r.number} type="button" variant="outline" size="sm" onClick={() => selectRep(r)}>
              Rep {r.number} ({r.startSeconds.toFixed(1)}s–{r.endSeconds.toFixed(1)}s · đáy {r.bottomSeconds.toFixed(1)}s)
            </Button>
          ))}
        </div>
      </div>
    )}

    <label className="block text-xs">
      Tiêu chí
      <select className="mt-1 w-full rounded border bg-background p-2" value={criterionId} onChange={event => setCriterionId(event.target.value)}>
        {criteria.map(item => <option key={item.criterionId} value={item.criterionId}>{item.criterionId} · {item.title} ({item.status})</option>)}
      </select>
    </label>

    {!!perRepMeasurements.length && (
      <div className="rounded border bg-background p-2 text-xs">
        <p className="font-medium">Số đo AI theo từng rep cho {criterionId}:</p>
        <div className="mt-1 space-y-1">
          {perRepMeasurements.map((m, idx) => (
            <div key={idx} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1 last:border-b-0">
              <span>Rep {m.repNumber}{m.side ? ` (${m.side})` : ''} · {m.timestampSeconds?.toFixed(2)}s: <code>{JSON.stringify(m.observedValue)}</code></span>
              <span className="text-muted-foreground">{m.measurementQuality?.sufficientForExperimentalComparison ? 'Đủ chất lượng đối chiếu' : `Trừ/Abstain (${m.measurementQuality?.reasonCode || 'LOW_QUALITY'})`}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="grid grid-cols-3 gap-2">
      <label className="text-xs">Nhãn Coach<select className="mt-1 w-full rounded border bg-background p-2" value={outcome} onChange={event => setOutcome(event.target.value)}><option value="MEETS">Đạt quan sát (MEETS)</option><option value="IMPROVE">Cần cải thiện (IMPROVE)</option><option value="UNASSESSABLE">Chưa đủ dữ liệu (UNASSESSABLE)</option></select></label>
      <label className="text-xs">Góc quay (Camera View)<select className="mt-1 w-full rounded border bg-background p-2" value={cameraView} onChange={event => setCameraView(event.target.value)}><option value="SIDE">Góc ngang (SIDE)</option><option value="FRONT">Góc chính diện (FRONT)</option><option value="OBLIQUE">Góc chéo (OBLIQUE)</option><option value="UNKNOWN">Chưa rõ (UNKNOWN)</option></select></label>
      <label className="text-xs">Số rep<input className="mt-1 w-full rounded border p-2" type="number" min="1" value={rep} onChange={event => setRep(event.target.value)} /></label>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <label className="text-xs">Bắt đầu (giây)<span className="flex gap-1"><input className="mt-1 min-w-0 flex-1 rounded border p-2" type="number" step="0.01" value={start} onChange={event => setStart(event.target.value)} /><Button type="button" variant="outline" size="sm" onClick={() => capture('start')}>Lấy video</Button></span></label>
      <label className="text-xs">Thời điểm bằng chứng (giây)<span className="flex gap-1"><input className="mt-1 min-w-0 flex-1 rounded border p-2" type="number" step="0.01" value={stamp} onChange={event => setStamp(event.target.value)} /><Button type="button" variant="outline" size="sm" onClick={() => capture('stamp')}>Lấy video</Button></span></label>
      <label className="text-xs">Kết thúc (giây)<span className="flex gap-1"><input className="mt-1 min-w-0 flex-1 rounded border p-2" type="number" step="0.01" value={end} onChange={event => setEnd(event.target.value)} /><Button type="button" variant="outline" size="sm" onClick={() => capture('end')}>Lấy video</Button></span></label>
    </div>
    <Textarea placeholder="Bằng chứng quan sát: bộ phận, hướng chuyển động, góc quay..." value={evidence} onChange={event => setEvidence(event.target.value)} />
    <Textarea placeholder="Ghi chú Coach" value={notes} onChange={event => setNotes(event.target.value)} />
    <Button size="sm" disabled={busy} onClick={() => void saveLabel()}>Lưu nhãn video cho tiêu chí</Button>

    {comparison && comparison.totalLabels > 0 && (
      <div className="space-y-2 rounded border bg-background p-2.5 text-xs">
        <p className="font-semibold">
          Bảng đối chiếu AI vs Coach ({comparison.totalLabels} nhãn hiện hành · {comparison.totalRevisions ?? comparison.totalLabels} lượt lưu · Khớp: {comparison.agreeCount} · Lệch FP: {comparison.disagreeFalsePositiveCount} · Lệch FN: {comparison.disagreeFalseNegativeCount} · AI từ chối kết luận: {comparison.aiAbstainedCount})
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-1">Tiêu chí</th>
                <th className="p-1">Rep / Thời gian / Góc quay</th>
                <th className="p-1">Coach</th>
                <th className="p-1">AI Official</th>
                <th className="p-1">AI Candidate</th>
                <th className="p-1">Đối chiếu</th>
                <th className="p-1">Phiên bản & Lịch sử</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map(row => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="p-1 font-medium">{row.criterionId}</td>
                  <td className="p-1">Rep {row.repNumber ?? '-'} ({row.startSeconds}s–{row.endSeconds}s · bằng chứng {row.timestampSeconds ?? '-'}s · {row.cameraView || 'AUTO'})</td>
                  <td className="p-1">{row.coachOutcome}</td>
                  <td className="p-1">{row.officialStatus}</td>
                  <td className="p-1">{row.candidateStatus}</td>
                  <td className="p-1 font-medium">{row.agreement}</td>
                  <td className="p-1 text-muted-foreground">
                    Rev #{row.revision ?? 1} · {row.standardVersion || 'draft'}
                    {row.editHistory && row.editHistory.length > 1 && (
                      <span className="block text-[11px]">
                        Lịch sử: {row.editHistory.map(h => `#${h.revision}:${h.outcome}`).join(' → ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    <details className="space-y-2">
      <summary className="cursor-pointer text-sm font-medium">Rà soát điều kiện/ngưỡng & Duyệt nội dung tiêu chí (chờ kiểm chứng video holdout)</summary>
      <input className="w-full rounded border p-2 text-sm" placeholder="Chuyên môn / chứng chỉ Coach (VD: NSCA-CPT, HLV Thể hình Cấp 1)" value={qualification} onChange={event => setQualification(event.target.value)} />
      <input className="w-full rounded border p-2 text-sm" placeholder="Mã hồ sơ rà soát (VD: REV-SQUAT-03-2026)" value={recordId} onChange={event => setRecordId(event.target.value)} />
      <Textarea placeholder="Phạm vi: biến thể, camera, nhóm áp dụng" value={scope} onChange={event => setScope(event.target.value)} />
      <Textarea placeholder="Điều kiện đạt/chưa đạt đề xuất và căn cứ huấn luyện" value={conditions} onChange={event => setConditions(event.target.value)} />
      <Textarea placeholder="Ngưỡng đề xuất dạng JSON (tự động điền từ candidate policy)" value={thresholds} onChange={event => setThresholds(event.target.value)} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void saveReview()}>Lưu rà soát Coach · chờ kiểm chứng Holdout</Button>
      {savedReviews.length > 0 && (
        <div className="mt-2 rounded border bg-background p-2 text-xs">
          <p className="font-semibold">Lịch sử rà soát tiêu chí của bạn ({savedReviews.length}):</p>
          {savedReviews.map(rev => (
            <p key={rev.id} className="mt-1 border-b pb-1 last:border-b-0">
              <strong>{rev.criterionId}</strong> · {rev.status} · Mã hồ sơ: {rev.reviewRecordId} · {new Date(rev.reviewedAt).toLocaleString('vi-VN')}
            </p>
          ))}
        </div>
      )}
    </details>
    <details className="space-y-2">
      <summary className="cursor-pointer text-sm font-medium">Coach ký duyệt & phát hành tiêu chí sau Holdout độc lập</summary>
      <p className="text-xs text-muted-foreground">Chỉ gửi khi đã có nhãn Coach thật, báo cáo Holdout độc lập đạt ngưỡng và hash của video/nhãn/inference khớp. Hệ thống sẽ từ chối nếu thiếu bằng chứng; review nội dung không tự phát hành.</p>
      {releasableReviews.length === 0 ? <p className="text-xs">Chưa có hồ sơ rà soát nội dung đang chờ kiểm chứng cho {criterionId}.</p> : <>
        <label className="block text-xs">Hồ sơ Coach<select className="mt-1 w-full rounded border bg-background p-2" value={releaseReviewId} onChange={event => setReleaseReviewId(event.target.value)}>{releasableReviews.map(item => <option key={item.id} value={item.id}>{item.reviewRecordId} · {item.criterionId}</option>)}</select></label>
        <input className="w-full rounded border p-2 text-sm" placeholder="Đường dẫn báo cáo: evaluation/private/...json" value={reportPath} onChange={event => setReportPath(event.target.value)} />
        <input className="w-full rounded border p-2 text-sm" placeholder="SHA-256 của báo cáo Holdout" value={reportSha256} onChange={event => setReportSha256(event.target.value)} />
        <input className="w-full rounded border p-2 text-sm" placeholder="Acceptance criteria ID đã chốt trước Holdout" value={acceptanceCriteriaId} onChange={event => setAcceptanceCriteriaId(event.target.value)} />
        <input className="w-full rounded border p-2 text-sm" placeholder={`Model version của Holdout (${analysis.result?.modelVersion || 'xem report'})`} value={releaseModelVersion} onChange={event => setReleaseModelVersion(event.target.value)} />
        <input className="w-full rounded border p-2 text-sm" placeholder={`Rule version của Holdout (${analysis.result?.ruleVersion || 'xem report'})`} value={releaseRuleVersion} onChange={event => setReleaseRuleVersion(event.target.value)} />
        <input className="w-full rounded border p-2 text-sm" placeholder="Góc quay đã kiểm chứng, ví dụ FRONT hoặc SIDE" value={releaseViews} onChange={event => setReleaseViews(event.target.value)} />
        <input className="w-full rounded border p-2 text-sm" placeholder="Họ tên Coach để ký xác nhận" value={signatureName} onChange={event => setSignatureName(event.target.value)} />
        <input className="w-full rounded border p-2 text-sm" type="password" autoComplete="current-password" placeholder="Mật khẩu Coach để ký xác nhận" value={signaturePassword} onChange={event => setSignaturePassword(event.target.value)} />
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={releaseConfirmed} onChange={event => setReleaseConfirmed(event.target.checked)} />Tôi đã kiểm tra nhãn, báo cáo Holdout độc lập và đồng ý phát hành riêng tiêu chí/phạm vi này.</label>
        <Button type="button" disabled={busy || !releaseConfirmed} onClick={() => void releaseCriterion()}>Kiểm tra bằng chứng, ký duyệt và phát hành</Button>
      </>}
    </details>
    {!!message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </div>;
}

export function CoachSharedExerciseAnalyses() {
  const [items, setItems] = useState<Shared[]>([]);
  const [candidatePolicies, setCandidatePolicies] = useState<Record<string, unknown>>({});
  const [savedReviews, setSavedReviews] = useState<CriterionReviewRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const [result, reviewsRes] = await Promise.all([
        request<{ data: Shared[]; candidatePolicies?: Record<string, unknown> }>('/coach/shared-exercise-analyses'),
        request<{ data: CriterionReviewRow[]; candidatePolicies?: Record<string, unknown> }>('/coach/shared-exercise-analyses/criteria-reviews').catch(() => ({ data: [], candidatePolicies: {} })),
      ]);
      setItems(result.data);
      setCandidatePolicies(result.candidatePolicies || reviewsRes.candidatePolicies || {});
      setSavedReviews(reviewsRes.data || []);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được kết quả AI.'); }
  };
  useEffect(() => { void load(); }, []);
  const send = async (analysisId: number) => {
    const comment = drafts[analysisId]?.trim();
    if (!comment) return;
    setBusyId(analysisId);
    try {
      await request(`/coach/shared-exercise-analyses/${analysisId}/feedback`, { method: 'POST', body: JSON.stringify({ comment }) });
      setDrafts(current => ({ ...current, [analysisId]: '' }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không gửi được góp ý.'); }
    finally { setBusyId(null); }
  };
  return <Card>
    <CardHeader><CardTitle>AI Form Check được học viên chia sẻ</CardTitle><CardDescription>Chỉ thấy kết quả được chia sẻ khi quan hệ PT còn hiệu lực. Phản hồi AI là gợi ý, không phải kết luận an toàn.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => void load()}>Tải lại</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!items.length && !error && <p className="text-sm text-muted-foreground">Chưa có kết quả nào được chia sẻ.</p>}
      {items.map(({ analysis, sharedAt, aiCoachComparison }) => <div key={analysis.id} className="space-y-3 rounded-xl border p-4">
        <div><strong>{analysis.member.fullName} · {analysis.result?.techniqueEvaluation?.exercise || 'Squat'}</strong><p className="text-xs text-muted-foreground">Chia sẻ {new Date(sharedAt).toLocaleString('vi-VN')} · {analysis.studentPlanId ? 'Từ giáo án' : 'Tự tập'}</p></div>
        <p className="text-sm">{analysis.status === 'COMPLETED' ? `Nhận diện ${analysis.result?.detectedRepetitions ?? 0} lần lặp` : 'Chưa đủ dữ liệu để đánh giá'}</p>
        <SharedVideo analysis={analysis} comparison={aiCoachComparison} candidatePolicies={candidatePolicies} savedReviews={savedReviews} onReload={load} />
        {analysis.result?.observations.map((row, index) => <p key={index} className="rounded-lg bg-muted p-2 text-sm">{row.timestampSeconds.toFixed(1)}s · {row.message}<br /><span className="text-muted-foreground">{row.suggestion}</span></p>)}
        {analysis.result?.limitations.map((line, index) => <p key={index} className="text-xs text-muted-foreground">• {line}</p>)}
        {analysis.feedback.map(row => <p key={row.id} className="rounded-lg border-l-2 border-primary pl-3 text-sm"><span className="text-xs text-muted-foreground">Góp ý của bạn · {new Date(row.createdAt).toLocaleString('vi-VN')}</span><br />{row.comment}</p>)}
        <Textarea aria-label={`Góp ý cho ${analysis.member.fullName}`} placeholder="Xác nhận hoặc điều chỉnh nhận xét AI: ghi rõ rep, thời điểm quan sát và hướng sửa..." maxLength={1000} value={drafts[analysis.id] || ''} onChange={event => setDrafts(current => ({ ...current, [analysis.id]: event.target.value }))} />
        <Button size="sm" disabled={busyId === analysis.id || !drafts[analysis.id]?.trim()} onClick={() => void send(analysis.id)}>Gửi góp ý</Button>
      </div>)}
    </CardContent>
  </Card>;
}
