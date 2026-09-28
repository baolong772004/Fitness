import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { soundEffects } from '../../services/audioService';

interface Message {
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

export const FloatingAIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Xin chào! Tôi là Trợ lý Ảo AURA AI. Tôi có thể hỗ trợ bạn tìm hiểu về bảng giá gói tập, chính sách đổi Coach, giờ mở cửa hoặc gợi ý bài tập hôm nay!',
      time: 'Vừa xong'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickQuestions = [
    'Gói VIP Hybrid là gì?',
    'Chính sách đổi Coach như thế nào?',
    'Đơn giá của Master Coach Tuấn Hùng?',
    'Phòng tập mở cửa khung giờ nào?'
  ];

  const generateAnswer = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('hybrid')) {
      return 'Gói VIP Hybrid là mô hình độc quyền của AURA Fitness: Bạn được vào phòng tập TỰ DO KHÔNG GIỚI HẠN trong tháng, đồng thời có thêm hạn mức số buổi tập 1-kèm-1 với HLV cá nhân (8 hoặc 16 buổi). Khi bạn quét QR check-in tại cửa, hệ thống chỉ kiểm tra quyền vào cửa và hoàn toàn KHÔNG trừ buổi PT của bạn!';
    }
    if (q.includes('đổi coach') || q.includes('đổi hlv')) {
      return 'Bạn hoàn toàn có thể yêu cầu đổi Huấn luyện viên! Nếu Coach mới có cùng mức giá, toàn bộ số buổi còn lại sẽ được chuyển sang mà không mất phí. Nếu đổi sang Master Coach có đơn giá cao hơn, hệ thống sẽ tính khoản phụ phí chênh lệch dựa trên số buổi còn lại.';
    }
    if (q.includes('tuấn hùng') || q.includes('giá')) {
      return 'HLV Master Trần Tuấn Hùng có đơn giá dạy lẻ là 650,000 VNĐ / buổi. Các HLV Senior như HLV Lan Anh (Yoga) và HLV Quang Dũng (Boxing) có mức giá 400,000 VNĐ / buổi, và Junior Coach Minh Khang có giá 250,000 VNĐ / buổi.';
    }
    if (q.includes('giờ') || q.includes('mở cửa')) {
      return 'AURA Fitness mở cửa phục vụ hội viên từ 05:30 sáng đến 22:30 tối tất cả các ngày trong tuần (kể cả Thứ Bảy và Chủ Nhật). Giờ cao điểm sôi động nhất là 17:30 - 20:30.';
    }
    return `Cảm ơn câu hỏi của bạn về "${query}". Hệ thống AURA Fitness luôn sẵn sàng hỗ trợ. Bạn có thể đến trực tiếp Quầy Lễ Tân hoặc liên hệ Hotline 1900 6868 để được chuyên viên hướng dẫn chi tiết nhé!`;
  };

  const handleSendMessage = (textToSend?: string) => {
    const msgText = textToSend || input;
    if (!msgText.trim()) return;

    const userMsg: Message = {
      sender: 'user',
      text: msgText,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate Streaming / Fast AI Response
    setTimeout(() => {
      const response = generateAnswer(msgText);
      const aiMsg: Message = {
        sender: 'ai',
        text: response,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setIsTyping(false);
      setMessages(prev => [...prev, aiMsg]);
      soundEffects.playSuccessBeep();
    }, 600);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 58,
          height: 58,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #FE7413, #FF3D00)',
          color: '#fff',
          border: 'none',
          boxShadow: 'var(--shadow-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 900,
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        title="Trợ lý AI AURA"
      >
        {isOpen ? <X size={26} /> : <Sparkles size={26} />}
      </button>

      {/* Chat Window Container */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 94,
          right: 24,
          width: 380,
          height: 520,
          background: 'var(--bg-panel)',
          border: '1px solid rgba(254, 116, 19, 0.4)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 900,
          overflow: 'hidden',
          animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #142024, #1B292E)',
            borderBottom: 'var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                background: 'var(--color-primary)',
                color: '#fff',
                padding: 6,
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={18} />
              </div>
              <div>
                <strong style={{ fontSize: 14, color: '#fff', display: 'block' }}>AURA Fitness AI</strong>
                <span style={{ fontSize: 11, color: 'var(--color-success)' }}>● Đang trực tuyến hỗ trợ</span>
              </div>
            </div>
            <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {messages.map((m, idx) => {
              const isAi = m.sender === 'ai';
              return (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: isAi ? 'row' : 'row-reverse',
                  alignItems: 'flex-start',
                  gap: 8
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isAi ? 'var(--color-primary-light)' : 'rgba(255,255,255,0.1)',
                    color: isAi ? 'var(--color-primary)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    flexShrink: 0
                  }}>
                    {isAi ? <Bot size={16} /> : <User size={16} />}
                  </div>

                  <div style={{
                    maxWidth: '75%',
                    background: isAi ? 'var(--bg-app)' : 'var(--color-primary)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: 14,
                    fontSize: 13,
                    lineHeight: 1.45,
                    border: isAi ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {m.text}
                    <div style={{
                      fontSize: 10,
                      color: isAi ? 'var(--text-dim)' : 'rgba(255,255,255,0.7)',
                      marginTop: 4,
                      textAlign: isAi ? 'left' : 'right'
                    }}>
                      {m.time}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--color-primary-light)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Bot size={16} />
                </div>
                <div style={{
                  background: 'var(--bg-app)',
                  padding: '8px 14px',
                  borderRadius: 14,
                  fontSize: 12,
                  color: 'var(--text-muted)'
                }}>
                  AURA AI đang soạn câu trả lời...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions Chips */}
          <div style={{
            padding: '8px 12px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(q)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: '12px',
              borderTop: 'var(--border-subtle)',
              display: 'flex',
              gap: 8,
              background: 'var(--bg-panel)'
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Đặt câu hỏi cho AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ fontSize: 13, padding: '8px 12px' }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)' }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
