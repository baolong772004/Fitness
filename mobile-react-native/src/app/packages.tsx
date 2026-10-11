import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, money } from '../lib/theme';
import { Button, Card, Empty, Hero, Page, Pill, Section, showError } from '../components/ui';

export default function Packages() {
  const { user } = useAuth(); const [rows, setRows] = useState<any[]>([]); const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL'); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [ptPackage, setPtPackage] = useState<any | null>(null); const [coaches, setCoaches] = useState<any[]>([]);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setRows(await api.packages()); if (user) setSubscriptions(await api.subscriptions().catch(() => [])); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được gói tập.'); } finally { setLoading(false); } }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const goCheckout = (checkout: any, pkg: any, kind: string) => {
    const data = checkout.data || checkout;
    router.push({ pathname: '/checkout', params: { data: JSON.stringify(data), pkg: JSON.stringify(pkg), kind } });
  };
  const buyMembership = async (pkg: any) => {
    const existing = subscriptions.filter(sub => Number(sub.package?.id) === Number(pkg.id) && ['ACTIVE', 'EXPIRED'].includes(sub.status)).sort((a, b) => (a.status === 'ACTIVE' ? -1 : 1))[0];
    Alert.alert(existing ? 'Gia hạn gói tập?' : 'Xác nhận đăng ký', `${pkg.name} · ${money(pkg.price)}\nThanh toán qua PayOS; gói chỉ được kích hoạt sau khi thanh toán thành công.`, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Tiếp tục', onPress: () => void (async () => { setBusy(true); try { const checkout = existing ? await api.renew(Number(existing.id), Number(pkg.id)) : await api.checkout(Number(pkg.id)); goCheckout(checkout, pkg, existing ? 'renew' : 'membership'); } catch (error) { showError(error); } finally { setBusy(false); } })() },
    ]);
  };
  const buy = async (pkg: any) => {
    if (!user) return router.push('/auth');
    if (pkg.type !== 'PT') return buyMembership(pkg);
    if (!pkg.totalPtSessions || pkg.totalPtSessions <= 0) return Alert.alert('Gói PT chưa sẵn sàng', 'Gói này chưa được cấu hình số buổi.');
    const now = Date.now(); const hasMembership = subscriptions.some(sub => sub.package?.type === 'MEMBERSHIP' && sub.status === 'ACTIVE' && new Date(sub.startDate).getTime() <= now && new Date(sub.endDate).getTime() >= now);
    if (!hasMembership) return Alert.alert('Cần gói hội viên còn hạn', 'Bạn cần Membership đang hoạt động trước khi mua PT.', [{ text: 'Để sau' }, { text: 'Xem Membership', onPress: () => setFilter('MEMBERSHIP') }]);
    setBusy(true); try { const available = await api.coaches(); if (available.length === 0) return Alert.alert('Chưa có Coach', 'Vui lòng thử lại sau.'); setCoaches(available); setPtPackage(pkg); } catch (error) { showError(error); } finally { setBusy(false); }
  };
  const buyWithCoach = (coach: any) => { const pkg = ptPackage; setPtPackage(null); if (!pkg) return; Alert.alert('Thanh toán gói PT', `Gói ${pkg.name} · ${money(pkg.price)}\n${pkg.totalPtSessions} buổi PT · HLV: ${coach.fullName}\n\nGói được kích hoạt sau khi thanh toán PayOS thành công.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Tiếp tục thanh toán', onPress: () => void (async () => { setBusy(true); try { const checkout = await api.buyPt(Number(pkg.id), Number(coach.userId)); goCheckout(checkout, pkg, 'pt'); } catch (error) { showError(error); } finally { setBusy(false); } })() }]); };
  return <Page loading={loading} refresh={() => void load()}><Hero eyebrow="AURA FITNESS" title="Chọn gói tập phù hợp" subtitle="Membership theo thời hạn. PT theo số buổi với huấn luyện viên của bạn." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{['ALL', 'MEMBERSHIP', 'PT'].map(key => <Pressable key={key} onPress={() => setFilter(key)} style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: filter === key ? aura.darkCoffee : aura.white, borderWidth: 1, borderColor: aura.border, borderRadius: 20 }}><Text style={{ color: filter === key ? aura.white : aura.darkCoffee, fontWeight: '800', fontSize: 12 }}>{key === 'ALL' ? 'Tất cả' : key === 'PT' ? 'Gói PT' : 'Membership'}</Text></Pressable>)}</View>
    <Section title="Gói tập & Khóa học" icon="medal-outline" />
    {error && <><Empty title="Chưa tải được gói tập" message={error} icon="wifi-outline" /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && rows.filter(row => filter === 'ALL' || row.type === filter).length === 0 && !loading ? <Empty title="Chưa có gói phù hợp" /> : !error && rows.filter(row => filter === 'ALL' || row.type === filter).map(pkg => { const pt = pkg.type === 'PT'; const invalidPt = pt && !(Number(pkg.totalPtSessions) > 0); const renewal = !pt && subscriptions.some(sub => Number(sub.package?.id) === Number(pkg.id) && ['ACTIVE', 'EXPIRED'].includes(sub.status)); return <Card key={String(pkg.id)} style={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ width: 46, height: 46, backgroundColor: aura.latte, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={pt ? 'fitness-outline' : 'ribbon-outline'} size={25} color={aura.caramel} /></View><View style={{ flex: 1 }}><Pill text={pt ? 'PT CÁ NHÂN' : 'HỘI VIÊN'} /><Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900', marginTop: 6 }}>{pkg.name}</Text></View></View>
      {!!pkg.description && <Text style={{ color: aura.muted, marginTop: 12, lineHeight: 18, fontSize: 12 }}>{pkg.description}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 }}><Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>◷  {Number(pkg.durationDays) > 0 ? `${pkg.durationDays} ngày tập luyện` : 'Linh hoạt theo gói'}</Text>{pt ? <Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>♢  {invalidPt ? 'Chưa cấu hình số buổi' : `${pkg.totalPtSessions} buổi PT`}</Text> : Number(pkg.trialPtSessions) > 0 ? <Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>♢  {pkg.trialPtSessions} buổi PT tặng kèm</Text> : null}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: aura.muted, fontSize: 9, fontWeight: '800' }}>GIÁ GÓI</Text><Text style={{ color: aura.caramel, fontSize: 20, fontWeight: '900' }}>{money(pkg.price)}</Text></View><View style={{ minWidth: 128 }}><Button compact loading={busy} disabled={busy || invalidPt} title={invalidPt ? 'Chưa sẵn sàng' : renewal ? 'Gia hạn gói' : pt ? 'Mua gói PT' : 'Đăng ký gói'} onPress={() => void buy(pkg)} /></View></View>
    </Card>; })}
    <Modal visible={!!ptPackage} transparent animationType="slide" onRequestClose={() => setPtPackage(null)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}><View style={{ maxHeight: '72%', backgroundColor: aura.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 }}><Text style={{ color: aura.darkCoffee, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Chọn huấn luyện viên</Text><ScrollView>{coaches.map(coach => <Pressable key={String(coach.userId)} onPress={() => buyWithCoach(coach)}><Card style={{ marginBottom: 8, flexDirection: 'row', gap: 11, alignItems: 'center' }}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}>{coach.avatar ? <Image source={{ uri: coach.avatar }} style={{ width: 42, height: 42, borderRadius: 21 }} /> : <Ionicons name="person-outline" size={23} color={aura.caramel} />}</View><View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontWeight: '900' }}>{coach.fullName}</Text><Text style={{ color: aura.muted, fontSize: 12 }}>{coach.specialization || 'Huấn luyện viên Aura'}{coach.rating ? ` · ★ ${coach.rating}` : ''}</Text></View><Ionicons name="chevron-forward" size={17} color={aura.caramel} /></Card></Pressable>)}</ScrollView><Button secondary title="Đóng" onPress={() => setPtPackage(null)} /></View></View></Modal>
  </Page>;
}
