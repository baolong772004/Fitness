import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Alert, Modal, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, sessionStore, SOCKET_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, vietnamDateLabel as dateLabel, vietnamTimeLabel as timeLabel } from '../lib/theme';
import { Button, Card, Empty, Field, Hero, Page, Pill, Section, showError } from '../components/ui';
import { AuraLoader } from '../components/AuraLoader';
import { PtWalletCard } from '../components/PtWalletCard';

const statusNames: Record<string, string> = { PENDING: 'Chờ HLV xác nhận', UPCOMING: 'Chờ HLV xác nhận', CONFIRMED: 'Đã xác nhận', IN_PROGRESS: 'Đang tập', COMPLETED: 'Hoàn thành', REJECTED: 'PT đã từ chối', ABSENT_ELIGIBLE: 'Được học bù', ABSENT_NO_REFUND: 'Vắng, đã trừ buổi', ABSENT_EXCUSED: 'Vắng được điều chỉnh', MAKEUP_BOOKED: 'Đã đặt học bù', CANCELLED: 'Đã hủy', PENDING_ATTENDANCE_REVIEW: 'Chờ đối soát điểm danh', NO_SHOW: 'Vắng, đã tính buổi' };

export default function PtJourney({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth(); const isCoach = ['COACH', 'TRAINER'].includes(user?.role || '');
  const [bookings, setBookings] = useState<any[]>([]); const [wallet, setWallet] = useState<Awaited<ReturnType<typeof api.ptWallet>> | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<number | null>(null); const [now, setNow] = useState(Date.now());
  const [renewalOptions, setRenewalOptions] = useState<Awaited<ReturnType<typeof api.ptRenewalOptions>>>([]);
  const [absentBooking, setAbsentBooking] = useState<any | null>(null); const [absenceReason, setAbsenceReason] = useState('');
  const [absencePolicy, setAbsencePolicy] = useState<any | null>(null); const [absenceLoading, setAbsenceLoading] = useState(false);
  const [coachRequests, setCoachRequests] = useState<any[]>([]); const [changeSource, setChangeSource] = useState<NonNullable<typeof wallet>['sources'][number] | null>(null);
  const [candidateCoaches, setCandidateCoaches] = useState<any[]>([]); const [newCoachId, setNewCoachId] = useState<number | null>(null); const [changeReason, setChangeReason] = useState('');
  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(null); try { const [rows, balance, prices, requests] = await Promise.all([api.ptBookings(), isCoach ? Promise.resolve(null) : api.ptWallet(), isCoach ? Promise.resolve([]) : api.ptRenewalOptions(), isCoach ? Promise.resolve([]) : api.ptCoachChangeRequests()]); setBookings(rows); setWallet(balance); setRenewalOptions(prices); setCoachRequests(requests); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải lịch PT.'); } finally { setLoading(false); } }, [user, isCoach]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    const token = sessionStore.token();
    if (!user || !token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('notification:new', () => void load());
    return () => { socket.disconnect(); };
  }, [user, load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const act = async (id: number, work: () => Promise<any>, success: string) => { setBusy(id); try { await work(); Alert.alert('Aura Fitness', success); await load(); } catch (error) { showError(error); } finally { setBusy(null); } };
  const openAbsence = async (booking: any) => { setAbsentBooking(booking); setAbsenceReason(''); setAbsencePolicy(null); setAbsenceLoading(true); try { const result = await api.ptAbsencePolicy(booking.id); setAbsencePolicy(result.data); } catch (cause) { showError(cause); setAbsentBooking(null); } finally { setAbsenceLoading(false); } };
  const submitAbsence = async () => { if (!absentBooking) return; const id = absentBooking.id; setBusy(id); try { const result = await api.absentPt(id, absenceReason); setAbsentBooking(null); setAbsencePolicy(null); Alert.alert('Báo vắng PT', result.message || 'Đã ghi nhận báo vắng.'); await load(); } catch (cause) { showError(cause); } finally { setBusy(null); } };
  const openCoachChange = async (source: NonNullable<typeof wallet>['sources'][number]) => { setChangeSource(source); setNewCoachId(null); setChangeReason(''); try { setCandidateCoaches((await api.ptTrainers(source.level)).filter((coach: any) => coach.userId !== source.coachId)); } catch (cause) { showError(cause); setChangeSource(null); } };
  const submitCoachChange = async () => { if (!changeSource || !newCoachId || !changeReason.trim()) { Alert.alert('Đổi HLV gói PT', 'Hãy chọn HLV mới và nhập lý do.'); return; } setBusy(changeSource.id); try { await api.requestPtCoachChange(changeSource.id, newCoachId, changeReason.trim()); setChangeSource(null); Alert.alert('Đổi HLV gói PT', 'Đã gửi Admin duyệt. Quyền học bù hiện có được xử lý riêng.'); await load(); } catch (cause) { showError(cause); } finally { setBusy(null); } };
  const confirmAttendance = (booking: any, decision: 'ATTENDED' | 'NO_SHOW') => Alert.alert(
    'Xác nhận điểm danh PT', decision === 'ATTENDED' ? 'Hội viên đã tham gia buổi tập này?' : 'Hội viên không tham gia buổi tập này?',
    [{ text: 'Để sau' }, { text: 'Xác nhận', onPress: () => void act(booking.id,
      () => api.coachPtAttendance(booking.id, decision, decision === 'NO_SHOW' ? 'Coach xác nhận hội viên không tham gia' : 'Coach xác nhận đã tập'),
      'Đã ghi nhận điểm danh và tính một buổi PT.') }],
  );
  const content = <>{embedded ? <View style={{ paddingVertical: 8 }}><Text style={{ color: '#fff', fontSize: 21, fontWeight: '900' }}>{isCoach ? 'Lịch hẹn của HLV' : 'Hành trình PT của bạn'}</Text><Text style={{ color: '#FFFFFFB8', fontSize: 12, marginTop: 5 }}>{isCoach ? 'Tạo QR cho hội viên, theo dõi và hoàn thành buổi tập.' : 'Đặt lịch, điểm danh và theo dõi từng buổi tập.'}</Text><View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}><Button secondary compact title="Tin nhắn PT" icon="chatbubbles-outline" onPress={() => router.push('/pt-chat')} /></View></View> : isCoach ? <><Hero eyebrow="HUẤN LUYỆN CÁ NHÂN" title="Lịch dạy của Coach" subtitle="Theo dõi và quản lý từng buổi tập." /><View style={{ marginBottom: 12 }}><Button secondary compact title="Mở tin nhắn PT với học viên" icon="chatbubbles-outline" onPress={() => router.push('/pt-chat')} /></View></> : <View style={{ paddingTop: 2, paddingBottom: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Text style={{ color: aura.ink, fontSize: 23, fontWeight: '800' }}>Tập tốt hơn mỗi ngày</Text><Text style={{ color: aura.muted, fontSize: 12, marginTop: 5 }}>Chọn cấp độ, đặt lịch cùng huấn luyện viên.</Text></View><Button secondary compact title="Tin nhắn PT" icon="chatbubbles-outline" onPress={() => router.push('/pt-chat')} /></View></View>}
    {!user ? <><Empty title="Đăng nhập để xem lịch PT" /><Button title="Đăng nhập" onPress={() => router.push('/auth')} /></> : <>
      {embedded && loading && <View style={{ alignSelf: 'center', marginVertical: 25 }}><AuraLoader size={56} /></View>}
      {error && <><Empty icon="wifi-outline" title="Chưa tải được lịch PT" message={error} /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
      {!error && <>
      {isCoach && <Card><Text style={{ color: aura.ink, fontWeight: '800', marginBottom: 8 }}>Lịch làm việc của Coach</Text><Button secondary title="Đăng ký lịch rảnh" icon="calendar-outline" onPress={() => router.push('/coach-availability')} /></Card>}
      {!isCoach && wallet && <PtWalletCard wallet={wallet} renewalOptions={renewalOptions} onChangeCoach={source => void openCoachChange(source)} pendingCoachBatchIds={coachRequests.filter(request => request.status === 'PENDING_ADMIN').map(request => request.batchId)} usedCoachBatchIds={coachRequests.filter(request => request.status === 'APPROVED' && !request.quotaExempt).map(request => request.batchId)} />}
      <View style={embedded ? { backgroundColor: aura.white, borderRadius: 14, paddingHorizontal: 10 } : undefined}><Section title={isCoach ? 'Buổi dạy PT' : 'Lịch tập PT'} icon="calendar-outline" /></View>
      {bookings.length === 0 && !loading ? <Empty title="Chưa có lịch tập PT" /> : bookings.map(booking => {
        const status = String(booking.status || ''); const start = new Date(booking.startTime).getTime(); const end = new Date(booking.endTime).getTime(); const beforeEnd = now < end;
        const canScan = status === 'CONFIRMED' && now >= start - 15 * 60000 && beforeEnd;
        const canAbsence = status === 'CONFIRMED' && now < start;
        const makeupRight = booking.makeUpRequests?.find((request: any) => ['PENDING', 'ESCALATED'].includes(request.status));
        const currentMakeupCoachName = makeupRight?.assignedCoachId
          ? makeupRight.assignedCoachName || `HLV #${makeupRight.assignedCoachId}`
          : booking.coach?.fullName || 'HLV của lịch gốc';
        const canMakeup = status === 'ABSENT_ELIGIBLE' && makeupRight?.status === 'PENDING' &&
          !makeupRight.requestedCoachId && now < new Date(makeupRight.expiresAt).getTime();
        const canRequestCoachChange = status === 'ABSENT_ELIGIBLE' && makeupRight?.cause === 'COACH' &&
          makeupRight?.status === 'PENDING' && !makeupRight.requestedCoachId &&
          (now < new Date(makeupRight.expiresAt).getTime() || makeupRight.escalatedAt);
        const escalatedMakeup = status === 'ABSENT_ELIGIBLE' && makeupRight?.status === 'ESCALATED';
        const adminHelpPending = escalatedMakeup || Boolean(status === 'ABSENT_ELIGIBLE' && makeupRight?.escalatedAt);
        const expiredMakeup = status === 'ABSENT_ELIGIBLE' && !canMakeup && !adminHelpPending;
        return <Card key={String(booking.id)}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}><Text style={{ color: aura.ink, fontWeight: '900', flex: 1 }}>{isCoach ? booking.member?.fullName || 'Hội viên' : booking.coach?.fullName || 'Coach Aura'}</Text><Pill text={adminHelpPending ? 'Admin đang hỗ trợ đổi HLV' : expiredMakeup ? 'Quyền học bù hết hạn' : status === 'CONFIRMED' && !beforeEnd ? 'Đã qua giờ tập' : status === 'ABSENT_NO_REFUND' && booking.cancelledBy === 'SYSTEM_NO_SHOW_NO_DEBIT' ? 'Vắng, gói hết buổi' : statusNames[status] || status} color={status === 'CONFIRMED' && beforeEnd ? aura.green : aura.caramel} /></View>
          <Text style={{ color: aura.ink, fontWeight: '800', marginTop: 8 }}>{timeLabel(booking.startTime)} · {dateLabel(booking.startTime)}</Text><Text style={{ color: aura.muted, fontSize: 12 }}>{booking.ptCreditAllocation?.batch?.level ? `PT ${booking.ptCreditAllocation.batch.level}` : booking.membership?.package?.name || 'PT lịch sử'}{!booking.ptCreditAllocation && booking.membership?.remainingSessions != null ? ` · Còn ${booking.membership.remainingSessions} buổi` : ''}</Text>
          {booking.isMakeup && <Text style={{ color: aura.caramel, fontSize: 11 }}>Buổi học bù</Text>}
          {status === 'PENDING_ATTENDANCE_REVIEW' && <Text style={{ color: aura.caramel, fontSize: 12, marginTop: 6 }}>Chưa có check-in. Credit vẫn được giữ; Coach xác nhận trong 24 giờ, sau đó Admin đối soát.</Text>}
          {!isCoach && makeupRight && <Text style={{ color: aura.caramel, fontSize: 12, marginTop: 6 }}>{escalatedMakeup ? 'Admin sẽ hỗ trợ đổi HLV hoặc bố trí lịch. Quyền một buổi vẫn được giữ.' : `Hạn học bù: ${timeLabel(makeupRight.expiresAt)} · ${dateLabel(makeupRight.expiresAt)}${makeupRight.extensionCount ? ' · Đã gia hạn 7 ngày' : ''}${makeupRight.requestedCoachId ? ' · Chờ Admin duyệt HLV đã chọn; bạn sẽ đặt lịch sau' : makeupRight.escalatedAt ? ' · Hãy chọn HLV mong muốn để Admin duyệt' : ''}`}</Text>}
          {!isCoach && makeupRight?.requestedCoachId && <Text style={{ color: aura.muted, fontSize: 12, marginTop: 4 }}>Bạn chọn {makeupRight.requestedCoachName || `HLV #${makeupRight.requestedCoachId}`}. Lý do: {makeupRight.requestReason}</Text>}
          {!isCoach && makeupRight?.assignedCoachId && !makeupRight.requestedCoachId && <Text style={{ color: aura.green, fontSize: 12, marginTop: 4 }}>HLV mới cho buổi học bù: {currentMakeupCoachName}. Hãy chọn ca còn trống để đặt lịch.</Text>}
          {isCoach && status === 'PENDING_ATTENDANCE_REVIEW' && booking.attendanceReview?.status === 'PENDING_COACH' && now < new Date(booking.attendanceReview.deadlineAt).getTime() && <View style={{ marginTop: 9, gap: 8 }}><Button disabled={busy != null} title="Xác nhận đã tập" onPress={() => confirmAttendance(booking, 'ATTENDED')} /><Button disabled={busy != null} secondary title="Xác nhận không tham gia" onPress={() => confirmAttendance(booking, 'NO_SHOW')} /></View>}
          {isCoach && canScan && <View style={{ marginTop: 9 }}><Button disabled={busy != null} title="Tạo QR buổi tập" icon="qr-code-outline" onPress={() => router.push({ pathname: '/pt-qr', params: { booking: JSON.stringify(booking) } })} /></View>}
          {isCoach && status === 'IN_PROGRESS' && now >= end && <View style={{ marginTop: 9 }}><Button title="Hoàn thành buổi" onPress={() => Alert.alert('Hoàn thành buổi tập?', 'Hệ thống sẽ trừ 1 buổi PT của hội viên.', [{ text: 'Để sau' }, { text: 'Hoàn thành', onPress: () => void act(booking.id, () => api.completePt(booking.id), 'Đã hoàn thành buổi PT.') }])} /></View>}
          {!isCoach && canScan && <View style={{ marginTop: 9 }}><Button title="Quét QR điểm danh" icon="scan-outline" onPress={() => router.push('/scanner?kind=pt')} /></View>}
          {canAbsence && <View style={{ marginTop: 9 }}><Button secondary title={isCoach ? 'Coach báo vắng' : 'Báo vắng'} onPress={() => void openAbsence(booking)} /></View>}
          {!isCoach && canRequestCoachChange && <View style={{ marginTop: 9 }}><Button disabled={busy != null} title="Đổi HLV cho buổi học bù" onPress={() => router.push({ pathname: '/pt-makeup-change', params: { rightId: String(makeupRight.id), currentCoachName: currentMakeupCoachName } })} /></View>}
          {!isCoach && canMakeup && <View style={{ marginTop: 8 }}><Button secondary={canRequestCoachChange} title={makeupRight.assignedCoachId ? 'Đặt lịch học bù với HLV mới' : 'Đặt lịch học bù với HLV hiện tại'} onPress={() => router.push({ pathname: '/pt-book', params: { subscription: JSON.stringify({ id: booking.membershipId, coachId: makeupRight.assignedCoachId ?? booking.coachId, coach: { fullName: currentMakeupCoachName }, level: booking.ptCreditAllocation?.batch?.level, availableSessions: 1 }), makeupFor: String(booking.id), deadline: makeupRight.expiresAt } })} /></View>}
        </Card>;
      })}
      </>}
      <Modal visible={!!absentBooking} transparent animationType="fade" onRequestClose={() => setAbsentBooking(null)}><View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 18 }}><Card><Text style={{ color: aura.ink, fontSize: 19, fontWeight: '900' }}>Báo vắng buổi PT</Text><Text style={{ color: aura.muted, marginVertical: 9 }}>{absenceLoading ? 'Đang kiểm tra quyền lợi...' : absencePolicy?.message || 'Chưa tải được chính sách báo vắng.'}</Text>{absencePolicy && !isCoach && <Text style={{ color: aura.muted, marginBottom: 9 }}>Đã bảo lưu {absencePolicy.protectedUsed}/{absencePolicy.protectedMax} lần · {absencePolicy.outcome === 'DEBIT' ? 'Buổi này sẽ bị trừ Credit' : 'Buổi này được giữ Credit'}</Text>}<Field label="Lý do vắng mặt" value={absenceReason} onChangeText={setAbsenceReason} multiline /><Button disabled={absenceLoading || !absencePolicy || busy != null} title={absencePolicy?.outcome === 'DEBIT' ? 'Xác nhận và trừ buổi' : 'Xác nhận báo vắng'} onPress={() => void submitAbsence()} /><View style={{ height: 8 }} /><Button secondary title="Đóng" onPress={() => setAbsentBooking(null)} /></Card></View></Modal>
      <Modal visible={!!changeSource} transparent animationType="fade" onRequestClose={() => setChangeSource(null)}><View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 18 }}><Card><Text style={{ color: aura.ink, fontSize: 19, fontWeight: '900' }}>Đổi HLV của gói PT</Text><Text style={{ color: aura.muted, marginVertical: 9 }}>Gói Paid #{changeSource?.id} · tối đa 1 lần theo yêu cầu. Admin sẽ duyệt và xử lý lịch PT thường trong phạm vi gói. Quyền học bù hiện có không tự đổi HLV.</Text>{candidateCoaches.map(coach => <Button key={coach.userId} secondary={newCoachId !== coach.userId} title={coach.fullName} onPress={() => setNewCoachId(coach.userId)} />)}{candidateCoaches.length === 0 && <Text style={{ color: aura.muted }}>Chưa có HLV phù hợp với cấp độ này.</Text>}<Field label="Lý do đổi HLV" value={changeReason} onChangeText={setChangeReason} multiline /><Button disabled={busy != null || !newCoachId || !changeReason.trim()} title="Gửi yêu cầu" onPress={() => void submitCoachChange()} /><View style={{ height: 8 }} /><Button secondary title="Đóng" onPress={() => setChangeSource(null)} /></Card></View></Modal>
    </>}
  </>;
  return embedded ? content : <Page loading={loading} refresh={() => void load()}>{content}</Page>;
}
