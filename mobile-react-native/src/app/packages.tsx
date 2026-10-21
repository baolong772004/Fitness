import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, money } from '../lib/theme';
import { Button, Card, Empty, Hero, Page, Pill, Section, showError } from '../components/ui';

export default function Packages() {
  const { user } = useAuth(); const [rows, setRows] = useState<any[]>([]); const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL'); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [ptPackage, setPtPackage] = useState<any | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const [packages, products] = await Promise.all([api.packages('MEMBERSHIP'), api.ptProducts()]); setRows([...packages, ...products.map(item => ({ ...item, id: `pt-${item.id}`, productId: item.id, type: 'PT', totalPtSessions: item.sessionCount, ptLevel: item.level, durationDays: item.durationDays }))]); if (user) setSubscriptions(await api.subscriptions().catch(() => [])); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được gói tập.'); } finally { setLoading(false); } }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const goCheckout = (checkout: any, pkg: any, kind: string) => {
    const data = checkout.data || checkout;
    router.push({ pathname: '/checkout', params: { data: JSON.stringify(data), pkg: JSON.stringify(pkg), kind } });
  };
  const membershipFor = (pkg: any) => {
    const matching = subscriptions.filter(sub => Number(sub.package?.id) === Number(pkg.id));
    return matching.find(sub => sub.status === 'PENDING_ACTIVATION')
      ?? matching.find(sub => sub.status === 'ACTIVE')
      ?? matching.find(sub => sub.status === 'EXPIRED');
  };
  const buyMembership = async (pkg: any) => {
    const existing = membershipFor(pkg);
    if (existing?.status === 'PENDING_ACTIVATION') {
      Alert.alert('Gói đang chờ kích hoạt', `Bạn đã sở hữu gói ${pkg.name} đang chờ kích hoạt. Gói này sẽ tự động kích hoạt khi đến lượt sử dụng.`);
      return;
    }
    const renewTitle = 'Gia hạn gói tập?';
    Alert.alert(existing ? renewTitle : 'Xác nhận đăng ký', `${pkg.name} · ${money(pkg.price)}\nGói sẽ được xếp sau các gói Gym đã xác nhận trước đó. Thứ tự dựa trên lúc hệ thống xác nhận thanh toán.`, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Tiếp tục', onPress: () => void (async () => { setBusy(true); try { const checkout = existing ? await api.renew(Number(existing.id), Number(pkg.id)) : await api.checkout(Number(pkg.id)); goCheckout(checkout, pkg, existing ? 'renew' : 'membership'); } catch (error) { showError(error); } finally { setBusy(false); } })() },
    ]);
  };
  const buy = async (pkg: any) => {
    if (!user) return router.push('/auth');
    if (pkg.type !== 'PT') return buyMembership(pkg);
    if (!pkg.totalPtSessions || pkg.totalPtSessions <= 0) return Alert.alert('Gói PT chưa sẵn sàng', 'Gói này chưa được cấu hình số buổi.');
    setPtPackage(pkg);
  };
  const buyCredit = (quantity: number) => { const pkg = ptPackage; setPtPackage(null); if (!pkg) return; Alert.alert('Thanh toán PT Credit', `${pkg.name} · ${quantity * pkg.totalPtSessions} buổi ${pkg.ptLevel} · ${pkg.durationDays} ngày từ khi xác nhận thanh toán · ${money(Number(pkg.price) * quantity)}`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Tiếp tục', onPress: () => void (async () => { setBusy(true); try { const checkout = await api.buyPtCredit(Number(pkg.productId), quantity); goCheckout(checkout, { ...pkg, price: Number(pkg.price) * quantity }, 'pt'); } catch (error) { showError(error); } finally { setBusy(false); } })() }]); };
  return <Page loading={loading} refresh={() => void load()}><Hero eyebrow="AURA FITNESS" title="Chọn gói tập phù hợp" subtitle="Membership theo thời hạn. PT theo số buổi với huấn luyện viên của bạn." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{['ALL', 'MEMBERSHIP', 'PT'].map(key => <Pressable key={key} onPress={() => setFilter(key)} style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: filter === key ? aura.darkCoffee : aura.white, borderWidth: 1, borderColor: aura.border, borderRadius: 20 }}><Text style={{ color: filter === key ? aura.white : aura.darkCoffee, fontWeight: '800', fontSize: 12 }}>{key === 'ALL' ? 'Tất cả' : key === 'PT' ? 'Gói PT' : 'Membership'}</Text></Pressable>)}</View>
    <Section title="Gói tập & Khóa học" icon="medal-outline" />
    {error && <><Empty title="Chưa tải được gói tập" message={error} icon="wifi-outline" /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && rows.filter(row => filter === 'ALL' || row.type === filter).length === 0 && !loading ? <Empty title="Chưa có gói phù hợp" /> : !error && rows.filter(row => filter === 'ALL' || row.type === filter).map(pkg => { const pt = pkg.type === 'PT'; const invalidPt = pt && !(Number(pkg.totalPtSessions) > 0); const renewalSub = !pt ? membershipFor(pkg) : undefined; const renewal = !!renewalSub; return <Card key={String(pkg.id)} style={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ width: 46, height: 46, backgroundColor: aura.latte, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={pt ? 'fitness-outline' : 'ribbon-outline'} size={25} color={aura.caramel} /></View><View style={{ flex: 1 }}><Pill text={pt ? 'PT CÁ NHÂN' : 'HỘI VIÊN'} /><Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900', marginTop: 6 }}>{pkg.name}</Text></View></View>
      {!!pkg.description && <Text style={{ color: aura.muted, marginTop: 12, lineHeight: 18, fontSize: 12 }}>{pkg.description}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 }}><Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>◷  {pt ? `${pkg.durationDays} ngày từ khi thanh toán` : `${pkg.durationDays} ngày tập luyện`}</Text>{pt ? <Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>♢  {invalidPt ? 'Chưa cấu hình số buổi' : `${pkg.totalPtSessions} buổi ${pkg.ptLevel}`}</Text> : Number(pkg.trialPtSessions) > 0 ? <Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>♢  {pkg.trialPtSessions} buổi PT tặng kèm</Text> : null}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: aura.muted, fontSize: 9, fontWeight: '800' }}>GIÁ GÓI</Text><Text style={{ color: aura.caramel, fontSize: 20, fontWeight: '900' }}>{money(pkg.price)}</Text></View><View style={{ minWidth: 128 }}><Button compact loading={busy} disabled={busy || invalidPt} title={invalidPt ? 'Chưa sẵn sàng' : renewalSub?.status === 'PENDING_ACTIVATION' ? 'Đang chờ kích hoạt' : renewal ? 'Gia hạn gói' : pt ? 'Mua gói PT' : 'Đăng ký gói'} onPress={() => void buy(pkg)} /></View></View>
    </Card>; })}
    <Modal visible={!!ptPackage} transparent animationType="slide" onRequestClose={() => setPtPackage(null)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}><View style={{ backgroundColor: aura.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 9 }}><Text style={{ color: aura.darkCoffee, fontSize: 20, fontWeight: '900' }}>Chọn số lần mua</Text><Text style={{ color: aura.muted, marginBottom: 5 }}>{ptPackage?.name} · {ptPackage?.totalPtSessions} buổi mỗi lần</Text>{[1, 2, 3, 5, 10].map(quantity => <Button key={quantity} secondary title={`${quantity} × ${ptPackage?.totalPtSessions} = ${quantity * Number(ptPackage?.totalPtSessions || 0)} buổi · ${money(quantity * Number(ptPackage?.price || 0))}`} onPress={() => buyCredit(quantity)} />)}<Button secondary title="Đóng" onPress={() => setPtPackage(null)} /></View></View></Modal>
  </Page>;
}
