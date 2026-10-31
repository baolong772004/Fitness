import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Page } from '../components/ui';
import { ExerciseAnalysisResult } from '../components/ExerciseAnalysisResult';
import { exerciseAnalysis, type Analysis, type AnalysisOptions, type ExerciseCode, type VideoProvenanceInput } from '../lib/exerciseAnalysis';
import { useAuth } from '../lib/auth';
import { aura } from '../lib/theme';

const box = { backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: aura.border } as const;
const button = { backgroundColor: aura.darkCoffee, borderRadius: 12, padding: 14, alignItems: 'center' as const, marginTop: 12 };
const defaultVariant: Record<ExerciseCode, string> = { SQUAT: 'BODYWEIGHT', PUSH_UP: 'STANDARD', PLANK: 'FRONT', LUNGE: 'FORWARD_BODYWEIGHT', BICEPS_CURL: 'DUMBBELL_STANDING', SHOULDER_PRESS: 'DUMBBELL_SEATED' };
const variantNames: Record<string, string> = { BODYWEIGHT: 'Không tạ', WEIGHTED: 'Có tạ (chỉ đo)', UNSPECIFIED: 'Chưa xác định', STANDARD: 'Chống đẩy cơ bản', FRONT: 'Plank trước', FORWARD_BODYWEIGHT: 'Lunge tiến không tạ', DUMBBELL_STANDING: 'Đứng với dumbbell', DUMBBELL_SEATED: 'Ngồi với dumbbell' };
const comparable = (row: Analysis, current: Analysis) => row.status === 'COMPLETED' && row.result?.exercise === current.result?.exercise && row.result?.exerciseVariant === current.result?.exerciseVariant && row.result?.cameraView?.detected === current.result?.cameraView?.detected && new Date(row.createdAt) < new Date(current.createdAt);

function SelectedVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} nativeControls style={{ height: 220, marginTop: 12, borderRadius: 12 }} />;
}

