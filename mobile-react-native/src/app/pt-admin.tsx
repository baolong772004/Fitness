import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, vietnamDateLabel as dateLabel, vietnamTimeLabel as timeLabel } from '../lib/theme';
import { Button, Card, Empty, Field, Page, Section, showError } from '../components/ui';

type Operations = Awaited<ReturnType<typeof api.adminPtOperations>>;

export default function PtAdminOperations() {
  const { user } = useAuth();
  const [operations, setOperations] = useState<Operations>({ attendance: [], makeup: [], legacy: [], legacyCount: 0 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [coaches, setCoaches] = useState<Record<number, any[]>>({});
  const [selectedCoaches, setSelectedCoaches] = useState<Record<number, number>>({});
  const [exceptionsOpen, setExceptionsOpen] = useState<Record<number, boolean>>({});
  const allowed = ['ADMIN', 'STAFF'].includes(user?.role || '');
  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try { setOperations(await api.adminPtOperations()); } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, [allowed]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const decide = (bookingId: number, decision: 'ATTENDED' | 'NO_SHOW' | 'EXCUSED') => {
    const note = notes[bookingId]?.trim();
    if (!note) { Alert.alert('Cần lý do', 'Nhập kết quả đối soát và bằng chứng trước khi quyết định.'); return; }
    Alert.alert('Xác nhận đối soát', `Áp dụng ${decision} cho buổi #${bookingId}?`, [
      { text: 'Hủy' }, { text: 'Xác nhận', onPress: async () => {
        setBusy(true);
        try { await api.adminPtAttendance(bookingId, decision, note); await load(); }
        catch (error) { showError(error); } finally { setBusy(false); }
      } },
    ]);
  };
  const showCoaches = async (right: any) => {
    const level = right.originalBooking?.ptCreditAllocation?.batch?.level;
    if (!level) { Alert.alert('Cần đối soát', 'Chưa xác định được cấp PT của quyền học bù này.'); return; }
    try { const candidates = await api.ptTrainers(level);
      const currentCoachId = right.assignedCoachId ?? right.originalBooking?.coachId;
      setCoaches(previous => ({ ...previous, [right.id]: candidates.filter(coach => coach.userId !== currentCoachId) })); }
    catch (error) { showError(error); }
  };
  const assign = async (right: any) => {
    const coachId = selectedCoaches[right.id];
    const reason = notes[-right.id]?.trim();
    if (!coachId || !reason) { Alert.alert('Cần thông tin', 'Chọn Coach đủ chuyên môn và nhập lý do sắp xếp lại.'); return; }
    setBusy(true);
    try { await api.adminAssignMakeupCoach(right.id, coachId, reason); await load(); Alert.alert('Đã sắp xếp', 'Hội viên đã được thông báo lịch đặt bù với Coach mới.'); }
    catch (error) { showError(error); } finally { setBusy(false); }
  };
  const reviewCoachChoice = async (right: any, decision: 'APPROVED' | 'REJECTED') => {
    const reason = notes[-right.id]?.trim();
    if (!reason) { Alert.alert('Cần lý do', 'Nhập lý do duyệt hoặc từ chối để lưu audit log.'); return; }
    setBusy(true);
    try {
      await api.adminReviewMakeupCoachChange(right.id, decision, reason,
        decision === 'REJECTED' ? selectedCoaches[right.id] : undefined);
      await load();
      Alert.alert('Đã xử lý', decision === 'APPROVED'
        ? 'Đã kiểm tra lại ca và duyệt HLV. Hội viên có thể đặt lịch.'
        : 'Hội viên được thông báo và có thể chọn lại HLV.');
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  if (!allowed) return <Page><Empty title="Chỉ Admin và Staff được đối soát PT" /></Page>;
  return <Page loading={loading} refresh={() => void load()}>
    <Section title="Điểm danh cần đối soát" icon="checkmark-circle-outline" />
    {operations.attendance.length === 0 && <Empty title="Không có buổi cần đối soát" />}
    {operations.attendance.map(review => <Card key={`attendance-${review.id}`}>
      <Text style={{ color: aura.ink, fontWeight: '800' }}>Buổi PT #{review.bookingId} · Hội viên #{review.booking?.memberId}</Text>
      <Text style={{ color: aura.muted, marginVertical: 6 }}>Coach chưa phản hồi trước {timeLabel(review.deadlineAt)} · {dateLabel(review.deadlineAt)}. Credit vẫn đang giữ.</Text>
      <Field label="Kết quả kiểm tra và bằng chứng" value={notes[review.bookingId] || ''}
        onChangeText={value => setNotes(previous => ({ ...previous, [review.bookingId]: value }))} multiline />
      <View style={{ gap: 8, marginTop: 8 }}>
        <Button disabled={busy} title="Đã tham gia · tính một buổi" onPress={() => decide(review.bookingId, 'ATTENDED')} />
        <Button disabled={busy} secondary title="Không tham gia · tính một buổi" onPress={() => decide(review.bookingId, 'NO_SHOW')} />
        <Button disabled={busy} secondary title="Miễn trừ · hoàn buổi" onPress={() => decide(review.bookingId, 'EXCUSED')} />
      </View>
    </Card>)}
    <Section title="Quyền học bù cần hỗ trợ" icon="calendar-outline" />
    {operations.makeup.length === 0 && <Empty title="Không có quyền học bù cần hỗ trợ" />}
    {operations.makeup.map(right => <Card key={`makeup-${right.id}`}>
      <Text style={{ color: aura.ink, fontWeight: '800' }}>Quyền #{right.id} · Hội viên #{right.originalBooking?.memberId}</Text>
      <Text style={{ color: aura.muted, marginVertical: 6 }}>Coach vắng {right.coachAbsenceCount} lần · Gia hạn {right.extensionCount} lần · Credit đang giữ.</Text>
      {right.requestedCoachId ? <View style={{ marginVertical: 7 }}>
        <Text style={{ color: aura.caramel, fontWeight: '800' }}>Chờ duyệt HLV</Text>
        <Text style={{ color: aura.ink }}>HLV hội viên chọn: {right.requestedCoachName || `#${right.requestedCoachId}`}</Text>
        <Text style={{ color: aura.ink }}>Hội viên sẽ chọn ca sau khi được duyệt.</Text>
        <Text style={{ color: aura.muted }}>Lý do: {right.requestReason}</Text>
      </View> : <Text style={{ color: aura.caramel, marginBottom: 6 }}>Chờ hội viên chọn HLV trên Mobile. Admin chưa có lựa chọn để duyệt; quyền bù và Credit vẫn được giữ.</Text>}
      {user?.role === 'ADMIN' && <>
        {right.requestedCoachId && <>
          <Field label="Lý do duyệt / từ chối" value={notes[-right.id] || ''}
            onChangeText={value => setNotes(previous => ({ ...previous, [-right.id]: value }))} multiline />
          <Button disabled={busy} title="Duyệt HLV" onPress={() => void reviewCoachChoice(right, 'APPROVED')} />
          <Button disabled={busy} secondary title="Từ chối · yêu cầu chọn lại" onPress={() => void reviewCoachChoice(right, 'REJECTED')} />
          <Button disabled={busy} secondary title="Tìm HLV khác để đề xuất khi từ chối" onPress={() => void showCoaches(right)} />
          {(coaches[right.id] || []).map(coach => <Button key={coach.userId}
            secondary={selectedCoaches[right.id] !== coach.userId} title={coach.fullName}
            onPress={() => setSelectedCoaches(previous => ({ ...previous, [right.id]: coach.userId }))} />)}
        </>}
        <Button secondary title="Xử lý ngoại lệ: Admin chủ động phân HLV" onPress={() =>
          setExceptionsOpen(previous => ({ ...previous, [right.id]: !previous[right.id] }))} />
        {exceptionsOpen[right.id] && <View style={{ gap: 8 }}>
          <Text style={{ color: aura.muted, fontSize: 12 }}>Chỉ dùng khi hội viên không thể tự chọn hoặc HLV cũ không thể tiếp tục.</Text>
          <Button secondary disabled={busy} title="Tìm HLV đủ chuyên môn" onPress={() => void showCoaches(right)} />
          {(coaches[right.id] || []).map(coach => <Button key={coach.userId}
            secondary={selectedCoaches[right.id] !== coach.userId} title={coach.fullName}
            onPress={() => setSelectedCoaches(previous => ({ ...previous, [right.id]: coach.userId }))} />)}
          <Field label="Lý do phân HLV ngoại lệ" value={notes[-right.id] || ''}
            onChangeText={value => setNotes(previous => ({ ...previous, [-right.id]: value }))} multiline />
          <Button disabled={busy} secondary title="Xác nhận phân HLV ngoại lệ" onPress={() => void assign(right)} />
        </View>}
      </>}
    </Card>)}
    {user?.role === 'ADMIN' && <Section title={`LEGACY_PT cần đối soát · ${operations.legacyCount}`} icon="document-text-outline" />}
    {user?.role === 'ADMIN' && operations.legacy.map(batch => <Card key={`legacy-${batch.id}`}>
      <Text style={{ color: aura.ink, fontWeight: '800' }}>Lô #{batch.id} · Hội viên #{batch.wallet?.memberId}</Text>
      <Text style={{ color: aura.muted, marginTop: 6 }}>PT {batch.level} · Gốc {batch.initialCount} · Đã dùng {batch.usedCount} · Giữ {batch.heldCount}</Text>
      <Text style={{ color: aura.muted, marginTop: 4 }}>Gói cũ #{batch.membershipId ?? 'chưa rõ'} · Thanh toán #{batch.paymentId ?? 'chưa rõ'} · {batch.membership?.package?.name || 'Chưa xác định gói'}</Text>
    </Card>)}
    {operations.legacyCount > operations.legacy.length && <Text style={{ color: aura.muted }}>Đang hiển thị 100 lô đầu. Cần xuất báo cáo dữ liệu đầy đủ trước migration mapping.</Text>}
  </Page>;
}
