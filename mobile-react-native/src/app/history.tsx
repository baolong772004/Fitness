import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { aura, dateLabel, list, timeLabel } from '../lib/theme';
import { Button, Card, Empty, Page } from '../components/ui';

export default function History() {
  const [rows, setRows] = useState<any[]>([]); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (next = 1) => {
    setLoading(true); setError(null);
    try {
      const result = await api.checkInHistory(next);
      setRows(previous => next === 1 ? list(result.data) : [...previous, ...list(result.data)]);
      setPage(next); setTotalPages(Number(result.pagination?.totalPages || 1)); setTotal(Number(result.pagination?.total || 0));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử điểm danh.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <Page loading={loading} refresh={() => void load()}>
    <LinearGradient colors={[aura.espresso, aura.darkCoffee]} style={{ borderRadius: 20, padding: 17, flexDirection: 'row', gap: 13, alignItems: 'center' }}><View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkbox-outline" size={24} color="#fff" /></View><View><Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Hành trình luyện tập</Text><Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 3 }}>{total} lượt điểm danh được ghi nhận</Text></View></LinearGradient>
    {error && rows.length === 0 && <><Empty icon="wifi-outline" title="Chưa tải được lịch sử" message={error} /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && rows.length === 0 && !loading && <Empty icon="qr-code-outline" title="Chưa có lượt điểm danh" message="Các lượt check-in của bạn sẽ xuất hiện tại đây." />}
    {rows.map(row => { const success = String(row.status).toUpperCase() === 'SUCCESS'; const accent = success ? '#2E8B57' : '#B3261E'; const method = String(row.method || ''); return <Card key={String(row.id)} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 43, height: 43, borderRadius: 13, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="qr-code-outline" size={24} color={aura.darkCoffee} /></View>
      <View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontSize: 14, fontWeight: '900' }}>{method.toUpperCase() === 'QR_CODE' ? 'Quét mã QR' : method || 'Điểm danh'}</Text><Text style={{ color: aura.muted, fontSize: 12, marginTop: 4 }}>{dateLabel(row.checkInTime)} · {timeLabel(row.checkInTime)}</Text>{row.membership?.package?.name && <Text numberOfLines={1} style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>{row.membership.package.name}</Text>}{!success && row.rejectReason && <Text style={{ color: accent, fontSize: 11, marginTop: 3 }}>{row.rejectReason}</Text>}</View>
      <Text style={{ color: accent, backgroundColor: success ? '#E8F5EC' : '#FDEBE9', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start', fontSize: 10, fontWeight: '900' }}>{success ? 'Thành công' : 'Không thành công'}</Text>
    </Card>; })}
    {error && rows.length > 0 && <Button secondary title="Tải thêm chưa thành công · Thử lại" onPress={() => void load(page + 1)} />}
    {!error && page < totalPages && <Button secondary disabled={loading} title={loading ? 'Đang tải...' : 'Xem thêm'} onPress={() => void load(page + 1)} />}
  </Page>;
}
