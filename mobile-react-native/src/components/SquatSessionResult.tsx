import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SessionSignal, SquatSession } from '../lib/exerciseAnalysis';
import { aura } from '../lib/theme';

const section = { borderWidth: 1, borderColor: aura.border, borderRadius: 12, padding: 12, marginTop: 10 } as const;
const viewName = (view: string | null) => view === 'FRONT' ? 'chính diện' : view === 'SIDE' ? 'góc ngang' : view || 'chưa xác định';

function SignalRows({ rows, empty }: { rows: SessionSignal[]; empty: string }) {
  if (!rows.length) return <Text style={{ color: aura.muted, marginTop: 5 }}>{empty}</Text>;
  return <>{rows.map((item, index) => <View key={`${item.analysisId}-${item.criterionId}-${item.repNumber}-${index}`} style={{ marginTop: 8 }}>
    <Text style={{ color: aura.ink, fontWeight: '700' }}>{item.criterionId} · {item.title} · clip #{item.analysisId} ({viewName(item.cameraView)})</Text>
    <Text style={{ color: aura.muted }}>Rep {item.repNumber ?? '?'} · {item.timestampSeconds?.toFixed(2) ?? '?'}s · {item.bodyPart || 'bộ phận chưa xác định'} · {item.observedValue ?? 'chưa có số đo'} {item.units || ''} · {item.evidenceFrames ?? 0} khung hình bằng chứng</Text>
    {item.threshold && <Text style={{ color: aura.muted }}>Ngưỡng thử nghiệm: {JSON.stringify(item.threshold)}</Text>}
    {!!item.feedback && <Text style={{ color: aura.ink, marginTop: 3 }}>{item.feedback}</Text>}
  </View>)}</>;
}

export function SquatSessionResult({ session, onOpenClip }: { session: SquatSession; onOpenClip?: (analysisId: number) => void }) {
  return <View style={{ marginTop: 16 }}>
    <Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }}>Phiên Squat hai góc</Text>
    <Text style={{ color: aura.muted, marginTop: 5 }}>Hai video được người tải lên xác nhận cùng người và cùng buổi. Danh tính người tập chưa được xác minh; rep của hai clip không được ghép với nhau.</Text>
    {session.clips.map(clip => <Pressable key={clip.analysisId} onPress={() => onOpenClip?.(clip.analysisId)}><Text style={{ color: aura.ink, marginTop: 5, textDecorationLine: onOpenClip ? 'underline' : 'none' }}>Xem clip #{clip.analysisId}: {viewName(clip.cameraViewDetected)} · {clip.detectedRepetitions ?? 'chưa đếm'} rep · {clip.status}</Text></Pressable>)}
    {session.status !== 'READY_FOR_PER_CLIP_REVIEW' && <Text style={{ color: '#9B4E00', marginTop: 7 }}>Phiên {session.status}: chờ phân tích hoặc kiểm tra lại góc quay/phiên bản. Chỉ xem các số đo riêng từng clip.</Text>}
    <Text style={{ color: '#9B4E00', fontWeight: '900', marginTop: 10 }}>AI ĐÁNH GIÁ THỬ NGHIỆM · CHƯA KIỂM CHỨNG. Chưa thể kết luận toàn bộ bài Squat đúng kỹ thuật hoặc an toàn.</Text>
    <View style={section}><Text style={{ fontWeight: '800', color: aura.ink }}>Tín hiệu đạt theo phép đo ({session.measuredMeets.length})</Text><SignalRows rows={session.measuredMeets} empty="Chưa có tín hiệu đạt đủ bằng chứng." /></View>
    <View style={section}><Text style={{ fontWeight: '800', color: '#9B2F1B' }}>Tín hiệu cần cải thiện ({session.measuredNeedsImprovement.length})</Text><SignalRows rows={session.measuredNeedsImprovement} empty="Chưa phát hiện tín hiệu vượt ngưỡng trong phần đã đo; điều này không xác nhận toàn bộ kỹ thuật đúng." /></View>
    <View style={section}><Text style={{ fontWeight: '800', color: aura.ink }}>Chưa thể đánh giá hoặc chưa hỗ trợ ({session.unable.length})</Text>{session.unable.map((item, index) => <Text key={`${item.analysisId}-${item.criterionId}-${index}`} style={{ color: aura.muted, marginTop: 5 }}>{item.criterionId} · clip #{item.analysisId} ({viewName(item.cameraView)}): {item.reasonCode || 'thiếu bằng chứng'}</Text>)}</View>
  </View>;
}
