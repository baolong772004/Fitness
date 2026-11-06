import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View,
  type ScrollViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { aura } from '../lib/theme';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

function cleanChatText(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*+/g, '')
    .replace(/(^|\n)\s*#{1,6}\s+/g, '$1')
    .replace(/^[ \t]*[-•]\s+/gm, '• ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const QUICK_QUESTIONS = [
  'Gợi ý gói gym phù hợp với tôi',
  'Gói PT nào phù hợp cho người mới?',
  'So sánh các huấn luyện viên đang hoạt động',
];

export function AiBusinessChat() {
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    text: 'Chào bạn! Tôi có thể tư vấn gói tập, giá PT và giúp bạn chọn huấn luyện viên phù hợp từ dữ liệu hiện tại của AURA Fitness.',
  }]);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = async (question?: string) => {
    const text = (question || input).trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setMessages(current => [...current, { role: 'user', text }]);
    scrollToEnd();

    try {
      const history = messages.slice(-10).map(({ role, text: itemText }) => ({ role, text: itemText }));
      const response = await api.aiBusinessChat(text, history);
      setMessages(current => [...current, { role: 'assistant', text: cleanChatText(response) }]);
    } catch (error) {
      setMessages(current => [...current, {
        role: 'assistant',
        text: error instanceof Error ? error.message : 'Không thể kết nối trợ lý AI. Vui lòng thử lại.',
      }]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  return <>
    {!visible && <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mở trợ lý AI AURA"
      onPress={() => setVisible(true)}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name="sparkles" size={25} color="#fff" />
    </Pressable>}

    <Modal animationType="slide" transparent visible={visible} onRequestClose={() => setVisible(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                <View style={styles.botIcon}><Ionicons name="sparkles" size={18} color="#fff" /></View>
                <View>
                  <Text style={styles.title}>AURA Fitness AI</Text>
                  <View style={styles.statusRow}><View style={styles.statusDot} /><Text style={styles.subtitle}>Tư vấn viên trực tuyến</Text></View>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setVisible(false)} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={aura.ink} />
              </Pressable>
            </View>

            <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} onContentSizeChange={scrollToEnd}>
              {messages.map((message, index) => (
                <View key={`${index}-${message.role}`} style={[styles.messageRow, message.role === 'user' && styles.userRow]}>
                  {message.role === 'assistant' && <View style={styles.smallBot}><Ionicons name="sparkles" size={13} color="#fff" /></View>}
                  <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                    <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>{cleanChatText(message.text)}</Text>
                  </View>
                </View>
              ))}
              {sending && <View style={[styles.messageRow, { marginTop: 2 }]}><View style={styles.smallBot}><Ionicons name="sparkles" size={13} color="#fff" /></View><View style={[styles.bubble, styles.assistantBubble]}><ActivityIndicator size="small" color={aura.caramel} /></View></View>}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll} contentContainerStyle={styles.quickContent}>
              {QUICK_QUESTIONS.map(question => <Pressable key={question} style={styles.quickChip} onPress={() => void send(question)}><Text style={styles.quickText}>{question}</Text></Pressable>)}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Hỏi về gói tập hoặc huấn luyện viên..."
                placeholderTextColor="#9A8D87"
                multiline
                maxLength={2000}
                style={styles.input}
                onSubmitEditing={() => void send()}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Gửi" disabled={!input.trim() || sending} onPress={() => void send()} style={[styles.sendButton, (!input.trim() || sending) && styles.sendDisabled]}>
                <Ionicons name="arrow-up" size={21} color="#fff" />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 18, bottom: 92, width: 58, height: 58, borderRadius: 29, backgroundColor: aura.caramel, alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#3D261D', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, zIndex: 100 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(21, 16, 14, 0.42)' },
  safeArea: { flex: 1 },
  sheet: { height: '88%', backgroundColor: '#FFFCF8', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  header: { minHeight: 78, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEE7E2', backgroundColor: '#FFFDF9' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  botIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: aura.caramel, alignItems: 'center', justifyContent: 'center' },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4EFEA' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#57A773' },
  title: { color: aura.ink, fontSize: 17, fontWeight: '900' },
  subtitle: { color: '#6B756D', fontSize: 11, fontWeight: '700' },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 12, gap: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, maxWidth: '90%' },
  userRow: { alignSelf: 'flex-end' },
  smallBot: { width: 28, height: 28, borderRadius: 14, backgroundColor: aura.caramel, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, maxWidth: '100%' },
  assistantBubble: { backgroundColor: '#F1ECE7', borderBottomLeftRadius: 6 },
  userBubble: { backgroundColor: aura.darkCoffee, borderBottomRightRadius: 6 },
  messageText: { color: aura.ink, fontSize: 14.5, lineHeight: 21 },
  userMessageText: { color: '#fff' },
  quickScroll: { flexGrow: 0, borderTopWidth: 1, borderTopColor: '#EEE7E2', backgroundColor: '#FFFDF9' },
  quickContent: { gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  quickChip: { borderWidth: 1, borderColor: '#E1D8D2', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  quickText: { color: aura.darkCoffee, fontSize: 12, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 14, backgroundColor: '#FFFDF9' },
  input: { flex: 1, minHeight: 46, maxHeight: 100, borderWidth: 1, borderColor: '#DDD3CD', borderRadius: 23, paddingHorizontal: 17, paddingVertical: 11, color: aura.ink, backgroundColor: '#fff' },
  sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: aura.caramel, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  sendDisabled: { opacity: 0.4 },
});
