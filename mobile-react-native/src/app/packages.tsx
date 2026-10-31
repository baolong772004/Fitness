import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, money } from '../lib/theme';
import { hasActiveGymMembership } from '../lib/membership';
import { Button, Card, Empty, Hero, Page, Pill, Section, showError } from '../components/ui';

export default function Packages() {
  const { user } = useAuth(); const [rows, setRows] = useState<any[]>([]); const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL'); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const [packages, products, offers, currentSubscriptions] = await Promise.all([api.packages('MEMBERSHIP'), api.ptProducts(), api.ptSingleOffers(), user ? api.subscriptions() : Promise.resolve([])]); const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']; const ptRows = levels.flatMap(level => { const choices = products.filter((item: any) => item.level === level); const offer = offers.find(item => item.level === level); if (!choices.length && !offer) return []; const first = choices[0]; const prices = [...choices.map((item: any) => Number(item.price)), ...(offer ? [Number(offer.price)] : [])]; return [{ id: `pt-${level}`, type: 'PT', name: `PT ${level.charAt(0)}${level.slice(1).toLowerCase()}`, ptLevel: level, totalPtSessions: first?.sessionCount ?? 1, durationDays: first?.durationDays ?? offer?.durationDays, price: Math.min(...prices), singleOnly: !first, description: 'Chọn gói tập hoặc số buổi lẻ phù hợp với bạn.' }]; }); setRows([...packages, ...ptRows]); setSubscriptions(currentSubscriptions); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được gói tập.'); } finally { setLoading(false); } }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const canBuyPt = hasActiveGymMembership(subscriptions);
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
    if (!pkg.totalPtSessions || pkg.totalPtSessions <= 0) return Alert.alert('PT chưa sẵn sàng', 'Cấp độ này chưa được cấu hình số buổi.');
    router.push({ pathname: '/pt-purchase', params: { level: pkg.ptLevel } });
  };
  return <Page loading={loading} refresh={() => void load()}><Hero eyebrow="AURA FITNESS" title="Chọn gói tập phù hợp" subtitle="Membership theo thời hạn. PT theo số buổi với huấn luyện viên của bạn." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{['ALL', 'MEMBERSHIP', 'PT'].map(key => <Pressable key={key} onPress={() => setFilter(key)} style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: filter === key ? aura.darkCoffee : aura.white, borderWidth: 1, borderColor: aura.border, borderRadius: 20 }}><Text style={{ color: filter === key ? aura.white : aura.darkCoffee, fontWeight: '800', fontSize: 12 }}>{key === 'ALL' ? 'Tất cả' : key === 'PT' ? 'Gói PT' : 'Membership'}</Text></Pressable>)}</View>
    <Section title="Gói tập & Khóa học" icon="medal-outline" />
    {user && !loading && !error && !canBuyPt && <Card style={{ padding: 16 }}><Text style={{ color: aura.darkCoffee, fontWeight: '800', marginBottom: 6 }}>Cần Membership Gym để mua PT</Text><Text style={{ color: aura.muted, marginBottom: 12 }}>Hãy mua và kích hoạt gói Membership Gym trước khi mua buổi PT.</Text><Button secondary title="Xem gói Membership" onPress={() => setFilter('MEMBERSHIP')} /></Card>}
    {error && <><Empty title="Chưa tải được gói tập" message={error} icon="wifi-outline" /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && rows.filter(row => filter === 'ALL' || row.type === filter).length === 0 && !loading ? <Empty title="Chưa có gói phù hợp" /> : !error && rows.filter(row => filter === 'ALL' || row.type === filter).map(pkg => { const pt = pkg.type === 'PT'; const invalidPt = pt && !(Number(pkg.totalPtSessions) > 0); const renewalSub = !pt ? membershipFor(pkg) : undefined; const renewal = !!renewalSub; return <Card key={String(pkg.id)} style={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ width: 46, height: 46, backgroundColor: aura.latte, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={pt ? 'fitness-outline' : 'ribbon-outline'} size={25} color={aura.caramel} /></View><View style={{ flex: 1 }}><Pill text={pt ? 'PT CÁ NHÂN' : 'HỘI VIÊN'} /><Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900', marginTop: 6 }}>{pkg.name}</Text></View></View>
      {!!pkg.description && <Text style={{ color: aura.muted, marginTop: 12, lineHeight: 18, fontSize: 12 }}>{pkg.description}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 }}><Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>◷  {pt ? 'Thời hạn theo sản phẩm' : `${pkg.durationDays} ngày tập luyện`}</Text>{pt ? <Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>♢  {pkg.ptLevel}</Text> : Number(pkg.trialPtSessions) > 0 ? <Text style={{ color: aura.darkCoffee, backgroundColor: aura.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, fontSize: 11 }}>♢  {pkg.trialPtSessions} buổi PT tặng kèm</Text> : null}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: aura.muted, fontSize: 9, fontWeight: '800' }}>{pt ? 'GIÁ TỪ' : 'GIÁ GÓI'}</Text><Text style={{ color: aura.caramel, fontSize: 20, fontWeight: '900' }}>{money(pkg.price)}</Text></View><View style={{ minWidth: 128, gap: 7 }}><Button compact loading={busy} disabled={busy || invalidPt} title={invalidPt ? 'Chưa sẵn sàng' : renewalSub?.status === 'PENDING_ACTIVATION' ? 'Đang chờ kích hoạt' : renewal ? 'Gia hạn gói' : pt ? 'Xem lựa chọn PT' : 'Đăng ký gói'} onPress={() => void buy(pkg)} /></View></View>
    </Card>; })}
  </Page>;
}
