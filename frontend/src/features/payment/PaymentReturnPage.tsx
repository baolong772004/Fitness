import { useEffect, useState } from 'react';
import { api } from '../../services/api';

const terminalStatuses = new Set(['PAID', 'PAID_REVIEW', 'CANCELLED', 'EXPIRED', 'FAILED']);

export function PaymentReturnPage() {
  const orderCode = new URLSearchParams(window.location.search).get('orderCode') ?? '';
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!/^\d+$/.test(orderCode)) {
      setError('Thiếu mã đơn hàng PayOS. Vui lòng liên hệ hỗ trợ để kiểm tra giao dịch.');
      return;
    }

    let active = true;
    let timer: number | undefined;
    const check = async () => {
      try {
        const result = await api.payments.checkPaymentStatus(orderCode);
        if (!active) return;
        setStatus(result.status);
        setError(result.status === 'PAID_REVIEW' ? result.message : '');
        if (terminalStatuses.has(result.status) && timer !== undefined) window.clearInterval(timer);
      } catch (err: any) {
        if (active) setError(err?.message || 'Chưa kiểm tra được thanh toán.');
      }
    };
    void check();
    timer = window.setInterval(() => { void check(); }, 5000);
    return () => { active = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [orderCode]);

  const message = status === 'PAID'
    ? 'PayOS đã xác nhận thanh toán. Gói Gym được kích hoạt hoặc xếp hàng chờ theo thứ tự xác nhận.'
    : status === 'PAID_REVIEW'
      ? 'Đã nhận tiền nhưng đơn cần hỗ trợ xử lý. Gói chưa được cấp quyền.'
      : status === 'CANCELLED' || status === 'EXPIRED' || status === 'FAILED'
        ? 'Đơn đã bị hủy hoặc hết hạn. Gói chưa được kích hoạt.'
        : 'Đang chờ PayOS xác nhận thanh toán. Gói chưa được kích hoạt.';

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#faf7f3' }}>
      <section style={{ width: '100%', maxWidth: 480, padding: 28, borderRadius: 20, background: '#fff', boxShadow: '0 12px 32px #49261a1a' }}>
        <h1 style={{ margin: 0, color: '#572a1c' }}>Thanh toán gói tập</h1>
        <p style={{ marginTop: 8, color: '#78665f' }}>Mã đơn: {orderCode || 'không có'}</p>
        <p style={{ marginTop: 24, lineHeight: 1.6 }}>{message}</p>
        {error && <p role="alert" style={{ color: '#ad3024', lineHeight: 1.5 }}>{error}</p>}
        <a href="/" style={{ display: 'inline-block', marginTop: 16, padding: '11px 18px', borderRadius: 10, background: '#572a1c', color: '#fff', textDecoration: 'none' }}>
          Về trang chủ
        </a>
      </section>
    </main>
  );
}
