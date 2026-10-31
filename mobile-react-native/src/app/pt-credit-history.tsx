import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { api } from '../lib/api';
import { aura, dateLabel } from '../lib/theme';
import { Card, Empty, Hero, Page } from '../components/ui';

const names: Record<string, string> = {
  GRANT: 'Cấp buổi', HOLD: 'Giữ chỗ', TRANSFER_HOLD: 'Chuyển sang học bù',
  CONSUME: 'Đã sử dụng', RELEASE: 'Hoàn giữ chỗ', REFUND: 'Hoàn buổi',
  ADMIN_CREDIT: 'Admin cộng', ADMIN_DEBIT: 'Admin trừ', LEGACY_CONSUMED: 'Lịch sử cũ',
  MEMBER_MAKEUP: 'Quyền học bù đã dùng',
  PROTECTED_CANCEL: 'Đã dùng lượt hủy được bảo lưu',
};

export default function PtCreditHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const [credits, extensions] = await Promise.all([api.ptCreditHistory(), api.ptRenewalHistory()]);
      setRows(credits); setRenewals(extensions); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử credit.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <Page loading={loading} refresh={() => void load()}><Hero eyebrow="PT CREDIT" title="Lịch sử số buổi" subtitle="Mỗi lần cấp, giữ chỗ, sử dụng và hoàn buổi đều được ghi lại." />
    {error && <Empty title="Chưa tải được lịch sử" message={error} />}
    {!error && !loading && rows.length === 0 && renewals.length === 0 && <Empty title="Chưa có giao dịch PT" />}
    {renewals.map(row => <Card key={`renew-${row.id}`}><Text style={{ color: aura.ink, fontWeight: '900' }}>Gia hạn {row.batch.level} · Nguồn #{row.batchId}</Text><Text style={{ color: aura.muted, marginTop: 5 }}>+{row.durationDays} ngày · {Number(row.payment.amount).toLocaleString('vi-VN')} đ · {dateLabel(row.createdAt)}</Text><Text style={{ color: aura.muted, marginTop: 5 }}>Hạn cũ: {dateLabel(row.previousEndAt)} · Hạn mới: {dateLabel(row.endAt)}</Text></Card>)}
    {rows.filter(row => row.kind !== 'RENEW_DURATION').map(row => <Card key={String(row.id)}><Text style={{ color: aura.ink, fontWeight: '900' }}>{names[row.kind] || row.kind} · {row.kind === 'PROTECTED_CANCEL' ? '1 lượt' : `${row.quantity} buổi`} {row.batch?.level}</Text><Text style={{ color: aura.muted, marginTop: 5 }}>{row.batch?.source} · {dateLabel(row.createdAt)}{row.bookingId ? ` · Lịch #${row.bookingId}` : ''}</Text><Text style={{ color: aura.muted, marginTop: 5 }}>Hết hạn: {(row.batch?.level === 'TRIAL' ? row.batch?.membership?.endDate : row.batch?.endAt) ? dateLabel(row.batch?.level === 'TRIAL' ? row.batch.membership.endDate : row.batch.endAt) : 'Không giới hạn (quyền cũ)'}</Text>{row.note && <Text style={{ color: aura.muted, marginTop: 5 }}>{row.note}</Text>}</Card>)}
  </Page>;
}
