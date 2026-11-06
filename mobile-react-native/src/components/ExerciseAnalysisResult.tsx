import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Circle, Line } from 'react-native-svg';
import type { Analysis } from '../lib/exerciseAnalysis';
import { API_URL, sessionStore } from '../lib/api';
import { poseOverlayToleranceSeconds, resultRepetitions } from '../lib/exerciseAnalysisData';
import { buildSquatRepFeedback } from '../lib/squatRepFeedback';
import { aura } from '../lib/theme';

const connections = [['Shoulder', 'Elbow'], ['Elbow', 'Wrist'], ['Shoulder', 'Hip'], ['Hip', 'Knee'],
  ['Knee', 'Ankle'], ['Ankle', 'Heel'], ['Heel', 'Toe'], ['Toe', 'Ankle']] as const;

type EvidenceSeek = { time: number; serial: number; joints?: string[]; title?: string };
function AnalysisVideo({ analysis, showExperimental, seek }: { analysis: Analysis; showExperimental: boolean; seek: EvidenceSeek | null }) {
  const token = sessionStore.token();
  const source = useMemo(() => ({ uri: `${API_URL}/exercise-analysis/${showExperimental ? `developer/${analysis.id}` : analysis.id}/video`,
    headers: { Authorization: `Bearer ${token}` }, useCaching: false }), [analysis.id, showExperimental, token]);
  const player = useVideoPlayer(source, value => { value.timeUpdateEventInterval = 0.1; });
  const [time, setTime] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 280 });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(player.status === 'readyToPlay');
  useEffect(() => {
    const update = player.addListener('timeUpdate', event => setTime(event.currentTime));
    const status = player.addListener('statusChange', event => {
      setReady(event.status === 'readyToPlay');
      setError(event.status === 'error' ? 'Không mở được video. Video có thể đã hết hạn.' : '');
    });
    return () => { update.remove(); status.remove(); };
  }, [player]);
  useEffect(() => {
    if (!seek || !ready) return;
    player.pause();
    // Expo VideoPlayer is a mutable native handle; currentTime is its seek API.
    // eslint-disable-next-line react-hooks/immutability
    player.currentTime = seek.time;
    setTime(seek.time);
  }, [player, seek, ready]);
  const frames = analysis.result?.poseFrames || [];
  const nearest = frames.reduce<(typeof frames)[number] | undefined>((best, frame) =>
    !best || Math.abs(frame.timeSeconds - time) < Math.abs(best.timeSeconds - time) ? frame : best, undefined);
  const video = analysis.result?.video;
  const sampleRateHz = video?.sampleRateHz || 5;
  const tolerance = poseOverlayToleranceSeconds(nearest?.timeSeconds ?? -1,
    frames[frames.length - 1]?.timeSeconds ?? -2, time, video?.durationSeconds, sampleRateHz);
  const frame = nearest && Math.abs(nearest.timeSeconds - time) <= tolerance ? nearest : null;
  const scale = video && video.width > 0 && video.height > 0 ? Math.min(size.width / video.width, size.height / video.height) : 0;
  const width = (video?.width || 0) * scale;
  const height = (video?.height || 0) * scale;
  const left = (size.width - width) / 2;
  const top = (size.height - height) / 2;
  const point = (name: string) => {
    const joint = frame?.landmarks[name];
    return joint && joint.visibility >= 0.6 && joint.x >= 0 && joint.x <= 1 && joint.y >= 0 && joint.y <= 1
      ? { x: left + joint.x * width, y: top + joint.y * height } : null;
  };
  const color = (name: string) => seek?.joints?.includes(name) && Math.abs(time - seek.time) <= 0.25 ? '#FFC04D' : '#63F4CB';
  return <View style={{ marginTop: 12 }}>
    <View onLayout={event => setSize(event.nativeEvent.layout)} style={{ height: 280, backgroundColor: '#161C1B', borderRadius: 12, overflow: 'hidden' }}>
      <VideoView player={player} nativeControls contentFit="contain" surfaceType="textureView" fullscreenOptions={{ enable: false }} style={StyleSheet.absoluteFill} />
      {overlay && frame && scale > 0 && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width={size.width} height={size.height}>
        {['left', 'right'].map(side => <React.Fragment key={side}>
          {connections.map(([start, end]) => {
            const from = point(side + start); const to = point(side + end);
            return from && to ? <Line key={start + end} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color(side + end)} strokeWidth={frame.side === 'BOTH' || side.toUpperCase() === frame.side ? 3 : 1.5} /> : null;
          })}
          {['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle', 'Heel', 'Toe'].map(joint => {
            const location = point(side + joint);
            return location ? <Circle key={joint} cx={location.x} cy={location.y} r={4} fill={color(side + joint)} stroke="#173B32" strokeWidth={1} /> : null;
          })}
        </React.Fragment>)}
      </Svg></View>}
    </View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {frames.length > 0 ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: overlay }} onPress={() => setOverlay(value => !value)} style={styles.toggle}>
      <Text style={styles.title}>{overlay ? '☑' : '☐'} Hiện khung xương</Text>
    </Pressable> : <Text style={styles.muted}>Kết quả này chưa có dữ liệu khung xương để hiển thị.</Text>}
  </View>;
}

