import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { aura, dateLabel, list, money, timeLabel } from '../lib/theme';
import { Button, Card, Empty, Page, Pill, showError } from '../components/ui';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Thành công', color: '#2E7D32' },
  COMPLETED: { label: 'Thành công', color: '#2E7D32' },
  FAILED: { label: 'Thất bại', color: '#B3261E' },
  PENDING: { label: 'Đang xử lý', color: '#E67E22' },
  CANCELLED: { label: 'Đã hủy', color: '#8C7567' },
  REFUNDED: { label: 'Hoàn tiền', color: '#1565C0' },
};

const TYPE_MAP: Record<string, string> = {
  MEMBERSHIP: 'Gói hội viên',
  PT: 'Gói PT',
  RENEWAL: 'Gia hạn gói',
  PACKAGE: 'Gói tập',
};

const FILTERS = ['Tất cả', 'Thành công', 'Đang xử lý', 'Thất bại', 'Hoàn tiền'];
const FILTER_STATUS: Record<string, string | undefined> = {
  'Tất cả': undefined,
  'Thành công': 'SUCCESS',
  'Đang xử lý': 'PENDING',
  'Thất bại': 'FAILED',
  'Hoàn tiền': 'REFUNDED',
};

export default function PaymentHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('Tất cả');

  const load = useCallback(async (next = 1, currentFilter = filter) => {
    setLoading(true);
    try {
      const result = await api.paymentHistory(next);
      const data = list(result.data ?? result.transactions ?? []);
      const filtered = FILTER_STATUS[currentFilter]
        ? data.filter((r: any) => {
            const s = String(r.status ?? '').toUpperCase();
            const target = FILTER_STATUS[currentFilter]!;
            if (target === 'SUCCESS') return s === 'SUCCESS' || s === 'COMPLETED';
            return s === target;
          })
        : data;
      setRows(prev => next === 1 ? filtered : [...prev, ...filtered]);
      setPage(next);
      setTotalPages(Number(result.pagination?.totalPages ?? result.totalPages ?? 1));
      setTotal(Number(result.pagination?.total ?? result.total ?? data.length));
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, [filter]);

  useFocusEffect(useCallback(() => { void load(1, filter); }, [load, filter]));

  const totalSuccess = rows.filter(r => ['SUCCESS', 'COMPLETED'].includes(String(r.status ?? '').toUpperCase()));
  const totalAmount = totalSuccess.reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);

  return (
    <Page loading={loading} refresh={() => void load(1, filter)}>
      <LinearGradient
        colors={[aura.espresso, aura.darkCoffee]}
        style={{ borderRadius: 20, padding: 18 }}
      >
        <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="receipt-outline" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Lịch sử thanh toán</Text>
            <Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 3 }}>{total} giao dịch · Đã chi {money(totalAmount)}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            onPress={() => { setFilter(f); void load(1, f); }}
            style={{
              paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
              backgroundColor: filter === f ? aura.darkCoffee : aura.white,
              borderWidth: 1, borderColor: filter === f ? aura.darkCoffee : aura.border,
            }}
          >
            <Text style={{ color: filter === f ? '#fff' : aura.ink, fontSize: 12, fontWeight: '700' }}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 && !loading && (
        <Empty
          icon="receipt-outline"
          title="Chưa có giao dịch"
          message="Lịch sử thanh toán sẽ xuất hiện tại đây sau khi bạn mua gói tập."
        />
      )}

      {rows.map((row, idx) => {
        const status = String(row.status ?? '').toUpperCase();
        const statusInfo = STATUS_MAP[status] ?? { label: status, color: aura.muted };
        const type = TYPE_MAP[String(row.packageType ?? row.type ?? '')] ?? 'Giao dịch';
        return (
          <Card key={String(row.id ?? idx)} style={{ gap: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="card-outline" size={22} color={aura.darkCoffee} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: aura.ink, fontSize: 14, fontWeight: '900' }}>
                  {String(row.packageName ?? row.description ?? type)}
                </Text>
                <Text style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>
                  {dateLabel(row.createdAt ?? row.paidAt)} · {timeLabel(row.createdAt ?? row.paidAt)}
                </Text>
                {row.paymentMethod && (
                  <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2 }}>
                    {String(row.paymentMethod).replace(/_/g, ' ')}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 15 }}>
                  {money(row.amount ?? row.totalAmount ?? 0)}
                </Text>
                <Pill text={statusInfo.label} color={statusInfo.color} />
              </View>
            </View>
            {row.orderCode && (
              <Text style={{ color: aura.muted, fontSize: 10, marginTop: 8 }}>
                Mã đơn: {String(row.orderCode)}
              </Text>
            )}
          </Card>
        );
      })}

      {page < totalPages && (
        <Button secondary disabled={loading} title={loading ? 'Đang tải...' : 'Xem thêm'} onPress={() => void load(page + 1)} />
      )}
    </Page>
  );
}
