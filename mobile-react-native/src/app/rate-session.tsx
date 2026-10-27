import React, { useCallback, useState } from 'react';
import { Alert, Modal, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { aura, dateLabel, list, timeLabel } from '../lib/theme';
import { Button, Card, Empty, Field, Page, Pill, Section, showError } from '../components/ui';

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Hoàn thành',
  PENDING: 'Chờ xác nhận',
  CANCELLED: 'Đã hủy',
  ABSENT_ELIGIBLE: 'Được học bù',
  ABSENT_NO_REFUND: 'Vắng – mất buổi',
  MAKEUP_BOOKED: 'Đã đặt học bù',
  REJECTED: 'Bị từ chối',
};

function StarRow({ value, onSelect }: { value: number; onSelect: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 10 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Pressable key={star} onPress={() => onSelect(star)} hitSlop={8}>
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={36}
            color={star <= value ? '#F4A429' : aura.border}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function RateSession() {
  const params = useLocalSearchParams<{ booking?: string; bookingId?: string }>();
  const bookingFromParam = params.booking ? (() => { try { return JSON.parse(params.booking!); } catch { return null; } })() : null;

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rating modal state
  const [ratingTarget, setRatingTarget] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.ptBookings();
      const completed = list(result).filter(
        (r: any) => String(r.status ?? '').toUpperCase() === 'COMPLETED'
      );
      setBookings(completed);
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    if (bookingFromParam) {
      setBookings([bookingFromParam]);
    } else {
      void load();
    }
  }, [load, bookingFromParam]));

  const openRating = (booking: any) => {
    setRatingTarget(booking);
    setRating(5);
    setComment('');
  };

  const submitRating = async () => {
    if (!ratingTarget) return;
    if (!comment.trim()) {
      Alert.alert('Aura Fitness', 'Vui lòng nhập nhận xét ngắn về buổi tập.');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitRating(ratingTarget.id, rating, comment.trim(), 'COACH');
      Alert.alert('Cảm ơn bạn!', 'Đánh giá đã được ghi nhận.');
      setRatingTarget(null);
      void load();
    } catch (error) { showError(error); }
    finally { setSubmitting(false); }
  };

  const ratingLabels = ['', 'Rất tệ', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Tuyệt vời! ⭐'];

  return (
    <Page loading={loading} refresh={() => void load()}>
      <LinearGradient
        colors={['#F4A42920', aura.white]}
        style={{ borderRadius: 22, padding: 20, marginBottom: 4, borderWidth: 1, borderColor: '#F4A42940' }}
      >
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: '#F4A42920', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="star" size={26} color="#F4A429" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: aura.ink, fontSize: 16, fontWeight: '900' }}>Đánh giá buổi tập</Text>
            <Text style={{ color: aura.muted, fontSize: 12, marginTop: 3 }}>
              Chia sẻ trải nghiệm để giúp Coach cải thiện chất lượng
            </Text>
          </View>
        </View>
      </LinearGradient>

      <Section title="Buổi tập đã hoàn thành" icon="checkmark-circle-outline" subtitle="Chọn buổi tập để đánh giá Coach" />

      {bookings.length === 0 && !loading && (
        <Empty
          icon="star-outline"
          title="Chưa có buổi tập nào để đánh giá"
          message="Hoàn thành buổi PT đầu tiên để có thể đánh giá Coach của bạn."
        />
      )}

      {bookings.map((booking, idx) => {
        const hasRating = !!booking.rating;
        const coachName = String(booking.coach?.fullName ?? 'Coach Aura');
        const status = String(booking.status ?? '').toUpperCase();
        return (
          <Card key={String(booking.id ?? idx)}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="fitness-outline" size={21} color={aura.darkCoffee} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: aura.ink, fontSize: 14, fontWeight: '900' }}>{coachName}</Text>
                <Text style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>
                  {dateLabel(booking.startTime)} · {timeLabel(booking.startTime)}
                </Text>
                <Text style={{ color: aura.muted, fontSize: 11, marginTop: 2 }}>
                  {String(booking.membership?.package?.name ?? 'Gói PT')}
                </Text>
              </View>
              <Pill text={STATUS_LABELS[status] ?? status} color={aura.green} />
            </View>

            {hasRating ? (
              <View style={{ marginTop: 12, backgroundColor: aura.cream, borderRadius: 12, padding: 11 }}>
                <View style={{ flexDirection: 'row', gap: 3, marginBottom: 5 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Ionicons key={s} name={s <= Number(booking.rating ?? 0) ? 'star' : 'star-outline'} size={16} color="#F4A429" />
                  ))}
                  <Text style={{ color: aura.muted, fontSize: 11, marginLeft: 6 }}>{ratingLabels[Number(booking.rating ?? 0)]}</Text>
                </View>
                {booking.ratingComment && (
                  <Text style={{ color: aura.ink, fontSize: 12, fontStyle: 'italic' }}>{`"${String(booking.ratingComment)}"`}</Text>
                )}
                <Text style={{ color: aura.muted, fontSize: 10, marginTop: 4 }}>Đã đánh giá</Text>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Button
                  title="Đánh giá buổi tập này"
                  icon="star-outline"
                  onPress={() => openRating(booking)}
                />
              </View>
            )}
          </Card>
        );
      })}

      {/* Rating Modal */}
      <Modal visible={!!ratingTarget} transparent animationType="slide" onRequestClose={() => setRatingTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <View style={{ backgroundColor: aura.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: aura.border, alignSelf: 'center', marginBottom: 18 }} />

            <Text style={{ color: aura.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' }}>
              Đánh giá buổi tập
            </Text>
            <Text style={{ color: aura.muted, fontSize: 13, textAlign: 'center', marginTop: 5 }}>
              với {ratingTarget?.coach?.fullName ?? 'Coach'}
            </Text>
            <Text style={{ color: aura.muted, fontSize: 11, textAlign: 'center', marginTop: 3 }}>
              {dateLabel(ratingTarget?.startTime)} · {timeLabel(ratingTarget?.startTime)}
            </Text>

            <StarRow value={rating} onSelect={setRating} />
            <Text style={{ color: '#F4A429', fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 14 }}>
              {ratingLabels[rating]}
            </Text>

            <Field
              label="Nhận xét của bạn"
              value={comment}
              onChangeText={setComment}
              placeholder="Chia sẻ cảm nhận về buổi tập, Coach hướng dẫn có tận tâm không?..."
              multiline
            />

            <View style={{ gap: 10 }}>
              <Button
                title={submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                icon="paper-plane-outline"
                loading={submitting}
                disabled={submitting}
                onPress={submitRating}
              />
              <Button secondary title="Để sau" onPress={() => setRatingTarget(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}
