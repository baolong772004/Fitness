import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  MessageSquarePlus,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import { API_BASE_URL, request, tokenStorage } from '../../services/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export type SharedExerciseAnalysisItem = {
  id: number;
  sharedAt: string;
  memberPtLevel?: string;
  priority24h?: boolean;
  responseDeadlineAt?: string | null;
  analysis: {
    id: number;
    status: string;
    studentPlanId: number | null;
    videoAvailable?: boolean;
    videoStoredAvailable?: boolean;
    memberPtLevel?: string;
    priority24h?: boolean;
    responseDeadlineAt?: string | null;
    member: { id: number; fullName: string };
    result: {
      detectedRepetitions: number | null;
      repetitions?: { number: number; startSeconds: number; bottomSeconds: number; endSeconds: number }[];
      observations: { message: string; timestampSeconds: number; suggestion: string }[];
      limitations: string[];
      video?: { durationSeconds?: number };
      cameraView?: { detected?: string; requested?: string };
      exerciseVariant?: string;
      techniqueEvaluation?: {
        exercise: string;
        exerciseVariant: string;
        headline?: string;
        passedCriteria?: number;
        needsImprovementCriteria?: number;
      };
    } | null;
    feedback: { id: number; comment: string; createdAt: string }[];
  };
};

const viewLabel: Record<string, string> = {
  FRONT: 'Góc chính diện',
  SIDE: 'Góc ngang',
  OBLIQUE: 'Góc chéo',
};

const variantLabel: Record<string, string> = {
  BODYWEIGHT: 'Bodyweight',
  WEIGHTED: 'Có tạ',
  STANDARD: 'Cơ bản',
};

