import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Page, Section } from '../../components/ui';
import { ArticleRail } from '../../components/editorial';
import { CoachHomeView } from '../../components/CoachHomeView';
import { HomeHeader } from '../../components/HomeHeader';
import { useAuth } from '../../lib/auth';
import { aura, money } from '../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 385;

const HERO_BANNERS = [
  { source: require('../../../assets/images/home-hero.jpg'), focusX: 0.66, focusY: 0.44 },
  { source: require('../../../assets/images/strength.jpg'), focusX: 0.62, focusY: 0.42 },
  { source: require('../../../assets/images/news-gym.jpg'), focusX: 0.52, focusY: 0.5 },
];

function bannerImageFrame(
  source: number,
  focusX: number,
  focusY: number,
  frameWidth: number,
  frameHeight: number,
) {
  const asset = Image.resolveAssetSource(source);
  const width = asset?.width || frameWidth;
  const height = asset?.height || frameHeight;
  const scale = Math.max(frameWidth / width, frameHeight / height);
  const imageWidth = width * scale;
  const imageHeight = height * scale;

  return {
    position: 'absolute' as const,
    width: imageWidth,
    height: imageHeight,
    left: Math.max(frameWidth - imageWidth, Math.min(0, frameWidth / 2 - focusX * imageWidth)),
    top: Math.max(frameHeight - imageHeight, Math.min(0, frameHeight / 2 - focusY * imageHeight)),
  };
}

