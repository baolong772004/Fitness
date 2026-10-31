import React, { useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { api, sessionStore, SOCKET_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dateLabel, list, timeLabel } from '../lib/theme';
import { Button, Card, Empty, Hero, Page, Section } from '../components/ui';

const days = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const mealNames: Record<string, string> = { BREAKFAST: 'Bữa sáng', LUNCH: 'Bữa trưa', DINNER: 'Bữa tối', SNACK: 'Bữa phụ' };
const ptLevelNames: Record<string, string> = { BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao' };
const metrics = [
  { key: 'weight', label: 'Cân nặng', unit: 'kg', icon: 'scale-outline' as const },
  { key: 'bodyFat', label: 'Mỡ cơ thể', unit: '%', icon: 'water-outline' as const },
  { key: 'muscleMass', label: 'Khối lượng cơ', unit: 'kg', icon: 'fitness-outline' as const },
];
function day(value: unknown) { return days[Number(value) - 1] || 'Ngày tập'; }
function numeric(value: unknown): number | null { const parsed = Number(value); return value == null || value === '' || !Number.isFinite(parsed) ? null : parsed; }
function format(value: unknown, unit = '') { const number = numeric(value); return number == null ? '—' : `${number.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ''}`; }

function PlanCard({ plan }: { plan: any }) {
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    setShowHistory(true); setHistoryLoading(true); setHistoryError(null); setSelectedVersion(null);
    try { setRevisions(list<any>((await api.workoutPlanRevisions(plan.id)).data)); }
    catch (cause) { setHistoryError(cause instanceof Error ? cause.message : 'Không tải được lịch sử.'); }
    finally { setHistoryLoading(false); }
  };
  return <Card>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="book-outline" size={21} color={aura.darkCoffee} /></View><View style={{ flex: 1 }}><Text style={{ fontSize: 17, fontWeight: '900', color: aura.darkCoffee }}>{plan.title}</Text><Text style={{ color: aura.muted, fontSize: 11 }}>Coach {plan.coach?.fullName || 'Aura'} · {dateLabel(plan.updatedAt || plan.createdAt)}</Text></View></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}><Text style={{ color: plan.status === 'ARCHIVED' ? aura.muted : aura.green, backgroundColor: plan.status === 'ARCHIVED' ? aura.cream : '#E9F4EA', borderRadius: 8, padding: 6, fontSize: 11, fontWeight: '800' }}>{plan.status === 'ARCHIVED' ? 'Đã lưu trữ' : 'Đang áp dụng'}</Text><Text style={{ color: aura.darkCoffee, fontSize: 11, padding: 6 }}>{plan.programName || 'PT'} · Phiên bản {plan.version || 1}</Text></View>
    <PlanBody plan={plan} />
    <View style={{ marginTop: 16 }}><Button compact secondary title={showHistory ? 'Ẩn lịch sử phiên bản' : 'Lịch sử phiên bản'} icon="time-outline" disabled={historyLoading} onPress={() => void loadHistory()} /></View>
    {showHistory && <View style={{ gap: 12, marginTop: 12 }}>
      {historyLoading && <Text style={{ color: aura.muted }}>Đang tải lịch sử...</Text>}
      {historyError && <Text accessibilityRole="alert" style={{ color: aura.caramel }}>{historyError}</Text>}
      {revisions.map(revision => <View key={revision.id} style={{ borderTopWidth: 1, borderColor: aura.border, paddingTop: 10, gap: 7 }}>
        <Button compact secondary title={`Phiên bản ${revision.version}${revision.version === plan.version ? ' · Hiện tại' : ''}`} onPress={() => setSelectedVersion(value => value === revision.version ? null : revision.version)} />
        <Text style={{ color: aura.muted, fontSize: 11 }}>{dateLabel(revision.createdAt)} · {revision.changedBy?.fullName}</Text>
        <Text style={{ color: aura.ink, fontSize: 12 }}>{revision.reason}</Text>
        {selectedVersion === revision.version && <View><Text style={{ color: aura.darkCoffee, fontWeight: '800' }}>{revision.title}</Text><PlanBody plan={revision} /></View>}
      </View>)}
    </View>}
  </Card>;
}

