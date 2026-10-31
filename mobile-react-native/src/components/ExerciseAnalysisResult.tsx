import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Circle, Line } from 'react-native-svg';
import { API_URL, sessionStore } from '../lib/api';
import { type Analysis, type Observation, type Criterion, type TechniqueEvaluation, type ExperimentalEvaluation, type ProvisionalEvaluation } from '../lib/exerciseAnalysis';
import { poseOverlayToleranceSeconds, resultRepetitions, visibleExperimentalEvaluation, visibleProvisionalEvaluation } from '../lib/exerciseAnalysisData';
import { aura } from '../lib/theme';

const labels: Record<string, string> = { DEPTH_CONSISTENCY: 'Biên độ giữa các rep', TORSO_LEAN_CHANGE: 'Độ nghiêng thân', TEMPO_CONSISTENCY: 'Nhịp xuống / lên', KNEE_TRAVEL_CONSISTENCY: 'Vị trí gối so với cổ chân', LEFT_RIGHT_SYMMETRY: 'Đối xứng trái / phải' };
const connections = [['Shoulder', 'Elbow'], ['Elbow', 'Wrist'], ['Shoulder', 'Hip'], ['Hip', 'Knee'], ['Knee', 'Ankle'], ['Ankle', 'Heel'], ['Heel', 'Toe'], ['Toe', 'Ankle']] as const;
const bodyNames: Record<string, string> = { HIP: 'Hông / độ sâu', TORSO: 'Thân người', KNEE: 'Gối', LEFT_KNEE: 'Gối trái', RIGHT_KNEE: 'Gối phải', WHOLE_BODY: 'Nhịp và chuyển động', FEET: 'Bàn chân' };
const unsupportedCriteria = new Set(['LUMBAR_CURVATURE', 'HEEL_LIFT', 'BALANCE', 'LEFT_RIGHT_SYMMETRY']);
const metricNames: Record<string, string> = { descentSeconds: 'Thời gian xuống', ascentSeconds: 'Thời gian lên', totalSeconds: 'Thời gian rep', completedCycleObserved: 'Đã thấy chu kỳ hoàn chỉnh', hipAboveKneeRatio: 'Hông cao hơn gối theo chiều dài đùi', minimumProjectedKneeDegrees: 'Góc gối nhỏ nhất trên ảnh', maximumProjectedLeanDegrees: 'Độ nghiêng thân lớn nhất', earlyAscentLeanChangeDegrees: 'Thay đổi góc thân đầu pha lên', hipShoulderRiseDifferenceRatio: 'Chênh lệch nâng hông–vai', inwardChangeStanceRatio: 'Dịch chuyển gối vào giữa', ankleDriftStandingLegRatio: 'Dịch chuyển cổ chân', descentDifferenceFromClipMedianSeconds: 'Chênh nhịp xuống với trung vị clip', ascentDifferenceFromClipMedianSeconds: 'Chênh nhịp lên với trung vị clip' };
const unitNames: Record<string, string> = { seconds: 'giây', degrees: '°', torso_lengths: 'lần chiều dài thân', body_lengths: 'lần chiều dài cơ thể', boolean: '', projected_femur_length: 'lần chiều dài đùi trên ảnh', standing_leg_length: 'lần chiều dài chân', stance_width: 'lần khoảng cách hai chân' };

function evidenceText(item: Observation) {
  if (item.evidenceText) return item.evidenceText;
  const e = item.evidence;
  if (!e) return '';
  if (item.code === 'VARIABLE_ROM') return `Biên độ ${e.rangeDegrees}°; lớn nhất trong video ${e.largestRangeDegrees}°.`;
  if (item.code === 'INCREASING_TORSO_LEAN') return `Lần đầu ${e.firstDegrees}° → lần cuối ${e.lastDegrees}° (tăng ${e.changeDegrees}°).`;
  if (item.code === 'VARIABLE_TEMPO') return `Pha ${e.phase === 'descentSeconds' ? 'xuống' : 'lên'}: ${e.seconds}s; ngắn nhất ${e.shortestSeconds}s.`;
  if (item.code === 'VARIABLE_KNEE_TRAVEL') return `Khoảng ngang gối–cổ chân / chiều dài cẳng chân: ${e.ratio}; nhỏ nhất ${e.smallestRatio}.`;
  return '';
}

