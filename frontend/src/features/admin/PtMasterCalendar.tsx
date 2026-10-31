import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  Calendar,
  Sunrise,
  Sun,
  Moon,
  Coffee,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  History,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Info,
  CalendarRange,
  X,
  User,
  Wrench,
  Palmtree,
  DoorClosed,
} from 'lucide-react';

type CalendarConfig = {
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  breakMinutes: number;
};

type Closure = {
  id: number;
  startAt: string;
  endAt: string;
  kind: string;
  reason: string;
};

type CoachDay = Awaited<ReturnType<typeof api.adminTrainers.getCalendarCoaches>>[number];

const closureKinds: Record<string, { label: string; badgeClass: string; icon: any }> = {
  HOLIDAY: {
    label: 'Ngày lễ',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    icon: Palmtree,
  },
  CLOSED: {
    label: 'Đóng cửa',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-800',
    icon: DoorClosed,
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    icon: Wrench,
  },
};

const getLocalDateStr = (d = new Date()) => {
  const local = new Date(d.getTime() + 7 * 3600000);
  return local.toISOString().slice(0, 10);
};

const formatVietnamDateTime = (isoStr: string) => {
  return new Date(isoStr).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function PtMasterCalendar() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'coaches' | 'requests' | 'audit'>('schedule');

  // Master schedule state
  const [calendar, setCalendar] = useState<CalendarConfig>({
    openTime: '06:00',
    closeTime: '22:00',
    slotMinutes: 60,
    breakMinutes: 0,
  });
  const [masterSlots, setMasterSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [closures, setClosures] = useState<Closure[]>([]);

  // Closure Form state
  const [kind, setKind] = useState<'HOLIDAY' | 'CLOSED' | 'MAINTENANCE'>('HOLIDAY');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');

  // Coach Calendar state
  const [coaches, setCoaches] = useState<CoachDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(getLocalDateStr());

  // Change requests state
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof api.adminTrainers.getCalendarChangeRequests>>>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  // Audit logs state
  const [audit, setAudit] = useState<Array<{ id: number; action: string; createdAt: string; user: { fullName: string } }>>([]);

  // Status message
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [master, coachRows, logs, changes] = await Promise.all([
        api.adminTrainers.getCalendar(),
        api.adminTrainers.getCalendarCoaches(selectedDate),
        api.adminTrainers.getCalendarAudit(),
        api.adminTrainers.getCalendarChangeRequests(),
      ]);
      setCalendar(master.calendar);
      setMasterSlots(master.slots);
      setClosures(master.closures);
      setCoaches(coachRows);
      setAudit(logs);
      setRequests(changes);
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Không thể tải dữ liệu lịch PT.',
        type: 'error',
      });
    }
  };

  useEffect(() => {
    void refresh();
  }, [selectedDate]);

  const save = async (action: () => Promise<unknown>, successMsg = 'Đã cập nhật lịch thành công.') => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await refresh();
      setNotice({ text: successMsg, type: 'success' });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Không thể cập nhật lịch.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDateShift = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(getLocalDateStr(cur));
  };

  // Group master slots by Morning, Afternoon, Evening for scientific visualization
  const morningSlots = masterSlots.filter(s => parseInt(s.startTime.slice(0, 2)) < 12);
  const afternoonSlots = masterSlots.filter(s => {
    const hour = parseInt(s.startTime.slice(0, 2));
    return hour >= 12 && hour < 18;
  });
  const eveningSlots = masterSlots.filter(s => parseInt(s.startTime.slice(0, 2)) >= 18);

  const pendingRequestsCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarRange className="size-5 text-primary" />
            Lịch Hoạt Động & Ca Tập PT Chung
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cấu hình khung giờ mở cửa trung tâm, quản lý ngày nghỉ bảo trì và điều phối ca trực của đội ngũ Huấn luyện viên
          </p>
        </div>
      </div>

      {/* Notice / Toast Banner */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs shadow-sm transition-all ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/60 p-1">
          <TabsTrigger value="schedule" className="flex items-center gap-1.5 py-2 text-xs">
            <Clock className="size-3.5" />
            <span>Khung Giờ & Ngày Nghỉ</span>
          </TabsTrigger>
          <TabsTrigger value="coaches" className="flex items-center gap-1.5 py-2 text-xs">
            <Users className="size-3.5" />
            <span>Lịch Trực HLV</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {coaches.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-1.5 py-2 text-xs">
            <ShieldAlert className="size-3.5" />
            <span>Yêu Cầu Đổi Ca</span>
            {pendingRequestsCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5 py-2 text-xs">
            <History className="size-3.5" />
            <span>Nhật Ký Lịch</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: KHUNG GIỜ & NGÀY NGHỈ ================= */}
        <TabsContent value="schedule" className="space-y-5 pt-2">
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Cột Trái (7 cols): Giờ hoạt động & Trực quan hóa ca tập */}
            <div className="space-y-4 lg:col-span-7">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="size-4 text-primary" />
                        Khung Giờ Mở Cửa & Tạo Ca Tự Động
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Mỗi ca tập cố định 60 phút. Hệ thống tự động phân tách các slot ca theo giờ mở - đóng cửa.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Form Cấu hình giờ */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Giờ mở cửa</Label>
                      <Input
                        type="time"
                        className="text-xs"
                        value={calendar.openTime}
                        onChange={e => setCalendar(c => ({ ...c, openTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Giờ đóng cửa</Label>
                      <Input
                        type="time"
                        className="text-xs"
                        value={calendar.closeTime}
                        onChange={e => setCalendar(c => ({ ...c, closeTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <span>Nghỉ giữa ca</span>
                        <span className="text-[10px] text-muted-foreground">(phút)</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        step={5}
                        className="text-xs"
                        value={calendar.breakMinutes}
                        onChange={e => setCalendar(c => ({ ...c, breakMinutes: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  {/* Nút Lưu Lịch */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      * Thời gian nghỉ = 0 phút: các ca 60 phút diễn ra liên tục.
                    </p>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void save(() => api.adminTrainers.saveCalendar(calendar), 'Đã cập nhật khung giờ hoạt động.')}
                      className="gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Lưu Khung Giờ
                    </Button>
                  </div>

                  {/* Trực Quan Hóa Timeline Ca Tập Trong Ngày (Visual Slot Schedule) */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span>Danh Sách Ca Chuẩn Áp Dụng</span>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {masterSlots.length} ca / ngày
                        </Badge>
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        Coach sẽ đăng ký khung giờ rảnh theo các ca này
                      </span>
                    </div>

                    {/* Phân nhóm ca sáng / chiều / tối */}
                    <div className="space-y-3">
                      {/* Ca Sáng */}
                      {morningSlots.length > 0 && (
                        <div className="rounded-lg border bg-amber-50/30 p-2.5 dark:bg-amber-950/10">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
                            <Sunrise className="size-3.5" />
                            <span>Buổi Sáng ({morningSlots.length} ca)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {morningSlots.map((slot, idx) => (
                              <span
                                key={slot.startTime}
                                className="inline-flex items-center rounded-md border border-amber-200/80 bg-background px-2 py-1 text-xs font-medium text-foreground shadow-2xs"
                              >
                                {slot.startTime} – {slot.endTime}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ca Chiều */}
                      {afternoonSlots.length > 0 && (
                        <div className="rounded-lg border bg-sky-50/30 p-2.5 dark:bg-sky-950/10">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300 mb-2">
                            <Sun className="size-3.5" />
                            <span>Buổi Chiều ({afternoonSlots.length} ca)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {afternoonSlots.map((slot, idx) => (
                              <span
                                key={slot.startTime}
                                className="inline-flex items-center rounded-md border border-sky-200/80 bg-background px-2 py-1 text-xs font-medium text-foreground shadow-2xs"
                              >
                                {slot.startTime} – {slot.endTime}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ca Tối */}
                      {eveningSlots.length > 0 && (
                        <div className="rounded-lg border bg-indigo-50/30 p-2.5 dark:bg-indigo-950/10">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 dark:text-indigo-300 mb-2">
                            <Moon className="size-3.5" />
                            <span>Buổi Tối ({eveningSlots.length} ca)</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {eveningSlots.map((slot, idx) => (
                              <span
                                key={slot.startTime}
                                className="inline-flex items-center rounded-md border border-indigo-200/80 bg-background px-2 py-1 text-xs font-medium text-foreground shadow-2xs"
                              >
                                {slot.startTime} – {slot.endTime}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cột Phải (5 cols): Ngày nghỉ lễ / Bảo trì */}
            <div className="space-y-4 lg:col-span-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Wrench className="size-4 text-primary" />
                    Lịch Nghỉ Lễ & Bảo Trì Trung Tâm
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Khoảng thời gian đóng cửa tạm thời. Hệ thống tự động ngăn chặn việc đặt lịch PT trùng giờ.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {/* Chọn loại đóng cửa */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Lý do đóng cửa</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['HOLIDAY', 'CLOSED', 'MAINTENANCE'] as const).map(k => {
                        const conf = closureKinds[k];
                        const Icon = conf.icon;
                        const isSelected = kind === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKind(k)}
                            className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                : 'border-input bg-background hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            <Icon className="size-3.5" />
                            <span>{conf.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Thời gian Từ -> Đến */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Từ thời điểm</Label>
                      <Input
                        type="datetime-local"
                        className="text-xs"
                        value={start}
                        onChange={e => setStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Đến thời điểm</Label>
                      <Input
                        type="datetime-local"
                        className="text-xs"
                        value={end}
                        onChange={e => setEnd(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Mô tả chi tiết */}
                  <div className="space-y-1">
                    <Label className="text-xs">Ghi chú cụ thể</Label>
                    <Input
                      placeholder="VD: Nghỉ Tết Nguyên Đán, Bảo trì sàn tập tạ..."
                      className="text-xs"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                    />
                  </div>

                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={busy || !start || !end || !reason.trim()}
                    onClick={() =>
                      void save(
                        () =>
                          api.adminTrainers.addClosure({
                            startAt: new Date(`${start}:00+07:00`).toISOString(),
                            endAt: new Date(`${end}:00+07:00`).toISOString(),
                            kind,
                            reason,
                          }),
                        'Đã thêm lịch nghỉ/bảo trì.'
                      ).then(() => {
                        setReason('');
                        setStart('');
                        setEnd('');
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                    Thêm Lịch Đóng Cửa
                  </Button>

                  {/* Danh sách các đợt nghỉ đã thiết lập */}
                  <div className="border-t pt-3 space-y-2">
                    <h4 className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Lịch nghỉ đã thiết lập</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {closures.length} đợt
                      </Badge>
                    </h4>

                    {closures.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Chưa có lịch nghỉ hoặc bảo trì nào sắp tới.
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {closures.map(c => {
                          const conf = closureKinds[c.kind] || closureKinds.CLOSED;
                          const Icon = conf.icon;
                          return (
                            <div
                              key={c.id}
                              className="flex items-start justify-between gap-2 rounded-lg border bg-muted/20 p-2.5 text-xs transition-colors hover:bg-muted/40"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.2 text-[10px] font-semibold ${conf.badgeClass}`}
                                  >
                                    <Icon className="size-3" />
                                    {conf.label}
                                  </span>
                                  <strong className="text-foreground">{c.reason}</strong>
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-3" />
                                  <span>
                                    {formatVietnamDateTime(c.startAt)} → {formatVietnamDateTime(c.endAt)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  confirm(`Xóa lịch nghỉ "${c.reason}"?`) &&
                                  void save(() => api.adminTrainers.removeClosure(c.id), 'Đã xóa lịch nghỉ.')
                                }
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 2: LỊCH TRỰC CỦA TẤT CẢ COACH ================= */}
        <TabsContent value="coaches" className="space-y-4 pt-2">
          {/* Date Selector Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setSelectedDate(getLocalDateStr())}
              >
                Hôm Nay
              </Button>
              <div className="flex items-center rounded-md border bg-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleDateShift(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="h-8 w-36 border-0 bg-transparent text-xs text-center font-medium shadow-none focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleDateShift(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* Quick Legend */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" /> Ca Trống (Đón Khách)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500" /> Đã Có Hội Viên Đặt
              </span>
            </div>
          </div>

          {/* Coach Grid List */}
          {coaches.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground">
              Không có dữ liệu Huấn luyện viên cho ngày đã chọn.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map(coach => {
                const totalSlots = coach.slots.length;
                const bookedSlots = coach.slots.filter(s => s.booking !== null).length;
                const freeSlots = totalSlots - bookedSlots;
                const unalignedBookings = coach.bookings.filter(b => !coach.slots.some(s => s.booking?.id === b.id));

                return (
                  <Card key={coach.coachId} className="shadow-xs overflow-hidden flex flex-col justify-between">
                    <div>
                      <CardHeader className="py-2.5 px-3.5 bg-muted/30 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                              {coach.coachName.slice(0, 1)}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground leading-tight">{coach.coachName}</p>
                              <p className="text-[10px] text-muted-foreground">{coach.coachStatus || 'HLV Cá Nhân'}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {bookedSlots}/{totalSlots} ca đã đặt
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {totalSlots === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-3 text-center">
                            Chưa đăng ký khung giờ rảnh hôm nay.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {coach.slots.map(slot => (
                              <div
                                key={slot.startTime}
                                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                                  slot.booking
                                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 shadow-2xs'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <span>{slot.startTime}–{slot.endTime}</span>
                                </div>
                                {slot.booking && (
                                  <p className="text-[10px] font-normal truncate max-w-28 text-amber-800 dark:text-amber-300">
                                    👤 {slot.booking.member.fullName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Unaligned bookings warning */}
                        {unalignedBookings.length > 0 && (
                          <div className="mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                            <p className="font-semibold flex items-center gap-1">
                              <AlertTriangle className="size-3 text-rose-600" />
                              Ca ngoài lịch đăng ký:
                            </p>
                            {unalignedBookings.map(b => (
                              <p key={b.id} className="text-[10px]">
                                • Booking #{b.id} lúc {new Date(b.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({b.memberName})
                              </p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 3: YÊU CẦU ĐỔI CA / BÁO VẮNG ================= */}
        <TabsContent value="requests" className="space-y-4 pt-2">
          <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="flex items-start gap-2">
              <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-semibold">Quy trình xử lý Báo vắng & Đổi ca của Huấn luyện viên</p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  Ca tập đã có hội viên đặt chỉ được phép thay đổi sau khi Quản trị viên duyệt. Khi Admin bấm <strong>"Duyệt Báo Vắng"</strong>, hệ thống sẽ tự động cấp quyền đặt ca học bù cho Hội viên tương ứng.
                </p>
              </div>
            </div>
          </div>

          {requests.filter(r => r.status === 'PENDING').length === 0 ? (
            <Card className="shadow-xs">
              <CardContent className="py-12 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="font-medium text-sm text-foreground">Không có yêu cầu chờ xử lý</p>
                <p className="mt-1">Hiện tại không có HLV nào gửi yêu cầu đổi ca hoặc báo vắng.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests
                .filter(r => r.status === 'PENDING')
                .map(row => (
                  <Card key={row.id} className="border-amber-200/80 shadow-sm">
                    <CardHeader className="py-3 px-4 bg-amber-50/30 border-b">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-100/60 text-xs">
                            Yêu Cầu #{row.id}
                          </Badge>
                          <span className="font-semibold text-xs text-foreground">
                            {row.coachName || `Coach #${row.coachId}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {row.startTime ? formatVietnamDateTime(row.startTime) : ''}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="text-muted-foreground">Hội viên ảnh hưởng:</span>{' '}
                          <strong className="text-foreground">{row.memberName || `Booking #${row.bookingId}`}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lý do báo vắng:</span>{' '}
                          <span className="italic text-foreground">"{row.reason}"</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t">
                        <Label className="text-xs">Ghi chú phản hồi cho HLV (sẽ gửi thông báo)</Label>
                        <Input
                          placeholder="Nhập ghi chú xử lý..."
                          className="h-8 text-xs"
                          value={reviewNotes[row.id] || ''}
                          onChange={e =>
                            setReviewNotes(curr => ({ ...curr, [row.id]: e.target.value }))
                          }
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void save(
                              () =>
                                api.adminTrainers.resolveCalendarChangeRequest(
                                  row.id,
                                  'REJECTED',
                                  reviewNotes[row.id] || 'Yêu cầu không được phê duyệt'
                                ),
                              'Đã từ chối yêu cầu đổi ca.'
                            )
                          }
                          className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <XCircle className="size-3.5 mr-1" />
                          Từ Chối
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void save(
                              () =>
                                api.adminTrainers.resolveCalendarChangeRequest(
                                  row.id,
                                  'APPROVED',
                                  reviewNotes[row.id] || 'Đã duyệt báo vắng và cấp quyền học bù'
                                ),
                              'Đã duyệt báo vắng thành công.'
                            )
                          }
                          className="h-8 text-xs gap-1"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Duyệt Báo Vắng (Cấp Học Bù)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 4: NHẬT KÝ BIẾN ĐỘNG LỊCH ================= */}
        <TabsContent value="audit" className="space-y-4 pt-2">
          <Card className="shadow-xs">
            <CardHeader className="py-3 px-4 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <History className="size-4 text-primary" />
                Nhật Ký Kiểm Toán Thay Đổi Lịch (Audit Trail)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {audit.length === 0 ? (
                <p className="text-xs text-muted-foreground p-6 text-center">Chưa có bản ghi nhật ký nào.</p>
              ) : (
                <div className="divide-y text-xs max-h-96 overflow-y-auto">
                  {audit.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">{log.action}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Thực hiện bởi: <strong className="text-foreground">{log.user?.fullName || 'Hệ thống'}</strong>
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatVietnamDateTime(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