function PlanBody({ plan }: { plan: any }) {
  const sessions = list<any>(plan.sessions); const mealDays = list<any>(plan.mealDays);
  return <>
    {plan.description ? <Text style={{ color: aura.ink, lineHeight: 20, marginTop: 14 }}>{plan.description}</Text> : null}
    {sessions.length > 0 && <Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 11, letterSpacing: .8, marginTop: 18, marginBottom: 4 }}>BÀI TẬP THEO BUỔI</Text>}
    {sessions.map((session, index) => <View key={index} style={{ backgroundColor: aura.cream, borderRadius: 14, padding: 13, marginTop: 8 }}>
      <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 14 }}>{day(session.dayOfWeek)} · {session.title}</Text>
      {session.notes ? <Text style={{ color: aura.muted, fontSize: 12, marginTop: 4, lineHeight: 18 }}>{session.notes}</Text> : null}
      {list<any>(session.exercises).map((exercise, i) => <View key={i} style={{ flexDirection: 'row', gap: 9, marginTop: 10, alignItems: 'flex-start' }}><Ionicons name="checkmark-circle-outline" size={17} color={aura.caramel} /><View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontWeight: '800', fontSize: 12 }}>{exercise.exerciseName}</Text><Text style={{ color: aura.darkCoffee, fontSize: 11 }}>{exercise.sets} hiệp × {exercise.reps} lần{exercise.weightKg == null ? '' : ` · ${format(exercise.weightKg, 'kg')}`}</Text>{exercise.notes ? <Text style={{ color: aura.muted, fontSize: 11 }}>{exercise.notes}</Text> : null}{plan.status === 'ACTIVE' && (/squat/i.test(String(exercise.exerciseName || '')) ? <View style={{ marginTop: 7, alignSelf: 'flex-start' }}><Button compact title="AI kiểm tra kỹ thuật" icon="scan-outline" onPress={() => router.push({ pathname: '/exercise-analysis', params: { studentPlanId: String(plan.id) } })} /></View> : <Text style={{ color: aura.muted, marginTop: 5, fontSize: 11 }}>AI chưa hỗ trợ bài này</Text>)}</View></View>)}
    </View>)}
    {mealDays.length > 0 && <Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 11, letterSpacing: .8, marginTop: 19, marginBottom: 4 }}>THỰC ĐƠN THEO NGÀY</Text>}
    {mealDays.map((mealDay, index) => <View key={index} style={{ backgroundColor: '#FFF9F2', borderRadius: 14, padding: 13, marginTop: 8 }}>
      <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 14 }}>{day(mealDay.dayOfWeek)}</Text>
      {mealDay.notes ? <Text style={{ color: aura.muted, fontSize: 12, marginTop: 4 }}>{mealDay.notes}</Text> : null}
      {list<any>(mealDay.meals).map((meal, i) => <View key={i} style={{ marginTop: 10, borderTopWidth: i ? 1 : 0, borderTopColor: aura.border, paddingTop: i ? 8 : 0 }}><Text style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 12 }}>{mealNames[meal.mealType] || 'Bữa ăn'}{meal.time ? ` · ${meal.time}` : ''}</Text><Text style={{ color: aura.ink, fontSize: 12, marginTop: 2 }}>{meal.food} · {meal.portion}{meal.calories == null ? '' : ` · ${meal.calories} kcal`}</Text>{meal.notes ? <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2 }}>{meal.notes}</Text> : null}</View>)}
    </View>)}
  </>;
}

function InBody({ logs, metric, setMetric }: { logs: any[]; metric: string; setMetric: (metric: string) => void }) {
  const latest = logs[0]; const previous = logs[1];
  const chart = [...logs].reverse().map(row => numeric(row[metric])).filter((value): value is number => value != null);
  const min = chart.length ? Math.min(...chart) : 0; const max = chart.length ? Math.max(...chart) : 0; const span = max - min || 1;
  const points = chart.map((value, index) => ({ x: 16 + index * 268 / Math.max(chart.length - 1, 1), y: 90 - (value - min) / span * 70 }));
  return <>
    <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}><Text style={{ color: aura.muted, fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>LẦN ĐO GẦN NHẤT</Text><Text style={{ color: aura.muted, fontSize: 11 }}>{latest ? dateLabel(latest.loggedAt) : 'Chưa có dữ liệu'}</Text></View>
      <View style={{ flexDirection: 'row', gap: 7 }}>{metrics.map(item => { const current = numeric(latest?.[item.key]); const prior = numeric(previous?.[item.key]); const change = current != null && prior != null ? current - prior : null; return <View key={item.key} style={{ flex: 1, backgroundColor: '#FFFBF6', borderRadius: 13, padding: 9 }}><Ionicons name={item.icon} size={18} color={aura.caramel} /><Text numberOfLines={1} adjustsFontSizeToFit style={{ color: aura.darkCoffee, fontSize: 16, fontWeight: '900', marginTop: 6 }}>{format(current, item.unit)}</Text><Text numberOfLines={1} style={{ color: aura.muted, fontSize: 9, marginTop: 2 }}>{item.label}</Text>{change != null && <Text style={{ color: change < 0 ? aura.green : aura.caramel, fontSize: 9, fontWeight: '800', marginTop: 5 }}>{change > 0 ? '+' : ''}{format(change, item.unit)}</Text>}</View>; })}</View>
    </Card>
    {logs.length === 0 ? <Empty icon="analytics-outline" title="Chưa có dữ liệu InBody" message="Khi Coach ghi nhận chỉ số mới, biểu đồ tiến độ sẽ xuất hiện tại đây." /> : <Card><Text style={{ color: aura.ink, fontWeight: '900', fontSize: 15 }}>Biểu đồ thay đổi cơ thể</Text><View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>{metrics.map(item => <Text key={item.key} onPress={() => setMetric(item.key)} style={{ flex: 1, color: metric === item.key ? '#fff' : aura.darkCoffee, backgroundColor: metric === item.key ? aura.darkCoffee : aura.cream, borderRadius: 11, paddingVertical: 8, textAlign: 'center', fontSize: 10, fontWeight: '800' }}>{item.label}</Text>)}</View>
      <View style={{ alignItems: 'center', marginTop: 13 }}><Svg width="100%" height={108} viewBox="0 0 300 108"><Line x1="16" y1="92" x2="284" y2="92" stroke={aura.border} strokeWidth="1" />{points.length > 1 && <Polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={aura.caramel} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}{points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r="4" fill={aura.caramel} stroke="#fff" strokeWidth="1.5" />)}</Svg></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: aura.muted, fontSize: 10 }}>{dateLabel(logs.at(-1)?.loggedAt)}</Text><Text style={{ color: aura.muted, fontSize: 10 }}>{dateLabel(latest.loggedAt)}</Text></View>
    </Card>}
  </>;
}