type EvidenceSeek = { time: number; serial: number; joints?: string[] };
function AnalysisVideo({ analysis, seek, developerMode = false }: { analysis: Analysis; seek: EvidenceSeek | null; developerMode?: boolean }) {
  const token = sessionStore.token();
  const source = useMemo(() => ({ uri: `${API_URL}/exercise-analysis/${developerMode ? `developer/${analysis.id}` : analysis.id}/video`, headers: { Authorization: `Bearer ${token}` }, useCaching: false }), [analysis.id, token, developerMode]);
  const player = useVideoPlayer(source, value => { value.timeUpdateEventInterval = 0.1; });
  const [time, setTime] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 280 });
  const [error, setError] = useState('');
  useEffect(() => {
    const update = player.addListener('timeUpdate', event => setTime(event.currentTime));
    const status = player.addListener('statusChange', event => setError(event.status === 'error' ? 'Không mở được video. Video có thể đã hết hạn; hãy tải lại kết quả.' : ''));
    return () => { update.remove(); status.remove(); };
  }, [player]);
  useEffect(() => {
    if (seek) {
      player.pause();
      // Expo VideoPlayer is a mutable native handle; currentTime is its documented seek API.
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = seek.time;
      setTime(seek.time);
    }
  }, [player, seek]);
  const frames = analysis.result?.poseFrames || [];
  const nearest = frames.reduce<(typeof frames)[number] | undefined>((best, frame) => !best || Math.abs(frame.timeSeconds - time) < Math.abs(best.timeSeconds - time) ? frame : best, undefined);
  const sampleRateHz = analysis.result?.video?.sampleRateHz || 5;
  // Sampling uses the first decoded frame at/after each 100 ms boundary, so
  // PTS quantization can put that sample farther than half a sample interval
  // from the native player's requested timestamp.
  const durationSeconds = analysis.result?.video?.durationSeconds;
  // At the clip boundary the final decoded sample has no later neighbour.
  // Hold it only through the recorded duration, within one sampling period.
  const overlayToleranceSeconds = poseOverlayToleranceSeconds(nearest?.timeSeconds ?? -1,
    frames[frames.length - 1]?.timeSeconds ?? -2, time, durationSeconds, sampleRateHz);
  const frameDeltaSeconds = nearest ? Math.abs(nearest.timeSeconds - time) : null;
  const frame = nearest && frameDeltaSeconds != null && frameDeltaSeconds <= overlayToleranceSeconds ? nearest : undefined;
  const video = analysis.result?.video;
  const scale = video && video.width > 0 && video.height > 0 ? Math.min(size.width / video.width, size.height / video.height) : 0;
  const width = (video?.width || 0) * scale;
  const height = (video?.height || 0) * scale;
  const left = (size.width - width) / 2;
  const top = (size.height - height) / 2;
  const active = analysis.result?.observations.find(item => Math.abs(item.timestampSeconds - time) <= 0.4);
  const point = (name: string) => { const p = frame?.landmarks[name]; return p && p.visibility >= 0.6 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? { x: left + p.x * width, y: top + p.y * height } : null; };
  const color = (side: string, joint: string) => (seek?.joints?.includes(side + joint) && Math.abs(seek.time - time) <= .6) || active && (active.bodyPart === 'WHOLE_BODY' || (active.bodyPart === 'HIP' && ['Hip', 'Knee'].includes(joint)) || ((active.bodyPart === 'KNEE' || active.bodyPart === `${side.toUpperCase()}_KNEE`) && ['Knee', 'Ankle', 'Heel', 'Toe'].includes(joint)) || (active.bodyPart === 'TORSO' && ['Shoulder', 'Hip'].includes(joint))) ? '#FFC04D' : '#63F4CB';
  return <View style={{ marginTop: 12 }}>
    <View onLayout={event => setSize(event.nativeEvent.layout)} style={{ height: 280, backgroundColor: '#161C1B', borderRadius: 12, overflow: 'hidden' }}>
      <VideoView player={player} nativeControls contentFit="contain" surfaceType="textureView" fullscreenOptions={{ enable: false }} style={StyleSheet.absoluteFill} />
      {overlay && frame && !!scale && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width={size.width} height={size.height}>
        {['left', 'right'].map(side => <React.Fragment key={side}>
          {connections.map(([a, b]) => { const from = point(side + a); const to = point(side + b); return from && to ? <Line key={a + b} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color(side, b)} strokeWidth={frame.side === 'BOTH' || side.toUpperCase() === frame.side ? 3 : 1.5} opacity={frame.side === 'BOTH' || side.toUpperCase() === frame.side ? 1 : 0.55} /> : null; })}
          {['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle', 'Heel', 'Toe'].map(joint => { const p = point(side + joint); return p ? <Circle key={joint} cx={p.x} cy={p.y} r={4} fill={color(side, joint)} stroke="#173B32" strokeWidth={1} /> : null; })}
        </React.Fragment>)}
      </Svg></View>}
    </View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!frames.length && <Pressable accessibilityRole="switch" accessibilityState={{ checked: overlay }} onPress={() => setOverlay(value => !value)} style={styles.chip}><Text style={styles.strong}>{overlay ? '☑' : '☐'} Hiện khung xương</Text></Pressable>}
    <Text style={styles.muted}>{time.toFixed(1)}s{frame ? ` · Pose mẫu ${frame.timeSeconds.toFixed(3)}s (lệch ${(frameDeltaSeconds || 0).toFixed(3)}s) · ${frame.repNumber ? `Rep ${frame.repNumber} · ` : ''}${frame.kneeAngleDegrees == null ? 'Theo dõi điểm khớp trên ảnh' : `Gối ${frame.kneeAngleDegrees}° · Thân ${frame.torsoLeanDegrees}°`}` : frames.length ? ` · Không có mẫu pose gần nhất đủ sát (${nearest?.timeSeconds.toFixed(3)}s, lệch ${(frameDeltaSeconds || 0).toFixed(3)}s)` : ' · Kết quả này không có dữ liệu khung xương để hiển thị'}</Text>
    {!!frames.length && <Text style={styles.small}>Màu vàng chỉ vị trí cần xem lại, không khẳng định lỗi. Pose được lấy mẫu {sampleRateHz} lần/giây; overlay ghép mẫu gần nhất trong {overlayToleranceSeconds.toFixed(3)} giây.</Text>}
  </View>;
}

