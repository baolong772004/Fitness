import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  SendHorizontal,
  CalendarDays,
  Phone,
  User,
  ShieldCheck,
  Clock,
  AlertCircle,
  Loader2,
  CheckCheck,
  Sparkles,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface ConversationItem {
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
}

export interface ChatMessage {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  sender: { fullName: string; role?: string; avatar?: string };
}

interface CoachChatPageProps {
  initialMemberId?: number | null;
  onViewTraineeProfile?: (memberId: number) => void;
}

const formatMsgTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
};

const formatFullDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const CoachChatPage: React.FC<CoachChatPageProps> = ({
  initialMemberId,
  onViewTraineeProfile
}) => {
  const currentUser = api.auth.getCurrentUser();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PAID' | 'TRIAL' | 'UNREAD'>('ALL');
  const [draft, setDraft] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [sendReason, setSendReason] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  // Tải danh sách cuộc hội thoại
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingConversations(true);
    try {
      const res = await api.pt.getPtConversations();
      if (res && res.data) {
        setConversations(res.data);
        const totalUnread = res.data.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0);
        window.dispatchEvent(new CustomEvent('aura:chat-updated', { detail: { unreadCount: totalUnread } }));

        // Tự động chọn cuộc trò chuyện nếu có initialMemberId
        if (initialMemberId && !selectedConversation) {
          const match = res.data.find(c => c.memberId === Number(initialMemberId));
          if (match) {
            setSelectedConversation(match);
            setMobileShowChat(true);
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách hội thoại:', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  }, [initialMemberId, selectedConversation]);

  // Tải tin nhắn của cuộc hội thoại đang chọn
  const loadMessages = useCallback(async (partnerId: number, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await api.pt.getPairMessages(partnerId);
      if (res && res.data) {
        setMessages(res.data);
        setCanSend(res.canSend ?? false);
        setSendReason(res.reason || null);
        window.dispatchEvent(new CustomEvent('aura:chat-updated'));
        if (!silent) {
          setTimeout(() => scrollToBottom(false), 50);
        }
      }
    } catch (err) {
      console.warn('Lỗi tải tin nhắn:', err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  }, [scrollToBottom]);

  // Tải lần đầu
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Khi chọn một hội thoại
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.partner.id);
      setCanSend(selectedConversation.canSend);
      setSendReason(selectedConversation.reason || null);
    } else {
      setMessages([]);
    }
  }, [selectedConversation, loadMessages]);

  // Polling tự động làm mới tin nhắn mỗi 4 giây
  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations(true);
      if (selectedConversation) {
        loadMessages(selectedConversation.partner.id, true);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedConversation, loadConversations, loadMessages]);

  // Gửi tin nhắn
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = draft.trim();
    if (!text || !selectedConversation || !canSend || isSending) return;

    setIsSending(true);
    try {
      await api.pt.sendPairMessage(selectedConversation.partner.id, text, selectedConversation.latestBookingId ?? undefined);
      setDraft('');
      // Tải lại tin nhắn ngay lập tức
      await loadMessages(selectedConversation.partner.id, true);
      scrollToBottom(true);
      // Tải lại danh sách để cập nhật tin nhắn cuối cùng
      loadConversations(true);
    } catch (err: any) {
      alert(err.message || 'Không thể gửi tin nhắn.');
    } finally {
      setIsSending(false);
    }
  };

  // Lọc danh sách hội thoại
  const filteredConversations = conversations.filter(c => {
    const nameMatch = c.partner.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.partner.phone && c.partner.phone.includes(searchQuery));
    if (!nameMatch) return false;

    if (filterType === 'PAID') return c.chatType === 'PAID';
    if (filterType === 'TRIAL') return c.chatType === 'TRIAL';
    if (filterType === 'UNREAD') return (c.unreadCount || 0) > 0;
    return true;
  });

  const getChatTypeBadge = (type?: string) => {
    switch (type) {
      case 'PAID':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[10px] font-bold">Gói Paid</Badge>;
      case 'TRIAL':
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-0 text-[10px] font-bold">Tập Thử</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">Hết Hạn</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-row h-[calc(100vh-8.5rem)] min-h-[600px] max-h-[860px] w-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg p-0">
      {/* =========================================================================
          CỘT TRÁI: DANH SÁCH CUỘC HỘI THOẠI (CHAT SIDEBAR - CHUẨN ZALO/MESSENGER)
      ========================================================================= */}
      <div className={`flex flex-col h-full border-r border-border/70 bg-card shrink-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[360px]`}>
        {/* Header danh sách */}
        <div className="p-3.5 border-b border-border/70 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-foreground leading-tight">Tin nhắn</h2>
                <p className="text-[11px] text-muted-foreground">Kênh tương tác PT trực tiếp</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => loadConversations(false)}
              title="Làm mới"
            >
              <RefreshCw className={`size-4 ${isLoadingConversations ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Ô tìm kiếm học viên */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm kiếm học viên theo tên, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-muted/40 rounded-lg border-border/70"
            />
          </div>

          {/* Tab lọc nhanh */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                filterType === 'ALL'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              Tất cả ({conversations.length})
            </button>
            <button
              onClick={() => setFilterType('PAID')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                filterType === 'PAID'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              Học viên Paid
            </button>
            <button
              onClick={() => setFilterType('TRIAL')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                filterType === 'TRIAL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              Tập thử
            </button>
            <button
              onClick={() => setFilterType('UNREAD')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                filterType === 'UNREAD'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              Chưa đọc
            </button>
          </div>
        </div>

        {/* Danh sách cuộn học viên */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40 overscroll-contain">
          {isLoadingConversations && conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span>Đang tải danh sách học viên...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center text-muted-foreground">
              <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-2">
                <User className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Không tìm thấy học viên</p>
              <p className="text-xs mt-1">Chưa có cuộc trò chuyện nào phù hợp với bộ lọc.</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.partner.id === conv.partner.id;
              const hasUnread = (conv.unreadCount || 0) > 0;
              const lastMsgText = conv.lastMessage?.content || 'Chưa có tin nhắn nào';
              const lastMsgTime = conv.lastMessage?.createdAt ? formatMsgTime(conv.lastMessage.createdAt) : '';

              return (
                <div
                  key={conv.key || conv.partner.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    setMobileShowChat(true);
                  }}
                  className={`flex items-start gap-3 p-3.5 cursor-pointer transition-all hover:bg-muted/50 ${
                    isSelected
                      ? 'bg-primary/10 border-l-4 border-primary text-foreground'
                      : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 font-bold text-primary text-base">
                      {conv.partner.fullName.trim().charAt(0).toUpperCase() || 'H'}
                    </div>
                    {conv.canSend && (
                      <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-card" title="Đang trong phiên hỗ trợ" />
                    )}
                  </div>

                  {/* Thông tin học viên & tin nhắn cuối */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                      <span className="truncate text-xs font-bold text-foreground">
                        {conv.partner.fullName}
                      </span>
                      {lastMsgTime && (
                        <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                          {lastMsgTime}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      {getChatTypeBadge(conv.chatType)}
                      {conv.latestBookingTime && (
                        <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          {new Date(conv.latestBookingTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-xs ${hasUnread ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                        {lastMsgText}
                      </p>
                      {hasUnread && (
                        <span className="size-4 shrink-0 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =========================================================================
          CỘT PHẢI: KHUNG TRÒ CHUYỆN THỜI GIAN THỰC (MESSENGER CHAT WINDOW)
      ========================================================================= */}
      <div className={`flex flex-col flex-1 h-full min-w-0 bg-background overflow-hidden ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            {/* Header khung chat */}
            <div className="flex items-center justify-between border-b border-border/70 bg-card px-4 py-3 shadow-xs shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Nút quay lại trên mobile */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 md:hidden cursor-pointer"
                  onClick={() => setMobileShowChat(false)}
                >
                  <ChevronLeft className="size-5" />
                </Button>

                <div className="relative shrink-0">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
                    {selectedConversation.partner.fullName.trim().charAt(0).toUpperCase() || 'H'}
                  </div>
                  {canSend && (
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-extrabold text-foreground">
                      {selectedConversation.partner.fullName}
                    </h3>
                    {getChatTypeBadge(selectedConversation.chatType)}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {selectedConversation.partner.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="size-3" />
                        {selectedConversation.partner.phone}
                      </span>
                    )}
                    {canSend ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        ● Có thể gửi tin nhắn
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {sendReason || 'Hết thời gian nhắn tin'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Nút thao tác nhanh */}
              <div className="flex items-center gap-2">
                {onViewTraineeProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold gap-1.5 cursor-pointer hidden sm:flex"
                    onClick={() => onViewTraineeProfile(selectedConversation.memberId)}
                  >
                    <User className="size-3.5" />
                    <span>Hồ Sơ Học Viên</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Vùng hiển thị tin nhắn (Scrollable) */}
            <div
              ref={chatContainerRef}
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-muted/20 overscroll-contain"
            >
              {isLoadingMessages && messages.length === 0 ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span>Đang tải lịch sử tin nhắn...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-6 gap-3">
                  <div className="size-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                    <Sparkles className="size-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">Chưa có tin nhắn nào</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Bắt đầu cuộc trò chuyện với học viên {selectedConversation.partner.fullName} để trao đổi về lịch tập, bài tập hoặc chế độ dinh dưỡng.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => {
                    const isMine = Number(msg.senderId) === Number(currentUser?.id);
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDateHeader =
                      !prevMsg ||
                      new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                    return (
                      <React.Fragment key={msg.id || idx}>
                        {showDateHeader && (
                          <div className="flex items-center justify-center my-3">
                            <span className="rounded-full bg-muted/80 border border-border/60 px-3 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {formatFullDate(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {!isMine && (
                            <div className="size-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mb-1">
                              {msg.sender?.fullName?.charAt(0) || 'H'}
                            </div>
                          )}

                          <div className={`max-w-[78%] sm:max-w-[68%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            {!isMine && (
                              <span className="text-[10px] font-medium text-muted-foreground ml-1 mb-1">
                                {msg.sender?.fullName}
                              </span>
                            )}

                            <div
                              className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words ${
                                isMine
                                  ? 'bg-primary text-primary-foreground rounded-br-xs'
                                  : 'bg-card border border-border/80 text-foreground rounded-bl-xs'
                              }`}
                            >
                              {msg.content}
                            </div>

                            <span className="text-[10px] text-muted-foreground mt-1 px-1 font-mono">
                              {formatMsgTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Footer nhập tin nhắn */}
            <div className="border-t border-border/70 bg-card p-3 sm:p-4 shrink-0">
              {canSend ? (
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Nhập tin nhắn cho học viên (Enter để gửi)..."
                    maxLength={1000}
                    disabled={isSending}
                    autoFocus
                    className="flex-1 h-11 bg-muted/30 border-border/80 text-xs sm:text-sm rounded-xl px-4 focus-visible:ring-primary"
                  />

                  <Button
                    type="submit"
                    disabled={isSending || !draft.trim()}
                    className="h-11 px-4 rounded-xl font-bold text-xs gap-1.5 cursor-pointer shrink-0"
                  >
                    {isSending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <SendHorizontal className="size-4" />
                        <span className="hidden sm:inline">Gửi</span>
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 border border-border/60 text-xs text-muted-foreground">
                  <AlertCircle className="size-4 text-amber-500 shrink-0" />
                  <span>
                    {sendReason || 'Đã hết thời gian hỗ trợ nhắn tin hoặc học viên chưa có lịch tập hợp lệ.'}
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Màn hình chờ khi chưa chọn học viên nào */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-3 shadow-xs">
              <MessageSquare className="size-10" />
            </div>
            <h3 className="text-base font-extrabold text-foreground">Hộp Thoại PT Riêng Biệt</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Chọn một học viên từ danh sách bên trái để xem lịch sử trò chuyện và tư vấn lịch tập, dinh dưỡng trực tiếp.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

