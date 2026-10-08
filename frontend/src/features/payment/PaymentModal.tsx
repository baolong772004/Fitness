import React, { useState } from 'react';
import { Invoice, InvoiceItem } from '../../types';
import { soundEffects } from '../../services/audioService';
import { 
  X, 
  QrCode, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  Printer, 
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberPhone: string;
  items: InvoiceItem[];
  discountVND?: number;
  onPaymentSuccess: (invoice: Invoice) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  memberId,
  memberName,
  memberPhone,
  items,
  discountVND = 0,
  onPaymentSuccess
}) => {
  const [method, setMethod] = useState<'vietqr' | 'momo' | 'cash_cod'>('vietqr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);

  if (!isOpen) return null;

  const subtotalVND = items.reduce((sum, item) => sum + item.amountVND, 0);
  const totalVND = Math.max(0, subtotalVND - discountVND);
  const invoiceCode = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const handleSimulateSuccess = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const newInvoice: Invoice = {
        id: 'inv-' + Date.now(),
        code: invoiceCode,
        memberId,
        memberName,
        memberPhone,
        items,
        subtotalVND,
        discountVND,
        totalVND,
        paymentMethod: method,
        status: 'paid',
        staffName: 'Thu Ngân (Lễ tân)',
        createdAt: new Date().toISOString()
      };

      soundEffects.playSuccessBeep();
      setIsProcessing(false);
      setCompletedInvoice(newInvoice);
      onPaymentSuccess(newInvoice);
    }, 900);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: completedInvoice ? 540 : 620 }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: 'var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              padding: 8,
              borderRadius: 'var(--radius-full)'
            }}>
              <CreditCard size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 800 }}>
                {completedInvoice ? 'Hóa Đơn Thanh Toán Điện Tử' : 'Cổng Thanh Toán Dịch Vụ'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {completedInvoice ? `Mã: ${completedInvoice.code}` : `Khách hàng: ${memberName} (${memberPhone})`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: 6, borderRadius: 'var(--radius-full)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {!completedInvoice ? (
            <div>
              {/* Items summary */}
              <div style={{
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid var(--aura-border)'
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase' }}>
                  Chi tiết dịch vụ đăng ký
                </div>
                {items.map((it, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    fontSize: 14
                  }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{it.name} (x{it.quantity})</span>
                    <span className="metric-mono" style={{ color: 'var(--color-primary)' }}>
                      {it.amountVND.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                ))}
                {discountVND > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: 'var(--color-success)',
                    fontSize: 13,
                    borderTop: '1px dashed var(--aura-border)',
                    paddingTop: 8,
                    marginTop: 8
                  }}>
                    <span>Ưu đãi khuyến mãi:</span>
                    <span>- {discountVND.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--aura-border)',
                  paddingTop: 12,
                  marginTop: 10
                }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Tổng thanh toán:</span>
                  <span className="metric-mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {totalVND.toLocaleString('vi-VN')} <span style={{ fontSize: 14, color: 'var(--color-primary)' }}>VNĐ</span>
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                  Chọn Phương Thức Thanh Toán:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setMethod('vietqr')}
                    style={{
                      background: method === 'vietqr' ? 'rgba(254, 116, 19, 0.15)' : 'var(--bg-app)',
                      border: method === 'vietqr' ? '2px solid var(--color-primary)' : '1px solid var(--aura-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <QrCode size={24} color="var(--color-primary)" />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Chuyển khoản VietQR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('momo')}
                    style={{
                      background: method === 'momo' ? 'rgba(216, 45, 139, 0.15)' : 'var(--bg-app)',
                      border: method === 'momo' ? '2px solid #D82D8B' : '1px solid var(--aura-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <CreditCard size={24} color="#D82D8B" />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Ví Điện Tử MoMo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod('cash_cod')}
                    style={{
                      background: method === 'cash_cod' ? 'rgba(0, 200, 83, 0.15)' : 'var(--bg-app)',
                      border: method === 'cash_cod' ? '2px solid var(--color-success)' : '1px solid var(--aura-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Banknote size={24} color="var(--color-success)" />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Tiền Mặt Tại Quầy</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Payment Preview */}
              {method === 'vietqr' && (
                <div style={{
                  background: 'linear-gradient(135deg, #10251E, #142024)',
                  padding: 18,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid rgba(0, 200, 83, 0.25)',
                  marginBottom: 20
                }}>
                  <div style={{ display: 'inline-block', background: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 }}>
                    {/* Visual VietQR code with Napas styling */}
                    <div style={{
                      width: 140,
                      height: 140,
                      background: '#fff',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #0054A6'
                    }}>
                      <QrCode size={110} color="#000" />
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#0054A6' }}>VietQR | Napas247</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                    Quét mã để chuyển: <span className="metric-mono" style={{ color: 'var(--color-primary)', fontSize: 16 }}>{totalVND.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Nội dung CK: <strong style={{ color: 'var(--text-primary)' }}>FITNESS {invoiceCode}</strong>
                  </div>
                </div>
              )}

              {method === 'momo' && (
                <div style={{
                  background: 'rgba(216, 45, 139, 0.08)',
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid rgba(216, 45, 139, 0.3)',
                  marginBottom: 20
                }}>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>Cổng thanh toán MoMo Sandbox</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Hệ thống sẽ kích hoạt ngay khi nhận được tín hiệu thanh toán từ ví MoMo.
                  </p>
                </div>
              )}

              {method === 'cash_cod' && (
                <div style={{
                  background: 'rgba(0, 200, 83, 0.08)',
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  marginBottom: 20
                }}>
                  <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>Thu Tiền Mặt Trực Tiếp</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Nhân viên lễ tân nhận đủ số tiền <strong style={{ color: 'var(--color-success)' }}>{totalVND.toLocaleString('vi-VN')} đ</strong> và xác nhận kích hoạt dịch vụ.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 2 }}
                  onClick={handleSimulateSuccess}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span>Đang Xác Nhận Giao Dịch...</span>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>[Giả Lập Thanh Toán Thành Công]</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Printable Success Invoice */
            <div>
              <div style={{
                textAlign: 'center',
                padding: '16px 0',
                marginBottom: 16
              }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}>
                  <CheckCircle2 size={36} />
                </div>
                <h4 style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 800 }}>Giao Dịch Thành Công!</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Gói dịch vụ đã được kích hoạt thành công trên hệ thống.
                </p>
              </div>

              {/* Receipt View */}
              <div className="printable-invoice" style={{
                background: '#fff',
                color: '#161E21',
                padding: '20px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 20,
                fontSize: 13,
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
              }}>
                <div style={{ textAlign: 'center', borderBottom: '1px dashed #ccc', paddingBottom: 12, marginBottom: 12 }}>
                  <h4 style={{ fontSize: 18, color: '#000', fontWeight: 900 }}>AURA FITNESS CENTER</h4>
                  <p style={{ fontSize: 11, color: '#666' }}>Số 108 Phố Thể Thao, Hà Nội | Hotline: 1900 6868</p>
                  <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>PHIẾU THU TIỀN DỊCH VỤ</p>
                  <p className="metric-mono" style={{ fontSize: 11, color: '#888' }}>Mã: {completedInvoice.code}</p>
                </div>

                <div style={{ marginBottom: 12, lineHeight: 1.6 }}>
                  <div>Khách hàng: <strong>{completedInvoice.memberName}</strong></div>
                  <div>SĐT: <strong>{completedInvoice.memberPhone}</strong></div>
                  <div>Thời gian: {new Date(completedInvoice.createdAt).toLocaleString('vi-VN')}</div>
                  <div>Hình thức: <strong>{completedInvoice.paymentMethod === 'vietqr' ? 'Chuyển khoản VietQR' : completedInvoice.paymentMethod === 'momo' ? 'Ví MoMo' : 'Tiền mặt tại quầy'}</strong></div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left', fontSize: 12, color: '#666' }}>
                      <th style={{ paddingBottom: 6 }}>Dịch vụ</th>
                      <th style={{ paddingBottom: 6, textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedInvoice.items.map((it, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '8px 0' }}>{it.name} (x{it.quantity})</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                          {it.amountVND.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ borderTop: '1px dashed #ccc', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
                    <span>TỔNG CỘNG:</span>
                    <span>{completedInvoice.totalVND.toLocaleString('vi-VN')} VNĐ</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                  Cảm ơn Quý khách đã đồng hành cùng AURA Fitness!
                </div>
              </div>

              {/* Print and Close buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={handlePrint}
                >
                  <Printer size={16} />
                  <span>In Hóa Đơn</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={onClose}
                >
                  <span>Hoàn Tất</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