export function ExerciseAnalysisResult({ analysis, showExperimental = false }: { analysis: Analysis; showExperimental?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [seek, setSeek] = useState<EvidenceSeek | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const result = analysis.result;
  const experimental = visibleExperimentalEvaluation(analysis, showExperimental);
  const provisional = visibleProvisionalEvaluation(analysis, showExperimental);
  const reps = useMemo(() => resultRepetitions(result), [result]);
  const rep = reps.find(item => item.number === selected);
  const jump = (time: number, number?: number, joints?: string[]) => { setSeek(value => ({ time, serial: (value?.serial || 0) + 1, joints })); if (number) setSelected(number); };
  const observations = rep ? rep.observations : result?.observations || [];
  const priority = result?.observations[0];
  const hasProvisionalCheck = (rep?.criteria || result?.criteria || []).some(item => item.status === 'ASSESSED' && !['MOVEMENT_TIMING', 'JOINT_MOTION'].includes(item.code));
  const needs = provisional?.criteria.filter(item => item.status === 'NEEDS_IMPROVEMENT').map(item => item.title) || [];
  const meets = provisional?.criteria.filter(item => item.status === 'MEETS_CRITERION').map(item => item.title) || [];
  return <View>
    <Text style={styles.strong}>{result?.exercise.replaceAll('_', ' ')}{result?.exerciseVariant ? ` · ${result.exerciseVariant}` : ''}</Text>
    {!!result?.techniqueEvaluation && (result.techniqueEvaluation.passedCriteria > 0 || result.techniqueEvaluation.needsImprovementCriteria > 0 || !provisional) && <Text style={styles.muted}>Chính thức: Đạt {result.techniqueEvaluation.passedCriteria} · Cần cải thiện {result.techniqueEvaluation.needsImprovementCriteria}</Text>}
    {!!provisional && <View style={[styles.notice, { borderWidth: 2, borderColor: '#C77800' }]}>
      <Text style={styles.strong}>AI thử nghiệm · Chưa kiểm chứng</Text>
      <Text style={styles.muted}>Cần cải thiện: {needs.length ? needs.join(', ') : 'Chưa phát hiện trong phần đã đo'}</Text>
      <Text style={styles.muted}>Tín hiệu đạt: {meets.length ? meets.join(', ') : 'Chưa có'}</Text>
      <Text style={styles.small}>Chưa đánh giá: {provisional.unassessableCriteria}/{provisional.criteria.length}. Chưa kết luận toàn bộ bài tập.</Text>
      {provisional.correctionPriorities?.slice(0, 1).map(item => <Pressable key={item.criterionId} onPress={() => { setShowDetails(true); jump(item.timestampSeconds, item.repNumber); }}>
        <Text style={styles.link}>{bodyNames[item.bodyPart] || item.bodyPart} · Rep {item.affectedReps.join(', ')} · {item.timestampSeconds.toFixed(1)}s</Text>
        <Text style={styles.muted}>{item.feedback}</Text>
      </Pressable>)}
    </View>}
    <Text style={styles.strong}>{analysis.status === 'COMPLETED' ? result?.detectedRepetitions == null ? 'Đã nhận diện khớp; chưa đếm rep cho bài này' : `Nhận diện ${result.detectedRepetitions} lần lặp` : result?.analysisCoverage === 'VALID_SEGMENTS_ONLY' ? 'Đã đo được khớp trên một đoạn; chưa xác định được rep hoàn chỉnh' : 'Chưa đủ dữ liệu để đánh giá'}</Text>
    {analysis.status !== 'COMPLETED' && !!result?.limitations[0] && <Text style={styles.muted}>{result.limitations[0]}</Text>}
    {['squat-observation-4', 'squat-observation-5', 'squat-observation-6'].includes(analysis.ruleVersion || '') && <Text style={styles.small}>Đây là kết quả đã lưu trước bản cập nhật phân tích. Chọn và gửi lại video để nhận kết quả mới.</Text>}
    {result?.cameraView && <Text style={styles.muted}>Góc quay: {result.cameraView.detected === 'SIDE' ? 'ngang' : result.cameraView.detected === 'FRONT' ? 'chính diện' : result.cameraView.detected === 'OBLIQUE' ? 'chéo (đo số lần và nhịp)' : 'chưa xác định rõ'}. {result.protocol?.depthTarget === 'HIP_AT_KNEE' ? 'Mục tiêu: hông gần ngang gối. ' : ''}{result.protocol?.descentTargetSeconds ? `Nhịp mục tiêu: ${result.protocol.descentTargetSeconds}s xuống.` : ''}</Text>}
    {analysis.videoAvailable ? <AnalysisVideo analysis={analysis} seek={seek} developerMode={showExperimental} /> : <Text style={styles.muted}>Video không còn được lưu. Bạn vẫn có thể xem các số đo và nhận xét.</Text>}
    <Pressable accessibilityRole="button" onPress={() => setShowDetails(value => !value)}><Text style={styles.link}>{showDetails ? 'Ẩn chi tiết kỹ thuật' : 'Xem chi tiết từng rep và bằng chứng'}</Text></Pressable>
    {showDetails && <>
    {!!result?.techniqueEvaluation && <TechniqueEvaluationPanel evaluation={result.techniqueEvaluation} jump={jump} />}
    {!!provisional && <ExperimentalEvaluationPanel evaluation={provisional} jump={jump} memberProvisional />}
    {!!experimental && <ExperimentalEvaluationPanel evaluation={experimental} jump={jump} />}
    {!!priority && <View style={styles.notice}><Text style={styles.strong}>Gợi ý thử ở lần quay tiếp theo</Text><Text style={styles.muted}>{priority.suggestion}</Text><Pressable onPress={() => jump(priority.timestampSeconds, priority.repNumber)}><Text style={styles.link}>Xem dấu hiệu tại {priority.timestampSeconds.toFixed(1)}s</Text></Pressable></View>}
    {!!reps.length && <>
      <Text style={styles.strong}>Xem từng rep</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Pressable style={styles.chip} onPress={() => setSelected(null)}><Text>{selected == null ? '● ' : ''}Tất cả</Text></Pressable>{reps.map(item => <Pressable key={item.number} style={[styles.chip, selected === item.number && { borderColor: aura.caramel }]} onPress={() => jump(item.bottomSeconds, item.number)}><Text>Rep {item.number}{item.observations.length ? ' · cần xem lại' : ''}</Text></Pressable>)}</View>
      {rep && <View style={styles.notice}>
        <Text style={styles.strong}>Rep {rep.number} · {rep.startSeconds}s – {rep.endSeconds}s</Text>
        <Text style={styles.muted}>Đáy {rep.bottomSeconds}s · Xuống {rep.descentSeconds}s · Lên {rep.ascentSeconds}s</Text>
        {rep.minimumKneeAngle != null && <Text style={styles.muted}>Gối nhỏ nhất (đã làm mượt) {rep.minimumKneeAngle}° · Biên độ {rep.rangeDegrees}° · Hông tại đáy {rep.bottomHipAngleDegrees == null ? 'chưa có số đo' : `${rep.bottomHipAngleDegrees}°`} · Nghiêng thân tối đa {rep.maximumTorsoLeanDegrees}°</Text>}
        {rep.hipTravelRatio != null && <Text style={styles.small}>Chuyển động hông theo chiều dọc: {rep.hipTravelRatio.toFixed(2)} lần chiều dài chân trên ảnh. Số đo này không dùng để kết luận độ sâu.</Text>}
        <Pressable onPress={() => jump(rep.startSeconds, rep.number)}><Text style={styles.link}>Về đầu rep để xem lại</Text></Pressable>
        {!rep.criteria?.length && rep.notAssessed.map(item => <Text key={item.code} style={styles.small}>Chưa đánh giá: {item.reason}</Text>)}
      </View>}
    </>}
    {analysis.status === 'COMPLETED' && !observations.length && <Text style={styles.muted}>{hasProvisionalCheck ? `Chưa phát hiện dấu hiệu vượt ngưỡng thử nghiệm${rep ? ' ở rep này' : ''}.` : 'Chưa đủ căn cứ nhận xét kỹ thuật.'} Xem các số đo và mục chưa thể đánh giá bên dưới; kết quả không xác nhận toàn bộ kỹ thuật là đúng.</Text>}
    {observations.map((item, index) => <Pressable key={`${item.code}-${index}`} style={styles.notice} onPress={() => jump(item.timestampSeconds, item.repNumber)}>
      <Text style={styles.small}>{bodyNames[item.bodyPart || ''] || 'Chuyển động'}{item.kind === 'WITHIN_CLIP_COMPARISON' ? ' · so sánh các rep' : ' · dấu hiệu quan sát'}</Text>
      <Text style={styles.strong}>{item.message}</Text><Text style={styles.link}>{item.repNumber ? `Rep ${item.repNumber} · ` : ''}{item.timestampSeconds.toFixed(1)}s · Bấm để xem</Text>
      {!!evidenceText(item) && <Text style={styles.muted}>Quan sát: {evidenceText(item)}</Text>}
      <Text style={styles.muted}>Lần sau thử: {item.suggestion}</Text>
      <Text style={styles.small}>Độ rõ điểm khớp: {Math.round(item.confidence * 100)}% — không phải xác suất nhận xét đúng.</Text>
      {!!item.limitation && <Text style={styles.small}>{item.limitation}</Text>}
    </Pressable>)}
    {!result?.techniqueEvaluation && <CriterionList items={rep?.criteria || result?.criteria || []} />}
    {result?.limitations.map((item, index) => <Text key={index} style={styles.small}>• {item}</Text>)}
    </>}
  </View>;
}

function ExperimentalEvaluationPanel({ evaluation, jump, memberProvisional = false }: { evaluation: ExperimentalEvaluation | ProvisionalEvaluation; jump: (time: number, number?: number, joints?: string[]) => void; memberProvisional?: boolean }) {
  const [showLandmarks, setShowLandmarks] = useState(false);
  const format = (value: unknown) => typeof value === 'number' ? String(Math.round(value * 10000) / 10000) : String(value ?? '—');
  const metricLabel = (criterionId: string) => ({
    'SQUAT-01': 'Tổng thời gian chu kỳ',
    'SQUAT-02': 'Hông cao hơn gối trên ảnh',
    'SQUAT-03': 'Gối dịch vào giữa',
    'SQUAT-04': 'Độ tăng nghiêng thân đầu pha lên',
    'SQUAT-05': 'Độ lệch nhịp so với trung vị hiệp',
    'SQUAT-08': 'Đối chiếu mục tiêu cá nhân',
  } as Record<string, string>)[criterionId] || 'Giá trị quan sát';
  const metricUnit = (criterionId: string, units?: string) => ({
    'SQUAT-01': 'giây',
    'SQUAT-02': 'lần chiều dài đùi trên ảnh',
    'SQUAT-03': 'lần khoảng cách hai chân',
    'SQUAT-04': 'độ',
    'SQUAT-05': 'giây',
    'SQUAT-08': units === 'seconds' ? 'giây' : 'lần chiều dài đùi trên ảnh',
  } as Record<string, string>)[criterionId] || (units || '');
  const reason = (code: string | null) => ({
    VIEW_NOT_SUITABLE: 'Cần góc quay phù hợp để đo tiêu chí này.',
    NO_EXPERIMENTAL_DECISION_RULE: 'Có số đo nhưng chưa có ngưỡng/quy tắc thử nghiệm để dự đoán đạt hoặc cần cải thiện.',
    NO_INDIVIDUAL_TARGET: 'Thiếu mục tiêu cá nhân có cấu trúc để so sánh.',
    NO_EXPLICIT_DEPTH_TARGET: 'Cần chọn mục tiêu hông ngang gối trước khi so sánh độ sâu từ góc ngang.',
    FOOT_ANCHOR_DRIFT_UNVERIFIED: 'Mốc cổ chân thay đổi trên ảnh; chưa thể tách di chuyển chân và camera để kết luận vị trí khớp.',
    FOOT_REFERENCE_SCALE_UNVERIFIED: 'Chiều dài gót–mũi chân trên ảnh thay đổi; mốc không gian chưa ổn định để kết luận.',
    SINGLE_REP_NO_TEMPO_BASELINE: 'Cần từ 2 rep trở lên để so sánh độ ổn định nhịp giữa các lần lặp.',
    INPUT_QUALITY_INSUFFICIENT: 'Video chưa đủ dữ liệu đầu vào để dự đoán kỹ thuật.',
    REP_DETECTION_NOT_IMPLEMENTED: 'Bài này chưa có bộ tách rep để gắn số đo với từng lần tập.',
    HOLD_SEGMENTATION_NOT_IMPLEMENTED: 'Bài giữ tư thế chưa có bộ xác định đoạn giữ ổn định.',
    CAMERA_VIEW_NOT_VERIFIED: 'Chưa xác minh được góc quay từ video.',
    NO_VALIDATED_BILATERAL_DECISION_RULE: 'Có số đo hai bên nhưng chưa có quy tắc đối xứng phù hợp.',
    NO_FLOOR_CALIBRATION: 'Landmark không xác nhận được mặt sàn/tiếp xúc gót chân.',
    NOT_SUPPORTED: 'Phương pháp hiện không hỗ trợ kết luận cho tiêu chí này.',
    NO_MEASUREMENT: 'Không có số đo cho tiêu chí này.',
  } as Record<string, string>)[code || ''] || `Chưa đủ điều kiện (${code || 'UNKNOWN'}).`;
  return <View style={[styles.notice, { borderWidth: 2, borderColor: '#C77800' }]}>
    <Text style={[styles.strong, { color: '#8A4B00' }]}>{memberProvisional ? 'PHÂN TÍCH THAM KHẢO · CHƯA ĐƯỢC KIỂM CHỨNG' : 'CHẾ ĐỘ DEVELOPER'} · {evaluation.ruleVersion}</Text>
    <Text style={styles.muted}>{evaluation.warning}</Text>
    <Text style={styles.small}>Dự đoán theo tiêu chí: đạt {evaluation.passedCriteria} · cần cải thiện {evaluation.needsImprovementCriteria} · chưa đủ điều kiện {evaluation.unassessableCriteria}. Đây không phải kết quả ĐẠT/CẦN CẢI THIỆN chính thức.</Text>
    <Pressable accessibilityRole="button" onPress={() => setShowLandmarks(value => !value)}><Text style={styles.link}>{showLandmarks ? 'Ẩn tọa độ khớp' : 'Xem tọa độ khớp làm bằng chứng'}</Text></Pressable>
    {evaluation.criteria.map(item => <View key={item.criterionId} style={styles.chip}>
      <Text style={styles.strong}>{item.status === 'MEETS_CRITERION' ? 'Dự đoán đạt tiêu chí' : item.status === 'NEEDS_IMPROVEMENT' ? 'Dự đoán cần cải thiện' : 'Chưa thể dự đoán'} · {item.title}</Text>
      {!item.predictions.length && (item.missingRequirements?.length ? item.missingRequirements : [item.reasonCode]).map((code, index) => <Text key={`${code}-${index}`} style={styles.small}>{reason(code)} {code}</Text>)}
      {item.predictions.map((row, index) => <Pressable key={`${row.repNumber}-${row.bodyPart}-${index}`} onPress={() => jump(row.timestampSeconds, row.repNumber, row.landmarkEvidence?.flatMap(point => Object.keys(point.landmarks)))}>
        <Text style={styles.link}>{row.status === 'MEETS_CRITERION' ? 'Dự đoán đạt' : row.status === 'NEEDS_IMPROVEMENT' ? 'Dự đoán cần cải thiện' : 'Chưa thể dự đoán'} · {bodyNames[row.bodyPart] || row.bodyPart} · Rep {row.repNumber} · {row.timestampSeconds.toFixed(2)}s</Text>
        <Text style={styles.small}>{metricLabel(item.criterionId)}: {format(row.observedValue)} {metricUnit(item.criterionId, row.units)} · mục tiêu thử nghiệm {row.threshold?.minimum != null ? `${format(row.threshold.minimum)}–${format(row.threshold.maximum)}` : `≤ ${format(row.threshold?.maximum)}`}</Text>
        {!!row.threshold && <Text style={styles.small}>Cơ sở ngưỡng: {row.threshold.source}. {row.reasonCode}</Text>}
        <Text style={styles.small}>{row.feedback}</Text>
        {showLandmarks && row.landmarkEvidence?.map(point => <Text key={point.timestampSeconds} style={styles.small}>Bằng chứng {point.timestampSeconds.toFixed(2)}s: {Object.entries(point.landmarks).map(([name, joint]) => `${name} (${joint.x.toFixed(3)}, ${joint.y.toFixed(3)}; ${Math.round(joint.visibility * 100)}%)`).join(' · ')}</Text>)}
      </Pressable>)}
    </View>)}
    <Text style={styles.small}>{memberProvisional ? 'SQUAT-01 chỉ kiểm tra chu kỳ; SQUAT-05 chỉ kiểm tra nhịp. Các dự đoán là heuristic 2D chưa có nhãn Coach và không xác nhận toàn bộ bài tập đạt kỹ thuật. Gửi video cho Coach xem lại.' : 'Các nhãn dự đoán này là heuristic phát triển, không dùng cho quyết định huấn luyện chính thức.'}</Text>
  </View>;
}

function TechniqueEvaluationPanel({ evaluation, jump }: { evaluation: TechniqueEvaluation; jump: (time: number, number?: number, joints?: string[]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const label = (status: string) => ['PASS', 'MEETS_CRITERION'].includes(status) ? 'ĐẠT' : status === 'NEEDS_IMPROVEMENT' ? 'CẦN CẢI THIỆN' : status === 'MEASURED' ? 'ĐÃ ĐO · THỬ NGHIỆM' : status === 'NOT_SUPPORTED' ? 'CHƯA HỖ TRỢ KẾT LUẬN' : 'CHƯA ĐỦ DỮ LIỆU';
  const conclusive = evaluation.criteria.filter(item => ['PASS', 'MEETS_CRITERION', 'NEEDS_IMPROVEMENT'].includes(item.status));
  const pending = evaluation.criteria.filter(item => !conclusive.includes(item));
  const timingRows = (evaluation.criteria.find(item => item.code === 'SQUAT-01')?.measurement?.perRep || [])
    .filter(row => row.measurementQuality?.continuousTracking === true);
  const format = (value: unknown): string => typeof value === 'number' ? `${Math.round(value * 1000) / 1000}` : typeof value === 'string' ? value : JSON.stringify(value);
  const advice = (item: (typeof evaluation.criteria)[number]) => typeof item.improvement === 'string' ? item.improvement : [...(item.improvement?.suggestions || item.improvement?.adjustments || []), item.improvement?.retry].filter(Boolean).join(' ');
  return <View style={{ marginTop: 14 }}>
    <Text style={styles.strong}>Đánh giá kỹ thuật theo tiêu chí</Text>
    <Text style={styles.muted}>{['PASS', 'MEETS_CRITERION'].includes(evaluation.status) ? 'Đạt các tiêu chí đã kiểm tra' : evaluation.headline}</Text>
    <Text style={styles.small}>Đạt: {evaluation.passedCriteria} · Cần cải thiện: {evaluation.needsImprovementCriteria} · Chưa kết luận: {evaluation.unableCriteria ?? pending.length}</Text>
    <Text style={styles.small}>Đã đo {evaluation.measuredCriteria}/{evaluation.criteria.length} nhóm tiêu chí · {evaluation.referenceStandardVersion || evaluation.engineVersion}</Text>
    {evaluation.planContext && <View style={styles.notice}><Text style={styles.strong}>Giáo án Coach · phiên bản {evaluation.planContext.planVersion || 'đã lưu'}</Text><Text style={styles.muted}>{evaluation.planContext.exerciseName}: {evaluation.planContext.sets} hiệp × {evaluation.planContext.reps} lần{evaluation.planContext.weightKg == null ? '' : ` · ${evaluation.planContext.weightKg} kg`}</Text><Text style={styles.small}>{evaluation.planContext.notes || 'Chưa có mục tiêu kỹ thuật dạng cấu trúc.'} {evaluation.planContext.limitation}</Text></View>}
    {conclusive.map(item => <View key={item.code} style={styles.notice}><Text style={styles.strong}>{label(item.status)} · {item.title}</Text>{item.verdicts?.map((row, index) => <Pressable key={index} onPress={() => jump(row.timestampSeconds, row.repNumber, row.landmarkEvidence?.flatMap(point => Object.keys(point.landmarks)))}><Text style={styles.link}>Rep {row.repNumber}{row.side ? ` · ${row.side === 'LEFT' ? 'trái' : row.side === 'RIGHT' ? 'phải' : row.side}` : ''} · {label(row.status)} · {row.timestampSeconds.toFixed(1)}s · Xem bằng chứng</Text><Text style={styles.muted}>Đo: {format(row.observedValue)} · Mục tiêu: {format(row.targetValue)}</Text><Text style={styles.muted}>{row.feedback?.reason} {row.feedback?.adjustments?.join(' ') || advice(item)}</Text><Text style={styles.small}>{row.feedback?.retry} {row.feedback?.coachReview}</Text></Pressable>)}</View>)}
    {!conclusive.length && <Text style={styles.muted}>Chưa có tiêu chí được duyệt đủ để kết luận ĐẠT hoặc CẦN CẢI THIỆN.</Text>}
    {!conclusive.length && !!timingRows.length && <View style={styles.notice}>
      <Text style={styles.strong}>PHÂN TÍCH THAM KHẢO – CHƯA ĐƯỢC KIỂM CHỨNG</Text>
      <Text style={styles.small}>AI nhận diện chu kỳ và thời gian từng rep từ các khung hình liên tục. Đây là số đo nhịp tập, chưa kết luận kỹ thuật đạt hay cần cải thiện.</Text>
      {timingRows.map(row => {
        const down = row.observedValue?.descentSeconds;
        const up = row.observedValue?.ascentSeconds;
        return <Pressable key={`timing-${row.repNumber}`} onPress={() => jump(row.timestampSeconds, row.repNumber, row.landmarkEvidence?.flatMap(point => Object.keys(point.landmarks)))}>
          <Text style={styles.link}>Rep {row.repNumber} · {row.timestampSeconds.toFixed(1)}s · xuống {typeof down === 'number' ? down.toFixed(2) : '—'}s, lên {typeof up === 'number' ? up.toFixed(2) : '—'}s · Xem bằng chứng</Text>
        </Pressable>;
      })}
      <Text style={styles.small}>Nếu muốn biết động tác có phù hợp hay cần sửa gì, hãy chia sẻ video để Coach xem. Các số đo khớp và lý do chưa đánh giá được nằm bên dưới.</Text>
    </View>}
    <Pressable accessibilityRole="button" onPress={() => setExpanded(value => !value)}><Text style={styles.link}>{expanded ? 'Thu gọn' : 'Xem số đo, bằng chứng và điều kiện còn thiếu'} ({pending.length})</Text></Pressable>
    {expanded && pending.map((item, index) => {
      const extreme = item.measurement?.minimum;
      const peak = item.measurement?.maximum;
      return <View key={`${item.code}-${index}`} style={styles.notice}>
        <Text style={styles.strong}>{label(item.status)} · {item.title}</Text>
        <Text style={styles.muted}>{item.description}</Text>
        <Text style={styles.small}>Khớp: {item.joints.join(', ')} · Góc phù hợp: {item.cameraViews.join('/')}</Text>
        {!!item.reason && <Text style={styles.small}>{item.reason}</Text>}
        {!!item.measurement?.range && <Text style={styles.muted}>Số đo {item.measurement.side || ''}: {item.measurement.range.min}–{item.measurement.range.max} {item.measurement.unit || ''} trên {item.measurement.sampleCount} khung hình.</Text>}
        {[extreme, peak].map((point, position) => point && <Pressable key={position} onPress={() => jump(point.timeSeconds)}><Text style={styles.link}>{position ? 'Cao nhất' : 'Thấp nhất'}: {point.value} {item.measurement?.unit} tại {point.timeSeconds.toFixed(1)}s · Xem video</Text><Text style={styles.small}>{Object.entries(point.joints).map(([name, joint]) => `${name} (${joint.x.toFixed(2)}, ${joint.y.toFixed(2)}; rõ ${Math.round(joint.visibility * 100)}%)`).join(' · ')}</Text></Pressable>)}
        {item.measurement?.perRep?.map((row, position) => <Pressable key={`${row.repNumber}-${row.side}-${position}`} onPress={() => jump(row.timestampSeconds, row.repNumber, row.landmarkEvidence?.flatMap(point => Object.keys(point.landmarks)))}><Text style={styles.link}>Rep {row.repNumber} · {row.timestampSeconds.toFixed(1)}s{row.side ? ` · ${row.side === 'LEFT' ? 'trái' : row.side === 'RIGHT' ? 'phải' : 'hai bên'}` : ''} · Xem video</Text><Text style={styles.small}>{row.observedValue ? Object.entries(row.observedValue).map(([key, value]) => `${metricNames[key] || key}: ${typeof value === 'boolean' ? value ? 'có' : 'chưa' : format(value)} ${unitNames[row.units?.[key] || ''] ?? row.units?.[key] ?? ''}`).join(' · ') : typeof row.evidence?.description === 'string' ? row.evidence.description : ''}</Text>{row.landmarkEvidence?.map(point => <Text key={point.timestampSeconds} style={styles.small}>Khớp tại {point.timestampSeconds.toFixed(1)}s: {Object.entries(point.landmarks).map(([name, joint]) => `${name} (${joint.x.toFixed(2)}, ${joint.y.toFixed(2)}; rõ ${Math.round(joint.visibility * 100)}%)`).join(' · ')}</Text>)}</Pressable>)}
        <Text style={styles.small}>Cách thử lại: {advice(item)}</Text>
        <Text style={styles.small}>Trạng thái kiểm chứng: {item.validation}</Text>
      </View>;
    })}
    {evaluation.limitations.map((item, index) => <Text key={index} style={styles.small}>• {item}</Text>)}
  </View>;
}

function CriterionList({ items }: { items: Criterion[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const assessed = items.filter(item => item.status === 'ASSESSED');
  const unavailable = items.filter(item => item.status !== 'ASSESSED' && !unsupportedCriteria.has(item.code));
  const unsupported = items.filter(item => item.status !== 'ASSESSED' && unsupportedCriteria.has(item.code));
  return <View style={{ marginTop: 12 }}>
    <Text style={styles.strong}>Đã kiểm tra ({assessed.length})</Text>
    {assessed.map(item => <View key={item.code}><Text style={styles.muted}>• {item.title || labels[item.code] || item.code}{item.totalReps ? ` · ${item.assessedReps}/${item.totalReps} rep` : ''}{item.outcome === 'SIGNAL' ? ' · có dấu hiệu cần xem' : item.outcome === 'NO_SIGNAL' ? ' · chưa thấy dấu hiệu vượt ngưỡng' : item.outcome === 'MEASURED' ? ' · đã đo' : ' · đã so sánh'}</Text></View>)}
    <Text style={styles.strong}>Chưa thể đánh giá ({unavailable.length})</Text>
    {unavailable.map(item => <View key={item.code}><Text style={styles.muted}>• {item.title || labels[item.code] || item.code}</Text><Text style={styles.small}>{item.reason}</Text></View>)}
    {!!unsupported.length && <Text style={styles.small}>Chưa được hỗ trợ: {unsupported.map(item => item.title || labels[item.code] || item.code).join(', ')}.</Text>}
    <Pressable onPress={() => setExpanded(value => !value)}><Text style={styles.link}>{expanded ? 'Ẩn' : 'Xem'} căn cứ và giới hạn từng tiêu chí</Text></Pressable>
    {expanded && assessed.map(item => <View key={item.code} style={styles.notice}><Text style={styles.strong}>{item.title || labels[item.code] || item.code}</Text><Text style={styles.small}>{item.evidence?.description || item.formula}</Text><Text style={styles.small}>{item.qualityConditions}</Text><Text style={styles.small}>{item.limitation}</Text></View>)}
  </View>;
}

const styles = StyleSheet.create({
  strong: { color: aura.ink, fontWeight: '700', marginTop: 10 },
  muted: { color: aura.muted, lineHeight: 20, marginTop: 6 },
  small: { color: aura.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  link: { color: aura.darkCoffee, fontWeight: '700', marginTop: 8 },
  error: { color: '#B3261E', marginTop: 8 },
  chip: { backgroundColor: '#FFF9F2', borderColor: aura.border, borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
  notice: { backgroundColor: '#FFF8EF', borderRadius: 13, padding: 12, marginTop: 12 },
});
