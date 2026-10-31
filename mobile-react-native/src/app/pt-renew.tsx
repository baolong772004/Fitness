import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { aura, money } from '../lib/theme';
import { hasActiveGymMembership } from '../lib/membership';
import { Button, Card, Empty, Hero, Page, showError } from '../components/ui';

const levelNames: Record<string, string> = {
  BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao',
};

export default function PtRenew() {
  const { batchId } = useLocalSearchParams<{ batchId?: string }>();
  const id = Number(batchId);
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof api.ptWallet>> | null>(null);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof api.ptRenewalOptions>>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRenew, setCanRenew] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [balance, prices, subscriptions] = await Promise.all([api.ptWallet(), api.ptRenewalOptions(), api.subscriptions()]);
      setWallet(balance); setOptions(prices); setCanRenew(hasActiveGymMembership(subscriptions));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được gói gia hạn.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const source = wallet?.sources.find(item => item.id === id);
  const matching = options.filter(option => option.level === source?.level &&
    (!option.purchaseMode || (option.purchaseMode === 'SINGLE' ? source?.source === 'SINGLE_PURCHASE' : source?.source === 'PACKAGE_PURCHASE')) &&
    (option.ptProductId === null || option.ptProductId === source?.ptProductId));
  const checkout = (option: (typeof options)[number]) => {
    if (!source) return;
    if (!canRenew) return Alert.alert('Cần Membership Gym', 'Bạn cần có Membership Gym đã thanh toán và còn hiệu lực để gia hạn PT.');
    Alert.alert('Xác nhận gia hạn PT', `${levelNames[source.level] ?? source.level} · Nguồn #${source.id}\nThêm ${option.durationDays} ngày · ${money(option.price)}\nKhông cộng thêm buổi PT.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Thanh toán', onPress: () => void (async () => {
        setBusy(true);
        try {
          const payment = await api.renewPtDuration(source.id, option.id);
          router.push({ pathname: '/checkout', params: { data: JSON.stringify(payment.data || payment),
            pkg: JSON.stringify({ name: `Gia hạn ${levelNames[source.level] ?? source.level} #${source.id}`, price: option.price,
              durationDays: option.durationDays }), kind: 'pt-renew' } });
        } catch (cause) { showError(cause); await load(); }
        finally { setBusy(false); }
      })() },
    ]);
  };

  return <Page loading={loading} refresh={() => void load()}>
    <Hero eyebrow="PT WALLET" title="Gia hạn thời gian PT" subtitle="Chọn đúng nguồn buổi tập và số ngày gia hạn. Số buổi không thay đổi." />
    {!loading && !error && !canRenew && <Card><Text style={{ color: aura.darkCoffee, fontWeight: '800', marginBottom: 8 }}>Cần Membership Gym còn hiệu lực để gia hạn PT.</Text><Button secondary title="Xem gói Membership" onPress={() => router.push('/packages')} /></Card>}
    {error && <Empty title="Chưa tải được gia hạn" message={error} />}
    {!loading && !error && !source && <Empty title="Không tìm thấy nguồn PT" />}
    {source && <Card>
      <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 16 }}>{levelNames[source.level] ?? source.level} · Nguồn #{source.id}</Text>
      <Text style={{ color: aura.muted, marginTop: 7 }}>Còn {source.remainingSessions} buổi · {source.status === 'EXPIRED' ? 'Đã hết hạn' : 'Đang có hiệu lực'}</Text>
      <Text style={{ color: aura.muted, marginTop: 5 }}>Hết hạn hiện tại: {source.endAt ? new Date(source.endAt).toLocaleString('vi-VN') : 'Không xác định'}</Text>
      {source.renewalDeadline && <Text style={{ color: aura.muted, marginTop: 5 }}>Hạn cuối được gia hạn: {new Date(source.renewalDeadline).toLocaleString('vi-VN')}</Text>}
      {!source.renewable && <Text style={{ color: aura.caramel, marginTop: 9 }}>Nguồn này không đủ điều kiện gia hạn. Bạn có thể mua gói PT mới.</Text>}
    </Card>}
    {source?.renewable && matching.length === 0 && <Empty title="Chưa có giá gia hạn" message="Admin chưa cấu hình giá gia hạn cho gói PT này." />}
    {source?.renewable && matching.map(option => <Card key={option.id}>
      <Text style={{ color: aura.ink, fontWeight: '900' }}>{option.name}</Text>
      <Text style={{ color: aura.muted, marginVertical: 7 }}>Thêm {option.durationDays} ngày · Không cộng buổi tập</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: aura.caramel, fontWeight: '900' }}>{money(option.price)}</Text>
        <Button compact title={canRenew ? 'Gia hạn' : 'Cần Membership'} loading={busy} disabled={busy || !canRenew} onPress={() => checkout(option)} />
      </View>
    </Card>)}
  </Page>;
}
