import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { aura, dateLabel, timeLabel } from '../../lib/theme';
import { Button, Card, Page, showError } from '../../components/ui';

function Option({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress}><Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}><View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={24} color={aura.darkCoffee} /></View><View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontWeight: '900', fontSize: 15 }}>{title}</Text><Text style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>{detail}</Text></View><Ionicons name="chevron-forward" size={18} color={aura.caramel} /></Card></Pressable>;
}

function Summary({ icon, title, detail, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; action: string; onPress: () => void }) {
  return <Card style={{ flexDirection: 'row', gap: 12 }}><View style={{ width: 42, height: 42, backgroundColor: aura.latte, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={21} color={aura.darkCoffee} /></View><View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontWeight: '800', fontSize: 14 }}>{title}</Text><Text style={{ color: aura.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{detail}</Text><Text onPress={onPress} style={{ color: aura.darkCoffee, fontWeight: '800', marginTop: 7 }}>{action} →</Text></View></Card>;
}

function Action({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={{ flex: 1 }}><Card style={{ height: 145, justifyContent: 'space-between' }}><View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={21} color={aura.darkCoffee} /></View><View><Text style={{ color: aura.ink, fontSize: 15, fontWeight: '900' }}>{title}</Text><Text style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>{detail}</Text></View></Card></Pressable>;
}

export default function BookingHub() {
  const { user } = useAuth(); const coach = ['COACH', 'TRAINER'].includes(user?.role || '');
  const [subscriptions, setSubscriptions] = useState<any[]>([]); const [bookings, setBookings] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [subs, pt] = await Promise.all([coach ? Promise.resolve([]) : api.subscriptions(), api.ptBookings()]);
      setSubscriptions(subs); setBookings(pt);
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, [user, coach]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const today = Date.now();
  const active = subscriptions.find(row => row.package?.type === 'MEMBERSHIP' && row.status === 'ACTIVE' && new Date(row.endDate).getTime() >= today);
  const upcoming = bookings.filter(row => ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'].includes(row.status) && new Date(row.endTime).getTime() > today).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
  return <Page loading={loading} refresh={user ? () => void load() : undefined}>
    <LinearGradient colors={[aura.espresso, aura.darkCoffee, aura.caramel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 22, minHeight: 200 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1, backgroundColor: '#FFFFFF24', alignSelf: 'flex-start', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 6 }}>AURA FITNESS · LỊCH TẬP</Text><Text style={{ color: '#fff', fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 19 }}>{coach ? 'Lịch huấn luyện của bạn' : 'Tập luyện theo cách của bạn'}</Text><Text style={{ color: '#FFFFFFD1', fontSize: 13, lineHeight: 19, marginTop: 7 }}>{coach ? 'Theo dõi buổi hẹn và đồng hành cùng hội viên.' : 'Xem gói đang dùng, chọn buổi PT và chuẩn bị cho lớp tập.'}</Text><View style={{ alignSelf: 'flex-start', marginTop: 20 }}><Button secondary compact title={coach ? 'Xem lịch PT' : 'Khám phá gói tập'} onPress={() => router.push(coach ? '/pt' : '/packages')} /></View></LinearGradient>
    <Option icon="people" title="Workout Class" detail="Xem lịch lớp nhóm, đặt chỗ và check-in" onPress={() => router.push('/classes')} />
    {!coach && <><Text style={{ color: aura.ink, fontSize: 18, fontWeight: '900', marginTop: 12 }}>Gói tập & quyền lợi</Text><View style={{ flexDirection: 'row', gap: 11 }}><Action icon="pricetag" title="Mua gói tập" detail="Hội viên và PT" onPress={() => router.push('/packages')} /><Action icon="card" title="Gói của tôi" detail="Xem hạn và gia hạn" onPress={() => router.push(user ? '/subscriptions' : '/auth')} /></View></>}
    {!user ? <Summary icon="lock-closed-outline" title="Đăng nhập để xem gói và lịch tập" detail="Thông tin tập luyện của bạn sẽ hiển thị tại đây." action="Đăng nhập" onPress={() => router.push('/auth')} /> : <>
      {!coach && <Summary icon={active ? 'checkmark-circle-outline' : 'card-outline'} title={active?.package?.name || 'Bạn chưa có gói hội viên hoạt động'} detail={active ? `Đang hoạt động · Hết hạn ${dateLabel(active.endDate)}` : 'Chọn gói hội viên để bắt đầu tập luyện.'} action={active ? 'Chi tiết gói' : 'Xem gói tập'} onPress={() => router.push(active ? '/subscriptions' : '/packages')} />}
      <Text style={{ color: aura.ink, fontSize: 18, fontWeight: '900', marginTop: 12 }}>Lịch tập của bạn</Text>
      <Summary icon="calendar-outline" title={upcoming ? (coach ? upcoming.member?.fullName || 'Buổi tập với hội viên' : upcoming.coach?.fullName || 'Buổi tập cùng PT') : coach ? 'Chưa có lịch huấn luyện sắp tới' : 'Chưa có buổi PT sắp tới'} detail={upcoming ? `${timeLabel(upcoming.startTime)} · ${dateLabel(upcoming.startTime)} · ${upcoming.status === 'IN_PROGRESS' ? 'Đang tập' : ['PENDING', 'UPCOMING'].includes(upcoming.status) ? 'Chờ HLV xác nhận' : 'Đã xác nhận'}` : 'Lịch PT và trạng thái xác nhận sẽ hiển thị tại đây.'} action="Xem lịch PT" onPress={() => router.push('/pt')} />
    </>}
    <Text style={{ color: aura.ink, fontSize: 18, fontWeight: '900', marginTop: 12 }}>Hình thức tập luyện</Text>
    <Option icon="fitness" title="Tập cùng PT" detail="Lịch hẹn, đặt buổi và liên hệ huấn luyện viên" onPress={() => router.push(user ? '/pt' : '/auth')} />
  </Page>;
}