function getInitials(name: string) {
  return (name || 'HV')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

function SharedVideoPlayer({ analysis }: { analysis: SharedExerciseAnalysisItem['analysis'] }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const repetitions = analysis.result?.repetitions || [];
  const observations = analysis.result?.observations || [];

  useEffect(() => {
    if (!analysis.videoAvailable) return;
    const controller = new AbortController();
    let objectUrl = '';
    setLoading(true);
    setError('');
    void fetch(`${API_BASE_URL}/coach/shared-exercise-analyses/${analysis.id}/video`, {
      headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}` },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async response => {
        if (!response.ok) throw new Error('Video hết hạn hoặc không thể tải.');
        return response.blob();
      })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [analysis.id, analysis.videoAvailable]);

  const seekTo = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  if (!analysis.videoAvailable) {
    const message =
      analysis.videoStoredAvailable === false
        ? 'Video đã hết hạn lưu trữ. Học viên có thể gửi video mới để bạn xem lại.'
        : 'Chưa có video đính kèm cho lượt chia sẻ này.';
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
        <Film className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border bg-black shadow-sm">
        {loading && !url && (
          <div className="flex h-64 items-center justify-center text-sm text-white/80">
            Đang tải video bài tập...
          </div>
        )}
        {error && (
          <div role="alert" className="flex h-64 items-center justify-center p-4 text-center text-sm text-red-300">
            {error}
          </div>
        )}
        {url && (
          <>
            <video
              ref={videoRef}
              src={url}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
              className="max-h-[340px] w-full object-contain"
            />
            <div className="flex items-center justify-between bg-black/80 px-3 py-1.5 text-xs text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-amber-400" />
                Mốc hiện tại: <strong className="tabular-nums text-white">{currentTime.toFixed(1)}s</strong>
              </span>
              {analysis.result?.video?.durationSeconds != null && (
                <span className="tabular-nums text-white/60">
                  Thời lượng: {analysis.result.video.durationSeconds}s
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {url && (repetitions.length > 0 || observations.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Tua nhanh:</span>
          {repetitions.map(r => (
            <button
              key={`rep-${r.number}`}
              type="button"
              onClick={() => seekTo(r.bottomSeconds)}
              className="inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:bg-primary/5"
            >
              <Play className="size-3 text-primary" />
              Rep {r.number}
              <span className="text-[11px] text-muted-foreground tabular-nums">({r.bottomSeconds.toFixed(1)}s)</span>
            </button>
          ))}
          {observations.map((obs, idx) => (
            <button
              key={`obs-${idx}`}
              type="button"
              onClick={() => seekTo(obs.timestampSeconds)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-500/20"
            >
              Lưu ý {obs.timestampSeconds.toFixed(1)}s
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CoachSharedExerciseAnalysesProps {
  selectedMemberId?: number | null;
  selectedMemberName?: string | null;
  onSelectMember?: (memberId: number) => void;
  onSharedMemberIdsChange?: (countsByMemberId: Record<number, number>) => void;
}

export function CoachSharedExerciseAnalyses({
  selectedMemberId = null,
  selectedMemberName = null,
  onSelectMember,
  onSharedMemberIdsChange,
}: CoachSharedExerciseAnalysesProps) {
  const [items, setItems] = useState<SharedExerciseAnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openVideoById, setOpenVideoById] = useState<Record<number, boolean>>({});
  const [openFormById, setOpenFormById] = useState<Record<number, boolean>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await request<{ data: SharedExerciseAnalysisItem[] }>('/coach/shared-exercise-analyses');
      const rows = result.data || [];
      setItems(rows);
      if (onSharedMemberIdsChange) {
        const counts: Record<number, number> = {};
        for (const item of rows) {
          const mid = item.analysis.member.id;
          counts[mid] = (counts[mid] || 0) + 1;
        }
        onSharedMemberIdsChange(counts);
      }
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được kết quả AI.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleVideo = (analysisId: number) => {
    setOpenVideoById(current => ({ ...current, [analysisId]: !current[analysisId] }));
  };

  const toggleForm = (analysisId: number) => {
    setOpenFormById(current => ({ ...current, [analysisId]: !current[analysisId] }));
  };

  const send = async (analysisId: number) => {
    const comment = drafts[analysisId]?.trim();
    if (!comment) return;
    setBusyId(analysisId);
    try {
      await request(`/coach/shared-exercise-analyses/${analysisId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
      setDrafts(current => ({ ...current, [analysisId]: '' }));
      setOpenFormById(current => ({ ...current, [analysisId]: false }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gửi được góp ý.');
    } finally {
      setBusyId(null);
    }
  };

  // Group members who have shared videos so Coach can quickly see/pick them
  const sharedMembers = Array.from(
    items.reduce((map, item) => {
      const m = item.analysis.member;
      const existing = map.get(m.id);
      if (existing) existing.count += 1;
      else map.set(m.id, { id: m.id, fullName: m.fullName, count: 1 });
      return map;
    }, new Map<number, { id: number; fullName: string; count: number }>()).values()
  );

  const visibleItems =
    selectedMemberId != null
      ? items.filter(item => item.analysis.member.id === selectedMemberId)
      : [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Film className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Video bài tập học viên chia sẻ</CardTitle>
                {items.length > 0 && (
                  <Badge variant="secondary" className="tabular-nums">
                    {items.length} video
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-0.5 text-xs sm:text-sm">
                Chọn học viên để xem danh sách video đã chia sẻ, bấm mở video hoặc bật form góp ý khi cần.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </Button>
        </div>

        {/* Quick Member Filter Pills */}
        {sharedMembers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground">Học viên có video chia sẻ:</span>
            {sharedMembers.map(member => {
              const active = selectedMemberId === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onSelectMember?.(member.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'bg-background text-foreground hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <Video className="size-3.5" />
                  {member.fullName}
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                      active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {member.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-4 sm:p-5">
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center">
            <UserRound className="mb-2 size-7 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Chưa có video nào được học viên chia sẻ</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Khi học viên bấm "Chia sẻ với Coach" trên ứng dụng Mobile, video sẽ hiển thị tại đây.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && selectedMemberId == null && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 py-7 text-center">
            <Video className="mb-2 size-7 text-primary/60" />
            <p className="text-sm font-medium text-foreground">
              Chọn một học viên ở trên hoặc ở danh sách "Học viên PT phụ trách" để hiện video
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hiện có {sharedMembers.length} học viên đã chia sẻ tổng cộng {items.length} video bài tập.
            </p>
          </div>
        )}

        {!loading && selectedMemberId != null && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 py-7 text-center">
            <Film className="mb-2 size-7 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              Học viên {selectedMemberName || `#${selectedMemberId}`} chưa chia sẻ video bài tập nào
            </p>
            {sharedMembers.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Bạn có thể bấm vào tên học viên có biểu tượng máy quay ở thanh phía trên để xem video của họ.
              </p>
            )}
          </div>
        )}

        {visibleItems.map(({ analysis, sharedAt, memberPtLevel, priority24h }) => {
          const exerciseName = analysis.result?.techniqueEvaluation?.exercise || 'SQUAT';
          const variant = analysis.result?.exerciseVariant || analysis.result?.techniqueEvaluation?.exerciseVariant;
          const camera = analysis.result?.cameraView?.detected;
          const repsCount = analysis.result?.detectedRepetitions ?? 0;
          const isVideoOpen = !!openVideoById[analysis.id];
          const isFormOpen = !!openFormById[analysis.id];
          const ptLevel = memberPtLevel || analysis.memberPtLevel || 'INTERMEDIATE';
          const isPriority24h = Boolean(priority24h ?? analysis.priority24h ?? ptLevel === 'ADVANCED');

          return (
            <div key={analysis.id} className={`rounded-2xl border bg-card p-4 shadow-xs transition hover:border-primary/30 ${isPriority24h && analysis.feedback.length === 0 ? 'border-amber-500/40 bg-amber-500/[0.03]' : ''}`}>
              {/* Compact Row Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {getInitials(analysis.member.fullName)}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground sm:text-base">{analysis.member.fullName}</h3>
                      <Badge variant="default" className="text-xs">
                        {exerciseName}
                        {variant && variantLabel[variant] ? ` · ${variantLabel[variant]}` : ''}
                      </Badge>
                      {isPriority24h ? (
                        <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-xs font-semibold text-rose-700">
                          ⚡ Gói Nâng cao · Ưu tiên phản hồi 24h
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-800">
                          Gói Trung cấp · PT nhận xét trực tiếp
                        </Badge>
                      )}
                      {camera && viewLabel[camera] && (
                        <Badge variant="outline" className="text-xs">
                          {viewLabel[camera]}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="gap-1 text-xs font-semibold">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        {analysis.status === 'COMPLETED' ? `${repsCount} lần lặp` : 'Cần xem trực tiếp'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Chia sẻ lúc {new Date(sharedAt).toLocaleString('vi-VN')} ·{' '}
                      {analysis.studentPlanId ? 'Theo giáo án PT' : 'Tự tập ngoài giờ'}
                      {analysis.feedback.length > 0 && ` · Đã có ${analysis.feedback.length} góp ý`}
                    </p>
                  </div>
                </div>

                {/* Action Toggle Buttons (Bật / Tắt Video & Form Góp ý) */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isVideoOpen ? 'default' : 'outline'}
                    onClick={() => toggleVideo(analysis.id)}
                  >
                    <Video className="size-4" />
                    {isVideoOpen ? 'Ẩn video' : 'Xem video'}
                    {isVideoOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={isFormOpen ? 'secondary' : 'outline'}
                    onClick={() => toggleForm(analysis.id)}
                  >
                    <MessageSquarePlus className="size-4" />
                    {isFormOpen ? 'Đóng form góp ý' : 'Góp ý kỹ thuật'}
                  </Button>
                </div>
              </div>

              {/* Collapsible Video & Feedback Section */}
              {(isVideoOpen || isFormOpen || analysis.feedback.length > 0) && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  {isVideoOpen && (
                    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                      <SharedVideoPlayer analysis={analysis} />

                      <div className="space-y-3">
                        {analysis.result?.observations && analysis.result.observations.length > 0 ? (
                          <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                              <Sparkles className="size-3.5 text-amber-600" />
                              Dấu hiệu chuyển động AI ghi nhận:
                            </p>
                            {analysis.result.observations.map((row, index) => (
                              <div key={index} className="rounded-lg bg-background/90 p-2.5 text-xs leading-relaxed">
                                <span className="font-semibold text-foreground">Mốc {row.timestampSeconds.toFixed(1)}s:</span>{' '}
                                {row.message}
                                {row.suggestion && (
                                  <p className="mt-1 text-muted-foreground">→ Gợi ý: {row.suggestion}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border bg-muted/15 p-3.5 text-xs text-muted-foreground">
                            Video ghi nhận {repsCount} lần lặp hoàn chỉnh. Bạn có thể bấm các nút <strong>Rep 1, Rep 2...</strong> bên dưới video để kiểm tra tư thế đáy từng lần lặp.
                          </div>
                        )}

                        {!isFormOpen && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => toggleForm(analysis.id)}
                          >
                            <MessageSquarePlus className="size-4" />
                            Mở form viết góp ý cho {analysis.member.fullName}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Existing Feedback List */}
                  {analysis.feedback.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Góp ý đã gửi ({analysis.feedback.length})
                      </p>
                      <div className="space-y-2">
                        {analysis.feedback.map(row => (
                          <div
                            key={row.id}
                            className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-sm"
                          >
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-semibold text-primary">Coach góp ý</span>
                              <span>{new Date(row.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-foreground">{row.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toggleable Feedback Form (Bật / Tắt) */}
                  {isFormOpen && (
                    <div className="space-y-2.5 rounded-xl border bg-muted/20 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Gửi nhận xét kỹ thuật cho {analysis.member.fullName}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleForm(analysis.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-3.5" /> Đóng
                        </button>
                      </div>
                      <Textarea
                        aria-label={`Góp ý cho ${analysis.member.fullName}`}
                        rows={3}
                        className="resize-none bg-background text-sm"
                        placeholder={`Nhập nhận xét kỹ thuật cho ${analysis.member.fullName} (ví dụ: Rep 2-3 cần mở gối theo mũi chân, giữ lưng thẳng khi đứng lên)...`}
                        maxLength={1000}
                        value={drafts[analysis.id] || ''}
                        onChange={event =>
                          setDrafts(current => ({ ...current, [analysis.id]: event.target.value }))
                        }
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Học viên sẽ nhận được góp ý ngay trong mục AI Form Check.
                        </span>
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => toggleForm(analysis.id)}>
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyId === analysis.id || !drafts[analysis.id]?.trim()}
                            onClick={() => void send(analysis.id)}
                          >
                            <Send className="size-3.5" />
                            {busyId === analysis.id ? 'Đang gửi...' : 'Gửi góp ý'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
