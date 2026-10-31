import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura, dateLabel, timeLabel } from '../lib/theme';
import { Button, Empty, Pill } from '../components/ui';
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

export default function PtChat() {
  const { booking: rawBooking, coachId: rawCoachId, memberId: rawMemberId } = useLocalSearchParams<{
    booking?: string;
    coachId?: string;
    memberId?: string;
  }>();
  const { user, ready } = useAuth();
  const isCoach = ['COACH', 'TRAINER'].includes(user?.role || '');

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const preferredBooking = useMemo(() => {
    try { return JSON.parse(rawBooking || '{}'); }
    catch { return null; }
  }, [rawBooking]);

  const targetPartnerId = useMemo(() => {
    if (rawCoachId) return Number(rawCoachId);
    if (rawMemberId) return Number(rawMemberId);
    if (preferredBooking?.coachId && !isCoach) return Number(preferredBooking.coachId);
    if (preferredBooking?.memberId && isCoach) return Number(preferredBooking.memberId);
    return null;
  }, [rawCoachId, rawMemberId, preferredBooking, isCoach]);

  const load = useCallback(async () => {
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

      // If user passed targetPartnerId or booking, ensure it's in list
      if (targetPartnerId) {
        const existing = listItems.find(item =>
          isCoach ? item.memberId === targetPartnerId : item.coachId === targetPartnerId
        );
        if (existing) {
          setSelectedPair(existing.key);
        } else {
          // Synthesize conversation item for target partner
          const memberId = isCoach ? targetPartnerId : user.id;
          const coachId = isCoach ? user.id : targetPartnerId;
          const key = `${memberId}:${coachId}`;
          const partnerName = preferredBooking?.coach?.fullName || preferredBooking?.member?.fullName || (isCoach ? 'Hội viên' : 'Huấn luyện viên PT');
          const newItem: ConversationItem = {
            key,
            memberId,
            coachId,
            partner: { id: targetPartnerId, fullName: partnerName },
            canSend: true,
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
  }, [user, isCoach, targetPartnerId, preferredBooking]);

  useFocusEffect(useCallback(() => { if (ready) void load(); }, [ready, load]));

  const selected = conversations.find(row => row.key === selectedPair);

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
    return <PtConversation key={selected.key} booking={bookingPayload} onBack={() => setSelectedPair(null)} />;
  }

  return <View style={{ flex: 1, backgroundColor: aura.cream }}>
    <View style={{ padding: 20, backgroundColor: aura.white, borderBottomWidth: 1, borderColor: aura.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View>
        <Text style={{ color: aura.ink, fontSize: 22, fontWeight: '900' }}>Tin nhắn PT</Text>
        <Text style={{ color: aura.muted, fontSize: 12, marginTop: 4 }}>{isCoach ? 'Trao đổi chuyên môn và lịch tập với hội viên' : 'Trao đổi trực tiếp cùng Huấn luyện viên của bạn'}</Text>
      </View>
      <Pressable onPress={() => router.push('/pt')} hitSlop={10} style={{ padding: 8 }}>
        <Ionicons name="barbell-outline" size={24} color={aura.darkCoffee} />
      </Pressable>
    </View>

    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}>
      {!ready || loading ? (
        <View style={{ alignSelf: 'center', marginTop: 35 }}><AuraLoader size={56} /></View>
      ) : !user ? (
        <>
          <Empty icon="chatbubbles-outline" title="Đăng nhập để xem tin nhắn PT" />
          <Button title="Đăng nhập" onPress={() => router.push('/auth')} />
        </>
      ) : error ? (
        <>
          <Empty icon="wifi-outline" title="Không tải được tin nhắn" message={error} />
          <Button secondary title="Thử lại" onPress={() => void load()} />
        </>
      ) : conversations.length === 0 ? (
        <>
          <Empty
            icon="chatbubbles-outline"
            title="Chưa có cuộc trò chuyện PT"
            message={isCoach
              ? 'Hội viên được phân gói PT hoặc có lịch tập sẽ xuất hiện tại đây.'
              : 'Sau khi mua gói PT Paid (chọn HLV) hoặc đặt lịch Trial thành công, bạn có thể nhắn tin trao đổi trực tiếp tại đây.'}
          />
          {!isCoach && (
            <View style={{ gap: 8, marginTop: 12 }}>
              <Button title="Xem các gói PT" onPress={() => router.push('/packages')} />
              <Button secondary title="Hành trình PT & Đặt lịch" onPress={() => router.push('/pt')} />
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={{ color: aura.muted, fontSize: 12, marginBottom: 3 }}>{conversations.length} cuộc trò chuyện</Text>
          {conversations.map((item) => {
            const hasUnread = (item.unreadCount || 0) > 0;
            const badgeText = item.chatType === 'PAID'
              ? 'PT Paid'
              : item.chatType === 'TRIAL'
              ? 'PT Trial'
              : item.canSend
              ? 'Đang hoạt động'
              : 'Chỉ đọc';
            const badgeColor = item.canSend ? aura.green : aura.muted;

            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Mở tin nhắn với ${item.partner.fullName}`}
                onPress={() => setSelectedPair(item.key)}
                style={{
                  backgroundColor: aura.white,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: hasUnread ? aura.caramel : aura.border,
                  padding: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={23} color={aura.darkCoffee} />
                  {hasUnread && (
                    <View style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#D43030', borderWidth: 2, borderColor: '#fff' }} />
                  )}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <Text style={{ color: aura.ink, fontSize: 15, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                      {item.partner.fullName}
                    </Text>
                    <Pill text={badgeText} color={badgeColor} />
                  </View>

                  <Text style={{ color: hasUnread ? aura.ink : aura.muted, fontSize: 12, marginTop: 4, fontWeight: hasUnread ? '700' : '400' }} numberOfLines={1}>
                    {item.lastMessage?.content
                      ? item.lastMessage.content
                      : item.latestBookingTime
                      ? `Lịch gần nhất: ${dateLabel(item.latestBookingTime)}`
                      : 'Sẵn sàng trao đổi giáo án và lịch tập'}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={aura.caramel} />
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  </View>;
}
