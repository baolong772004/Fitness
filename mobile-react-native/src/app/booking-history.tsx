import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { aura, dateLabel, list, timeLabel } from '../lib/theme';
import { Button, Card, Empty, Page, Pill, showError } from '../components/ui';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: aura.green,
  COMPLETED: aura.green,
  UPCOMING: aura.caramel,
  PENDING: aura.caramel,
  CANCELLED: '#8C7567',
  ABSENT_ELIGIBLE: '#1565C0',
  ABSENT_NO_REFUND: '#B3261E',
  MAKEUP_BOOKED: '#6A1B9A',
  IN_PROGRESS: aura.green,
  REJECTED: '#B3261E',
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Hoàn thành',
  UPCOMING: 'Sắp tới',
  PENDING: 'Chờ xác nhận',
  CANCELLED: 'Đã hủy',
  ABSENT_ELIGIBLE: 'Được học bù',
  ABSENT_NO_REFUND: 'Vắng – mất buổi',
  MAKEUP_BOOKED: 'Đã đặt học bù',
  IN_PROGRESS: 'Đang diễn ra',
  REJECTED: 'Bị từ chối',
};

const TABS = ['Tất cả', 'PT', 'Lớp học', 'Đã hủy'];

export default function BookingHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('Tất cả');

  const load = useCallback(async (next = 1, currentTab = tab) => {
    setLoading(true);
    try {
      const typeMap: Record<string, string | undefined> = { 'PT': 'PT', 'Lớp học': 'GROUP' };
      const result = await api.bookingHistory(next, typeMap[currentTab]);
      let data = list(result.data ?? []);
      if (currentTab === 'Đã hủy') {
        data = data.filter((r: any) => ['CANCELLED', 'REJECTED'].includes(String(r.status ?? '').toUpperCase()));
      } else if (currentTab === 'Tất cả') {
        // keep all
      }
      setRows(prev => next === 1 ? data : [...prev, ...data]);
      setPage(next);
      setTotalPages(Number(result.pagination?.totalPages ?? 1));
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, [tab]);

  useFocusEffect(useCallback(() => { void load(1, tab); }, [load, tab]));

  const counts = {
    total: rows.length,
    completed: rows.filter(r => ['COMPLETED', 'CONFIRMED'].includes(String(r.status ?? '').toUpperCase())).length,
  };

  return (
    <Page loading={loading} refresh={() => void load(1, tab)}>
      <LinearGradient
        colors={[aura.espresso, aura.darkCoffee]}
        style={{ borderRadius: 20, padding: 18 }}
      >
        <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calendar-outline" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Lịch sử đặt lịch</Text>
            <Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 3 }}>
              {counts.total} lịch hẹn · {counts.completed} hoàn thành
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', gap: 7 }}>
        {TABS.map(t => (
          <Pressable
            key={t}
            onPress={() => { setTab(t); void load(1, t); }}
            style={{
              flex: 1, paddingVertical: 9, borderRadius: 13,
              backgroundColor: tab === t ? aura.darkCoffee : aura.white,
              borderWidth: 1, borderColor: tab === t ? aura.darkCoffee : aura.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: tab === t ? '#fff' : aura.ink, fontSize: 11, fontWeight: '800' }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 && !loading && (
        <Empty
          icon="calendar-outline"
          title="Chưa có lịch hẹn"
          message="Lịch sử buổi PT và lớp học sẽ xuất hiện tại đây."
        />
      )}

      {rows.map((row, idx) => {
        const status = String(row.status ?? '').toUpperCase();
        const statusColor = STATUS_COLORS[status] ?? aura.muted;
        const statusLabel = STATUS_LABELS[status] ?? status;
        const isGroup = row.bookingType === 'GROUP_CLASS';
        const name = isGroup
          ? (row.groupClass?.name ?? row.className ?? 'Lớp học nhóm')
          : (row.coach?.fullName ?? row.trainerName ?? 'PT Session');
        return (
          <Card key={String(row.id ?? idx)}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{
                width: 42, height: 42, borderRadius: 13,
                backgroundColor: isGroup ? '#E8F4FE' : aura.latte,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={isGroup ? 'people-outline' : 'fitness-outline'} size={21} color={aura.darkCoffee} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: aura.ink, fontSize: 14, fontWeight: '900' }}>{name}</Text>
                <Text style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>
                  {dateLabel(row.startTime ?? row.date)} · {timeLabel(row.startTime ?? row.date)}
                </Text>
                <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2 }}>
                  {isGroup ? 'Lớp học nhóm' : 'Huấn luyện cá nhân'}
                  {row.isMakeup ? ' · Buổi học bù' : ''}
                </Text>
              </View>
              <Pill text={statusLabel} color={statusColor} />
            </View>
            {row.room && (
              <Text style={{ color: aura.muted, fontSize: 11, marginTop: 8 }}>
                <Ionicons name="location-outline" size={11} color={aura.muted} /> {String(row.room?.name ?? row.room)}
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
