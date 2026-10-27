import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura } from '../lib/theme';
import { Card, Page, Section, showError } from '../components/ui';

const LANGUAGES = ['Tiếng Việt', 'English'];

function SettingRow({ icon, title, subtitle, trailing, onPress, danger = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13,
        paddingHorizontal: 2, opacity: pressed ? 0.75 : 1,
        borderBottomWidth: 1, borderBottomColor: aura.border,
      })}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: danger ? '#FDEBE9' : aura.latte,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={20} color={danger ? '#B3261E' : aura.darkCoffee} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? '#B3261E' : aura.ink, fontWeight: '700', fontSize: 14 }}>{title}</Text>
        {subtitle && <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={aura.muted} /> : null)}
    </Pressable>
  );
}

function SwitchRow({ icon, title, subtitle, value, onToggle }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: aura.border }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={aura.darkCoffee} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: aura.ink, fontWeight: '700', fontSize: 14 }}>{title}</Text>
        {subtitle && <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: aura.border, true: aura.caramel }}
        thumbColor={value ? aura.darkCoffee : '#f4f3f4'}
      />
    </View>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();

  // Notification prefs
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifReminder, setNotifReminder] = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);

  // Language / Theme
  const [language, setLanguage] = useState('Tiếng Việt');
  const [currentTheme] = useState('Mặc định hệ thống');
  const [showLang, setShowLang] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const result = await api.notificationSettings();
      const s = result.data ?? result;
      if (s.booking !== undefined) setNotifBooking(!!s.booking);
      if (s.payment !== undefined) setNotifPayment(!!s.payment);
      if (s.reminder !== undefined) setNotifReminder(!!s.reminder);
      if (s.promotions !== undefined) setNotifPromo(!!s.promotions);
    } catch { /* use defaults */ }
  }, []);

  useFocusEffect(useCallback(() => { void loadSettings(); }, [loadSettings]));

  const saveNotifSetting = async (key: string, value: boolean) => {
    try {
      await api.updateNotificationSettings({ [key]: value });
    } catch (error) { showError(error); }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Vô hiệu hóa tài khoản',
      'Yêu cầu sẽ được gửi tới nhân viên Aura Fitness. Tài khoản sẽ bị khóa trong 3–5 ngày làm việc.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận yêu cầu',
          style: 'destructive',
          onPress: () => Alert.alert('Đã ghi nhận', 'Vui lòng liên hệ quầy lễ tân hoặc hotline 1900 1234 để hoàn tất yêu cầu.'),
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập để xem lịch tập và gói hội viên.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Page>
      {/* Header */}
      <LinearGradient
        colors={[aura.espresso, aura.darkCoffee]}
        style={{ borderRadius: 22, padding: 20, flexDirection: 'row', gap: 13, alignItems: 'center' }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="settings-outline" size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Cài đặt</Text>
          <Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 3 }}>
            {user?.email ?? 'Chưa đăng nhập'}
          </Text>
        </View>
      </LinearGradient>

      {/* Account */}
      <Section title="Tài khoản" icon="person-outline" />
      <Card style={{ paddingVertical: 4 }}>
        <SettingRow icon="person-outline" title="Hồ sơ cá nhân" subtitle="Tên, số điện thoại, ngày sinh" onPress={() => router.push('/profile-edit')} />
        <SettingRow icon="lock-closed-outline" title="Đổi mật khẩu" subtitle="Cập nhật mật khẩu đăng nhập" onPress={() => router.push('/change-password')} />
        <SettingRow icon="shield-checkmark-outline" title="Bảo mật tài khoản" subtitle="Thiết lập xác thực hai lớp" onPress={() => Alert.alert('Bảo mật', 'Tính năng đang được phát triển.')} />
        <SettingRow icon="card-outline" title="Phương thức thanh toán" subtitle="Quản lý thẻ và ví liên kết" onPress={() => Alert.alert('Thanh toán', 'Thanh toán qua PayOS và chuyển khoản ngân hàng.')} />
      </Card>

      {/* Notifications */}
      <Section title="Thông báo" icon="notifications-outline" />
      <Card style={{ paddingVertical: 4 }}>
        <SwitchRow
          icon="calendar-outline" title="Lịch tập & Đặt chỗ" subtitle="Xác nhận, nhắc nhở buổi tập"
          value={notifBooking} onToggle={v => { setNotifBooking(v); void saveNotifSetting('booking', v); }}
        />
        <SwitchRow
          icon="receipt-outline" title="Thanh toán" subtitle="Biên lai, xác nhận giao dịch"
          value={notifPayment} onToggle={v => { setNotifPayment(v); void saveNotifSetting('payment', v); }}
        />
        <SwitchRow
          icon="alarm-outline" title="Nhắc nhở buổi tập" subtitle="Thông báo trước 1 giờ"
          value={notifReminder} onToggle={v => { setNotifReminder(v); void saveNotifSetting('reminder', v); }}
        />
        <SwitchRow
          icon="megaphone-outline" title="Khuyến mãi & Tin tức" subtitle="Ưu đãi, sự kiện của Aura Fitness"
          value={notifPromo} onToggle={v => { setNotifPromo(v); void saveNotifSetting('promotions', v); }}
        />
      </Card>

      {/* Display */}
      <Section title="Hiển thị" icon="color-palette-outline" />
      <Card style={{ paddingVertical: 4 }}>
        <SettingRow
          icon="language-outline" title="Ngôn ngữ" subtitle={language}
          onPress={() => setShowLang(true)}
          trailing={<Text style={{ color: aura.caramel, fontWeight: '700', fontSize: 13 }}>{language}</Text>}
        />
        <SettingRow
          icon="contrast-outline" title="Giao diện" subtitle={currentTheme}
          onPress={() => Alert.alert('Giao diện', 'Tính năng đang được phát triển trong phiên bản tiếp theo.')}
          trailing={<Text style={{ color: aura.caramel, fontWeight: '700', fontSize: 13 }}>{currentTheme}</Text>}
        />
      </Card>

      {/* Privacy */}
      <Section title="Quyền riêng tư" icon="eye-off-outline" />
      <Card style={{ paddingVertical: 4 }}>
        <SettingRow icon="document-text-outline" title="Điều khoản sử dụng" onPress={() => Alert.alert('Điều khoản', 'Vui lòng truy cập aurafitness.vn/terms để đọc điều khoản đầy đủ.')} />
        <SettingRow icon="shield-outline" title="Chính sách bảo mật" onPress={() => Alert.alert('Bảo mật', 'Vui lòng truy cập aurafitness.vn/privacy để đọc chính sách bảo mật.')} />
        <SettingRow icon="information-circle-outline" title="Về Aura Fitness" subtitle="Phiên bản 1.0.0" onPress={() => Alert.alert('Aura Fitness', 'Phiên bản 1.0.0\n© 2025 Aura Fitness. All rights reserved.')} />
      </Card>

      {/* Danger zone */}
      <Section title="Tài khoản" icon="warning-outline" />
      <Card style={{ paddingVertical: 4 }}>
        <SettingRow icon="log-out-outline" title="Đăng xuất" onPress={handleLogout} danger />
        <SettingRow icon="trash-outline" title="Vô hiệu hóa tài khoản" subtitle="Yêu cầu sẽ được xử lý trong 3–5 ngày" onPress={handleDeleteAccount} danger />
      </Card>

      {/* Language modal */}
      <Modal visible={showLang} transparent animationType="fade" onRequestClose={() => setShowLang(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 24 }} onPress={() => setShowLang(false)}>
          <View style={{ backgroundColor: aura.cream, borderRadius: 22, overflow: 'hidden' }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: aura.border }}>
              <Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }}>Chọn ngôn ngữ</Text>
            </View>
            {LANGUAGES.map((lang, idx) => (
              <Pressable
                key={lang}
                onPress={() => { setLanguage(lang); setShowLang(false); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 18, gap: 13,
                  borderBottomWidth: idx < LANGUAGES.length - 1 ? 1 : 0, borderBottomColor: aura.border,
                  backgroundColor: language === lang ? aura.latte : 'transparent',
                }}
              >
                <Text style={{ flex: 1, color: aura.ink, fontWeight: '700', fontSize: 15 }}>{lang}</Text>
                {language === lang && <Ionicons name="checkmark-circle" size={22} color={aura.darkCoffee} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Page>
  );
}
