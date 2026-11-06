import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { api, sessionStore, SOCKET_URL } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { aura } from '../../lib/theme';
import { Button, Page } from '../../components/ui';
import PtJourney from '../pt';
import { AuraLoader } from '../../components/AuraLoader';

export default function MemberQr() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [section, setSection] = useState(1);
  const [qr, setQr] = useState<string | null>(null);
  const [membership, setMembership] = useState<{ id?: number; packageName?: string; status?: string; endDate?: string; remainingDays?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccessAlert, setCheckInSuccessAlert] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.gymQr();
      setQr(result.data?.qrCodeImage || null);
      setMembership(result.data?.membership || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải mã QR.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Kết nối Socket để lắng nghe thông báo check-in thành công hoặc mở bảo lưu theo thời gian thực
  useEffect(() => {
    const token = sessionStore.token();
    if (!user || !token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('notification:new', (notification: any) => {
      const title = String(notification?.title || '').toLowerCase();
      const message = String(notification?.message || '');
      // Khi có sự kiện check-in hoặc mở bảo lưu: reload lại trạng thái gói và QR ngay lập tức
      if (title.includes('điểm danh') || title.includes('check-in') || title.includes('bảo lưu') || title.includes('kích hoạt')) {
        void load();
        if (title.includes('từ chối') || (title.includes('bảo lưu') && !title.includes('mở') && !title.includes('kích hoạt'))) {
          Alert.alert('Từ chối vào cổng', message || 'Gói tập của bạn đang ở trạng thái BẢO LƯU. Vui lòng liên hệ quầy lễ tân.');
        } else if (title.includes('thành công')) {
          setCheckInSuccessAlert(message || 'Điểm danh vào cổng thành công! Chúc bạn tập luyện vui vẻ.');
        }
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [user, load]);

  useFocusEffect(
    useCallback(() => {
      if (!user || section !== 1) return;
      void load();
      const timer = setInterval(() => void load(), 45000);
      return () => clearInterval(timer);
    }, [user, section, load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: aura.darkCoffee }}>
      {/* 1. Header trên cùng: Invert sang màu sáng, bo cong đáy, wrapper màu darkCoffee */}
      <View style={{ backgroundColor: aura.darkCoffee }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            paddingHorizontal: 16,
            backgroundColor: aura.white,
            borderBottomLeftRadius: 22,
            borderBottomRightRadius: 22,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 0, 0, 0.06)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          {/* Nút Quay lại: Bo tròn 38x38 chỉ icon '<', hitSlop 12, đồng bộ toàn app */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.push('/(tabs)');
            }}
            hitSlop={12}
            style={styles.headerIconBtn}
          >
            <Ionicons name="chevron-back" size={20} color={aura.darkCoffee} />
          </Pressable>

          {/* Tiêu đề chính giữa */}
          <Text style={styles.headerTitle}>Mã QR Check-in</Text>

          {/* Nút Hướng dẫn: Bo tròn dễ bấm, hitSlop 12 */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hướng dẫn check-in"
            onPress={() => {
              Alert.alert(
                'Hướng dẫn Điểm danh Check-in',
                '1. Đưa mã QR này trước máy quét tại cổng vào hoặc cho nhân viên quầy lễ tân.\n2. Mã có hiệu lực trong 60 giây và tự động làm mới để đảm bảo tính bảo mật.\n3. Sau khi quét thành công, hệ thống sẽ tự động ghi nhận lượt tập của bạn.'
              );
            }}
            hitSlop={12}
            style={styles.headerIconBtn}
          >
            <Ionicons name="bulb-outline" size={20} color={aura.darkCoffee} />
          </Pressable>
        </View>
      </View>

      {/* 2. Thanh chuyển đổi phân đoạn [Lịch tập | Check in | PT] */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: aura.darkCoffee }}>
        <View style={styles.segmentedContainer}>
          {['Lịch tập', 'Check in', 'PT'].map((title, index) => (
            <Pressable
              key={title}
              onPress={() => setSection(index)}
              style={[
                styles.segmentTab,
                { backgroundColor: section === index ? aura.darkCoffee : 'transparent' },
              ]}
            >
              <Text
                style={{
                  textAlign: 'center',
                  color: section === index ? '#fff' : '#FFFFFFB8',
                  fontSize: 13,
                  fontWeight: '800',
                }}
              >
                {title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 3. Nội dung chính */}
      <Page
        style={{ backgroundColor: aura.darkCoffee }}
        refresh={user && section === 1 ? () => void load() : undefined}
        loading={loading}
      >
        {section === 0 && (
          <View style={{ padding: 8, gap: 16 }}>
            <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>
              Gói tập, lịch PT và Workout Class nằm trong mục Đặt lịch.
            </Text>
            <Button
              title="Mở Đặt lịch"
              icon="calendar-outline"
              onPress={() => router.push('/(tabs)/booking')}
            />
          </View>
        )}

        {section === 2 && <PtJourney embedded />}

        {section === 1 && (
          <View>
            {membership?.status === 'FROZEN' && (
              <View
                style={{
                  backgroundColor: '#FFFBEB',
                  borderWidth: 1.5,
                  borderColor: '#F59E0B',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Ionicons name="pause-circle" size={28} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#B45309', fontWeight: '900', fontSize: 13.5 }}>
                    GÓI TẬP ĐANG BẢO LƯU (FROZEN)
                  </Text>
                  <Text style={{ color: '#78350F', fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                    Gói [{membership.packageName}] đang tạm dừng đến ngày {new Date(membership.endDate!).toLocaleDateString('vi-VN')}.
                  </Text>
                  <Text style={{ color: '#92400E', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                    💡 Vui lòng mở lại gói bảo lưu tại quầy lễ tân để kích hoạt check-in vào phòng tập.
                  </Text>
                </View>
              </View>
            )}

            {/* Banner Check-in Thành Công theo thời gian thực */}
            {checkInSuccessAlert && (
              <View
                style={{
                  backgroundColor: '#ECFDF5',
                  borderWidth: 1.5,
                  borderColor: '#10B981',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Ionicons name="checkmark-circle" size={28} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#065F46', fontWeight: '900', fontSize: 13.5 }}>
                    ĐIỂM DANH THÀNH CÔNG!
                  </Text>
                  <Text style={{ color: '#047857', fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                    {checkInSuccessAlert}
                  </Text>
                </View>
                <Pressable onPress={() => setCheckInSuccessAlert(null)} hitSlop={12}>
                  <Ionicons name="close" size={20} color="#065F46" />
                </Pressable>
              </View>
            )}

            <View style={styles.ticketCard}>
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#EEEAE6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={28} color={aura.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: aura.darkCoffee, fontSize: 18, fontWeight: '900' }}>
                  {user?.fullName || 'Hội viên Aura'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Text style={{ color: aura.ink, fontSize: 12 }}>Thẻ hội viên Aura Fitness</Text>
                  {membership?.status === 'FROZEN' ? (
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                      <Text style={{ color: '#D97706', fontSize: 10, fontWeight: '900' }}>BẢO LƯU</Text>
                    </View>
                  ) : membership?.status === 'ACTIVE' ? (
                    <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0' }}>
                      <Text style={{ color: '#16A34A', fontSize: 10, fontWeight: '900' }}>HOẠT ĐỘNG</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View
                style={{
                  width: 10,
                  height: 20,
                  borderTopRightRadius: 10,
                  borderBottomRightRadius: 10,
                  backgroundColor: aura.darkCoffee,
                }}
              />
              <View style={{ flex: 1, borderTopWidth: 2, borderColor: '#DDD', borderStyle: 'dashed' }} />
              <View
                style={{
                  width: 10,
                  height: 20,
                  borderTopLeftRadius: 10,
                  borderBottomLeftRadius: 10,
                  backgroundColor: aura.darkCoffee,
                }}
              />
            </View>

            <View style={{ alignItems: 'center', padding: 20, minHeight: 332 }}>
              <View style={{ width: 192, height: 192, alignItems: 'center', justifyContent: 'center' }}>
                {qr ? (
                  <Image source={{ uri: qr }} style={{ width: 185, height: 185 }} resizeMode="contain" />
                ) : loading ? (
                  <AuraLoader size={64} />
                ) : (
                  <View style={{ alignItems: 'center', gap: 7 }}>
                    <Ionicons name="qr-code-outline" size={59} color={aura.muted} />
                    <Text style={{ color: aura.muted, textAlign: 'center', fontSize: 12 }}>
                      {error || 'Chưa có mã QR'}
                    </Text>
                    <Text
                      onPress={() => (user ? void load() : router.push('/auth'))}
                      style={{ color: aura.caramel, fontWeight: '800' }}
                    >
                      {user ? 'Thử lại' : 'Đăng nhập'}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{ color: membership?.status === 'FROZEN' ? '#D97706' : aura.ink, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 17 }}>
                {membership?.status === 'FROZEN'
                  ? 'Gói đang bảo lưu · Không thể điểm danh vào cổng'
                  : qr ? 'Mã có hiệu lực 1 phút · Tự cập nhật' : 'Mở mã QR để nhân viên quét điểm danh'}
              </Text>
              {qr && (
                <Text
                  onPress={() => void load()}
                  style={{ color: aura.caramel, fontSize: 12, fontWeight: '800', marginTop: 7 }}
                >
                  {loading ? 'Đang làm mới mã...' : '↻  Làm mới mã'}
                </Text>
              )}
              {error && qr && (
                <Text style={{ color: '#B3261E', fontSize: 11, textAlign: 'center', marginTop: 5 }}>{error}</Text>
              )}
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 21 }}>
                {Array.from({ length: 8 }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === 3 ? 20 : 12,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: i === 3 ? aura.ink : '#DDD',
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: aura.darkCoffee, fontWeight: '900', letterSpacing: 3, fontSize: 14, marginTop: 20 }}>
                A U R A  F I T N E S S
              </Text>
            </View>
          </View>
        </View>
        )}

        {section === 1 && (
          <Button
            secondary
            title="Lịch sử điểm danh"
            icon="time-outline"
            onPress={() => router.push(user ? '/history' : '/auth')}
          />
        )}
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    color: aura.darkCoffee,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3ECE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF22',
    borderRadius: 14,
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
  },
  ticketCard: {
    borderRadius: 24,
    backgroundColor: '#fff',
    marginHorizontal: 4,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 14,
  },
});