function WorkoutCard({ row }: { row: any }) {
  const result = row.sessionResult || {}; const exercises = list<any>(result.exercises);
  return <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 40, height: 40, backgroundColor: aura.latte, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="barbell-outline" size={20} color={aura.darkCoffee} /></View><View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontWeight: '900', fontSize: 13 }}>{timeLabel(row.startTime)} · {dateLabel(row.startTime)}</Text><Text style={{ color: aura.muted, fontSize: 11 }}>Coach {row.coach?.fullName || 'Aura'}</Text></View><Text style={{ color: aura.green, backgroundColor: '#E9F4EA', borderRadius: 10, padding: 6, fontWeight: '900', fontSize: 9 }}>HOÀN THÀNH</Text></View>
    {(result.durationMin != null || result.calories != null) && <View style={{ flexDirection: 'row', gap: 7, marginTop: 14 }}>{result.durationMin != null && <Text style={{ backgroundColor: aura.cream, color: aura.darkCoffee, padding: 7, borderRadius: 9, fontSize: 11 }}>◷ {result.durationMin} phút</Text>}{result.calories != null && <Text style={{ backgroundColor: aura.cream, color: aura.darkCoffee, padding: 7, borderRadius: 9, fontSize: 11 }}>♨ {result.calories} kcal</Text>}</View>}
    {result.notes ? <Text style={{ color: aura.ink, lineHeight: 19, backgroundColor: aura.cream, borderRadius: 11, padding: 11, marginTop: 12, fontSize: 12 }}>{result.notes}</Text> : null}
    {exercises.length > 0 && <Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 10, letterSpacing: 1, marginTop: 14, marginBottom: 5 }}>GIÁO ÁN</Text>}
    {exercises.map((exercise, i) => <View key={i} style={{ flexDirection: 'row', gap: 7, marginTop: 6 }}><Ionicons name="checkmark" size={16} color={aura.caramel} /><Text style={{ color: aura.ink, fontSize: 12, flex: 1 }}>{exercise.exerciseName}</Text><Text style={{ color: aura.muted, fontSize: 11 }}>{exercise.sets} × {exercise.reps}{exercise.weightKg == null ? '' : ` · ${format(exercise.weightKg, 'kg')}`}</Text></View>)}
    {!result.notes && !exercises.length && result.durationMin == null && result.calories == null && <Text style={{ color: aura.muted, marginTop: 12, fontSize: 11, fontStyle: 'italic' }}>Coach chưa thêm ghi chú cho buổi tập này.</Text>}
  </Card>;
}

