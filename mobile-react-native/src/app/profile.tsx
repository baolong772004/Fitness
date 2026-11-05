import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dateLabel, money } from '../lib/theme';
import { Button, Card, Page, Section } from '../components/ui';

export default function ProfileScreen({ embedded = false }: { embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user, refreshSession, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState<any>(user);

  const roleStr = String(user?.role || '').toUpperCase().trim();
  const isCoach = roleStr === 'COACH' || roleStr === 'TRAINER' || roleStr === 'PT' || roleStr === 'HLV';

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.myProfile();
      if (res?.data) {
        setProfileData(res.data);
      }
    } catch {
      // Fallback to auth user
      setProfileData(user);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void refreshSession?.();
    }, [loadProfile, refreshSession])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshSession?.(),
        loadProfile(),
        new Promise(resolve => setTimeout(resolve, 500)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession, loadProfile]);

  const p = profileData || user;

  const heightVal = p?.height ? Number(p.height) : null;
  const weightVal = p?.weight ? Number(p.weight) : null;
  const bmiVal = heightVal && weightVal ? (weightVal / ((heightVal / 100) ** 2)).toFixed(1) : null;

  const bmiCategory = () => {
    if (!bmiVal) return null;
    const num = Number(bmiVal);
    if (num < 18.5) return { label: 'Thiếu cân', color: '#D27C2C' };
    if (num < 25) return { label: 'Thể trạng chuẩn ✓', color: '#1B8755' };
    if (num < 30) return { label: 'Thừa cân nhẹ', color: '#B26B00' };
    return { label: 'Cần giảm cân', color: '#C93B2B' };
  };

  const bmiInfo = bmiCategory();

  const handleSignOut = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất tài khoản?',
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
      ]
    );
  };

  if (!user) {
    return (
      <Page refresh={onRefresh} refreshing={refreshing}>
        <View style={{ paddingTop: insets.top + 20, alignItems: 'center', paddingHorizontal: 20 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#F0E6DD',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="person-outline" size={40} color={aura.muted} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: aura.darkCoffee, marginBottom: 8 }}>
            Chưa đăng nhập
          </Text>
          <Text style={{ fontSize: 13, color: aura.muted, textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
            Vui lòng đăng nhập hoặc tạo tài khoản để xem và quản lý hồ sơ của bạn tại Aura Fitness.
          </Text>
          <View style={{ width: '100%', gap: 10 }}>
            <Button title="Đăng nhập" onPress={() => router.push('/auth')} />
            <Button secondary title="Đăng ký tài khoản" onPress={() => router.push('/auth?register=1')} />
          </View>
        </View>
      </Page>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: aura.cream }}>
      {/* Top Header nếu không phải embedded */}
      {!embedded && (
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            paddingHorizontal: 16,
            backgroundColor: aura.white,
            borderBottomWidth: 1,
            borderBottomColor: '#EAD8C7',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)');
            }}
            hitSlop={12}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#F4ECE4',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#E8D4C2',
            }}
          >
            <Ionicons name="chevron-back" size={20} color={aura.darkCoffee} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '900', color: aura.darkCoffee }}>
            Hồ sơ cá nhân
          </Text>
          <View style={{ width: 36 }} />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 28,
          gap: 16,
        }}
      >
        {/* Profile Card Banner */}
        <LinearGradient
          colors={[aura.espresso, aura.darkCoffee]}
          style={styles.heroCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            <View style={styles.avatarLarge}>
              {p?.avatar ? (
                <Image source={{ uri: p.avatar }} style={styles.avatarLargeImage} />
              ) : (
                <Text style={styles.avatarLargeInitial}>
                  {p?.fullName?.trim().charAt(0).toUpperCase() || 'A'}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.heroName}>
                {p?.fullName}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>
                    {isCoach ? 'HUẤN LUYỆN VIÊN (PT)' : 'HỘI VIÊN CHÍNH THỨC'}
                  </Text>
                </View>
                <View style={styles.idTag}>
                  <Text style={styles.idTagText}>ID: #{p?.id}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.heroEmail}>
                {p?.email}
              </Text>
            </View>
          </View>

          {/* Button Chỉnh sửa hồ sơ - Đặt nổi bật ngay dưới thông tin chính */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa thông tin hồ sơ"
            onPress={() => router.push('/profile-edit')}
            style={({ pressed }) => [
              styles.editProfileBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="create-outline" size={18} color={aura.darkCoffee} />
            <Text style={styles.editProfileBtnText}>Chỉnh sửa hồ sơ</Text>
          </Pressable>
        </LinearGradient>

        {/* 1. Nhóm Thông tin cá nhân */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="person-circle-outline" size={20} color={aura.darkCoffee} />
            <Text style={styles.cardHeaderTitle}>Thông tin cá nhân</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Họ và tên</Text>
            <Text style={styles.fieldValue}>{p?.fullName || '—'}</Text>
          </View>
          <View style={styles.fieldDivider} />

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Số điện thoại</Text>
            <Text style={styles.fieldValue}>{p?.phone || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.fieldDivider} />

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Giới tính</Text>
            <Text style={styles.fieldValue}>
              {p?.gender === 'MALE' ? 'Nam' : p?.gender === 'FEMALE' ? 'Nữ' : p?.gender === 'OTHER' ? 'Khác' : p?.gender || 'Chưa cập nhật'}
            </Text>
          </View>
          <View style={styles.fieldDivider} />

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Ngày sinh</Text>
            <Text style={styles.fieldValue}>
              {p?.dateOfBirth ? dateLabel(p.dateOfBirth) : 'Chưa cập nhật'}
            </Text>
          </View>
          <View style={styles.fieldDivider} />

          {/* Email: Không thể sửa */}
          <View style={styles.fieldRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.fieldLabel}>Email đăng nhập</Text>
              <Ionicons name="lock-closed" size={13} color={aura.muted} />
            </View>
            <Text style={[styles.fieldValue, { color: aura.muted }]}>{p?.email}</Text>
          </View>
          <Text style={styles.fieldNote}>
            🔒 Email liên kết với tài khoản bảo mật, không thể thay đổi trực tiếp.
          </Text>
        </View>

        {/* 2. Nhóm Chỉ số thể trạng & BMI */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="body-outline" size={20} color={aura.darkCoffee} />
            <Text style={styles.cardHeaderTitle}>Chỉ số thể hình & Thể trạng</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>CHIỀU CAO</Text>
              <Text style={styles.metricVal}>
                {heightVal ? `${heightVal} cm` : '—'}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>CÂN NẶNG</Text>
              <Text style={styles.metricVal}>
                {weightVal ? `${weightVal} kg` : '—'}
              </Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: '#FDF6ED' }]}>
              <Text style={[styles.metricLabel, { color: aura.caramel }]}>CHỈ SỐ BMI</Text>
              <Text style={[styles.metricVal, { color: aura.darkCoffee }]}>
                {bmiVal || '—'}
              </Text>
              {bmiInfo && (
                <Text style={{ fontSize: 10, fontWeight: '700', color: bmiInfo.color, marginTop: 2 }}>
                  {bmiInfo.label}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 3. Nhóm Tài khoản & Phân quyền */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={aura.darkCoffee} />
            <Text style={styles.cardHeaderTitle}>Tài khoản & Quyền hạn</Text>
          </View>

          <View style={styles.fieldRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.fieldLabel}>Vai trò hệ thống</Text>
              <Ionicons name="lock-closed" size={13} color={aura.muted} />
            </View>
            <Text style={styles.fieldValue}>
              {isCoach ? 'Huấn luyện viên (PT)' : 'Hội viên Aura'}
            </Text>
          </View>
          <View style={styles.fieldDivider} />

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Trạng thái tài khoản</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2E7D32' }} />
              <Text style={[styles.fieldValue, { color: '#2E7D32' }]}>
                {p?.status === 'ACTIVE' ? 'Đang hoạt động' : p?.status || 'Hoạt động'}
              </Text>
            </View>
          </View>
          <View style={styles.fieldDivider} />

          {!isCoach && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Số dư tài khoản</Text>
              <Text style={[styles.fieldValue, { fontWeight: '900', color: aura.darkCoffee }]}>
                {p?.balance != null ? money(p.balance) : '0 ₫'}
              </Text>
            </View>
          )}
        </View>

        {/* 4. Hành động Bảo mật */}
        <View style={{ gap: 10, marginTop: 4 }}>
          <Button
            secondary
            title="Đổi mật khẩu tài khoản"
            icon="key-outline"
            onPress={() => router.push('/change-password')}
          />
          <Button
            secondary
            title="Đăng xuất tài khoản"
            icon="log-out-outline"
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: aura.caramel,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD6B4',
    overflow: 'hidden',
  },
  avatarLargeImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarLargeInitial: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },
  heroName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  roleTag: {
    backgroundColor: '#FFFFFF22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTagText: {
    color: '#FFD6B4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  idTag: {
    backgroundColor: '#FFFFFF16',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  idTagText: {
    color: '#E8D8CF',
    fontSize: 10,
    fontWeight: '700',
  },
  heroEmail: {
    color: '#E8D8CF',
    fontSize: 12,
    marginTop: 4,
  },
  editProfileBtn: {
    backgroundColor: '#FFD6B4',
    borderRadius: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editProfileBtnText: {
    color: aura.darkCoffee,
    fontSize: 14,
    fontWeight: '900',
  },
  infoCard: {
    backgroundColor: aura.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D4C2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: aura.darkCoffee,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: aura.muted,
  },
  fieldValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: aura.ink,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#F5ECE3',
  },
  fieldNote: {
    fontSize: 11,
    color: aura.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F7F2EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D4C2',
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: aura.muted,
    letterSpacing: 0.5,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '900',
    color: aura.ink,
    marginTop: 3,
  },
});