export default function ExerciseAnalysisScreen() {
  const { studentPlanId: studentPlanParam } = useLocalSearchParams<{ studentPlanId?: string }>();
  const studentPlanId = Number(studentPlanParam);
  const { user } = useAuth();
  const developerMode = __DEV__ && !!user && ['ADMIN', 'COACH', 'TRAINER'].includes(user.role);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [captureMethodDeclared, setCaptureMethodDeclared] = useState<'CAMERA' | 'LIBRARY'>('LIBRARY');
  const [videoOrigin, setVideoOrigin] = useState<'USER_UPLOAD' | 'SAMPLE' | 'DATASET'>('USER_UPLOAD');
  const [performerDeclaration, setPerformerDeclaration] = useState<VideoProvenanceInput['performerDeclaration']>('UNKNOWN');
  const [consent, setConsent] = useState(false);
  const [options, setOptions] = useState<AnalysisOptions>({ cameraView: 'AUTO', depthTarget: 'NONE', descentTargetSeconds: null });
  const [selectedExercise, setSelectedExercise] = useState<ExerciseCode>('SQUAT');
  const [selectedVariant, setSelectedVariant] = useState('BODYWEIGHT');
  const [shareVideo, setShareVideo] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [comparison, setComparison] = useState<Analysis | null>(null);
  const [current, setCurrent] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [supported, setSupported] = useState<{ code: ExerciseCode; name: string; cameraAngle: string; measurementStatus: string; techniqueStatus: string; variants?: string[] }[]>([]);
  const [coaches, setCoaches] = useState<{ id: number; fullName: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentId = current?.id;
  const currentStatus = current?.status;
  const videoDurationSeconds = video?.duration == null ? null : video.duration / 1000;
  const selectedMeta = supported.find(item => item.code === selectedExercise);
  useEffect(() => { setShareVideo(false); setShareNotice(''); setComparison(null); }, [currentId]);

  const refresh = useCallback(async () => {
    if (!user || (user.role !== 'MEMBER' && !developerMode)) return;
    try {
      const [exercises, rows, options] = developerMode
        ? [await exerciseAnalysis.supported(), await exerciseAnalysis.developerHistory(), [] as { id: number; fullName: string }[]]
        : await Promise.all([exerciseAnalysis.supported(), exerciseAnalysis.history(), exerciseAnalysis.shareOptions()]);
      setSupported(exercises);
      setHistory(rows);
      setCoaches(options);
    } catch (e) { setError((e as Error).message); }
  }, [user, developerMode]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!currentId || !currentStatus || !['PENDING', 'PROCESSING'].includes(currentStatus)) return;
    const timer = setInterval(() => void (developerMode ? exerciseAnalysis.developerDetail(currentId) : exerciseAnalysis.detail(currentId)).then(row => {
      setCurrent(row);
      if (!['PENDING', 'PROCESSING'].includes(row.status)) void refresh();
    }).catch(e => setError((e as Error).message)), 3000);
    return () => clearInterval(timer);
  }, [currentId, currentStatus, refresh, developerMode]);
  const pick = async (camera: boolean) => {
    setError('');
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError('Cần cấp quyền camera để quay video.'); return; }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 30, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false });
      if (!result.canceled && result.assets[0]) { setVideo(result.assets[0]); setCurrent(null); setConsent(false); setCaptureMethodDeclared(camera ? 'CAMERA' : 'LIBRARY'); setVideoOrigin('USER_UPLOAD'); setPerformerDeclaration('UNKNOWN'); }
    } catch (e) { setError((e as Error).message); }
  };
  const submit = async () => {
    if (!video || !consent) return;
    if (video.fileSize && video.fileSize > 25 * 1024 * 1024) { setError('Video vượt quá 25 MB.'); return; }
    if (videoDurationSeconds != null && (videoDurationSeconds < 3 || videoDurationSeconds > 30)) { setError('Video cần dài từ 3 đến 30 giây.'); return; }
    setBusy(true); setError('');
    const provenance: VideoProvenanceInput = { videoOrigin, captureMethodDeclared, performerDeclaration };
    try { const row = developerMode
      ? await exerciseAnalysis.developerUpload(video, options, selectedExercise, selectedVariant, provenance)
      : await exerciseAnalysis.upload(video, Number.isSafeInteger(studentPlanId) && studentPlanId > 0 ? studentPlanId : undefined, options, selectedExercise, selectedVariant, provenance);
      setCurrent(row); setVideo(null); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = (id: number) => Alert.alert('Xóa kết quả?', 'Video và kết quả sẽ bị xóa.', [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Xóa', style: 'destructive', onPress: () => void (developerMode ? exerciseAnalysis.developerRemove(id) : exerciseAnalysis.remove(id)).then(() => { if (current?.id === id) setCurrent(null); void refresh(); }).catch(e => setError((e as Error).message)) },
  ]);
  const reanalyze = async (id: number) => {
    setBusy(true); setError('');
    try { const row = await exerciseAnalysis.developerReanalyze(id); setCurrent(row); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const reanalyzeMember = async (id: number) => {
    setBusy(true); setError('');
    try { const row = await exerciseAnalysis.reanalyze(id); setCurrent(row); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const changeShare = async (coachId: number, revoke: boolean, includeVideo = shareVideo) => {
    if (!current) return;
    setBusy(true); setError(''); setShareNotice('');
    try {
      if (revoke) await exerciseAnalysis.revoke(current.id, coachId);
      else await exerciseAnalysis.share(current.id, coachId, includeVideo);
      const updated = await exerciseAnalysis.detail(current.id);
      const active = updated.shares?.find(item => item.coachId === coachId && !item.revokedAt);
      if (!revoke && (!active || active.includeVideo !== includeVideo)) throw new Error('Máy chủ chưa xác nhận quyền video. Vui lòng tải lại và thử lại.');
      setCurrent(updated);
      setShareNotice(revoke ? 'Đã thu hồi quyền xem của Coach.' : includeVideo
        ? 'Máy chủ đã xác nhận Coach được xem video gốc và gắn nhãn.'
        : 'Đã chia sẻ kết quả; Coach chưa được xem video gốc.');
      setShareVideo(false);
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!user) return <Page><Text>Đăng nhập để dùng tính năng này.</Text><Pressable style={button} onPress={() => router.push('/auth')}><Text style={{ color: '#fff' }}>Đăng nhập</Text></Pressable></Page>;
  if (user.role !== 'MEMBER' && !developerMode) return <Page><Text>Chức năng hiện dành cho hội viên.</Text></Page>;
  return <Page refresh={refresh}>
    {developerMode && <View style={[box, { borderColor: '#C77800', borderWidth: 2 }]}><Text style={{ color: '#8A4B00', fontWeight: '900' }}>DEVELOPER MODE · EXPERIMENTAL EVALUATION</Text><Text style={{ color: aura.ink, marginTop: 5 }}>Chỉ tài khoản Coach/Admin trong bản phát triển. Kết quả là dự đoán chưa kiểm chứng, không xuất hiện trong Member Mode.</Text></View>}
    <View style={{ backgroundColor: aura.espresso, borderRadius: 25, padding: 22, marginBottom: 16 }}>
      <Text style={{ color: '#F9C77C', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 }}>AI FORM CHECK  ·  BETA</Text>
      <Text style={{ color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 7 }}>Trợ lý phân tích kỹ thuật tập luyện</Text>
      <Text style={{ color: '#FFFFFFBA', lineHeight: 20, marginTop: 8 }}>Tự tập ngoài lịch PT, nhận nhận xét dựa trên chuyển động trong video. Lượt phân tích được giới hạn theo gói.</Text>
      {studentPlanId > 0 && <Text style={{ color: '#F9C77C', marginTop: 10, fontWeight: '700' }}>Đang liên kết với giáo án của bạn</Text>}
    </View>
    <Text style={{ fontSize: 17, fontWeight: '900', color: aura.ink, marginBottom: 10 }}>Chọn cách kiểm tra</Text>
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
      <View style={[box, { flex: 1, opacity: .65 }]}><Ionicons name="camera-outline" size={25} color={aura.caramel} /><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 8 }}>Chụp ảnh</Text><Text style={{ color: aura.muted, fontSize: 11, marginTop: 4 }}>Tư thế tĩnh · sắp hỗ trợ</Text></View>
      <Pressable accessibilityRole="button" onPress={() => void pick(false)} style={[box, { flex: 1, borderColor: aura.caramel, backgroundColor: '#FFF9F2' }]}><Ionicons name="videocam-outline" size={25} color={aura.caramel} /><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 8 }}>Tải video</Text><Text style={{ color: aura.muted, fontSize: 11, marginTop: 4 }}>Phân tích chuyển động</Text></Pressable>
    </View>
    <Text style={{ fontSize: 17, fontWeight: '900', color: aura.ink, marginBottom: 10 }}>Chọn bài tập cần kiểm tra</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{supported.map(item => <Pressable key={item.code} accessibilityRole="button" onPress={() => { setSelectedExercise(item.code); setSelectedVariant(defaultVariant[item.code]); setOptions({ cameraView: 'AUTO', depthTarget: 'NONE', descentTargetSeconds: null }); }} style={{ backgroundColor: selectedExercise === item.code ? aura.darkCoffee : aura.latte, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}><Text style={{ color: selectedExercise === item.code ? '#fff' : aura.ink, fontWeight: '800' }}>{item.name}</Text><Text style={{ color: selectedExercise === item.code ? '#FFF' : aura.muted, fontSize: 9 }}>{item.measurementStatus === 'SQUAT_REPETITIONS' ? 'Đếm rep thử nghiệm' : 'Chỉ đo khớp'}</Text></Pressable>)}</View>
    <Text style={{ color: aura.ink, fontWeight: '800' }}>Biến thể do bạn chọn</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{(selectedMeta?.variants || [defaultVariant[selectedExercise], 'UNSPECIFIED']).map(value => <Pressable key={value} onPress={() => setSelectedVariant(value)} style={[button, { backgroundColor: value === selectedVariant ? aura.darkCoffee : aura.latte }]}><Text style={{ color: value === selectedVariant ? '#fff' : aura.ink }}>{variantNames[value] || value}</Text></Pressable>)}</View>
    <View style={box}>
      <Text style={{ fontWeight: '800', fontSize: 18, color: aura.ink }}>Hướng dẫn quay {selectedMeta?.name || 'Squat'}</Text>
      <Text style={{ color: aura.muted, marginTop: 8, lineHeight: 21 }}>{selectedMeta?.cameraAngle || 'Đặt camera ngang, thấy trọn vai, hông, gối và cổ chân.'} Quay 3–30 giây. Chỉ dùng video MP4/MOV hoặc WebM dưới 25 MB.</Text>
      <Text style={{ color: aura.caramel, fontWeight: '700', marginTop: 9, fontSize: 12 }}>{selectedExercise === 'SQUAT' ? 'Góc ngang: độ sâu, thân người và nhịp. Chính diện: hướng dịch chuyển gối trên ảnh và nhịp.' : 'Bài này hiện chỉ đo khớp trên ảnh; chưa đếm rep hay kết luận kỹ thuật.'} Các tiêu chí kỹ thuật đang chờ Coach kiểm chứng.</Text>
      {selectedExercise === 'SQUAT' && <Text style={{ color: aura.muted, marginTop: 8 }}>Quay chính diện hoặc góc ngang: toàn thân trong khung, máy cố định và đủ sáng.</Text>}
      <Text style={{ color: aura.ink, fontWeight: '800', marginTop: 14 }}>Góc quay của video</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['AUTO', 'SIDE', 'FRONT'] as const).map(value => <Pressable key={value} onPress={() => setOptions(old => ({ ...old, cameraView: value }))} style={[button, { backgroundColor: options.cameraView === value ? aura.darkCoffee : aura.latte, padding: 10 }]}><Text style={{ color: options.cameraView === value ? '#fff' : aura.ink }}>{value === 'AUTO' ? 'Tự nhận diện' : value === 'SIDE' ? 'Ngang' : 'Chính diện'}</Text></Pressable>)}</View>
      {selectedExercise === 'SQUAT' && <><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 14 }}>Mục tiêu riêng (tuỳ chọn)</Text>
      <Text style={{ color: aura.muted, marginTop: 6 }}>Chọn mục tiêu phù hợp đã thống nhất với Coach. Đây là mốc để đối chiếu, không phải chuẩn bắt buộc cho mọi người.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: options.depthTarget !== 'NONE' }} onPress={() => setOptions(old => ({ ...old, depthTarget: old.depthTarget === 'NONE' ? 'HIP_AT_KNEE' : 'NONE' }))} style={{ marginTop: 10 }}><Text style={{ color: aura.ink }}>{options.depthTarget === 'NONE' ? '☐' : '☑'} Muốn hông gần ngang gối ở đáy (chỉ góc ngang)</Text></Pressable>
      <Text style={{ color: aura.muted, marginTop: 12 }}>Thời gian hạ người mục tiêu</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[null, 2, 3].map(value => <Pressable key={value ?? 'none'} onPress={() => setOptions(old => ({ ...old, descentTargetSeconds: value }))} style={[button, { backgroundColor: options.descentTargetSeconds === value ? aura.darkCoffee : aura.latte, padding: 10 }]}><Text style={{ color: options.descentTargetSeconds === value ? '#fff' : aura.ink }}>{value == null ? 'Chưa đặt' : `${value} giây xuống`}</Text></Pressable>)}</View>
      </>}
      <Pressable style={button} onPress={() => void pick(false)}><Text style={{ color: '#fff', fontWeight: '800' }}>Chọn video từ máy</Text></Pressable>
      <Pressable style={[button, { backgroundColor: aura.caramel }]} onPress={() => void pick(true)}><Text style={{ color: '#fff', fontWeight: '800' }}>Quay video mới</Text></Pressable>
      {video && <View style={{ marginTop: 16 }}>
        <Text style={{ color: aura.ink, fontWeight: '700' }}>Video đã chọn: {video.fileName || 'Video mới'}</Text>
        <Text style={{ color: aura.muted }}>{videoDurationSeconds != null ? `${Math.round(videoDurationSeconds)} giây · ` : ''}{video.fileSize ? `${(video.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}</Text>
        <Text style={{ color: aura.muted, marginTop: 5 }}>Nguồn chọn: {captureMethodDeclared === 'CAMERA' ? 'camera' : 'thư viện'}. Người tải lên và người trong video được ghi riêng.</Text>
        <Text style={{ color: aura.ink, fontWeight: '800', marginTop: 10 }}>Nguồn nội dung video</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['USER_UPLOAD', 'SAMPLE', ...(developerMode ? ['DATASET'] : [])] as VideoProvenanceInput['videoOrigin'][]).map(value => <Pressable key={value} onPress={() => { setVideoOrigin(value); if (value !== 'USER_UPLOAD') setPerformerDeclaration('UNKNOWN'); }} style={[button, { padding: 9, backgroundColor: videoOrigin === value ? aura.darkCoffee : aura.latte }]}><Text style={{ color: videoOrigin === value ? '#fff' : aura.ink }}>{value === 'USER_UPLOAD' ? 'Video của tôi tải lên' : value === 'SAMPLE' ? 'Video mẫu' : 'Dataset'}</Text></Pressable>)}</View>
        <Text style={{ color: aura.muted, marginTop: 5 }}>“Tải lên” chỉ xác nhận tài khoản gửi tệp, không xác minh người đang tập. Video mẫu đã biết sẽ được máy chủ tự đánh dấu SAMPLE.</Text>
        {videoOrigin === 'USER_UPLOAD' && <View style={{ marginTop: 10 }}><Text style={{ color: aura.ink, fontWeight: '800' }}>Ai đang tập trong video?</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([
          ['SELF_DECLARED', 'Chính tôi (tự khai báo)'], ['OTHER_PERSON', 'Người khác'], ['UNKNOWN', 'Chưa rõ'],
        ] as const).map(([value, label]) => <Pressable key={value} onPress={() => setPerformerDeclaration(value)} style={[button, { padding: 9, backgroundColor: performerDeclaration === value ? aura.darkCoffee : aura.latte }]}><Text style={{ color: performerDeclaration === value ? '#fff' : aura.ink }}>{label}</Text></Pressable>)}</View><Text style={{ color: aura.muted, marginTop: 4 }}>Chọn “Chính tôi” là khai báo của bạn; hệ thống chưa xác minh danh tính qua video.</Text></View>}
        <SelectedVideoPreview uri={video.uri} />
        <Pressable onPress={() => setConsent(value => !value)} style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}><Text>{consent ? '☑' : '☐'}</Text><Text style={{ flex: 1, color: aura.ink }}>Tôi đồng ý gửi video riêng tư để AI phân tích và hiểu video sẽ được xóa sau tối đa 7 ngày.</Text></Pressable>
        <Pressable disabled={!consent || busy} style={[button, { opacity: consent && !busy ? 1 : .5 }]} onPress={() => void submit()}><Text style={{ color: '#fff', fontWeight: '800' }}>{busy ? 'Đang tải video...' : 'Gửi để phân tích'}</Text></Pressable>
      </View>}
    </View>
    {!!error && <Text style={{ color: '#B3261E', marginBottom: 14 }}>{error}</Text>}
    {current && <View style={box}>
      <Text style={{ fontWeight: '800', color: aura.ink, fontSize: 18 }}>Kết quả #{current.id}</Text>
      <Text style={{ color: aura.muted, marginTop: 4 }}>Nguồn: {current.videoOrigin || 'chưa ghi'}{current.sourceReference ? ` · mẫu ${current.sourceReference}` : ''} · Người tập: {current.performerDeclaration === 'SELF_DECLARED' ? 'chủ tài khoản tự khai báo' : 'chưa xác minh'}</Text>
      {['PENDING', 'PROCESSING'].includes(current.status) ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}><ActivityIndicator color={aura.caramel} /><Text>Đang phân tích video...</Text></View> : current.status === 'FAILED' ? <Text style={{ marginTop: 10 }}>Không thể phân tích lúc này ({current.errorCode || 'lỗi dịch vụ'}). Hãy thử lại sau.</Text> : <>
        <ExerciseAnalysisResult key={current.id} analysis={current} showExperimental={developerMode} />
        {developerMode && current.videoAvailable && <Pressable disabled={busy} style={button} onPress={() => void reanalyze(current.id)}><Text style={{ color: '#fff', fontWeight: '800' }}>Phân tích lại bằng rule mới · lưu thành kết quả mới</Text></Pressable>}
        {!developerMode && current.videoAvailable && current.resultVersion !== 'exercise-analysis-result-4' && <Pressable disabled={busy} style={button} onPress={() => void reanalyzeMember(current.id)}><Text style={{ color: '#fff', fontWeight: '800' }}>Phân tích lại video đã lưu · nhận đánh giá AI mới</Text></Pressable>}
        <Pressable style={button} onPress={() => void pick(true)}><Text style={{ color: '#fff', fontWeight: '800' }}>Quay lại để thử điều chỉnh</Text></Pressable>
        {history.some(row => comparable(row, current)) && <View style={{ marginTop: 16 }}>
          <Text style={{ color: aura.ink, fontWeight: '800' }}>Đối chiếu với lần trước</Text>
          <Text style={{ color: aura.muted, marginTop: 6 }}>Nên dùng cùng góc quay, vị trí camera và bài tập. Chênh lệch số đo không tự xác nhận kỹ thuật tốt hơn.</Text>
          {history.filter(row => comparable(row, current)).slice(0, 3).map(row => <Pressable key={row.id} style={[button, { backgroundColor: aura.latte }]} onPress={() => void (developerMode ? exerciseAnalysis.developerDetail(row.id) : exerciseAnalysis.detail(row.id)).then(setComparison).catch(e => setError((e as Error).message))}><Text style={{ color: aura.ink }}>Xem lần #{row.id} · {new Date(row.createdAt).toLocaleDateString('vi-VN')}</Text></Pressable>)}
          {comparison && <View style={{ marginTop: 14, borderTopWidth: 1, borderColor: aura.border }}><Text style={{ fontWeight: '800', marginTop: 12 }}>Lần trước #{comparison.id}</Text>{comparison.ruleVersion !== current.ruleVersion && <Text style={{ color: aura.muted }}>Hai kết quả dùng phiên bản phân tích khác nhau; số đo có thể không so sánh trực tiếp được.</Text>}<ExerciseAnalysisResult key={comparison.id} analysis={comparison} showExperimental={developerMode} /><Pressable onPress={() => setComparison(null)}><Text style={{ marginTop: 12 }}>Đóng đối chiếu</Text></Pressable></View>}
        </View>}
        {!developerMode && <View style={{ borderTopWidth: 1, borderColor: aura.border, marginTop: 16, paddingTop: 14 }}>
          <Text style={{ color: aura.ink, fontWeight: '800' }}>Gửi kết quả cho Coach</Text>
          {!!current.videoAvailable && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: shareVideo }} onPress={() => setShareVideo(value => !value)} style={{ marginTop: 10 }}><Text style={{ color: aura.ink }}>{shareVideo ? '☑' : '☐'} Cho phép Coach xem cả video gốc khi chia sẻ. Video hết hạn sau 7 ngày tính từ lúc gửi.</Text></Pressable>}
          {coaches.length === 0 ? <Text style={{ color: aura.muted, marginTop: 7 }}>Chỉ chia sẻ khi bạn có quan hệ PT còn hiệu lực.</Text> : coaches.map(coach => {
            const activeShare = current.shares?.find(item => item.coachId === coach.id && !item.revokedAt);
            return <View key={coach.id}>
              {activeShare && <Text style={{ color: aura.muted, marginTop: 9 }}>{activeShare.includeVideo ? `Coach ${coach.fullName} đã được phép xem video gốc và gắn nhãn.` : `Coach ${coach.fullName} hiện chỉ thấy kết quả; cần cấp thêm quyền xem video để gắn nhãn.`}</Text>}
              {!activeShare && <Pressable disabled={busy} style={button} onPress={() => void changeShare(coach.id, false)}><Text style={{ color: '#fff', fontWeight: '800' }}>{shareVideo ? `Chia sẻ kết quả và video với Coach ${coach.fullName}` : `Chia sẻ kết quả với Coach ${coach.fullName}`}</Text></Pressable>}
              {activeShare && !activeShare.includeVideo && !!current.videoAvailable && <>
                <Pressable disabled={busy || !shareVideo} style={[button, { opacity: shareVideo ? 1 : .5 }]} onPress={() => void changeShare(coach.id, false, true)}><Text style={{ color: '#fff', fontWeight: '800' }}>{`Cấp quyền xem video gốc cho Coach ${coach.fullName}`}</Text></Pressable>
                {!shareVideo && <Text style={{ color: aura.muted, marginTop: 5 }}>Tích ô cho phép xem video ở trên để bật nút này.</Text>}
              </>}
              {!!activeShare && <Pressable disabled={busy} style={[button, { backgroundColor: aura.latte }]} onPress={() => void changeShare(coach.id, true)}><Text style={{ color: aura.ink, fontWeight: '800' }}>{`Thu hồi quyền xem của Coach ${coach.fullName}`}</Text></Pressable>}
            </View>;
          })}
          {!!shareNotice && <Text accessibilityRole="alert" style={{ color: aura.darkCoffee, marginTop: 10 }}>{shareNotice}</Text>}
          {!!current.feedback?.length && <View style={{ marginTop: 15 }}><Text style={{ color: aura.ink, fontWeight: '800' }}>Góp ý từ Coach</Text>{current.feedback.map(item => <View key={item.id} style={{ backgroundColor: aura.cream, borderRadius: 12, padding: 11, marginTop: 8 }}><Text style={{ color: aura.darkCoffee, fontWeight: '700' }}>{item.coach.fullName}</Text><Text style={{ color: aura.ink, marginTop: 4 }}>{item.comment}</Text></View>)}</View>}
        </View>}
      </>}
      <Pressable onPress={() => remove(current.id)} style={{ marginTop: 12 }}><Text style={{ color: '#B3261E' }}>Xóa kết quả và video</Text></Pressable>
    </View>}
    <Text style={{ fontWeight: '800', fontSize: 18, color: aura.ink, marginBottom: 10 }}>Lịch sử</Text>
    {history.length === 0 && <Text style={{ color: aura.muted }}>Chưa có lần phân tích nào.</Text>}
    {history.map(row => <Pressable key={row.id} style={box} onPress={() => void (developerMode ? exerciseAnalysis.developerDetail(row.id) : exerciseAnalysis.detail(row.id)).then(setCurrent).catch(e => setError((e as Error).message))}><Text style={{ color: aura.ink, fontWeight: '700' }}>{supported.find(item => item.code === row.result?.exercise)?.name || row.result?.exercise || 'Bài tập'} · {new Date(row.createdAt).toLocaleString('vi-VN')}</Text><Text style={{ color: aura.muted }}>{row.status === 'COMPLETED' ? row.result?.detectedRepetitions == null ? 'Đã đo khớp' : `${row.result.detectedRepetitions} lần lặp` : row.status}</Text></Pressable>)}
    <Text style={{ color: aura.muted, lineHeight: 20, marginBottom: 22 }}>Gợi ý từ AI chỉ hỗ trợ tự tập, không thay thế Coach hoặc tư vấn y tế. Nếu đau, chóng mặt hoặc có triệu chứng bất thường, hãy dừng tập và tìm hỗ trợ phù hợp.</Text>
  </Page>;
}
