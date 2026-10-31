import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { isLoaded } from 'expo-font';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { aura } from '../lib/theme';
import { AuraLoader } from '../components/AuraLoader';
import { loadIconFonts } from '../lib/iconFonts';

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(() => isLoaded('ionicons'));
  const [fontError, setFontError] = useState(false);
  const [fontAttempt, setFontAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadIconFonts().then(() => {
      if (active) setFontsReady(true);
    }).catch(error => {
      if (__DEV__) console.warn('Unable to load icon font:', error);
      if (active) setFontError(true);
    });
    return () => { active = false; };
  }, [fontAttempt]);

  // Do not mount icons (including AuraLoader) until their shared font is ready.
  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: aura.cream, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <StatusBar style="dark" />
      {fontError ? <>
        <Text style={{ color: aura.ink, textAlign: 'center' }}>Không thể tải phông chữ. Kiểm tra kết nối và thử lại.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setFontError(false); setFontAttempt(attempt => attempt + 1); }} style={{ backgroundColor: aura.darkCoffee, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Thử lại</Text>
        </Pressable>
      </> : <ActivityIndicator size="large" color={aura.darkCoffee} />}
    </View>;
  }
  return <AuthProvider><RootNavigation /></AuthProvider>;
}

function RootNavigation() {
  const pathname = usePathname();
  const { ready, user } = useAuth();
  useEffect(() => {
    if (ready && user?.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password');
    }
  }, [pathname, ready, user?.mustChangePassword]);

  useEffect(() => {
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      const isHome = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
      if (!isHome) {
        router.replace('/(tabs)');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [pathname]);
  const lightTab = ['/booking', '/notifications', '/(tabs)/booking', '/(tabs)/notifications'].includes(pathname);
  return <View style={{ flex: 1 }}><StatusBar style={lightTab ? 'dark' : 'light'} /><Stack screenOptions={{ headerStyle: { backgroundColor: aura.espresso }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: aura.cream } }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="auth" options={{ title: 'Đăng nhập' }} />
    <Stack.Screen name="forgot-password" options={{ title: 'Khôi phục mật khẩu' }} />
    <Stack.Screen name="packages" options={{ title: 'Gói tập Aura' }} />
    <Stack.Screen name="subscriptions" options={{ title: 'Gói tập của tôi' }} />
    <Stack.Screen name="classes" options={{ title: 'Workout Class' }} />
    <Stack.Screen name="pt" options={{ title: 'Lịch tập cùng PT' }} />
    <Stack.Screen name="pt-purchase" options={{ title: 'Mua PT' }} />
    <Stack.Screen name="coach-availability" options={{ title: 'Đăng ký lịch Coach' }} />
    <Stack.Screen name="pt-book" options={{ title: 'Đặt lịch PT' }} />
    <Stack.Screen name="pt-renew" options={{ title: 'Gia hạn thời gian PT' }} />
    <Stack.Screen name="pt-chat" options={{ title: 'Tin nhắn PT' }} />
    <Stack.Screen name="pt-qr" options={{ title: 'QR buổi tập PT' }} />
    <Stack.Screen name="scanner" options={{ title: 'Quét mã QR' }} />
    <Stack.Screen name="checkout" options={{ title: 'Thanh toán PayOS' }} />
    <Stack.Screen name="progress" options={{ title: 'Tiến độ tập luyện' }} />
    <Stack.Screen name="exercise-analysis" options={{ title: 'Kiểm tra kỹ thuật AI' }} />
    <Stack.Screen name="history" options={{ title: 'Lịch sử điểm danh' }} />
    <Stack.Screen name="change-password" options={{ title: 'Đổi mật khẩu', headerBackVisible: !user?.mustChangePassword, gestureEnabled: !user?.mustChangePassword }} />
    <Stack.Screen name="article" options={{ headerShown: false }} />
    <Stack.Screen name="articles" options={{ title: 'Tin tức & hướng dẫn' }} />
    <Stack.Screen name="payment-history" options={{ title: 'Lịch sử thanh toán' }} />
    <Stack.Screen name="booking-history" options={{ title: 'Lịch sử đặt lịch' }} />
    <Stack.Screen name="rate-session" options={{ title: 'Đánh giá buổi tập' }} />
    <Stack.Screen name="support" options={{ title: 'Hỗ trợ & Liên hệ' }} />
    <Stack.Screen name="settings" options={{ title: 'Cài đặt' }} />
    <Stack.Screen name="profile-edit" options={{ title: 'Chỉnh sửa hồ sơ' }} />
  </Stack>{!ready && <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: aura.cream, alignItems: 'center', justifyContent: 'center' }}><AuraLoader size={68} /></View>}</View>;
}
