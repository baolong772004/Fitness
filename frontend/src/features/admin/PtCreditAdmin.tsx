import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

const levelNames: Record<string, string> = {
  TRIAL: 'Trải nghiệm', BEGINNER: 'Cơ bản', INTERMEDIATE: 'Trung cấp', ADVANCED: 'Nâng cao',
};
const paidLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const transactionNames: Record<string, string> = {
  GRANT: 'Cấp buổi', HOLD: 'Giữ buổi khi đặt lịch', CONSUME: 'Đã tập', RELEASE: 'Hoàn buổi đặt lịch',
  REFUND: 'Hoàn buổi đã dùng', ADMIN_CREDIT: 'Quản trị cộng buổi', ADMIN_DEBIT: 'Quản trị trừ buổi',
  RENEW_DURATION: 'Gia hạn thời gian',
};
type Product = { id: number; name: string; level: string; sessionCount: number; durationDays: number | null; price: number; isActive: boolean };
type RenewalOption = { id: number; name: string; level: string; durationDays: number; price: number; isActive: boolean; ptProductId: number | null };

export function PtCreditAdmin({ onProductsChanged }: { onProductsChanged?: () => void | Promise<void> }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', level: 'BEGINNER', sessionCount: 1, durationDays: 0, price: 0 });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [renewalOptions, setRenewalOptions] = useState<RenewalOption[]>([]);
  const [renewalProductId, setRenewalProductId] = useState('');
  const [renewalDurationDays, setRenewalDurationDays] = useState(0);
  const [renewalPrice, setRenewalPrice] = useState(0);
  const [editingRenewalId, setEditingRenewalId] = useState<number | null>(null);
  const [memberId, setMemberId] = useState('');
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof api.adminTrainers.getPtWallet>> | null>(null);
  const [adjustment, setAdjustment] = useState({ level: 'BEGINNER', delta: 1, reason: '' });
  const [message, setMessage] = useState('');
  const durationInputRef = useRef<HTMLInputElement>(null);
  const activeProducts = products.filter(product => product.isActive);
  const renewalProducts = activeProducts.filter(product => product.durationDays && product.durationDays > 0);
  const productsMissingDuration = activeProducts.filter(product => !product.durationDays || product.durationDays <= 0);
  const selectedRenewalProduct = renewalProducts.find(product => String(product.id) === renewalProductId);

  const editProduct = (product: Product) => {
    setEditingId(product.id);
    setForm({ name: product.name, level: product.level, sessionCount: product.sessionCount,
      durationDays: product.durationDays ?? 0, price: Number(product.price) });
    durationInputRef.current?.focus();
  };

  const load = async () => {
    try {
      const [products, options] = await Promise.all([
        api.adminTrainers.getPtProducts(), api.adminTrainers.getPtRenewalOptions(),
      ]);
      setProducts(products); setRenewalOptions(options);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không tải được danh sách gói PT.'); }
  };
  useEffect(() => { void load(); }, []);

  const findWallet = async () => {
    const id = Number(memberId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setMessage('Nhập mã hội viên hợp lệ, ví dụ 6 trong MEM-6.');
      return;
    }
    try { setWallet(await api.adminTrainers.getPtWallet(id)); setMessage(''); }
    catch (error) { setWallet(null); setMessage(error instanceof Error ? error.message : 'Không tải được số buổi PT.'); }
  };

  return <div className="space-y-6">
    {message && <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">{message}</p>}

    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">Tạo gói buổi tập PT</h2>
        <p className="text-sm text-muted-foreground">Chọn cấp độ huấn luyện viên, số buổi và giá của cả gói. Hội viên mua gói sẽ có số buổi tương ứng để đặt lịch.</p>
      </div>
      <form className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={event => { event.preventDefault(); void (async () => {
        try {
          const wasEditing = editingId !== null;
          if (editingId) await api.adminTrainers.updatePtProduct(editingId, form);
          else await api.adminTrainers.createPtProduct(form);
          setForm({ name: '', level: 'BEGINNER', sessionCount: 1, durationDays: 0, price: 0 });
          setEditingId(null);
          await load(); await onProductsChanged?.(); setMessage(wasEditing ? 'Đã cập nhật gói PT.' : 'Đã tạo gói PT.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Không tạo được gói PT.'); }
      })(); }}>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">Tên gói PT
          <input className="w-full rounded border px-3 py-2 font-normal" placeholder="Ví dụ: PT cơ bản 5 buổi" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">Cấp độ huấn luyện viên
          <select className="w-full rounded border px-3 py-2 font-normal" value={form.level} onChange={event => setForm({ ...form, level: event.target.value })}>{paidLevels.map(level => <option key={level} value={level}>{levelNames[level]}</option>)}</select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">Số buổi trong gói
          <input className="w-full rounded border px-3 py-2 font-normal" type="number" min="1" max="100" required value={form.sessionCount} onChange={event => setForm({ ...form, sessionCount: Number(event.target.value) })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">Giá trọn gói (đồng)
          <input className="w-full rounded border px-3 py-2 font-normal" type="number" min="1" required value={form.price} onChange={event => setForm({ ...form, price: Number(event.target.value) })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">Thời hạn (ngày)
          <input ref={durationInputRef} className="w-full rounded border px-3 py-2 font-normal" type="number" min="1" max="3650" required value={form.durationDays} onChange={event => setForm({ ...form, durationDays: Number(event.target.value) })} />
        </label>
        <button className="w-full rounded bg-primary px-4 py-2 text-primary-foreground md:col-span-2 md:w-auto md:justify-self-end xl:col-span-5" type="submit">{editingId ? 'Lưu gói PT' : 'Tạo gói PT'}</button>
      </form>
      {products.length > 0 && <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold">Các gói PT đã tạo</h3>
        {products.map(product => <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
          <span>{product.name} · {levelNames[product.level] ?? product.level} · {product.sessionCount} buổi · {product.durationDays ? `${product.durationDays} ngày` : 'Chưa cấu hình thời hạn'} · {Number(product.price).toLocaleString('vi-VN')} đ</span>
          <button className="text-primary underline" onClick={() => editProduct(product)}>Sửa</button>
          {product.isActive ? <button className="text-destructive underline" onClick={() => void (async () => {
            try { await api.adminTrainers.archivePtProduct(product.id); await load(); await onProductsChanged?.(); setMessage('Đã ngừng bán gói PT.'); }
            catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể ngừng bán gói PT.'); }
          })()}>Ngừng bán</button> : <span className="text-muted-foreground">Đã ngừng bán</span>}
        </div>)}
      </div>}
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">Giá gia hạn thời gian PT</h2>
        <p className="text-sm text-muted-foreground">Chọn gói PT đang bán để lấy tên và cấp độ. Số ngày gia hạn được điền sẵn theo thời hạn gói, nhưng bạn có thể sửa. Giá gia hạn áp dụng cho đúng gói PT đã chọn và không cộng thêm buổi. Gói đã hết hạn chỉ được gia hạn trong 30 ngày kể từ ngày hết hạn.</p>
      </div>
      <form className="grid items-end gap-3 md:grid-cols-3" onSubmit={event => { event.preventDefault(); void (async () => {
        try {
          if (!selectedRenewalProduct) { setMessage('Chọn gói PT đang bán và đã có thời hạn.'); return; }
          const payload = { productId: selectedRenewalProduct.id, durationDays: renewalDurationDays, price: renewalPrice };
          if (editingRenewalId) await api.adminTrainers.updatePtRenewalOption(editingRenewalId, payload);
          else await api.adminTrainers.createPtRenewalOption(payload);
          setRenewalProductId(''); setRenewalDurationDays(0); setRenewalPrice(0);
          setEditingRenewalId(null);
          await load(); setMessage('Đã lưu giá gia hạn PT.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lưu được giá gia hạn PT.'); }
      })(); }}>
        <label className="flex flex-col gap-1 text-sm font-medium">Gói PT có sẵn
          <select className="rounded border px-3 py-2 font-normal" required value={renewalProductId} onChange={event => {
            const product = renewalProducts.find(item => String(item.id) === event.target.value);
            setRenewalProductId(event.target.value); setRenewalDurationDays(product?.durationDays ?? 0);
          }}>
            <option value="">Chọn gói PT</option>
            {activeProducts.map(product => <option key={product.id} value={product.id} disabled={!product.durationDays || product.durationDays <= 0}>{product.name} · {levelNames[product.level] ?? product.level} · {product.durationDays ? `${product.durationDays} ngày` : 'chưa có thời hạn'} · {product.sessionCount} buổi</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Số ngày gia hạn
          <input className="rounded border px-3 py-2 font-normal" type="number" min="1" max="3650" required value={renewalDurationDays} onChange={event => setRenewalDurationDays(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Giá (đồng)
          <input className="rounded border px-3 py-2 font-normal" type="number" min="1" max="1000000000" required value={renewalPrice} onChange={event => setRenewalPrice(Number(event.target.value))} />
        </label>
        {selectedRenewalProduct && <p className="text-sm text-muted-foreground md:col-span-3">Gói đã chọn: {selectedRenewalProduct.name} · {levelNames[selectedRenewalProduct.level] ?? selectedRenewalProduct.level} · Thời hạn gói gốc {selectedRenewalProduct.durationDays} ngày · Giá mua {Number(selectedRenewalProduct.price).toLocaleString('vi-VN')} đ. Gia hạn chỉ thêm thời gian.</p>}
        {productsMissingDuration.length > 0 && <div className="space-y-1 text-sm text-muted-foreground md:col-span-3">
          <p>Những gói sau chưa có thời hạn nên chưa thể dùng để tạo giá gia hạn:</p>
          {productsMissingDuration.map(product => <button key={product.id} className="block text-left text-primary underline" type="button" onClick={() => editProduct(product)}>Thiết lập thời hạn cho {product.name}</button>)}
        </div>}
        {activeProducts.length === 0 && <p className="text-sm text-muted-foreground md:col-span-3">Chưa có gói PT đang bán. Hãy tạo gói ở mục phía trên.</p>}
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 md:col-span-3" type="submit" disabled={!selectedRenewalProduct}>{editingRenewalId ? 'Lưu thay đổi' : 'Tạo giá gia hạn'}</button>
      </form>
      {renewalOptions.map(option => <div key={option.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
        <span>{option.name} · {levelNames[option.level] ?? option.level} · {option.durationDays} ngày · {Number(option.price).toLocaleString('vi-VN')} đ · {option.ptProductId ? `Gói PT #${option.ptProductId}` : 'Giá chung cũ theo cấp độ'}</span>
        <button className="text-primary underline" onClick={() => {
          const product = renewalProducts.find(item => item.id === option.ptProductId) ??
            renewalProducts.find(item => item.name === option.name && item.level === option.level);
          setEditingRenewalId(option.id); setRenewalProductId(product ? String(product.id) : '');
          setRenewalDurationDays(option.durationDays); setRenewalPrice(Number(option.price));
          setMessage(product ? '' : 'Gói PT gốc đã thay đổi hoặc ngừng bán. Chọn một gói hiện có để cập nhật giá gia hạn.');
        }}>Sửa</button>
        {option.isActive ? <button className="text-destructive underline" onClick={() => void (async () => {
          try { await api.adminTrainers.archivePtRenewalOption(option.id); await load(); setMessage('Đã ngừng bán gói gia hạn.'); }
          catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể ngừng bán gói gia hạn.'); }
        })()}>Ngừng bán</button> : <span className="text-muted-foreground">Đã ngừng bán</span>}
      </div>)}
    </section>

    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold">Kiểm tra số buổi PT của hội viên</h2>
        <p className="text-sm text-muted-foreground">Mỗi hội viên có một ví PT ghi số buổi đã mua, đã đặt lịch và đã tập. Nhập số sau “MEM-” để xem ví của người đó; ví dụ MEM-6 thì nhập 6.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="min-w-0 flex-1 rounded border px-3 py-2 sm:max-w-64" aria-label="Mã hội viên" type="number" min="1" placeholder="Ví dụ: 6" value={memberId} onChange={event => { setMemberId(event.target.value); setWallet(null); }} />
        <button className="rounded border px-4 py-2" onClick={() => void findWallet()}>Xem số buổi</button>
      </div>
      {wallet && <div className="space-y-4 border-t pt-4">
        <p className="text-sm font-medium">Tổng đã cấp: {wallet.summary.total} buổi · Còn có thể đặt: {wallet.summary.available} buổi · Đã đặt lịch: {wallet.summary.held} buổi · Đã sử dụng: {wallet.summary.used} buổi</p>
        <p className="text-xs text-muted-foreground">“Còn có thể đặt” là số buổi hội viên dùng để đặt lịch mới. “Đã đặt lịch” là buổi đang giữ chỗ cho lịch sắp tới. “Đã sử dụng” là buổi đã tập xong.</p>
        <div className="flex flex-wrap gap-2 text-xs">{wallet.summary.levels.map(level => <span key={level.level} className="rounded border px-2 py-1">{levelNames[level.level] ?? level.level}: còn {level.available} · đã đặt {level.held} · đã dùng {level.used}</span>)}</div>
        <div className="space-y-2 text-xs">{wallet.summary.sources.map(source => <div key={source.id} className="rounded border p-2">
          <strong>{levelNames[source.level] ?? source.level}</strong> · {source.source} · còn {source.remainingSessions}/{source.quantity} buổi · có thể đặt {source.availableSessions} · {source.status}
          <div>Kích hoạt: {source.activatedAt ? new Date(source.activatedAt).toLocaleString('vi-VN') : 'Chưa xác định'} · Hết hạn: {source.endAt ? new Date(source.endAt).toLocaleString('vi-VN') : 'Không giới hạn (quyền cũ)'}</div>
          {source.renewable && <div>Có thể gia hạn đến: {source.renewalDeadline ? new Date(source.renewalDeadline).toLocaleString('vi-VN') : ''}</div>}
          {source.status === 'EXPIRED' && source.remainingSessions > 0 && <div className="text-destructive">Đã hết hạn nhưng còn {source.remainingSessions} buổi.</div>}
        </div>)}</div>
        {wallet.renewals.length > 0 && <div className="space-y-1 text-xs"><strong>Lịch sử gia hạn</strong>{wallet.renewals.map(row => <p key={row.id}>Nguồn #{row.batchId} · +{row.durationDays} ngày · {Number(row.payment.amount).toLocaleString('vi-VN')} đ · {new Date(row.previousEndAt).toLocaleDateString('vi-VN')} → {new Date(row.endAt).toLocaleDateString('vi-VN')}</p>)}</div>}
        <p className="text-xs text-muted-foreground">Nếu số buổi bị ghi sai, nhập số dương để cộng hoặc số âm để trừ, ghi rõ lý do rồi lưu.</p>
        <form className="grid gap-2 lg:grid-cols-[minmax(8rem,1fr)_8rem_minmax(12rem,2fr)_auto] lg:items-end" onSubmit={event => { event.preventDefault(); void (async () => {
          try {
            await api.adminTrainers.adjustPtWallet(Number(memberId), adjustment);
            setWallet(await api.adminTrainers.getPtWallet(Number(memberId)));
            setMessage('Đã cập nhật số buổi PT.');
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Không điều chỉnh được số buổi PT.'); }
        })(); }}>
          <label className="space-y-1 text-sm font-medium">Cấp độ PT
            <select className="w-full rounded border px-3 py-2 font-normal" value={adjustment.level} onChange={event => setAdjustment({ ...adjustment, level: event.target.value })}>{paidLevels.map(level => <option key={level} value={level}>{levelNames[level]}</option>)}</select>
          </label>
          <label className="space-y-1 text-sm font-medium">Số buổi cộng (+) / trừ (−)
            <input className="w-full rounded border px-3 py-2 font-normal" type="number" min="-100" max="100" value={adjustment.delta} onChange={event => setAdjustment({ ...adjustment, delta: Number(event.target.value) })} />
          </label>
          <label className="space-y-1 text-sm font-medium">Lý do điều chỉnh
            <input className="w-full rounded border px-3 py-2 font-normal" placeholder="Ví dụ: Sửa số buổi nhập sai" required value={adjustment.reason} onChange={event => setAdjustment({ ...adjustment, reason: event.target.value })} />
          </label>
          <button className="rounded bg-primary px-4 py-2 text-primary-foreground" type="submit">Lưu điều chỉnh</button>
        </form>
        {wallet.transactions.length > 0 && <div className="max-h-44 overflow-y-auto text-xs text-muted-foreground">{wallet.transactions.map((row: any) => <p key={row.id}>{new Date(row.createdAt).toLocaleString('vi-VN')} · {transactionNames[row.kind] ?? row.kind}: {row.quantity} buổi {row.note || ''}</p>)}</div>}
      </div>}
    </section>
  </div>;
}
