import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Alert, Modal, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, sessionStore, SOCKET_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dateLabel, timeLabel } from '../lib/theme';
import { Button, Card, Empty, Field, Hero, Page, Pill, Section, showError } from '../components/ui';
import { AuraLoader } from '../components/AuraLoader';
import { PtWalletCard } from '../components/PtWalletCard';

const statusNames: Record<string, string> = { PENDING: 'Chờ HLV xác nhận', UPCOMING: 'Chờ HLV xác nhận', CONFIRMED: 'Đã xác nhận', IN_PROGRESS: 'Đang tập', COMPLETED: 'Hoàn thành', REJECTED: 'PT đã từ chối', ABSENT_ELIGIBLE: 'Được học bù', ABSENT_NO_REFUND: 'Vắng, đã trừ buổi', ABSENT_EXCUSED: 'Vắng được điều chỉnh', MAKEUP_BOOKED: 'Đã đặt học bù', CANCELLED: 'Đã hủy' };

export default function PtJourney({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth(); const isCoach = ['COACH', 'TRAINER'].includes(user?.role || '');
  const [bookings, setBookings] = useState<any[]>([]); const [wallet, setWallet] = useState<Awaited<ReturnType<typeof api.ptWallet>> | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<number | null>(null); const [now, setNow] = useState(Date.now());
  const [renewalOptions, setRenewalOptions] = useState<Awaited<ReturnType<typeof api.ptRenewalOptions>>>([]);
  const [absentBooking, setAbsentBooking] = useState<any | null>(null); const [absenceReason, setAbsenceReason] = useState('');
  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(null); try { const [rows, balance, prices] = await Promise.all([api.ptBookings(), isCoach ? Promise.resolve(null) : api.ptWallet(), isCoach ? Promise.resolve([]) : api.ptRenewalOptions()]); setBookings(rows); setWallet(balance); setRenewalOptions(prices); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải lịch PT.'); } finally { setLoading(false); } }, [user, isCoach]);
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
  const content = <>{embedded ? <View style={{ paddingVertical: 8 }}><Text style={{ color: '#fff', fontSize: 21, fontWeight: '900' }}>{isCoach ? 'Lịch hẹn của HLV' : 'Hành trình PT của bạn'}</Text><Text style={{ color: '#FFFFFFB8', fontSize: 12, marginTop: 5 }}>{isCoach ? 'Tạo QR cho hội viên, theo dõi và hoàn thành buổi tập.' : 'Đặt lịch, điểm danh và theo dõi từng buổi tập.'}</Text><View style={{ alignSelf: 'flex-start', marginTop: 11 }}><Button secondary compact title={loading ? 'Đang tải...' : 'Làm mới lịch PT'} icon="refresh-outline" disabled={loading} onPress={() => void load()} /></View></View> : isCoach ? <Hero eyebrow="HUẤN LUYỆN CÁ NHÂN" title="Lịch dạy của Coach" subtitle="Theo dõi và quản lý từng buổi tập." /> : <View style={{ paddingTop: 2, paddingBottom: 4 }}><Text style={{ color: aura.ink, fontSize: 23, fontWeight: '800' }}>Tập tốt hơn mỗi ngày</Text><Text style={{ color: aura.muted, fontSize: 12, marginTop: 5 }}>Chọn cấp độ, đặt lịch cùng huấn luyện viên.</Text></View>}
    {!user ? <><Empty title="Đăng nhập để xem lịch PT" /><Button title="Đăng nhập" onPress={() => router.push('/auth')} /></> : <>
      {embedded && loading && <View style={{ alignSelf: 'center', marginVertical: 25 }}><AuraLoader size={56} /></View>}
      {error && <><Empty icon="wifi-outline" title="Chưa tải được lịch PT" message={error} /><Button secondary title="Thử lại" onPress={() => void load()} /></>}
      {!error && <>
      {isCoach && <Card><Text style={{ color: aura.ink, fontWeight: '800', marginBottom: 8 }}>Lịch làm việc của Coach</Text><Button secondary title="Đăng ký lịch rảnh" icon="calendar-outline" onPress={() => router.push('/coach-availability')} /></Card>}
      {!isCoach && wallet && <PtWalletCard wallet={wallet} renewalOptions={renewalOptions} />}
      <View style={embedded ? { backgroundColor: aura.white, borderRadius: 14, paddingHorizontal: 10 } : undefined}><Section title={isCoach ? 'Buổi dạy PT' : 'Lịch tập PT'} icon="calendar-outline" /></View>
      {bookings.length === 0 && !loading ? <Empty title="Chưa có lịch tập PT" /> : bookings.map(booking => {
        const status = String(booking.status || ''); const start = new Date(booking.startTime).getTime(); const end = new Date(booking.endTime).getTime(); const beforeEnd = now < end;
        const canScan = status === 'CONFIRMED' && now >= start - 15 * 60000 && beforeEnd;
        const canAbsence = status === 'CONFIRMED' && now < start;
        const canMakeup = status === 'ABSENT_ELIGIBLE' && booking.makeUpRequests?.some((request: any) => request.status === 'PENDING' && now < new Date(request.expiresAt).getTime());
        const expiredMakeup = status === 'ABSENT_ELIGIBLE' && !canMakeup;
        return <Card key={String(booking.id)}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}><Text style={{ color: aura.ink, fontWeight: '900', flex: 1 }}>{isCoach ? booking.member?.fullName || 'Hội viên' : booking.coach?.fullName || 'Coach Aura'}</Text><Pill text={expiredMakeup ? 'Quyền học bù hết hạn' : status === 'CONFIRMED' && !beforeEnd ? 'Đã qua giờ tập' : status === 'ABSENT_NO_REFUND' && booking.cancelledBy === 'SYSTEM_NO_SHOW_NO_DEBIT' ? 'Vắng, gói hết buổi' : statusNames[status] || status} color={status === 'CONFIRMED' && beforeEnd ? aura.green : aura.caramel} /></View>
          <Text style={{ color: aura.ink, fontWeight: '800', marginTop: 8 }}>{timeLabel(booking.startTime)} · {dateLabel(booking.startTime)}</Text><Text style={{ color: aura.muted, fontSize: 12 }}>{booking.ptCreditAllocation?.batch?.level ? `PT ${booking.ptCreditAllocation.batch.level}` : booking.membership?.package?.name || 'PT lịch sử'}{!booking.ptCreditAllocation && booking.membership?.remainingSessions != null ? ` · Còn ${booking.membership.remainingSessions} buổi` : ''}</Text>
          {booking.isMakeup && <Text style={{ color: aura.caramel, fontSize: 11 }}>Buổi học bù</Text>}
          {isCoach && canScan && <View style={{ marginTop: 9 }}><Button disabled={busy != null} title="Tạo QR buổi tập" icon="qr-code-outline" onPress={() => router.push({ pathname: '/pt-qr', params: { booking: JSON.stringify(booking) } })} /></View>}
          {isCoach && status === 'IN_PROGRESS' && now >= end && <View style={{ marginTop: 9 }}><Button title="Hoàn thành buổi" onPress={() => Alert.alert('Hoàn thành buổi tập?', 'Hệ thống sẽ trừ 1 buổi PT của hội viên.', [{ text: 'Để sau' }, { text: 'Hoàn thành', onPress: () => void act(booking.id, () => api.completePt(booking.id), 'Đã hoàn thành buổi PT.') }])} /></View>}
          {!isCoach && canScan && <View style={{ marginTop: 9 }}><Button title="Quét QR điểm danh" icon="scan-outline" onPress={() => router.push('/scanner?kind=pt')} /></View>}
          {canAbsence && <View style={{ marginTop: 9 }}><Button secondary title={isCoach ? 'Coach báo vắng' : 'Báo vắng'} onPress={() => { setAbsentBooking(booking); setAbsenceReason(''); }} /></View>}
          {!isCoach && canMakeup && <View style={{ marginTop: 9 }}><Button title="Đặt lịch học bù" onPress={() => router.push({ pathname: '/pt-book', params: { subscription: JSON.stringify({ id: booking.membershipId, coachId: booking.coachId, coach: booking.coach, level: booking.ptCreditAllocation?.batch?.level, availableSessions: 1 }), makeupFor: String(booking.id), deadline: booking.makeUpRequests.find((request: any) => request.status === 'PENDING')?.expiresAt } })} /></View>}
        </Card>;
      })}
      </>}
      <Modal visible={!!absentBooking} transparent animationType="fade" onRequestClose={() => setAbsentBooking(null)}><View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 18 }}><Card><Text style={{ color: aura.ink, fontSize: 19, fontWeight: '900' }}>Báo vắng buổi PT</Text><Text style={{ color: aura.muted, marginVertical: 9 }}>{isCoach ? 'Hội viên được cấp quyền đặt học bù trong 7 ngày và không bị trừ buổi.' : 'Báo trước ít nhất 2 giờ và còn lượt học bù để được đặt lịch bù. Báo trễ có thể bị trừ buổi.'}</Text><Field label="Lý do vắng mặt" value={absenceReason} onChangeText={setAbsenceReason} multiline /><Button title="Xác nhận báo vắng" onPress={() => { const id = absentBooking.id; setAbsentBooking(null); void act(id, () => api.absentPt(id, absenceReason), 'Đã ghi nhận báo vắng.'); }} /><View style={{ height: 8 }} /><Button secondary title="Quay lại" onPress={() => setAbsentBooking(null)} /></Card></View></Modal>
    </>}
  </>;
  return embedded ? content : <Page loading={loading} refresh={() => void load()}>{content}</Page>;
}
