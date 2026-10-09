import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, AlertCircle, CheckCircle2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WebcamQrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
  fps?: number;
  qrbox?: number;
  autoStart?: boolean;
  className?: string;
}

export const WebcamQrScanner: React.FC<WebcamQrScannerProps> = ({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 220,
  autoStart = true,
  className = ''
}) => {
  const containerIdRef = useRef<string>(`html5qr-code-region-${Math.random().toString(36).substring(2, 9)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);
  const isCooldownRef = useRef(false);

  // Load available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const list = devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` }));
          setCameras(list);
          setSelectedCameraId(list[0].id);
        }
      })
      .catch((err) => {
        console.warn('Unable to query camera list:', err);
      });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {}).finally(() => {
              try { scannerRef.current?.clear(); } catch {}
            });
          } else {
            try { scannerRef.current.clear(); } catch {}
          }
        } catch {}
      }
    };
  }, []);

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current.clear();
    } catch (err) {
      console.warn('Error stopping scanner:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const startScanner = async (cameraId?: string) => {
    setErrorMessage(null);
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await stopScanner();
      }

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A
      ];
      const scanConfig = {
        fps,
        qrbox: { width: qrbox, height: qrbox },
        aspectRatio: 1.0
      };
      const onDecoded = (decodedText: string) => {
        if (isCooldownRef.current) return;
        isCooldownRef.current = true;
        setLastScannedText(decodedText);
        onScanSuccess(decodedText);
        setTimeout(() => {
          isCooldownRef.current = false;
          setLastScannedText(null);
        }, 2500);
      };
      const startWith = async (cameraConfig: { deviceId: { exact: string } } | { facingMode: string }) => {
        const scanner = new Html5Qrcode(containerIdRef.current, {
          formatsToSupport,
          verbose: false
        });
        scannerRef.current = scanner;
        try {
          await scanner.start(cameraConfig, scanConfig, onDecoded, (errMsg) => {
            if (onScanError) onScanError(errMsg);
          });
        } catch (error) {
          try { scanner.clear(); } catch {}
          if (scannerRef.current === scanner) scannerRef.current = null;
          throw error;
        }
      };

      // Some desktop cameras do not support the rear-facing constraint. Fall
      // back to a concrete device ID if the browser cannot open that camera.
      try {
        await startWith(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' });
      } catch (firstError: any) {
        if (firstError?.name === 'NotAllowedError' || firstError?.name === 'SecurityError') throw firstError;
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        const fallbackCamera = devices.find((device) => device.id !== cameraId) ?? devices[0];
        if (!fallbackCamera) throw firstError;
        await startWith({ deviceId: { exact: fallbackCamera.id } });
      }

      setIsScanning(true);
      setHasStarted(true);
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setIsScanning(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setErrorMessage('Trình duyệt chưa cấp quyền Camera. Hãy cho phép Camera trong cài đặt trang web rồi thử lại.');
        return;
      }
      if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        setErrorMessage('Không tìm thấy Camera phù hợp. Hãy kiểm tra camera đã kết nối hoặc chọn thiết bị khác.');
        return;
      }
      if (err?.name === 'NotReadableError' || err?.name === 'AbortError') {
        setErrorMessage('Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.');
        return;
      }
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setErrorMessage('Trình duyệt chỉ cho phép dùng Camera trên HTTPS hoặc localhost. Hãy mở trang bằng địa chỉ an toàn.');
        return;
      }
      setErrorMessage(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng cho phép quyền Camera trên thanh địa chỉ.'
          : err?.message || 'Không thể khởi động Webcam. Hãy đảm bảo thiết bị đã kết nối camera.'
      );
    }
  };

  useEffect(() => {
    if (autoStart && !hasStarted) {
      // Small timeout to ensure DOM container is rendered
      const t = setTimeout(() => {
        startScanner();
      }, 350);
      return () => clearTimeout(t);
    }
  }, [autoStart]);

  const handleToggle = () => {
    if (isScanning) {
      stopScanner();
    } else {
      startScanner(selectedCameraId || undefined);
    }
  };

  const handleCameraChange = (camId: string) => {
    setSelectedCameraId(camId);
    if (isScanning) {
      startScanner(camId);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-3 w-full ${className}`}>
      {/* Viewport Frame */}
      <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border-2 border-primary/40 bg-black/90 shadow-lg flex items-center justify-center">
        {/* Hidden or active HTML5 video container */}
        <div id={containerIdRef.current} className="w-full h-full object-cover [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover" />

        {/* Laser scanline overlay when scanning */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
            {/* 4 corner brackets */}
            <div className="flex justify-between">
              <div className="size-6 border-t-2 border-l-2 border-primary rounded-tl-sm" />
              <div className="size-6 border-t-2 border-r-2 border-primary rounded-tr-sm" />
            </div>

            {/* Glowing animated scanline */}
            <div className="relative w-full">
              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(255,107,0,1)] animate-bounce" />
            </div>

            <div className="flex justify-between">
              <div className="size-6 border-b-2 border-l-2 border-primary rounded-bl-sm" />
              <div className="size-6 border-b-2 border-r-2 border-primary rounded-br-sm" />
            </div>
          </div>
        )}

        {/* Idle / Off overlay */}
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-card/95 z-20">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CameraOff className="size-7" />
            </div>
            <p className="text-xs font-semibold text-foreground">Webcam Đang Tắt</p>
            <p className="text-[11px] text-muted-foreground max-w-[200px]">
              Bấm nút bên dưới để bật camera và quét mã QR của học viên trực tiếp.
            </p>
          </div>
        )}

        {/* Success flash indicator on detect */}
        {lastScannedText && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-success/80 text-white backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <CheckCircle2 className="size-12 animate-scale-in" />
            <span className="mt-2 text-xs font-bold uppercase tracking-wider">Đã Quét Thành Công!</span>
            <span className="text-[11px] opacity-90 truncate max-w-[220px]">{lastScannedText}</span>
          </div>
        )}
      </div>

      {/* Camera switcher if multiple cameras exist */}
      {cameras.length > 1 && (
        <div className="w-full max-w-[320px]">
          <Select value={selectedCameraId} onValueChange={handleCameraChange}>
            <SelectTrigger className="h-8 text-xs">
              <Video className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Chọn Camera" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-2 w-full max-w-[320px]">
        <Button
          type="button"
          size="sm"
          variant={isScanning ? 'destructive' : 'default'}
          className="flex-1 gap-2 text-xs font-semibold"
          onClick={handleToggle}
        >
          {isScanning ? (
            <>
              <CameraOff className="size-4" /> Tắt Webcam
            </>
          ) : (
            <>
              <Camera className="size-4" /> Bật Webcam Quét QR
            </>
          )}
        </Button>

        {isScanning && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-2.5 text-xs"
            title="Khởi động lại Webcam"
            onClick={() => startScanner(selectedCameraId || undefined)}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2.5 text-xs max-w-[320px]">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-semibold">Lỗi Camera</AlertTitle>
          <AlertDescription className="text-[11px] mt-0.5">{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
