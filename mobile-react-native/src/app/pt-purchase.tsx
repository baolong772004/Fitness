import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { hasActiveGymMembership } from '../lib/membership';
import { aura, money } from '../lib/theme';
import { Button, Card, Empty, Hero, Page, Pill, showError } from '../components/ui';

type PtPackage = { id: number; name: string; level: string; sessionCount: number; durationDays: number; price: number; benefits: string | null };
type SingleOffer = Awaited<ReturnType<typeof api.ptSingleOffers>>[number];
const levelNames: Record<string, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' };

export default function PtPurchase() {
  const params = useLocalSearchParams<{ level?: string; tab?: string }>();
  const level = typeof params.level === 'string' ? params.level.toUpperCase() : '';
  const { user } = useAuth();
  const [tab, setTab] = useState<'PACKAGE' | 'SINGLE'>(params.tab === 'single' ? 'SINGLE' : 'PACKAGE');
  const [products, setProducts] = useState<PtPackage[]>([]);
  const [offer, setOffer] = useState<SingleOffer | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [canBuy, setCanBuy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!levelNames[level]) return;
    setLoading(true); setError(null);
    try {
      const [allProducts, offers, subscriptions] = await Promise.all([
        api.ptProducts(), api.ptSingleOffers(), user ? api.subscriptions() : Promise.resolve([]),
      ]);
      const available = allProducts.filter((item: PtPackage) => item.level === level && item.sessionCount > 0 && item.durationDays > 0);
      setProducts(available);
      const nextOffer = offers.find(item => item.level === level) ?? null;
      setOffer(nextOffer);
      setQuantity(current => Math.max(1, Math.min(current, nextOffer?.maxQuantity ?? 1)));
      setSelectedId(current => available.some((item: PtPackage) => item.id === current) ? current : available[0]?.id ?? null);
      setCanBuy(hasActiveGymMembership(subscriptions));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được sản phẩm PT.');
    } finally { setLoading(false); }
  }, [level, user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const selected = products.find(item => item.id === selectedId);
  const maxQuantity = offer?.maxQuantity ?? 1;
  const amount = tab === 'PACKAGE' ? Number(selected?.price ?? 0) : Number(offer?.price ?? 0) * quantity;
  const sessions = tab === 'PACKAGE' ? selected?.sessionCount ?? 0 : quantity;
  const days = tab === 'PACKAGE' ? selected?.durationDays ?? 0 : offer?.durationDays ?? 0;
  const available = tab === 'PACKAGE' ? !!selected : !!offer;

  const checkout = () => {
    if (!user) { router.push('/auth'); return; }
    if (!canBuy) { Alert.alert('Cần Membership Gym', 'Bạn cần Membership Gym đã thanh toán và còn hiệu lực trước khi mua PT.'); return; }
    if (!available || busy) return;
    Alert.alert('Xác nhận mua PT', `${tab === 'PACKAGE' ? selected?.name : `${quantity} buổi lẻ ${levelNames[level]}`} · ${sessions} buổi · ${days} ngày · ${money(amount)}`,
      [{ text: 'Để sau', style: 'cancel' }, { text: 'Thanh toán', onPress: () => void (async () => {
        setBusy(true);
        try {
          const result = await api.checkoutPtItems([{ mode: tab, ...(tab === 'PACKAGE' ? { productId: selected!.id } : { level }), quantity: tab === 'PACKAGE' ? 1 : quantity }]);
          const data = result.data || result;
          router.push({ pathname: '/checkout', params: { data: JSON.stringify(data),
            pkg: JSON.stringify({ name: tab === 'PACKAGE' ? selected!.name : `PT ${levelNames[level]} buổi lẻ`,
              price: data.amount ?? amount, totalPtSessions: data.sessions ?? sessions, durationDays: days }), kind: 'pt' } });
        } catch (cause) { showError(cause); } finally { setBusy(false); }
      })() }]);
  };

  if (!levelNames[level]) return <Page><Empty title="Cấp độ PT không hợp lệ" /></Page>;
  return <View style={{ flex: 1, backgroundColor: aura.cream }}>
    <Page loading={loading} refresh={() => void load()}>
      <Hero eyebrow="PT CÁ NHÂN" title={`PT ${levelNames[level]}`} subtitle="Chọn gói tập phù hợp hoặc mua số buổi lẻ bạn cần." />
      <View style={{ flexDirection: 'row', padding: 4, backgroundColor: aura.latte, borderRadius: 16, gap: 4 }}>
        {([['PACKAGE', 'Mua theo gói'], ['SINGLE', 'Mua buổi lẻ']] as const).map(([mode, label]) =>
          <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: tab === mode }} onPress={() => setTab(mode)}
            style={{ flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: tab === mode ? aura.white : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 12, textAlign: 'center' }}>{label}</Text>
          </Pressable>)}
      </View>
      {error && <><Empty title="Không tải được lựa chọn PT" message={error} icon="wifi-outline" /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
      {!error && !loading && tab === 'PACKAGE' && (products.length === 0
        ? <Empty title="Chưa có gói PT đang bán" message="Vui lòng quay lại sau hoặc chọn mua buổi lẻ." />
        : products.map(product => {
          const selectedCard = product.id === selectedId;
          const average = Math.round(Number(product.price) / product.sessionCount);
          const savings = offer && Number(offer.price) * product.sessionCount > Number(product.price)
            ? Number(offer.price) * product.sessionCount - Number(product.price) : 0;
          return <Pressable key={product.id} accessibilityRole="radio" accessibilityState={{ selected: selectedCard }} onPress={() => setSelectedId(product.id)}>
            <Card style={{ borderColor: selectedCard ? aura.caramel : aura.border, borderWidth: selectedCard ? 2 : 1, gap: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><View style={{ flex: 1 }}><Pill text={`PT ${levelNames[level]}`} /><Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900', marginTop: 7 }}>{product.name}</Text></View><Ionicons name={selectedCard ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selectedCard ? aura.caramel : aura.muted} /></View>
              <Text style={{ color: aura.caramel, fontSize: 21, fontWeight: '900' }}>{money(product.price)}</Text>
              <Text style={{ color: aura.darkCoffee, fontWeight: '700' }}>{product.sessionCount} buổi · {product.durationDays} ngày sử dụng</Text>
              <Text style={{ color: aura.muted, fontSize: 12 }}>Trung bình {money(average)} / buổi</Text>
              {!!savings && <Text style={{ color: aura.green, fontSize: 12, fontWeight: '800' }}>Tiết kiệm {money(savings)} so với mua lẻ</Text>}
              <Text style={{ color: aura.muted, fontSize: 12, lineHeight: 18 }}>{product.benefits || 'Đặt lịch PT, QR check-in, báo vắng bảo lưu tối đa 3 lần và đổi Coach theo điều kiện.'}</Text>
            </Card>
          </Pressable>;
        }))}
      {!error && !loading && tab === 'SINGLE' && (offer ? <Card style={singleStyles.card}>
        <View style={singleStyles.topRow}>
          <Pill text={`PT ${levelNames[level]} · buổi lẻ`} />
          <View style={singleStyles.flexibleTag}><Ionicons name="options-outline" size={13} color={aura.caramel} /><Text style={singleStyles.flexibleTagText}>Linh hoạt</Text></View>
        </View>
        <Text style={singleStyles.title}>Chọn số buổi bạn cần</Text>
        <View style={singleStyles.pricePanel}>
          <View style={{ flex: 1 }}>
            <Text style={singleStyles.eyebrow}>ĐƠN GIÁ</Text>
            <Text style={singleStyles.price}>{money(offer.price)}<Text style={singleStyles.priceUnit}> / buổi</Text></Text>
          </View>
          <View style={singleStyles.priceIcon}><Ionicons name="barbell-outline" size={22} color={aura.caramel} /></View>
        </View>
        <View style={singleStyles.infoRow}>
          <View style={singleStyles.infoIcon}><Ionicons name="calendar-clear-outline" size={17} color={aura.darkCoffee} /></View>
          <View style={{ flex: 1 }}><Text style={singleStyles.infoTitle}>Thời hạn sử dụng</Text><Text style={singleStyles.infoText}>{offer.durationDays} ngày kể từ khi thanh toán</Text></View>
        </View>
        <View style={singleStyles.infoRow}>
          <View style={singleStyles.infoIcon}><Ionicons name="checkmark-circle-outline" size={17} color={aura.darkCoffee} /></View>
          <View style={{ flex: 1 }}><Text style={singleStyles.infoTitle}>Quyền lợi</Text><Text style={singleStyles.infoText}>{offer.benefits || 'Đặt lịch PT, QR check-in và bảo lưu 1 lần khi báo vắng sớm.'}</Text></View>
        </View>
        <View style={singleStyles.divider} />
        <View style={singleStyles.quantityRow}>
          <View style={{ flex: 1 }}><Text style={singleStyles.infoTitle}>Số buổi</Text><Text style={singleStyles.infoText}>Tối đa {maxQuantity} buổi mỗi đơn</Text></View>
          <View style={singleStyles.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="Giảm một buổi" disabled={quantity <= 1} onPress={() => setQuantity(value => Math.max(1, value - 1))}
              style={[singleStyles.stepButton, quantity <= 1 && singleStyles.stepButtonDisabled]}>
              <Ionicons name="remove" size={20} color={quantity <= 1 ? aura.muted : aura.darkCoffee} />
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={singleStyles.quantity}>{quantity}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tăng một buổi" disabled={quantity >= maxQuantity} onPress={() => setQuantity(value => Math.min(maxQuantity, value + 1))}
              style={[singleStyles.stepButton, quantity >= maxQuantity && singleStyles.stepButtonDisabled]}>
              <Ionicons name="add" size={20} color={quantity >= maxQuantity ? aura.muted : aura.darkCoffee} />
            </Pressable>
          </View>
        </View>
      </Card> : <Empty title="Chưa bán buổi lẻ" message="Bạn có thể chọn một gói PT đang bán." />)}
      {!canBuy && !!user && !loading && <Card><Text style={{ color: aura.darkCoffee, fontWeight: '800' }}>Cần Membership Gym còn hiệu lực để thanh toán PT.</Text><Button secondary title="Xem Membership" onPress={() => router.push('/packages')} /></Card>}
    </Page>
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: aura.white, borderTopWidth: 1, borderColor: aura.border, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ flex: 1, color: aura.muted, fontSize: 12 }}>{available ? `${sessions} buổi · ${days} ngày` : 'Chọn sản phẩm PT'}</Text><Text style={{ color: aura.caramel, fontSize: 18, fontWeight: '900' }}>{available ? money(amount) : '—'}</Text></View>
      <Button title="Tiếp tục thanh toán" loading={busy} disabled={!available || loading || !!error || busy || (!!user && !canBuy)} onPress={checkout} />
    </SafeAreaView>
  </View>;
}

const singleStyles = StyleSheet.create({
  card: { padding: 16, gap: 13 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flexibleTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: aura.cream },
  flexibleTagText: { color: aura.caramel, fontSize: 10, fontWeight: '800' },
  title: { color: aura.ink, fontSize: 19, fontWeight: '900', marginTop: 1 },
  pricePanel: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 13, backgroundColor: aura.cream, gap: 10 },
  eyebrow: { color: aura.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  price: { color: aura.caramel, fontSize: 22, fontWeight: '900', marginTop: 4 },
  priceUnit: { color: aura.muted, fontSize: 12, fontWeight: '700' },
  priceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: aura.white, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { color: aura.ink, fontSize: 12, fontWeight: '800' },
  infoText: { color: aura.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  divider: { height: 1, backgroundColor: aura.border, marginVertical: 1 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, borderRadius: 15, backgroundColor: aura.cream },
  stepButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: aura.white },
  stepButtonDisabled: { backgroundColor: '#FFFFFF80' },
  quantity: { minWidth: 36, textAlign: 'center', color: aura.ink, fontSize: 20, fontWeight: '900' },
});
