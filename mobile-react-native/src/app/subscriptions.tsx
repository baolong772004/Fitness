import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { aura, dateLabel, money } from '../lib/theme';
import { Button, Card, Empty, Page, Pill, Section, showError } from '../components/ui';

const statusNames: Record<string, string> = { ACTIVE: 'Đang hoạt động', PENDING: 'Chờ xác nhận', EXPIRED: 'Đã hết hạn', CANCELLED: 'Đã hủy', COMPLETED: 'Đã hoàn thành' };

export default function Subscriptions() {
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [renewingId, setRenewingId] = useState<number | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setRows(await api.subscriptions()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách gói.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const renew = (sub: any) => {
    const pkg = sub.package;
    if (!pkg?.id || !sub.id) return;
    Alert.alert('Gia hạn gói tập?', `Bạn sẽ thanh toán ${money(pkg.price)} để gia hạn ${pkg.name}.`, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Tiếp tục thanh toán', onPress: () => void (async () => {
        setRenewingId(Number(sub.id));
        try { const result = await api.renew(Number(sub.id), Number(pkg.id)); router.push({ pathname: '/checkout', params: { data: JSON.stringify(result.data || result), pkg: JSON.stringify(pkg), kind: 'renew' } }); }
        catch (cause) { showError(cause); } finally { setRenewingId(null); }
      })() },
    ]);
  };
  return <Page loading={loading} refresh={() => void load()}><LinearGradient colors={[aura.espresso, aura.darkCoffee]} style={{ borderRadius: 20, padding: 17, flexDirection: 'row', gap: 13, alignItems: 'center' }}><View style={{ width: 46, height: 46, backgroundColor: '#FFFFFF24', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="ribbon-outline" size={25} color="#fff" /></View><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Hội viên Aura Fitness</Text><Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 3 }}>{rows.filter(row => row.status === 'ACTIVE').length} gói đang hoạt động • {rows.length} gói tất cả</Text></View></LinearGradient>
    <Section title="Gói tập đang sở hữu" icon="card-outline" />
    {error && rows.length === 0 && <><Empty title="Chưa tải được danh sách gói" message={error} icon="wifi-outline" /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && rows.length === 0 && !loading && <Empty title="Bạn chưa có gói tập" message="Khám phá gói Aura phù hợp với mục tiêu của bạn." />}
    {rows.map(sub => { const pkg = sub.package; const pt = pkg?.type === 'PT'; const status = String(sub.status || ''); const active = status === 'ACTIVE'; const statusColor = active ? aura.green : status === 'PENDING' ? aura.caramel : '#B3261E'; return <Card key={String(sub.id)} style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}><View style={{ width: 42, height: 42, backgroundColor: aura.latte, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={pt ? 'fitness-outline' : 'ribbon-outline'} size={22} color={aura.caramel} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: aura.ink, fontSize: 15, fontWeight: '900' }}>{pkg?.name || 'Gói tập Aura'}</Text><Text style={{ color: aura.muted, fontSize: 11 }}>{pt ? 'Huấn luyện cá nhân' : 'Hội viên'}</Text></View><Pill text={statusNames[status] || status} color={statusColor} /></View>
      <View style={{ height: 1, backgroundColor: aura.border, marginVertical: 13 }} />
      <View style={{ flexDirection: 'row' }}><View style={{ flex: 1 }}><Text style={{ color: aura.muted, fontSize: 10, fontWeight: '800' }}>BẮT ĐẦU</Text><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 3 }}>{dateLabel(sub.startDate)}</Text></View><View style={{ flex: 1 }}><Text style={{ color: aura.muted, fontSize: 10, fontWeight: '800' }}>KẾT THÚC</Text><Text style={{ color: aura.ink, fontWeight: '800', marginTop: 3 }}>{dateLabel(sub.endDate)}</Text></View></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 13 }}><Ionicons name={pt ? 'barbell-outline' : 'time-outline'} size={17} color={aura.caramel} /><Text style={{ color: aura.darkCoffee, fontSize: 12, fontWeight: '700', marginLeft: 7, flex: 1 }}>{pt ? `Còn ${sub.remainingSessions ?? 0} buổi PT` : Number(sub.remainingSessions) > 0 ? `Buổi PT tặng kèm: ${sub.remainingSessions}` : 'Ra vào phòng tập theo thời hạn gói'}</Text>{pkg?.price != null && <Text style={{ color: aura.darkCoffee, fontSize: 12, fontWeight: '900' }}>{money(pkg.price)}</Text>}</View>
      {pt && sub.coach?.fullName && <Text style={{ color: aura.muted, fontSize: 11, marginTop: 5 }}>Coach {sub.coach.fullName}</Text>}
      {pt && active && sub.coachId && <View style={{ marginTop: 14 }}><Button icon="calendar-outline" disabled={Number(sub.remainingSessions || 0) <= 0} title={Number(sub.remainingSessions || 0) <= 0 ? 'Gói PT chưa có buổi khả dụng' : `Đặt lịch với ${sub.coach?.fullName || 'Coach'}`} onPress={() => router.push({ pathname: '/pt-book', params: { subscription: JSON.stringify(sub) } })} /></View>}
      {!pt && ['ACTIVE', 'EXPIRED'].includes(status) && <View style={{ marginTop: 14 }}><Button icon="refresh-outline" loading={renewingId === Number(sub.id)} disabled={renewingId != null} title={renewingId === Number(sub.id) ? 'Đang tạo đơn gia hạn...' : 'Gia hạn gói tập'} onPress={() => renew(sub)} /></View>}
    </Card>; })}
    <Button secondary title="Xem thêm gói tập" onPress={() => router.push('/packages')} />
  </Page>;
}
