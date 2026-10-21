import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { aura } from '../lib/theme';
import { Button } from './ui';

type Wallet = Awaited<ReturnType<typeof api.ptWallet>>;
type RenewalOptions = Awaited<ReturnType<typeof api.ptRenewalOptions>>;
const names: Record<string, string> = { TRIAL: 'Trải nghiệm', BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao' };

export function PtWalletCard({ wallet, renewalOptions }: { wallet: Wallet; renewalOptions: RenewalOptions }) {
  const [expanded, setExpanded] = useState(false);
  const owned = wallet.levels.filter(level => level.total > 0 || level.available > 0 || level.held > 0);
  const levels = expanded || owned.length === 0 ? wallet.levels : owned;
  const canExpand = owned.length > 0 && owned.length < wallet.levels.length;
  const sources = wallet.sources ?? [];

  return <View style={styles.card}>
    <View style={styles.summary}>
      <View style={styles.headingRow}>
        <View style={styles.headingRow}><Ionicons name="wallet-outline" size={18} color={aura.latte} /><Text style={styles.summaryLabel}>BUỔI TẬP CỦA BẠN</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Xem lịch sử số buổi PT" onPress={() => router.push('/pt-credit-history')} style={styles.history}>
          <Ionicons name="time-outline" size={20} color={aura.white} />
        </Pressable>
      </View>
      <View style={styles.balanceRow}><Text style={styles.balance}>{wallet.available}</Text><View><Text style={styles.balanceUnit}>buổi có thể đặt</Text><Text style={styles.total}>Tổng đã cấp: {wallet.total} buổi</Text></View></View>
      <View style={styles.stats}>
        <Text style={styles.stat}><Text style={styles.statValue}>{wallet.held}</Text> đang giữ chỗ</Text>
        <View style={styles.separator} />
        <Text style={styles.stat}><Text style={styles.statValue}>{wallet.used}</Text> đã sử dụng</Text>
      </View>
    </View>
    <View style={styles.body}>
      <Text style={styles.sectionTitle}>Chọn cấp độ để đặt lịch</Text>
      {levels.map(level => <View key={level.level} style={styles.levelRow}>
        <View style={[styles.levelIcon, level.available <= 0 && styles.inactiveIcon]}><Ionicons name={level.level === 'TRIAL' ? 'sparkles-outline' : 'barbell-outline'} size={19} color={level.available > 0 ? aura.caramel : aura.muted} /></View>
        <View style={styles.levelCopy}>
          <Text style={styles.levelTitle}>{names[level.level] || level.level}</Text>
          <Text style={styles.levelMeta}>{level.available > 0 ? `Còn ${level.available} buổi` : 'Chưa có buổi khả dụng'}{level.held > 0 ? ` · Đã đặt ${level.held}` : ''}</Text>
          {level.retained > level.available && <Text style={styles.locked}>Bảo lưu/khóa: {level.retained - level.available}</Text>}
        </View>
        {level.available > 0 && <Button compact title="Đặt lịch" onPress={() => router.push({ pathname: '/pt-book', params: { subscription: JSON.stringify({ level: level.level, availableSessions: level.available, isTrial: level.level === 'TRIAL' }) } })} />}
      </View>)}
      {canExpand && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.expand}>
        <Text style={styles.expandText}>{expanded ? 'Thu gọn cấp độ' : 'Xem tất cả cấp độ'}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={aura.muted} />
      </Pressable>}
      {sources.length > 0 && <Text style={styles.sectionTitle}>Thời hạn từng lần mua</Text>}
      {sources.filter(source => source.remainingSessions > 0).map(source => {
        const daysLeft = source.endAt ? Math.ceil((new Date(source.endAt).getTime() - Date.now()) / 86400000) : null;
        const hasRenewalPrice = renewalOptions.some(option => option.level === source.level &&
          (option.ptProductId === null || option.ptProductId === source.ptProductId));
        return <View key={source.id} style={styles.sourceRow}>
          <Text style={styles.levelTitle}>{names[source.level] || source.level} · {source.remainingSessions} buổi còn lại</Text>
          <Text style={styles.levelMeta}>Có thể đặt {source.availableSessions} · {source.endAt ? `Hết hạn ${new Date(source.endAt).toLocaleDateString('vi-VN')}` : 'Quyền cũ không giới hạn thời hạn'}</Text>
          {source.status === 'EXPIRED' && <Text style={styles.locked}>Đã hết hạn; số buổi còn lại không thể đặt.</Text>}
          {daysLeft !== null && daysLeft > 0 && daysLeft <= 7 && source.availableSessions > 0 && <Text style={styles.locked}>Sắp hết hạn trong {daysLeft} ngày.</Text>}
          {source.renewable && hasRenewalPrice && <Button compact secondary title="Gia hạn thời gian" onPress={() => router.push({ pathname: '/pt-renew', params: { batchId: String(source.id) } })} />}
          {source.renewable && !hasRenewalPrice && <Text style={styles.locked}>Chưa có giá gia hạn cho gói PT này.</Text>}
          {source.status === 'EXPIRED' && !source.renewable && source.renewalDeadline && <Text style={styles.locked}>Đã quá 30 ngày; cần mua gói mới.</Text>}
        </View>;
      })}
      <Button secondary title="Mua thêm buổi PT" icon="add-outline" onPress={() => router.push('/packages')} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', backgroundColor: aura.white, borderWidth: 1, borderColor: aura.border },
  summary: { backgroundColor: aura.darkCoffee, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 17 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryLabel: { color: aura.latte, fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  history: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  balance: { fontSize: 46, lineHeight: 54, fontWeight: '800', color: aura.white },
  balanceUnit: { fontSize: 15, fontWeight: '700', color: aura.white },
  total: { fontSize: 11, color: aura.latte, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  stat: { color: aura.latte, fontSize: 12 },
  statValue: { color: aura.white, fontWeight: '800' },
  separator: { height: 13, width: 1, backgroundColor: '#FFFFFF40' },
  body: { padding: 15, gap: 4 },
  sectionTitle: { color: aura.muted, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: aura.border },
  levelIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' },
  inactiveIcon: { backgroundColor: aura.cream },
  levelCopy: { flex: 1, minWidth: 0 },
  levelTitle: { color: aura.ink, fontSize: 14, fontWeight: '800' },
  levelMeta: { color: aura.muted, fontSize: 11, marginTop: 4 },
  locked: { color: aura.caramel, fontSize: 10, marginTop: 3 },
  sourceRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: aura.border },
  expand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44 },
  expandText: { fontSize: 12, color: aura.muted, fontWeight: '600' },
});
