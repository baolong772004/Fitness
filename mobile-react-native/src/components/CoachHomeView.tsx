import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dateLabel, timeLabel } from '../lib/theme';
import { AuraLoader } from './AuraLoader';
import { HomeHeader } from './HomeHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const gymDay = (val: string | Date) => {
  try {
    const d = new Date(new Date(val).getTime() + 7 * 3600000);
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const formatTime = (isoString?: string) => {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    });
  } catch {
    return '--:--';
  }
};

const statusText: Record<string, { label: string; bg: string; color: string; border: string }> = {
  CONFIRMED: { label: 'Đã xác nhận', bg: '#E8F5E9', color: '#2E7D32', border: '#C8E6C9' },
  IN_PROGRESS: { label: 'Đang tập', bg: '#FFF3E0', color: '#E65100', border: '#FFE0B2' },
  COMPLETED: { label: 'Hoàn thành', bg: '#E3F2FD', color: '#1565C0', border: '#BBDEFB' },
  PENDING: { label: 'Chờ duyệt', bg: '#FFF8E1', color: '#F57F17', border: '#FFECB3' },
  UPCOMING: { label: 'Sắp tới', bg: '#FFF8E1', color: '#F57F17', border: '#FFECB3' },
  CANCELLED: { label: 'Đã hủy', bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' },
  ABSENT_ELIGIBLE: { label: 'Vắng (Học bù)', bg: '#EDE7F6', color: '#512DA8', border: '#D1C4E9' },
  ABSENT_NO_REFUND: { label: 'Vắng (Trừ ca)', bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' },
  MAKEUP_BOOKED: { label: 'Đã đặt bù', bg: '#E0F2F1', color: '#00695C', border: '#B2DFDB' },
};

export function CoachHomeView() {
  const { user, unreadChatCount, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => gymDay(new Date()));

  // Data
  const [bookings, setBookings] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  // unreadChatCount managed by useAuth

  // QR Modal State
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrType, setQrType] = useState<'PT' | 'CLASS'>('PT');
  const [qrTitle, setQrTitle] = useState('');
  const [qrSub, setQrSub] = useState('');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number>(0);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  // Complete PT session Modal
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [finishBooking, setFinishBooking] = useState<any | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [finishBusy, setFinishBusy] = useState(false);

  // Absence modal
  const [absenceModalVisible, setAbsenceModalVisible] = useState(false);
  const [absenceBooking, setAbsenceBooking] = useState<any | null>(null);
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceBusy, setAbsenceBusy] = useState(false);

  // Timer cho QR countdown
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tải dữ liệu toàn bộ nghiệp vụ Coach
  const loadData = useCallback(async () => {
    try {
      const [ptRes, classRes, traineesRes, chatRes] = await Promise.all([
        api.ptBookings().catch(() => []),
        api.classSchedules(new Date(selectedDate)).catch(() => []),
        api.coachTrainees().catch(() => ({ data: [] })),
        api.ptConversations().catch(() => ({ data: [] })),
      ]);

      setBookings(Array.isArray(ptRes) ? ptRes : []);
      setClasses(Array.isArray(classRes) ? classRes : []);
      setTrainees(Array.isArray(traineesRes.data) ? traineesRes.data : []);


    } catch (err) {
      console.warn('Lỗi tải dữ liệu Coach Mobile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  // Lọc ca PT của ngày được chọn (không hiển thị ca đã hủy)
  const dayBookings = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          gymDay(b.startTime) === selectedDate &&
          String(b.status || '').toUpperCase() !== 'CANCELLED'
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [bookings, selectedDate]);

  // Số ca PT hôm nay đã được đặt (không tính ca đã hủy)
  const todayPtCount = useMemo(() => {
    const todayIso = gymDay(new Date());
    return bookings.filter(
      (b) =>
        gymDay(b.startTime) === todayIso &&
        String(b.status || '').toUpperCase() !== 'CANCELLED'
    ).length;
  }, [bookings]);

  // Ca PT sắp tới gần nhất (hôm nay hoặc sắp tới)
  const nextSession = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(
        (b) =>
          ['CONFIRMED', 'IN_PROGRESS'].includes(b.status) &&
          new Date(b.endTime).getTime() > now
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
  }, [bookings]);

  // Sinh 7 ngày trong tuần quanh selectedDate
  const weekDays = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = -1; i <= 5; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      const iso = gymDay(d);
      const dayName =
        i === 0
          ? 'Hôm nay'
          : d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'Asia/Bangkok' });
      const dayNum = d.getDate();
      list.push({ iso, dayName, dayNum });
    }
    return list;
  }, []);

  // Mở modal tạo QR buổi PT
  const openPtQr = async (booking: any) => {
    setActiveSessionId(booking.id);
    setQrType('PT');
    setQrTitle(`Điểm danh: ${booking.member?.fullName || 'Hội viên'}`);
    setQrSub(`${formatTime(booking.startTime)} - ${formatTime(booking.endTime)} · Buổi tập PT 1:1`);
    setQrModalVisible(true);
    setQrBusy(true);
    setQrError(null);
    setQrToken(null);

    try {
      const res = await api.ptQr(booking.id);
      if (res?.data?.token) {
        setQrToken(res.data.token);
        setQrExpiresAt(Date.now() + 90000);
      } else {
        throw new Error('Không nhận được token QR từ máy chủ.');
      }
    } catch (err: any) {
      setQrError(err.message || 'Chưa mở được mã QR điểm danh.');
    } finally {
      setQrBusy(false);
    }
  };

  // Mở modal tạo QR lớp nhóm
  const openClassQr = async (classItem: any) => {
    setActiveSessionId(classItem.id);
    setQrType('CLASS');
    setQrTitle(`Điểm danh: ${classItem.groupClass?.name || 'Lớp nhóm'}`);
    setQrSub(`${formatTime(classItem.startTime)} - ${formatTime(classItem.endTime)} · Phòng ${classItem.room?.name || 'Tập nhóm'}`);
    setQrModalVisible(true);
    setQrBusy(true);
    setQrError(null);
    setQrToken(null);

    try {
      const res = await api.classCheckInQr(classItem.id);
      if (res?.data?.token) {
        setQrToken(res.data.token);
        setQrExpiresAt(Date.now() + (res.data.expiresIn || 90) * 1000);
      } else {
        throw new Error('Không nhận được token QR lớp.');
      }
    } catch (err: any) {
      setQrError(err.message || 'QR điểm danh chỉ mở từ 15 phút trước giờ học.');
    } finally {
      setQrBusy(false);
    }
  };

  // Làm mới QR trong modal
  const refreshActiveQr = () => {
    if (!activeSessionId) return;
    if (qrType === 'PT') {
      const b = bookings.find((item) => item.id === activeSessionId);
      if (b) openPtQr(b);
    } else {
      const c = classes.find((item) => item.id === activeSessionId);
      if (c) openClassQr(c);
    }
  };

  // Xác nhận báo vắng
  const handleConfirmAbsence = async () => {
    if (!absenceBooking) return;
    setAbsenceBusy(true);
    try {
      await api.absentPt(absenceBooking.id, absenceReason || 'HLV báo vắng và cấp quyền học bù');
      Alert.alert('Thành công', 'Đã báo vắng cho buổi PT và cấp quyền đặt bù cho hội viên.');
      setAbsenceModalVisible(false);
      setAbsenceBooking(null);
      void loadData();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể báo vắng ca tập.');
    } finally {
      setAbsenceBusy(false);
    }
  };

  // Kết thúc buổi PT
  const handleFinishSession = async () => {
    if (!finishBooking) return;
    setFinishBusy(true);
    try {
      await api.completePt(finishBooking.id);
      Alert.alert('Thành công', 'Buổi tập đã hoàn thành và trừ 1 lượt PT theo quy định.');
      setFinishModalVisible(false);
      setFinishBooking(null);
      void loadData();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể kết thúc buổi tập.');
    } finally {
      setFinishBusy(false);
    }
  };

  const secondsLeft = Math.max(0, Math.floor((qrExpiresAt - nowMs) / 1000));

  return (
    <View style={{ flex: 1, backgroundColor: aura.cream }}>
      {/* 1. TOP HEADER GHIM: 3 gạch ngang, Aura Fitness, Nút chat */}
      <HomeHeader />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 2. CHỈ SỐ NHANH TRONG NGÀY (Metrics Bar) */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: aura.white,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: '#E8D4C2',
            justifyContent: 'space-around',
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: aura.darkCoffee, fontSize: 18, fontWeight: '900' }}>
              {todayPtCount}
            </Text>
            <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2, fontWeight: '700' }}>
              Ca PT hôm nay
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#E8D4C2' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: aura.darkCoffee, fontSize: 18, fontWeight: '900' }}>
              {classes.length}
            </Text>
            <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2, fontWeight: '700' }}>
              Lớp nhóm
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#E8D4C2' }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: aura.darkCoffee, fontSize: 18, fontWeight: '900' }}>
              {trainees.length}
            </Text>
            <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2, fontWeight: '700' }}>
              Học viên kèm
            </Text>
          </View>
        </View>

        {/* 3. CA DẠY KẾ TIẾP & ĐIỂM DANH (Next Session Hero Card) */}
        {nextSession && (
          <LinearGradient
            colors={[aura.darkCoffee, aura.caramel]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 18, elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="flash" size={14} color="#FFD6B4" />
                <Text style={{ color: '#FFD6B4', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                  CA HUẤN LUYỆN SẮP DIỄN RA
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: '#FFFFFF24',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                  {statusText[nextSession.status]?.label || nextSession.status}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>
                {nextSession.member?.fullName || `Hội viên #${nextSession.memberId}`}
              </Text>
              <Text style={{ color: '#FFFFFFE0', fontSize: 13, marginTop: 3 }}>
                ⏰ {formatTime(nextSession.startTime)} – {formatTime(nextSession.endTime)} · {gymDay(nextSession.startTime)}
              </Text>
              {nextSession.member?.phone && (
                <Text style={{ color: '#FFD6B4', fontSize: 12, marginTop: 2, fontFamily: 'monospace' }}>
                  📞 {nextSession.member.phone}
                </Text>
              )}
            </View>

            {/* Nút hành động nổi bật: TẠO QR ĐIỂM DANH */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <Pressable
                onPress={() => openPtQr(nextSession)}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="qr-code" size={18} color={aura.darkCoffee} />
                <Text style={{ color: aura.darkCoffee, fontSize: 13, fontWeight: '900' }}>
                  TẠO QR ĐIỂM DANH
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push({ pathname: '/pt-chat', params: { memberId: String(nextSession.memberId) } })}
                style={{
                  backgroundColor: '#FFFFFF25',
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              </Pressable>
            </View>
          </LinearGradient>
        )}

        {/* 4. THANH CHỌN NGÀY (Week Date Strip) */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: aura.ink, fontSize: 16, fontWeight: '900' }}>
              Lịch Dạy & Điểm Danh
            </Text>
            <Text style={{ color: aura.muted, fontSize: 12 }}>
              {selectedDate}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {weekDays.map((item) => {
              const active = item.iso === selectedDate;
              return (
                <Pressable
                  key={item.iso}
                  onPress={() => setSelectedDate(item.iso)}
                  style={{
                    backgroundColor: active ? aura.darkCoffee : aura.white,
                    borderWidth: 1,
                    borderColor: active ? aura.darkCoffee : aura.border,
                    borderRadius: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    minWidth: 64,
                  }}
                >
                  <Text style={{ color: active ? '#FFD6B4' : aura.muted, fontSize: 11, fontWeight: '700' }}>
                    {item.dayName}
                  </Text>
                  <Text style={{ color: active ? '#fff' : aura.ink, fontSize: 17, fontWeight: '900', marginTop: 2 }}>
                    {item.dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 5. DANH SÁCH CA PT TRONG NGÀY ĐƯỢC CHỌN */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="barbell-outline" size={16} color={aura.darkCoffee} />
            <Text style={{ color: aura.ink, fontSize: 14, fontWeight: '800' }}>
              Ca tập PT 1:1 ({dayBookings.length})
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={aura.darkCoffee} style={{ marginVertical: 20 }} />
          ) : dayBookings.length === 0 ? (
            <View
              style={{
                backgroundColor: aura.white,
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: aura.border,
              }}
            >
              <Ionicons name="calendar-clear-outline" size={32} color={aura.muted} />
              <Text style={{ color: aura.muted, fontSize: 13, marginTop: 8 }}>
                Không có buổi PT nào trong ngày này.
              </Text>
            </View>
          ) : (
            dayBookings.map((b) => {
              const statusCfg = statusText[b.status] || {
                label: b.status,
                bg: '#F5F5F5',
                color: '#616161',
                border: '#E0E0E0',
              };
              const canQr = ['CONFIRMED', 'IN_PROGRESS'].includes(b.status);
              const canAbsence = b.status === 'CONFIRMED' && Date.now() < new Date(b.startTime).getTime();

              return (
                <View
                  key={b.id}
                  style={{
                    backgroundColor: aura.white,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: aura.border,
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: aura.ink, fontSize: 16, fontWeight: '900' }}>
                        {b.member?.fullName || `Hội viên #${b.memberId}`}
                      </Text>
                      <Text style={{ color: aura.muted, fontSize: 12, marginTop: 3 }}>
                        {formatTime(b.startTime)} – {formatTime(b.endTime)} · {b.ptCreditAllocation?.batch?.level ? `PT ${b.ptCreditAllocation.batch.level}` : b.membership?.package?.name || 'PT 1:1'}
                      </Text>
                      {b.member?.phone && (
                        <Text style={{ color: aura.darkCoffee, fontSize: 12, marginTop: 2, fontFamily: 'monospace' }}>
                          📞 {b.member.phone}
                        </Text>
                      )}
                    </View>

                    <View
                      style={{
                        backgroundColor: statusCfg.bg,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: statusCfg.border,
                      }}
                    >
                      <Text style={{ color: statusCfg.color, fontSize: 11, fontWeight: '800' }}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Nút thao tác của từng ca */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderColor: '#F0E8DF', paddingTop: 10 }}>
                    {canQr && (
                      <Pressable
                        onPress={() => openPtQr(b)}
                        style={{
                          backgroundColor: aura.darkCoffee,
                          borderRadius: 10,
                          paddingVertical: 7,
                          paddingHorizontal: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Ionicons name="qr-code" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Tạo QR</Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => router.push({ pathname: '/pt-chat', params: { memberId: String(b.memberId) } })}
                      style={{
                        backgroundColor: aura.latte,
                        borderRadius: 10,
                        paddingVertical: 7,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={aura.darkCoffee} />
                      <Text style={{ color: aura.darkCoffee, fontSize: 12, fontWeight: '800' }}>Nhắn tin</Text>
                    </Pressable>

                    {canAbsence && (
                      <Pressable
                        onPress={() => {
                          setAbsenceBooking(b);
                          setAbsenceReason('');
                          setAbsenceModalVisible(true);
                        }}
                        style={{
                          backgroundColor: '#FFF0F0',
                          borderRadius: 10,
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                        }}
                      >
                        <Text style={{ color: '#D32F2F', fontSize: 12, fontWeight: '700' }}>Báo vắng</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 6. LỚP HỌC NHÓM (Workclass) ĐƯỢC PHÂN CÔNG */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="people-outline" size={16} color={aura.darkCoffee} />
            <Text style={{ color: aura.ink, fontSize: 14, fontWeight: '800' }}>
              Lớp nhóm Workclass ({classes.length})
            </Text>
          </View>

          {classes.length === 0 ? (
            <View
              style={{
                backgroundColor: aura.white,
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: aura.border,
              }}
            >
              <Text style={{ color: aura.muted, fontSize: 12 }}>
                Không có lịch dạy lớp nhóm trong ngày này.
              </Text>
            </View>
          ) : (
            classes.map((cls) => (
              <View
                key={cls.id}
                style={{
                  backgroundColor: aura.white,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: aura.border,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: aura.ink, fontSize: 15, fontWeight: '900' }}>
                      {cls.groupClass?.name || 'Lớp Workout'}
                    </Text>
                    <Text style={{ color: aura.muted, fontSize: 12, marginTop: 2 }}>
                      {formatTime(cls.startTime)} – {formatTime(cls.endTime)} · Phòng {cls.room?.name || 'Tập nhóm'}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: aura.latte,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: aura.darkCoffee, fontSize: 11, fontWeight: '800' }}>
                      {cls.bookedCount ?? 0}/{cls.capacity ?? 20} HV
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: '#F0E8DF', paddingTop: 10 }}>
                  <Pressable
                    onPress={() => openClassQr(cls)}
                    style={{
                      backgroundColor: aura.darkCoffee,
                      borderRadius: 10,
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Ionicons name="qr-code" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                      QR Điểm Danh Lớp
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 7. HỌC VIÊN PT ĐANG PHỤ TRÁCH (Trainees Quick View) */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="person-circle-outline" size={16} color={aura.darkCoffee} />
              <Text style={{ color: aura.ink, fontSize: 14, fontWeight: '800' }}>
                Học viên đang kèm ({trainees.length})
              </Text>
            </View>
            <Pressable onPress={() => router.push('/pt-chat')}>
              <Text style={{ color: aura.caramel, fontSize: 12, fontWeight: '800' }}>Nhắn tin</Text>
            </Pressable>
          </View>

          {trainees.length === 0 ? (
            <View
              style={{
                backgroundColor: aura.white,
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: aura.border,
              }}
            >
              <Text style={{ color: aura.muted, fontSize: 12 }}>Chưa có học viên nào được phân công.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {trainees.slice(0, 8).map((t) => (
                <Pressable
                  key={t.id || t.userId}
                  onPress={() => router.push({ pathname: '/pt-chat', params: { memberId: String(t.userId) } })}
                  style={{
                    backgroundColor: aura.white,
                    borderWidth: 1,
                    borderColor: aura.border,
                    borderRadius: 16,
                    padding: 14,
                    width: 140,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: aura.latte,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: aura.darkCoffee, fontSize: 16, fontWeight: '900' }}>
                      {t.user?.fullName?.trim().charAt(0) || 'H'}
                    </Text>
                  </View>
                  <Text style={{ color: aura.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' }} numberOfLines={1}>
                    {t.user?.fullName || 'Học viên'}
                  </Text>
                  <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
                    Còn {t.remainingSessions ?? '—'} buổi
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#E8F5E9',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                      marginTop: 6,
                    }}
                  >
                    <Text style={{ color: '#2E7D32', fontSize: 10, fontWeight: '800' }}>
                      {t.level || 'PT'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* 8. LỐI TẮT NGHIỆP VỤ (Quick Tools) */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: aura.ink, fontSize: 14, fontWeight: '800' }}>
            Công Cụ HLV
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => router.push('/coach-availability')}
              style={{
                flex: 1,
                backgroundColor: aura.white,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: aura.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar" size={18} color="#1565C0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: aura.ink, fontSize: 13, fontWeight: '800' }}>Đăng Ký Lịch</Text>
                <Text style={{ color: aura.muted, fontSize: 11 }}>Cập nhật ca rảnh</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push('/exercise-analysis')}
              style={{
                flex: 1,
                backgroundColor: aura.white,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: aura.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3E5F5', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="analytics" size={18} color="#7B1FA2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: aura.ink, fontSize: 13, fontWeight: '800' }}>AI Kỹ Thuật</Text>
                <Text style={{ color: aura.muted, fontSize: 11 }}>Chấm điểm Form</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* =========================================================================
          MODAL: HIỂN THỊ MÃ QR ĐIỂM DANH TOÀN MÀN HÌNH CHO HỌC VIÊN QUÉT
      ========================================================================= */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>
                  {qrTitle}
                </Text>
                <Text style={{ color: aura.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {qrSub}
                </Text>
              </View>
              <Pressable onPress={() => setQrModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={26} color={aura.muted} />
              </Pressable>
            </View>

            <View style={{ width: 250, height: 250, alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
              {qrBusy ? (
                <AuraLoader size={64} />
              ) : qrError ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={36} color="#D32F2F" />
                  <Text style={{ color: '#D32F2F', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                    {qrError}
                  </Text>
                </View>
              ) : qrToken && secondsLeft > 0 ? (
                <QRCode value={qrToken} size={230} />
              ) : (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Ionicons name="time-outline" size={36} color={aura.muted} />
                  <Text style={{ color: aura.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                    Mã QR đã hết hạn. Hãy làm mới mã để học viên quét.
                  </Text>
                </View>
              )}
            </View>

            {qrToken && secondsLeft > 0 && (
              <View style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12 }}>
                <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: '900' }}>
                  Mã có hiệu lực: {secondsLeft} giây
                </Text>
              </View>
            )}

            <Text style={{ color: aura.muted, fontSize: 11, textAlign: 'center', paddingHorizontal: 10 }}>
              Hội viên mở ứng dụng di động Aura và quét mã QR này để xác nhận điểm danh.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' }}>
              <Pressable
                onPress={refreshActiveQr}
                disabled={qrBusy}
                style={{
                  flex: 1,
                  backgroundColor: aura.darkCoffee,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Làm mới mã QR</Text>
              </Pressable>

              <Pressable
                onPress={() => setQrModalVisible(false)}
                style={{
                  backgroundColor: aura.latte,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: aura.darkCoffee, fontSize: 13, fontWeight: '800' }}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL: KẾT THÚC BUỔI PT & GHI NHẬN XÉT
      ========================================================================= */}
      <Modal
        visible={finishModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFinishModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }}>
              Kết Thúc Buổi Tập PT
            </Text>
            <Text style={{ color: aura.muted, fontSize: 12, marginTop: 3 }}>
              {finishBooking?.member?.fullName} · {formatTime(finishBooking?.startTime)} - {formatTime(finishBooking?.endTime)}
            </Text>

            <View style={{ width: '100%', gap: 10, marginTop: 16 }}>
              <Text style={{ color: aura.ink, fontSize: 12, fontWeight: '700' }}>Nhận xét buổi tập</Text>
              <TextInput
                value={sessionNotes}
                onChangeText={setSessionNotes}
                placeholder="Ghi nhận xét về tinh thần, thể lực của học viên..."
                placeholderTextColor={aura.muted}
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: aura.border,
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  backgroundColor: '#FAFAFA',
                  textAlignVertical: 'top',
                }}
              />

              <Text style={{ color: aura.ink, fontSize: 12, fontWeight: '700' }}>Nội dung bài tập (tùy chọn)</Text>
              <TextInput
                value={exerciseName}
                onChangeText={setExerciseName}
                placeholder="Tên bài tập chính (vd: Squat, Bench Press...)"
                placeholderTextColor={aura.muted}
                style={{ borderWidth: 1, borderColor: aura.border, borderRadius: 10, padding: 8, fontSize: 12 }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  value={sets}
                  onChangeText={setSets}
                  keyboardType="numeric"
                  placeholder="Số hiệp"
                  placeholderTextColor={aura.muted}
                  style={{ flex: 1, borderWidth: 1, borderColor: aura.border, borderRadius: 10, padding: 8, fontSize: 12 }}
                />
                <TextInput
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="numeric"
                  placeholder="Số lần"
                  placeholderTextColor={aura.muted}
                  style={{ flex: 1, borderWidth: 1, borderColor: aura.border, borderRadius: 10, padding: 8, fontSize: 12 }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
              <Pressable
                onPress={handleFinishSession}
                disabled={finishBusy}
                style={{
                  flex: 1,
                  backgroundColor: aura.darkCoffee,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                {finishBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Hoàn thành & Trừ 1 ca</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setFinishModalVisible(false)}
                style={{
                  backgroundColor: aura.latte,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: aura.darkCoffee, fontSize: 13, fontWeight: '800' }}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL: BÁO VẮNG BUỔI PT
      ========================================================================= */}
      <Modal
        visible={absenceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAbsenceModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{ color: '#D32F2F', fontSize: 17, fontWeight: '900' }}>
              Xác Nhận Báo Vắng Buổi PT
            </Text>
            <Text style={{ color: aura.muted, fontSize: 12, marginTop: 3 }}>
              Học viên {absenceBooking?.member?.fullName} sẽ được cấp quyền học bù trong 7 ngày và không bị trừ buổi.
            </Text>

            <View style={{ width: '100%', gap: 8, marginTop: 14 }}>
              <Text style={{ color: aura.ink, fontSize: 12, fontWeight: '700' }}>Lý do báo vắng</Text>
              <TextInput
                value={absenceReason}
                onChangeText={setAbsenceReason}
                placeholder="Nhập lý do học viên hoặc HLV báo vắng..."
                placeholderTextColor={aura.muted}
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: aura.border,
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  backgroundColor: '#FAFAFA',
                  textAlignVertical: 'top',
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' }}>
              <Pressable
                onPress={handleConfirmAbsence}
                disabled={absenceBusy}
                style={{
                  flex: 1,
                  backgroundColor: '#D32F2F',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                {absenceBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Xác nhận báo vắng</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setAbsenceModalVisible(false)}
                style={{
                  backgroundColor: aura.latte,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: aura.darkCoffee, fontSize: 13, fontWeight: '800' }}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
});

