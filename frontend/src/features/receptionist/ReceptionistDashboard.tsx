import React, { useState, useEffect, useRef } from 'react';
import { Member, PackagePlan, Coach } from '../../types';
import { api, tokenStorage, EquipmentItem, OperationalNoteItem, ShiftSummaryData } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import { toast } from '@/components/common/ToastNotification';
import { WebcamQrScanner } from '@/components/common/WebcamQrScanner';
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserPlus,
  CreditCard,
  Clock,
  Check,
  Plus,
  Phone,
  Calendar,
  Layers,
  Dumbbell,
  Camera,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Wrench,
  FileText,
  Sparkles,
  DollarSign,
  LogOut,
  ArrowRight,
  Lock,
  Tag,
  Receipt,
  UserCheck,
  Flame,
  Bell,
  MapPin,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard, StaffPage, Field, PageHeader } from '@/components/staff/StaffKit';

interface ReceptionistDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  autoOpenScanner?: boolean;
  onLogout?: () => void;
}

export const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({
  activeTab,
  onTabChange,
  autoOpenScanner = false,
  onLogout
}) => {
  // =========================================================================
  // GIAI ĐOẠN 1 & 5: THÔNG TIN PHIÊN CA TRỰC (SHIFT STATE)
  // =========================================================================
  const [shiftSummary, setShiftSummary] = useState<ShiftSummaryData | null>(null);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [differenceReason, setDifferenceReason] = useState<string>('');
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  // =========================================================================
  // GIAI ĐOẠN 2: SOÁT VÉ VÀO CỔNG (VENUE CHECK-IN)
  // =========================================================================
  const [useWebcamScanner, setUseWebcamScanner] = useState(autoOpenScanner);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [manualPhoneInput, setManualPhoneInput] = useState('');
  const [manualLookupData, setManualLookupData] = useState<any | null>(null);
  const [manualNote, setManualNote] = useState('');
  const [isSearchingMember, setIsSearchingMember] = useState(false);
  const [checkInLogList, setCheckInLogList] = useState<any[]>([]);

  // =========================================================================
interface StaffConsultant {
  id: number;
  name: string;
  role: string;
  phone: string;
  email?: string;
}

  // GIAI ĐOẠN 3: HỖ TRỢ THANH TOÁN TẠI QUẦY (OFFLINE POS FALLBACK)
  // =========================================================================
  const [posSubTab, setPosSubTab] = useState<'walkin' | 'pending' | 'freeze'>('walkin');
  const [packages, setPackages] = useState<PackagePlan[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [consultants, setConsultants] = useState<StaffConsultant[]>([]);
  const [consultantIdInput, setConsultantIdInput] = useState<string>('');

  // 3.1 Khách Walk-in
  const [walkInForm, setWalkInForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    packageId: 0,
    consultantStaffId: 0,
    paymentMethod: 'CASH' as 'CASH' | 'POS',
    amountPaid: '' as string,
    traceRefNo: ''
  });
  const [walkInSuccessData, setWalkInSuccessData] = useState<any | null>(null);

  // 3.2 Hóa đơn chờ
  const [pendingPhoneSearch, setPendingPhoneSearch] = useState('');
  const [pendingPaymentsData, setPendingPaymentsData] = useState<any | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [offlinePayMethod, setOfflinePayMethod] = useState<'CASH' | 'POS'>('CASH');
  const [offlineCashReceived, setOfflineCashReceived] = useState<string>('');
  const [offlineTraceRefNo, setOfflineTraceRefNo] = useState<string>('');

  // 3.3 Bảo lưu tại quầy
  const [freezePhoneSearch, setFreezePhoneSearch] = useState('');
  const [freezeMemberData, setFreezeMemberData] = useState<any | null>(null);
  const [freezeDays, setFreezeDays] = useState(30);
  const [freezeReason, setFreezeReason] = useState('');

  // =========================================================================
  // GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU
  // =========================================================================
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
  const [operationalNotes, setOperationalNotes] = useState<OperationalNoteItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [equipmentMaintenanceNote, setEquipmentMaintenanceNote] = useState('');
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState<'ALL' | 'AVAILABLE' | 'MAINTENANCE'>('ALL');

  // Ghi chú vận hành mới
  const [opNoteForm, setOpNoteForm] = useState({
    category: 'HYGIENE' as 'HYGIENE' | 'EQUIPMENT' | 'SERVICE' | 'FACILITY' | 'OTHER',
    content: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    memberName: '',
    memberPhone: ''
  });

  // Hội viên danh sách tham chiếu
  const [members, setMembers] = useState<Member[]>([]);

  // =========================================================================
  // LOAD DỮ LIỆU BAN ĐẦU
  // =========================================================================
  const loadInitialData = async () => {
    // 1. Tải thông tin ca trực hiện tại
    try {
      const shiftRes = await api.staff.getCurrentShift();
      if (shiftRes && shiftRes.data) {
        setShiftSummary(shiftRes.data);
        if (shiftRes.data.checkIns && Array.isArray(shiftRes.data.checkIns)) {
          setCheckInLogList(shiftRes.data.checkIns);
        }
      }
    } catch (e: any) {
      console.warn('Chưa mở ca trực hoặc không có quyền:', e.message);
    }

    // 2. Tải danh sách gói tập
    try {
      const livePkgs = await api.packages.getPackages();
      if (livePkgs && livePkgs.length > 0) {
        const mapped: PackagePlan[] = livePkgs.map((p) => ({
          id: String(p.id),
          name: p.name,
          type: p.type === 'PT' ? 'hybrid_pt' : 'standard_gym',
          durationMonths: Math.max(1, Math.round(p.durationDays / 30)),
          priceVND: Number(p.price),
          unlimitedGymAccess: true,
          ptSessionsIncluded: p.trialPtSessions || p.totalPtSessions || 0,
          description: p.description || '',
          features: ['Check-in 24/7', `${p.durationDays} ngày sử dụng`]
        }));
        setPackages(mapped);
        if (walkInForm.packageId === 0 && livePkgs[0]) {
          setWalkInForm((prev) => ({ ...prev, packageId: livePkgs[0].id }));
        }
      }
    } catch (e) {
      console.warn('Lỗi tải gói tập:', e);
    }

    // 3. Tải danh sách thiết bị
    try {
      const eqRes = await api.staff.getEquipment();
      if (eqRes.data) setEquipments(eqRes.data);
    } catch (e) {
      console.warn('Lỗi tải thiết bị:', e);
    }

    // 4. Tải danh sách ghi chú vận hành
    try {
      const notesRes = await api.staff.getOperationalNotes();
      if (notesRes.data?.items) setOperationalNotes(notesRes.data.items);
    } catch (e) {
      console.warn('Lỗi tải ghi chú:', e);
    }

    // 5. Tải danh sách HLV & Nhân viên tư vấn giới thiệu (STAFF, COACH, ADMIN)
    try {
      const staffList: StaffConsultant[] = [];
      try {
        const usersRes = await api.users.getUsers({ limit: 100 });
        if (usersRes?.data && Array.isArray(usersRes.data)) {
          usersRes.data
            .filter((u: any) => ['STAFF', 'COACH', 'ADMIN', 'RECEPTIONIST'].includes(u.role))
            .forEach((u: any) => {
              staffList.push({
                id: u.id,
                name: u.fullName || u.email,
                role: u.role,
                phone: u.phone || '',
                email: u.email || ''
              });
            });
        }
      } catch (err) {
        console.warn('Không thể tải nhân sự từ /users:', err);
      }

      // Fallback: nếu /users không lấy được thì nạp từ adminTrainers
      if (staffList.length === 0) {
        try {
          const coachesRes = await api.adminTrainers.getTrainers();
          if (coachesRes?.data) {
            coachesRes.data.forEach((c: any) => {
              staffList.push({
                id: c.id,
                name: c.fullName || 'HLV',
                role: 'COACH',
                phone: c.phone || '',
                email: c.email || ''
              });
            });
          }
        } catch (e) {
          console.warn('Lỗi tải HLV fallback:', e);
        }
      }

      setConsultants(staffList);
      setCoaches(
        staffList.map((s) => ({
          id: String(s.id),
          name: s.name,
          phone: s.phone,
          email: s.email,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
          rating: 5,
          specialty: s.role === 'COACH' ? 'Gym & Fitness' : 'Tư vấn viên',
          activeTrainees: 0,
          status: 'available'
        })) as unknown as Coach[]
      );
    } catch (e) {
      console.warn('Lỗi tải nhân viên tư vấn:', e);
    }

    // 6. Tải danh sách hội viên gần đây
    try {
      const usersRes = await api.users.getUsers({ role: 'MEMBER', limit: 30 });
      if (usersRes.data) {
        setMembers(
          usersRes.data.map((u: any) => ({
            id: String(u.id),
            code: `MEM-${u.id}`,
            name: u.fullName || u.email,
            phone: u.phone || 'N/A',
            cccd: 'N/A',
            gender: u.gender === 'female' ? 'female' : 'male',
            birthYear: 2000,
            activePackageId: 'pkg-1',
            packageName: 'Gói Hội Viên',
            packageStartDate: '01/01/2026',
            packageEndDate: '31/12/2026',
            daysRemaining: 30,
            ptSessionsTotal: 0,
            ptSessionsRemaining: 0,
            avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
            totalCheckIns: 1,
            status: 'active'
          })) as unknown as Member[]
        );
      }
    } catch (e) {
      console.warn('Lỗi tải members:', e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // =========================================================================
  // GIAI ĐOẠN 2: LOGIC SOÁT VÉ VÀO CỔNG (2–3 giây)
  // =========================================================================

  // Quét QR động từ Camera/Webcam
  const handleWebcamScanSuccess = async (qrToken: string) => {
    try {
      const res = await api.staff.scanQrCheckIn(qrToken.trim());
      setScanResult(res);

      if (res.status === 'SUCCESS') {
        soundEffects.playSuccessBeep();
        toast.success(res.message, 'Check-in Thành Công');
        // Thêm vào danh sách log
        setCheckInLogList((prev) => [
          {
            id: Date.now(),
            name: res.data?.member?.fullName,
            packageName: res.data?.membership?.packageName,
            time: new Date().toLocaleTimeString('vi-VN'),
            status: 'SUCCESS',
            color: 'GREEN'
          },
          ...prev
        ]);
        // Tải lại tổng kết ca
        const shiftRes = await api.staff.getCurrentShift();
        if (shiftRes?.data) {
          setShiftSummary(shiftRes.data);
          if (shiftRes.data.checkIns && Array.isArray(shiftRes.data.checkIns)) {
            setCheckInLogList(shiftRes.data.checkIns);
          }
        }
      } else if (res.status === 'ANTI_PASSBACK') {
        soundEffects.playErrorBeep();
        toast.error(res.message, 'Cảnh Báo Anti-Passback');
      } else {
        soundEffects.playErrorBeep();
        toast.warning(res.message, 'Từ Chối Vào Cổng');
      }
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setScanResult({
        success: false,
        status: 'SERVER_ERROR',
        color: 'RED',
        message: err.message || 'Mã QR không hợp lệ hoặc lỗi kiểm soát cổng.'
      });
    }
  };

  // Tra cứu hội viên bằng SĐT (Check-in thủ công dự phòng khi khách hết pin)
  const handleLookupMemberByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhoneInput.trim()) return;
    setIsSearchingMember(true);
    setManualLookupData(null);

    try {
      const res = await api.staff.lookupMember(manualPhoneInput.trim());
      setManualLookupData(res.data);
      soundEffects.playSuccessBeep();
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message || 'Không tìm thấy hội viên nào.', 'Tra Cứu');
    } finally {
      setIsSearchingMember(false);
    }
  };

  // Xác nhận vào thủ công sau khi đã đối chiếu ảnh chân dung
  const handleConfirmManualCheckIn = async () => {
    if (!manualLookupData?.member?.id) return;
    try {
      const res = await api.staff.manualCheckIn({
        memberId: manualLookupData.member.id,
        notes: manualNote || 'Check-in thủ công đối chiếu ảnh chân dung'
      });
      soundEffects.playSuccessBeep();
      toast.success(res.message, 'Check-in Thủ Công');
      setScanResult({
        success: true,
        status: 'SUCCESS',
        color: 'GREEN',
        message: res.message,
        data: {
          member: manualLookupData.member,
          membership: manualLookupData.activeMembership,
          ptSessionToday: res.data.ptNote
            ? {
                hasPtToday: true,
                displayAlert: res.data.ptNote
              }
            : null
        }
      });
      setManualLookupData(null);
      setManualPhoneInput('');
      setManualNote('');

      const shiftRes = await api.staff.getCurrentShift();
      if (shiftRes?.data) {
        setShiftSummary(shiftRes.data);
        if (shiftRes.data.checkIns && Array.isArray(shiftRes.data.checkIns)) {
          setCheckInLogList(shiftRes.data.checkIns);
        } else {
          setCheckInLogList((prev) => [
            {
              id: res.data?.checkInId || Date.now(),
              name: manualLookupData.member.fullName,
              packageName: manualLookupData.activeMembership?.packageName || 'Check-in Thủ Công',
              time: new Date().toLocaleTimeString('vi-VN'),
              status: 'SUCCESS',
              color: 'GREEN'
            },
            ...prev
          ]);
        }
      }
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message, 'Check-in Thất Bại');
    }
  };

  // =========================================================================
  // GIAI ĐOẠN 3: LOGIC HỖ TRỢ THANH TOÁN TẠI QUẦY (OFFLINE POS FALLBACK)
  // =========================================================================

  // 3.1 Khách Walk-in
  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInForm.fullName || !walkInForm.phone || !walkInForm.packageId) {
      toast.warning('Vui lòng điền đầy đủ Họ tên, SĐT và Gói tập.');
      return;
    }

    try {
      const res = await api.staff.walkInRegistration({
        fullName: walkInForm.fullName,
        phone: walkInForm.phone,
        email: walkInForm.email || undefined,
        packageId: Number(walkInForm.packageId),
        consultantStaffId: walkInForm.consultantStaffId ? Number(walkInForm.consultantStaffId) : undefined,
        paymentMethod: walkInForm.paymentMethod,
        amountPaid: walkInForm.amountPaid ? Number(walkInForm.amountPaid) : undefined,
        traceRefNo: walkInForm.traceRefNo || undefined
      });

      soundEffects.playSuccessBeep();
      setWalkInSuccessData(res.data);
      toast.success('Kích hoạt gói Walk-in thành công!', 'Walk-in POS');

      // Tải lại ca trực để cập nhật doanh thu tiền mặt
      const shiftRes = await api.staff.getCurrentShift();
      if (shiftRes?.data) setShiftSummary(shiftRes.data);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message, 'Lỗi Walk-in');
    }
  };

  // 3.2 Tìm hóa đơn chờ thanh toán
  const handleSearchPendingPayments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPhoneSearch.trim()) return;
    try {
      const res = await api.staff.getPendingPayments(pendingPhoneSearch.trim());
      setPendingPaymentsData(res.data);
      if (res.data.pendingPayments.length === 0) {
        toast.info('Khách hàng này hiện không có hóa đơn nào đang chờ thanh toán.');
      } else {
        setSelectedPaymentId(res.data.pendingPayments[0].id);
      }
    } catch (err: any) {
      toast.error(err.message, 'Tra Cứu Hóa Đơn');
    }
  };

  // Xác nhận thanh toán hóa đơn chờ tại quầy
  const handleProcessOfflinePay = async () => {
    if (!selectedPaymentId) return;
    try {
      const res = await api.staff.processOfflinePayment({
        paymentId: selectedPaymentId,
        paymentMethod: offlinePayMethod,
        cashReceived: offlineCashReceived ? Number(offlineCashReceived) : undefined,
        traceRefNo: offlineTraceRefNo || undefined
      });

      soundEffects.playSuccessBeep();
      toast.success(res.message, 'Thanh Toán Tại Quầy');
      setPendingPaymentsData(null);
      setPendingPhoneSearch('');
      setSelectedPaymentId(null);
      setOfflineCashReceived('');
      setOfflineTraceRefNo('');

      const shiftRes = await api.staff.getCurrentShift();
      if (shiftRes?.data) setShiftSummary(shiftRes.data);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message, 'Lỗi Thanh Toán');
    }
  };

  // 3.3 Tra cứu gói để bảo lưu
  const handleSearchFreezeMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezePhoneSearch.trim()) return;
    try {
      const res = await api.staff.lookupMember(freezePhoneSearch.trim());
      setFreezeMemberData(res.data);
      if (!res.data.hasActiveGymAccess) {
        toast.warning('Hội viên này hiện không có gói tập đang ACTIVE để bảo lưu.');
      }
    } catch (err: any) {
      toast.error(err.message, 'Bảo Lưu Gói');
    }
  };

  // Xác nhận bảo lưu gói
  const handleConfirmFreeze = async () => {
    if (!freezeMemberData?.activeMembership?.id) return;
    if (!freezeReason.trim()) {
      toast.warning('Vui lòng nhập lý do bảo lưu gói.');
      return;
    }

    try {
      const res = await api.staff.freezeMembership({
        membershipId: freezeMemberData.activeMembership.id,
        freezeDays: Number(freezeDays),
        reason: freezeReason.trim()
      });

      soundEffects.playSuccessBeep();
      toast.success(res.message, 'Bảo Lưu Thành Công');
      setFreezeMemberData(null);
      setFreezePhoneSearch('');
      setFreezeReason('');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message, 'Lỗi Bảo Lưu');
    }
  };

  // =========================================================================
  // GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU
  // =========================================================================

  // Cập nhật trạng thái máy tập sang bảo trì
  const handleUpdateEquipmentStatus = async () => {
    if (!selectedEquipment) return;
    try {
      const nextStatus = selectedEquipment.status === 'UNDER_MAINTENANCE' ? 'AVAILABLE' : 'UNDER_MAINTENANCE';
      const res = await api.staff.updateEquipmentStatus(selectedEquipment.id, {
        status: nextStatus,
        note: equipmentMaintenanceNote || (nextStatus === 'UNDER_MAINTENANCE' ? 'Lễ tân báo hỏng' : 'Đã sửa chữa xong')
      });

      soundEffects.playSuccessBeep();
      toast.success(res.message, 'Thiết Bị Phòng Gym');
      setIsMaintenanceModalOpen(false);
      setSelectedEquipment(null);
      setEquipmentMaintenanceNote('');

      // Tải lại thiết bị
      const eqRes = await api.staff.getEquipment();
      if (eqRes.data) setEquipments(eqRes.data);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message, 'Lỗi Cập Nhật');
    }
  };

  // Gửi ghi chú vận hành / tiếp nhận phản ánh
  const handleCreateOperationalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opNoteForm.content.trim()) {
      toast.warning('Vui lòng nhập nội dung phản ánh.');
      return;
    }

    try {
      const res = await api.staff.createOperationalNote({
        category: opNoteForm.category,
        content: opNoteForm.content.trim(),
        priority: opNoteForm.priority,
        memberName: opNoteForm.memberName || undefined,
        memberPhone: opNoteForm.memberPhone || undefined
      });

      soundEffects.playSuccessBeep();
      toast.success(res.message, 'Ghi Chú Vận Hành');
      setOpNoteForm({
        category: 'HYGIENE',
        content: '',
        priority: 'MEDIUM',
        memberName: '',
        memberPhone: ''
      });

      // Tải lại ghi chú
      const notesRes = await api.staff.getOperationalNotes();
      if (notesRes.data?.items) setOperationalNotes(notesRes.data.items);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message, 'Lỗi Gửi Ghi Chú');
    }
  };

  // =========================================================================
  // GIAI ĐOẠN 5: CHỐT CA & TỰ ĐỘNG CHẤM CÔNG RA (CLOCK-OUT)
  // =========================================================================

  const systemCashX = shiftSummary?.systemCashAmount || 0;
  const actualCashY = actualCashInput !== '' ? Number(actualCashInput) : null;
  const differenceAmount = actualCashY !== null ? actualCashY - systemCashX : null;
  const isDifferenceDetected = differenceAmount !== null && differenceAmount !== 0;

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCashY === null) {
      toast.warning('Vui lòng nhập số tiền mặt thực tế kiểm đếm được trong ngăn kéo.');
      return;
    }

    if (isDifferenceDetected && !differenceReason.trim()) {
      soundEffects.playErrorBeep();
      toast.error('Số tiền thực tế chênh lệch với hệ thống! Bắt buộc phải nhập lý do chênh lệch trước khi chốt ca.', 'Đối Soát Ca');
      return;
    }

    setIsSubmittingShift(true);
    try {
      const res = await api.staff.closeShift({
        actualCashAmount: actualCashY,
        differenceReason: differenceReason.trim() || undefined
      });

      soundEffects.playSuccessBeep();
      toast.success('Chốt ca và chấm công ra (Clock-out) thành công! Hệ thống sẽ tự động đăng xuất.', 'Chốt Ca');
      setIsCloseShiftModalOpen(false);

      // Xóa phiên ca trực khỏi localStorage
      localStorage.removeItem('aura_current_shift');

      setTimeout(() => {
        if (onLogout) {
          onLogout();
        } else {
          api.auth.logout();
          window.location.reload();
        }
      }, 1200);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      toast.error(err.message, 'Lỗi Đóng Ca');
    } finally {
      setIsSubmittingShift(false);
    }
  };

  const handleOpenNewShift = async () => {
    try {
      const shiftRes = await api.staff.getCurrentShift();
      if (shiftRes && shiftRes.data) {
        setShiftSummary(shiftRes.data);
        if (shiftRes.data.checkIns && Array.isArray(shiftRes.data.checkIns)) {
          setCheckInLogList(shiftRes.data.checkIns);
        }
        soundEffects.playSuccessBeep();
        toast.success(`Đã kích hoạt ca trực [${shiftRes.data.shiftCode}] thành công!`, 'Ca Trực');
      }
    } catch (e: any) {
      soundEffects.playErrorBeep();
      toast.error(e.message || 'Không thể mở ca trực', 'Lỗi');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'STAFF':
      case 'RECEPTIONIST':
        return 'Lễ Tân / Nhân Viên';
      case 'COACH':
        return 'HLV (PT)';
      case 'ADMIN':
        return 'Quản Lý / Admin';
      default:
        return role;
    }
  };

  const selectedConsultant = consultants.find((c) => c.id === walkInForm.consultantStaffId);
  const selectedWalkInPkg = packages.find((p) => p.id === String(walkInForm.packageId));
  const walkInPkgPrice = selectedWalkInPkg?.priceVND || 0;
  const walkInCashGiven = walkInForm.amountPaid ? Number(walkInForm.amountPaid) : walkInPkgPrice;
  const walkInChange = Math.max(0, walkInCashGiven - walkInPkgPrice);

  const totalEquipments = equipments.length;
  const maintenanceCount = equipments.filter(
    (e) => e.status === 'UNDER_MAINTENANCE' || e.status === 'MAINTENANCE'
  ).length;
  const availableCount = totalEquipments - maintenanceCount;
  const notesCount = operationalNotes.length;

  const filteredEquipments = equipments.filter((eq) => {
    const q = equipmentSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      eq.name.toLowerCase().includes(q) ||
      eq.code.toLowerCase().includes(q) ||
      (eq.room?.name && eq.room.name.toLowerCase().includes(q));
    const isMaint = eq.status === 'UNDER_MAINTENANCE' || eq.status === 'MAINTENANCE';
    if (equipmentFilter === 'AVAILABLE') return matchesSearch && !isMaint;
    if (equipmentFilter === 'MAINTENANCE') return matchesSearch && isMaint;
    return matchesSearch;
  });

  return (
    <StaffPage>
      {/* =====================================================================
          HEADER BAR: THÔNG TIN PHIÊN CA TRỰC (GIAI ĐOẠN 1 & 5)
      ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-card via-card to-primary/5 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Clock className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-foreground">
                Ca Trực Lễ Tân Quầy
              </span>
              <Badge variant={shiftSummary ? "success" : "secondary"} className="gap-1 px-2 text-[11px] font-bold">
                <span className={`size-1.5 rounded-full ${shiftSummary ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                {shiftSummary ? 'ĐANG MỞ' : 'CHƯA MỞ'}
              </Badge>
              {shiftSummary?.shiftCode ? (
                <span className="rounded-md border bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                  {shiftSummary.shiftCode}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Máy quầy: <strong className="text-foreground">{shiftSummary?.deviceName || 'Quầy Số 1'}</strong>
              </span>
              <span>•</span>
              <span>
                Giờ Clock-in:{' '}
                <strong className="text-foreground">
                  {shiftSummary?.clockIn ? new Date(shiftSummary.clockIn).toLocaleTimeString('vi-VN') : 'Tự động khi mở quầy'}
                </strong>
              </span>
              <span>•</span>
              <span>
                Lượt check-in: <strong className="text-primary font-bold">{shiftSummary?.stats?.totalCheckIns || 0}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end pr-3 border-r">
            <span className="text-[11px] font-medium text-muted-foreground">Quỹ tiền mặt ca (X)</span>
            <span className="text-lg font-black text-primary font-mono tracking-tight">
              {(shiftSummary?.systemCashAmount || 0).toLocaleString('vi-VN')} đ
            </span>
          </div>

          {shiftSummary ? (
            <Button
              type="button"
              variant="destructive"
              className="gap-2 font-bold shadow-xs hover:bg-destructive/90 cursor-pointer"
              onClick={() => {
                setActualCashInput(String(shiftSummary?.systemCashAmount || ''));
                setIsCloseShiftModalOpen(true);
              }}
            >
              <LogOut className="size-4" /> Chốt Ca & Clock-out
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-2 font-bold cursor-pointer"
              onClick={handleOpenNewShift}
            >
              <Plus className="size-4" /> Kích Hoạt Ca Trực (Clock-in)
            </Button>
          )}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: SOÁT VÉ VÀO CỔNG (VENUE CHECK-IN - 2-3s) (GIAI ĐOẠN 2)
      ===================================================================== */}
      {activeTab === 'checkin' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-6">
            {/* Terminal Quét QR & Camera */}
            <Card className="border-primary/40 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <QrCode className="size-5 text-primary" /> Soát Vé Vào Cổng (Venue Check-in)
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant={useWebcamScanner ? 'default' : 'outline'}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
                    onClick={() => setUseWebcamScanner(!useWebcamScanner)}
                  >
                    <Camera className="size-3.5" />
                    {useWebcamScanner ? 'Tắt Camera Quầy' : 'Bật Camera Quét QR'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 pt-5">
                {/* Khu vực Camera / Scanner */}
                {useWebcamScanner ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border bg-black/5 p-4">
                    <WebcamQrScanner onScanSuccess={handleWebcamScanSuccess} autoStart={true} />
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Đang nhận diện Dynamic QR từ Mobile App của khách (Mã tự làm mới 30–60s chống gian lận).
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-muted/20 p-8 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                      <QrCode className="size-7" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Sẵn sàng nhận tín hiệu quét</h4>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                      Bật Camera quầy hoặc sử dụng đầu đọc Barcode/QR cắm ngoài quét trực tiếp vào màn hình.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4 gap-2 font-bold cursor-pointer"
                      onClick={() => setUseWebcamScanner(true)}
                    >
                      <Camera className="size-4" /> Kích Hoạt Camera Quầy
                    </Button>
                  </div>
                )}

                {/* Check-in Thủ Công Dự Phòng */}
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Phone className="size-3.5 text-primary" /> Check-in Thủ Công (Khi khách hết pin / quên điện thoại)
                    </span>
                    <span className="text-[11px] text-muted-foreground">Đối chiếu ảnh chân dung</span>
                  </div>

                  <form onSubmit={handleLookupMemberByPhone} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        className="pl-9 h-10 text-sm font-medium"
                        placeholder="Nhập SĐT hội viên (VD: 0933445566)..."
                        value={manualPhoneInput}
                        onChange={(e) => setManualPhoneInput(e.target.value)}
                      />
                    </div>
                    <Button type="submit" disabled={isSearchingMember} className="font-bold cursor-pointer h-10 px-4">
                      {isSearchingMember ? 'Đang tra cứu...' : 'Tìm Hội Viên'}
                    </Button>
                  </form>

                  {/* Hiển thị kết quả tra cứu đối chiếu mặt */}
                  {manualLookupData && (
                    <div className="mt-4 rounded-xl border border-primary/30 bg-card p-4 shadow-sm animate-in fade-in-50 duration-200">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        {/* Ảnh chân dung lớn để đối chiếu mặt */}
                        <div className="relative shrink-0 text-center">
                          <Avatar className="size-24 rounded-xl border-2 border-primary shadow-md">
                            <AvatarImage src={manualLookupData.member.avatar} alt={manualLookupData.member.fullName} />
                            <AvatarFallback className="rounded-xl text-2xl font-bold bg-muted">
                              {manualLookupData.member.fullName.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <Badge variant="outline" className="mt-2 text-[10px] font-bold">
                            ẢNH ĐỐI CHIẾU
                          </Badge>
                        </div>

                        <div className="flex-1 min-w-0 text-center sm:text-left">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <h4 className="text-lg font-extrabold text-foreground">{manualLookupData.member.fullName}</h4>
                            <Badge variant={manualLookupData.hasActiveGymAccess ? 'success' : 'destructive'}>
                              {manualLookupData.hasActiveGymAccess ? 'GÓI CÒN HẠN' : 'HẾT HẠN'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">SĐT: {manualLookupData.member.phone}</p>

                          {manualLookupData.activeMembership && (
                            <div className="mt-2 text-xs bg-muted/40 p-2 rounded-lg border">
                              <div>
                                Gói:{' '}
                                <strong className="text-primary">{manualLookupData.activeMembership.packageName}</strong>
                              </div>
                              <div>
                                Còn lại:{' '}
                                <strong className="text-foreground">
                                  {manualLookupData.activeMembership.remainingDays} ngày
                                </strong>{' '}
                                (đến {new Date(manualLookupData.activeMembership.endDate).toLocaleDateString('vi-VN')})
                              </div>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Input
                              type="text"
                              className="h-8 text-xs flex-1 min-w-[180px]"
                              placeholder="Ghi chú xác thực (ví dụ: khách quên đt, đã đối chiếu mặt khớp)..."
                              value={manualNote}
                              onChange={(e) => setManualNote(e.target.value)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!manualLookupData.hasActiveGymAccess}
                              className="font-bold bg-primary text-primary-foreground h-8 cursor-pointer"
                              onClick={handleConfirmManualCheckIn}
                            >
                              <Check className="size-3.5" /> Xác Nhận Vào Cổng
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CỘT PHẢI: MÀN HÌNH PHẢN HỒI KẾT QUẢ SOÁT VÉ */}
          <div className="grid content-start gap-6">
            {scanResult ? (
              <Card
                className={`overflow-hidden border-2 shadow-lg transition-all animate-in zoom-in-95 duration-200 ${
                  scanResult.color === 'GREEN'
                    ? 'border-success bg-gradient-to-b from-success/5 to-card ring-2 ring-success/20'
                    : 'border-destructive bg-gradient-to-b from-destructive/5 to-card ring-2 ring-destructive/20'
                }`}
              >
                <CardHeader
                  className={`pb-3 border-b ${
                    scanResult.color === 'GREEN' ? 'bg-success/15 border-success/30' : 'bg-destructive/15 border-destructive/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className={`text-base font-extrabold flex items-center gap-2 ${
                        scanResult.color === 'GREEN' ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {scanResult.color === 'GREEN' ? (
                        <>
                          <CheckCircle2 className="size-6 text-success animate-bounce" /> HỢP LỆ — MỜI VÀO CỔNG
                        </>
                      ) : (
                        <>
                          <XCircle className="size-6 text-destructive animate-pulse" /> TỪ CHỐI VÀO CỔNG
                        </>
                      )}
                    </CardTitle>
                    <Badge variant={scanResult.color === 'GREEN' ? 'success' : 'destructive'} className="font-mono text-xs">
                      {scanResult.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 pt-4">
                  <Alert
                    variant={scanResult.color === 'GREEN' ? 'default' : 'destructive'}
                    className={scanResult.color === 'GREEN' ? 'border-success/40 bg-success/10 text-success' : ''}
                  >
                    <AlertTitle className="font-bold text-sm">{scanResult.message}</AlertTitle>
                    {scanResult.data?.suggestion && (
                      <AlertDescription className="text-xs">{scanResult.data.suggestion}</AlertDescription>
                    )}
                  </Alert>

                  {/* NHẬN DIỆN BUỔI TẬP PT HÔM NAY (NỔI BẬT) */}
                  {scanResult.data?.ptSessionToday?.hasPtToday && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3 shadow-sm animate-pulse">
                      <div className="flex items-center gap-3">
                        <Flame className="size-5 text-amber-500 shrink-0" />
                        <div>
                          <div className="text-xs font-extrabold uppercase tracking-wide">
                            {scanResult.data.ptSessionToday.displayAlert}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Hệ thống đã tự động bắn Push Notification thông báo đến Coach!
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-[10px]">
                        PT COACH NOTIFIED
                      </Badge>
                    </div>
                  )}

                  {/* Thông tin hội viên */}
                  {scanResult.data?.member && (
                    <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-3">
                      <Avatar className="size-16 rounded-xl border-2 border-primary/40 shadow-sm">
                        <AvatarImage src={scanResult.data.member.avatar} alt={scanResult.data.member.fullName} />
                        <AvatarFallback>{scanResult.data.member.fullName?.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-extrabold text-foreground truncate">{scanResult.data.member.fullName}</h4>
                        <p className="text-xs text-muted-foreground">SĐT: {scanResult.data.member.phone}</p>
                        {scanResult.data.membership && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="font-semibold text-primary">{scanResult.data.membership.packageName}</span>
                            <span className="text-muted-foreground">• Còn {scanResult.data.membership.remainingDays} ngày</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full font-bold cursor-pointer"
                    onClick={() => setScanResult(null)}
                  >
                    <RefreshCw className="size-3.5" /> Quét Khách Tiếp Theo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-muted bg-muted/10 text-center p-8">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mx-auto text-muted-foreground mb-3">
                  <ShieldCheck className="size-7" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Chưa có lượt quét nào</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Kết quả xác thực vé vào cổng và thông báo PT sẽ hiển thị tức thì tại đây sau khi khách quét mã QR.
                </p>
              </Card>
            )}

            {/* Lịch sử check-in nhanh gần đây */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="size-4 text-primary" /> Lịch Sử Check-in Ca Trực
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {checkInLogList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Chưa có lượt check-in mới trong phiên này.</p>
                ) : (
                  <div className="divide-y text-xs">
                    {checkInLogList.slice(0, 5).map((log) => (
                      <div key={log.id} className="py-2 flex items-center justify-between">
                        <div>
                          <strong className="text-foreground">{log.name}</strong>
                          <span className="text-muted-foreground ml-2">({log.packageName})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono">{log.time}</span>
                          <Badge variant="success" className="text-[10px] px-1.5 py-0">VÀO</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: QUẦY POS & HỖ TRỢ THANH TOÁN (GIAI ĐOẠN 3)
      ===================================================================== */}
      {activeTab === 'pos' && (
        <div className="grid gap-6">
          {/* Sub-tab Switchers */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <Button
              type="button"
              variant={posSubTab === 'walkin' ? 'default' : 'outline'}
              className="gap-2 font-bold cursor-pointer"
              onClick={() => setPosSubTab('walkin')}
            >
              <UserPlus className="size-4" /> 1. Khách Walk-in (Chưa Tải App)
            </Button>
            <Button
              type="button"
              variant={posSubTab === 'pending' ? 'default' : 'outline'}
              className="gap-2 font-bold cursor-pointer"
              onClick={() => setPosSubTab('pending')}
            >
              <CreditCard className="size-4" /> 2. Thanh Toán Tại Quầy (Tiền Mặt)
            </Button>
            <Button
              type="button"
              variant={posSubTab === 'freeze' ? 'default' : 'outline'}
              className="gap-2 font-bold cursor-pointer"
              onClick={() => setPosSubTab('freeze')}
            >
              <Lock className="size-4" /> 3. Bảo Lưu Gói Tại Quầy (Hỗ Trợ Hộ)
            </Button>
          </div>

          {/* SUB-TAB 1: KHÁCH WALK-IN */}
          {posSubTab === 'walkin' && (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="size-5 text-primary" /> Đăng Ký Nhanh Khách Walk-in
                  </CardTitle>
                  <CardDescription>
                    Tạo hồ sơ tức thì, chọn gói tập, gán nhân viên tư vấn hoa hồng và thu tiền mặt tại quầy.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWalkInSubmit} className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Họ và Tên khách hàng *">
                        <Input
                          required
                          placeholder="Nguyễn Văn A"
                          value={walkInForm.fullName}
                          onChange={(e) => setWalkInForm({ ...walkInForm, fullName: e.target.value })}
                        />
                      </Field>
                      <Field label="Số điện thoại *">
                        <Input
                          required
                          placeholder="0987654321"
                          value={walkInForm.phone}
                          onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                        />
                      </Field>
                    </div>

                    <Field label="Email liên hệ (Tùy chọn, tự sinh nếu để trống)">
                      <Input
                        type="email"
                        placeholder="nguyenvana@gmail.com"
                        value={walkInForm.email}
                        onChange={(e) => setWalkInForm({ ...walkInForm, email: e.target.value })}
                      />
                    </Field>

                    {/* Chọn gói tập - Riêng 1 dòng đầy đủ không gian */}
                    <Field label="Chọn gói tập (Membership / PT) *">
                      <Select
                        value={String(walkInForm.packageId)}
                        onValueChange={(val) => setWalkInForm({ ...walkInForm, packageId: Number(val) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn gói tập..." />
                        </SelectTrigger>
                        <SelectContent>
                          {packages.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.name} — {pkg.priceVND.toLocaleString('vi-VN')} đ ({pkg.features[1] || ''})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    {/* Nhân viên tư vấn / ID giới thiệu - Xuống dòng riêng để rộng rãi, không bị đè hay lệch */}
                    <Field label="Nhân viên tư vấn / ID giới thiệu (Tính hoa hồng)">
                      <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
                        <Input
                          type="number"
                          placeholder="Mã ID NV"
                          className="font-mono text-center font-bold h-9"
                          value={consultantIdInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConsultantIdInput(val);
                            setWalkInForm({ ...walkInForm, consultantStaffId: val ? Number(val) : 0 });
                          }}
                          title="Nhập trực tiếp ID nhân viên giới thiệu"
                        />
                        <div className="min-w-0">
                          <Select
                            value={String(walkInForm.consultantStaffId)}
                            onValueChange={(val) => {
                              const num = Number(val);
                              setWalkInForm({ ...walkInForm, consultantStaffId: num });
                              setConsultantIdInput(num > 0 ? String(num) : '');
                            }}
                          >
                            <SelectTrigger className="w-full h-9">
                              <SelectValue placeholder="-- Hoặc chọn nhân viên từ danh sách --" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Không có (Khách tự đến quầy / Không người giới thiệu)</SelectItem>
                              {consultants.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  [ID #{c.id}] {c.name} • {getRoleLabel(c.role)} {c.phone ? `(${c.phone})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {walkInForm.consultantStaffId > 0 && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                          <UserCheck className="size-3.5 shrink-0" />
                          {selectedConsultant ? (
                            <span>
                              Gán hoa hồng cho: <strong>[ID #{selectedConsultant.id}] {selectedConsultant.name}</strong> ({getRoleLabel(selectedConsultant.role)})
                            </span>
                          ) : (
                            <span>
                              Gán hoa hồng theo ID: <strong>Mã NV #{walkInForm.consultantStaffId}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </Field>

                    <Separator className="my-2" />

                    <div className="grid sm:grid-cols-2 gap-4 items-end">
                      <Field label="Hình thức thu tiền *">
                        <div className="flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary">
                          <DollarSign className="size-4 shrink-0" />
                          <span>Tiền mặt tại quầy (Cash)</span>
                        </div>
                      </Field>

                      <Field label="Số tiền khách đưa (đ)">
                        <Input
                          type="number"
                          placeholder={walkInPkgPrice ? String(walkInPkgPrice) : '600000'}
                          value={walkInForm.amountPaid}
                          onChange={(e) => setWalkInForm({ ...walkInForm, amountPaid: e.target.value })}
                        />
                      </Field>
                    </div>

                    <Button type="submit" size="lg" className="w-full font-bold bg-primary text-primary-foreground mt-2 cursor-pointer">
                      <Check className="size-5" /> Kích Hoạt Gói Ngay & Gửi Link SMS Tải App
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Tóm tắt phiếu thu Walk-in */}
              <div className="grid content-start gap-4">
                <Card className="border-primary/30 bg-muted/10">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Receipt className="size-4 text-primary" /> Chi Tiết Thu Ngân Walk-in
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 pt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gói tập:</span>
                      <strong className="text-foreground">{selectedWalkInPkg?.name || 'Chưa chọn'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Giá niêm yết:</span>
                      <strong className="text-primary text-base font-mono">{walkInPkgPrice.toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Người giới thiệu:</span>
                      <strong className="text-foreground text-xs text-right">
                        {walkInForm.consultantStaffId > 0
                          ? selectedConsultant
                            ? `[ID #${selectedConsultant.id}] ${selectedConsultant.name}`
                            : `Mã NV #${walkInForm.consultantStaffId}`
                          : 'Khách tự đến quầy'}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Hình thức:</span>
                      <Badge variant="outline" className="border-primary/40 text-primary font-medium">Tiền mặt tại quầy</Badge>
                    </div>

                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Tiền khách đưa:</span>
                      <span className="font-mono font-semibold">{walkInCashGiven.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between items-center bg-primary/10 p-2.5 rounded-lg border border-primary/20">
                      <span className="font-bold text-primary">Tiền thừa thối khách:</span>
                      <strong className="font-bold text-primary text-base font-mono">{walkInChange.toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      * Doanh thu {walkInPkgPrice.toLocaleString('vi-VN')} đ sẽ được tự động ghi nhận vào quỹ tiền mặt ca trực hiện tại.
                    </p>
                  </CardContent>
                </Card>

                {walkInSuccessData && (
                  <Card className="border-success/50 bg-success/10 animate-in fade-in-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-success flex items-center gap-2">
                        <CheckCircle2 className="size-4" /> Kích Hoạt Walk-in Thành Công!
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-xs">
                      <p>Hội viên: <strong>{walkInSuccessData.member.fullName}</strong> ({walkInSuccessData.member.phone})</p>
                      <p>Hạn sử dụng: Đến <strong>{new Date(walkInSuccessData.membership.endDate).toLocaleDateString('vi-VN')}</strong></p>
                      <div className="mt-2 p-2.5 rounded-lg bg-background border">
                        <span className="font-bold block mb-1">Nội dung SMS gửi hội viên:</span>
                        <code className="text-[11px] text-primary block break-all">{walkInSuccessData.smsInvitation.messageText}</code>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: THANH TOÁN TẠI QUẦY (HÓA ĐƠN CHỜ) */}
          {posSubTab === 'pending' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="size-5 text-primary" /> Xử Lý Hóa Đơn Chờ Thanh Toán Tại Quầy
                </CardTitle>
                <CardDescription>
                  Dành cho Member đã đặt gói trên Mobile App chọn "Thanh toán tại quầy" hoặc nhờ quầy thu tiền mặt hộ.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <form onSubmit={handleSearchPendingPayments} className="flex gap-2 max-w-md">
                  <Input
                    placeholder="Nhập SĐT hội viên (VD: 0988776655)..."
                    value={pendingPhoneSearch}
                    onChange={(e) => setPendingPhoneSearch(e.target.value)}
                  />
                  <Button type="submit" className="font-bold cursor-pointer">
                    <Search className="size-4" /> Tìm Hóa Đơn
                  </Button>
                </form>

                {pendingPaymentsData && (
                  <div className="rounded-xl border p-4 bg-muted/20 grid gap-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <div>
                        <h4 className="font-bold text-foreground">{pendingPaymentsData.member.fullName}</h4>
                        <p className="text-xs text-muted-foreground">SĐT: {pendingPaymentsData.member.phone}</p>
                      </div>
                      <Badge variant="warning">{pendingPaymentsData.pendingPayments.length} Hóa đơn chờ</Badge>
                    </div>

                    {pendingPaymentsData.pendingPayments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Không có hóa đơn PENDING nào.</p>
                    ) : (
                      <div className="grid gap-4">
                        <div className="divide-y rounded-lg border bg-card">
                          {pendingPaymentsData.pendingPayments.map((p: any) => (
                            <div
                              key={p.id}
                              className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                selectedPaymentId === p.id ? 'bg-primary/10 border-primary' : 'hover:bg-accent/40'
                              }`}
                              onClick={() => setSelectedPaymentId(p.id)}
                            >
                              <div>
                                <strong className="text-sm text-foreground">
                                  Hóa đơn #{p.id} — Gói: {p.membership?.packageName || 'Tập Gym'}
                                </strong>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Tạo lúc: {new Date(p.createdAt).toLocaleString('vi-VN')}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-base text-primary font-mono">
                                  {p.amount.toLocaleString('vi-VN')} đ
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Form thanh toán */}
                        <div className="rounded-xl border bg-card p-4 grid gap-4">
                          <div className="grid sm:grid-cols-2 gap-4 items-end">
                            <Field label="Hình thức thu tiền *">
                              <div className="flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary">
                                <DollarSign className="size-4 shrink-0" />
                                <span>Tiền mặt tại quầy (Cash)</span>
                              </div>
                            </Field>

                            <Field label="Tiền mặt khách đưa (đ)">
                              <Input
                                type="number"
                                placeholder="Nhập số tiền..."
                                value={offlineCashReceived}
                                onChange={(e) => setOfflineCashReceived(e.target.value)}
                              />
                            </Field>
                          </div>

                          <Button
                            type="button"
                            size="lg"
                            className="font-bold bg-primary text-primary-foreground cursor-pointer"
                            onClick={handleProcessOfflinePay}
                          >
                            <Check className="size-5" /> Xác Nhận Thu Tiền & Kích Hoạt Gói Trên App Ngay
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SUB-TAB 3: BẢO LƯU GÓI TẠI QUẦY */}
          {posSubTab === 'freeze' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="size-5 text-primary" /> Hỗ Trợ Bảo Lưu Gói Tại Quầy
                </CardTitle>
                <CardDescription>
                  Dành cho hội viên không rành công nghệ: Lễ tân tra cứu hồ sơ và hỗ trợ gia hạn thời gian bảo lưu gói tập.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <form onSubmit={handleSearchFreezeMember} className="flex gap-2 max-w-md">
                  <Input
                    placeholder="Nhập SĐT hội viên (VD: 0933445566)..."
                    value={freezePhoneSearch}
                    onChange={(e) => setFreezePhoneSearch(e.target.value)}
                  />
                  <Button type="submit" className="font-bold cursor-pointer">
                    <Search className="size-4" /> Tra Cứu Gói
                  </Button>
                </form>

                {freezeMemberData && (
                  <div className="rounded-xl border p-4 bg-muted/20 grid gap-4 max-w-xl">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div>
                        <h4 className="font-bold text-foreground">{freezeMemberData.member.fullName}</h4>
                        <p className="text-xs text-muted-foreground">SĐT: {freezeMemberData.member.phone}</p>
                      </div>
                      <Badge variant={freezeMemberData.hasActiveGymAccess ? 'success' : 'destructive'}>
                        {freezeMemberData.hasActiveGymAccess ? 'CÓ GÓI ACTIVE' : 'KHÔNG CÓ GÓI HỢP LỆ'}
                      </Badge>
                    </div>

                    {freezeMemberData.activeMembership && (
                      <div className="grid gap-4">
                        <div className="text-xs bg-card p-3 rounded-lg border">
                          <div>Gói tập: <strong className="text-primary">{freezeMemberData.activeMembership.packageName}</strong></div>
                          <div>Hạn dùng hiện tại: <strong>{new Date(freezeMemberData.activeMembership.endDate).toLocaleDateString('vi-VN')}</strong> (Còn {freezeMemberData.activeMembership.remainingDays} ngày)</div>
                        </div>

                        <Field label="Số ngày muốn bảo lưu cộng dồn *">
                          <Select value={String(freezeDays)} onValueChange={(val) => setFreezeDays(Number(val))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 ngày (1 tuần)</SelectItem>
                              <SelectItem value="15">15 ngày</SelectItem>
                              <SelectItem value="30">30 ngày (1 tháng)</SelectItem>
                              <SelectItem value="60">60 ngày (2 tháng)</SelectItem>
                              <SelectItem value="90">90 ngày (3 tháng)</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field label="Lý do bảo lưu *">
                          <Input
                            placeholder="VD: Đi công tác nước ngoài, lý do sức khỏe..."
                            value={freezeReason}
                            onChange={(e) => setFreezeReason(e.target.value)}
                          />
                        </Field>

                        <Button
                          type="button"
                          className="font-bold bg-primary text-primary-foreground cursor-pointer"
                          onClick={handleConfirmFreeze}
                        >
                          <Check className="size-4" /> Xác Nhận Bảo Lưu Thêm {freezeDays} Ngày
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU (GIAI ĐOẠN 4)
      ===================================================================== */}
      {activeTab === 'operations' && (
        <div className="flex flex-col gap-6 min-w-0 w-full">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3.5 rounded-2xl border bg-card/80 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Dumbbell className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">Tổng thiết bị</p>
                <p className="text-2xl font-black text-foreground">{totalEquipments}</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-success/30 bg-success/5 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">Đang sẵn sàng</p>
                <p className="text-2xl font-black text-success">{availableCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">Đang bảo trì / lỗi</p>
                <p className="text-2xl font-black text-destructive">{maintenanceCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs backdrop-blur-sm">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">Phản ánh ca trực</p>
                <p className="text-2xl font-black text-primary">{notesCount}</p>
              </div>
            </div>
          </div>

          {/* =====================================================================
              PHẦN 1 (TRÊN - FULL WIDTH): QUẢN LÝ & BẢO TRÌ THIẾT BỊ
              Đầy đủ không gian, hiển thị toàn bộ cột, KHÔNG bị thanh cuộn / kéo thả ngang
          ===================================================================== */}
          <Card className="min-w-0 w-full overflow-hidden border-border/80 shadow-xs bg-card">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="size-5 text-primary" /> Quản Lý & Bảo Trì Thiết Bị
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Theo dõi tình trạng hoạt động và báo hỏng / hoàn tất sửa chữa máy tập
                  </p>
                </div>

                {/* Quick Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
                    <button
                      type="button"
                      onClick={() => setEquipmentFilter('ALL')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        equipmentFilter === 'ALL'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tất cả ({totalEquipments})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEquipmentFilter('AVAILABLE')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                        equipmentFilter === 'AVAILABLE'
                          ? 'bg-success/20 text-success shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-success" />
                      Sẵn sàng ({availableCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEquipmentFilter('MAINTENANCE')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                        equipmentFilter === 'MAINTENANCE'
                          ? 'bg-destructive/20 text-destructive shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
                      Bảo trì ({maintenanceCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mt-3 relative w-full">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên máy, mã thiết bị (EQ-...) hoặc vị trí phòng tập..."
                  className="pl-9 pr-9 h-9 text-xs bg-background/90 w-full"
                  value={equipmentSearch}
                  onChange={(e) => setEquipmentSearch(e.target.value)}
                />
                {equipmentSearch && (
                  <button
                    type="button"
                    onClick={() => setEquipmentSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 min-w-0">
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-xs">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[26%]" />
                    <col className="w-[15%]" />
                    <col className="w-[13%]" />
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead className="bg-muted/40 border-b border-border/60">
                    <tr className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider text-left">
                      <th className="py-3 px-3">Mã Máy</th>
                      <th className="py-3 px-3">Tên Thiết Bị</th>
                      <th className="py-3 px-2.5">Vị Trí / Phòng</th>
                      <th className="py-3 px-2">Trạng Thái</th>
                      <th className="py-3 px-2.5">Ghi Chú Kỹ Thuật</th>
                      <th className="py-3 pr-4 pl-1 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredEquipments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                          <Dumbbell className="size-9 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-sm font-semibold text-foreground/80">Không tìm thấy thiết bị nào</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Vui lòng thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredEquipments.map((eq) => {
                        const isMaint = eq.status === 'UNDER_MAINTENANCE' || eq.status === 'MAINTENANCE';
                        return (
                          <tr key={eq.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3 align-middle">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-muted/90 border border-border/70 text-foreground inline-block truncate max-w-full">
                                {eq.code}
                              </span>
                            </td>
                            <td className="py-3 px-3 align-middle min-w-0">
                              <div className="font-bold text-foreground text-xs sm:text-sm truncate" title={eq.name}>
                                {eq.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">Tiêu chuẩn GYM</div>
                            </td>
                            <td className="py-3 px-2.5 align-middle min-w-0">
                              <div className="flex items-center gap-1.5 text-xs text-foreground/85 font-medium truncate" title={eq.room?.name || 'Phòng tập chính'}>
                                <MapPin className="size-3.5 text-primary/70 shrink-0" />
                                <span className="truncate">{eq.room?.name || 'Phòng tập chính'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2 align-middle min-w-0">
                              {isMaint ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-destructive/15 text-destructive border border-destructive/30 shrink-0">
                                  <span className="size-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
                                  Bảo trì
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-success/15 text-success border border-success/30 shrink-0">
                                  <span className="size-1.5 rounded-full bg-success shrink-0" />
                                  Sẵn sàng
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2.5 align-middle min-w-0">
                              {eq.note ? (
                                <div
                                  className="flex items-center gap-1 text-[11px] text-destructive bg-destructive/10 border border-destructive/20 px-2 py-1 rounded-md truncate"
                                  title={eq.note}
                                >
                                  <AlertTriangle className="size-3 shrink-0" />
                                  <span className="truncate font-medium">{eq.note}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60 italic flex items-center gap-1 truncate">
                                  <CheckCircle2 className="size-3 text-success/70 shrink-0" /> Bình thường
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4 pl-1 align-middle text-right min-w-0">
                              <Button
                                type="button"
                                size="sm"
                                variant={isMaint ? 'default' : 'outline'}
                                className={`h-7 px-2.5 text-xs font-bold cursor-pointer transition-all shadow-xs gap-1 ml-auto inline-flex items-center shrink-0 ${
                                  isMaint
                                    ? 'bg-success text-success-foreground hover:bg-success/90'
                                    : 'border-destructive/40 text-destructive hover:bg-destructive/10'
                                }`}
                                onClick={() => {
                                  setSelectedEquipment(eq);
                                  setEquipmentMaintenanceNote(eq.note || '');
                                  setIsMaintenanceModalOpen(true);
                                }}
                              >
                                {isMaint ? (
                                  <>
                                    <CheckCircle2 className="size-3 shrink-0" /> Sửa Xong
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="size-3 shrink-0" /> Báo Hỏng
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* =====================================================================
              PHẦN 2 (DƯỚI - 2 CỘT SONG SONG): TIẾP NHẬN PHẢN ÁNH & NHẬT KÝ CA TRỰC
          ===================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0 w-full items-start">
            {/* CỘT TRÁI: TIẾP NHẬN PHẢN ÁNH & SỰ CỐ */}
            <Card className="min-w-0 w-full overflow-hidden border-border/80 shadow-xs bg-card flex flex-col">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-5 text-primary" /> Tiếp Nhận Phản Ánh & Sự Cố
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ghi nhanh phản ánh của khách tại quầy để chuyển giao Ban quản lý xử lý
                </p>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 min-w-0">
                <form onSubmit={handleCreateOperationalNote} className="grid gap-3.5 min-w-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <Field label="Phân loại phản ánh *">
                      <Select
                        value={opNoteForm.category}
                        onValueChange={(val: any) => setOpNoteForm({ ...opNoteForm, category: val })}
                      >
                        <SelectTrigger className="h-9 text-xs w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HYGIENE">Vệ sinh phòng tập</SelectItem>
                          <SelectItem value="FACILITY">Nhiệt độ / CSVC / Điều hòa</SelectItem>
                          <SelectItem value="SERVICE">Thái độ phục vụ</SelectItem>
                          <SelectItem value="EQUIPMENT">Máy móc / Tạ hỏng</SelectItem>
                          <SelectItem value="OTHER">Phản ánh khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Mức độ ưu tiên">
                      <Select
                        value={opNoteForm.priority}
                        onValueChange={(val: any) => setOpNoteForm({ ...opNoteForm, priority: val })}
                      >
                        <SelectTrigger className="h-9 text-xs w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Thấp (Low)</SelectItem>
                          <SelectItem value="MEDIUM">Bình thường (Medium)</SelectItem>
                          <SelectItem value="HIGH">Cao (High)</SelectItem>
                          <SelectItem value="URGENT">Khẩn cấp (Urgent)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    <Field label="Tên khách hàng (Tùy chọn)">
                      <Input
                        className="h-9 text-xs w-full"
                        placeholder="VD: Anh Minh..."
                        value={opNoteForm.memberName}
                        onChange={(e) => setOpNoteForm({ ...opNoteForm, memberName: e.target.value })}
                      />
                    </Field>
                    <Field label="SĐT khách (Tùy chọn)">
                      <Input
                        className="h-9 text-xs w-full"
                        placeholder="09..."
                        value={opNoteForm.memberPhone}
                        onChange={(e) => setOpNoteForm({ ...opNoteForm, memberPhone: e.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label="Nội dung phản ánh chi tiết *">
                    <Textarea
                      required
                      rows={3}
                      className="text-xs w-full resize-none"
                      placeholder="VD: Khách phản ánh phòng thay đồ nam sàn trượt, cần hỗ trợ dọn dẹp gấp..."
                      value={opNoteForm.content}
                      onChange={(e) => setOpNoteForm({ ...opNoteForm, content: e.target.value })}
                    />
                  </Field>

                  <Button type="submit" className="font-bold bg-primary text-primary-foreground cursor-pointer w-full mt-1">
                    <Check className="size-4 mr-1.5" /> Gửi Ghi Chú & Báo Cáo Quản Lý
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* CỘT PHẢI: NHẬT KÝ PHẢN ÁNH CA TRỰC */}
            <Card className="min-w-0 w-full overflow-hidden border-border/80 shadow-xs bg-card flex flex-col">
              <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="size-4 text-primary" /> Nhật Ký Phản Ánh Ca Trực
                </CardTitle>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {operationalNotes.length} sự cố
                </Badge>
              </CardHeader>
              <CardContent className="p-4 max-h-[385px] overflow-y-auto min-w-0">
                {operationalNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="size-9 text-success/40 mb-2" />
                    <p className="text-xs font-semibold text-foreground/80">Ca trực bình thường</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Chưa có sự cố nào được ghi nhận trong ca trực hiện tại.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 min-w-0">
                    {operationalNotes.map((note) => {
                      const isUrgent = note.priority === 'URGENT' || note.priority === 'HIGH';
                      return (
                        <div
                          key={note.id}
                          className={`p-3 rounded-xl border text-xs min-w-0 transition-all ${
                            isUrgent ? 'border-destructive/30 bg-destructive/5' : 'bg-card border-border/60 hover:bg-muted/20'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-foreground truncate">
                              [{note.category}] {note.memberName ? `Khách: ${note.memberName}` : 'Phản ánh quầy'}
                            </span>
                            <Badge
                              variant={isUrgent ? 'destructive' : 'outline'}
                              className="text-[10px] font-mono shrink-0"
                            >
                              {note.priority}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground break-words leading-relaxed">{note.content}</p>
                          <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Ghi nhận bởi: <strong className="text-foreground">{note.staff?.fullName || 'Lễ tân'}</strong></span>
                            <span>{new Date(note.createdAt).toLocaleTimeString('vi-VN')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: CA TRỰC & CHỐT CA (GIAI ĐOẠN 5)
      ===================================================================== */}
      {activeTab === 'shift' && (
        <div className="grid gap-6 max-w-4xl mx-auto">
          <Card className="border-primary/40 shadow-md">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="size-5 text-primary" /> Chi Tiết Phiên Ca Trực & Đối Soát Doanh Thu
              </CardTitle>
              <CardDescription>
                Đối soát Doanh thu ca (Shift Cash Reconciliation) → Đếm tiền mặt thực tế → Tự động Chấm công ra (Clock-out).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="rounded-xl border p-4 bg-muted/20">
                  <span className="text-xs text-muted-foreground">Mã Phiên Ca</span>
                  <div className="text-base font-extrabold text-foreground font-mono mt-1">
                    {shiftSummary?.shiftCode || 'SHF-ACTIVE'}
                  </div>
                </div>
                <div className="rounded-xl border p-4 bg-muted/20">
                  <span className="text-xs text-muted-foreground">Giờ Bắt Đầu (Clock-in)</span>
                  <div className="text-base font-extrabold text-foreground font-mono mt-1">
                    {shiftSummary?.clockIn ? new Date(shiftSummary.clockIn).toLocaleTimeString('vi-VN') : '08:00'}
                  </div>
                </div>
                <div className="rounded-xl border p-4 bg-primary/10 border-primary/30">
                  <span className="text-xs font-bold text-primary">Tiền Mặt Hệ Thống (X)</span>
                  <div className="text-xl font-black text-primary font-mono mt-1">
                    {(shiftSummary?.systemCashAmount || 0).toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div className="rounded-xl border p-4 bg-muted/20">
                  <span className="text-xs text-muted-foreground">Lượt Check-in Ca Này</span>
                  <div className="text-base font-extrabold text-foreground font-mono mt-1">
                    {shiftSummary?.stats?.totalCheckIns || 0} lượt
                  </div>
                </div>
              </div>

              {/* Bảng giao dịch trong ca */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-2">Các giao dịch phát sinh trong ca:</h4>
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã Đơn</TableHead>
                        <TableHead>Khách Hàng</TableHead>
                        <TableHead>Phương Thức</TableHead>
                        <TableHead>Thời Gian</TableHead>
                        <TableHead className="text-right">Số Tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shiftSummary?.payments && shiftSummary.payments.length > 0 ? (
                        shiftSummary.payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">#{p.id}</TableCell>
                            <TableCell className="text-xs font-semibold">{p.customerName}</TableCell>
                            <TableCell>
                              <Badge variant={p.method === 'CASH' ? 'success' : 'outline'} className="text-[10px]">
                                {p.method === 'CASH' ? 'Tiền mặt' : 'Thẻ POS'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {new Date(p.createdAt).toLocaleTimeString('vi-VN')}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs text-primary">
                              {p.amount.toLocaleString('vi-VN')} đ
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                            Chưa có giao dịch thanh toán nào trong ca này.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  className="font-bold gap-2 cursor-pointer"
                  onClick={() => {
                    setActualCashInput(String(shiftSummary?.systemCashAmount || ''));
                    setIsCloseShiftModalOpen(true);
                  }}
                >
                  <LogOut className="size-5" /> Tiến Hành Chốt Ca & Đóng Ca Làm Việc
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 5: DANH SÁCH HỘI VIÊN (MEMBERS)
      ===================================================================== */}
      {activeTab === 'members' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="size-5 text-primary" /> Danh Sách Hội Viên
            </CardTitle>
            <CardDescription>Tra cứu nhanh thông tin và tình trạng gói cước của hội viên trong hệ thống.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hội Viên</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Gói Tập</TableHead>
                    <TableHead>Trạng Thái</TableHead>
                    <TableHead className="text-right">Tùy Chọn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarImage src={m.avatar} alt={m.name} />
                            <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-xs text-foreground">{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{m.phone}</TableCell>
                      <TableCell className="text-xs font-medium text-primary">{m.packageName}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'active' ? 'success' : 'destructive'} className="text-[10px]">
                          {m.status === 'active' ? 'Hoạt động' : 'Hết hạn'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-semibold cursor-pointer"
                          onClick={() => {
                            setFreezePhoneSearch(m.phone);
                            setPosSubTab('freeze');
                            onTabChange('pos');
                          }}
                        >
                          Bảo lưu gói →
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* =====================================================================
          MODAL: CHỐT CA & ĐỐI SOÁT DOANH THU (GIAI ĐOẠN 5)
      ===================================================================== */}
      {isCloseShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50 duration-200">
          <Card className="w-full max-w-lg border-2 border-primary/40 shadow-2xl bg-card">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-foreground font-extrabold">
                  <LogOut className="size-5 text-destructive" /> Chốt Ca Làm Việc & Chấm Công Ra (Clock-out)
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 cursor-pointer"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                >
                  ✕
                </Button>
              </div>
              <CardDescription>
                Kiểm đếm tiền mặt thực tế trong ngăn kéo và đối soát với số liệu hệ thống.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 pt-4">
              <div className="rounded-xl border bg-muted/30 p-3.5 grid grid-cols-2 gap-4 text-center">
                <div>
                  <span className="text-xs text-muted-foreground">Tiền hệ thống ghi nhận (X):</span>
                  <div className="text-lg font-black text-primary font-mono mt-0.5">
                    {systemCashX.toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tiền thực tế kiểm đếm (Y):</span>
                  <div className="text-lg font-black text-foreground font-mono mt-0.5">
                    {actualCashY !== null ? actualCashY.toLocaleString('vi-VN') : '0'} đ
                  </div>
                </div>
              </div>

              {/* Cảnh báo chênh lệch */}
              {isDifferenceDetected && (
                <Alert variant="destructive" className="animate-pulse">
                  <AlertCircle className="size-4" />
                  <AlertTitle className="text-xs font-bold">Phát hiện chênh lệch doanh thu tiền mặt!</AlertTitle>
                  <AlertDescription className="text-xs">
                    Chênh lệch: <strong>{differenceAmount?.toLocaleString('vi-VN')} đ</strong>. Hệ thống bắt buộc bạn phải
                    nhập lý do chênh lệch trước khi hoàn tất đóng ca.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleCloseShiftSubmit} className="grid gap-4">
                <Field label="Nhập số tiền mặt thực tế trong ngăn kéo quầy (Y) *">
                  <Input
                    required
                    type="number"
                    className="h-11 font-mono font-bold text-base"
                    placeholder="VD: 500000"
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value)}
                  />
                </Field>

                {isDifferenceDetected && (
                  <Field label="Lý do chênh lệch doanh thu (Bắt buộc) *">
                    <Textarea
                      required
                      rows={2}
                      className="border-destructive focus-visible:ring-destructive text-xs"
                      placeholder="VD: Trả nhầm tiền thừa cho khách 10k, đổi tiền lẻ tại quầy nước..."
                      value={differenceReason}
                      onChange={(e) => setDifferenceReason(e.target.value)}
                    />
                  </Field>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 cursor-pointer"
                    onClick={() => setIsCloseShiftModalOpen(false)}
                  >
                    Hủy Bỏ
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingShift}
                    className="flex-1 font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                  >
                    {isSubmittingShift ? 'Đang đóng ca...' : 'Xác Nhận & Đăng Xuất'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          MODAL: BÁO HỎNG / BẢO TRÌ THIẾT BỊ (GIAI ĐOẠN 4)
      ===================================================================== */}
      {isMaintenanceModalOpen && selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50 duration-200">
          <Card className="w-full max-w-md border-2 border-primary/40 shadow-2xl bg-card">
            <CardHeader className="border-b bg-muted/20 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="size-5 text-primary" /> Cập Nhật Trạng Thái Thiết Bị
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 cursor-pointer"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <div className="text-xs bg-muted/30 p-3 rounded-lg border">
                <div>Thiết bị: <strong className="text-foreground">{selectedEquipment.name}</strong></div>
                <div>Mã thiết bị: <span className="font-mono">{selectedEquipment.code}</span></div>
                <div>Phòng: <span>{selectedEquipment.room.name}</span></div>
                <div>Trạng thái hiện tại: <Badge variant="outline" className="mt-1">{selectedEquipment.status}</Badge></div>
              </div>

              <Field label="Ghi chú hỏng hóc / Bảo trì (Sẽ thông báo trực tiếp đến Center Manager) *">
                <Textarea
                  rows={3}
                  placeholder="VD: Dây cáp bị tưa, bảng điều khiển nhấp nháy không lên nguồn..."
                  value={equipmentMaintenanceNote}
                  onChange={(e) => setEquipmentMaintenanceNote(e.target.value)}
                />
              </Field>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  className="flex-1 font-bold bg-primary text-primary-foreground cursor-pointer"
                  onClick={handleUpdateEquipmentStatus}
                >
                  Xác Nhận Cập Nhật
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </StaffPage>
  );
};
