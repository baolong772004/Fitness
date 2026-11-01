import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { aura, dateLabel, timeLabel } from '../../lib/theme';
import { Page, showError } from '../../components/ui';

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function BookingHub() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const coach = ['COACH', 'TRAINER'].includes(user?.role || '');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [subs, pt] = await Promise.all([
        coach ? Promise.resolve([]) : api.subscriptions(),
        api.ptBookings(),
      ]);
      setSubscriptions(subs);
      setBookings(pt);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [user, coach]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const today = Date.now();
  const active = subscriptions.find(
    row => row.package?.type === 'MEMBERSHIP' && row.status === 'ACTIVE' && new Date(row.endDate).getTime() >= today
  );

  // Sắp xếp tìm ca tập sắp tới gần nhất
  const upcoming = bookings
    .filter(
      row =>
        ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'].includes(row.status) &&
        new Date(row.endTime).getTime() > today
    )
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return { label: 'Đang diễn ra', bg: '#FFF3E0', text: '#E65100', border: '#FFE0B2' };
      case 'CONFIRMED':
        return { label: 'Đã xác nhận', bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' };
      case 'PENDING':
      case 'UPCOMING':
      default:
        return { label: 'Chờ HLV duyệt', bg: '#FFF8E1', text: '#F57F17', border: '#FFECB3' };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: aura.cream }}>
      {/* Header an toàn tuyệt đối khỏi tai thỏ / status bar */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 11,
          paddingHorizontal: 16,
          backgroundColor: aura.white,
          borderBottomWidth: 1,
          borderBottomColor: '#EAD8C7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '900', color: aura.darkCoffee, letterSpacing: 0.4 }}>
          {coach ? 'Lịch dạy của Coach' : 'Đặt lịch & Lớp học'}
        </Text>
      </View>

      <Page loading={loading} refresh={user ? () => void load() : undefined}>
      {/* 1. Header Hero Banner */}
      <LinearGradient
        colors={[aura.espresso, aura.darkCoffee, aura.caramel]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}
      >
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={11} color="#FFD6B4" />
          <Text style={styles.heroBadgeText}>AURA FITNESS · LỊCH TẬP</Text>
        </View>

        <Text style={styles.heroTitle}>
          {coach ? 'Lịch huấn luyện của bạn' : 'Tập luyện theo cách của bạn'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {coach
            ? 'Theo dõi ca dạy, chuẩn bị đón tiếp và đồng hành cùng hội viên.'
            : 'Chọn hình thức tập luyện phù hợp hoặc khám phá các gói tập mới.'}
        </Text>

        <Pressable
          onPress={() => router.push(coach ? '/pt' : '/packages')}
          style={styles.heroButton}
          accessibilityRole="button"
        >
          <Ionicons name={coach ? 'calendar-outline' : 'compass-outline'} size={16} color={aura.darkCoffee} />
          <Text style={styles.heroButtonText}>
            {coach ? 'Xem chi tiết lịch dạy' : 'Khám phá gói tập'}
          </Text>
        </Pressable>
      </LinearGradient>

      {/* 2. Lịch tập sắp tới (Upcoming Session Card) */}
      <SectionHeading
        title="Lịch tập sắp tới"
        subtitle={coach ? 'Ca huấn luyện tiếp theo của bạn' : 'Buổi tập gần nhất đã đặt trên hệ thống'}
      />

      {!user ? (
        <Pressable
          onPress={() => router.push('/auth')}
          style={({ pressed }) => [styles.upcomingCardEmpty, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.emptyIconCircle}>
            <Ionicons name="lock-closed-outline" size={22} color={aura.darkCoffee} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>Đăng nhập để xem lịch tập</Text>
            <Text style={styles.emptySub}>Lịch hẹn với HLV và lớp học sẽ xuất hiện tại đây.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={aura.caramel} />
        </Pressable>
      ) : upcoming ? (
        (() => {
          const badge = getStatusBadge(upcoming.status);
          return (
            <Pressable
              onPress={() => router.push('/pt')}
              style={({ pressed }) => [styles.upcomingCard, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
            >
              <View style={styles.upcomingHeader}>
                <View style={styles.dateTimeBadge}>
                  <Ionicons name="time-outline" size={14} color={aura.darkCoffee} />
                  <Text style={styles.dateTimeText}>
                    {timeLabel(upcoming.startTime)} · {dateLabel(upcoming.startTime)}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <Text style={[styles.statusPillText, { color: badge.text }]}>{badge.label}</Text>
                </View>
              </View>

              <View style={styles.upcomingBody}>
                <View style={styles.upcomingAvatarCircle}>
                  <Ionicons name={coach ? 'person' : 'barbell'} size={20} color={aura.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upcomingCoachName}>
                    {coach
                      ? upcoming.member?.fullName || 'Hội viên'
                      : upcoming.coach?.fullName || 'Huấn luyện viên Aura'}
                  </Text>
                  <Text style={styles.upcomingLevelText}>
                    {upcoming.ptCreditAllocation?.batch?.level
                      ? `Buổi tập cá nhân · PT ${upcoming.ptCreditAllocation.batch.level}`
                      : upcoming.membership?.package?.name || 'Buổi tập PT 1:1'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={aura.caramel} />
              </View>

              <View style={styles.upcomingFooter}>
                <Text style={styles.upcomingActionText}>Mở chi tiết & Điểm danh</Text>
                <Ionicons name="arrow-forward" size={13} color={aura.darkCoffee} />
              </View>
            </Pressable>
          );
        })()
      ) : (
        <Pressable
          onPress={() => router.push('/pt')}
          style={({ pressed }) => [styles.upcomingCardEmpty, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <View style={styles.emptyIconCircle}>
            <Ionicons name="calendar-outline" size={22} color={aura.darkCoffee} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>
              {coach ? 'Chưa có ca dạy sắp tới' : 'Chưa có buổi tập nào sắp tới'}
            </Text>
            <Text style={styles.emptySub}>
              {coach ? 'Các ca tập hội viên đặt sẽ hiển thị tại đây.' : 'Chọn HLV hoặc lớp học để lên lịch tập ngay.'}
            </Text>
          </View>
          <View style={styles.bookNowBtn}>
            <Text style={styles.bookNowText}>{coach ? 'Lịch rảnh' : 'Đặt ngay'}</Text>
          </View>
        </Pressable>
      )}

      {/* 3. Dịch vụ đặt lịch tập luyện (Hợp nhất Lớp học và PT vào 1 khu vực chuẩn) */}
      <SectionHeading
        title="Hình thức tập luyện"
        subtitle="Chọn hình thức bạn muốn tham gia để bắt đầu đặt lịch"
      />

      <View style={styles.servicesContainer}>
        {/* Lựa chọn 1: Tập cùng PT */}
        <Pressable
          onPress={() => router.push(user ? '/pt' : '/auth')}
          style={({ pressed }) => [styles.serviceCard, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
        >
          <View style={styles.serviceIconWrap}>
            <Ionicons name="barbell" size={24} color={aura.darkCoffee} />
          </View>
          <View style={styles.serviceContent}>
            <View style={styles.serviceTitleRow}>
              <Text style={styles.serviceTitle}>Tập Cùng Huấn Luyện Viên PT</Text>
              <Ionicons name="chevron-forward" size={18} color={aura.caramel} />
            </View>
            <Text style={styles.serviceDesc}>
              Đặt lịch 1:1, theo dõi giáo án cá nhân hóa và quản lý số buổi trong ví PT của bạn.
            </Text>
            <View style={styles.serviceTag}>
              <Text style={styles.serviceTagText}>PT 1:1 · Lịch riêng</Text>
            </View>
          </View>
        </Pressable>

        {/* Lựa chọn 2: Lớp học nhóm */}
        <Pressable
          onPress={() => router.push('/classes')}
          style={({ pressed }) => [styles.serviceCard, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
        >
          <View style={[styles.serviceIconWrap, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="people" size={24} color="#1565C0" />
          </View>
          <View style={styles.serviceContent}>
            <View style={styles.serviceTitleRow}>
              <Text style={styles.serviceTitle}>Ca Tập Gym & Nhóm Thể Lực</Text>
              <Ionicons name="chevron-forward" size={18} color={aura.caramel} />
            </View>
            <Text style={styles.serviceDesc}>
              Tập tạ nhóm, HIIT đốt mỡ, Functional Gym... Khám phá lịch biểu trong tuần và giữ chỗ trước khi đến phòng tập.
            </Text>
            <View style={[styles.serviceTag, { backgroundColor: '#E3F2FD' }]}>
              <Text style={[styles.serviceTagText, { color: '#1565C0' }]}>Ca tập gym · Điểm danh QR</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* 4. Gói tập & Quyền lợi hội viên (Nếu là hội viên) */}
      {!coach && (
        <>
          <SectionHeading
            title="Thẻ hội viên & Gói tập"
            subtitle="Quản lý thời hạn thẻ và khám phá các đặc quyền tại Aura"
          />

          {/* Thẻ Hội Viên Hiện Tại */}
          {user && (
            <Pressable
              onPress={() => router.push(active ? '/subscriptions' : '/packages')}
              style={({ pressed }) => [styles.membershipCard, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
            >
              <View style={styles.membershipTop}>
                <View style={styles.membershipBadgeIcon}>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'card-outline'}
                    size={20}
                    color={active ? '#2E7D32' : aura.darkCoffee}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.membershipName}>
                    {active?.package?.name || 'Chưa có gói hội viên'}
                  </Text>
                  <Text style={styles.membershipValidity}>
                    {active
                      ? `Đang hoạt động · Hạn dùng đến ${dateLabel(active.endDate)}`
                      : 'Đăng ký gói hội viên để vào phòng tập và nhận quyền lợi PT trải nghiệm.'}
                  </Text>
                </View>
              </View>

              <View style={styles.membershipBottom}>
                <Text style={styles.membershipLinkText}>
                  {active ? 'Xem chi tiết quyền lợi & Check-in' : 'Chọn gói hội viên'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={aura.darkCoffee} />
              </View>
            </Pressable>
          )}

          {/* 2 Nút tiện ích: Mua gói & Gói của tôi */}
          <View style={styles.quickActionsRow}>
            <Pressable
              onPress={() => router.push('/packages')}
              style={({ pressed }) => [styles.quickActionCard, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="pricetag-outline" size={20} color={aura.darkCoffee} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickActionTitle}>Mua gói tập</Text>
                <Text style={styles.quickActionSub}>Gói Gym & Buổi PT mới</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={aura.caramel} />
            </Pressable>

            <Pressable
              onPress={() => router.push(user ? '/subscriptions' : '/auth')}
              style={({ pressed }) => [styles.quickActionCard, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="receipt-outline" size={20} color={aura.darkCoffee} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickActionTitle}>Gói của tôi</Text>
                <Text style={styles.quickActionSub}>Hạn dùng & Lịch sử gia hạn</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={aura.caramel} />
            </Pressable>
          </View>
        </>
      )}

      {/* Khoảng đệm dưới cùng */}
      <View style={{ height: 24 }} />
    </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  // Section Headings
  sectionHeading: {
    marginTop: 18,
    marginBottom: 8,
  },
  sectionTitle: {
    color: aura.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: aura.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // Hero Banner
  heroBanner: {
    borderRadius: 22,
    padding: 18,
    minHeight: 154,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroBadgeText: {
    color: '#FFD6B4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  heroSubtitle: {
    color: '#FFFFFFE0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: '92%',
  },
  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroButtonText: {
    color: aura.darkCoffee,
    fontWeight: '900',
    fontSize: 12,
  },

  // Upcoming Card (Active)
  upcomingCard: {
    backgroundColor: aura.white,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F3E5D8',
    shadowColor: '#5A2314',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F7EFE9',
  },
  dateTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateTimeText: {
    color: aura.darkCoffee,
    fontSize: 12,
    fontWeight: '800',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  upcomingBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  upcomingAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: aura.darkCoffee,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingCoachName: {
    color: aura.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  upcomingLevelText: {
    color: aura.muted,
    fontSize: 12,
    marginTop: 2,
  },
  upcomingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F7EFE9',
  },
  upcomingActionText: {
    color: aura.darkCoffee,
    fontSize: 12,
    fontWeight: '900',
  },

  // Upcoming Card (Empty)
  upcomingCardEmpty: {
    backgroundColor: aura.white,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: aura.border,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: aura.latte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: aura.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  emptySub: {
    color: aura.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  bookNowBtn: {
    backgroundColor: aura.latte,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  bookNowText: {
    color: aura.darkCoffee,
    fontSize: 12,
    fontWeight: '900',
  },

  // Services Container & Cards
  servicesContainer: {
    gap: 11,
  },
  serviceCard: {
    backgroundColor: aura.white,
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    borderWidth: 1,
    borderColor: aura.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  serviceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: aura.latte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceContent: {
    flex: 1,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceTitle: {
    color: aura.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  serviceDesc: {
    color: aura.muted,
    fontSize: 11.5,
    lineHeight: 16.5,
    marginTop: 4,
  },
  serviceTag: {
    alignSelf: 'flex-start',
    backgroundColor: aura.cream,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 7,
  },
  serviceTagText: {
    color: aura.caramel,
    fontSize: 10,
    fontWeight: '800',
  },

  // Membership Card
  membershipCard: {
    backgroundColor: aura.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: aura.border,
    gap: 11,
    marginBottom: 10,
  },
  membershipTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  membershipBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: aura.latte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipName: {
    color: aura.ink,
    fontSize: 14.5,
    fontWeight: '900',
  },
  membershipValidity: {
    color: aura.muted,
    fontSize: 11.5,
    lineHeight: 16.5,
    marginTop: 3,
  },
  membershipBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#F6EEE8',
  },
  membershipLinkText: {
    color: aura.darkCoffee,
    fontSize: 12,
    fontWeight: '900',
  },

  // Quick Action Buttons
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: aura.white,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: aura.border,
  },
  quickActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: aura.latte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    color: aura.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  quickActionSub: {
    color: aura.muted,
    fontSize: 10,
    marginTop: 1,
  },
});
