import React, { useEffect, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aura } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { DrawerProvider, useDrawer, DRAWER_WIDTH } from '../../lib/drawerContext';
import { HomeDrawer } from '../../components/HomeDrawer';

const memberItems: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { title: 'Trang chủ', icon: 'home' },
  booking: { title: 'Đặt lịch', icon: 'calendar' },
  qr: { title: 'Mã QR', icon: 'qr-code' },
  notifications: { title: 'Thông báo', icon: 'notifications' },
  account: { title: 'Tài khoản', icon: 'person' },
};

const coachItems: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { title: 'Lịch dạy', icon: 'calendar' },
  booking: { title: 'Lịch tuần', icon: 'calendar-outline' },
  qr: { title: 'Quét QR', icon: 'qr-code' },
  notifications: { title: 'Thông báo', icon: 'notifications' },
  account: { title: 'Tài khoản', icon: 'person' },
};

function TabLayoutContent() {
  const { user, unreadCount, unreadChatCount, refreshUnreadCount, refreshUnreadChatCount } = useAuth();
  const { isDrawerOpen, openDrawer, closeDrawer, drawerAnim } = useDrawer();
  const roleStr = String(user?.role || '').toUpperCase().trim();
  const isCoach = roleStr === 'COACH' || roleStr === 'TRAINER' || roleStr === 'PT' || roleStr === 'HLV';
  const items = isCoach ? coachItems : memberItems;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const isHome = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname === '/(tabs)/index';

  const isDrawerOpenRef = useRef(isDrawerOpen);
  isDrawerOpenRef.current = isDrawerOpen;

  const isHomeRef = useRef(isHome);
  isHomeRef.current = isHome;

  // Hiệu ứng gesture hai chiều:
  // 1. Khi drawer đang mở: Lướt từ phải qua trái ở BẤT KỲ ĐÂU trên toàn màn hình để đóng drawer và về Home
  // 2. Khi ở trang Home: Kéo từ mép trái qua phải (x0 < 80, dx > 15) để mở lướt ra drawer
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        // Lướt từ phải sang trái toàn màn hình khi drawer mở
        if (isDrawerOpenRef.current && gesture.dx < -10 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          return true;
        }
        // Kéo từ mép trái sang phải khi ở Home
        if (!isDrawerOpenRef.current && isHomeRef.current && gesture.x0 < 80 && gesture.dx > 15 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isDrawerOpenRef.current && gesture.dx < -10 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          return true;
        }
        if (!isDrawerOpenRef.current && isHomeRef.current && gesture.x0 < 80 && gesture.dx > 15 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          return true;
        }
        return false;
      },
      onPanResponderRelease: (_, gesture) => {
        if (isDrawerOpenRef.current) {
          if (gesture.dx < -20 || gesture.vx < -0.2) {
            closeDrawer();
          }
        } else if (isHomeRef.current) {
          if ((gesture.dx > 25 || gesture.vx > 0.2) && gesture.x0 < 100) {
            openDrawer();
          }
        }
      },
      onPanResponderTerminate: (_, gesture) => {
        if (isDrawerOpenRef.current) {
          if (gesture.dx < -20 || gesture.vx < -0.2) {
            closeDrawer();
          }
        } else if (isHomeRef.current) {
          if ((gesture.dx > 25 || gesture.vx > 0.2) && gesture.x0 < 100) {
            openDrawer();
          }
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!user) return;
    void refreshUnreadChatCount();
    const timer = setInterval(() => {
      void refreshUnreadCount();
      void refreshUnreadChatCount();
    }, 20000);
    return () => clearInterval(timer);
  }, [user, refreshUnreadCount, refreshUnreadChatCount]);

  return (
    <View
      style={{ flex: 1, backgroundColor: aura.espresso, overflow: 'hidden' }}
      {...panResponder.panHandlers}
    >
      {/* 1. Thanh navbar dọc (Drawer) chiếm 80% màn hình tính từ trái qua */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: DRAWER_WIDTH,
          zIndex: 10,
          transform: [
            {
              translateX: drawerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-DRAWER_WIDTH, 0],
              }),
            },
          ],
        }}
      >
        <HomeDrawer />
      </Animated.View>

      {/* 2. Main content: Home và thanh navbar ngang, khi drawer mở sẽ được đẩy sang phải 80%, 20% còn lại vẫn hiển thị */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: aura.cream,
          transform: [
            {
              translateX: drawerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, DRAWER_WIDTH],
              }),
            },
          ],
        }}
      >
        <Tabs
          backBehavior="initialRoute"
          screenOptions={{ headerShown: false }}
          tabBar={({ state, emitter, navigateToTab }) => {
            const open = (route: typeof state.routes[number]) => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented && state.routes[state.index]?.key !== route.key) navigateToTab(route.key);
              if (route.name === 'notifications') void refreshUnreadCount();
            };
            const renderItem = (name: string) => {
              const route = state.routes.find(row => row.name === name);
              if (!route) return null;
              const active = state.routes[state.index]?.name === name;
              const itemInfo = items[name] || { title: name, icon: 'square' as const };
              return (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => open(route)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
                >
                  <View>
                    <Ionicons name={itemInfo.icon} size={22} color={active ? '#fff' : '#FFFFFF95'} />
                    {name === 'notifications' && unreadCount > 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -5,
                          right: -13,
                          backgroundColor: '#D43030',
                          paddingHorizontal: 4,
                          minWidth: 17,
                          height: 16,
                          borderRadius: 9,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 9 }}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: active ? '#fff' : '#FFFFFF95', fontSize: 10, fontWeight: active ? '900' : '600' }}>
                    {itemInfo.title}
                  </Text>
                </Pressable>
              );
            };

            const qrRoute = state.routes.find(route => route.name === 'qr');
            const isQrActive = state.routes[state.index]?.name === 'qr';

            // Navbar ngang 1 màu duy nhất (aura.espresso), giữ lại thiết kế nút tròn QR ban đầu
            return (
              <View
                style={{
                  height: 64 + insets.bottom,
                  backgroundColor: aura.espresso,
                  paddingBottom: insets.bottom,
                  paddingTop: 6,
                  flexDirection: 'row',
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255, 255, 255, 0.08)',
                  overflow: 'visible',
                }}
              >
                {renderItem('index')}
                {renderItem('booking')}
                <View style={{ flex: 1 }} />
                {renderItem('notifications')}
                {renderItem('account')}

                {qrRoute && (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel={isCoach ? 'Quét QR' : 'Mở mã QR hội viên'}
                    accessibilityState={{ selected: isQrActive }}
                    onPress={() => open(qrRoute)}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -18,
                      transform: [{ translateX: -30 }],
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      backgroundColor: aura.espresso,
                      borderWidth: 4,
                      borderColor: aura.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                      elevation: 8,
                      shadowColor: '#000',
                      shadowOpacity: 0.22,
                      shadowRadius: 8,
                    }}
                  >
                    <Ionicons name="qr-code" size={27} color="#fff" />
                  </Pressable>
                )}
              </View>
            );
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
          <Tabs.Screen name="booking" options={{ title: 'Đặt lịch' }} />
          <Tabs.Screen name="qr" options={{ title: 'QR' }} />
          <Tabs.Screen name="notifications" options={{ title: 'Thông báo' }} />
          <Tabs.Screen name="account" options={{ title: 'Tài khoản' }} />
        </Tabs>

        {/* Nút chat nổi ở góc dưới: Chỉ hiện khi KHÔNG ở trang Home và KHÔNG ở QR */}
        {!pathname.endsWith('/qr') && !isHome && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở tin nhắn PT"
            onPress={() => router.push(user ? '/pt-chat' : '/auth')}
            style={{
              position: 'absolute',
              right: 20,
              bottom: 74 + insets.bottom,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: aura.white,
              borderWidth: 3,
              borderColor: aura.darkCoffee,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 8,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 8,
            }}
          >
            <Ionicons name="chatbubbles-outline" size={23} color={aura.darkCoffee} />
            {unreadChatCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#D43030',
                  paddingHorizontal: 4,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#fff',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 9 }}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {/* Backdrop che phần màn hình Home/navbar ngang khi drawer mở, bấm vào để đóng drawer */}
        {isDrawerOpen && (
          <Pressable
            onPress={closeDrawer}
            accessibilityLabel="Đóng thanh điều hướng"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              zIndex: 99,
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <DrawerProvider>
      <TabLayoutContent />
    </DrawerProvider>
  );
}