export default function Progress() {
  const { plansOnly } = useLocalSearchParams<{ plansOnly?: string }>(); const { user } = useAuth();
  const [data, setData] = useState<any>({}); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [metric, setMetric] = useState('weight');
  const [showArchived, setShowArchived] = useState(false);
  const load = useCallback(async (silent = false) => { if (!user) return; if (!silent) setLoading(true); setError(null); try { setData((await api.progress(user.id)).data || {}); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tiến độ.'); } finally { if (!silent) setLoading(false); } }, [user]);
  useFocusEffect(useCallback(() => {
    void load();
    const token = sessionStore.token();
    if (!user || !token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('notification:new', () => void load(true));
    socket.on('connect', () => void load(true));
    return () => { socket.disconnect(); };
  }, [load, user]));
  const plans = list<any>(data.plans); const logs = list<any>(data.inbodyLogs); const workouts = list<any>(data.workoutLogs); const assessments = list<any>(data.assessments);
  const activePlans = plans.filter(plan => plan.status !== 'ARCHIVED');
  const archivedPlans = plans.filter(plan => plan.status === 'ARCHIVED');
  return <Page loading={loading} refresh={user ? () => void load() : undefined}>
    {!user && <><Empty title="Đăng nhập để xem tiến độ" message="Giáo án, dinh dưỡng và chỉ số InBody của bạn sẽ hiển thị tại đây." /><Button title="Đăng nhập" onPress={() => router.push('/auth')} /></>}
    {error && <><Empty icon="wifi-outline" title="Chưa tải được tiến độ" message={error} /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {user && <>
    {!plansOnly && <Hero eyebrow="HÀNH TRÌNH CỦA BẠN" title={`Tiến bộ mỗi ngày,\n${user?.fullName || 'hội viên Aura'}`} subtitle={`${logs.length} lần đo · ${workouts.length} buổi PT`} />}
    {!plansOnly && <><Section title="Đánh giá lộ trình PT" subtitle="Mục tiêu, kết quả đo và bước tập tiếp theo từ Coach" icon="clipboard-outline" />
      {assessments.length === 0 ? <Empty title="Chưa có đánh giá PT" message="Coach sẽ ghi đánh giá đầu vào và cập nhật tiến bộ theo cấp PT của bạn." /> : assessments.map(record => <Card key={String(record.id)}>
        <Text style={{ color: aura.darkCoffee, fontSize: 14, fontWeight: '900' }}>{record.kind === 'BASELINE' ? 'Đánh giá đầu vào' : 'Đánh giá tiến bộ'} · {ptLevelNames[record.level] || record.level}</Text>
        <Text style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>Coach {record.coach?.fullName || 'Aura'} · {dateLabel(record.createdAt)}</Text>
        {record.goal ? <Text style={{ color: aura.ink, marginTop: 9, fontSize: 12 }}>Mục tiêu: {record.goal}</Text> : null}
        {record.phaseName ? <Text style={{ color: aura.ink, marginTop: 5, fontSize: 12 }}>Giai đoạn: {record.phaseName}</Text> : null}
        {record.movementNotes ? <Text style={{ color: aura.ink, marginTop: 5, fontSize: 12 }}>Kỹ thuật: {record.movementNotes}</Text> : null}
        {record.metricName ? <Text style={{ color: aura.ink, marginTop: 5, fontSize: 12 }}>{record.metricName}: {format(record.metricValue)}</Text> : null}
        <Text style={{ color: aura.darkCoffee, marginTop: 9, fontSize: 12, fontWeight: '800' }}>Bước tiếp theo: {record.nextSteps}</Text>
      </Card>)}
    </>}
    <Section title="Giáo án & Dinh dưỡng" subtitle="Kế hoạch Coach dành cho bạn" icon="book-outline" />
    {activePlans.length === 0 ? <Empty title="Chưa có kế hoạch đang áp dụng" message="Coach sẽ gửi giáo án và thực đơn cho bạn tại đây." icon="restaurant-outline" /> : activePlans.map(plan => <PlanCard key={`${plan.id}-${plan.version}`} plan={plan} />)}
    {archivedPlans.length > 0 && <><Button secondary title={`${showArchived ? 'Ẩn' : 'Xem'} giáo án cũ (${archivedPlans.length})`} icon="archive-outline" onPress={() => setShowArchived(value => !value)} />{showArchived && archivedPlans.map(plan => <PlanCard key={`${plan.id}-${plan.version}`} plan={plan} />)}</>}
    {!plansOnly && <><Section title="Chỉ số InBody" subtitle="Theo dõi thay đổi cơ thể qua từng lần đo" icon="analytics-outline" /><InBody logs={logs} metric={metric} setMetric={setMetric} />
      <Section title="Nhật ký buổi tập" subtitle="Các buổi PT hoàn thành gần đây" icon="barbell-outline" />{workouts.length === 0 ? <Empty title="Chưa có nhật ký buổi tập" message="Kết quả sẽ hiển thị sau khi Coach hoàn tất buổi PT." /> : workouts.map(row => <WorkoutCard key={String(row.id)} row={row} />)}</>}
    </>}
  </Page>;
}
