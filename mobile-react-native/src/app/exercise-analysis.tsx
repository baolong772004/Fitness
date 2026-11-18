import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Page } from '../components/ui';
import { ExerciseAnalysisResult } from '../components/ExerciseAnalysisResult';
import { exerciseAnalysis, type Analysis, type AnalysisOptions, type ExerciseCheckerTierPolicy, type ExerciseCode, type VideoProvenanceInput } from '../lib/exerciseAnalysis';
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
  const [externalVideoConsent, setExternalVideoConsent] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [comparison, setComparison] = useState<Analysis | null>(null);
  const [current, setCurrent] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [supported, setSupported] = useState<{ code: ExerciseCode; name: string; cameraAngle: string; measurementStatus: string; techniqueStatus: string; variants?: string[] }[]>([]);
  const [coaches, setCoaches] = useState<{ id: number; fullName: string; ptLevel?: string }[]>([]);
  const [tierPolicy, setTierPolicy] = useState<ExerciseCheckerTierPolicy | null>(null);
  const [usedThisWeek, setUsedThisWeek] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentId = current?.id;
  const currentStatus = current?.status;
  const videoDurationSeconds = video?.duration == null ? null : video.duration / 1000;
  const selectedMeta = supported.find(item => item.code === selectedExercise);
  useEffect(() => { setExternalVideoConsent(false); setShareNotice(''); setComparison(null); }, [currentId]);

  const refresh = useCallback(async () => {
    if (!user || (user.role !== 'MEMBER' && !developerMode)) return;
    try {
      if (developerMode) {
        const [exercises, rows] = await Promise.all([exerciseAnalysis.supported(), exerciseAnalysis.developerHistory()]);
        setSupported(exercises);
        setHistory(rows);
        setCoaches([]);
      } else {
        const [exercises, rows, shareMeta] = await Promise.all([
          exerciseAnalysis.supported(),
          exerciseAnalysis.history(),
          exerciseAnalysis.shareOptionsWithQuota(),
        ]);
        setSupported(exercises);
        setHistory(rows);
        setCoaches(shareMeta.data || []);
        if (shareMeta.tierPolicy) setTierPolicy(shareMeta.tierPolicy);
        if (typeof shareMeta.usedThisWeek === 'number') setUsedThisWeek(shareMeta.usedThisWeek);
      }
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
    if (selectedExercise === 'SQUAT' && selectedVariant === 'BODYWEIGHT' && video.fileSize && video.fileSize > 12 * 1024 * 1024) { setError('Video Squat cần tối đa 12 MB để Gemini nhận xét. Hãy nén hoặc quay clip ngắn hơn.'); return; }
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
  const requestGeminiFeedback = async (id: number) => {
    if (!externalVideoConsent) return;
    setBusy(true); setError('');
    try {
      if (developerMode) await exerciseAnalysis.developerVisionPilot(id);
      else await exerciseAnalysis.visionAnalysis(id);
      setCurrent(await (developerMode ? exerciseAnalysis.developerDetail(id) : exerciseAnalysis.detail(id)));
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const changeShare = async (coachId: number, revoke: boolean) => {
    if (!current) return;
    const includeVideo = true;
    setBusy(true); setError(''); setShareNotice('');
    try {
      if (revoke) await exerciseAnalysis.revoke(current.id, coachId);
      else await exerciseAnalysis.share(current.id, coachId, includeVideo);
      const updated = await exerciseAnalysis.detail(current.id);
      const active = updated.shares?.find(item => item.coachId === coachId && !item.revokedAt);
      if (!revoke && (!active || active.includeVideo !== includeVideo)) throw new Error('Máy chủ chưa xác nhận quyền video. Vui lòng tải lại và thử lại.');
      setCurrent(updated);
      setShareNotice(revoke ? 'Đã thu hồi quyền xem video của Coach.' : 'Đã gửi kết quả và video cho Coach.');
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!user) return <Page><Text>Đăng nhập để dùng tính năng này.</Text><Pressable style={button} onPress={() => router.push('/auth')}><Text style={{ color: '#fff' }}>Đăng nhập</Text></Pressable></Page>;
  if (user.role !== 'MEMBER' && !developerMode) return <Page><Text>Chức năng hiện dành cho hội viên.</Text></Page>;
  return <Page refresh={refresh}>
    {developerMode && <View style={[box, { borderColor: '#C77800', borderWidth: 2 }]}><Text style={{ color: '#8A4B00', fontWeight: '900' }}>DEVELOPER MODE · EXPERIMENTAL EVALUATION</Text><Text style={{ color: aura.ink, marginTop: 5 }}>Chỉ tài khoản Coach/Admin trong bản phát triển. Kết quả là dự đoán chưa kiểm chứng, không xuất hiện trong Member Mode.</Text></View>}
    <View style={{ backgroundColor: aura.espresso, borderRadius: 25, padding: 22, marginBottom: 16 }}>
      <Text style={{ color: '#fff', fontSize: 25, fontWeight: '900' }}>Trợ lý phân tích kỹ thuật tập luyện</Text>
      {studentPlanId > 0 && <Text style={{ color: '#F9C77C', marginTop: 10, fontWeight: '700' }}>Đang liên kết với giáo án của bạn</Text>}
    </View>
    {!developerMode && tierPolicy && (
      <View style={[box, { backgroundColor: '#FFF9F2', borderColor: aura.caramel }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 15, flexShrink: 1 }}>
            Quyền lợi hiện tại: {tierPolicy.name}
          </Text>
          <View style={{ backgroundColor: '#F5E6D3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 12 }}>
              {tierPolicy.weeklyLimit === null ? `Không giới hạn (${usedThisWeek} video/tuần)` : `Đã dùng ${usedThisWeek}/${tierPolicy.weeklyLimit} video/tuần`}
            </Text>
          </View>
        </View>
        <Text style={{ color: aura.ink, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
          • {tierPolicy.description}
        </Text>
      </View>
    )}
    <Text style={{ fontSize: 17, fontWeight: '900', color: aura.ink, marginBottom: 10 }}>Chọn cách kiểm tra</Text>
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
      <View style={[box, { flex: 1, opacity: .65 }]}><Ionicons name="camera-outline" size={25} color={aura.caramel} /><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 8 }}>Chụp ảnh</Text></View>
      <Pressable accessibilityRole="button" onPress={() => void pick(false)} style={[box, { flex: 1, borderColor: aura.caramel, backgroundColor: '#FFF9F2' }]}><Ionicons name="videocam-outline" size={25} color={aura.caramel} /><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 8 }}>Tải video</Text></Pressable>
    </View>
    <Text style={{ fontSize: 17, fontWeight: '900', color: aura.ink, marginBottom: 10 }}>Chọn bài tập cần kiểm tra</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{supported.map(item => <Pressable key={item.code} accessibilityRole="button" onPress={() => { setSelectedExercise(item.code); setSelectedVariant(defaultVariant[item.code]); setOptions({ cameraView: 'AUTO', depthTarget: 'NONE', descentTargetSeconds: null }); }} style={{ backgroundColor: selectedExercise === item.code ? aura.darkCoffee : aura.latte, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}><Text style={{ color: selectedExercise === item.code ? '#fff' : aura.ink, fontWeight: '800' }}>{item.name}</Text><Text style={{ color: selectedExercise === item.code ? '#FFF' : aura.muted, fontSize: 9 }}>{item.measurementStatus === 'SQUAT_REPETITIONS' ? 'Đếm rep thử nghiệm' : 'Chỉ đo khớp'}</Text></Pressable>)}</View>
    <Text style={{ color: aura.ink, fontWeight: '800' }}>Biến thể do bạn chọn</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{(selectedMeta?.variants || [defaultVariant[selectedExercise], 'UNSPECIFIED']).map(value => <Pressable key={value} onPress={() => setSelectedVariant(value)} style={[button, { backgroundColor: value === selectedVariant ? aura.darkCoffee : aura.latte }]}><Text style={{ color: value === selectedVariant ? '#fff' : aura.ink }}>{variantNames[value] || value}</Text></Pressable>)}</View>
    <View style={box}>
      <Text style={{ fontWeight: '800', fontSize: 18, color: aura.ink }}>Hướng dẫn quay {selectedMeta?.name || 'Squat'}</Text>
      <Text style={{ color: aura.caramel, fontWeight: '700', marginTop: 9, fontSize: 12 }}>{selectedExercise === 'SQUAT' ? 'Góc ngang đánh giá độ sâu và thân người; chính diện theo dõi hướng gối.' : 'Bài này chỉ đo khớp trên ảnh, chưa đếm rep hay kết luận kỹ thuật.'} Kết quả cần Coach xác nhận.</Text>
      <Text style={{ color: aura.ink, fontWeight: '800', marginTop: 14 }}>Góc quay của video</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['AUTO', 'SIDE', 'FRONT'] as const).map(value => <Pressable key={value} onPress={() => setOptions(old => ({ ...old, cameraView: value }))} style={[button, { backgroundColor: options.cameraView === value ? aura.darkCoffee : aura.latte, padding: 10 }]}><Text style={{ color: options.cameraView === value ? '#fff' : aura.ink }}>{value === 'AUTO' ? 'Tự nhận diện' : value === 'SIDE' ? 'Ngang' : 'Chính diện'}</Text></Pressable>)}</View>
      {selectedExercise === 'SQUAT' && <><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 14 }}>Mục tiêu riêng (tuỳ chọn)</Text>
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
        <Pressable onPress={() => setConsent(value => !value)} style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}><Text>{consent ? '☑' : '☐'}</Text><Text style={{ flex: 1, color: aura.ink }}>Tôi đồng ý gửi video để AI phân tích; video Squat được gửi tới Google Gemini để tự nhận xét. Video gốc tại phòng Gym được lưu tối đa 7 ngày.</Text></Pressable>
        <Pressable disabled={!consent || busy} style={[button, { opacity: consent && !busy ? 1 : .5 }]} onPress={() => void submit()}><Text style={{ color: '#fff', fontWeight: '800' }}>{busy ? 'Đang tải video...' : 'Gửi để phân tích'}</Text></Pressable>
      </View>}
    </View>
    {!!error && <Text style={{ color: '#B3261E', marginBottom: 14 }}>{error}</Text>}
    {current && <View style={box}>
      <Text style={{ fontWeight: '800', color: aura.ink, fontSize: 18 }}>Kết quả #{current.id}</Text>
      {['PENDING', 'PROCESSING'].includes(current.status) ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}><ActivityIndicator color={aura.caramel} /><Text>Đang phân tích video...</Text></View> : current.status === 'FAILED' ? <View>
        <Text style={{ marginTop: 10 }}>Không thể phân tích lúc này ({current.errorCode || 'lỗi dịch vụ'}). Hãy thử lại sau.</Text>
        {current.videoAvailable && /^(AI_UNAVAILABLE|AI_TIMEOUT|AI_HTTP_50[0-4])$/.test(current.errorCode || '') &&
          <Pressable disabled={busy} style={[button, { opacity: busy ? .5 : 1 }]} onPress={() => void (developerMode ? reanalyze(current.id) : reanalyzeMember(current.id))}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Thử phân tích lại video đã lưu</Text>
          </Pressable>}
      </View> : <>
        <ExerciseAnalysisResult key={current.id} analysis={current} showExperimental={developerMode} />
        {current.status === 'COMPLETED' && current.result?.exercise === 'SQUAT' && current.result?.exerciseVariant === 'BODYWEIGHT' && current.result?.visionAnalysis?.status !== 'COMPLETED' && current.videoAvailable && <View style={{ marginTop: 14, borderTopWidth: 1, borderColor: aura.border, paddingTop: 12 }}>
          <Text style={{ color: aura.ink, fontWeight: '800' }}>Hoàn tất đánh giá AI</Text>
          <Text style={{ color: aura.muted, marginTop: 5 }}>{current.result?.visionAnalysis?.status === 'FAILED' ? 'Chưa hoàn tất bước đối chiếu hình ảnh. Những tiêu chí chưa đủ bằng chứng được đánh dấu cần kiểm tra thêm.' : 'Video này chưa hoàn tất đánh giá tổng hợp. Bạn có thể bổ sung phân tích cho video còn lưu.'}</Text>
          <>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: externalVideoConsent }} onPress={() => setExternalVideoConsent(value => !value)} style={{ marginTop: 10 }}><Text style={{ color: aura.ink }}>{externalVideoConsent ? '☑' : '☐'} Tôi đồng ý gửi video này tới Google Gemini để nhận xét.</Text></Pressable>
            <Pressable disabled={busy || !externalVideoConsent} style={[button, { opacity: busy || !externalVideoConsent ? .5 : 1 }]} onPress={() => void requestGeminiFeedback(current.id)}><Text style={{ color: '#fff', fontWeight: '800' }}>{busy ? 'Đang tổng hợp nhận xét...' : 'Hoàn tất đánh giá AI'}</Text></Pressable>
          </>
        </View>}
        {developerMode && current.videoAvailable && <Pressable disabled={busy} style={button} onPress={() => void reanalyze(current.id)}><Text style={{ color: '#fff', fontWeight: '800' }}>Phân tích lại bằng rule mới · lưu thành kết quả mới</Text></Pressable>}
        {!developerMode && current.videoAvailable && current.resultVersion !== 'exercise-analysis-result-4' && <Pressable disabled={busy} style={button} onPress={() => void reanalyzeMember(current.id)}><Text style={{ color: '#fff', fontWeight: '800' }}>Phân tích lại video đã lưu · nhận đánh giá AI mới</Text></Pressable>}
        <Pressable style={button} onPress={() => void pick(true)}><Text style={{ color: '#fff', fontWeight: '800' }}>Quay lại để thử điều chỉnh</Text></Pressable>
        {history.some(row => comparable(row, current)) && <View style={{ marginTop: 16 }}>
          <Text style={{ color: aura.ink, fontWeight: '800' }}>Đối chiếu với lần trước</Text>
          {history.filter(row => comparable(row, current)).slice(0, 3).map(row => <Pressable key={row.id} style={[button, { backgroundColor: aura.latte }]} onPress={() => void (developerMode ? exerciseAnalysis.developerDetail(row.id) : exerciseAnalysis.detail(row.id)).then(setComparison).catch(e => setError((e as Error).message))}><Text style={{ color: aura.ink }}>Xem lần #{row.id} · {new Date(row.createdAt).toLocaleDateString('vi-VN')}</Text></Pressable>)}
          {comparison && <View style={{ marginTop: 14, borderTopWidth: 1, borderColor: aura.border }}><Text style={{ fontWeight: '800', marginTop: 12 }}>Lần trước #{comparison.id}</Text>{comparison.ruleVersion !== current.ruleVersion && <Text style={{ color: aura.muted }}>Hai kết quả dùng phiên bản AI khác nhau; nhận xét có thể khác nhau.</Text>}<ExerciseAnalysisResult key={comparison.id} analysis={comparison} showExperimental={developerMode} /><Pressable onPress={() => setComparison(null)}><Text style={{ marginTop: 12 }}>Đóng đối chiếu</Text></Pressable></View>}
        </View>}
        {!developerMode && <View style={{ borderTopWidth: 1, borderColor: aura.border, marginTop: 16, paddingTop: 14 }}>
          <Text style={{ color: aura.ink, fontWeight: '800' }}>Gửi kết quả cho Coach</Text>
          {tierPolicy && !tierPolicy.canShareForPtFeedback ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: aura.muted, lineHeight: 19 }}>
                Gói Cơ bản (Basic) giới hạn 2 video / tuần và chỉ xem chỉ số góc khớp tự động. Hãy nâng cấp lên Gói Trung cấp (5 video/tuần + được PT nhận xét trực tiếp trên video) hoặc Gói Nâng cao (Không giới hạn + ưu tiên PT phản hồi trong vòng 24h).
              </Text>
              <Pressable style={[button, { backgroundColor: aura.caramel }]} onPress={() => router.push('/packages')}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Nâng cấp lên Gói Trung cấp / Nâng cao</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: aura.muted, marginTop: 7 }}>
                {tierPolicy?.priority24h
                  ? '⚡ Gói Nâng cao (Advanced): Không giới hạn video + ưu tiên PT phản hồi trong vòng 24h.'
                  : 'Gói Trung cấp (Intermediate): Được PT nhận xét trực tiếp trên video của bạn.'}
              </Text>
              {!current.videoAvailable && <Text style={{ color: '#B3261E', marginTop: 7 }}>Video này đã hết hạn hoặc không còn được lưu. Hãy tải video mới lên để Coach xem được clip.</Text>}
              {coaches.length === 0 ? <Text style={{ color: aura.muted, marginTop: 7 }}>Chỉ chia sẻ khi bạn có gói PT Trung cấp / Nâng cao còn hiệu lực với Coach.</Text> : coaches.map(coach => {
                const activeShare = current.shares?.find(item => item.coachId === coach.id && !item.revokedAt);
                return <View key={coach.id}>
                  {activeShare && <Text style={{ color: aura.muted, marginTop: 9 }}>{activeShare.includeVideo && current.videoAvailable ? `Đã gửi kết quả và video cho Coach ${coach.fullName}.` : activeShare.includeVideo ? `Đã chia sẻ kết quả với Coach ${coach.fullName}, nhưng video đã hết hạn.` : `Chia sẻ cũ với Coach ${coach.fullName} chỉ gồm kết quả; gửi lại để kèm video.`}</Text>}
                  {!activeShare && <Pressable disabled={busy} style={button} onPress={() => void changeShare(coach.id, false)}><Text style={{ color: '#fff', fontWeight: '800' }}>{current.videoAvailable ? `Gửi kết quả và video cho Coach ${coach.fullName}` : `Chia sẻ kết quả với Coach ${coach.fullName}`}</Text></Pressable>}
                  {activeShare && !activeShare.includeVideo && <Pressable disabled={busy || !current.videoAvailable} style={[button, { opacity: busy || !current.videoAvailable ? .5 : 1 }]} onPress={() => void changeShare(coach.id, false)}><Text style={{ color: '#fff', fontWeight: '800' }}>{current.videoAvailable ? `Gửi lại kết quả kèm video cho Coach ${coach.fullName}` : 'Video không còn để gửi'}</Text></Pressable>}
                  {!!activeShare && <Pressable disabled={busy} style={[button, { backgroundColor: aura.latte }]} onPress={() => void changeShare(coach.id, true)}><Text style={{ color: aura.ink, fontWeight: '800' }}>{`Thu hồi quyền xem của Coach ${coach.fullName}`}</Text></Pressable>}
                </View>;
              })}
            </>
          )}
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
