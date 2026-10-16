import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { aura, dateLabel, timeLabel } from '../../lib/theme';
import { Card, Page, showError } from '../../components/ui';

function Option({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}><Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 18 }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={22} color={aura.darkCoffee} /></View><View style={{ flex: 1, gap: 3 }}><Text style={{ color: aura.ink, fontWeight: '900', fontSize: 15 }}>{title}</Text><Text style={{ color: aura.muted, fontSize: 11, lineHeight: 16 }}>{detail}</Text></View><View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: aura.cream, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={17} color={aura.caramel} /></View></Card></Pressable>;
}

function Summary({ icon, title, detail, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; action: string; onPress: () => void }) {
  return <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, borderRadius: 18 }}><View style={{ width: 40, height: 40, backgroundColor: aura.latte, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={aura.darkCoffee} /></View><View style={{ flex: 1 }}><Text style={{ color: aura.ink, fontWeight: '900', fontSize: 14, lineHeight: 19 }}>{title}</Text><Text style={{ color: aura.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{detail}</Text><Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 9 }}><Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 12 }}>{action}</Text><Ionicons name="arrow-forward" size={14} color={aura.darkCoffee} /></Pressable></View></Card>;
}

function Action({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.82 : 1 })}><Card style={{ minHeight: 122, justifyContent: 'space-between', padding: 13, borderRadius: 17 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={19} color={aura.darkCoffee} /></View><Ionicons name="arrow-forward" size={16} color={aura.caramel} /></View><View style={{ marginTop: 12 }}><Text style={{ color: aura.ink, fontSize: 14, fontWeight: '900' }}>{title}</Text><Text numberOfLines={2} style={{ color: aura.muted, fontSize: 11, lineHeight: 15, marginTop: 3 }}>{detail}</Text></View></Card></Pressable>;
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return <View style={{ marginTop: 7, marginBottom: 1 }}><Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }}>{title}</Text>{detail ? <Text style={{ color: aura.muted, fontSize: 11, lineHeight: 16, marginTop: 2 }}>{detail}</Text> : null}</View>;
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
    <LinearGradient colors={[aura.espresso, aura.darkCoffee, aura.caramel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, minHeight: 154, justifyContent: 'center' }}><Text style={{ color: '#FFD6B4', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }}>AURA FITNESS  ·  LỊCH TẬP</Text><Text style={{ color: '#fff', fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 9 }}>{coach ? 'Lịch huấn luyện của bạn' : 'Tập luyện theo cách của bạn'}</Text><Text style={{ color: '#FFFFFFD1', fontSize: 12, lineHeight: 18, marginTop: 5 }}>{coach ? 'Theo dõi buổi hẹn và đồng hành cùng hội viên.' : 'Quản lý gói tập, lịch PT và lớp học tại một nơi.'}</Text><Pressable onPress={() => router.push(coach ? '/pt' : '/packages')} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14 }}><Ionicons name={coach ? 'calendar-outline' : 'add'} size={16} color={aura.darkCoffee} /><Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 12 }}>{coach ? 'Xem lịch PT' : 'Khám phá gói tập'}</Text></Pressable></LinearGradient>
    <SectionTitle title="Lớp học" detail="Đặt chỗ và check-in lớp tập nhóm." />
    <Option icon="people" title="Workout Class" detail="Xem lịch lớp nhóm, đặt chỗ và check-in" onPress={() => router.push('/classes')} />
    {!coach && <><SectionTitle title="Gói tập & quyền lợi" detail="Theo dõi gói hiện tại hoặc chọn gói phù hợp." /><View style={{ flexDirection: 'row', gap: 10 }}><Action icon="pricetag" title="Mua gói tập" detail="Khám phá gói hội viên và PT" onPress={() => router.push('/packages')} /><Action icon="card" title="Gói của tôi" detail="Xem hạn dùng, quyền lợi và gia hạn" onPress={() => router.push(user ? '/subscriptions' : '/auth')} /></View></>}
    {!user ? <><SectionTitle title="Lịch tập của bạn" /><Summary icon="lock-closed-outline" title="Đăng nhập để xem lịch tập" detail="Lịch PT và quyền lợi hội viên sẽ hiển thị tại đây." action="Đăng nhập" onPress={() => router.push('/auth')} /></> : <>
      {!coach && <><SectionTitle title="Gói hội viên" /><Summary icon={active ? 'checkmark-circle-outline' : 'card-outline'} title={active?.package?.name || 'Chưa có gói hội viên hoạt động'} detail={active ? `Đang hoạt động  ·  Hết hạn ${dateLabel(active.endDate)}` : 'Chọn gói hội viên để bắt đầu tập luyện.'} action={active ? 'Xem quyền lợi' : 'Chọn gói tập'} onPress={() => router.push(active ? '/subscriptions' : '/packages')} /></>}
      <SectionTitle title="Lịch tập của bạn" detail="Buổi PT sắp tới và trạng thái xác nhận." />
      <Summary icon="calendar-outline" title={upcoming ? (coach ? upcoming.member?.fullName || 'Buổi tập với hội viên' : upcoming.coach?.fullName || 'Buổi tập cùng PT') : coach ? 'Chưa có lịch huấn luyện sắp tới' : 'Chưa có buổi PT sắp tới'} detail={upcoming ? `${timeLabel(upcoming.startTime)}  ·  ${dateLabel(upcoming.startTime)}  ·  ${upcoming.status === 'IN_PROGRESS' ? 'Đang tập' : ['PENDING', 'UPCOMING'].includes(upcoming.status) ? 'Chờ HLV xác nhận' : 'Đã xác nhận'}` : 'Khi có lịch mới, thông tin sẽ hiển thị tại đây.'} action="Mở lịch PT" onPress={() => router.push('/pt')} />
    </>}
    <SectionTitle title="Hình thức tập luyện" />
    <Option icon="fitness" title="Tập cùng PT" detail="Đặt buổi tập và liên hệ huấn luyện viên" onPress={() => router.push(user ? '/pt' : '/auth')} />
  </Page>;
}
