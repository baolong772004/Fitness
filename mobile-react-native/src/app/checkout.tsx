import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../lib/api';
import { aura, money } from '../lib/theme';
import { Button, Card, Empty, Page, showError } from '../components/ui';

export default function Checkout() {
  const { data, pkg, kind } = useLocalSearchParams<{ data?: string; pkg?: string; kind?: string }>();
  const checkout = useMemo(() => { try { return JSON.parse(data || '{}'); } catch { return {}; } }, [data]);
  const packageInfo = useMemo(() => { try { return JSON.parse(pkg || '{}'); } catch { return {}; } }, [pkg]);
  const [status, setStatus] = useState('PENDING'); const [checking, setChecking] = useState(false); const [statusError, setStatusError] = useState<string | null>(null);
  const [openingSchedule, setOpeningSchedule] = useState(false);
  const inFlight = useRef(false);
  const check = useCallback(async (silent = false) => {
    if (!checkout.orderCode || inFlight.current) return;
    inFlight.current = true;
    setChecking(true); setStatusError(null);
    try {
      const result = await api.paymentStatus(String(checkout.orderCode));
      setStatus(String(result.status || result.data?.status || 'PENDING').toUpperCase());
    } catch (error) { setStatusError(error instanceof Error ? error.message : 'Không kiểm tra được thanh toán.'); if (!silent) showError(error); }
    finally { inFlight.current = false; setChecking(false); }
  }, [checkout.orderCode]);
  useEffect(() => {
    if (['PAID', 'PAID_REVIEW', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(status)) return;
    void check(true);
    const timer = setInterval(() => void check(true), 5000);
    return () => clearInterval(timer);
  }, [check, status]);
  const finish = async () => {
    if (kind !== 'pt') return router.replace('/subscriptions');
    setOpeningSchedule(true);
    try {
      const subscriptions = await api.subscriptions();
      const purchased = subscriptions.find(row => Number(row.id) === Number(checkout.subscriptionId) && row.status === 'ACTIVE');
      if (purchased?.coachId) return router.replace({ pathname: '/pt-book', params: { subscription: JSON.stringify(purchased) } });
      router.replace('/pt');
    } catch (error) { showError(error); }
    finally { setOpeningSchedule(false); }
  };
  if (!checkout.orderCode) return <Page><Empty title="Không có đơn thanh toán" /><Button title="Quay lại" onPress={() => router.back()} /></Page>;
  const finished = ['PAID', 'PAID_REVIEW', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(status);
  const paid = status === 'PAID';
  const review = status === 'PAID_REVIEW';
  const statusColor = paid ? aura.green : review ? aura.caramel : finished ? '#B3261E' : aura.caramel;
  return <Page><LinearGradient colors={[aura.espresso, aura.darkCoffee]} style={{ borderRadius: 21, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}><Ionicons name="lock-closed" size={25} color={aura.latte} /><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{packageInfo.name || 'Gói tập Aura'}</Text><Text style={{ color: '#E8D8CF', fontSize: 11, marginTop: 4 }}>Đơn hàng #{checkout.orderCode}</Text></View><Text style={{ color: '#fff', fontWeight: '900' }}>{money(packageInfo.price)}</Text></LinearGradient>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: `${statusColor}44`, backgroundColor: `${statusColor}18` }}><Ionicons name={paid ? 'checkmark-circle' : review ? 'alert-circle' : finished ? 'close-circle' : 'time-outline'} size={20} color={statusColor} /><Text style={{ flex: 1, color: statusColor, fontSize: 12, fontWeight: '800' }}>{paid ? kind === 'renew' ? 'Thanh toán thành công. Thời hạn gói tập đã được gia hạn.' : 'Thanh toán thành công. Gói tập đã được xác nhận.' : review ? 'Đã nhận tiền nhưng đơn gia hạn không còn hợp lệ. Gói chưa được gia hạn; vui lòng liên hệ hỗ trợ để xử lý hoàn tiền.' : finished ? status === 'EXPIRED' ? 'Đơn thanh toán đã hết hạn. Hãy quay lại để tạo đơn mới.' : 'Đơn thanh toán đã bị hủy. Hãy quay lại để tạo đơn mới.' : statusError || 'Đang chờ PayOS xác nhận thanh toán…'}</Text></View>
    <Card style={{ alignItems: 'center', gap: 12, padding: 20 }}><Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 15 }}>Quét mã bằng ứng dụng ngân hàng</Text><Text style={{ color: aura.muted, textAlign: 'center', fontSize: 12 }}>Hoặc mở trang PayOS để chọn phương thức thanh toán.</Text>
      {checkout.qrCode && <View style={{ backgroundColor: aura.white, padding: 12, borderWidth: 1, borderColor: aura.border, borderRadius: 18 }}><QRCode value={String(checkout.qrCode)} size={230} /></View>}
      {!finished && checkout.checkoutUrl && <View style={{ width: '100%' }}><Button title="Mở trang PayOS" icon="open-outline" onPress={() => void Linking.openURL(String(checkout.checkoutUrl)).catch(showError)} /></View>}
      {!finished && <Button secondary loading={checking} title={checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái thanh toán'} disabled={checking} onPress={() => void check(false)} />}
    </Card>
    {paid && <Button loading={openingSchedule} disabled={openingSchedule} title={openingSchedule ? 'Đang tải lịch PT...' : kind === 'pt' ? 'Tiếp tục đặt lịch' : kind === 'renew' ? 'Hoàn tất gia hạn' : 'Hoàn tất'} onPress={() => void finish()} />}
  </Page>;
}
