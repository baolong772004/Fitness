import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../lib/api';
import { aura } from '../lib/theme';
import { Button, Card, Page } from '../components/ui';
import { AuraLoader } from '../components/AuraLoader';

export default function PtSessionQr() {
  const { booking: raw } = useLocalSearchParams<{ booking?: string }>();
  const booking = useMemo(() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } }, [raw]);
  const [token, setToken] = useState<string | null>(null); const [created, setCreated] = useState(0);
  const [now, setNow] = useState(Date.now()); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const generate = useCallback(async () => {
    if (!booking.id) return;
    setBusy(true); setError(null); setToken(null);
    try { const result = await api.ptQr(Number(booking.id)); const value = result.data?.token; if (!value) throw new Error('Chưa tạo được mã QR buổi PT.'); setToken(String(value)); setCreated(Date.now()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo mã QR.'); }
    finally { setBusy(false); }
  }, [booking.id]);
  useFocusEffect(useCallback(() => { void generate(); }, [generate]));
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const secondsLeft = token ? Math.max(0, Math.min(90, 90 - Math.floor((now - created) / 1000))) : 0;
  return <Page><Card style={{ alignItems: 'center', padding: 22 }}>
    <Ionicons name="fitness-outline" size={35} color={aura.caramel} />
    <Text style={{ color: aura.ink, fontSize: 19, fontWeight: '900', marginTop: 8 }}>{booking.member?.fullName || 'Hội viên'}</Text>
    <Text style={{ color: aura.muted, textAlign: 'center', marginTop: 8 }}>Cho hội viên quét mã này để bắt đầu buổi tập.</Text>
    <View style={{ width: 250, height: 250, alignItems: 'center', justifyContent: 'center', marginTop: 18 }}>
      {busy ? <AuraLoader size={64} /> : error ? <Text style={{ color: aura.caramel, textAlign: 'center' }}>{error}</Text> : token && secondsLeft > 0 ? <QRCode value={token} size={240} /> : <Text style={{ color: aura.muted, textAlign: 'center' }}>Mã QR đã hết hạn. Tạo mã mới để hội viên quét.</Text>}
    </View>
    {token && secondsLeft > 0 && <Text style={{ color: aura.darkCoffee, fontWeight: '900', marginTop: 12 }}>Còn {secondsLeft} giây</Text>}
    <View style={{ width: '100%', marginTop: 17 }}><Button disabled={busy} icon="refresh-outline" title="Tạo mã QR mới" onPress={() => void generate()} /></View>
  </Card></Page>;
}
