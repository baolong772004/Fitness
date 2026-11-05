import React from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Page, Button } from '../components/ui';
import { articles } from '../lib/articles';
import { aura } from '../lib/theme';

const fallbackSteps = [
  'Đọc thông tin và chọn nội dung phù hợp với mục tiêu của bạn.',
  'Chuẩn bị lịch tập, tài khoản và các vật dụng cần thiết.',
  'Liên hệ nhân viên AURA nếu bạn cần được hướng dẫn thêm.',
];
const steps: Record<string, string[]> = {
  booking: ['Mở mục Đặt lịch và chọn ngày bạn muốn tham gia.', 'Xem giờ học, huấn luyện viên và số chỗ còn lại của lớp.', 'Nhấn Đặt chỗ, sau đó kiểm tra trạng thái trong Lịch đã đặt.'],
  checkin: ['Đăng nhập tài khoản hội viên trước khi đến câu lạc bộ.', 'Mở mã QR hội viên trong ứng dụng và đưa cho nhân viên quét.', 'Kiểm tra thông báo xác nhận sau khi hệ thống ghi nhận lượt vào.'],
  support: ['Mở phần hỗ trợ trong ứng dụng hoặc đến quầy lễ tân.', 'Chuẩn bị email hoặc số điện thoại dùng cho tài khoản hội viên.', 'Mô tả vấn đề và thời điểm xảy ra để đội ngũ kiểm tra nhanh hơn.'],
};

export default function Article() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = articles.find(row => row.id === id) || articles[0];
  const articleSteps = steps[item.id] || fallbackSteps;
  const overlay = <LinearGradient colors={['#24100A33', '#32150CEB']} style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 22, paddingBottom: 42 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1, backgroundColor: aura.caramel, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' }}>{item.category}</Text><Text style={{ color: '#fff', fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 10 }}>{item.title}</Text></LinearGradient>;
  return <Page style={{ backgroundColor: aura.cream }}>
    <View style={{ height: 245, marginHorizontal: -16, marginTop: -16, backgroundColor: aura.darkCoffee }}>
      {item.image ? <ImageBackground source={item.image} style={{ flex: 1 }}>{overlay}</ImageBackground> : <LinearGradient colors={[aura.coffee, aura.espresso]} style={{ flex: 1 }}>{overlay}</LinearGradient>}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        hitSlop={12}
        style={{
          position: 'absolute',
          top: insets.top + 10,
          left: 14,
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: '#0007',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={20} color="#fff" />
      </Pressable>
    </View>
    <View style={{ backgroundColor: aura.cream, borderTopLeftRadius: 29, borderTopRightRadius: 29, marginTop: -39, padding: 20, marginHorizontal: -16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: aura.caramel, backgroundColor: '#F0DFD5', fontSize: 10, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 }}>{item.category}</Text><Text style={{ color: aura.muted, fontSize: 11 }}>◷  Đọc 3 phút</Text></View>
      <Text style={{ color: aura.darkCoffee, fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 16 }}>{item.title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}><View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: aura.darkCoffee, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="barbell-outline" size={17} color="#fff" /></View><View><Text style={{ color: aura.ink, fontSize: 12, fontWeight: '900' }}>Aura Fitness Team</Text><Text style={{ color: aura.muted, fontSize: 10 }}>Đăng hôm nay</Text></View></View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22, backgroundColor: '#fff', padding: 15, borderWidth: 1, borderColor: aura.border, borderRadius: 16 }}><Ionicons name="chatbox-ellipses-outline" size={23} color={aura.caramel} /><Text style={{ flex: 1, color: aura.darkCoffee, fontSize: 15, fontWeight: '700', lineHeight: 23 }}>{item.summary}</Text></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 26 }}><Ionicons name="document-text-outline" size={22} color={aura.caramel} /><Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 12, letterSpacing: .7 }}>NỘI DUNG BÀI VIẾT</Text></View>
      <Text style={{ color: aura.ink, backgroundColor: '#FFFBF6', borderColor: aura.border, borderWidth: 1, borderRadius: 16, padding: 17, fontSize: 15, lineHeight: 27, marginTop: 12 }}>{item.body.replaceAll('. ', '.\n\n')}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 }}><Text style={{ color: aura.darkCoffee, fontWeight: '900', fontSize: 12, letterSpacing: .7 }}>LÀM THEO TỪNG BƯỚC</Text><Text style={{ color: aura.muted, fontSize: 11 }}>{articleSteps.length} bước</Text></View>
      {articleSteps.map((step, index) => <View key={index} style={{ flexDirection: 'row', gap: 11, padding: 13, borderRadius: 14, borderColor: aura.border, borderWidth: 1, backgroundColor: '#fff', marginTop: 9 }}><View style={{ width: 27, height: 27, borderRadius: 9, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: aura.darkCoffee, fontWeight: '900' }}>{index + 1}</Text></View><Text style={{ flex: 1, color: aura.ink, fontSize: 12, lineHeight: 19 }}>{step}</Text></View>)}
      <View style={{ flexDirection: 'row', gap: 10, padding: 15, backgroundColor: aura.darkCoffee, borderRadius: 16, marginTop: 19 }}><Ionicons name="bulb-outline" size={20} color="#E5B18E" /><Text style={{ flex: 1, color: '#fff', fontSize: 12, lineHeight: 19 }}>Mẹo nhỏ: Bạn có thể mở lại tài liệu này bất cứ lúc nào trong mục Tin tức và hướng dẫn trên trang chủ.</Text></View>
      <View style={{ marginTop: 35 }}><Button title="QUAY LẠI TRANG TRƯỚC" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} /></View>
    </View>
  </Page>;
}
