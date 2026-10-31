import React, { useCallback, useState } from 'react';
import { Alert, Linking, Modal, Pressable, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { aura, dateLabel, list } from '../lib/theme';
import { Button, Card, Empty, Field, Page, Pill, Section, showError } from '../components/ui';

const CATEGORIES = ['Gói tập & Thanh toán', 'Lịch PT & Lớp học', 'Check-in & QR', 'Tài khoản', 'Thiết bị & Phòng tập', 'Khác'];

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Đang xử lý', color: aura.caramel },
  PENDING: { label: 'Chờ phản hồi', color: aura.caramel },
  IN_PROGRESS: { label: 'Đang xử lý', color: '#1565C0' },
  RESOLVED: { label: 'Đã giải quyết', color: aura.green },
  CLOSED: { label: 'Đã đóng', color: aura.muted },
};

const FAQS = [
  { q: 'Tôi có thể hủy gói tập không?', a: 'Gói tập đã thanh toán không thể hoàn tiền. Vui lòng liên hệ quầy lễ tân để được hỗ trợ đặc biệt.' },
  { q: 'Làm sao để đặt lịch PT?', a: 'Vào Tab "Đặt lịch" → "Tập cùng PT" → Chọn Coach → Xem lịch trống → Đặt buổi.' },
  { q: 'QR check-in không hoạt động?', a: 'Kiểm tra kết nối mạng, đảm bảo quét đúng QR của phòng tập. Nếu vẫn lỗi, nhờ nhân viên hỗ trợ check-in thủ công.' },
  { q: 'Tôi có thể học bù không?', a: 'Để được học bù, bạn cần báo vắng trước ít nhất 2 giờ. Vào lịch tập → chọn buổi → nhấn "Báo vắng".' },
  { q: 'Gia hạn gói tập như thế nào?', a: 'Vào "Gói tập của tôi" → chọn gói → nhấn "Gia hạn gói tập" và hoàn tất thanh toán.' },
];

