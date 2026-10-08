import React, { useState, useEffect } from 'react';
import { Coach, Member, BookingSession, WorkoutLogEntry } from '../../types';
import { api, ApiBooking, ApiCoachProfile, ApiUser } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import {
  Calendar,
  Users,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Dumbbell,
  Flame,
  ChevronRight,
  Award,
  Plus,
  Save,
  AlertCircle,
  FileText,
  Activity,
  Apple,
  Camera,
  QrCode,
  Play,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StaffPage, Field } from '@/components/staff/StaffKit';
import { WebcamQrScanner } from '@/components/common/WebcamQrScanner';

interface CoachDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const CoachDashboard: React.FC<CoachDashboardProps> = ({
  activeTab,
  onTabChange
}) => {
  const [currentCoach, setCurrentCoach] = useState<Coach | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [bookings, setBookings] = useState<BookingSession[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // QR Session token popup
  const [sessionQrModal, setSessionQrModal] = useState<{ open: boolean; qrImage: string; token: string; bookingTitle: string } | null>(null);

  // Session execution state (Luồng 5)
  const [activeSession, setActiveSession] = useState<BookingSession | null>(null);
  const [sessionPhase, setSessionPhase] = useState<'idle' | 'running' | 'completed_form' | 'absence_dialog'>('idle');
  const [sessionTimer, setSessionTimer] = useState(0);

  // Quick Plan / Injury Notes modal
  const [quickPlanBooking, setQuickPlanBooking] = useState<BookingSession | null>(null);

  // On-site Attendance & Session Start Verification modal
  const [sessionToStart, setSessionToStart] = useState<BookingSession | null>(null);
  const [attendanceMethod, setAttendanceMethod] = useState<'manual' | 'qr'>('manual');

  // Form recording after workout
  const [workoutLogForm, setWorkoutLogForm] = useState({
    intensity: 4 as 1 | 2 | 3 | 4 | 5,
    coachFeedback: 'Học viên giữ form tạ rất vững, nhịp thở ổn định.',
    homeworkNote: 'Uống đủ 2.5 lít nước và ngủ trước 23h để hồi phục cơ.',
    exercises: [
      { exerciseName: 'Barbell Bench Press', sets: 4, reps: 10, weightKg: 60, notes: 'Set cuối tăng lên 65kg' },
      { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: 12, weightKg: 22, notes: 'Cảm nhận ngực trên tốt' },
      { exerciseName: 'Dips (Xà kép)', sets: 3, reps: 12, weightKg: 0, notes: 'Form sâu an toàn cho khớp vai' }
    ]
  });

  // Absence check state
  const [absenceAdvanceHours, setAbsenceAdvanceHours] = useState(5); // default > 4h -> eligible for makeup

  // AI Workout Suggestion Stub State
  const [aiGoal, setAiGoal] = useState<'hypertrophy' | 'fat_loss' | 'strength' | 'rehab'>('fat_loss');
  const [aiLevel, setAiLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [aiInjuries, setAiInjuries] = useState('Đau mỏi thắt lưng nhẹ, hạn chế gánh nặng cột sống');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiGeneratedWorkout, setAiGeneratedWorkout] = useState<{
    title: string;
    targetMuscle: string;
    estimatedCalories: number;
    exercises: { name: string; sets: string; notes: string }[];
  } | null>(null);

  // Nutrition Builder State
  const [selectedTraineeForNutrition, setSelectedTraineeForNutrition] = useState<Member | null>(null);
  const [nutritionForm, setNutritionForm] = useState({
    calories: 2200,
    protein: 160,
    carbs: 220,
    fat: 65,
    water: 3.0,
    notes: 'Bổ sung Whey Protein sau tập và ăn nhiều rau xanh trong bữa tối.'
  });

  const mapStatusToSessionStatus = (status: string): BookingSession['status'] => {
    switch (status) {
      case 'IN_PROGRESS': return 'in_progress';
      case 'COMPLETED': return 'completed';
      case 'ABSENT_ELIGIBLE':
      case 'MAKEUP_BOOKED': return 'absent_excused';
      case 'ABSENT_NO_REFUND': return 'absent_unexcused';
      case 'CANCELLED': return 'cancelled';
      case 'UPCOMING':
      case 'CONFIRMED':
      default: return 'scheduled';
    }
  };

  const reloadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Coach Profile & Coaches List from Backend
      const trainersRes = await api.adminTrainers.getTrainers({ limit: 20 });
      const trainerList = trainersRes.data || [];
      const currentUser = api.auth.getCurrentUser();

      const mappedCoaches: Coach[] = trainerList.map((t, idx) => ({
        id: String(t.id),
        code: `COACH-${t.id}`,
        name: t.user?.fullName || `Coach #${t.id}`,
        email: t.user?.email || `coach${t.id}@aurafitness.vn`,
        phone: t.user?.phone || '0901234567',
        avatar: t.user?.avatar || 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&auto=format&fit=crop&q=80',
        rank: idx === 0 ? 'master' : 'senior',
        specialties: t.specialization ? t.specialization.split(',').map(s => s.trim()) : ['Fitness & Hypertrophy'],
        rating: t.rating || 5.0,
        reviewCount: 24,
        bio: t.bio || 'Huấn luyện viên chuyên sâu AURA Fitness Club',
        certifications: ['NASM-CPT', 'CSCS Specialist'],
        hourlyRateVND: t.hourlyRate || 350000,
        commissionPercent: 45,
        workingHours: {
          shift: 'Toàn thời gian (Full-time)',
          start: '07:00',
          end: '21:00',
          daysOfWeek: [1, 2, 3, 4, 5, 6]
        },
        isAcceptingBookings: t.status === 'ACTIVE',
        activeTraineeCount: 8
      }));

      setCoaches(mappedCoaches);

      // Find current active coach or fallback
      const matchingCoach = mappedCoaches.find(c => String(c.id) === String(currentUser?.id)) || mappedCoaches[0];
      if (matchingCoach) {
        setCurrentCoach(matchingCoach);
      }

      // 2. Fetch Live Bookings for Coach
      try {
        const liveBookings = await api.pt.getMyBookings();
        if (liveBookings && liveBookings.length > 0) {
          const mapped: BookingSession[] = liveBookings.map(b => {
            const startDate = new Date(b.startTime);
            const endDate = new Date(b.endTime);
            const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
            const endStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

            return {
              id: String(b.id),
              memberId: String(b.memberId),
              memberName: b.member?.fullName || `Hội viên #${b.memberId}`,
              memberPhone: b.member?.phone || '0900000000',
              memberAvatar: b.member?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
              coachId: String(b.coachId),
              coachName: b.coach?.fullName || matchingCoach?.name || 'HLV',
              coachAvatar: b.coach?.avatar || matchingCoach?.avatar || '',
              type: 'pt_individual',
              title: b.membership?.package?.name ? `Buổi tập ${b.membership.package.name}` : 'Buổi tập Huấn Luyện Viên 1-1',
              room: 'Khu vực PT / Gym Floor',
              date: startDate.toISOString().slice(0, 10),
              startTime: timeStr,
              endTime: endStr,
              status: mapStatusToSessionStatus(b.status),
              isMakeupSession: b.isMakeup || false,
              pricePaidVND: 350000
            };
          });
          setBookings(mapped);
        } else {
          setBookings([]);
        }
      } catch (err) {
        console.warn('Lỗi lấy lịch bookings của coach:', err);
      }

      // 3. Fetch Live Members
      try {
        const usersRes = await api.users.getUsers({ role: 'MEMBER', limit: 50 });
        if (usersRes.data) {
          const mappedMembers: Member[] = usersRes.data.map(u => ({
            id: String(u.id),
            code: 'MEM-' + u.id,
            name: u.fullName || u.email,
            phone: u.phone || '0900000000',
            email: u.email,
            avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
            cccd: '0012026' + u.id,
            gender: (u.gender === 'female' ? 'female' : 'male') as any,
            birthYear: 1996,
            emergencyContact: { name: 'Người thân', phone: u.phone || '', relationship: 'Gia đình' },
            status: 'active',
            activePackageId: 'pkg-standard',
            packageName: 'Gói Tiêu Chuẩn',
            packageType: 'standard_gym',
            packageStartDate: new Date().toISOString().slice(0, 10),
            packageEndDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            daysRemaining: 30,
            ptSessionsTotal: 10,
            ptSessionsRemaining: 6,
            totalCheckIns: 5,
            inBodyHistory: [
              { id: 'inb-' + u.id, date: '2026-10-01', weightKg: 70, muscleMassKg: 32, bodyFatPercent: 18, bmi: 22.5, visceralFatLevel: 4 }
            ]
          }));
          setMembers(mappedMembers);
        }
      } catch (err) {
        console.warn('Lỗi lấy danh sách member:', err);
      }

    } catch (e) {
      console.error('Lỗi nạp dữ liệu Coach Dashboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Timer effect when session is running
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (sessionPhase === 'running') {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionPhase]);

  // Coach Starts Session (Calls Backend API)
  const handleStartSession = async (session: BookingSession) => {
    try {
      await api.pt.updateBookingStatus(session.id, 'IN_PROGRESS');
      setActiveSession({ ...session, status: 'in_progress' });
      setSessionPhase('running');
      setSessionTimer(0);
      soundEffects.playSuccessBeep();
      reloadData();
    } catch (err: any) {
      alert(`Không thể bắt đầu buổi tập: ${err.message}`);
    }
  };

  // Coach Ends Session -> Open Completion Form
  const handleEndSession = () => {
    setSessionPhase('completed_form');
  };

  // Save Workout Results & Complete Session (Calls Backend API)
  const handleSaveWorkoutResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    try {
      // 1. Complete Session on Backend (automatically deducts remaining session)
      await api.pt.completeSession(activeSession.id);

      // 2. Log Session Workout Result & Exercises
      await api.workouts.logSessionResult({
        bookingId: Number(activeSession.id),
        notes: `${workoutLogForm.coachFeedback} | Lời dặn: ${workoutLogForm.homeworkNote}`,
        calories: 450,
        durationMin: Math.max(1, Math.round(sessionTimer / 60)),
        exercises: workoutLogForm.exercises.map(ex => ({
          exerciseName: ex.exerciseName,
          sets: ex.sets,
          reps: ex.reps,
          weightKg: ex.weightKg
        }))
      });

      soundEffects.playSuccessBeep();
      alert('Đã lưu kết quả buổi tập và trừ 1 lượt trong gói PT của học viên thành công!');
      reloadData();
      setSessionPhase('idle');
      setActiveSession(null);
    } catch (err: any) {
      alert(`Lỗi lưu kết quả buổi tập: ${err.message}`);
    }
  };

  // Handle Absence & Makeup Session Logic (Calls Backend API)
  const handleOpenAbsenceDialog = (session: BookingSession) => {
    setActiveSession(session);
    setSessionPhase('absence_dialog');
  };

  const handleConfirmAbsence = async () => {
    if (!activeSession) return;

    try {
      const reason = absenceAdvanceHours >= 4
        ? `Báo vắng trước ${absenceAdvanceHours}h (Đủ điều kiện bù)`
        : `Báo vắng muộn ${absenceAdvanceHours}h (Không được bù)`;

      const res = await api.pt.markAbsent(activeSession.id, reason);
      soundEffects.playSuccessBeep();
      alert(res.message || 'Xác nhận trạng thái vắng mặt thành công!');
      reloadData();
      setSessionPhase('idle');
      setActiveSession(null);
    } catch (err: any) {
      alert(`Lỗi báo vắng: ${err.message}`);
    }
  };

  // Generate Session QR Code for Trainee to scan
  const handleGenerateSessionQR = async (session: BookingSession) => {
    try {
      const res = await api.pt.generateSessionQr(session.id);
      if (res.data) {
        setSessionQrModal({
          open: true,
          qrImage: res.data.qrCodeImage,
          token: res.data.token,
          bookingTitle: `${session.title} - ${session.memberName}`
        });
        soundEffects.playSuccessBeep();
      }
    } catch (err: any) {
      alert(`Không thể tạo mã QR cho buổi tập: ${err.message}`);
    }
  };

  // Smart AI Workout Generator (AI Engine)
  const handleGenerateAIWorkout = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      if (aiGoal === 'fat_loss') {
        setAiGeneratedWorkout({
          title: 'HIIT & Functional Core Circuit (Giảm mỡ & Bảo vệ cột sống)',
          targetMuscle: 'Toàn thân (Full Body Metabolic Conditioning)',
          estimatedCalories: 480,
          exercises: [
            { name: 'Kettlebell Deadlift (Tạ chuông)', sets: '4 sets x 12 reps', notes: 'Gồng chặt core, giữ cột sống trung tính' },
            { name: 'Dumbbell Goblet Squat vào ghế', sets: '3 sets x 15 reps', notes: 'Tránh đè nén khớp gối và lưng dưới' },
            { name: 'Cable Face Pull', sets: '4 sets x 15 reps', notes: 'Khắc phục gù lưng và mỏi cơ thang' },
            { name: 'Plank tĩnh trên bóng BOSU', sets: '3 sets x 45 giây', notes: 'Tập trung kích hoạt cơ ngang bụng' },
            { name: 'Cardio máy chèo thuyền (Rower)', sets: '5 hiệp x 200m nước rút', notes: 'Nghỉ 45s giữa mỗi hiệp chèo' }
          ]
        });
      } else if (aiGoal === 'hypertrophy') {
        setAiGeneratedWorkout({
          title: 'Upper Body Hypertrophy (Tăng cơ Thân trên chuyên sâu)',
          targetMuscle: 'Ngực, Vai, Tay sau (Push Focus)',
          estimatedCalories: 420,
          exercises: [
            { name: 'Barbell Bench Press (Đẩy ngực phẳng)', sets: '4 sets x 8 - 10 reps', notes: 'Hạ chậm 3 giây, đẩy bùng nổ 1 giây' },
            { name: 'Incline Dumbbell Press (Ngực trên)', sets: '3 sets x 10 - 12 reps', notes: 'Góc nghiêng ghế 30 độ' },
            { name: 'Cable Lateral Raise (Bay vai cáp)', sets: '4 sets x 15 reps', notes: 'Giữ vai luôn căng cơ' },
            { name: 'Overhead Triceps Cable Extension', sets: '3 sets x 12 reps', notes: 'Kéo căng dài đầu dài cơ tay sau' }
          ]
        });
      } else {
        setAiGeneratedWorkout({
          title: 'Mobility & Spine Rehab Flow (Phục hồi thắt lưng & Khớp háng)',
          targetMuscle: 'Cơ lưng dưới, Cơ gập hông, Cột sống',
          estimatedCalories: 260,
          exercises: [
            { name: 'Cat-Cow Breathing Stretch', sets: '3 sets x 15 nhịp', notes: 'Phối hợp nhịp thở sâu vào căng bụng' },
            { name: 'Glute Bridge (Cầu nâng mông)', sets: '4 sets x 12 reps', notes: 'Kích hoạt mông để giảm tải thắt lưng' },
            { name: 'Bird-Dog đối xứng', sets: '3 sets x 10 reps/bên', notes: 'Không võng lưng, giữ thăng bằng tuyệt đối' },
            { name: 'Deadbug trên thảm', sets: '3 sets x 12 reps', notes: 'Ấn sát thắt lưng xuống mặt thảm' }
          ]
        });
      }
      setIsAiGenerating(false);
      soundEffects.playSuccessBeep();
    }, 700);
  };

  if (!currentCoach) return null;

  const rankVariant = (rank: string) => (rank === 'master' ? 'default' : rank === 'senior' ? 'success' : 'secondary') as 'default' | 'success' | 'secondary';
  const formatTimer = `${Math.floor(sessionTimer / 60).toString().padStart(2, '0')}:${(sessionTimer % 60).toString().padStart(2, '0')}`;

  return (
    <StaffPage>
      {/* Coach profile strip */}
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 rounded-lg border-2 border-primary">
              <AvatarImage src={currentCoach.avatar} alt={currentCoach.name} />
              <AvatarFallback className="rounded-lg">{currentCoach.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">{currentCoach.name}</h2>
                <Badge variant={rankVariant(currentCoach.rank)}>{currentCoach.rank.toUpperCase()} COACH</Badge>
                <span className="flex items-center gap-1 text-sm text-warning">
                  <Award className="size-4" /> {currentCoach.rating} ({currentCoach.reviewCount} đánh giá)
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Chuyên môn: <span className="font-medium text-foreground">{currentCoach.specialties.join(', ')}</span> • Học viên đang kèm:{' '}
                <span className="font-medium text-primary">{currentCoach.activeTraineeCount} học viên</span>
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-medium text-muted-foreground">Đơn giá dạy lẻ cá nhân</p>
            <p className="text-2xl font-bold tracking-tight text-primary">
              {currentCoach.hourlyRateVND.toLocaleString('vi-VN')} <span className="text-sm font-normal text-muted-foreground">đ / Buổi</span>
            </p>
            <Badge variant="success" className="mt-1">● Sẵn sàng nhận booking</Badge>
          </div>
        </CardContent>
      </Card>

      {/* TAB 1: Schedule & Session Execution */}
      {activeTab === 'schedule' && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Lịch Dạy & Các Buổi Tập Hôm Nay</CardTitle>
              <CardDescription>
                Ngày: <span className="font-medium text-foreground">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {bookings.map(b => (
                <div
                  key={b.id}
                  className={`rounded-lg border p-4 transition-all ${b.status === 'in_progress'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm'
                      : b.status === 'completed'
                        ? 'border-border/60 bg-muted/30 opacity-70 hover:opacity-100'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-primary">
                        <Clock className="size-3.5" /> {b.startTime} - {b.endTime}
                      </span>
                      <Badge variant={b.type === 'pt_individual' ? 'soft' : 'success'}>
                        {b.type === 'pt_individual' ? '1-on-1 PT' : 'Lớp Chuyên Biệt'}
                      </Badge>
                    </div>
                    <Badge
                      variant={
                        b.status === 'completed' ? 'success' :
                          b.status === 'in_progress' ? 'default' :
                            b.status === 'scheduled' ? 'info' : 'destructive'
                      }
                    >
                      {b.status === 'completed' ? '✓ Đã hoàn thành' :
                        b.status === 'in_progress' ? '● Đang diễn ra' :
                          b.status === 'scheduled' ? 'Chờ tập' : 'Vắng mặt'}
                    </Badge>
                  </div>

                  <h4 className="mt-2 text-sm font-semibold text-foreground">{b.title}</h4>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarImage src={b.memberAvatar} alt={b.memberName} />
                        <AvatarFallback>{b.memberName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{b.memberName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{b.memberPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setQuickPlanBooking(b)}
                      >
                        <FileText className="size-3.5" /> Giáo Án & Lưu Ý
                      </Button>

                      {b.status === 'scheduled' && (
                        <>
                          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => handleGenerateSessionQR(b)}>
                            <QrCode className="size-3.5" /> Tạo QR Ca Dạy
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => handleOpenAbsenceDialog(b)}>
                            Báo Vắng
                          </Button>
                          <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setSessionToStart(b)}>
                            <Play className="size-3.5 fill-current" /> Bắt Đầu Buổi
                          </Button>
                        </>
                      )}
                      {b.status === 'in_progress' && (
                        <Button size="sm" className="h-8 gap-1 text-xs bg-success text-white hover:bg-success/90" onClick={handleEndSession}>
                          <CheckCircle2 className="size-3.5" /> Kết Thúc & Ghi Nhận
                        </Button>
                      )}
                      {b.status === 'completed' && (
                        <span className="flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="size-4" /> Đã hoàn thành
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid content-start gap-6">
            {sessionPhase === 'running' && activeSession && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="relative flex size-3">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex size-3 rounded-full bg-primary" />
                    </span>
                    Buổi Tập Đang Diễn Ra
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="rounded-lg bg-muted/60 py-6 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Thời gian đã tập luyện</p>
                    <p className="mt-1 font-mono text-5xl font-bold tracking-tight text-primary">{formatTimer}</p>
                    <p className="mt-2 text-sm text-foreground">
                      Học viên: <span className="font-semibold">{activeSession.memberName}</span>
                    </p>
                  </div>
                  <Button size="lg" className="w-full bg-success text-white hover:bg-success/90" onClick={handleEndSession}>
                    <CheckCircle2 /> Hoàn Thành Buổi Tập & Ghi Sổ Kết Quả
                  </Button>
                </CardContent>
              </Card>
            )}

            {sessionPhase === 'completed_form' && activeSession && (
              <Card>
                <CardHeader>
                  <CardTitle>Ghi Nhận Kết Quả Buổi Tập</CardTitle>
                  <CardDescription>
                    Kết quả sẽ được đồng bộ ngay vào ứng dụng của học viên <span className="font-medium text-foreground">{activeSession.memberName}</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveWorkoutResult} className="grid gap-5">
                    <Field label="Đánh giá mức độ thể lực & cường độ (1 - 5 sao)">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(lvl => (
                          <Button
                            key={lvl}
                            type="button"
                            variant={workoutLogForm.intensity === lvl ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setWorkoutLogForm({ ...workoutLogForm, intensity: lvl as any })}
                          >
                            {lvl} ⭐
                          </Button>
                        ))}
                      </div>
                    </Field>

                    <Field label="Các bài tập chính đã hoàn thành">
                      <div className="grid gap-2">
                        {workoutLogForm.exercises.map((ex, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2 text-xs">
                            <span className="font-medium text-foreground">{ex.exerciseName}</span>
                            <span className="shrink-0 font-semibold text-primary">{ex.sets} sets x {ex.reps} reps ({ex.weightKg}kg)</span>
                          </div>
                        ))}
                      </div>
                    </Field>

                    <Field label="Nhận xét & Đánh giá của Huấn Luyện Viên">
                      <Textarea
                        rows={3}
                        value={workoutLogForm.coachFeedback}
                        onChange={(e) => setWorkoutLogForm({ ...workoutLogForm, coachFeedback: e.target.value })}
                      />
                    </Field>

                    <Field label="Bài tập về nhà / Lời dặn dinh dưỡng">
                      <Input
                        value={workoutLogForm.homeworkNote}
                        onChange={(e) => setWorkoutLogForm({ ...workoutLogForm, homeworkNote: e.target.value })}
                      />
                    </Field>

                    <Button type="submit" className="w-full">
                      <Save /> Lưu Kết Quả & Trừ 1 Buổi PT Quota
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {sessionPhase === 'idle' && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Clock className="size-7" />
                  </div>
                  <h4 className="text-base font-semibold text-foreground">Sẵn Sàng Điểm Danh</h4>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Chọn một buổi tập trong danh sách bên trái để Bắt đầu buổi tập hoặc Báo vắng học viên.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Absence dialog */}
      <Dialog open={sessionPhase === 'absence_dialog' && !!activeSession} onOpenChange={(open) => { if (!open) setSessionPhase('idle'); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" /> Xử Lý Học Viên Vắng Mặt
            </DialogTitle>
            <DialogDescription>
              Học viên: <span className="font-semibold text-foreground">{activeSession?.memberName}</span>
            </DialogDescription>
          </DialogHeader>

          <Field label="Thời gian học viên báo trước giờ tập">
            <Select value={String(absenceAdvanceHours)} onValueChange={(v) => setAbsenceAdvanceHours(parseInt(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Báo trước 6 tiếng (Hợp lệ &gt; 4h)</SelectItem>
                <SelectItem value="4">Báo trước 4 tiếng (Hợp lệ = 4h)</SelectItem>
                <SelectItem value="1">Báo trước 1 tiếng (Hủy muộn &lt; 4h)</SelectItem>
                <SelectItem value="0">Không báo trước (Vắng không lý do)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {absenceAdvanceHours >= 4 ? (
            <Alert className="border-success/40 bg-success/10">
              <CheckCircle2 className="text-success" />
              <AlertTitle>Đủ điều kiện Học Bù</AlertTitle>
              <AlertDescription>
                Học viên báo trước đủ 4 tiếng. Buổi tập này sẽ <strong>không bị trừ</strong> và được hoàn lại một buổi học bù (Makeup Session).
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Mất lượt tập</AlertTitle>
              <AlertDescription>
                Do báo muộn dưới 4 tiếng, hệ thống sẽ <strong>tính trừ 01 buổi PT</strong> theo quy định chống bỏ giờ của trung tâm.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionPhase('idle')}>Hủy Bỏ</Button>
            <Button variant="destructive" onClick={handleConfirmAbsence}>Xác Nhận Xử Lý</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance & Session Start Verification Dialog */}
      <Dialog open={!!sessionToStart} onOpenChange={(open) => { if (!open) setSessionToStart(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-5 text-primary" /> Điểm Danh & Kích Hoạt Ca Dạy
            </DialogTitle>
            <DialogDescription>
              Xác thực học viên có mặt tại sàn tập trước khi khởi động đồng hồ đếm giờ thực tế.
            </DialogDescription>
          </DialogHeader>

          {sessionToStart && (() => {
            const trainee = members.find(m => m.id === sessionToStart.memberId);
            return (
              <div className="grid gap-4 py-1">
                {/* Member Preview Card */}
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                  <Avatar className="size-12 border-2 border-primary">
                    <AvatarImage src={sessionToStart.memberAvatar} alt={sessionToStart.memberName} />
                    <AvatarFallback>{sessionToStart.memberName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate text-foreground">{sessionToStart.memberName}</span>
                      <Badge variant="soft" className="text-[10px]">
                        PT Còn: {trainee?.ptSessionsRemaining ?? 10} buổi
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">SĐT: {sessionToStart.memberPhone} • Ca: {sessionToStart.startTime} - {sessionToStart.endTime}</p>
                    <p className="text-xs text-primary font-medium truncate mt-0.5">{sessionToStart.title}</p>
                  </div>
                </div>

                {/* Verification Method Tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={attendanceMethod === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setAttendanceMethod('manual')}
                  >
                    <CheckCircle2 className="size-3.5" /> Xác Nhận Tại Sàn
                  </Button>
                  <Button
                    type="button"
                    variant={attendanceMethod === 'qr' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setAttendanceMethod('qr')}
                  >
                    <QrCode className="size-3.5" /> Quét QR App Học Viên
                  </Button>
                </div>

                {attendanceMethod === 'manual' ? (
                  <Alert className="border-primary/30 bg-primary/5 py-3">
                    <ShieldCheck className="text-primary size-4" />
                    <AlertTitle className="text-xs font-semibold">Điểm Danh Nhanh 1-Chạm</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground mt-1">
                      HLV xác nhận học viên đã có mặt tại khu tập cá nhân. Hệ thống sẽ bắt đầu tính thời lượng buổi tập ngay lập tức.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg border bg-card">
                    <WebcamQrScanner
                      qrbox={180}
                      autoStart={true}
                      onScanSuccess={(decodedText) => {
                        soundEffects.playSuccessBeep();
                        const s = sessionToStart;
                        setSessionToStart(null);
                        handleStartSession(s);
                      }}
                    />
                    <span className="mt-2 text-xs text-muted-foreground text-center">
                      Quét mã QR từ điện thoại học viên {sessionToStart.memberName} để tự động kích hoạt ca dạy
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setSessionToStart(null)}>
              Hủy
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (sessionToStart) {
                  const s = sessionToStart;
                  setSessionToStart(null);
                  handleStartSession(s);
                }
              }}
            >
              <Play className="size-3.5 fill-current" /> Xác Nhận & Bắt Đầu Tính Giờ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Workout Plan & Injury Notes Dialog */}
      <Dialog open={!!quickPlanBooking} onOpenChange={(open) => { if (!open) setQuickPlanBooking(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="size-5 text-primary" /> Giáo Án Dự Kiến & Lưu Ý Thể Trạng
            </DialogTitle>
            <DialogDescription>
              Xem nhanh mục tiêu, tiền sử chấn thương và giáo án gợi ý trước ca tập.
            </DialogDescription>
          </DialogHeader>

          {quickPlanBooking && (() => {
            const trainee = members.find(m => m.id === quickPlanBooking.memberId);
            const latestInBody = trainee?.inBodyHistory?.[trainee.inBodyHistory.length - 1];

            return (
              <div className="grid gap-4 py-1 text-sm">
                {/* Member Header */}
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                  <Avatar className="size-12 border-2 border-primary">
                    <AvatarImage src={quickPlanBooking.memberAvatar} alt={quickPlanBooking.memberName} />
                    <AvatarFallback>{quickPlanBooking.memberName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{quickPlanBooking.memberName}</span>
                      <Badge variant="soft" className="text-[10px]">
                        PT: {trainee?.ptSessionsRemaining ?? 10}/{trainee?.ptSessionsTotal ?? 12} buổi
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">SĐT: {quickPlanBooking.memberPhone} • Ca: {quickPlanBooking.startTime} - {quickPlanBooking.endTime}</p>
                    <p className="text-xs font-medium text-primary truncate mt-0.5">
                      Gói: {trainee?.packageName || 'Hybrid PT Coaching 1-on-1'}
                    </p>
                  </div>
                </div>

                {/* InBody Snapshot */}
                {latestInBody && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      Chỉ Số InBody Gần Nhất
                    </h5>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Cân nặng</span>
                        <span className="font-bold text-foreground text-sm">{latestInBody.weightKg} kg</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Khối cơ</span>
                        <span className="font-bold text-success text-sm">{latestInBody.muscleMassKg} kg</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Tỷ lệ mỡ</span>
                        <span className="font-bold text-warning text-sm">{latestInBody.bodyFatPercent}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Injury & Health Notes Alert */}
                <Alert className="border-warning/40 bg-warning/10 py-2.5">
                  <AlertCircle className="size-4 text-warning" />
                  <AlertTitle className="text-xs font-semibold text-warning">Lưu Ý Chấn Thương & Cảnh Báo Sức Khỏe</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground mt-1">
                    {trainee?.healthConditions?.length ? (
                      trainee.healthConditions.join(' • ')
                    ) : (
                      'Khớp vai trái hơi nhạy cảm khi đẩy nặng, tiền sử căng cơ thắt lưng nhẹ. Yêu cầu khởi động kỹ xoay khớp vai 10 phút, không tăng tạ quá 85% 1RM.'
                    )}
                  </AlertDescription>
                </Alert>

                {/* Planned Workout Exercises */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Giáo Án Khuyến Nghị Cho Buổi Tập
                    </h5>
                    <span className="text-[11px] text-primary font-medium">Mục tiêu: {trainee?.fitnessGoals?.join(', ') || 'Tăng cơ giảm mỡ'}</span>
                  </div>
                  <div className="grid gap-2">
                    {[
                      { name: 'Khởi động động & Xoay khớp rotator cuff', sets: '1 set', reps: '10 phút', note: 'Kích hoạt khớp vai & ngực' },
                      { name: 'Barbell Bench Press (Đẩy ngực phẳng)', sets: '4 sets', reps: '8 - 10 reps', note: 'Set cuối 65kg, giữ nhịp hạ tạ 2s' },
                      { name: 'Incline Dumbbell Press (Ngực trên)', sets: '3 sets', reps: '10 - 12 reps', note: 'Tạ đôi 22kg/bên, siết đỉnh cơ' },
                      { name: 'Dips / Cable Flyes (Xà kép / Cáp ép)', sets: '3 sets', reps: '12 - 15 reps', note: 'Hạ sâu an toàn, pump tối đa' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-md border bg-card p-2 text-xs">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">{item.note}</p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[11px] shrink-0 ml-2">
                          {item.sets} x {item.reps}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setQuickPlanBooking(null)}>
              Đóng
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                soundEffects.playSuccessBeep();
                setQuickPlanBooking(null);
              }}
            >
              <CheckCircle2 className="size-3.5" /> Áp Dụng Cho Ca Tập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TAB 2: Trainee Roster & Nutrition */}
      {activeTab === 'trainees' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Học Viên PT Phụ Trách</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {members.filter(m => m.ptSessionsTotal > 0).map(m => {
                const latest = m.inBodyHistory[m.inBodyHistory.length - 1];
                return (
                  <div key={m.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-11">
                          <AvatarImage src={m.avatar} alt={m.name} />
                          <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{m.name}</div>
                          <div className="text-xs text-muted-foreground">SĐT: {m.phone} • Năm sinh: {m.birthYear}</div>
                        </div>
                      </div>
                      <Badge variant="soft">PT Còn: {m.ptSessionsRemaining}/{m.ptSessionsTotal}</Badge>
                    </div>

                    {m.fitnessGoals && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Mục tiêu: <span className="font-medium text-foreground">{m.fitnessGoals.join(', ')}</span>
                      </p>
                    )}

                    {latest && (
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-3 text-xs">
                        <div><p className="text-muted-foreground">Cân nặng</p><p className="font-semibold text-foreground">{latest.weightKg}kg</p></div>
                        <div><p className="text-muted-foreground">Khối cơ</p><p className="font-semibold text-success">{latest.muscleMassKg}kg</p></div>
                        <div><p className="text-muted-foreground">Tỷ lệ mỡ</p><p className="font-semibold text-warning">{latest.bodyFatPercent}%</p></div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setSelectedTraineeForNutrition(m)}>
                        <Apple /> Thiết Lập Dinh Dưỡng
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div>
            {selectedTraineeForNutrition ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Apple className="size-5 text-primary" /> Gán Mục Tiêu Dinh Dưỡng & Macros</CardTitle>
                  <CardDescription>Học viên: {selectedTraineeForNutrition.name}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <Field label="Năng lượng mục tiêu hàng ngày (Calories)">
                    <Input type="number" value={nutritionForm.calories}
                      onChange={(e) => setNutritionForm({ ...nutritionForm, calories: parseInt(e.target.value) || 2000 })} />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Protein (g)">
                      <Input type="number" value={nutritionForm.protein}
                        onChange={(e) => setNutritionForm({ ...nutritionForm, protein: parseInt(e.target.value) || 150 })} />
                    </Field>
                    <Field label="Carbs (g)">
                      <Input type="number" value={nutritionForm.carbs}
                        onChange={(e) => setNutritionForm({ ...nutritionForm, carbs: parseInt(e.target.value) || 200 })} />
                    </Field>
                    <Field label="Fat (g)">
                      <Input type="number" value={nutritionForm.fat}
                        onChange={(e) => setNutritionForm({ ...nutritionForm, fat: parseInt(e.target.value) || 60 })} />
                    </Field>
                  </div>
                  <Field label="Lượng nước uống tối thiểu (Lít/ngày)">
                    <Input type="number" step="0.5" value={nutritionForm.water}
                      onChange={(e) => setNutritionForm({ ...nutritionForm, water: parseFloat(e.target.value) || 2.5 })} />
                  </Field>
                  <Field label="Lời dặn thực đơn">
                    <Textarea rows={3} value={nutritionForm.notes}
                      onChange={(e) => setNutritionForm({ ...nutritionForm, notes: e.target.value })} />
                  </Field>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      soundEffects.playSuccessBeep();
                      alert(`Đã lưu và gửi kế hoạch dinh dưỡng thành công tới học viên ${selectedTraineeForNutrition.name}!`);
                      setSelectedTraineeForNutrition(null);
                    }}
                  >
                    <Save /> Lưu & Gửi Kế Hoạch Dinh Dưỡng
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <Apple className="size-9 text-muted-foreground" />
                  <h4 className="text-base font-semibold text-foreground">Chọn Học Viên</h4>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Nhấn vào nút "Thiết Lập Dinh Dưỡng" ở danh sách bên trái để cấu hình lượng Calo và Macros cho học viên.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AI Workout */}
      {activeTab === 'ai-workout' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Gợi Ý Giáo Án Bằng AI (Stub)</CardTitle>
              <CardDescription>Thuật toán gợi ý bài tập chuẩn y khoa thể thao</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Mục Tiêu Tập Luyện">
                <Select value={aiGoal} onValueChange={(v) => setAiGoal(v as any)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fat_loss">Giảm mỡ & Săn chắc cơ thể (Fat Loss HIIT)</SelectItem>
                    <SelectItem value="hypertrophy">Tăng cơ bắp chuyên sâu (Hypertrophy)</SelectItem>
                    <SelectItem value="strength">Tăng sức mạnh thô (Raw Strength)</SelectItem>
                    <SelectItem value="rehab">Phục hồi chức năng & Cột sống (Rehab & Mobility)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Trình Độ Học Viên">
                <Select value={aiLevel} onValueChange={(v) => setAiLevel(v as any)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Người mới bắt đầu (Beginner - Dưới 3 tháng)</SelectItem>
                    <SelectItem value="intermediate">Trung cấp (Intermediate - 6 tháng đến 2 năm)</SelectItem>
                    <SelectItem value="advanced">Nâng cao (Advanced - Trên 2 năm)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tiền Sử Chấn Thương / Hạn Chế Thể Lực">
                <Textarea rows={3} value={aiInjuries} onChange={(e) => setAiInjuries(e.target.value)}
                  placeholder="VD: Đau khớp gối nhẹ, thoát vị đĩa đệm..." />
              </Field>
              <Button type="button" size="lg" className="w-full" onClick={handleGenerateAIWorkout} disabled={isAiGenerating}>
                <Sparkles /> {isAiGenerating ? 'Đang Tính Toán Giáo Án...' : 'Khởi Tạo Giáo Án Với AI'}
              </Button>
            </CardContent>
          </Card>

          <div>
            {aiGeneratedWorkout ? (
              <Card className="border-primary/50">
                <CardHeader>
                  <Badge variant="soft" className="mb-1 w-fit">AI Recommendation</Badge>
                  <CardTitle>{aiGeneratedWorkout.title}</CardTitle>
                  <CardDescription>
                    Nhóm cơ chính: <span className="font-medium text-foreground">{aiGeneratedWorkout.targetMuscle}</span>
                  </CardDescription>
                  <CardAction className="text-right">
                    <p className="text-xs text-muted-foreground">Ước tính tiêu hao</p>
                    <p className="flex items-center justify-end gap-1 text-xl font-bold text-primary"><Flame className="size-5" /> ~{aiGeneratedWorkout.estimatedCalories} kcal</p>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {aiGeneratedWorkout.exercises.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg bg-muted/60 p-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{item.name}</span>
                          <span className="shrink-0 text-xs font-medium text-success">{item.sets}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.notes}</p>
                      </div>
                    </div>
                  ))}
                  <Button
                    className="mt-2 w-full"
                    onClick={() => {
                      soundEffects.playSuccessBeep();
                      alert('Đã áp dụng giáo án AI này cho buổi tập tiếp theo của học viên!');
                    }}
                  >
                    Áp Dụng Vào Lịch Dạy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Sparkles className="size-10 text-muted-foreground" />
                  <h4 className="text-base font-semibold text-foreground">Chưa Có Giáo Án Nào Được Tạo</h4>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Thiết lập mục tiêu và tiền sử thể lực bên trái rồi nhấn "Khởi Tạo Giáo Án Với AI" để nhận kế hoạch tối ưu.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Availability & Pricing */}
      {activeTab === 'availability' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Cấu Hình Ca Làm Việc</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Ca Trực Cố Định">
                <Input defaultValue={currentCoach.workingHours.shift} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Giờ bắt đầu">
                  <Input type="time" defaultValue={currentCoach.workingHours.start} />
                </Field>
                <Field label="Giờ kết thúc">
                  <Input type="time" defaultValue={currentCoach.workingHours.end} />
                </Field>
              </div>
              <Field label="Trạng thái nhận Booking từ Học viên">
                <div><Badge variant="success">Đang Bật Nhận Booking</Badge></div>
              </Field>
              <Button
                onClick={() => {
                  soundEffects.playSuccessBeep();
                  alert('Đã cập nhật khung giờ làm việc cá nhân thành công!');
                }}
              >
                Lưu Thiết Lập Ca Dạy
              </Button>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Bảng Giá Booking Lẻ Của Bạn</CardTitle>
              <CardDescription>Đơn giá được cấu hình theo cấp bậc chuyên môn bởi Quản lý Trung tâm.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid gap-3 rounded-lg bg-muted/60 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Cấp bậc hiện tại</dt>
                  <dd><Badge variant={rankVariant(currentCoach.rank)}>{currentCoach.rank.toUpperCase()} COACH</Badge></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Đơn giá/buổi dạy lẻ</dt>
                  <dd className="text-lg font-bold text-primary">{currentCoach.hourlyRateVND.toLocaleString('vi-VN')} đ</dd>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Tỷ lệ hoa hồng thực nhận</dt>
                  <dd className="font-semibold text-success">{currentCoach.commissionPercent}%</dd>
                </div>
              </dl>
              <p className="text-xs leading-relaxed text-muted-foreground">
                💡 Khi học viên hết hạn mức buổi trong gói chính muốn mua thêm buổi lẻ với bạn, họ sẽ thanh toán theo mức giá niêm yết này trên ứng dụng.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session Dynamic QR Code Display Modal (90s validity) */}
      <Dialog open={!!sessionQrModal?.open} onOpenChange={(open) => { if (!open) setSessionQrModal(null); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-base">
              <QrCode className="size-5 text-primary" /> Mã QR Điểm Danh Buổi Tập
            </DialogTitle>
            <DialogDescription>
              {sessionQrModal?.bookingTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            {sessionQrModal?.qrImage && (
              <img
                src={sessionQrModal.qrImage}
                alt="Session QR Code"
                className="size-56 rounded-lg border-2 border-primary/40 p-2 bg-white shadow-md"
              />
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Mã QR có hiệu lực trong <strong>90 giây</strong>.<br />
              Hướng dẫn học viên mở camera trên App để quét bắt đầu ca tập.
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setSessionQrModal(null)}>
              Đóng Mã QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffPage>
  );
};
