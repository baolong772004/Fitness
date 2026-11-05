import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, sessionStore, SOCKET_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dateLabel, timeLabel } from '../lib/theme';
import { Button, Empty } from '../components/ui';
import { AuraLoader } from '../components/AuraLoader';
import { PtConversation, type PtChatBooking } from '../components/PtConversation';

type ConversationItem = {
  key: string;
  memberId: number;
  coachId: number;
  partner: { id: number; fullName: string; role?: string; phone?: string; avatar?: string };
  canSend: boolean;
  chatType?: 'PAID' | 'TRIAL' | 'EXPIRED' | 'NONE';
  reason?: string;
  latestBookingId?: number | null;
  latestBookingTime?: string | null;
  lastMessage?: { id: number; content: string; createdAt: string; senderId: number; readAt?: string | null } | null;
  unreadCount?: number;
};

function getInitials(name?: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatChatTime(dateVal: unknown) {
  if (!dateVal) return '';
  const d = new Date(String(dateVal));
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (startDay === startToday) return timeLabel(dateVal);
  if (startDay === startToday - 86400000) return 'Hôm qua';
  return dateLabel(dateVal);
}

export default function PtChat() {
  const {
    booking: rawBooking,
    coachId: rawCoachId,
    memberId: rawMemberId,
    partnerId: rawPartnerId,
    partnerName: rawPartnerName,
  } = useLocalSearchParams<{
    booking?: string;
    coachId?: string;
    memberId?: string;
    partnerId?: string;
    partnerName?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user, ready, refreshUnreadChatCount } = useAuth();
  const isCoach = ['COACH', 'TRAINER', 'PT', 'HLV'].includes(String(user?.role || '').toUpperCase().trim());

  const [filter, setFilter] = useState<'ALL' | 'READ' | 'UNREAD'>('ALL');

  const preferredBooking = useMemo(() => {
    try { return JSON.parse(rawBooking || '{}'); }
    catch { return null; }
  }, [rawBooking]);

  const initialTargetPartnerId = useMemo(() => {
    if (rawPartnerId && Number(rawPartnerId) > 0) return Number(rawPartnerId);
    if (rawCoachId && !isCoach) return Number(rawCoachId);
    if (rawMemberId && isCoach) return Number(rawMemberId);
    if (rawCoachId) return Number(rawCoachId);
    if (rawMemberId) return Number(rawMemberId);
    if (preferredBooking?.coachId && !isCoach) return Number(preferredBooking.coachId);
    if (preferredBooking?.memberId && isCoach) return Number(preferredBooking.memberId);
    return null;
  }, [rawPartnerId, rawCoachId, rawMemberId, preferredBooking, isCoach]);

  // Quản lý partner đang mở trong local state để có thể trở về danh sách mượt mà
  const [activePartnerId, setActivePartnerId] = useState<number | null>(initialTargetPartnerId);

  const initialPairKey = useMemo(() => {
    if (!activePartnerId || !user) return null;
    const mId = isCoach ? activePartnerId : user.id;
    const cId = isCoach ? user.id : activePartnerId;
    return `${mId}:${cId}`;
  }, [activePartnerId, user, isCoach]);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedPair, setSelectedPair] = useState<string | null>(initialPairKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (skipAutoSelect = false) => {
    if (!user) { setConversations([]); setSelectedPair(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let listItems: ConversationItem[] = [];

      try {
        const res = await api.ptConversations();
        if (Array.isArray(res.data) && res.data.length > 0) {
          listItems = res.data;
        }
      } catch { /* Fallback to local bookings/wallet query */ }

      // If backend returned empty or not ready, fallback to synthesizing from bookings + wallet
      if (listItems.length === 0) {
        const [bookings, wallet] = await Promise.all([
          api.ptBookings().catch(() => []) as Promise<any[]>,
          isCoach ? Promise.resolve(null) : api.ptWallet().catch(() => null),
        ]);

        const map = new Map<string, ConversationItem>();

        // From bookings
        for (const b of bookings) {
          if (!b.coachId || !b.memberId) continue;
          const key = `${b.memberId}:${b.coachId}`;
          const partnerId = isCoach ? b.memberId : b.coachId;
          const partnerName = isCoach ? b.member?.fullName || 'Hội viên' : b.coach?.fullName || 'Huấn luyện viên PT';
          if (!map.has(key)) {
            map.set(key, {
              key,
              memberId: b.memberId,
              coachId: b.coachId,
              partner: { id: partnerId, fullName: partnerName },
              canSend: true,
              chatType: 'PAID',
              latestBookingId: b.id,
              latestBookingTime: b.startTime,
            });
          }
        }

        // From wallet active packages (for members who bought PT Paid with a coach but haven't booked yet)
        if (wallet?.sources) {
          for (const s of wallet.sources) {
            if (s.coachId && s.status === 'ACTIVE') {
              const key = `${user.id}:${s.coachId}`;
              if (!map.has(key)) {
                map.set(key, {
                  key,
                  memberId: user.id,
                  coachId: s.coachId,
                  partner: { id: s.coachId, fullName: 'Huấn luyện viên PT' },
                  canSend: true,
                  chatType: 'PAID',
                  reason: 'Gói PT Paid đang hoạt động',
                });
              }
            }
          }
        }

        listItems = Array.from(map.values());
      }

      // Tự động mở cuộc trò chuyện nếu có activePartnerId ban đầu
      if (activePartnerId && !skipAutoSelect) {
        const existing = listItems.find(item =>
          isCoach ? item.memberId === activePartnerId : item.coachId === activePartnerId
        );
        if (existing) {
          setSelectedPair(existing.key);
        } else {
          const memberId = isCoach ? activePartnerId : user.id;
          const coachId = isCoach ? user.id : activePartnerId;
          const key = `${memberId}:${coachId}`;
          const partnerName = preferredBooking?.coach?.fullName || preferredBooking?.member?.fullName || (isCoach ? 'Hội viên' : 'Huấn luyện viên PT');
          const newItem: ConversationItem = {
            key,
            memberId,
            coachId,
            partner: { id: activePartnerId, fullName: partnerName },
            canSend: true,
            chatType: 'PAID',
            latestBookingId: preferredBooking?.id || null,
          };
          listItems.unshift(newItem);
          setSelectedPair(key);
        }
      }

      setConversations(listItems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách tin nhắn.');
    } finally { setLoading(false); }
  }, [user, isCoach, activePartnerId, preferredBooking]);

  useFocusEffect(useCallback(() => { if (ready) { void load(); void refreshUnreadChatCount(); } }, [ready, load, refreshUnreadChatCount]));

  // Kết nối socket realtime cho trang chat tổng để cập nhật tin nhắn mới nhất
  useEffect(() => {
    const token = sessionStore.token();
    if (!user || !token) return;

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('chat:message', (newMsg: any) => {
      if (!newMsg) return;
      const senderId = Number(newMsg.senderId);
      const isMine = senderId === Number(user.id);
      const targetPartner = isMine
        ? Number(newMsg.recipientId || (isCoach ? newMsg.memberId : newMsg.coachId))
        : senderId;

      setConversations(prev => {
        const index = prev.findIndex(item =>
          (isCoach ? item.memberId === targetPartner : item.coachId === targetPartner) ||
          item.memberId === senderId || item.coachId === senderId
        );

        if (index !== -1) {
          const target = prev[index];
          const updatedItem: ConversationItem = {
            ...target,
            lastMessage: {
              id: Number(newMsg.id),
              content: String(newMsg.content || ''),
              createdAt: newMsg.createdAt || new Date().toISOString(),
              senderId,
              readAt: newMsg.readAt || null,
            },
            unreadCount: isMine ? (target.unreadCount || 0) : (target.unreadCount || 0) + 1,
          };
          // Đưa hội thoại có tin nhắn mới nhất lên đầu danh sách
          const rest = prev.filter((_, idx) => idx !== index);
          return [updatedItem, ...rest];
        }

        // Nếu cuộc trò chuyện chưa có trong danh sách hiện tại, refresh lại
        void load(true);
        return prev;
      });
    });

    socket.on('message:read', ({ ids, readAt }: { ids: number[]; readAt: string }) => {
      setConversations(prev =>
        prev.map(item => {
          if (item.lastMessage && ids.includes(Number(item.lastMessage.id))) {
            return {
              ...item,
              unreadCount: 0,
              lastMessage: { ...item.lastMessage, readAt },
            };
          }
          return item;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [user, isCoach, load]);

  const navigation = useNavigation();

  // Vô hiệu hóa cử chỉ pop native của iOS khi đang ở trong một cuộc trò chuyện cụ thể
  // để iOS không tự động bắt cử chỉ lướt từ mép trái và pop màn hình về trang chủ
  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !activePartnerId,
    });
  }, [activePartnerId, navigation]);

  // Khi đang ở trong đoạn chat cụ thể, nhấn nút Back của máy sẽ quay về trang chat tổng thay vì về trang chủ
  useEffect(() => {
    if (!activePartnerId) return;

    const onBackPress = () => {
      setActivePartnerId(null);
      setSelectedPair(null);
      void refreshUnreadChatCount();
      void load(true);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activePartnerId, refreshUnreadChatCount, load]);

  const filteredConversations = useMemo(() => {
    if (filter === 'UNREAD') {
      return conversations.filter(c => (c.unreadCount || 0) > 0);
    }
    if (filter === 'READ') {
      return conversations.filter(c => (c.unreadCount || 0) === 0);
    }
    return conversations;
  }, [conversations, filter]);

  const selected = useMemo(() => {
    if (!selectedPair || !activePartnerId || !user) return null;
    const found = conversations.find(row => row.key === selectedPair);
    if (found) return found;

    if (activePartnerId) {
      const mId = isCoach ? activePartnerId : user.id;
      const cId = isCoach ? user.id : activePartnerId;
      if (`${mId}:${cId}` === selectedPair) {
        return {
          key: selectedPair,
          memberId: mId,
          coachId: cId,
          partner: {
            id: activePartnerId,
            fullName: rawPartnerName || (isCoach ? 'Hội viên' : 'Huấn luyện viên PT'),
          },
          canSend: true,
          chatType: 'PAID' as const,
          reason: undefined,
          latestBookingId: preferredBooking?.id || null,
        };
      }
    }
    return null;
  }, [selectedPair, activePartnerId, user, conversations, isCoach, rawPartnerName, preferredBooking]);

  if (selected && user) {
    const bookingPayload: PtChatBooking = {
      id: selected.latestBookingId || 0,
      memberId: selected.memberId,
      coachId: selected.coachId,
      partner: selected.partner,
      canSend: selected.canSend,
      reason: selected.reason,
      chatType: selected.chatType,
    };
    return (
      <PtConversation
        key={selected.key}
        booking={bookingPayload}
        onBack={() => {
          setActivePartnerId(null);
          setSelectedPair(null);
          router.setParams({ partnerId: '', coachId: '', memberId: '', partnerName: '' });
          void refreshUnreadChatCount();
          void load(true);
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: aura.cream }}>
      {/* Header trên cùng: Chỉ hiện 2 chữ 'Tin nhắn' ở giữa, nút 'Quay lại' chỉ icon mũi tên trái */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: aura.white,
          borderBottomWidth: 1,
          borderColor: aura.border,
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
          hitSlop={10}
          style={styles.circleBackBtn}
        >
          <Ionicons name="chevron-back" size={20} color={aura.darkCoffee} />
        </Pressable>

        <Text style={styles.headerTitle}>Tin nhắn</Text>

        {/* Cân bằng khoảng cách 38px để tiêu đề nằm chính giữa màn hình */}
        <View style={{ width: 38 }} />
      </View>

      {/* 3 button lọc: 'Tất cả', 'Đã đọc', 'Chưa đọc' căn trái, chiều dài theo chữ, chiều cao bằng nhau bo tròn 2 bên */}
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setFilter('ALL')}
          style={[styles.filterBtn, filter === 'ALL' ? styles.filterBtnActive : styles.filterBtnInactive]}
        >
          <Text style={[styles.filterText, filter === 'ALL' ? styles.filterTextActive : styles.filterTextInactive]}>
            Tất cả
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('READ')}
          style={[styles.filterBtn, filter === 'READ' ? styles.filterBtnActive : styles.filterBtnInactive]}
        >
          <Text style={[styles.filterText, filter === 'READ' ? styles.filterTextActive : styles.filterTextInactive]}>
            Đã đọc
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter('UNREAD')}
          style={[styles.filterBtn, filter === 'UNREAD' ? styles.filterBtnActive : styles.filterBtnInactive]}
        >
          <Text style={[styles.filterText, filter === 'UNREAD' ? styles.filterTextActive : styles.filterTextInactive]}>
            Chưa đọc
          </Text>
        </Pressable>
      </View>

      {/* Danh sách các đoạn chat toàn màn hình (full width) */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
        {!ready || loading ? (
          <View style={{ alignSelf: 'center', marginTop: 40 }}><AuraLoader size={56} /></View>
        ) : !user ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Empty icon="chatbubbles-outline" title="Đăng nhập để xem tin nhắn" />
            <Button title="Đăng nhập" onPress={() => router.push('/auth')} />
          </View>
        ) : error ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Empty icon="wifi-outline" title="Không tải được tin nhắn" message={error} />
            <Button secondary title="Thử lại" onPress={() => void load(true)} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Empty
              icon="chatbubbles-outline"
              title="Chưa có cuộc trò chuyện"
              message={isCoach
                ? 'Hội viên được phân gói PT hoặc có lịch tập sẽ xuất hiện tại đây.'
                : 'Sau khi mua gói PT Paid (chọn HLV) hoặc đặt lịch Trial thành công, bạn có thể nhắn tin trao đổi trực tiếp tại đây.'}
            />
            {!isCoach && (
              <View style={{ gap: 8, marginTop: 12, width: '100%', maxWidth: 260 }}>
                <Button title="Xem các gói PT" onPress={() => router.push('/packages')} />
                <Button secondary title="Hành trình PT & Đặt lịch" onPress={() => router.push('/pt')} />
              </View>
            )}
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Empty
              icon="mail-open-outline"
              title={filter === 'UNREAD' ? 'Không có tin nhắn chưa đọc' : 'Chưa có cuộc trò chuyện nào'}
              message={filter === 'UNREAD' ? 'Tất cả các tin nhắn của bạn đã được đọc.' : 'Không có cuộc trò chuyện phù hợp bộ lọc.'}
            />
          </View>
        ) : (
          filteredConversations.map((item) => {
            const hasUnread = (item.unreadCount || 0) > 0;
            const isPaid = item.chatType === 'PAID';
            const isTrial = item.chatType === 'TRIAL';
            // Nhãn loại PT của người đó: chỉ hiện nếu có loại PT (với coach nếu không có thì không hiện)
            const ptBadgeText = isPaid ? 'PT Paid' : isTrial ? 'PT Trial' : null;
            const ptBadgeBg = isPaid ? '#EBF9F1' : '#FFF8E7';
            const ptBadgeColor = isPaid ? '#1B8755' : '#B26B00';

            const lastTimeStr = formatChatTime(item.lastMessage?.createdAt || item.latestBookingTime);
            const lastContent = item.lastMessage?.content
              ? item.lastMessage.content
              : item.latestBookingTime
              ? `Lịch gần nhất: ${dateLabel(item.latestBookingTime)}`
              : 'Sẵn sàng trao đổi cùng bạn';

            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Mở tin nhắn với ${item.partner.fullName}`}
                onPress={() => {
                  setActivePartnerId(item.partner.id);
                  setSelectedPair(item.key);
                }}
                style={[
                  styles.chatRow,
                  { backgroundColor: hasUnread ? '#FFFDFB' : aura.white },
                ]}
              >
                {/* Avatar của người phù hợp */}
                <View style={{ position: 'relative' }}>
                  {item.partner.avatar ? (
                    <Image
                      source={{ uri: item.partner.avatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>
                        {getInitials(item.partner.fullName)}
                      </Text>
                    </View>
                  )}
                  {hasUnread && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {item.unreadCount! > 9 ? '9+' : item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Khung nội dung đoạn chat chiếm trọn chiều ngang còn lại */}
                <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                  {/* Hàng 1: Tên người (trái) và Nhãn loại PT của người đó (phải - nếu có) */}
                  <View style={styles.nameRow}>
                    <Text
                      style={[
                        styles.partnerName,
                        { fontWeight: hasUnread ? '900' : '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.partner.fullName}
                    </Text>
                    {ptBadgeText ? (
                      <View style={[styles.ptBadge, { backgroundColor: ptBadgeBg }]}>
                        <Text style={[styles.ptBadgeText, { color: ptBadgeColor }]}>
                          {ptBadgeText}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Hàng 2: Đoạn tin nhắn (trái) và Thời gian nhắn tin ngang hàng (phải - ở dưới nhãn PT) */}
                  <View style={styles.messageRow}>
                    <Text
                      style={[
                        styles.messageSnippet,
                        {
                          color: hasUnread ? aura.ink : aura.muted,
                          fontWeight: hasUnread ? '700' : '400',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {lastContent}
                    </Text>
                    {lastTimeStr ? (
                      <Text
                        style={[
                          styles.timeText,
                          {
                            color: hasUnread ? aura.caramel : '#8E8E93',
                            fontWeight: hasUnread ? '700' : '500',
                          },
                        ]}
                      >
                        {lastTimeStr}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  circleBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4ECE4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D4C2',
  },
  headerTitle: {
    color: aura.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: aura.cream,
  },
  filterBtn: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: aura.darkCoffee,
  },
  filterBtnInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D4C2',
  },
  filterText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterTextInactive: {
    color: aura.ink,
  },
  chatRow: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: '#F0E6DE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: aura.latte,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: aura.latte,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D4C2',
  },
  avatarInitials: {
    color: aura.darkCoffee,
    fontSize: 16,
    fontWeight: '800',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D43030',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  partnerName: {
    color: aura.ink,
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  ptBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ptBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageSnippet: {
    fontSize: 12.5,
    flex: 1,
    marginRight: 10,
  },
  timeText: {
    fontSize: 11,
  },
});
