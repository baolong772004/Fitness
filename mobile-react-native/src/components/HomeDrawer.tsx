import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { aura } from '../lib/theme';
import { DRAWER_WIDTH, useDrawer } from '../lib/drawerContext';

type MenuItem = {
  title: string;
  onPress: () => void;
};

type MenuSection = {
  category: string;
  items: MenuItem[];
};

export function HomeDrawer() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { closeDrawer } = useDrawer();

  const roleStr = String(user?.role || '').toUpperCase().trim();
  const isCoach = roleStr === 'COACH' || roleStr === 'TRAINER' || roleStr === 'PT' || roleStr === 'HLV';

  const navigateTo = (path: string, params?: Record<string, string>) => {
    closeDrawer();
    if (params) {
      router.push({ pathname: path as any, params });
    } else {
      router.push(path as any);
    }
  };

  const handleSignOut = () => {
    closeDrawer();
    Alert.alert(
      'Đăng xuất',
      isCoach ? 'Bạn có chắc chắn muốn đăng xuất tài khoản HLV?' : 'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
      ]
    );
  };

  // Các nhóm chức năng từ mục 'Tài khoản'
  const sections: MenuSection[] = !user
    ? [
        {
          category: 'Tài khoản',
          items: [
            { title: 'Đăng nhập', onPress: () => navigateTo('/auth') },
            { title: 'Đăng ký tài khoản', onPress: () => navigateTo('/auth', { register: '1' }) },
          ],
        },
      ]
    : isCoach
    ? [
        {
          category: 'Nghiệp vụ huấn luyện',
          items: [
            { title: 'Đăng ký ca rảnh', onPress: () => navigateTo('/coach-availability') },
            { title: 'Tin nhắn học viên PT', onPress: () => navigateTo('/pt-chat') },
            { title: 'Kiểm tra kỹ thuật AI (Pose)', onPress: () => navigateTo('/exercise-analysis') },
            { title: 'Lịch sử ca dạy & điểm danh', onPress: () => navigateTo('/history') },
          ],
        },
        {
          category: 'Tài khoản & Tiện ích',
          items: [
            { title: 'Hộp thư thông báo', onPress: () => navigateTo('/(tabs)/notifications') },
            { title: 'Thông tin HLV', onPress: () => navigateTo('/(tabs)/account') },
            { title: 'Đổi mật khẩu', onPress: () => navigateTo('/change-password') },
            { title: 'Đăng xuất', onPress: handleSignOut },
          ],
        },
      ]
    : [
        {
          category: 'Ưu đãi & Hướng dẫn',
          items: [
            { title: 'Ưu đãi hội viên', onPress: () => navigateTo('/article', { id: 'rewards' }) },
            { title: 'Hướng dẫn sử dụng', onPress: () => navigateTo('/article', { id: 'booking' }) },
            {
              title: 'Liên hệ Aura Fitness',
              onPress: () => {
                closeDrawer();
                Alert.alert('Liên hệ Aura Fitness', 'Hotline hỗ trợ: 1900 1234\nHoặc liên hệ trực tiếp quầy lễ tân.');
              },
            },
            {
              title: 'Hợp đồng hội viên',
              onPress: () => {
                closeDrawer();
                Alert.alert('Hợp đồng hội viên', 'Thông tin hợp đồng hiện chưa được đồng bộ vào ứng dụng. Vui lòng liên hệ quầy lễ tân.');
              },
            },
          ],
        },
        {
          category: 'Lịch & tiến độ',
          items: [
            { title: 'Gói tập của tôi', onPress: () => navigateTo('/subscriptions') },
            { title: 'Lịch tập PT', onPress: () => navigateTo('/pt') },
            { title: 'Tiến độ tập luyện', onPress: () => navigateTo('/progress') },
            { title: 'Giáo án & Dinh dưỡng', onPress: () => navigateTo('/progress', { plansOnly: '1' }) },
            { title: 'Lịch sử điểm danh', onPress: () => navigateTo('/history') },
          ],
        },
        {
          category: 'Tiện ích & Cài đặt',
          items: [
            { title: 'Hộp thư thông báo', onPress: () => navigateTo('/(tabs)/notifications') },
            { title: 'Bổ sung hồ sơ', onPress: () => navigateTo('/(tabs)/account') },
            {
              title: 'Đổi ngôn ngữ',
              onPress: () => {
                closeDrawer();
                Alert.alert('Ngôn ngữ', 'Ứng dụng hiện đang sử dụng tiếng Việt tiêu chuẩn.');
              },
            },
            { title: 'Cài đặt đăng nhập', onPress: () => navigateTo('/change-password') },
            { title: 'Thay mật khẩu', onPress: () => navigateTo('/change-password') },
            {
              title: 'Vô hiệu hóa tài khoản',
              onPress: () => {
                closeDrawer();
                Alert.alert('Vô hiệu hóa tài khoản', 'Vui lòng liên hệ quầy lễ tân Aura Fitness để được hỗ trợ yêu cầu này.');
              },
            },
            { title: 'Đăng xuất', onPress: handleSignOut },
          ],
        },
      ];

  return (
    <View style={[styles.container, { width: DRAWER_WIDTH }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 28,
        }}
      >
        {/* 1. Container phía trên: hình chữ nhật bo tròn 4 góc, chiếm 90% navbar dọc, căn giữa theo chiều ngang */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem hồ sơ cá nhân"
          onPress={() => {
            closeDrawer();
            navigateTo('/(tabs)/account');
          }}
          style={({ pressed }) => [
            styles.profileContainer,
            { backgroundColor: pressed ? '#F8EFE7' : aura.white },
          ]}
        >
          {/* Avatar hình tròn đứng trước tên, căn giữa theo chiều dọc */}
          <View style={styles.avatarCircle}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>
                {user?.fullName?.trim().charAt(0).toUpperCase() || 'A'}
              </Text>
            )}
          </View>

          {/* Tên tài khoản phù hợp (căn giữa theo chiều dọc) */}
          <View style={styles.nameBlock}>
            <Text numberOfLines={1} style={styles.fullNameText}>
              {user?.fullName || 'Khách / Chưa đăng nhập'}
            </Text>
            <Text numberOfLines={1} style={styles.roleSubText}>
              {user ? (isCoach ? 'Huấn luyện viên PT' : 'Hội viên Aura') : 'Bấm để đăng nhập ›'}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={17} color={aura.muted} />
        </Pressable>

        {/* 2. Đường thẳng mờ dần về 2 bên mang màu sắc chủ đạo của project */}
        <LinearGradient
          colors={['rgba(194, 122, 78, 0)', 'rgba(194, 122, 78, 0.85)', 'rgba(194, 122, 78, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.dividerGradient}
        />

        {/* 3. Danh sách function từ mục 'Tài khoản'
            - Không đóng lại vào 1 div
            - Dòng chữ phân loại in đậm và sát mép trái hơn so với các mục
            - Xóa icon
            - Cỡ chữ bằng cỡ chữ ở các mục
        */}
        <View style={styles.menuWrapper}>
          {sections.map((sec, secIdx) => (
            <View key={sec.category} style={styles.sectionBlock}>
              {/* Dòng chữ phân loại: in đậm, sát mép trái hơn, cỡ chữ bằng các mục */}
              <Text style={styles.categoryTitle}>
                {sec.category}
              </Text>

              {/* Các mục con: không icon, thụt vào trong hơn so với tiêu đề phân loại */}
              <View style={styles.itemsBlock}>
                {sec.items.map((item, itemIdx) => (
                  <Pressable
                    key={item.title}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={item.onPress}
                    style={({ pressed }) => [
                      styles.itemRow,
                      pressed && styles.itemRowPressed,
                    ]}
                  >
                    <Text style={styles.itemText}>{item.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCFAF6',
    borderRightWidth: 1,
    borderColor: '#E8D4C2',
  },
  profileContainer: {
    width: '90%',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8D4C2',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: aura.darkCoffee,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    borderWidth: 1.5,
    borderColor: '#E8D4C2',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  nameBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  fullNameText: {
    color: aura.ink,
    fontSize: 15.5,
    fontWeight: '800',
  },
  roleSubText: {
    color: aura.muted,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  dividerGradient: {
    height: 1.5,
    width: '90%',
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  menuWrapper: {
    paddingVertical: 4,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  // Dòng chữ phân loại: in đậm, sát mép trái (paddingLeft 16), cỡ chữ bằng các mục (14px)
  categoryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: aura.darkCoffee,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 6,
    letterSpacing: 0.4,
  },
  itemsBlock: {
    // Không bọc vào khung/div riêng
  },
  // Mục con: thụt lề vào hơn (paddingLeft 30 so với 16), không có icon, cỡ chữ 14px
  itemRow: {
    paddingVertical: 9.5,
    paddingLeft: 30,
    paddingRight: 16,
  },
  itemRowPressed: {
    backgroundColor: 'rgba(194, 122, 78, 0.08)',
  },
  itemText: {
    fontSize: 14,
    fontWeight: '600',
    color: aura.ink,
  },
});