function AnimatedHeroBanner({ onIndexChange }: { onIndexChange: (idx: number) => void }) {
  const [opacities] = useState(() => HERO_BANNERS.map((_, index) => new Animated.Value(index === 0 ? 1 : 0)));
  const [frame, setFrame] = useState({ width: SCREEN_WIDTH - 32, height: HERO_HEIGHT });
  useEffect(() => {
    let currentIndex = 0;
    let timeout: ReturnType<typeof setTimeout>;
    let transition: Animated.CompositeAnimation | undefined;
    let mounted = true;

    const scheduleNext = () => {
      timeout = setTimeout(() => {
        const nextIndex = (currentIndex + 1) % HERO_BANNERS.length;
        transition = Animated.parallel([
          Animated.timing(opacities[currentIndex], {
            toValue: 0,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(opacities[nextIndex], {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ]);
        transition.start(({ finished }) => {
          if (!finished || !mounted) return;
          currentIndex = nextIndex;
          onIndexChange(nextIndex);
          scheduleNext();
        });
      }, 4000);
    };

    scheduleNext();

    return () => {
      mounted = false;
      clearTimeout(timeout);
      transition?.stop();
    };
  }, [onIndexChange, opacities]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent: { layout } }) => {
        setFrame(current => current.width === layout.width && current.height === layout.height
          ? current
          : { width: layout.width, height: layout.height });
      }}
    >
      {HERO_BANNERS.map(({ source, focusX, focusY }, index) => (
        <Animated.Image
          key={index}
          source={source}
          style={[
            bannerImageFrame(source, focusX, focusY, frame.width, frame.height),
            { opacity: opacities[index] },
          ]}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

// 1. Interactive Animated Pressable (Spring feedback on touch)
function BouncyCard({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', height: '100%' }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// 2. Animated Entrance Wrapper (Staggered Fade In + Slide Up)
function FadeInUp({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(20));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 6,
        tension: 40,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// Danh mục chuyên môn tập Gym & Thể hình - Phong cách Athletic Coding chuyên nghiệp
const CATEGORIES = [
  { name: 'TĂNG CƠ', label: 'Hypertrophy', code: 'HYP', color: '#D84315', bg: '#FBE9E7' },
  { name: 'SỨC MẠNH', label: 'Powerlifting', code: 'PWR', color: '#4E342E', bg: '#EFEBE9' },
  { name: 'SIẾT MỠ', label: 'Cắt Nét & HIIT', code: 'CUT', color: '#C62828', bg: '#FFEBEE' },
  { name: 'HLV 1:1', label: 'Kèm Riêng', code: '1:1', color: '#5D4037', bg: '#D7CCC8' },
  { name: 'CARDIO', label: 'Thể Lực Chạy', code: 'RUN', color: '#E65100', bg: '#FFF3E0' },
  { name: 'CHỨC NĂNG', label: 'Functional', code: 'FNC', color: '#1565C0', bg: '#E3F2FD' },
  { name: 'NHẬP MÔN', label: 'Form Kỹ Thuật', code: 'NEW', color: '#00796B', bg: '#E0F2F1' },
  { name: 'GIÃN CƠ', label: 'Phục Hồi', code: 'REC', color: '#6A1B9A', bg: '#F3E5F5' },
];

export default function Home() {
  const { user, refreshSession, refreshUnreadCount } = useAuth();
  const insets = useSafeAreaInsets();
  const [promoWidth, setPromoWidth] = useState(0);
  const [promoPage, setPromoPage] = useState(0);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshSession?.(),
        refreshUnreadCount?.(),
        new Promise(resolve => setTimeout(resolve, 750)),
      ]);
    } catch (err) {
      console.log('Error refreshing home:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshSession, refreshUnreadCount]);

  const scrollRef = useRef<ScrollViewInstance>(null);

  // Hiệu ứng thở nhẹ (Pulsing Glow) cho huy hiệu & điểm nhấn
  const [pulseAnim] = useState(() => new Animated.Value(1));
  // Hiệu ứng lắc lư nhẹ cho mũi tên khám phá
  const [bounceX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Arrow bounce animation
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceX, {
          toValue: 5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(bounceX, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    bounceLoop.start();

    return () => {
      pulseLoop.stop();
      bounceLoop.stop();
    };
  }, [bounceX, pulseAnim]);

  // Tự động chuyển slide banner khuyến mãi sau mỗi 4 giây
  useEffect(() => {
    if (promoWidth === 0) return;
    const interval = setInterval(() => {
      setPromoPage(prev => {
        const nextPage = (prev + 1) % 3;
        scrollRef.current?.scrollTo({ x: nextPage * promoWidth, animated: true });
        return nextPage;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [promoWidth]);

  const roleStr = String(user?.role || '').toUpperCase().trim();
  const isCoach = roleStr === 'COACH' || roleStr === 'TRAINER' || roleStr === 'PT' || roleStr === 'HLV';

  if (__DEV__) {
    console.log('[Home Tab] User:', user?.email, 'Role:', user?.role, 'isCoach:', isCoach);
  }

  if (isCoach) {
    return <CoachHomeView />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: aura.cream }}>
      <HomeHeader />
      <Page refresh={onRefresh} refreshing={refreshing}>
        {/* 2. Hero banner ảnh chuyển động nhẹ */}
      <FadeInUp delay={80}>
        <View style={styles.heroWrapper}>
          <View style={styles.heroMediaContainer}>
            <AnimatedHeroBanner onIndexChange={setActiveBannerIdx} />

            {/* Gradient nhẹ để chữ dễ đọc trên ảnh */}
            <LinearGradient
              colors={['#00000045', 'transparent', 'transparent', '#140A07E6']}
              locations={[0, 0.2, 0.65, 1]}
              style={styles.heroGradientOverlay}
            >
              {/* Header Badges: Nhỏ gọn, tinh tế góc trên */}
              <View style={styles.heroBadgeRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <View style={styles.liveRecordBadge}>
                      <View style={styles.liveRecordDot} />
                      <Text style={styles.liveRecordText}>AURA GYM</Text>
                    </View>
                  </Animated.View>

                  {/* Chỉ báo ảnh banner hiện tại */}
                  <View style={styles.bannerSegmentContainer}>
                    {HERO_BANNERS.map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.bannerSegmentBar,
                          activeBannerIdx === idx && styles.bannerSegmentBarActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <Pressable
                  onPress={() => router.push('/classes')}
                  style={styles.heroQuickBadge}
                >
                  <Text style={styles.heroQuickBadgeText}>Xem ca tập</Text>
                  <Ionicons name="arrow-forward" size={12} color="#fff" />
                </Pressable>
              </View>

              {/* Tiêu đề và nút bấm trên banner */}
              <View style={styles.heroBottomBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroHeadingSmall}>BỨT PHÁ THỂ LỰC</Text>
                  <Text style={styles.heroSubSmall}>Dàn tạ Rogue & Máy khối chuyên nghiệp</Text>
                </View>

                <Pressable
                  onPress={() => router.push('/pt')}
                  style={styles.heroMiniCta}
                >
                  <Ionicons name="flash" size={13} color={aura.darkCoffee} />
                  <Text style={styles.heroMiniCtaText}>Tập ngay</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </FadeInUp>

      {/* 3. Dịch Vụ & Đặc Quyền (Phong cách Editorial Typography - Bỏ Icon Rập Khuôn) */}
      <FadeInUp delay={160}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.editorialStripContainer}
        >
          {[
            {
              index: '01',
              tag: 'VIP PASS',
              title: 'AuraRewards',
              desc: 'Tích điểm VIP Gym',
              articleId: 'rewards',
              featured: true,
            },
            {
              index: '02',
              tag: 'BẢNG GIÁ',
              title: 'Bảng Giá Thẻ',
              desc: 'Gói Gym & PT 1:1',
              articleId: 'pricing',
              featured: false,
            },
            {
              index: '03',
              tag: 'THIẾT BỊ',
              title: 'Cơ Sở Vật Chất',
              desc: 'Dàn tạ & máy khối',
              articleId: 'about',
              featured: false,
            },
            {
              index: '04',
              tag: 'QUY CHUẨN',
              title: 'Quy Định Tập',
              desc: 'Form chuẩn an toàn',
              articleId: 'booking',
              featured: false,
            },
          ].map(item => (
            <BouncyCard
              key={item.title}
              onPress={() => router.push({ pathname: '/article', params: { id: item.articleId } })}
              style={[
                styles.editorialCard,
                item.featured ? styles.editorialCardFeatured : styles.editorialCardStandard,
              ]}
            >
              <View style={styles.editorialCardTopRow}>
                <Text
                  style={[
                    styles.editorialIndexNum,
                    item.featured ? styles.textLatteAccent : styles.textCaramelAccent,
                  ]}
                >
                  {item.index}
                </Text>
                <View
                  style={[
                    styles.editorialTagPill,
                    item.featured ? styles.editorialTagPillFeatured : styles.editorialTagPillStandard,
                  ]}
                >
                  <Text
                    style={[
                      styles.editorialTagPillText,
                      item.featured ? styles.textWhite : styles.textCoffee,
                    ]}
                  >
                    {item.tag}
                  </Text>
                </View>
              </View>

              <View style={styles.editorialCardContent}>
                <Text
                  style={[
                    styles.editorialCardTitle,
                    item.featured ? styles.textWhite : styles.textInk,
                  ]}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.editorialCardDesc,
                    item.featured ? styles.textLatteMuted : styles.textMutedDark,
                  ]}
                  numberOfLines={2}
                >
                  {item.desc}
                </Text>
              </View>

              <View style={styles.editorialCardFooter}>
                <Text
                  style={[
                    styles.editorialLinkText,
                    item.featured ? styles.textLatteAccent : styles.textCoffee,
                  ]}
                >
                  Chi tiết
                </Text>
                <Text
                  style={[
                    styles.editorialLinkArrow,
                    item.featured ? styles.textLatteAccent : styles.textCoffee,
                  ]}
                >
                  →
                </Text>
              </View>
            </BouncyCard>
          ))}
        </ScrollView>
      </FadeInUp>

      {/* 4. Khám Phá Chuyên Mục Gym (Thẻ Athletic Code Thay Cho Icon) */}
      <FadeInUp delay={220}>
        <View style={styles.sectionHeaderRow}>
          <Section title="CHUYÊN MỤC TẬP GYM" subtitle="Lựa chọn mục tiêu phát triển hình thể của bạn" />
        </View>

        <View style={styles.categoriesGrid}>
          {CATEGORIES.map(cat => (
            <BouncyCard
              key={cat.name}
              onPress={() => router.push({ pathname: '/classes', params: { category: cat.name } })}
              style={styles.categoryCardWrap}
            >
              <View style={styles.categoryCardInner}>
                <View style={[styles.categoryCodeBadge, { backgroundColor: cat.bg, borderColor: cat.color + '45' }]}>
                  <Text style={[styles.categoryCodeText, { color: cat.color }]}>{cat.code}</Text>
                </View>
                <Text style={styles.categoryCardName}>{cat.name}</Text>
                <Text style={styles.categoryCardSub}>{cat.label}</Text>
              </View>
            </BouncyCard>
          ))}
        </View>
      </FadeInUp>

      {/* 5. Tự Động Chuyển Slide Khuyến Mãi & Sự Kiện Gym (Auto Carousel) */}
      <FadeInUp delay={280}>
        <View
          onLayout={event => setPromoWidth(event.nativeEvent.layout.width)}
          style={styles.promoCarouselContainer}
        >
          {promoWidth > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
                setPromoPage(Math.round(event.nativeEvent.contentOffset.x / promoWidth))
              }
            >
              {[
                {
                  tag: 'AURA POWERLIFTING',
                  title: 'GIẢI ĐẤU SQUAT & BENCH',
                  subtitle: 'Tranh tài sức mạnh mùa hè sôi động',
                  highlight: 'TỔNG GIẢI 50 TRIỆU',
                  colors: ['#2F140C', '#4F2316'] as const,
                  dark: true,
                  icon: 'barbell' as const,
                },
                {
                  tag: 'GYM PASS VIP',
                  title: 'TẬP GYM KHÔNG GIỚI HẠN',
                  subtitle: 'Ưu đãi giảm 50% tháng đầu trải nghiệm dàn máy',
                  highlight: 'THẺ GYM TOÀN NĂNG',
                  colors: [aura.espresso, aura.caramel] as const,
                  dark: true,
                  icon: 'ribbon' as const,
                },
                {
                  tag: 'HLV GYM 1:1',
                  title: 'THỬ THÁCH SIẾT CƠ 30 NGÀY',
                  subtitle: 'Tặng 3 buổi tập riêng cùng Master Coach',
                  highlight: 'TẶNG 3 BUỔI PT',
                  colors: ['#421A10', '#632B1B'] as const,
                  dark: true,
                  icon: 'flame' as const,
                },
              ].map(item => (
                <Pressable
                  key={item.tag}
                  onPress={() => router.push('/packages')}
                  style={{ width: promoWidth, height: 160 }}
                >
                  <LinearGradient colors={item.colors} style={styles.promoSlideInner}>
                    <View style={styles.promoHeaderRow}>
                      <Text style={styles.promoSponsorText}>Sự kiện thể hình</Text>
                      <View style={styles.promoTagBadge}>
                        <Text style={styles.promoTagText}>{item.tag}</Text>
                      </View>
                    </View>

                    <View style={styles.promoBodyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.promoTitle}>{item.title}</Text>
                        <Text style={styles.promoSub}>{item.subtitle}</Text>
                        <Text style={styles.promoHighlight}>{item.highlight}</Text>
                      </View>
                      <View style={styles.promoIconContainer}>
                        <Ionicons name={item.icon} size={38} color="#FFD487" />
                      </View>
                    </View>

                    {/* Animated Dots Indicator */}
                    <View style={styles.promoDotsContainer}>
                      {[0, 1, 2].map(dot => (
                        <View
                          key={dot}
                          style={[
                            styles.promoDot,
                            dot === promoPage && styles.promoDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </FadeInUp>

      {/* 6. Chọn Định Hướng Tập Gym (Hero Cards Ngang) */}
      <FadeInUp delay={340}>
        <Section title="ĐỊNH HƯỚNG TẬP GYM" subtitle="Lựa chọn lộ trình tập luyện phù hợp với thể trạng" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.journeyHorizontalScroll}
        >
          {[
            {
              title: 'HYPERTROPHY & TĂNG CƠ',
              image: require('../../../assets/images/news-gym.jpg'),
              eyebrow: 'PHÁT TRIỂN CƠ BẮP TOÀN DIỆN',
              subtitle: 'Kỹ thuật cô lập nhóm cơ chuẩn xác và tối ưu phì đại cơ bắp',
              category: 'TĂNG CƠ',
            },
            {
              title: 'STRENGTH & POWERLIFTING',
              image: require('../../../assets/images/strength.jpg'),
              eyebrow: 'BỨT PHÁ GIỚI HẠN MỨC TẠ',
              subtitle: 'Chinh phục Squat, Bench Press, Deadlift với form chuẩn thi đấu',
              category: 'SỨC MẠNH',
            },
          ].map(item => (
            <BouncyCard
              key={item.title}
              onPress={() => router.push({ pathname: '/classes', params: { category: item.category } })}
              style={styles.journeyCardWrap}
            >
              <ImageBackground source={item.image} style={styles.journeyCardBg} imageStyle={{ borderRadius: 22 }}>
                <LinearGradient
                  colors={['#00000000', '#25100BEE']}
                  locations={[0.25, 1]}
                  style={styles.journeyCardGradient}
                >
                  <Text style={styles.journeyEyebrow}>{item.eyebrow}</Text>
                  <Text style={styles.journeyTitle}>{item.title}</Text>
                  <Text style={styles.journeySub}>{item.subtitle}</Text>
                  <View style={styles.journeyCta}>
                    <Text style={styles.journeyCtaText}>Xem ca tập Gym ngay</Text>
                    <Ionicons name="arrow-forward" size={13} color="#FFD6B4" />
                  </View>
                </LinearGradient>
              </ImageBackground>
            </BouncyCard>
          ))}
        </ScrollView>
      </FadeInUp>

      {/* 7. Dinh Dưỡng Thể Hình & Phục Hồi (Aura Coach Care) */}
      <FadeInUp delay={400}>
        <Card style={styles.nutritionCard}>
          <View style={styles.nutritionRow}>
            <View style={styles.nutritionIconWrap}>
              <Ionicons name="nutrition" size={26} color={aura.darkCoffee} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nutritionTitle}>Dinh Dưỡng Thể Hình & Tăng Cơ</Text>
              <Text style={styles.nutritionSub}>
                Tính toán Macro (Protein, Carbs, Fat) chuẩn khoa học kết hợp giáo án tập Gym cùng Coach.
              </Text>
            </View>
          </View>
          <View style={styles.nutritionBtnWrap}>
            <Button
              title="Xem giáo án & thực đơn macro của tôi"
              secondary
              icon="restaurant-outline"
              onPress={() => router.push('/progress?plansOnly=1')}
            />
          </View>
        </Card>
      </FadeInUp>

      <Card style={{ marginTop: 14, padding: 16, borderRadius: 18 }}>
        <Text style={{ color: aura.ink, fontSize: 17, fontWeight: '900' }}>Kiểm tra kỹ thuật Squat bằng AI</Text>
        <Text style={{ color: aura.muted, marginTop: 5 }}>Quay hoặc tải video và xem nhận xét dựa trên chuyển động thực tế.</Text>
        <Button title="Kiểm tra kỹ thuật" onPress={() => router.push('/exercise-analysis')} />
      </Card>

      {/* 8. Bài Viết & Kiến Thức Tập Luyện (News & Guides) */}
      <FadeInUp delay={460}>
        <ArticleRail kind="news" />
        <ArticleRail kind="guides" />
      </FadeInUp>

      <View style={{ height: 28 }} />
    </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header Container
  headerContainer: {
    backgroundColor: aura.darkCoffee,
    marginHorizontal: -16,
    marginTop: -16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    padding: 16,
    paddingBottom: 26,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF22',
    borderWidth: 1.5,
    borderColor: '#FFFFFF44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeGreeting: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  welcomeSub: {
    color: '#FFD6B4D0',
    fontSize: 11,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF20',
    borderWidth: 1,
    borderColor: '#FFFFFF33',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  balanceText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  notificationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF18',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF5252',
  },
  authButtonsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 16,
  },
  authBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authBtnPrimary: {
    backgroundColor: aura.white,
  },
  authBtnPrimaryText: {
    color: aura.darkCoffee,
    fontWeight: '900',
    fontSize: 12.5,
  },
  authBtnSecondary: {
    backgroundColor: '#FFFFFF25',
    borderWidth: 1,
    borderColor: '#FFFFFF40',
  },
  authBtnSecondaryText: {
    color: aura.white,
    fontWeight: '800',
    fontSize: 12.5,
  },

  // Hero Section
  heroWrapper: {
    marginTop: 14,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#5A2314',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },
  heroMediaContainer: {
    height: HERO_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: aura.darkCoffee,
  },
  heroBackground: {
    height: 310,
  },
  heroGradientOverlay: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  liveRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00000065',
    borderColor: '#FFFFFF30',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveRecordDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  liveRecordText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bannerSegmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00000065',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF30',
  },
  bannerSegmentBar: {
    width: 13,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF40',
  },
  bannerSegmentBarActive: {
    width: 22,
    backgroundColor: '#FFD487',
  },
  heroQuickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#00000065',
    borderColor: '#FFFFFF30',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroQuickBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  heroBottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 4,
  },
  heroHeadingSmall: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.4,
    textShadowColor: '#00000099',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 5,
  },
  heroSubSmall: {
    color: '#FFD6B4F0',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    textShadowColor: '#00000099',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMiniCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  heroMiniCtaText: {
    color: aura.darkCoffee,
    fontWeight: '900',
    fontSize: 12.5,
  },

  // Editorial Service Strip (Bỏ Icon Rập Khuôn, Form Nhỏ Gọn Tinh Tế)
  editorialStripContainer: {
    paddingVertical: 5,
    gap: 8,
  },
  editorialCard: {
    width: 122,
    height: 84,
    borderRadius: 14,
    padding: 8,
    justifyContent: 'space-between',
  },
  editorialCardFeatured: {
    backgroundColor: aura.darkCoffee,
    borderWidth: 1,
    borderColor: '#FFFFFF22',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  editorialCardStandard: {
    backgroundColor: aura.white,
    borderWidth: 1,
    borderColor: '#EAE2DA',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  editorialCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorialIndexNum: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  editorialTagPill: {
    paddingHorizontal: 5.5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  editorialTagPillFeatured: {
    backgroundColor: '#FFFFFF20',
    borderWidth: 1,
    borderColor: '#FFFFFF30',
  },
  editorialTagPillStandard: {
    backgroundColor: '#F5EEE6',
    borderWidth: 1,
    borderColor: '#E8DCCE',
  },
  editorialTagPillText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  editorialCardContent: {
    marginTop: 1,
  },
  editorialCardTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  editorialCardDesc: {
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
  },
  editorialCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#0000000A',
    paddingTop: 3,
    marginTop: 1,
  },
  editorialLinkText: {
    fontSize: 9,
    fontWeight: '800',
  },
  editorialLinkArrow: {
    fontSize: 10,
    fontWeight: '900',
  },
  textLatteAccent: {
    color: '#FFD6B4',
  },
  textCaramelAccent: {
    color: aura.caramel,
  },
  textLatteMuted: {
    color: '#E8D5C8',
  },
  textMutedDark: {
    color: aura.muted,
  },
  textInk: {
    color: aura.ink,
  },
  textCoffee: {
    color: aura.coffee,
  },
  textWhite: {
    color: aura.white,
  },
  textDark: {
    color: aura.ink,
  },
  textLatte: {
    color: '#FFD6B4',
  },
  textMuted: {
    color: aura.muted,
  },

  // Category Grid (Athletic Code Badges)
  sectionHeaderRow: {
    marginTop: 10,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  categoryCardWrap: {
    width: (SCREEN_WIDTH - 32 - 24) / 4,
    height: 86,
  },
  categoryCardInner: {
    flex: 1,
    backgroundColor: aura.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: aura.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
    marginBottom: 4,
  },
  categoryCodeText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  categoryCardName: {
    color: aura.ink,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  categoryCardSub: {
    color: aura.muted,
    fontSize: 8.5,
    textAlign: 'center',
    marginTop: 1,
  },

  // Promo Carousel
  promoCarouselContainer: {
    marginTop: 18,
    height: 160,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#5A2314',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  promoSlideInner: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  promoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoSponsorText: {
    color: '#FFFFFF99',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  promoTagBadge: {
    backgroundColor: '#FFFFFF25',
    borderWidth: 1,
    borderColor: '#FFFFFF44',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  promoTagText: {
    color: '#FFD487',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  promoBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoTitle: {
    color: aura.white,
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  promoSub: {
    color: '#FFFFFFB3',
    fontSize: 10.5,
    marginTop: 2,
  },
  promoHighlight: {
    color: '#FFD487',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 3,
  },
  promoIconContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  promoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF44',
  },
  promoDotActive: {
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFD487',
  },

  // Journey Cards (Yoga / Strength)
  journeyHorizontalScroll: {
    gap: 12,
    paddingVertical: 2,
  },
  journeyCardWrap: {
    width: 290,
    height: 220,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  journeyCardBg: {
    flex: 1,
  },
  journeyCardGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  journeyEyebrow: {
    color: '#FFD6B4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  journeyTitle: {
    color: aura.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  journeySub: {
    color: '#FFFFFFE0',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },
  journeyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  journeyCtaText: {
    color: '#FFD6B4',
    fontSize: 12,
    fontWeight: '800',
  },

  // Nutrition Card
  nutritionCard: {
    backgroundColor: aura.latte,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D4C2',
    marginTop: 14,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nutritionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionTitle: {
    color: aura.darkCoffee,
    fontSize: 16,
    fontWeight: '900',
  },
  nutritionSub: {
    color: aura.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  nutritionBtnWrap: {
    marginTop: 12,
  },
});
