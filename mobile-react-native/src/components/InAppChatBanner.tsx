import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aura } from '../lib/theme';
import { api } from '../lib/api';
import { useAuth, type InAppBannerPayload } from '../lib/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function InAppChatBanner() {
  const { inAppBanner, dismissBanner, user, unreadCount, unreadChatCount, setUnreadCount, setUnreadChatCount, refreshUnreadChatCount } = useAuth();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (inAppBanner) {
      if (timerRef.current) clearTimeout(timerRef.current);

      // Slide in from top
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Tồn tại trong vòng đúng 3 giây (3000ms) rồi tự động ẩn đi theo yêu cầu người dùng
      timerRef.current = setTimeout(() => {
        hideBanner();
      }, 3000);
    } else {
      hideBanner(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inAppBanner]);

  const hideBanner = (callDismiss = true) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callDismiss) dismissBanner();
    });
  };

  const handlePress = async () => {
    if (!inAppBanner) return;
    const { type, partnerId, notificationId } = inAppBanner;
    hideBanner();

    if (type === 'CHAT' && partnerId) {
      // 1. Đánh dấu đã đọc ngay lập tức ở thanh đếm tin nhắn
      setUnreadChatCount(Math.max(0, unreadChatCount - 1));
      const roleStr = String(user?.role || '').toUpperCase().trim();
      const isCoach = roleStr === 'COACH' || roleStr === 'TRAINER' || roleStr === 'PT' || roleStr === 'HLV';
      // 2. Truy cập trực tiếp vào nội dung cuộc trò chuyện luôn
      router.push({
        pathname: '/pt-chat',
        params: {
          partnerId: String(partnerId),
          partnerName: inAppBanner.title,
          memberId: String(isCoach ? partnerId : user?.id || ''),
          coachId: String(isCoach ? user?.id || '' : partnerId),
        },
      });
    } else {
      // 1. Đánh dấu thông báo là đã đọc ngay lập tức trên máy chủ và cập nhật số đếm
      if (notificationId) {
        try {
          await api.readNotification(notificationId);
        } catch {
          // ignore
        }
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
      // 2. Truy cập vào nội dung thông báo luôn
      router.push({
        pathname: '/(tabs)/notifications',
        params: notificationId ? { highlightId: String(notificationId) } : undefined,
      });
    }
  };

  if (!inAppBanner) return null;

  const isChat = inAppBanner.type === 'CHAT';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 6,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={[
          styles.card,
          isChat ? styles.chatCard : styles.notifCard,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isChat
            ? `Tin nhắn mới từ ${inAppBanner.title}`
            : `Thông báo mới: ${inAppBanner.title}`
        }
      >
        {/* Avatar / Icon Container */}
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isChat ? aura.darkCoffee : aura.caramel },
          ]}
        >
          <Ionicons
            name={isChat ? 'chatbubbles' : 'notifications'}
            size={22}
            color="#fff"
          />
          <View
            style={[
              styles.activeDot,
              { backgroundColor: isChat ? '#00C853' : '#FFB300' },
            ]}
          />
        </View>

        {/* Nội dung thông báo kiểu Zalo/Messenger */}
        <View style={styles.contentWrap}>
          <View style={styles.headerRow}>
            <View style={styles.badgeRow}>
              <Text
                style={[
                  styles.categoryBadge,
                  { color: isChat ? aura.coffee : aura.caramel },
                ]}
              >
                {isChat ? 'TIN NHẮN' : 'THÔNG BÁO'}
              </Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.senderName} numberOfLines={1}>
                {inAppBanner.title}
              </Text>
            </View>
            <Text style={styles.timeTag}>Vừa xong</Text>
          </View>
          <Text style={styles.messageSnippet} numberOfLines={2}>
            {inAppBanner.content || (isChat ? 'Đã gửi một tin nhắn' : 'Chạm để xem chi tiết thông báo')}
          </Text>
        </View>

        {/* Nút đóng nhanh hoặc điều hướng */}
        <Pressable
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation();
            hideBanner();
          }}
          style={styles.closeBtn}
          accessibilityLabel="Đóng thông báo"
        >
          <Ionicons name="close" size={16} color={aura.muted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export { InAppChatBanner as InAppBanner };

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 999999,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatCard: {
    borderColor: '#E8D4C2',
  },
  notifCard: {
    borderColor: '#EAD9C6',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  contentWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  dotSeparator: {
    fontSize: 10,
    color: aura.muted,
    marginHorizontal: 4,
  },
  senderName: {
    color: aura.ink,
    fontSize: 13.5,
    fontWeight: '900',
    flex: 1,
  },
  timeTag: {
    color: aura.muted,
    fontSize: 10.5,
    fontWeight: '600',
  },
  messageSnippet: {
    color: '#424242',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F3EDE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
