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
  Edit3,
  Search,
  CheckCircle2,
  Clock,
  CalendarCheck,
  AlertTriangle,
  X,
  History,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  Info,
  RotateCcw,
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
  const [form, setForm] = useState<{ name: string; level: string; sessionCount: number; durationDays: number; price: number; singleSessionPrice: number | null; benefits: string }>({ name: '', level: 'BEGINNER', sessionCount: 10, durationDays: 30, price: 500000, singleSessionPrice: null, benefits: '' });
  const [coachChanges, setCoachChanges] = useState<Awaited<ReturnType<typeof api.adminTrainers.getPendingPtCoachChanges>>>([]);
  const [coachChangeBusy, setCoachChangeBusy] = useState<number | null>(null);
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
      setSingleDrafts(Object.fromEntries(offerList.map(offer => [offer.level, { price: Number(offer.price), durationDays: offer.durationDays, maxQuantity: offer.maxQuantity, benefits: offer.benefits ?? '' }])));
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Không tải được danh sách gói PT.',
        type: 'error',
      });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSingleOffer = async (level: string) => {
    const draft = singleDrafts[level];
    if (!draft) return;
    setSingleBusy(level);
    try {
      await api.adminTrainers.savePtSingleOffer(level, draft);
      await load();
      setMessage({ text: `Đã lưu giá buổi lẻ ${levelNames[level]}.`, type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không lưu được giá buổi lẻ.', type: 'error' });
    } finally { setSingleBusy(null); }
  };

  const toggleSingleOffer = async (level: string, isActive: boolean) => {
    setSingleBusy(level);
    try {
      await api.adminTrainers.setPtSingleOfferActive(level, isActive);
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không đổi được trạng thái bán.', type: 'error' });
    } finally { setSingleBusy(null); }
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
  const handleCoachChange = async (id: number, decision: 'APPROVED' | 'REJECTED') => {
    const note = window.prompt(decision === 'APPROVED' ? 'Ghi chú cho hội viên (tùy chọn). Lịch tương lai với Coach cũ sẽ được hủy và hoàn Credit.' : 'Nhập lý do từ chối cho hội viên:');
    if (note === null || (decision === 'REJECTED' && !note.trim())) return;
    setCoachChangeBusy(id);
    try {
      await api.adminTrainers.resolvePtCoachChange(id, decision, note.trim());
      await load();
      setMessage({ text: decision === 'APPROVED' ? 'Đã chuyển Coach và xử lý lịch cũ.' : 'Đã từ chối yêu cầu đổi Coach.', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.', type: 'error' });
    } finally { setCoachChangeBusy(null); }
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
        ...(singleLevel ? { level: singleLevel, purchaseMode: 'SINGLE' as const } : { productId: selectedRenewalProduct!.id, purchaseMode: oldMode === null ? null : 'PACKAGE' as const }),
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
    <div className="space-y-5">
      {/* Alert / Toast bar */}
      {message && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm transition-all ${
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
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={val => setActiveTab(val as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/60 p-1">
          <TabsTrigger value="packages" className="flex items-center gap-2 py-2">
            <Dumbbell className="size-4" />
            <span className="font-medium">Gói Buổi Tập PT</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              {products.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="renewals" className="flex items-center gap-2 py-2">
            <RefreshCw className="size-4" />
            <span className="font-medium">Bảng Giá Gia Hạn</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              {renewalOptions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="wallets" className="flex items-center gap-2 py-2">
            <Wallet className="size-4" />
            <span className="font-medium">Ví PT Hội Viên</span>
          </TabsTrigger>
          <TabsTrigger value="coachChanges" className="flex items-center gap-2 py-2">
            <ShieldAlert className="size-4" /><span className="font-medium">Đổi HLV ({coachChanges.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: GÓI BUỔI TẬP PT ================= */}
        <TabsContent value="packages" className="space-y-4 pt-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Buổi PT lẻ theo cấp độ</CardTitle><CardDescription>Giá, hạn dùng và số buổi tối đa của một đơn được cấu hình riêng. Đơn đã tạo giữ nguyên giá và hạn dùng tại thời điểm mua.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {paidLevels.map(level => {
                const offer = singleOffers.find(item => item.level === level);
                const draft = singleDrafts[level] ?? { price: 0, durationDays: 30, maxQuantity: 20, benefits: '' };
                const change = (patch: Partial<typeof draft>) => setSingleDrafts(current => ({ ...current, [level]: { ...draft, ...patch } }));
                return <div key={level} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between"><strong>{levelNames[level]}</strong><Badge variant={offer?.isActive ? 'default' : 'outline'}>{offer?.isActive ? 'Đang bán' : 'Chưa bán'}</Badge></div>
                  <Label>Giá một buổi (VNĐ)</Label><Input type="number" min="1" value={draft.price} onChange={e => change({ price: Number(e.target.value) })} />
                  <div className="grid grid-cols-2 gap-2"><div><Label>Hạn dùng (ngày)</Label><Input type="number" min="1" max="3650" value={draft.durationDays} onChange={e => change({ durationDays: Number(e.target.value) })} /></div><div><Label>Tối đa/đơn</Label><Input type="number" min="1" max="100" value={draft.maxQuantity} onChange={e => change({ maxQuantity: Number(e.target.value) })} /></div></div>
                  <Label>Quyền lợi hiển thị</Label><Input maxLength={1000} value={draft.benefits} onChange={e => change({ benefits: e.target.value })} placeholder="Ví dụ: Đặt lịch PT, QR check-in" />
                  <div className="flex gap-2"><Button size="sm" disabled={singleBusy !== null || draft.price < 1} onClick={() => void saveSingleOffer(level)}>Lưu cấu hình</Button>{offer && <Button size="sm" variant="outline" disabled={singleBusy !== null} onClick={() => void toggleSingleOffer(level, !offer.isActive)}>{offer.isActive ? 'Ngừng bán' : 'Mở bán'}</Button>}</div>
                </div>;
              })}
            </CardContent>
          </Card>
          {/* Action Header & Statistics */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 p-1">
                <Button
                  type="button"
                  variant={productFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5 font-medium"
                  onClick={() => setProductFilter('all')}
                >
                  Tất cả ({products.length})
                </Button>
                <Button
                  type="button"
                  variant={productFilter === 'active' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5 font-medium text-emerald-700 dark:text-emerald-400"
                  onClick={() => setProductFilter('active')}
                >
                  Đang bán ({activeProducts.length})
                </Button>
                <Button
                  type="button"
                  variant={productFilter === 'inactive' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5 font-medium text-muted-foreground"
                  onClick={() => setProductFilter('inactive')}
                >
                  Đã ngừng bán ({products.length - activeProducts.length})
                </Button>
              </div>
              {productsMissingDuration.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  {productsMissingDuration.length} gói chưa có hạn
                </span>
              )}
            </div>
            {!isFormOpen && (
              <Button onClick={() => setIsFormOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="size-4" /> Tạo Gói PT Mới
              </Button>
            )}
          </div>

          {/* Form Tạo/Sửa Gói PT */}
          {isFormOpen && (
            <Card className="border-primary/30 bg-card/60 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {editingId ? <Edit3 className="size-4" /> : <Plus className="size-4" />}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {editingId ? 'Cập Nhật Gói Buổi Tập PT' : 'Tạo Gói Buổi Tập PT Mới'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Thiết lập tên gói, số buổi, cấp độ HLV và thời hạn sử dụng cho hội viên
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCancelProductEdit}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {/* Tên gói */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pkg-name" className="text-xs font-medium">
                        Tên gói PT <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="pkg-name"
                        placeholder="VD: Gói PT Cơ Bản 10 Buổi"
                        required
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                      />
                    </div>

                    {/* Cấp độ HLV */}
                    <div className="space-y-1.5">
                      <Label htmlFor="pkg-level" className="text-xs font-medium">
                        Cấp độ Huấn Luyện Viên <span className="text-rose-500">*</span>
                      </Label>
                      <select
                        id="pkg-level"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={form.level}
                        onChange={e => setForm({ ...form, level: e.target.value })}
                      >
                        {paidLevels.map(lvl => (
                          <option key={lvl} value={lvl}>
                            {levelNames[lvl]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Số buổi */}
                    <div className="space-y-1.5">
                      <Label htmlFor="pkg-sessions" className="text-xs font-medium">
                        Số buổi trong gói <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="pkg-sessions"
                          type="number"
                          min="1"
                          max="100"
                          required
                          value={form.sessionCount}
                          onChange={e => setForm({ ...form, sessionCount: Math.max(1, Number(e.target.value)) })}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">
                          buổi
                        </span>
                      </div>
                    </div>

                    {/* Thời hạn */}
                    <div className="space-y-1.5">
                      <Label htmlFor="pkg-duration" className="text-xs font-medium">
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
                          value={form.durationDays}
                          onChange={e => setForm({ ...form, durationDays: Math.max(1, Number(e.target.value)) })}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">
                          ngày
                        </span>
                      </div>
                    </div>

                    {/* Giá trọn gói */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pkg-price" className="text-xs font-medium">
                        Giá trọn gói (VNĐ) <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="pkg-price"
                          type="number"
                          min="1000"
                          step="1000"
                          required
                          value={form.price}
                          onChange={e => setForm({ ...form, price: Math.max(0, Number(e.target.value)) })}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">
                          VNĐ
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pt-benefits" className="text-xs font-medium">Quyền lợi hiển thị</Label>
                      <Input id="pt-benefits" maxLength={1000} placeholder="Ví dụ: Đặt lịch PT, QR check-in" value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} />
                    </div>

                    {/* Widget tính toán đơn giá */}
                    <div className="flex flex-col justify-end rounded-md bg-muted/40 p-2.5 sm:col-span-2 lg:col-span-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Đơn giá trung bình / 1 buổi:</span>
                        <strong className="text-sm font-semibold text-primary">
                          {form.sessionCount > 0 ? formatVND(Math.round(form.price / form.sessionCount)) : '0 đ'} / buổi
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div className="flex justify-end gap-2 pt-1 border-t">
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelProductEdit}>
                      Hủy bỏ
                    </Button>
                    <Button type="submit" size="sm" disabled={productSubmitting} className="min-w-28">
                      {productSubmitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo gói PT'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table Danh sách các gói PT */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold">Tên Gói PT</TableHead>
                  <TableHead className="font-semibold">Cấp Độ HLV</TableHead>
                  <TableHead className="text-center font-semibold">Quy Cách</TableHead>
                  <TableHead className="text-right font-semibold">Giá Trọn Gói</TableHead>
                  <TableHead className="text-right font-semibold">Đơn Giá / Buổi</TableHead>
                  <TableHead className="font-semibold">Quyền lợi</TableHead>
                  <TableHead className="text-center font-semibold">Trạng Thái</TableHead>
                  <TableHead className="text-right font-semibold">Thao Tác</TableHead>
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
                        <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
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
                      <TableRow key={product.id} className={!product.isActive ? 'opacity-70 bg-muted/20' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Dumbbell className="size-4 text-muted-foreground shrink-0" />
                            <span>{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                              levelBadgeVariants[product.level] || ''
                            }`}
                          >
                            {levelNames[product.level] ?? product.level}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex flex-col text-xs">
                            <span className="font-semibold">{product.sessionCount} buổi</span>
                            <span className="text-muted-foreground">
                              {product.durationDays ? `${product.durationDays} ngày` : 'Chưa có hạn'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {formatVND(Number(product.price))}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          ~{formatVND(avgPrice)}
                        </TableCell>
                        <TableCell className="max-w-48 text-xs text-muted-foreground">{product.benefits || 'Theo chính sách PT Paid'}</TableCell>
                        <TableCell className="text-center">
                          {product.isActive ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                              Đang bán
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Đã ngừng bán
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-primary"
                              onClick={() => editProduct(product)}
                            >
                              <Edit3 className="size-3.5 mr-1" /> Sửa
                            </Button>
                            {product.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={() => void handleArchiveProduct(product)}
                              >
                                Ngừng bán
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1 font-medium shadow-2xs"
                                onClick={() => void handleRestoreProduct(product)}
                              >
                                <RotateCcw className="size-3.5" /> Khôi phục
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

        {/* ================= TAB 2: GIÁ GIA HẠN THỜI GIAN PT ================= */}
        <TabsContent value="renewals" className="space-y-4 pt-2">
          {/* Policy Info Card */}
          <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="flex items-start gap-2.5">
              <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Chính sách gia hạn thời gian gói PT</p>
                <p className="leading-relaxed">
                  • <strong>Gia hạn chỉ cộng thêm số ngày sử dụng</strong>, không cộng thêm số buổi tập. Các buổi chưa tập của gói sẽ được mở khóa lại để hội viên tiếp tục đặt lịch.
                </p>
                <p className="leading-relaxed">
                  • Hội viên chỉ được phép gia hạn trong vòng <strong>30 ngày (Grace Period)</strong> kể từ ngày gói hết hạn. Quá 30 ngày, hệ thống sẽ tự động khóa và yêu cầu mua gói mới.
                </p>
              </div>
            </div>
          </div>

          {/* Missing Duration Warning */}
          {productsMissingDuration.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Có <strong>{productsMissingDuration.length}</strong> gói PT chưa có thời hạn, không thể tạo giá gia hạn: {productsMissingDuration.map(p => p.name).join(', ')}.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300"
                onClick={() => editProduct(productsMissingDuration[0])}
              >
                Cấu hình thời hạn
              </Button>
            </div>
          )}

          {/* Action Header */}
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Hiện có <strong>{renewalOptions.length}</strong> tùy chọn mức giá gia hạn được cấu hình.
            </p>
            {!isRenewalFormOpen && (
              <Button
                onClick={() => setIsRenewalFormOpen(true)}
                disabled={renewalProducts.length === 0 && singleOffers.length === 0}
                className="gap-1.5 shadow-sm"
              >
                <Plus className="size-4" /> Thiết Lập Giá Gia Hạn Mới
              </Button>
            )}
          </div>

          {/* Form Thiết lập giá gia hạn */}
          {isRenewalFormOpen && (
            <Card className="border-primary/30 bg-card/60 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <RefreshCw className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {editingRenewalId ? 'Cập Nhật Mức Giá Gia Hạn' : 'Thiết Lập Mức Giá Gia Hạn Mới'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Liên kết gói PT đang bán với số ngày gia hạn và mức phí bổ sung
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCancelRenewalEdit}>
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveRenewal} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* Chọn gói PT */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rn-product" className="text-xs font-medium">
                        Gói PT Áp Dụng <span className="text-rose-500">*</span>
                      </Label>
                      <select
                        id="rn-product"
                        required
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
                        {singleOffers.map(offer => <option key={`single:${offer.level}`} value={`single:${offer.level}`}>Buổi lẻ {levelNames[offer.level]}</option>)}
                      </select>
                    </div>

                    {/* Số ngày gia hạn */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="rn-days" className="text-xs font-medium">
                          Số ngày gia hạn thêm <span className="text-rose-500">*</span>
                        </Label>
                        <div className="flex gap-1 text-[11px]">
                          {[7, 14, 30].map(days => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setRenewalDurationDays(days)}
                              className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
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
                          max="3650"
                          required
                          value={renewalDurationDays}
                          onChange={e => setRenewalDurationDays(Math.max(1, Number(e.target.value)))}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">
                          ngày
                        </span>
                      </div>
                    </div>

                    {/* Giá gia hạn */}
                    <div className="space-y-1.5">
                      <Label htmlFor="rn-price" className="text-xs font-medium">
                        Phí gia hạn (VNĐ) <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="rn-price"
                          type="number"
                          min="1000"
                          step="1000"
                          required
                          value={renewalPrice}
                          onChange={e => setRenewalPrice(Math.max(0, Number(e.target.value)))}
                        />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">
                          VNĐ
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedRenewalProduct && (
                    <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between">
                      <span>
                        Gói gốc: <strong>{selectedRenewalProduct.name}</strong> ({levelNames[selectedRenewalProduct.level]}) · Hạn gốc: {selectedRenewalProduct.durationDays} ngày · Giá mua: {formatVND(Number(selectedRenewalProduct.price))}
                      </span>
                      <span className="font-semibold text-primary">
                        Tỷ lệ phí gia hạn: ~{Math.round((renewalPrice / Number(selectedRenewalProduct.price)) * 100)}% giá gói gốc
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1 border-t">
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelRenewalEdit}>
                      Hủy bỏ
                    </Button>
                    <Button type="submit" size="sm" disabled={renewalSubmitting || !selectedRenewalProduct}>
                      {renewalSubmitting ? 'Đang lưu...' : editingRenewalId ? 'Lưu thay đổi' : 'Tạo giá gia hạn'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Table Danh sách giá gia hạn */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold">Tên Tùy Chọn / Gói Gốc</TableHead>
                  <TableHead className="font-semibold">Cấp Độ HLV</TableHead>
                  <TableHead className="text-center font-semibold">Thời Hạn Thêm</TableHead>
                  <TableHead className="text-right font-semibold">Phí Gia Hạn</TableHead>
                  <TableHead className="text-center font-semibold">Phạm Vi Áp Dụng</TableHead>
                  <TableHead className="text-center font-semibold">Trạng Thái</TableHead>
                  <TableHead className="text-right font-semibold">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renewalOptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Chưa có cấu hình giá gia hạn nào. Nhấn "Thiết Lập Giá Gia Hạn Mới" để tạo.
                    </TableCell>
                  </TableRow>
                ) : (
                  renewalOptions.map(option => (
                    <TableRow key={option.id} className={!option.isActive ? 'opacity-60 bg-muted/20' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="size-4 text-muted-foreground shrink-0" />
                          <span>{option.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                            levelBadgeVariants[option.level] || ''
                          }`}
                        >
                          {levelNames[option.level] ?? option.level}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        +{option.durationDays} ngày
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatVND(Number(option.price))}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {option.ptProductId ? (
                          <Badge variant="outline">Gói #{option.ptProductId}</Badge>
                        ) : (
                          <Badge variant="secondary">Toàn bộ cấp độ {levelNames[option.level]}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {option.isActive ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                            Đang áp dụng
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Đã ngừng
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-primary"
                            onClick={() => handleEditRenewalOption(option)}
                          >
                            <Edit3 className="size-3.5 mr-1" /> Sửa
                          </Button>
                          {option.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              onClick={() => void handleArchiveRenewal(option)}
                            >
                              Ngừng bán
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1 font-medium shadow-2xs"
                              onClick={() => void handleRestoreRenewal(option)}
                            >
                              <RotateCcw className="size-3.5" /> Khôi phục
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

        {/* ================= TAB 3: TRA CỨU & VÍ HỘI VIÊN ================= */}
        <TabsContent value="wallets" className="space-y-4 pt-2">
          {/* Search Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Nhập mã hội viên (Ví dụ: 6 hoặc MEM-6)..."
                className="pl-9"
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
            <Button onClick={() => void findWallet()} disabled={walletLoading || !memberId.trim()} className="gap-1.5">
              <Search className="size-4" />
              {walletLoading ? 'Đang tra cứu...' : 'Tra Cứu Ví'}
            </Button>
          </div>

          {/* Wallet Result View */}
          {wallet && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* 4 Metric KPI Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Có thể đặt */}
                <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                        Có Thể Đặt Lịch (Khả dụng)
                      </span>
                      <CalendarCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                        {wallet.summary.available}
                      </span>
                      <span className="text-xs text-muted-foreground">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Buổi hợp lệ có thể đặt ca tập mới ngay
                    </p>
                  </CardContent>
                </Card>

                {/* Đang giữ chỗ */}
                <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        Đang Giữ Chỗ (Đã đặt)
                      </span>
                      <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
                        {wallet.summary.held}
                      </span>
                      <span className="text-xs text-muted-foreground">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Đang khóa cho các ca tập đã book sắp tới
                    </p>
                  </CardContent>
                </Card>

                {/* Đã sử dụng */}
                <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-blue-800 dark:text-blue-300">
                        Đã Hoàn Thành (Đã tập)
                      </span>
                      <CheckCircle2 className="size-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight text-blue-700 dark:text-blue-300">
                        {wallet.summary.used}
                      </span>
                      <span className="text-xs text-muted-foreground">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Số ca tập đã check-in thành công
                    </p>
                  </CardContent>
                </Card>

                {/* Tổng đã cấp */}
                <Card className="border-muted bg-muted/30 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Tổng Buổi Đã Cấp
                      </span>
                      <Dumbbell className="size-4 text-muted-foreground" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight text-foreground">
                        {wallet.summary.total}
                      </span>
                      <span className="text-xs text-muted-foreground">buổi</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Tích lũy từ mọi nguồn (mua lẻ, gói, trial...)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Chi tiết theo Cấp Độ */}
              <div className="grid gap-2 sm:grid-cols-4">
                {wallet.summary.levels.map(lvl => (
                  <div
                    key={lvl.level}
                    className="flex flex-col justify-between rounded-lg border bg-card p-3 shadow-xs text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-foreground">
                        {levelNames[lvl.level] ?? lvl.level}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${levelBadgeVariants[lvl.level]}`}>
                        {lvl.available} khả dụng
                      </Badge>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Đã đặt: {lvl.held}</span>
                      <span>Đã tập: {lvl.used}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bảng Nguồn Buổi Tập (Batches) */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        Chi Tiết Các Đợt Cấp Buổi Tập (Batches)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Thời hạn, số buổi còn lại và khả năng gia hạn của từng lần mua
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAdjustFormOpen(val => !val)}
                      className="gap-1.5 text-xs"
                    >
                      <SlidersHorizontal className="size-3.5" />
                      {isAdjustFormOpen ? 'Đóng Điều Chỉnh' : 'Điều Chỉnh Số Buổi (+/-)'}
                    </Button>
                  </div>
                </CardHeader>

                {/* Form Điều chỉnh số buổi (Collapsible) */}
                {isAdjustFormOpen && (
                  <div className="mx-6 mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <form onSubmit={handleAdjustWallet} className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <ShieldAlert className="size-4" />
                        <span>Quản Trị Viên Can Thiệp Điều Chỉnh Số Buổi (Audit Log sẽ được lưu)</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Cấp Độ PT</Label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm"
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
                          <Label className="text-xs">Số buổi cộng (+) hoặc trừ (−)</Label>
                          <Input
                            type="number"
                            min="-100"
                            max="100"
                            className="h-8 text-xs"
                            value={adjustment.delta}
                            onChange={e => setAdjustment({ ...adjustment, delta: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Lý do điều chỉnh (bắt buộc)</Label>
                          <Input
                            placeholder="VD: Bù buổi do HLV bận đột xuất..."
                            className="h-8 text-xs"
                            required
                            value={adjustment.reason}
                            onChange={e => setAdjustment({ ...adjustment, reason: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setIsAdjustFormOpen(false)}
                        >
                          Hủy
                        </Button>
                        <Button type="submit" size="sm" className="h-7 text-xs" disabled={adjustSubmitting}>
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
                        <TableRow>
                          <TableHead className="font-semibold text-xs">Cấp Độ</TableHead>
                          <TableHead className="font-semibold text-xs">Nguồn Cấp</TableHead>
                          <TableHead className="text-center font-semibold text-xs">Còn / Đã Cấp</TableHead>
                          <TableHead className="text-center font-semibold text-xs">Có Thể Đặt</TableHead>
                          <TableHead className="font-semibold text-xs">Hạn Sử Dụng</TableHead>
                          <TableHead className="text-center font-semibold text-xs">Trạng Thái</TableHead>
                          <TableHead className="font-semibold text-xs">Gia Hạn Đến</TableHead>
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
                            <TableRow key={source.id} className="text-xs">
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                                    levelBadgeVariants[source.level] || ''
                                  }`}
                                >
                                  {levelNames[source.level] ?? source.level}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium text-foreground">
                                {source.source}
                              </TableCell>
                              <TableCell className="text-center font-semibold">
                                {source.remainingSessions} / {source.quantity}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={source.availableSessions > 0 ? 'font-bold text-emerald-600' : 'text-muted-foreground'}>
                                  {source.availableSessions}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {source.endAt ? formatDate(source.endAt) : 'Không giới hạn (quyền cũ)'}
                              </TableCell>
                              <TableCell className="text-center">
                                {source.status === 'EXPIRED' ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    HẾT HẠN
                                  </Badge>
                                ) : source.status === 'ACTIVE' ? (
                                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]">
                                    HOẠT ĐỘNG
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {source.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {source.renewable ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[11px]">
                                    {formatDate(source.renewalDeadline)}
                                  </span>
                                ) : source.status === 'EXPIRED' ? (
                                  <span className="text-rose-600 dark:text-rose-400 text-[11px]">
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
                <Card className="shadow-xs">
                  <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <RefreshCw className="size-3.5 text-primary" />
                      Lịch Sử Các Lần Gia Hạn
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    {wallet.renewals.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Hội viên chưa từng thực hiện gia hạn nào.
                      </p>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {wallet.renewals.map(rn => (
                          <div key={rn.id} className="flex items-center justify-between rounded border p-2 bg-muted/20">
                            <div>
                              <p className="font-semibold">Nguồn #{rn.batchId} • +{rn.durationDays} ngày</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDate(rn.previousEndAt)} → {formatDate(rn.endAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-primary">{formatVND(Number(rn.payment.amount))}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDate(rn.payment.paidAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lịch sử biến động số dư */}
                <Card className="shadow-xs">
                  <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <History className="size-3.5 text-primary" />
                      Nhật Ký Biến Động Số Buổi (Transactions)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    {wallet.transactions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Chưa có lịch sử giao dịch số buổi.
                      </p>
                    ) : (
                      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1 text-xs">
                        {wallet.transactions.map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between border-b pb-1.5 last:border-b-0">
                            <div>
                              <p className="font-medium text-foreground">
                                {transactionNames[tx.kind] ?? tx.kind}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateTime(tx.createdAt)} {tx.note ? `• ${tx.note}` : ''}
                              </p>
                            </div>
                            <span className="font-bold text-primary">
                              {tx.kind === 'PROTECTED_CANCEL' ? '1 lượt' : `${tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} buổi`}
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
        <TabsContent value="coachChanges" className="space-y-3 pt-2">
          <Card><CardHeader><CardTitle>Yêu cầu đổi HLV cần xử lý</CardTitle><CardDescription>Chỉ gói PT Paid nhiều buổi. Duyệt yêu cầu sẽ hủy các lịch tương lai với HLV cũ, hoàn Credit về đúng gói và chuyển giáo án cho HLV mới.</CardDescription></CardHeader><CardContent className="space-y-3">
            {coachChanges.length === 0 && <p className="text-sm text-muted-foreground">Không có yêu cầu đang chờ.</p>}
            {coachChanges.map(change => <div key={change.id} className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">Yêu cầu #{change.id} · {change.memberName} · Gói #{change.batchId} ({levelNames[change.batch.level] ?? change.batch.level})</p>
              <p>{change.oldCoachName} → {change.newCoachName}</p>
              <p className="text-muted-foreground">Lý do: {change.reason}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(change.requestedAt)}</p>
              <div className="mt-3 flex gap-2"><Button size="sm" disabled={coachChangeBusy !== null} onClick={() => void handleCoachChange(change.id, 'APPROVED')}>Duyệt và chuyển HLV</Button><Button size="sm" variant="outline" disabled={coachChangeBusy !== null} onClick={() => void handleCoachChange(change.id, 'REJECTED')}>Từ chối</Button></div>
            </div>)}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