export function ExerciseAnalysisResult({ analysis, showExperimental = false }: {
  analysis: Analysis; showExperimental?: boolean;
}) {
  const result = analysis.result;
  const reps = useMemo(() => resultRepetitions(result), [result]);
  const [seek, setSeek] = useState<EvidenceSeek | null>(null);
  const [evidenceVisible, setEvidenceVisible] = useState(false);
  const [expandedRep, setExpandedRep] = useState<number | null>(1);
  const [sourceDetails, setSourceDetails] = useState(false);
  const screening = useMemo(() => result?.exercise === 'SQUAT'
    ? buildSquatRepFeedback(result) : [], [result]);

  if (!result) return <Text style={styles.muted}>Chưa có kết quả phân tích.</Text>;
  const olderSquatResult = result.exercise === 'SQUAT' &&
    (result.resultVersion || analysis.resultVersion) !== 'exercise-analysis-result-4';

  return <View>
    <Text style={styles.heading}>{result.exercise.replaceAll('_', ' ')}</Text>
    {analysis.videoAvailable && <AnalysisVideo analysis={analysis} showExperimental={showExperimental} seek={seek} />}
    {!analysis.videoAvailable && <Text style={styles.muted}>Video không còn được lưu (tối đa 7 ngày); kết quả nhận xét vẫn xem được.</Text>}
    {!!screening.length && <Text style={styles.note}>AI Coach · Đánh giá theo từng tiêu chí quan sát được; chưa xác nhận toàn bộ kỹ thuật của bài tập.</Text>}
    {screening.length ? screening.map(item => <View key={item.repNumber} style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: expandedRep === item.repNumber }} onPress={() => setExpandedRep(value => value === item.repNumber ? null : item.repNumber)}>
        <Text style={styles.title}>Squat · Lần {item.repNumber}/{reps.length}</Text>
        <Text style={styles.title}>{item.headline}</Text>
        <Text style={styles.muted}>{item.meets} tiêu chí đạt trong phạm vi đã kiểm tra · {item.improves} cần sửa · {item.unable} chưa đủ cơ sở</Text>
        <Text style={styles.link}>{expandedRep === item.repNumber ? 'Thu gọn nhận xét' : 'Xem nhận xét từng tiêu chí'}</Text>
      </Pressable>
      {!!item.improvementPlan?.items.length && <View style={styles.improvement}>
        <Text style={styles.title}>{item.improvementPlan.title}</Text>
        {item.improvementPlan.items.map(action => <View key={action.criterionId} style={{ marginTop: 8 }}>
          <Text style={styles.title}>{action.title}</Text>
          {action.steps.map((step, index) => <Text key={index} style={styles.muted}>{index + 1}. {step}</Text>)}
        </View>)}
      </View>}
      {expandedRep === item.repNumber && item.criteria.map(criterion => <View key={criterion.id} style={styles.criterion}>
        <Text style={styles.title}>{criterion.title}</Text>
        <Text style={[styles.verdict, { color: criterion.status === 'NEEDS_IMPROVEMENT' ? '#A84415' : criterion.status === 'MEETS_CRITERION' ? '#26734D' : aura.muted }]}>
          {criterion.status === 'NEEDS_IMPROVEMENT' ? criterion.validation === 'VERIFIED' ? 'Cần sửa' : 'Cần sửa · nhận định thử nghiệm'
            : criterion.status === 'MEETS_CRITERION' ? criterion.validation === 'VERIFIED' ? 'Đạt trong phạm vi đã kiểm tra' : 'Đạt theo tiêu chí thử nghiệm'
              : criterion.needsReview ? 'Cần kiểm tra thêm' : 'Không đủ dữ liệu'}
        </Text>
        <Text style={styles.muted}>{criterion.explanation}</Text>
        {criterion.guidance ? <View style={{ marginTop: 8 }}>
          <Text style={styles.title}>{criterion.guidance.title}</Text>
          {criterion.guidance.steps.map((step, index) => <Text key={index} style={styles.muted}>{index + 1}. {step}</Text>)}
        </View> : !!criterion.correction && <Text style={styles.muted}>Cách sửa: {criterion.correction}</Text>}
        {criterion.details.map((detail, index) => <View key={index} style={{ marginTop: 6 }}>
          <Text style={styles.note}>{criterion.details.length > 1 ? `${detail.bodyPart}: ` : ''}{detail.measurement}</Text>
          {detail.timestampSeconds !== null && analysis.videoAvailable && <Pressable accessibilityRole="button" onPress={() => {
            setSeek(value => ({ time: detail.timestampSeconds!, serial: (value?.serial || 0) + 1, joints: detail.joints,
              title: `Lần ${item.repNumber} · ${criterion.title}` }));
            setEvidenceVisible(true);
          }}><Text style={styles.link}>Xem khung hình tại {detail.timestampSeconds.toFixed(2)} giây</Text></Pressable>}
        </View>)}
      </View>)}
    </View>) : <View style={styles.card}>
      <Text style={styles.title}>Chưa chấm được</Text>
      <Text style={styles.muted}>Lý do: {result.exercise === 'SQUAT'
        ? olderSquatResult ? 'Kết quả cũ chưa lưu nhận xét theo từng lần tập.'
          : reps.length ? 'AI đã đếm lần tập nhưng chưa trả dự đoán tư thế cho kết quả này.'
            : result.limitations?.[0] || 'AI chưa theo dõi đủ một lần Squat để đưa ra nhận xét.'
        : 'Bài tập này chưa có quy tắc chấm từng lần được kiểm chứng.'}</Text>
      <Text style={styles.muted}>Cách cải thiện: {result.exercise === 'SQUAT'
        ? olderSquatResult ? 'Chọn phân tích lại video đã lưu nếu video còn hạn; nếu không, gửi video mới.'
          : reps.length ? 'Gửi lại video hoặc nhờ Coach xem nếu AI vẫn không đưa ra nhận xét.'
            : 'Quay trọn thân từ vai đến bàn chân, đủ sáng, máy cố định; thực hiện từ đứng, xuống rồi đứng lên.'
        : 'Gửi video cho Coach nhận xét; AI hiện chỉ hỗ trợ đo chuyển động cho bài này.'}</Text>
    </View>}
    {!!screening.length && <Text style={styles.note}>Đây là dự đoán từ video trong phạm vi đo được. Bạn có thể gửi Coach xem lại nếu cần.</Text>}
    {showExperimental && !!result.assessmentDiagnostics?.length && <View style={styles.criterion}>
      <Pressable onPress={() => setSourceDetails(value => !value)}><Text style={styles.link}>{sourceDetails ? 'Ẩn' : 'Xem'} chi tiết nguồn phân tích · Coach/Admin</Text></Pressable>
      {sourceDetails && result.assessmentDiagnostics.map(row => <Text key={`${row.repNumber}-${row.criterionId}`} style={styles.note}>
        Lần {row.repNumber} · {row.criterionId}: rule {row.ruleStatus}, vision {row.visionStatus} · {row.ruleValidated ? 'Đã kiểm chứng' : 'Chưa kiểm chứng'} · {row.reasonCode}
      </Text>)}
    </View>}
    <Modal visible={evidenceVisible} transparent animationType="fade" onRequestClose={() => setEvidenceVisible(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <Text style={styles.title}>{seek?.title}</Text>
        <Text style={styles.muted}>Thời điểm {seek?.time.toFixed(2)} giây. Các khớp đang xem được tô vàng.</Text>
        {evidenceVisible && analysis.videoAvailable && <AnalysisVideo key={`${analysis.id}-${seek?.serial}`} analysis={analysis} showExperimental={showExperimental} seek={seek} />}
        <Pressable accessibilityRole="button" onPress={() => setEvidenceVisible(false)} style={styles.toggle}><Text style={styles.title}>Đóng video</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  heading: { color: aura.ink, fontSize: 17, fontWeight: '800', marginTop: 10 },
  card: { backgroundColor: '#FFF9F2', borderColor: aura.border, borderWidth: 1,
    borderRadius: 12, padding: 12, marginTop: 9 },
  title: { color: aura.ink, fontWeight: '800' },
  muted: { color: aura.muted, lineHeight: 20, marginTop: 5 },
  note: { color: aura.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  toggle: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 10,
    borderWidth: 1, borderColor: aura.border, borderRadius: 10 },
  link: { color: aura.caramel, fontWeight: '700', marginTop: 6 },
  error: { color: '#B3261E', marginTop: 8 },
  criterion: { borderTopWidth: 1, borderColor: aura.border, paddingTop: 12, marginTop: 12 },
  verdict: { fontWeight: '700', marginTop: 4 },
  improvement: { backgroundColor: '#F0F5ED', borderRadius: 10, padding: 12, marginTop: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0009', padding: 18 },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth: 600, borderRadius: 18, padding: 16 },
});
