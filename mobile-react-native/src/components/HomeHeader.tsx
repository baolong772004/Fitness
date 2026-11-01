import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aura } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { useDrawer } from '../lib/drawerContext';

export function HomeHeader() {
  const insets = useSafeAreaInsets();
  const { user, unreadChatCount } = useAuth();
  const { openDrawer } = useDrawer();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* 1. Nút 3 dấu gạch ngang (thay thế cho icon user trước đây) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở menu danh mục"
        onPress={openDrawer}
        hitSlop={12}
        style={styles.actionBtn}
      >
        <Ionicons name="menu" size={26} color={aura.darkCoffee} />
      </Pressable>

      {/* 2. Tiêu đề ứng dụng 'Aura Fitness' thay vì tên người dùng */}
      <View style={styles.titleWrapper}>
        <Text style={styles.appTitle}>Aura Fitness</Text>
      </View>

      {/* 3. Button chat ghim tại vị trí top-right (nút thông báo đã xóa đi) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở tin nhắn PT"
        onPress={() => router.push(user ? '/pt-chat' : '/auth')}
        hitSlop={12}
        style={styles.actionBtn}
      >
        <Ionicons name="chatbubbles-outline" size={24} color={aura.darkCoffee} />
        {unreadChatCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: aura.white,
    paddingBottom: 11,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Không bo tròn góc ở phân vùng, chỉ có 1 đường kẻ ngang hết màn hình chia ra
    borderBottomWidth: 1,
    borderBottomColor: '#EAD8C7',
    zIndex: 99,
  },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: aura.darkCoffee,
    letterSpacing: 0.5,
  },
  unreadBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#D43030',
    paddingHorizontal: 4,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: aura.white,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});

