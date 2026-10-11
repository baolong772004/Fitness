import React, { useEffect } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aura } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

const items: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { title: 'Trang chủ', icon: 'home' }, booking: { title: 'Đặt lịch', icon: 'calendar' },
  notifications: { title: 'Hộp thư', icon: 'notifications' }, account: { title: 'Tài khoản', icon: 'person' },
};

export default function TabLayout() {
  const { user, unreadCount, refreshUnreadCount } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  useEffect(() => { if (!user) return; const timer = setInterval(() => void refreshUnreadCount(), 30000); return () => clearInterval(timer); }, [user, refreshUnreadCount]);
  return <View style={{ flex: 1 }}><Tabs screenOptions={{ headerShown: false }} tabBar={({ state, navigation }) => {
    const open = (route: typeof state.routes[number]) => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!event.defaultPrevented) navigation.navigate(route.name);
      if (route.name === 'notifications') void refreshUnreadCount();
    };
    const qrRoute = state.routes.find(route => route.name === 'qr');
    const renderItem = (name: string) => {
      const route = state.routes.find(row => row.name === name); if (!route) return null;
      const active = state.routes[state.index]?.name === name;
      return <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => open(route)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <View><Ionicons name={items[name].icon} size={22} color={active ? '#fff' : '#FFFFFFB6'} />{name === 'notifications' && unreadCount > 0 && <View style={{ position: 'absolute', top: -5, right: -13, backgroundColor: '#D43030', paddingHorizontal: 4, minWidth: 17, height: 16, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 9 }}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}</View>
        <Text style={{ color: active ? '#fff' : '#FFFFFFB6', fontSize: 10, fontWeight: active ? '900' : '600' }}>{items[name].title}</Text>
      </Pressable>;
    };
    return <View style={{ height: 68 + insets.bottom, backgroundColor: aura.darkCoffee, paddingBottom: insets.bottom, flexDirection: 'row', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'visible' }}>
      {renderItem('index')}{renderItem('booking')}
      <View style={{ flex: 1 }} />
      {renderItem('notifications')}{renderItem('account')}
      {qrRoute && <Pressable accessibilityRole="tab" accessibilityLabel="Mở mã QR hội viên" accessibilityState={{ selected: state.routes[state.index]?.name === 'qr' }} onPress={() => open(qrRoute)} style={{ position: 'absolute', left: '50%', top: -20, transform: [{ translateX: -32 }], width: 64, height: 64, borderRadius: 32, backgroundColor: aura.darkCoffee, borderWidth: 4, borderColor: aura.white, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: .2, shadowRadius: 8 }}><Ionicons name="qr-code" size={29} color="#fff" /></Pressable>}
    </View>;
  }}>
    <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
    <Tabs.Screen name="booking" options={{ title: 'Đặt lịch' }} />
    <Tabs.Screen name="qr" options={{ title: 'QR' }} />
    <Tabs.Screen name="notifications" options={{ title: 'Hộp thư' }} />
    <Tabs.Screen name="account" options={{ title: 'Tài khoản' }} />
  </Tabs>{!pathname.endsWith('/qr') && <Pressable accessibilityLabel="Hỗ trợ Aura Fitness" onPress={() => Alert.alert('Hỗ trợ Aura Fitness', 'Liên hệ hotline 1900 1234 hoặc quầy lễ tân để được hỗ trợ.')} style={{ position: 'absolute', right: 20, bottom: 86 + insets.bottom, width: 47, height: 47, borderRadius: 24, backgroundColor: aura.white, borderWidth: 3, borderColor: aura.darkCoffee, alignItems: 'center', justifyContent: 'center', elevation: 7, shadowColor: '#000', shadowOpacity: .22, shadowRadius: 8 }}><Ionicons name="mail-unread-outline" size={22} color={aura.darkCoffee} /></Pressable>}</View>;
}
