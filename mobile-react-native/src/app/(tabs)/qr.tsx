import React, { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { aura } from '../../lib/theme';
import { Button, Page } from '../../components/ui';
import PtJourney from '../pt';
import { AuraLoader } from '../../components/AuraLoader';

export default function MemberQr() {
  const { user } = useAuth();
  const [section, setSection] = useState(1);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try { const result = await api.gymQr(); setQr(result.data?.qrCodeImage || null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải mã QR.'); }
    finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => {
    if (!user || section !== 1) return;
    void load();
    const timer = setInterval(() => void load(), 45000);
    return () => clearInterval(timer);
  }, [user, section, load]));
  return <Page style={{ backgroundColor: aura.darkCoffee }} refresh={user && section === 1 ? () => void load() : undefined} loading={loading}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}><Pressable onPress={() => router.push('/(tabs)')} style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="chevron-back" size={25} color="#fff" /><Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Quay lại</Text></Pressable><Ionicons name="bulb-outline" size={23} color="#fff" /></View>
    <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF26', borderRadius: 13, padding: 4, marginBottom: 4 }}>
      {['Lịch tập', 'Check in', 'PT'].map((title, index) => <Pressable key={title} onPress={() => setSection(index)} style={{ flex: 1, paddingVertical: 9, backgroundColor: section === index ? aura.darkCoffee : 'transparent', borderRadius: 10 }}><Text style={{ textAlign: 'center', color: section === index ? '#fff' : '#FFFFFFB8', fontSize: 13, fontWeight: '800' }}>{title}</Text></Pressable>)}
    </View>
    {section === 0 && <View style={{ padding: 8, gap: 16 }}><Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>Gói tập, lịch PT và Workout Class nằm trong mục Đặt lịch.</Text><Button title="Mở Đặt lịch" icon="calendar-outline" onPress={() => router.push('/(tabs)/booking')} /></View>}
    {section === 2 && <PtJourney embedded />}
    {section === 1 && <View style={{ borderRadius: 24, backgroundColor: '#fff', marginHorizontal: 4, overflow: 'hidden', marginTop: 8, marginBottom: 14 }}>
      <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEEAE6', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={28} color={aura.muted} /></View><View style={{ flex: 1 }}><Text style={{ color: aura.darkCoffee, fontSize: 18, fontWeight: '900' }}>{user?.fullName || 'Hội viên Aura'}</Text><Text style={{ color: aura.ink, fontSize: 12 }}>Thẻ hội viên Aura Fitness</Text></View></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 10, height: 20, borderTopRightRadius: 10, borderBottomRightRadius: 10, backgroundColor: aura.darkCoffee }} /><View style={{ flex: 1, borderTopWidth: 2, borderColor: '#DDD', borderStyle: 'dashed' }} /><View style={{ width: 10, height: 20, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, backgroundColor: aura.darkCoffee }} /></View>
      <View style={{ alignItems: 'center', padding: 20, minHeight: 332 }}>
        <View style={{ width: 192, height: 192, alignItems: 'center', justifyContent: 'center' }}>
          {qr ? <Image source={{ uri: qr }} style={{ width: 185, height: 185 }} resizeMode="contain" /> : loading ? <AuraLoader size={64} /> : <View style={{ alignItems: 'center', gap: 7 }}><Ionicons name="qr-code-outline" size={59} color={aura.muted} /><Text style={{ color: aura.muted, textAlign: 'center', fontSize: 12 }}>{error || 'Chưa có mã QR'}</Text><Text onPress={() => user ? void load() : router.push('/auth')} style={{ color: aura.caramel, fontWeight: '800' }}>{user ? 'Thử lại' : 'Đăng nhập'}</Text></View>}
        </View>
        <Text style={{ color: aura.ink, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 17 }}>{qr ? 'Mã có hiệu lực 1 phút · Tự cập nhật' : 'Mở mã QR để nhân viên quét điểm danh'}</Text>
        {qr && <Text onPress={() => void load()} style={{ color: aura.caramel, fontSize: 12, fontWeight: '800', marginTop: 7 }}>{loading ? 'Đang làm mới mã...' : '↻  Làm mới mã'}</Text>}
        {error && qr && <Text style={{ color: '#B3261E', fontSize: 11, textAlign: 'center', marginTop: 5 }}>{error}</Text>}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 21 }}>{Array.from({ length: 8 }, (_, i) => <View key={i} style={{ width: i === 3 ? 20 : 12, height: 3, borderRadius: 2, backgroundColor: i === 3 ? aura.ink : '#DDD' }} />)}</View>
        <Text style={{ color: aura.darkCoffee, fontWeight: '900', letterSpacing: 3, fontSize: 14, marginTop: 20 }}>A U R A  F I T N E S S</Text>
      </View>
    </View>}
    {section === 1 && <Button secondary title="Lịch sử điểm danh" icon="time-outline" onPress={() => router.push(user ? '/history' : '/auth')} />}
  </Page>;
}