export default function Support() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.supportTickets();
      setTickets(list(result.data ?? result.tickets ?? []));
    } catch {
      // Support tickets endpoint may not exist, silently fail
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const submit = async () => {
    if (!subject.trim()) { Alert.alert('Aura Fitness', 'Vui lòng nhập tiêu đề yêu cầu.'); return; }
    if (!message.trim()) { Alert.alert('Aura Fitness', 'Vui lòng mô tả vấn đề cần hỗ trợ.'); return; }
    setSubmitting(true);
    try {
      await api.createSupportTicket(subject.trim(), message.trim(), category);
      Alert.alert('Gửi thành công!', 'Đội ngũ Aura Fitness sẽ phản hồi trong vòng 24 giờ.');
      setShowNew(false);
      setSubject(''); setMessage(''); setCategory(CATEGORIES[0]);
      void load();
    } catch (error) { showError(error); }
    finally { setSubmitting(false); }
  };

  return (
    <Page loading={loading} refresh={() => void load()}>
      {/* Hero */}
      <LinearGradient
        colors={[aura.espresso, aura.darkCoffee]}
        style={{ borderRadius: 22, padding: 20 }}
      >
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="headset-outline" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Trung tâm hỗ trợ</Text>
            <Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 3 }}>Chúng tôi luôn sẵn sàng giúp bạn 24/7</Text>
          </View>
        </View>

        {/* Quick contact */}
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
          {[
            { icon: 'call-outline' as const, label: 'Hotline', action: () => Linking.openURL('tel:19001234') },
            { icon: 'logo-facebook' as const, label: 'Facebook', action: () => Linking.openURL('https://facebook.com') },
            { icon: 'mail-outline' as const, label: 'Email', action: () => Linking.openURL('mailto:support@aurafitness.vn') },
          ].map(item => (
            <Pressable
              key={item.label}
              onPress={item.action}
              style={{ flex: 1, backgroundColor: '#FFFFFF1A', borderRadius: 13, padding: 11, alignItems: 'center', gap: 5 }}
            >
              <Ionicons name={item.icon} size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* New ticket button */}
      <Button icon="create-outline" title="Gửi yêu cầu hỗ trợ" onPress={() => setShowNew(true)} />

      {/* FAQ */}
      <Section title="Câu hỏi thường gặp" icon="help-circle-outline" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {FAQS.map((faq, idx) => (
          <Pressable
            key={idx}
            onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
            style={{
              padding: 14,
              borderBottomWidth: idx < FAQS.length - 1 ? 1 : 0,
              borderBottomColor: aura.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: aura.darkCoffee, fontSize: 12, fontWeight: '900' }}>?</Text>
              </View>
              <Text style={{ flex: 1, color: aura.ink, fontWeight: '700', fontSize: 13, lineHeight: 18 }}>{faq.q}</Text>
              <Ionicons name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'} size={16} color={aura.muted} />
            </View>
            {expandedFaq === idx && (
              <Text style={{ color: aura.muted, fontSize: 13, lineHeight: 19, marginTop: 10, marginLeft: 38 }}>
                {faq.a}
              </Text>
            )}
          </Pressable>
        ))}
      </Card>

      {/* Tickets */}
      <Section title="Yêu cầu của bạn" icon="ticket-outline" subtitle="Theo dõi trạng thái các yêu cầu đã gửi" />
      {tickets.length === 0 ? (
        <Empty
          icon="ticket-outline"
          title="Chưa có yêu cầu nào"
          message="Gửi yêu cầu hỗ trợ nếu bạn gặp bất kỳ vấn đề nào."
        />
      ) : (
        tickets.map((ticket, idx) => {
          const statusInfo = STATUS_INFO[String(ticket.status ?? 'OPEN')] ?? { label: String(ticket.status ?? ''), color: aura.muted };
          return (
            <Card key={String(ticket.id ?? idx)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={aura.darkCoffee} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: aura.ink, fontSize: 14, fontWeight: '900' }}>
                    {String(ticket.subject ?? 'Yêu cầu hỗ trợ')}
                  </Text>
                  <Text style={{ color: aura.muted, fontSize: 11, marginTop: 3 }}>
                    {String(ticket.category ?? '')} · {dateLabel(ticket.createdAt)}
                  </Text>
                  {ticket.message && (
                    <Text numberOfLines={2} style={{ color: aura.muted, fontSize: 12, marginTop: 5, lineHeight: 17 }}>
                      {String(ticket.message)}
                    </Text>
                  )}
                </View>
                <Pill text={statusInfo.label} color={statusInfo.color} />
              </View>
              {ticket.staffReply && (
                <View style={{ marginTop: 11, backgroundColor: aura.latte, borderRadius: 12, padding: 11 }}>
                  <Text style={{ color: aura.darkCoffee, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>
                    Phản hồi từ Aura Fitness
                  </Text>
                  <Text style={{ color: aura.ink, fontSize: 12, lineHeight: 17 }}>{String(ticket.staffReply)}</Text>
                </View>
              )}
            </Card>
          );
        })
      )}

      {/* New Ticket Modal */}
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <View style={{ backgroundColor: aura.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: aura.border, alignSelf: 'center', marginBottom: 20 }} />

              <Text style={{ color: aura.ink, fontSize: 19, fontWeight: '900', marginBottom: 4 }}>
                Gửi yêu cầu hỗ trợ
              </Text>
              <Text style={{ color: aura.muted, fontSize: 13, marginBottom: 16 }}>
                Đội ngũ sẽ phản hồi bạn trong vòng 24 giờ.
              </Text>

              {/* Category select */}
              <Text style={{ color: aura.ink, fontWeight: '700', fontSize: 12, marginBottom: 8 }}>Danh mục</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: category === cat ? aura.darkCoffee : aura.white,
                      borderWidth: 1, borderColor: category === cat ? aura.darkCoffee : aura.border,
                    }}
                  >
                    <Text style={{ color: category === cat ? '#fff' : aura.ink, fontSize: 12, fontWeight: '700' }}>{cat}</Text>
                  </Pressable>
                ))}
              </View>

              <Field label="Tiêu đề" value={subject} onChangeText={setSubject} placeholder="Mô tả ngắn vấn đề của bạn" />
              <Field label="Mô tả chi tiết" value={message} onChangeText={setMessage} placeholder="Cung cấp thêm thông tin để chúng tôi hỗ trợ tốt hơn..." multiline />

              <View style={{ gap: 10, marginTop: 8 }}>
                <Button title={submitting ? 'Đang gửi...' : 'Gửi yêu cầu'} icon="send-outline" loading={submitting} disabled={submitting} onPress={submit} />
                <Button secondary title="Hủy" onPress={() => setShowNew(false)} />
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Page>
  );
}
