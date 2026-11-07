import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dumbbell,
  RefreshCw,
  Wallet,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  CalendarCheck,
  AlertTriangle,
  X,
  History,
  ShieldAlert,
  SlidersHorizontal,
  Info,
  RotateCcw,
  Pencil,
  Sparkles,
  ArrowRight,
  Calendar,
  Layers,
  Loader2,
  Tag,
  Check,
  TrendingUp,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';

const levelNames: Record<string, string> = {
  TRIAL: 'Trải nghiệm',
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

const levelBadgeVariants: Record<string, string> = {
  TRIAL: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  BEGINNER: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  INTERMEDIATE: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  ADVANCED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
};

const paidLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

const transactionNames: Record<string, string> = {
  GRANT: 'Cấp buổi',
  HOLD: 'Giữ buổi khi đặt lịch',
  CONSUME: 'Đã hoàn thành ca tập',
  RELEASE: 'Hoàn buổi đặt lịch',
  PROTECTED_CANCEL: 'Đã dùng lượt hủy được bảo lưu',
  REFUND: 'Hoàn buổi đã dùng',
  ADMIN_CREDIT: 'Quản trị cộng buổi',
  ADMIN_DEBIT: 'Quản trị trừ buổi',
  RENEW_DURATION: 'Gia hạn thời gian sử dụng',
};

type Product = {
  id: number;
  name: string;
  level: string;
  sessionCount: number;
  durationDays: number | null;
  price: number;
  singleSessionPrice: number | null;
  benefits: string | null;
  isActive: boolean;
};

type RenewalOption = {
  id: number;
  name: string;
  level: string;
  durationDays: number;
  price: number;
  isActive: boolean;
  ptProductId: number | null;
  purchaseMode: string | null;
};

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PtCreditAdmin({ onProductsChanged }: { onProductsChanged?: () => void | Promise<void> }) {
  const [activeTab, setActiveTab] = useState<'packages' | 'renewals' | 'wallets' | 'coachChanges'>('packages');

  // Package products state
  const [products, setProducts] = useState<Product[]>([]);
  const [singleOffers, setSingleOffers] = useState<Awaited<ReturnType<typeof api.adminTrainers.getPtSingleOffers>>>([]);
  const [singleDrafts, setSingleDrafts] = useState<Record<string, { price: number; durationDays: number; maxQuantity: number; benefits: string }>>({});
  const [singleBusy, setSingleBusy] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; level: string; sessionCount: number; durationDays: number; price: number; singleSessionPrice: number | null; benefits: string }>({
    name: '',
    level: 'BEGINNER',
    sessionCount: 10,
    durationDays: 30,
    price: 500000,
    singleSessionPrice: null,
    benefits: '',
  });
  const [coachChanges, setCoachChanges] = useState<Awaited<ReturnType<typeof api.adminTrainers.getPendingPtCoachChanges>>>([]);
  const [makeupRequests, setMakeupRequests] = useState<Awaited<ReturnType<typeof api.adminTrainers.getPtMakeupOperations>>>([]);
  const [makeupCoaches, setMakeupCoaches] = useState<Record<number, Array<{ userId: number; fullName: string }>>>({});
  const [makeupCoachIds, setMakeupCoachIds] = useState<Record<number, number>>({});
  const [makeupReasons, setMakeupReasons] = useState<Record<number, string>>({});
  const [makeupExceptionsOpen, setMakeupExceptionsOpen] = useState<Record<number, boolean>>({});
  const [makeupBusy, setMakeupBusy] = useState<number | null>(null);
  const [coachChangeBusy, setCoachChangeBusy] = useState<number | null>(null);
  const [coachChangeNotes, setCoachChangeNotes] = useState<Record<number, string>>({});
  const [coachChangePreviews, setCoachChangePreviews] = useState<Record<number, Awaited<ReturnType<typeof api.adminTrainers.previewPtCoachChange>>>>({});
  const [coachPreviewBusy, setCoachPreviewBusy] = useState<number | null>(null);
  const [coachPreviewErrors, setCoachPreviewErrors] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productFilter, setProductFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Renewal options state
  const [renewalOptions, setRenewalOptions] = useState<RenewalOption[]>([]);
  const [renewalProductId, setRenewalProductId] = useState('');
  const [renewalDurationDays, setRenewalDurationDays] = useState(30);
  const [renewalPrice, setRenewalPrice] = useState(100000);
  const [editingRenewalId, setEditingRenewalId] = useState<number | null>(null);
  const [isRenewalFormOpen, setIsRenewalFormOpen] = useState(false);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);

  // Wallet search & management state
  const [memberId, setMemberId] = useState('');
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof api.adminTrainers.getPtWallet>> | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [adjustment, setAdjustment] = useState({ level: 'BEGINNER', delta: 1, reason: '' });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [isAdjustFormOpen, setIsAdjustFormOpen] = useState(false);

  // Notification / Alert message
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const durationInputRef = useRef<HTMLInputElement>(null);

  const activeProducts = products.filter(product => product.isActive);
  const renewalProducts = activeProducts.filter(product => product.durationDays && product.durationDays > 0);
  const productsMissingDuration = activeProducts.filter(product => !product.durationDays || product.durationDays <= 0);
  const selectedRenewalProduct = renewalProducts.find(product => String(product.id) === renewalProductId);

  const load = async () => {
    try {
      const [productList, optionList, pendingChanges, offerList] = await Promise.all([
        api.adminTrainers.getPtProducts(),
        api.adminTrainers.getPtRenewalOptions(),
        api.adminTrainers.getPendingPtCoachChanges(),
        api.adminTrainers.getPtSingleOffers(),
      ]);
      setProducts(productList);
      setRenewalOptions(optionList);
      setCoachChanges(pendingChanges);
      setSingleOffers(offerList);
      setSingleDrafts(
        Object.fromEntries(
          offerList.map(offer => [
            offer.level,
            { price: Number(offer.price), durationDays: offer.durationDays, maxQuantity: offer.maxQuantity, benefits: offer.benefits ?? '' },
          ])
        )
      );
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không tải được danh sách gói PT.',
        type: 'error',
      });
    }
  };

  const loadMakeup = async () => {
    try {
      setMakeupRequests(await api.adminTrainers.getPtMakeupOperations());
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không tải được yêu cầu học bù.', type: 'error' });
    }
  };

  useEffect(() => {
    void load();
    void loadMakeup();
  }, []);

  const findMakeupCoaches = async (request: (typeof makeupRequests)[number]) => {
    const level = request.originalBooking.ptCreditAllocation?.batch.level ?? request.originalBooking.membership?.package.ptLevel;
    if (!level) {
      setMessage({ text: `Quyền học bù #${request.id} chưa rõ cấp PT; cần đối soát trước khi đổi HLV.`, type: 'error' });
      return;
    }
    try {
      const candidates = await api.adminTrainers.getEligiblePtMakeupCoaches(level);
      const currentCoachId = request.assignedCoachId ?? request.originalBooking.coachId;
      setMakeupCoaches(previous => ({ ...previous, [request.id]: candidates.filter(coach => coach.userId !== currentCoachId) }));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không tải được HLV phù hợp.', type: 'error' });
    }
  };

  const assignMakeupCoach = async (requestId: number) => {
    const coachId = makeupCoachIds[requestId];
    const reason = makeupReasons[requestId]?.trim();
    if (!coachId || !reason) {
      setMessage({ text: 'Chọn HLV mới và nhập lý do sắp xếp lại buổi học bù.', type: 'error' });
      return;
    }
    setMakeupBusy(requestId);
    try {
      await api.adminTrainers.assignPtMakeupCoach(requestId, coachId, reason);
      await loadMakeup();
      setMessage({ text: `Đã chuyển quyền học bù #${requestId} sang HLV mới và thông báo hội viên.`, type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không thể giao HLV cho buổi học bù.', type: 'error' });
    } finally {
      setMakeupBusy(null);
    }
  };

  const reviewMakeupChoice = async (requestId: number, decision: 'APPROVED' | 'REJECTED') => {
    const reason = makeupReasons[requestId]?.trim();
    if (!reason) {
      setMessage({ text: 'Nhập lý do duyệt hoặc từ chối để lưu audit log và thông báo hội viên.', type: 'error' });
      return;
    }
    setMakeupBusy(requestId);
    try {
      await api.adminTrainers.reviewPtMakeupCoachChange(requestId, decision, reason, decision === 'REJECTED' ? makeupCoachIds[requestId] : undefined);
      await loadMakeup();
      setMessage({
        text: decision === 'APPROVED' ? 'Đã duyệt HLV; hội viên có thể chọn ca để đặt lịch.' : 'Đã thông báo lý do từ chối. Hội viên có thể chọn HLV khác.',
        type: 'success',
      });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không thể xử lý đề nghị.', type: 'error' });
    } finally {
      setMakeupBusy(null);
    }
  };

  const saveSingleOffer = async (level: string) => {
    const draft = singleDrafts[level];
    if (!draft) return;
    setSingleBusy(level);
    try {
      await api.adminTrainers.savePtSingleOffer(level, draft);
      await load();
      setMessage({ text: `Đã lưu cấu hình bán buổi lẻ ${levelNames[level]}.`, type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không lưu được giá buổi lẻ.', type: 'error' });
    } finally {
      setSingleBusy(null);
    }
  };

  const toggleSingleOffer = async (level: string, isActive: boolean) => {
    setSingleBusy(level);
    try {
      await api.adminTrainers.setPtSingleOfferActive(level, isActive);
      await load();
      setMessage({
        text: isActive ? `Đã mở bán buổi lẻ ${levelNames[level]}.` : `Đã tạm ngừng bán buổi lẻ ${levelNames[level]}.`,
        type: 'info',
      });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không đổi được trạng thái bán.', type: 'error' });
    } finally {
      setSingleBusy(null);
    }
  };

  const editProduct = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      level: product.level,
      sessionCount: product.sessionCount,
      durationDays: product.durationDays ?? 30,
      price: Number(product.price),
      singleSessionPrice: product.singleSessionPrice == null ? null : Number(product.singleSessionPrice),
      benefits: product.benefits ?? '',
    });
    setIsFormOpen(true);
    setActiveTab('packages');
    setTimeout(() => durationInputRef.current?.focus(), 100);
  };

  const handleCancelProductEdit = () => {
    setEditingId(null);
    setForm({ name: '', level: 'BEGINNER', sessionCount: 10, durationDays: 30, price: 500000, singleSessionPrice: null, benefits: '' });
    setIsFormOpen(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductSubmitting(true);
    try {
      const wasEditing = editingId !== null;
      if (editingId) {
        await api.adminTrainers.updatePtProduct(editingId, form);
      } else {
        await api.adminTrainers.createPtProduct(form);
      }
      handleCancelProductEdit();
      await load();
      await onProductsChanged?.();
      setMessage({
        text: wasEditing ? 'Cập nhật gói PT thành công.' : 'Tạo gói PT mới thành công.',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Lỗi khi lưu gói PT.',
        type: 'error',
      });
    } finally {
      setProductSubmitting(false);
    }
  };

  const loadCoachChangePreview = async (id: number) => {
    setCoachPreviewBusy(id);
    setCoachChangePreviews(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setCoachPreviewErrors(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    try {
      const preview = await api.adminTrainers.previewPtCoachChange(id);
      setCoachChangePreviews(previous => ({ ...previous, [id]: preview }));
    } catch (error) {
      setCoachPreviewErrors(previous => ({ ...previous, [id]: error instanceof Error ? error.message : 'Không xem trước được lịch.' }));
    } finally {
      setCoachPreviewBusy(null);
    }
  };

  const handleCoachChange = async (id: number, decision: 'APPROVED' | 'REJECTED') => {
    const note = coachChangeNotes[id]?.trim() ?? '';
    if (decision === 'REJECTED' && !note) {
      setMessage({ text: 'Nhập lý do từ chối để thông báo cho hội viên.', type: 'error' });
      return;
    }
    const previewToken = coachChangePreviews[id]?.token;
    if (decision === 'APPROVED' && !previewToken) {
      setMessage({ text: 'Xem trước các lịch trước khi duyệt đổi HLV.', type: 'error' });
      return;
    }
    setCoachChangeBusy(id);
    try {
      const result = await api.adminTrainers.resolvePtCoachChange(id, decision, note, previewToken);
      await load();
      setCoachChangeNotes(previous => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setCoachChangePreviews(previous => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setMessage({
        text:
          decision === 'APPROVED'
            ? `Đã đổi HLV: chuyển ${result.summary?.transferable.length ?? 0} lịch, giữ HLV cũ cho ${result.summary?.keepOldCoach.length ?? 0} lịch gần giờ, hủy và hoàn Credit ${result.summary?.toCancel.length ?? 0} lịch.`
            : 'Đã từ chối yêu cầu đổi HLV gói PT.',
        type: 'success',
      });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.', type: 'error' });
      if (decision === 'APPROVED') void loadCoachChangePreview(id);
    } finally {
      setCoachChangeBusy(null);
    }
  };

  const handleArchiveProduct = async (product: Product) => {
    if (!confirm(`Bạn có chắc muốn ngừng bán gói "${product.name}"?`)) return;
    try {
      await api.adminTrainers.archivePtProduct(product.id);
      await load();
      await onProductsChanged?.();
      setMessage({ text: `Đã ngừng bán gói "${product.name}".`, type: 'info' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không thể ngừng bán gói PT.',
        type: 'error',
      });
    }
  };

  const handleRestoreProduct = async (product: Product) => {
    try {
      await api.adminTrainers.restorePtProduct(product.id);
      await load();
      await onProductsChanged?.();
      setMessage({ text: `Đã khôi phục và mở bán lại gói "${product.name}".`, type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không thể khôi phục gói PT.',
        type: 'error',
      });
    }
  };

  const handleEditRenewalOption = (option: RenewalOption) => {
    if (option.purchaseMode === 'SINGLE') {
      setEditingRenewalId(option.id);
      setRenewalProductId(`single:${option.level}`);
      setRenewalDurationDays(option.durationDays);
      setRenewalPrice(Number(option.price));
      setIsRenewalFormOpen(true);
      return;
    }
    const product =
      renewalProducts.find(item => item.id === option.ptProductId) ??
      renewalProducts.find(item => item.name === option.name && item.level === option.level);
    setEditingRenewalId(option.id);
    setRenewalProductId(product ? String(product.id) : '');
    setRenewalDurationDays(option.durationDays);
    setRenewalPrice(Number(option.price));
    setIsRenewalFormOpen(true);
  };

  const handleCancelRenewalEdit = () => {
    setEditingRenewalId(null);
    setRenewalProductId('');
    setRenewalDurationDays(30);
    setRenewalPrice(100000);
    setIsRenewalFormOpen(false);
  };

  const handleSaveRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    const singleLevel = renewalProductId.startsWith('single:') ? renewalProductId.slice(7) : null;
    if (!selectedRenewalProduct && !singleLevel) {
      setMessage({ text: 'Vui lòng chọn gói PT hợp lệ có thời hạn.', type: 'error' });
      return;
    }
    setRenewalSubmitting(true);
    try {
      const oldMode = editingRenewalId ? renewalOptions.find(option => option.id === editingRenewalId)?.purchaseMode : undefined;
      const payload = {
        ...(singleLevel ? { level: singleLevel, purchaseMode: 'SINGLE' as const } : { productId: selectedRenewalProduct!.id, purchaseMode: oldMode === null ? null : ('PACKAGE' as const) }),
        durationDays: renewalDurationDays,
        price: renewalPrice,
      };
      if (editingRenewalId) {
        await api.adminTrainers.updatePtRenewalOption(editingRenewalId, payload);
      } else {
        await api.adminTrainers.createPtRenewalOption(payload);
      }
      handleCancelRenewalEdit();
      await load();
      setMessage({ text: 'Lưu mức giá gia hạn PT thành công.', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không lưu được giá gia hạn PT.',
        type: 'error',
      });
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const handleArchiveRenewal = async (option: RenewalOption) => {
    if (!confirm(`Ngừng bán tùy chọn gia hạn "${option.name}"?`)) return;
    try {
      await api.adminTrainers.archivePtRenewalOption(option.id);
      await load();
      setMessage({ text: 'Đã ngừng áp dụng giá gia hạn này.', type: 'info' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không thể ngừng bán tùy chọn gia hạn.',
        type: 'error',
      });
    }
  };

  const handleRestoreRenewal = async (option: RenewalOption) => {
    try {
      await api.adminTrainers.restorePtRenewalOption(option.id);
      await load();
      setMessage({ text: `Đã khôi phục mức giá gia hạn "${option.name}".`, type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không thể khôi phục giá gia hạn.',
        type: 'error',
      });
    }
  };

  const findWallet = async (overrideId?: string) => {
    const query = (overrideId ?? memberId).trim().toUpperCase();
    const cleanId = query.startsWith('MEM-') ? query.replace('MEM-', '') : query;
    const id = Number(cleanId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setMessage({ text: 'Vui lòng nhập mã hội viên hợp lệ (ví dụ: 6 hoặc MEM-6).', type: 'error' });
      return;
    }
    setWalletLoading(true);
    try {
      const data = await api.adminTrainers.getPtWallet(id);
      setWallet(data);
      setMessage(null);
    } catch (error) {
      setWallet(null);
      setMessage({
        text: error instanceof Error ? error.message : 'Không tìm thấy ví PT của hội viên này.',
        type: 'error',
      });
    } finally {
      setWalletLoading(false);
    }
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustment.reason.trim()) {
      setMessage({ text: 'Vui lòng nhập lý do điều chỉnh số buổi để kiểm toán.', type: 'error' });
      return;
    }
    const cleanId = memberId.trim().toUpperCase().replace('MEM-', '');
    const id = Number(cleanId);
    setAdjustSubmitting(true);
    try {
      await api.adminTrainers.adjustPtWallet(id, adjustment);
      const updated = await api.adminTrainers.getPtWallet(id);
      setWallet(updated);
      setIsAdjustFormOpen(false);
      setAdjustment({ level: 'BEGINNER', delta: 1, reason: '' });
      setMessage({ text: 'Điều chỉnh số buổi trong ví hội viên thành công.', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không thể điều chỉnh số buổi.',
        type: 'error',
      });
    } finally {
      setAdjustSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert / Toast bar */}
      {message && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-all ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : message.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : message.type === 'error' ? (
              <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
            ) : (
              <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            )}
            <span className="font-medium text-xs sm:text-sm">{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={val => {
          setActiveTab(val as typeof activeTab);
          if (val === 'coachChanges') void loadMakeup();
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 bg-muted/60 p-1 group-data-[orientation=horizontal]/tabs:h-10 h-10 rounded-xl">
          <TabsTrigger value="packages" className="h-full py-0 flex items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm font-semibold">
            <Dumbbell className="size-4 text-primary shrink-0" />
            <span>Gói Buổi Tập PT</span>
            <Badge variant="secondary" className="hidden sm:inline-flex ml-1 text-[11px] font-semibold px-1.5 py-0 leading-none">
              {products.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="renewals" className="h-full py-0 flex items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm font-semibold">
            <RefreshCw className="size-4 text-emerald-600 shrink-0" />
            <span>Bảng Giá Gia Hạn</span>
            <Badge variant="secondary" className="hidden sm:inline-flex ml-1 text-[11px] font-semibold px-1.5 py-0 leading-none">
              {renewalOptions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="wallets" className="h-full py-0 flex items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm font-semibold">
            <Wallet className="size-4 text-amber-600 shrink-0" />
            <span>Ví PT Hội Viên</span>
          </TabsTrigger>
          <TabsTrigger value="coachChanges" className="h-full py-0 flex items-center justify-center gap-1.5 rounded-lg text-xs sm:text-sm font-semibold">
            <ShieldAlert className="size-4 text-rose-600 shrink-0" />
            <span>Đổi HLV & Bù Ca</span>
            {(coachChanges.length + makeupRequests.length) > 0 && (
              <Badge variant="destructive" className="ml-1 text-[11px] font-bold px-1.5 py-0 leading-none animate-pulse">
                {coachChanges.length + makeupRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: GÓI BUỔI TẬP PT ================= */}
        <TabsContent value="packages" className="space-y-4 pt-3">
          {/* Section A: Buổi PT lẻ theo cấp độ */}
          <Card className="border border-border/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-3 pt-3.5 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm sm:text-base font-bold">Cấu Hình Bán Buổi PT Lẻ Theo Cấp Độ</CardTitle>
                    <CardDescription className="text-xs">
                      Thiết lập giá lẻ, hạn dùng và số buổi tối đa cho mỗi lần mua thêm của hội viên.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="grid gap-3.5 md:grid-cols-3">
                {paidLevels.map(level => {
                  const offer = singleOffers.find(item => item.level === level);
                  const draft = singleDrafts[level] ?? { price: 0, durationDays: 30, maxQuantity: 20, benefits: '' };
                  const change = (patch: Partial<typeof draft>) => setSingleDrafts(current => ({ ...current, [level]: { ...draft, ...patch } }));
                  const isBusy = singleBusy === level;

                  return (
                    <div
                      key={level}
                      className="flex flex-col justify-between rounded-xl border bg-card p-3.5 shadow-xs hover:border-primary/40 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block size-2 rounded-full ${level === 'BEGINNER' ? 'bg-emerald-500' : level === 'INTERMEDIATE' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                          <span className="font-bold text-sm text-foreground">{levelNames[level]}</span>
                        </div>
                        <Badge
                          variant={offer?.isActive ? 'default' : 'secondary'}
                          className={`text-[10px] font-semibold ${offer?.isActive ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                        >
                          {offer?.isActive ? 'Đang mở bán' : 'Tạm dừng bán'}
                        </Badge>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div>
                          <Label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between mb-1">
                            <span>Đơn giá 1 buổi</span>
                            <span className="text-[10px] font-semibold text-primary">{draft.price > 0 ? formatVND(draft.price) : '0 đ'}</span>
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="1"
                              step="1000"
                              placeholder="0"
                              className="h-8 text-xs font-semibold pr-10"
                              value={draft.price === 0 ? '' : draft.price}
                              onChange={e => change({ price: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                            />
                            <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] text-muted-foreground">VNĐ</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Hạn dùng</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min="1"
                                max="3650"
                                placeholder="30"
                                className="h-8 text-xs pr-10"
                                value={draft.durationDays === 0 ? '' : draft.durationDays}
                                onChange={e => change({ durationDays: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                              />
                              <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] text-muted-foreground">ngày</span>
                            </div>
                          </div>
                          <div>
                            <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Tối đa / đơn</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                placeholder="20"
                                className="h-8 text-xs pr-10"
                                value={draft.maxQuantity === 0 ? '' : draft.maxQuantity}
                                onChange={e => change({ maxQuantity: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                              />
                              <span className="pointer-events-none absolute right-2.5 top-2 text-[10px] text-muted-foreground">buổi</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Quyền lợi hiển thị</Label>
                          <Input
                            maxLength={1000}
                            className="h-8 text-xs"
                            value={draft.benefits}
                            onChange={e => change({ benefits: e.target.value })}
                            placeholder="VD: Đặt lịch PT, QR check-in..."
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-2 border-t">
                        <Button
                          size="sm"
                          className="h-7 text-xs flex-1 gap-1"
                          disabled={isBusy || draft.price < 1}
                          onClick={() => void saveSingleOffer(level)}
                        >
                          {isBusy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                          Lưu
                        </Button>
                        {offer && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            disabled={isBusy}
                            onClick={() => void toggleSingleOffer(level, !offer.isActive)}
                          >
                            {offer.isActive ? 'Ngừng' : 'Mở bán'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Section B: Action Toolbar & Danh sách Gói PT Trọn Gói */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
                <Button
                  type="button"
                  variant={productFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-3 font-semibold rounded-md"
                  onClick={() => setProductFilter('all')}
                >
                  Tất cả ({products.length})
                </Button>
                <Button
                  type="button"
                  variant={productFilter === 'active' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-3 font-semibold text-emerald-700 dark:text-emerald-400 rounded-md"
                  onClick={() => setProductFilter('active')}
                >
                  Đang bán ({activeProducts.length})
                </Button>
                <Button
                  type="button"
                  variant={productFilter === 'inactive' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-3 font-semibold text-muted-foreground rounded-md"
                  onClick={() => setProductFilter('inactive')}
                >
                  Đã ngừng ({products.length - activeProducts.length})
                </Button>
              </div>
              {productsMissingDuration.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="size-3" />
                  {productsMissingDuration.length} gói chưa gán thời hạn
                </span>
              )}
            </div>

            {!isFormOpen && (
              <Button onClick={() => setIsFormOpen(true)} className="gap-1.5 shadow-sm font-semibold h-8 text-xs">
                <Plus className="size-4" /> Tạo Gói PT Mới
              </Button>
            )}
          </div>

          {/* Form Tạo/Sửa Gói PT */}
          {isFormOpen && (
            <Card className="border-2 border-primary/40 bg-card shadow-md animate-in fade-in-50 duration-200">
              <CardHeader className="bg-primary/5 border-b pb-3 pt-3.5 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                      {editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        {editingId ? 'Cập Nhật Gói Buổi Tập PT' : 'Tạo Gói Buổi Tập PT Mới'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Thiết lập tên gói, số buổi, cấp độ HLV và thời hạn sử dụng cho hội viên
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={handleCancelProductEdit}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleSaveProduct} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Tên gói */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pkg-name" className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Tag className="size-3.5 text-muted-foreground" />
                        Tên gói PT <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="pkg-name"
                        placeholder="VD: Gói PT Cơ Bản 10 Buổi (Level 1)"
                        required
                        className="h-9 text-sm"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                      />
                    </div>

                    {/* Cấp độ HLV */}
                    <div className="space-y-1.5">
                      <Label htmlFor="pkg-level" className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Layers className="size-3.5 text-muted-foreground" />
                        Cấp độ Huấn Luyện Viên <span className="text-rose-500">*</span>
                      </Label>
                      <select
                        id="pkg-level"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs sm:text-sm font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={form.level}
                        onChange={e => setForm({ ...form, level: e.target.value })}
                      >
                        {paidLevels.map(lvl => (
                          <option key={lvl} value={lvl}>
                            {levelNames[lvl]} ({lvl})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Số buổi */}
                    <div className="space-y-1.5">
                      <Label htmlFor="pkg-sessions" className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Dumbbell className="size-3.5 text-muted-foreground" />
                        Số buổi trong gói <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="pkg-sessions"
                          type="number"
                          min="1"
                          max="100"
                          required
                          placeholder="10"
                          className="h-9 text-sm font-semibold pr-12"
                          value={form.sessionCount === 0 ? '' : form.sessionCount}
                          onChange={e => setForm({ ...form, sessionCount: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-medium text-muted-foreground">buổi</span>
                      </div>
                    </div>

                    {/* Thời hạn */}
                    <div className="space-y-1.5">
                      <Label htmlFor="pkg-duration" className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        Thời hạn sử dụng <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          ref={durationInputRef}
                          id="pkg-duration"
                          type="number"
                          min="1"
                          max="3650"
                          required
                          placeholder="30"
                          className="h-9 text-sm font-semibold pr-12"
                          value={form.durationDays === 0 ? '' : form.durationDays}
                          onChange={e => setForm({ ...form, durationDays: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-medium text-muted-foreground">ngày</span>
                      </div>
                    </div>

                    {/* Giá trọn gói */}
                    <div className="space-y-1.5">
                      <Label htmlFor="pkg-price" className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <span className="font-bold text-emerald-600">₫</span>
                        Giá trọn gói (VNĐ) <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="pkg-price"
                          type="number"
                          min="1000"
                          step="1000"
                          required
                          placeholder="500000"
                          className="h-9 text-sm font-bold text-primary pr-12"
                          value={form.price === 0 ? '' : form.price}
                          onChange={e => setForm({ ...form, price: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-medium text-muted-foreground">VNĐ</span>
                      </div>
                    </div>

                    {/* Quyền lợi hiển thị */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pt-benefits" className="text-xs font-semibold text-foreground">
                        Quyền lợi hiển thị cho hội viên
                      </Label>
                      <Input
                        id="pt-benefits"
                        maxLength={1000}
                        placeholder="VD: Kiểm tra InBody miễn phí, giáo án bài bản, QR check-in..."
                        className="h-9 text-xs sm:text-sm"
                        value={form.benefits}
                        onChange={e => setForm({ ...form, benefits: e.target.value })}
                      />
                    </div>

                    {/* Live Calculation Preview Card */}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col justify-center">
                      <span className="text-[11px] font-medium text-muted-foreground">Đơn giá trung bình ước tính:</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-bold text-primary">
                          {form.sessionCount > 0 ? formatVND(Math.round(form.price / form.sessionCount)) : '0 đ'}
                        </span>
                        <span className="text-xs text-muted-foreground">/ 1 buổi</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelProductEdit}>
                      Hủy bỏ
                    </Button>
                    <Button type="submit" size="sm" disabled={productSubmitting} className="min-w-28 font-semibold">
                      {productSubmitting ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Đang lưu...</span>
                        </div>
                      ) : editingId ? (
                        'Lưu thay đổi'
                      ) : (
                        'Tạo gói PT'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table Danh sách các gói PT */}
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="text-xs">
                  <TableHead className="font-bold py-3">Tên Gói PT</TableHead>
                  <TableHead className="font-bold py-3">Cấp Độ HLV</TableHead>
                  <TableHead className="text-center font-bold py-3">Quy Cách</TableHead>
                  <TableHead className="text-right font-bold py-3">Giá Trọn Gói</TableHead>
                  <TableHead className="text-right font-bold py-3">Đơn Giá / Buổi</TableHead>
                  <TableHead className="font-bold py-3">Quyền Lợi</TableHead>
                  <TableHead className="text-center font-bold py-3">Trạng Thái</TableHead>
                  <TableHead className="text-right font-bold py-3 pr-4">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const displayedProducts = products.filter(p => {
                    if (productFilter === 'active') return p.isActive;
                    if (productFilter === 'inactive') return !p.isActive;
                    return true;
                  });

                  if (displayedProducts.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={8} className="h-28 text-center text-xs text-muted-foreground">
                          {productFilter === 'inactive'
                            ? 'Không có gói PT nào đã ngừng bán.'
                            : productFilter === 'active'
                            ? 'Chưa có gói PT nào đang mở bán.'
                            : 'Chưa có gói PT nào. Hãy bấm "Tạo Gói PT Mới" để bắt đầu.'}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return displayedProducts.map(product => {
                    const avgPrice = product.sessionCount > 0 ? Math.round(product.price / product.sessionCount) : 0;
                    return (
                      <TableRow key={product.id} className={`text-xs hover:bg-muted/30 transition-colors ${!product.isActive ? 'opacity-65 bg-muted/15' : ''}`}>
                        <TableCell className="font-semibold text-foreground py-3">
                          <div className="flex items-center gap-2">
                            <span>{product.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">#{product.id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className={`text-[10px] font-semibold ${levelBadgeVariants[product.level] || ''}`}>
                            {levelNames[product.level] ?? product.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <div className="inline-flex items-center gap-1 font-semibold">
                            <span>{product.sessionCount} buổi</span>
                            <span className="text-muted-foreground text-[11px] font-normal">• {product.durationDays ? `${product.durationDays} ngày` : '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground py-3">
                          {formatVND(Number(product.price))}
                        </TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground py-3">
                          {formatVND(avgPrice)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-[11px] py-3">
                          {product.benefits || '—'}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          {product.isActive ? (
                            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-semibold">
                              Đang bán
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground font-semibold">
                              Đã ngừng
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-3 pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Chỉnh sửa gói"
                              onClick={() => editProduct(product)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            {product.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px]"
                                onClick={() => void handleArchiveProduct(product)}
                              >
                                Ngừng bán
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px]"
                                onClick={() => void handleRestoreProduct(product)}
                              >
                                Mở lại
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ================= TAB 2: BẢNG GIÁ GIA HẠN ================= */}
        <TabsContent value="renewals" className="space-y-4 pt-3">
          {/* Policy Info Card */}
          <div className="rounded-xl border border-blue-200/90 bg-blue-50/60 p-4 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                <Info className="size-4" />
              </div>
              <div className="space-y-1 leading-relaxed">
                <p className="font-bold text-sm text-blue-950 dark:text-blue-100">Quy định & Chính sách gia hạn hạn dùng buổi PT</p>
                <p>
                  • <strong>Gia hạn chỉ cộng thêm số ngày sử dụng</strong> cho các buổi tập còn lại chưa dùng, không tăng thêm số buổi. Các buổi chưa dùng sẽ được mở khóa lại để hội viên tiếp tục book lịch tập.
                </p>
                <p>
                  • Hội viên chỉ được phép gia hạn trong vòng <strong>30 ngày (Grace Period)</strong> kể từ ngày gói hết hạn. Quá 30 ngày, hệ thống sẽ tự động khóa và yêu cầu mua gói mới.
                </p>
              </div>
            </div>
          </div>

          {/* Missing Duration Warning */}
          {productsMissingDuration.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Có <strong>{productsMissingDuration.length}</strong> gói PT chưa có thời hạn, không thể tạo giá gia hạn: {productsMissingDuration.map(p => p.name).join(', ')}.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300 bg-background font-semibold"
                onClick={() => editProduct(productsMissingDuration[0])}
              >
                Cấu hình thời hạn ngay
              </Button>
            </div>
          )}

          {/* Action Header */}
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground font-medium">
              Hiện có <strong>{renewalOptions.length}</strong> tùy chọn mức giá gia hạn được cấu hình.
            </p>
            {!isRenewalFormOpen && (
              <Button
                onClick={() => setIsRenewalFormOpen(true)}
                disabled={renewalProducts.length === 0 && singleOffers.length === 0}
                className="gap-1.5 shadow-sm font-semibold h-8 text-xs"
              >
                <Plus className="size-4" /> Thiết Lập Giá Gia Hạn Mới
              </Button>
            )}
          </div>

          {/* Form Thiết lập giá gia hạn */}
          {isRenewalFormOpen && (
            <Card className="border-2 border-emerald-500/40 bg-card shadow-md animate-in fade-in-50 duration-200">
              <CardHeader className="bg-emerald-50/40 dark:bg-emerald-950/20 border-b pb-3 pt-3.5 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                      <RefreshCw className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        {editingRenewalId ? 'Cập Nhật Mức Giá Gia Hạn' : 'Thiết Lập Mức Giá Gia Hạn Mới'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Liên kết gói PT đang bán với số ngày gia hạn và mức phí bổ sung
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={handleCancelRenewalEdit}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleSaveRenewal} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Chọn gói PT */}
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label htmlFor="rn-product" className="text-xs font-semibold text-foreground">
                        Gói PT Áp Dụng <span className="text-rose-500">*</span>
                      </Label>
                      <select
                        id="rn-product"
                        required
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs sm:text-sm font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={renewalProductId}
                        onChange={e => {
                          const prod = renewalProducts.find(p => String(p.id) === e.target.value);
                          const single = singleOffers.find(item => `single:${item.level}` === e.target.value);
                          setRenewalProductId(e.target.value);
                          setRenewalDurationDays(prod?.durationDays ?? single?.durationDays ?? 30);
                        }}
                      >
                        <option value="">-- Chọn gói PT có sẵn --</option>
                        {renewalProducts.map(prod => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} ({levelNames[prod.level]} · {prod.sessionCount} buổi · {prod.durationDays} ngày)
                          </option>
                        ))}
                        {singleOffers.map(offer => (
                          <option key={`single:${offer.level}`} value={`single:${offer.level}`}>
                            Buổi lẻ {levelNames[offer.level]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Số ngày gia hạn */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="rn-days" className="text-xs font-semibold text-foreground">
                          Số ngày gia hạn thêm <span className="text-rose-500">*</span>
                        </Label>
                        <div className="flex gap-1 text-[11px]">
                          {[7, 14, 30].map(days => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setRenewalDurationDays(days)}
                              className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700 transition-colors font-medium"
                            >
                              +{days}d
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          id="rn-days"
                          type="number"
                          min="1"
                          max="365"
                          required
                          className="h-9 text-sm font-semibold pr-12"
                          placeholder="30"
                          value={renewalDurationDays === 0 ? '' : renewalDurationDays}
                          onChange={e => setRenewalDurationDays(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">ngày</span>
                      </div>
                    </div>

                    {/* Mức phí gia hạn */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rn-price" className="text-xs font-semibold text-foreground">
                        Mức phí gia hạn (VNĐ) <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="rn-price"
                          type="number"
                          min="0"
                          step="1000"
                          required
                          placeholder="100000"
                          className="h-9 text-sm font-bold text-emerald-700 dark:text-emerald-400 pr-12"
                          value={renewalPrice === 0 ? '' : renewalPrice}
                          onChange={e => setRenewalPrice(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">VNĐ</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelRenewalEdit}>
                      Hủy bỏ
                    </Button>
                    <Button type="submit" size="sm" disabled={renewalSubmitting} className="min-w-28 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                      {renewalSubmitting ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Đang lưu...</span>
                        </div>
                      ) : (
                        'Lưu mức giá'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table Bảng Giá Gia Hạn */}
          <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="text-xs">
                  <TableHead className="font-bold py-3">Gói PT / Tên Tùy Chọn</TableHead>
                  <TableHead className="font-bold py-3">Cấp Độ HLV</TableHead>
                  <TableHead className="text-center font-bold py-3">Thời Gian Gia Hạn</TableHead>
                  <TableHead className="text-right font-bold py-3">Phí Gia Hạn</TableHead>
                  <TableHead className="text-center font-bold py-3">Trạng Thái</TableHead>
                  <TableHead className="text-right font-bold py-3 pr-4">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renewalOptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                      Chưa có cấu hình giá gia hạn nào. Hãy bấm "Thiết Lập Giá Gia Hạn Mới" để thêm.
                    </TableCell>
                  </TableRow>
                ) : (
                  renewalOptions.map(option => (
                    <TableRow key={option.id} className={`text-xs hover:bg-muted/30 transition-colors ${!option.isActive ? 'opacity-65 bg-muted/15' : ''}`}>
                      <TableCell className="font-semibold text-foreground py-3">
                        <div className="flex items-center gap-1.5">
                          <span>{option.name}</span>
                          {option.purchaseMode === 'SINGLE' && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">Buổi lẻ</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${levelBadgeVariants[option.level] || ''}`}>
                          {levelNames[option.level] ?? option.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold py-3">
                        +{option.durationDays} ngày
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground py-3">
                        {formatVND(Number(option.price))}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {option.isActive ? (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-semibold">
                            Áp dụng
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground font-semibold">
                            Đã ngừng
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-3 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEditRenewalOption(option)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {option.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px]"
                              onClick={() => void handleArchiveRenewal(option)}
                            >
                              Ngừng
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-[11px]"
                              onClick={() => void handleRestoreRenewal(option)}
                            >
                              Mở lại
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ================= TAB 3: VÍ PT HỘI VIÊN ================= */}
        <TabsContent value="wallets" className="space-y-4 pt-3">
          {/* Search Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Nhập mã hội viên (Ví dụ: 6 hoặc MEM-6)..."
                className="pl-9 h-9 text-xs sm:text-sm font-medium"
                value={memberId}
                onChange={e => {
                  setMemberId(e.target.value);
                  if (!e.target.value) setWallet(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') void findWallet();
                }}
              />
            </div>
            <Button
              onClick={() => void findWallet()}
              disabled={walletLoading || !memberId.trim()}
              className="gap-1.5 h-9 text-xs sm:text-sm font-semibold shadow-xs"
            >
              {walletLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {walletLoading ? 'Đang tra cứu...' : 'Tra Cứu Ví'}
            </Button>
          </div>

          {/* Empty State when no wallet is loaded */}
          {!wallet && (
            <Card className="border border-dashed p-8 text-center bg-muted/15">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <Wallet className="size-6" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-foreground">Tra Cứu & Kiểm Soát Ví Buổi Tập PT</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
                Nhập mã hội viên (ID số hoặc mã định danh như <strong>MEM-6</strong>) để xem số buổi khả dụng, các đợt mua, hạn sử dụng và can thiệp cộng/trừ buổi có lưu audit log.
              </p>
            </Card>
          )}

          {/* Wallet Result View */}
          {wallet && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* 4 Metric KPI Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Có thể đặt */}
                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-emerald-100/30 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        Khả Dụng (Có Thể Đặt)
                      </span>
                      <CalendarCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-300">
                        {wallet.summary.available}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Buổi hợp lệ có thể book lịch ngay
                    </p>
                  </CardContent>
                </Card>

                {/* Đang giữ chỗ */}
                <Card className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-amber-100/30 dark:border-amber-900/50 dark:bg-amber-950/20 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        Đang Giữ Chỗ (Đã Đặt)
                      </span>
                      <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-300">
                        {wallet.summary.held}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Đang khóa cho các ca tập đã book
                    </p>
                  </CardContent>
                </Card>

                {/* Đã sử dụng */}
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50/80 to-blue-100/30 dark:border-blue-900/50 dark:bg-blue-950/20 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
                        Đã Hoàn Thành (Đã Tập)
                      </span>
                      <CheckCircle2 className="size-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight text-blue-700 dark:text-blue-300">
                        {wallet.summary.used}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Số ca tập đã check-in thành công
                    </p>
                  </CardContent>
                </Card>

                {/* Tổng đã cấp */}
                <Card className="border-muted bg-gradient-to-br from-muted/50 to-muted/20 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Tổng Buổi Đã Cấp
                      </span>
                      <Dumbbell className="size-4 text-muted-foreground" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight text-foreground">
                        {wallet.summary.total}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Tích lũy từ mọi nguồn (mua lẻ, gói, trial)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Chi tiết theo Cấp Độ */}
              <div className="grid gap-2.5 sm:grid-cols-4">
                {wallet.summary.levels.map(lvl => (
                  <div
                    key={lvl.level}
                    className="flex flex-col justify-between rounded-xl border bg-card p-3 shadow-xs text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground">
                        {levelNames[lvl.level] ?? lvl.level}
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-semibold ${levelBadgeVariants[lvl.level]}`}>
                        {lvl.available} khả dụng
                      </Badge>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-[11px]">
                      <span>Đã đặt: {lvl.held}</span>
                      <span>Đã tập: {lvl.used}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bảng Nguồn Buổi Tập (Batches) */}
              <Card className="shadow-xs overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-3 pt-3.5 px-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm sm:text-base font-bold">
                        Chi Tiết Các Đợt Cấp Buổi Tập (Batches)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Thời hạn, số buổi còn lại và khả năng gia hạn của từng lần mua
                      </CardDescription>
                    </div>
                    <Button
                      variant={isAdjustFormOpen ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setIsAdjustFormOpen(val => !val)}
                      className="gap-1.5 text-xs font-semibold h-8"
                    >
                      <SlidersHorizontal className="size-3.5 text-primary" />
                      {isAdjustFormOpen ? 'Đóng Can Thiệp' : 'Can Thiệp Số Buổi (+/-)'}
                    </Button>
                  </div>
                </CardHeader>

                {/* Form Điều chỉnh số buổi (Collapsible) */}
                {isAdjustFormOpen && (
                  <div className="m-4 rounded-xl border border-primary/30 bg-primary/5 p-4 animate-in fade-in-50 duration-150">
                    <form onSubmit={handleAdjustWallet} className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <ShieldAlert className="size-4" />
                        <span>Quản Trị Viên Can Thiệp Điều Chỉnh Số Buổi (Audit Log sẽ được lưu lại)</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Cấp Độ PT</Label>
                          <select
                            className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-xs"
                            value={adjustment.level}
                            onChange={e => setAdjustment({ ...adjustment, level: e.target.value })}
                          >
                            {paidLevels.map(lvl => (
                              <option key={lvl} value={lvl}>
                                {levelNames[lvl]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Số buổi (+ cộng hoặc − trừ)</Label>
                          <Input
                            type="number"
                            min="-100"
                            max="100"
                            className="h-8 text-xs font-bold"
                            placeholder="1"
                            value={adjustment.delta === 0 ? '' : adjustment.delta}
                            onChange={e => setAdjustment({ ...adjustment, delta: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Lý do can thiệp <span className="text-rose-500">*</span></Label>
                          <Input
                            placeholder="VD: Bù buổi do sự cố kỹ thuật..."
                            className="h-8 text-xs"
                            required
                            value={adjustment.reason}
                            onChange={e => setAdjustment({ ...adjustment, reason: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setIsAdjustFormOpen(false)}
                        >
                          Hủy
                        </Button>
                        <Button type="submit" size="sm" className="h-7 text-xs font-semibold" disabled={adjustSubmitting}>
                          {adjustSubmitting ? 'Đang lưu...' : 'Xác Nhận Lưu Thay Đổi'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="text-xs">
                          <TableHead className="font-bold py-3">Cấp Độ</TableHead>
                          <TableHead className="font-bold py-3">Nguồn Cấp</TableHead>
                          <TableHead className="text-center font-bold py-3">Còn / Đã Cấp</TableHead>
                          <TableHead className="text-center font-bold py-3">Có Thể Đặt</TableHead>
                          <TableHead className="font-bold py-3">Hạn Sử Dụng</TableHead>
                          <TableHead className="text-center font-bold py-3">Trạng Thái</TableHead>
                          <TableHead className="font-bold py-3">Gia Hạn Đến</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wallet.summary.sources.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-20 text-center text-xs text-muted-foreground">
                              Chưa có đợt cấp buổi nào.
                            </TableCell>
                          </TableRow>
                        ) : (
                          wallet.summary.sources.map(source => (
                            <TableRow key={source.id} className="text-xs hover:bg-muted/30">
                              <TableCell className="py-2.5">
                                <Badge variant="outline" className={`text-[10px] font-semibold ${levelBadgeVariants[source.level] || ''}`}>
                                  {levelNames[source.level] ?? source.level}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold text-foreground py-2.5">
                                {source.source}
                              </TableCell>
                              <TableCell className="text-center font-bold py-2.5">
                                {source.remainingSessions} / {source.quantity}
                              </TableCell>
                              <TableCell className="text-center py-2.5">
                                <span className={source.availableSessions > 0 ? 'font-bold text-emerald-600' : 'text-muted-foreground'}>
                                  {source.availableSessions}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground py-2.5">
                                {source.endAt ? formatDate(source.endAt) : 'Không giới hạn'}
                              </TableCell>
                              <TableCell className="text-center py-2.5">
                                {source.status === 'EXPIRED' ? (
                                  <Badge variant="destructive" className="text-[10px] font-semibold">
                                    HẾT HẠN
                                  </Badge>
                                ) : source.status === 'ACTIVE' ? (
                                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-semibold">
                                    HOẠT ĐỘNG
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] font-semibold">
                                    {source.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5">
                                {source.renewable ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                                    {formatDate(source.renewalDeadline)}
                                  </span>
                                ) : source.status === 'EXPIRED' ? (
                                  <span className="text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                                    Quá hạn gia hạn
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Lịch sử gia hạn & Lịch sử biến động giao dịch ví */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Lịch sử gia hạn */}
                <Card className="shadow-xs overflow-hidden">
                  <CardHeader className="py-3 px-4 border-b bg-muted/30">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                      <RefreshCw className="size-3.5 text-primary" />
                      Lịch Sử Các Lần Gia Hạn Thời Gian
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    {wallet.renewals.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        Hội viên chưa từng thực hiện gia hạn nào.
                      </p>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {wallet.renewals.map(rn => (
                          <div key={rn.id} className="flex items-center justify-between rounded-lg border p-2.5 bg-muted/20">
                            <div>
                              <p className="font-semibold text-foreground">Đợt #{rn.batchId} • +{rn.durationDays} ngày</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDate(rn.previousEndAt)} → {formatDate(rn.endAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600">{formatVND(Number(rn.payment.amount))}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDate(rn.payment.paidAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lịch sử biến động số dư */}
                <Card className="shadow-xs overflow-hidden">
                  <CardHeader className="py-3 px-4 border-b bg-muted/30">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                      <History className="size-3.5 text-primary" />
                      Nhật Ký Biến Động Số Buổi (Audit Log)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    {wallet.transactions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        Chưa có lịch sử giao dịch số buổi.
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs">
                        {wallet.transactions.map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 hover:bg-muted/20 p-1 rounded transition-colors">
                            <div>
                              <p className="font-semibold text-foreground">
                                {transactionNames[tx.kind] ?? tx.kind}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateTime(tx.createdAt)} {tx.note ? `• ${tx.note}` : ''}
                              </p>
                            </div>
                            <span className={`font-bold text-xs ${tx.quantity > 0 ? 'text-emerald-600' : tx.quantity < 0 ? 'text-rose-600' : 'text-primary'}`}>
                              {tx.kind === 'PROTECTED_CANCEL' ? '1 lượt bảo lưu' : `${tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} buổi`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 4: ĐỔI HLV & HỌC BÙ ================= */}
        <TabsContent value="coachChanges" className="space-y-4 pt-3">
          {/* Section A: Đổi HLV cho buổi học bù */}
          <Card className="border border-border/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-3 pt-3.5 px-4 sm:px-6">
              <div className="flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-amber-600/10 text-amber-600">
                    <UserCheck className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm sm:text-base font-bold">
                      Đổi HLV Cho Buổi Học Bù ({makeupRequests.length} yêu cầu)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {makeupRequests.filter(right => right.requestedCoachId).length} đang chờ duyệt, {makeupRequests.filter(right => !right.requestedCoachId).length} chờ hội viên chọn trên App.
                    </CardDescription>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1" onClick={() => void loadMakeup()}>
                  <RefreshCw className="size-3.5" />
                  Làm mới
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              {makeupRequests.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Hiện không có quyền học bù nào cần Admin phê duyệt.
                </div>
              )}
              {makeupRequests.map(right => {
                const currentCoachId = right.assignedCoachId ?? right.originalBooking.coachId;
                return (
                  <div key={right.id} className="rounded-xl border p-4 text-xs space-y-3 bg-card shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          Quyền học bù #{right.id}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {right.originalBooking.member?.fullName ?? `Hội viên #${right.originalBooking.memberId}`}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Hạn xử lý: <strong>{formatDateTime(right.expiresAt)}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                      <p>
                        HLV hiện tại: <strong className="text-foreground">{currentCoachId === right.originalBooking.coachId ? right.originalBooking.coach?.fullName ?? `#${currentCoachId}` : `HLV #${currentCoachId}`}</strong>
                      </p>
                      <p>
                        Lịch gốc: <strong className="text-foreground">{formatDateTime(right.originalBooking.startTime)}</strong>
                      </p>
                      <p>
                        HLV vắng: <strong className="text-rose-600">{right.coachAbsenceCount} lần</strong> • Gia hạn: {right.extensionCount} lần
                      </p>
                    </div>

                    {right.requestedCoachId ? (
                      <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 text-[10px] font-bold">
                            Chờ Admin Phê Duyệt
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            Gửi lúc {formatDateTime(right.coachChangeRequestedAt)}
                          </span>
                        </div>
                        <p className="text-foreground font-semibold">
                          HLV hội viên chọn: <span className="text-primary">{right.requestedCoachName ?? `#${right.requestedCoachId}`}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Lý do của hội viên: <span className="italic text-foreground">"{right.requestReason}"</span>
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-muted bg-muted/30 p-3 text-xs">
                        <Badge variant="secondary" className="text-[10px]">Chờ hội viên chọn HLV</Badge>
                        <p className="mt-1 text-muted-foreground">
                          Hội viên cần mở Mobile → Lịch PT → “Chọn HLV mong muốn” để gửi lựa chọn cho Admin duyệt.
                        </p>
                      </div>
                    )}

                    {right.requestedCoachId && (
                      <div className="space-y-2.5 pt-2 border-t">
                        <Label className="text-xs font-semibold">Lý do duyệt hoặc từ chối (bắt buộc lưu audit log)</Label>
                        <Input
                          placeholder="Nhập lý do phê duyệt hoặc nguyên nhân từ chối..."
                          maxLength={500}
                          className="h-8 text-xs"
                          value={makeupReasons[right.id] ?? ''}
                          onChange={event => setMakeupReasons(previous => ({ ...previous, [right.id]: event.target.value }))}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={makeupBusy !== null || !makeupReasons[right.id]?.trim()}
                            onClick={() => void reviewMakeupChoice(right.id, 'APPROVED')}
                          >
                            {makeupBusy === right.id ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
                            Duyệt HLV
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            disabled={makeupBusy !== null || !makeupReasons[right.id]?.trim()}
                            onClick={() => void reviewMakeupChoice(right.id, 'REJECTED')}
                          >
                            <X className="size-3 mr-1" />
                            Từ chối · Yêu cầu chọn lại
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Admin Exception Assignment */}
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground p-0"
                        onClick={() => setMakeupExceptionsOpen(previous => ({ ...previous, [right.id]: !previous[right.id] }))}
                      >
                        {makeupExceptionsOpen[right.id] ? <ChevronUp className="size-3 mr-1" /> : <ChevronDown className="size-3 mr-1" />}
                        Xử lý ngoại lệ: Admin chủ động phân HLV thay thế
                      </Button>

                      {makeupExceptionsOpen[right.id] && (
                        <div className="mt-2 rounded-lg border border-dashed p-3 space-y-2.5 bg-muted/20">
                          <p className="text-[11px] text-muted-foreground">
                            Chỉ dùng khi HLV cũ không thể tiếp tục hoặc hội viên không thể tự chọn.
                          </p>
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={makeupBusy !== null} onClick={() => void findMakeupCoaches(right)}>
                            Tìm HLV đủ cấp chuyên môn
                          </Button>
                          {(makeupCoaches[right.id] ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {(makeupCoaches[right.id] ?? []).map(coach => (
                                <Button
                                  key={coach.userId}
                                  size="sm"
                                  variant={makeupCoachIds[right.id] === coach.userId ? 'default' : 'outline'}
                                  className="h-7 text-xs"
                                  onClick={() => setMakeupCoachIds(previous => ({ ...previous, [right.id]: coach.userId }))}
                                >
                                  {coach.fullName}
                                </Button>
                              ))}
                            </div>
                          )}
                          <Input
                            placeholder="Lý do Admin phân HLV ngoại lệ..."
                            maxLength={500}
                            className="h-8 text-xs"
                            value={makeupReasons[right.id] ?? ''}
                            onChange={event => setMakeupReasons(previous => ({ ...previous, [right.id]: event.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs font-semibold"
                            disabled={makeupBusy !== null || !makeupCoachIds[right.id] || !makeupReasons[right.id]?.trim()}
                            onClick={() => void assignMakeupCoach(right.id)}
                          >
                            Xác nhận phân HLV ngoại lệ
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Section B: Yêu cầu đổi HLV gói PT cần xử lý */}
          <Card className="border border-border/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-3 pt-3.5 px-4 sm:px-6">
              <div className="flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ShieldAlert className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm sm:text-base font-bold">
                      Yêu Cầu Đổi HLV Gói PT ({coachChanges.length} yêu cầu)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Chuyển lịch và hoàn credit tự động cho hội viên khi đổi huấn luyện viên gói PT.
                    </CardDescription>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1" onClick={() => void load()}>
                  <RefreshCw className="size-3.5" />
                  Làm mới
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              {coachChanges.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Hiện không có yêu cầu đổi HLV gói PT nào đang chờ xử lý.
                </div>
              )}
              {coachChanges.map(change => (
                <div key={change.id} className="rounded-xl border p-4 text-xs space-y-3 bg-card shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        Yêu cầu #{change.id}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {change.memberName}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        Gói #{change.batchId} ({levelNames[change.batch.level] ?? change.batch.level})
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{formatDateTime(change.requestedAt)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-muted-foreground">{change.oldCoachName}</span>
                    <ArrowRight className="size-4 text-primary" />
                    <span className="text-primary font-bold">{change.newCoachName}</span>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    Lý do yêu cầu: <span className="italic text-foreground">"{change.reason}"</span>
                  </p>

                  <div className="space-y-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold gap-1"
                      disabled={coachPreviewBusy !== null || coachChangeBusy !== null}
                      onClick={() => void loadCoachChangePreview(change.id)}
                    >
                      {coachPreviewBusy === change.id ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                      {coachPreviewBusy === change.id ? 'Đang kiểm tra lịch...' : 'Xem trước tác động đổi lịch'}
                    </Button>

                    {coachPreviewErrors[change.id] && (
                      <p className="text-xs text-rose-600 font-medium">{coachPreviewErrors[change.id]}</p>
                    )}

                    {coachChangePreviews[change.id] && (
                      <div className="rounded-lg border p-3 space-y-2 bg-muted/20 text-xs">
                        <p className="font-bold text-foreground">
                          Chuyển sang HLV mới: {coachChangePreviews[change.id].transferable.length} • Giữ HLV cũ (dưới 2h): {coachChangePreviews[change.id].keepOldCoach.length} • Hủy & hoàn Credit: {coachChangePreviews[change.id].toCancel.length}
                        </p>
                        {coachChangePreviews[change.id].transferable.map(item => (
                          <p key={item.bookingId} className="text-emerald-700 dark:text-emerald-400 font-medium">
                            ✓ Chuyển lịch #{item.bookingId} • {formatDateTime(item.startTime)}
                          </p>
                        ))}
                        {coachChangePreviews[change.id].keepOldCoach.map(item => (
                          <p key={item.bookingId} className="text-blue-700 dark:text-blue-400 font-medium">
                            ℹ Giữ HLV cũ cho lịch #{item.bookingId} • {formatDateTime(item.startTime)} ({item.reason})
                          </p>
                        ))}
                        {coachChangePreviews[change.id].toCancel.map(item => (
                          <p key={item.bookingId} className="text-amber-700 dark:text-amber-400 font-medium">
                            ⚠ Đặt lại lịch #{item.bookingId} • {formatDateTime(item.startTime)} ({item.reason})
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor={`coach-change-note-${change.id}`} className="text-xs font-semibold">
                      Ghi chú cho hội viên (bắt buộc khi từ chối)
                    </Label>
                    <Input
                      id={`coach-change-note-${change.id}`}
                      maxLength={500}
                      placeholder="Nhập ghi chú phê duyệt hoặc lý do từ chối..."
                      className="h-8 text-xs"
                      value={coachChangeNotes[change.id] ?? ''}
                      onChange={event => setCoachChangeNotes(previous => ({ ...previous, [change.id]: event.target.value }))}
                    />
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-8 text-xs font-semibold bg-primary"
                        disabled={coachChangeBusy !== null || !coachChangePreviews[change.id]}
                        onClick={() => void handleCoachChange(change.id, 'APPROVED')}
                      >
                        {coachChangeBusy === change.id ? <Loader2 className="size-3 animate-spin mr-1" /> : <Check className="size-3 mr-1" />}
                        Duyệt theo kết quả xem trước
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-rose-600 hover:text-rose-700 border-rose-200"
                        disabled={coachChangeBusy !== null || !coachChangeNotes[change.id]?.trim()}
                        onClick={() => void handleCoachChange(change.id, 'REJECTED')}
                      >
                        <X className="size-3 mr-1" />
                        Từ chối
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
