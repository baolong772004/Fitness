import React, { useState, useEffect } from 'react';
import { api, ShiftSummaryData } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import { toast } from '@/components/common/ToastNotification';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { LogOut, DollarSign, AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

interface StaffLogoutCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLogout: () => void;
  isSessionExpired?: boolean;
}

export const StaffLogoutCashModal: React.FC<StaffLogoutCashModalProps> = ({
  isOpen,
  onClose,
  onConfirmLogout,
  isSessionExpired = false
}) => {
  const [shiftSummary, setShiftSummary] = useState<ShiftSummaryData | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(false);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [differenceReason, setDifferenceReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingShift(true);
      setActualCashInput('');
      setDifferenceReason('');

      api.staff
        .getCurrentShift()
        .then((res) => {
          if (res?.data) {
            setShiftSummary(res.data);
          }
        })
        .catch((err) => {
          console.warn('Không thể tải tóm tắt ca trực:', err);
        })
        .finally(() => {
          setIsLoadingShift(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const systemCashX = shiftSummary?.systemCashAmount ?? 0;
  const actualCashY = actualCashInput !== '' ? Number(actualCashInput) : null;
  const differenceAmount = actualCashY !== null ? actualCashY - systemCashX : null;
  const isDifferenceDetected = differenceAmount !== null && differenceAmount !== 0;

  const handleClose = () => {
    if (isSessionExpired) {
      if (window.confirm('Phiên làm việc đã hết hạn. Bạn có chắc muốn đăng xuất ngay về Trang Chủ mà không chốt quỹ tiền mặt ca trực không?')) {
        onConfirmLogout();
      }
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (actualCashY === null || isNaN(actualCashY) || actualCashY < 0) {
      soundEffects.playErrorBeep();
      toast.warning('Vui lòng nhập số tiền mặt thực tế đang có trong ngăn kéo sau ca làm việc.');
      return;
    }

    if (isDifferenceDetected && !differenceReason.trim()) {
      soundEffects.playErrorBeep();
      toast.error('Số tiền thực tế chênh lệch với hệ thống! Bắt buộc phải nhập lý do chênh lệch trước khi đăng xuất.', 'Đối Soát Ca');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.staff.closeShift({
        actualCashAmount: actualCashY,
        differenceReason: differenceReason.trim() || undefined
      });

      soundEffects.playSuccessBeep();
      toast.success('Chốt quỹ tiền mặt ca trực thành công! Hệ thống đang đăng xuất tài khoản.', 'Đã Bàn Giao Ca');

      localStorage.removeItem('aura_current_shift');

      setTimeout(() => {
        onConfirmLogout();
      }, 500);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Lỗi khi đóng ca và đối soát tiền mặt.', 'Lỗi Đóng Ca');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in-50 duration-200">
      <Card className="w-full max-w-lg border-2 border-primary/50 shadow-2xl bg-card overflow-hidden">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-foreground font-black">
              <ShieldAlert className="size-5 text-destructive" />
              {isSessionExpired ? 'Hết Thời Gian Làm - Chốt Tiền Mặt Để Đăng Xuất' : 'Bàn Giao Tiền Mặt Trước Khi Đăng Xuất'}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              ✕
            </Button>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {isSessionExpired
              ? 'Phiên làm việc đã hết hạn. Vui lòng nhập số tiền mặt thực tế trong ngăn kéo để chốt ca làm việc trước khi hệ thống hoàn tất đăng xuất.'
              : 'Quy định vận hành: Nhân viên quầy bắt buộc kiểm đếm và khai báo số tiền mặt thực tế sau ca trực trước khi rời khỏi hệ thống.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 pt-4">
          {isSessionExpired && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="size-4" />
              <AlertTitle className="text-xs font-bold">Phiên đăng nhập đã kết thúc</AlertTitle>
              <AlertDescription className="text-xs">
                Vui lòng kiểm đếm và khai báo số tiền mặt thực tế đang có trong ngăn kéo POS để chốt ca trước khi hệ thống chuyển hướng về Trang Chủ.
              </AlertDescription>
            </Alert>
          )}

          {isLoadingShift ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Đang kết nối số liệu quỹ tiền mặt ca trực...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              {/* Box hiển thị số liệu X và Y */}
              <div className="rounded-xl border bg-muted/30 p-3.5 grid grid-cols-2 gap-3 text-center">
                <div className="border-r pr-2">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Tiền hệ thống ghi nhận (X)
                  </span>
                  <div className="text-lg font-black text-primary font-mono mt-0.5">
                    {systemCashX.toLocaleString('vi-VN')} đ
                  </div>
                  {shiftSummary?.shiftCode && (
                    <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                      Ca: {shiftSummary.shiftCode}
                    </span>
                  )}
                </div>

                <div className="pl-2">
                  <span className="text-[11px] font-medium text-muted-foreground block">
                    Tiền thực tế khai báo (Y)
                  </span>
                  <div className="text-lg font-black text-foreground font-mono mt-0.5">
                    {actualCashY !== null ? `${actualCashY.toLocaleString('vi-VN')} đ` : 'Chưa nhập'}
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Kiểm đếm ngăn kéo
                  </span>
                </div>
              </div>

              {/* Trạng thái đối soát */}
              {actualCashY !== null && !isDifferenceDetected && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Số tiền thực tế khớp 100% với hệ thống (0 đ chênh lệch).</span>
                </div>
              )}

              {isDifferenceDetected && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="size-4" />
                  <AlertTitle className="text-xs font-bold">
                    Phát hiện chênh lệch: {differenceAmount !== null && differenceAmount > 0 ? '+' : ''}
                    {differenceAmount?.toLocaleString('vi-VN')} đ
                  </AlertTitle>
                  <AlertDescription className="text-xs mt-0.5">
                    Tiền thực tế {differenceAmount !== null && differenceAmount > 0 ? 'thừa' : 'thiếu'} so với hệ thống. Bắt buộc nhập lý do giải trình bên dưới.
                  </AlertDescription>
                </Alert>
              )}

              {/* Input bắt buộc: Tiền mặt thực tế Y */}
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Số tiền mặt thực tế đang có sau ca làm (VNĐ) *</span>
                  <span className="text-[10px] text-destructive font-semibold">Bắt buộc nhập</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    required
                    type="number"
                    min="0"
                    step="1000"
                    autoFocus
                    className="pl-9 h-11 font-mono font-bold text-base"
                    placeholder="Nhập số tiền kiểm đếm trong ngăn kéo..."
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Input bắt buộc nếu chênh lệch: Lý do */}
              {isDifferenceDetected && (
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-destructive">
                    Lý do chênh lệch doanh thu tiền mặt *
                  </label>
                  <Textarea
                    required
                    rows={2}
                    className="border-destructive focus-visible:ring-destructive text-xs"
                    placeholder="VD: Trả nhầm tiền thừa cho khách 10k lúc 14h, đổi tiền lẻ tại quầy nước..."
                    value={differenceReason}
                    onChange={(e) => setDifferenceReason(e.target.value)}
                  />
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 cursor-pointer text-xs"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Hủy (Quay Lại Ca)
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="flex-1 cursor-pointer font-bold text-xs gap-1.5"
                  disabled={
                    isSubmitting ||
                    actualCashInput.trim() === '' ||
                    (isDifferenceDetected && !differenceReason.trim())
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Đang chốt quỹ...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="size-3.5" />
                      <span>Chốt Quỹ & Đăng Xuất</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
