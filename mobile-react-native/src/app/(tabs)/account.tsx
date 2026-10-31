import React from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Page, Row, Section } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { aura, money } from '../../lib/theme';

export default function Account() {
  const { user, signOut, refreshSession } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshSession?.(),
        new Promise(resolve => setTimeout(resolve, 600)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession]);

  return <Page refresh={onRefresh} refreshing={refreshing}><LinearGradient colors={[aura.espresso, aura.darkCoffee]} style={{ marginHorizontal: -16, marginTop: -16, height: 222, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, paddingHorizontal: 22, paddingTop: 34, flexDirection: 'row', alignItems: 'flex-start', gap: 15 }}>
    <View style={{ width: 66, height: 66, borderRadius: 33, borderColor: '#FFFFFF57', borderWidth: 2, backgroundColor: '#FFFFFF29', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={37} color="#fff" /></View>
    <View style={{ flex: 1, paddingTop: 7 }}><Text numberOfLines={2} style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{user?.fullName || 'Chào mừng đến Aura Fitness'}</Text><Text numberOfLines={1} style={{ color: '#E8D8CF', fontSize: 12, marginTop: 5 }}>{user ? `Mã tài khoản: ${user.id}` : 'Đăng nhập để xem hồ sơ hội viên'}</Text><Text numberOfLines={1} style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4 }}>{user?.email || 'Hồ sơ ›'}</Text></View>
  </LinearGradient>
    <LinearGradient colors={[aura.caramel, aura.darkCoffee]} style={{ borderRadius: 22, padding: 19, marginTop: -70, minHeight: 118, justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#EAD8C7', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>AURA FITNESS  •  HỘI VIÊN</Text><Ionicons name="ribbon-outline" size={21} color="#fff" /></View><Text numberOfLines={1} style={{ color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 11 }}>{user ? `Xin chào, ${user.fullName}` : 'Bắt đầu hành trình khỏe hơn'}</Text><Text style={{ color: '#F4E9DF', fontSize: 12, marginTop: 5 }}>{user ? `Số dư tài khoản: ${user.balance != null ? money(user.balance) : 'Chưa cập nhật'}` : 'Đăng nhập để quản lý quyền lợi hội viên.'}</Text></LinearGradient>
    {!user ? <Card><Button title="Đăng nhập" onPress={() => router.push('/auth')} /><Button secondary title="Đăng ký" onPress={() => router.push('/auth?register=1')} /></Card> : <>
      <Card><Row title="Ưu đãi hội viên" onPress={() => router.push('/article?id=rewards')} /><Row title="Hướng dẫn sử dụng" onPress={() => router.push('/article?id=booking')} /><Row title="Liên hệ Aura Fitness" onPress={() => Alert.alert('Liên hệ', 'Hotline 1900 1234 hoặc quầy lễ tân.')} /><Row title="Hợp đồng hội viên" onPress={() => Alert.alert('Hợp đồng hội viên', 'Thông tin hợp đồng hiện chưa được đồng bộ vào ứng dụng.')} /></Card>
      <Section title="Lịch & tiến độ" icon="analytics-outline" />
      <Card><Row title="Gói tập của tôi" onPress={() => router.push('/subscriptions')} /><Row title="Lịch tập PT" onPress={() => router.push('/pt')} /><Row title="Tiến độ tập luyện" onPress={() => router.push('/progress')} /><Row title="Giáo án & Dinh dưỡng" onPress={() => router.push('/progress?plansOnly=1')} /><Row title="Lịch sử điểm danh" onPress={() => router.push('/history')} /></Card>
      <Section title="Tiện ích" icon="options-outline" /><Card><Row title="Hộp thư thông báo" onPress={() => router.push('/(tabs)/notifications')} /><Row title="Bổ sung hồ sơ" onPress={() => Alert.alert('Hồ sơ hội viên', `Email: ${user.email}\nSố điện thoại: ${user.phone || 'Chưa cập nhật'}`)} /><Row title="Đổi ngôn ngữ" onPress={() => Alert.alert('Ngôn ngữ', 'Ứng dụng hiện đang sử dụng tiếng Việt.')} /><Row title="Cài đặt đăng nhập" onPress={() => router.push('/change-password')} /><Row title="Thay mật khẩu" onPress={() => router.push('/change-password')} /><Row title="Vô hiệu hóa tài khoản" onPress={() => Alert.alert('Vô hiệu hóa tài khoản', 'Vui lòng liên hệ quầy lễ tân để được hỗ trợ yêu cầu này.')} /></Card>
      <Button secondary title="Đăng xuất" onPress={() => Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập để xem lịch tập.', [{ text: 'Ở lại' }, { text: 'Đăng xuất', onPress: () => void signOut() }])} />
    </>}
  </Page>;
}
