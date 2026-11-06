import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { aura } from '../lib/theme';
import { Button, Card, Empty, Field, Page, Section, showError } from '../components/ui';

type CoachOption = Awaited<ReturnType<typeof api.ptMakeupCoachOptions>>[number];

export default function PtMakeupCoachChange() {
  const { rightId, currentCoachName } = useLocalSearchParams<{
    rightId?: string; currentCoachName?: string;
  }>();
  const requestId = Number(rightId);
  const [options, setOptions] = useState<CoachOption[]>([]);
  const [resolvedCurrentCoachName, setResolvedCurrentCoachName] = useState(currentCoachName || 'HLV của lịch gốc');
  const [coachId, setCoachId] = useState<number | null>(null);
  const [reason, setReason] = useState('HLV hiện tại không có lịch học bù phù hợp');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(requestId) || requestId <= 0) return;
    setLoading(true); setError(null);
    try {
      const [coaches, bookings] = await Promise.all([
        api.ptMakeupCoachOptions(requestId), api.ptBookings().catch(() => []),
      ]);
      setOptions(coaches);
      const original = bookings.find(booking => booking.makeUpRequests?.some(
        (right: { id: number }) => right.id === requestId));
      const right = original?.makeUpRequests?.find((item: { id: number }) => item.id === requestId);
      if (right?.assignedCoachName) setResolvedCurrentCoachName(right.assignedCoachName);
      else if (right?.assignedCoachId) setResolvedCurrentCoachName(`HLV #${right.assignedCoachId}`);
      else if (original?.coach?.fullName) setResolvedCurrentCoachName(original.coach.fullName);
    }
    catch (cause) {
      setOptions([]);
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách HLV.');
    } finally { setLoading(false); }
  }, [requestId]);
  useEffect(() => { void load(); }, [load]);
  const choice = options.find(item => item.coachId === coachId);
  const submit = () => {
    if (!choice || !reason.trim() || busy) return;
    Alert.alert('Gửi đề nghị đổi HLV',
      `Bạn đề nghị đổi sang ${choice.coachName}? Admin sẽ duyệt HLV; bạn chọn lịch học bù sau khi được duyệt.`,
      [{ text: 'Để sau' }, { text: 'Gửi đề nghị', onPress: () => void (async () => {
        setBusy(true);
        try {
          await api.requestPtMakeupCoachChange(requestId, choice.coachId, reason.trim());
          Alert.alert('Đã gửi', 'Admin sẽ duyệt HLV bạn chọn. Quyền học bù và Credit đang giữ được bảo vệ trong khi chờ.');
          if (router.canGoBack()) router.back(); else router.replace('/pt');
        } catch (cause) { showError(cause); await load(); }
        finally { setBusy(false); }
      })() }]);
  };
  if (!Number.isSafeInteger(requestId) || requestId <= 0)
    return <Page><Empty title="Quyền học bù không hợp lệ" /></Page>;
  return <Page loading={loading} refresh={() => void load()}>
    <Section title={`Đề nghị đổi HLV học bù #${requestId}`} icon="people-outline" />
    <Card>
      <Text style={{ color: aura.muted }}>HLV hiện tại</Text>
      <Text style={{ color: aura.ink, fontWeight: '800', marginTop: 5 }}>
        {resolvedCurrentCoachName}
      </Text>
    </Card>
    <Text style={{ color: aura.muted, marginVertical: 8 }}>
      Chọn HLV mong muốn. Bạn sẽ chọn ngày và ca sau khi Admin duyệt.
    </Text>
    {error && <><Empty title="Chưa tải được HLV" message={error} icon="wifi-outline" />
      <Button secondary title="Thử lại" onPress={() => void load()} /></>}
    {!error && !loading && options.length === 0 &&
      <Empty title="Chưa có HLV thay thế đủ chuyên môn" message="Admin sẽ tiếp tục hỗ trợ quyền học bù của bạn." />}
    {options.map(coach => <Card key={coach.coachId}>
      <Button secondary={coachId !== coach.coachId}
        title={`${coach.coachName} · PT ${coach.level}`}
        onPress={() => setCoachId(coach.coachId)} />
      <Text style={{ color: aura.muted, marginTop: 5, fontSize: 12 }}>Đủ chuyên môn · Đang hoạt động</Text>
    </Card>)}
    <View style={{ marginTop: 8 }}>
      <Field label="Lý do đổi HLV" value={reason} onChangeText={setReason} multiline />
      <Button title="Gửi Admin duyệt" disabled={busy || !choice || !reason.trim()}
        loading={busy} onPress={submit} />
    </View>
  </Page>;
}
