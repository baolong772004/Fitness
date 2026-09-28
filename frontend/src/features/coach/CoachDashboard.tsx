import React, { useState, useEffect } from 'react';
import { Coach, Member, BookingSession, WorkoutLogEntry, NutritionTarget } from '../../types';
import { MockDatabase } from '../../mocks/mockData';
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
  Apple
} from 'lucide-react';

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

  // Session execution state (Luồng 5)
  const [activeSession, setActiveSession] = useState<BookingSession | null>(null);
  const [sessionPhase, setSessionPhase] = useState<'idle' | 'running' | 'completed_form' | 'absence_dialog'>('idle');
  const [sessionTimer, setSessionTimer] = useState(0);

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

  const reloadData = () => {
    const allCoaches = MockDatabase.getCoaches();
    setCoaches(allCoaches);
    // Default to Master Trainer (Coach 1)
    const coach1 = allCoaches.find(c => c.id === 'coach-1') || allCoaches[0];
    setCurrentCoach(coach1);
    setBookings(MockDatabase.getBookings());
    setMembers(MockDatabase.getMembers());
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

  // Luồng 5: Coach Starts Session
  const handleStartSession = (session: BookingSession) => {
    setActiveSession(session);
    setSessionPhase('running');
    setSessionTimer(0);
    soundEffects.playSuccessBeep();

    // Update status in DB
    const updated = { ...session, status: 'in_progress' as const };
    MockDatabase.updateBooking(updated);
    setBookings(MockDatabase.getBookings());
  };

  // Luồng 5: Coach Ends Session -> Open Completion Form
  const handleEndSession = () => {
    setSessionPhase('completed_form');
  };

  // Save Workout Results & Deduct PT Quota from Member
  const handleSaveWorkoutResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const completedSession: BookingSession = {
      ...activeSession,
      status: 'completed',
      workoutLog: {
        completedExercises: workoutLogForm.exercises,
        intensityRating: workoutLogForm.intensity,
        coachFeedback: workoutLogForm.coachFeedback,
        homeworkNote: workoutLogForm.homeworkNote
      }
    };

    // If it's a PT session, deduct 1 session from Member's remaining quota!
    const trainee = members.find(m => m.id === activeSession.memberId);
    if (trainee && trainee.ptSessionsRemaining > 0) {
      const updatedTrainee: Member = {
        ...trainee,
        ptSessionsRemaining: Math.max(0, trainee.ptSessionsRemaining - 1)
      };
      MockDatabase.updateMember(updatedTrainee);
    }

    MockDatabase.updateBooking(completedSession);
    soundEffects.playSuccessBeep();
    reloadData();
    setSessionPhase('idle');
    setActiveSession(null);
  };

  // Handle Absence & Makeup Session Logic (Luồng 5)
  const handleOpenAbsenceDialog = (session: BookingSession) => {
    setActiveSession(session);
    setSessionPhase('absence_dialog');
  };

  const handleConfirmAbsence = () => {
    if (!activeSession) return;

    const isEligibleForMakeup = absenceAdvanceHours >= 4;

    const updatedSession: BookingSession = {
      ...activeSession,
      status: isEligibleForMakeup ? 'absent_excused' : 'absent_unexcused'
    };
    MockDatabase.updateBooking(updatedSession);

    if (isEligibleForMakeup) {
      // Don't deduct PT quota, create a makeup credit
      soundEffects.playSuccessBeep();
      alert(`Đã ghi nhận vắng mặt CÓ PHÉP (Báo trước ${absenceAdvanceHours}h).\nHọc viên được bảo lưu 01 buổi học bù (Makeup Session).`);
    } else {
      // Unexcused absence -> Deduct quota
      soundEffects.playErrorBeep();
      const trainee = members.find(m => m.id === activeSession.memberId);
      if (trainee && trainee.ptSessionsRemaining > 0) {
        MockDatabase.updateMember({
          ...trainee,
          ptSessionsRemaining: trainee.ptSessionsRemaining - 1
        });
      }
      alert(`Đã ghi nhận vắng mặt KHÔNG PHÉP (Báo muộn < 4h).\nHệ thống đã tính trừ 01 buổi tập theo chính sách trung tâm.`);
    }

    reloadData();
    setSessionPhase('idle');
    setActiveSession(null);
  };

  // Smart Mock AI Workout Generator (Module AI Dự phòng)
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

  return (
    <div style={{ padding: 'var(--space-xxl) var(--space-xl)', maxWidth: 'var(--max-content-width)', margin: '0 auto' }}>
      {/* Coach Header Profile Strip */}
      <div className="card-athletic" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        marginBottom: 'var(--space-xxxl)',
        background: 'linear-gradient(135deg, rgba(254, 116, 19, 0.08), var(--bg-card))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img 
            src={currentCoach.avatar} 
            alt={currentCoach.name} 
            style={{ width: 68, height: 68, borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 22, color: '#fff' }}>{currentCoach.name}</h2>
              <span className={`badge badge-rank-${currentCoach.rank}`}>
                {currentCoach.rank.toUpperCase()} COACH
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                ⭐ {currentCoach.rating} ({currentCoach.reviewCount} đánh giá)
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Chuyên môn: <strong style={{ color: '#fff' }}>{currentCoach.specialties.join(', ')}</strong> • Học viên đang kèm: <strong style={{ color: 'var(--color-primary)' }}>{currentCoach.activeTraineeCount} học viên</strong>
            </p>
          </div>
        </div>

        {/* Coach Hourly Rate Tag (Tiered pricing) */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Đơn giá dạy lẻ cá nhân
          </div>
          <div className="metric-mono" style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-primary)' }}>
            {currentCoach.hourlyRateVND.toLocaleString('vi-VN')} <span style={{ fontSize: 13, color: '#fff' }}>đ / Buổi</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>
            ● Sẵn sàng nhận booking
          </span>
        </div>
      </div>

      {/* TAB 1: Schedule & Session Execution Terminal (Luồng 4 & Luồng 5) */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-xxxl)' }}>
          {/* Left: Schedule List */}
          <div className="card-athletic">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 20, color: '#fff' }}>Lịch Dạy & Các Buổi Tập Hôm Nay</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Ngày: <strong>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </p>
              </div>
            </div>

            {/* Bookings List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {bookings.map(b => (
                <div key={b.id} style={{
                  padding: 18,
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: b.status === 'in_progress' ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: b.status === 'in_progress' ? '0 0 15px rgba(254,116,19,0.2)' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="metric-mono" style={{
                        background: 'rgba(255,255,255,0.08)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        color: 'var(--color-primary)',
                        fontWeight: 700,
                        fontSize: 13
                      }}>
                        {b.startTime} - {b.endTime}
                      </span>
                      <span className={`badge ${
                        b.type === 'pt_individual' ? 'badge-primary' : 'badge-rank-senior'
                      }`} style={{ fontSize: 10 }}>
                        {b.type === 'pt_individual' ? '1-on-1 PT' : 'Lớp Chuyên Biệt'}
                      </span>
                    </div>

                    <span className={`badge ${
                      b.status === 'completed' ? 'badge-active' :
                      b.status === 'in_progress' ? 'badge-primary' :
                      b.status === 'scheduled' ? 'badge' : 'badge-expired'
                    }`} style={{
                      background: b.status === 'scheduled' ? 'rgba(0,176,255,0.15)' : undefined,
                      color: b.status === 'scheduled' ? 'var(--color-info)' : undefined
                    }}>
                      {b.status === 'completed' ? 'Đã hoàn thành' :
                       b.status === 'in_progress' ? 'Đang diễn ra' :
                       b.status === 'scheduled' ? 'Chờ tập' : 'Vắng mặt'}
                    </span>
                  </div>

                  <h4 style={{ fontSize: 16, color: '#fff', marginBottom: 6 }}>{b.title}</h4>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={b.memberAvatar} alt={b.memberName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <strong style={{ color: '#fff', fontSize: 13 }}>{b.memberName}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{b.memberPhone}</span>
                      </div>
                    </div>

                    {/* Action buttons depending on status (Luồng 5) */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {b.status === 'scheduled' && (
                        <>
                          <button
                            className="btn-danger"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={() => handleOpenAbsenceDialog(b)}
                          >
                            Báo Vắng
                          </button>
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 16px', fontSize: 12 }}
                            onClick={() => handleStartSession(b)}
                          >
                            <Dumbbell size={14} />
                            <span>Bắt Đầu Buổi</span>
                          </button>
                        </>
                      )}

                      {b.status === 'in_progress' && (
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 16px', fontSize: 12, background: 'var(--color-success)' }}
                          onClick={handleEndSession}
                        >
                          <CheckCircle2 size={14} />
                          <span>Kết Thúc & Ghi Nhận</span>
                        </button>
                      )}

                      {b.status === 'completed' && (
                        <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>
                          ✓ Đã ghi nhận kết quả
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Active Live Session Execution Panel */}
          <div>
            {sessionPhase === 'running' && activeSession && (
              <div className="card-athletic" style={{ border: '2px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    boxShadow: '0 0 10px var(--color-primary)'
                  }} />
                  <h3 style={{ fontSize: 18, color: '#fff' }}>Buổi Tập Đang Diễn Ra</h3>
                </div>

                <div style={{ textAlign: 'center', padding: '24px 0', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Thời gian đã tập luyện
                  </div>
                  <div className="metric-mono" style={{ fontSize: 44, fontWeight: 900, color: 'var(--color-primary)', marginTop: 4 }}>
                    {Math.floor(sessionTimer / 60).toString().padStart(2, '0')}:{(sessionTimer % 60).toString().padStart(2, '0')}
                  </div>
                  <p style={{ fontSize: 13, color: '#fff', marginTop: 8 }}>
                    Học viên: <strong>{activeSession.memberName}</strong>
                  </p>
                </div>

                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', background: 'var(--color-success)' }}
                  onClick={handleEndSession}
                >
                  <CheckCircle2 size={18} />
                  <span>Hoàn Thành Buổi Tập & Ghi Sổ Kết Quả</span>
                </button>
              </div>
            )}

            {sessionPhase === 'completed_form' && activeSession && (
              <div className="card-athletic">
                <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 6 }}>Ghi Nhận Kết Quả Buổi Tập</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Kết quả sẽ được đồng bộ ngay vào ứng dụng của học viên <strong>{activeSession.memberName}</strong>.
                </p>

                <form onSubmit={handleSaveWorkoutResult}>
                  {/* Intensity Rating */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                      Đánh giá mức độ thể lực & cường độ (1 - 5 sao):
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[1, 2, 3, 4, 5].map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setWorkoutLogForm({ ...workoutLogForm, intensity: lvl as any })}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            borderRadius: 'var(--radius-sm)',
                            background: workoutLogForm.intensity === lvl ? 'var(--color-primary)' : 'var(--bg-app)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {lvl} ⭐
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exercises Logged */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                      Các bài tập chính đã hoàn thành:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {workoutLogForm.exercises.map((ex, i) => (
                        <div key={i} style={{
                          background: 'var(--bg-app)',
                          padding: '10px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ color: '#fff', fontWeight: 600 }}>{ex.exerciseName}</span>
                          <span className="metric-mono" style={{ color: 'var(--color-primary)' }}>
                            {ex.sets} sets x {ex.reps} reps ({ex.weightKg}kg)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coach Feedback */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                      Nhận xét & Đánh giá của Huấn Luyện Viên:
                    </label>
                    <textarea
                      rows={3}
                      className="form-input"
                      value={workoutLogForm.coachFeedback}
                      onChange={(e) => setWorkoutLogForm({ ...workoutLogForm, coachFeedback: e.target.value })}
                    />
                  </div>

                  {/* Homework */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                      Bài tập về nhà / Lời dặn dinh dưỡng:
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={workoutLogForm.homeworkNote}
                      onChange={(e) => setWorkoutLogForm({ ...workoutLogForm, homeworkNote: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                    <Save size={16} />
                    <span>Lưu Kết Quả & Trừ 1 Buổi PT Quota</span>
                  </button>
                </form>
              </div>
            )}

            {sessionPhase === 'absence_dialog' && activeSession && (
              <div className="card-athletic" style={{ border: '2px solid var(--color-danger)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <AlertCircle size={24} color="var(--color-danger)" />
                  <h3 style={{ fontSize: 18, color: '#fff' }}>Xử Lý Học Viên Vắng Mặt</h3>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Học viên: <strong style={{ color: '#fff' }}>{activeSession.memberName}</strong>
                </p>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Thời gian học viên báo trước giờ tập:
                  </label>
                  <select
                    className="form-input"
                    value={absenceAdvanceHours}
                    onChange={(e) => setAbsenceAdvanceHours(parseInt(e.target.value))}
                  >
                    <option value={6}>Báo trước 6 tiếng (Hợp lệ &gt; 4h)</option>
                    <option value={4}>Báo trước 4 tiếng (Hợp lệ = 4h)</option>
                    <option value={1}>Báo trước 1 tiếng (Hủy muộn &lt; 4h)</option>
                    <option value={0}>Không báo trước (Vắng không lý do)</option>
                  </select>
                </div>

                <div style={{
                  padding: 14,
                  background: absenceAdvanceHours >= 4 ? 'rgba(0,200,83,0.1)' : 'rgba(255,61,0,0.1)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 20,
                  fontSize: 12,
                  color: '#fff'
                }}>
                  {absenceAdvanceHours >= 4 ? (
                    <div>
                      ✅ <strong>Đủ điều kiện Học Bù:</strong> Học viên báo trước đủ 4 tiếng. Buổi tập này sẽ <strong>không bị trừ</strong> và được hoàn lại một buổi học bù (Makeup Session).
                    </div>
                  ) : (
                    <div>
                      ⚠️ <strong>Mất lượt tập:</strong> Do báo muộn dưới 4 tiếng, hệ thống sẽ <strong>tính trừ 01 buổi PT</strong> theo quy định chống bỏ giờ của trung tâm.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSessionPhase('idle')}>
                    Hủy Bỏ
                  </button>
                  <button className="btn-danger" style={{ flex: 1 }} onClick={handleConfirmAbsence}>
                    Xác Nhận Xử Lý
                  </button>
                </div>
              </div>
            )}

            {sessionPhase === 'idle' && (
              <div className="card-athletic" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Clock size={40} style={{ color: 'var(--color-primary)', margin: '0 auto 12px auto' }} />
                <h4 style={{ fontSize: 17, color: '#fff' }}>Sẵn Sàng Điểm Danh</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Chọn một buổi tập trong danh sách bên trái để Bắt đầu buổi tập hoặc Báo vắng học viên.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Trainee Roster & Nutrition Targets */}
      {activeTab === 'trainees' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-xxxl)' }}>
          {/* Trainee Cards */}
          <div className="card-athletic">
            <h3 style={{ fontSize: 20, color: '#fff', marginBottom: 16 }}>Học Viên PT Phụ Trách</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {members.filter(m => m.ptSessionsTotal > 0).map(m => (
                <div key={m.id} style={{
                  padding: 16,
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={m.avatar} alt={m.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <strong style={{ color: '#fff', fontSize: 15 }}>{m.name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          SĐT: {m.phone} • Năm sinh: {m.birthYear}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-primary">
                        PT Còn: {m.ptSessionsRemaining}/{m.ptSessionsTotal}
                      </span>
                    </div>
                  </div>

                  {m.fitnessGoals && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Mục tiêu: <strong style={{ color: '#fff' }}>{m.fitnessGoals.join(', ')}</strong>
                    </div>
                  )}

                  {m.inBodyHistory.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: 12,
                      background: 'rgba(255,255,255,0.04)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12
                    }}>
                      <span>Cân nặng: <strong className="metric-mono" style={{ color: '#fff' }}>{m.inBodyHistory[m.inBodyHistory.length - 1].weightKg}kg</strong></span>
                      <span>Khối cơ: <strong className="metric-mono" style={{ color: 'var(--color-success)' }}>{m.inBodyHistory[m.inBodyHistory.length - 1].muscleMassKg}kg</strong></span>
                      <span>Tỷ lệ mỡ: <strong className="metric-mono" style={{ color: 'var(--color-warning)' }}>{m.inBodyHistory[m.inBodyHistory.length - 1].bodyFatPercent}%</strong></span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      className="btn-outline"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={() => setSelectedTraineeForNutrition(m)}
                    >
                      <Apple size={14} />
                      <span>Thiết Lập Dinh Dưỡng</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Nutrition Builder for Trainee */}
          <div>
            {selectedTraineeForNutrition ? (
              <div className="card-athletic">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Apple size={22} color="var(--color-primary)" />
                  <div>
                    <h3 style={{ fontSize: 18, color: '#fff' }}>Gán Mục Tiêu Dinh Dưỡng & Macros</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Học viên: {selectedTraineeForNutrition.name}</p>
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Năng lượng mục tiêu hàng ngày (Calories):
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={nutritionForm.calories}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, calories: parseInt(e.target.value) || 2000 })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', display: 'block', marginBottom: 4 }}>
                      Protein (g)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={nutritionForm.protein}
                      onChange={(e) => setNutritionForm({ ...nutritionForm, protein: parseInt(e.target.value) || 150 })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-warning)', display: 'block', marginBottom: 4 }}>
                      Carbs (g)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={nutritionForm.carbs}
                      onChange={(e) => setNutritionForm({ ...nutritionForm, carbs: parseInt(e.target.value) || 200 })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-info)', display: 'block', marginBottom: 4 }}>
                      Fat (g)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={nutritionForm.fat}
                      onChange={(e) => setNutritionForm({ ...nutritionForm, fat: parseInt(e.target.value) || 60 })}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Lượng nước uống tối thiểu (Lít/ngày):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    value={nutritionForm.water}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, water: parseFloat(e.target.value) || 2.5 })}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Lời dặn thực đơn:
                  </label>
                  <textarea
                    rows={3}
                    className="form-input"
                    value={nutritionForm.notes}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, notes: e.target.value })}
                  />
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    soundEffects.playSuccessBeep();
                    alert(`Đã lưu và gửi kế hoạch dinh dưỡng thành công tới học viên ${selectedTraineeForNutrition.name}!`);
                    setSelectedTraineeForNutrition(null);
                  }}
                >
                  <Save size={16} />
                  <span>Lưu & Gửi Kế Hoạch Dinh Dưỡng</span>
                </button>
              </div>
            ) : (
              <div className="card-athletic" style={{ textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}>
                <Apple size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 12px auto' }} />
                <h4 style={{ fontSize: 16, color: '#fff' }}>Chọn Học Viên</h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Nhấn vào nút "Thiết Lập Dinh Dưỡng" ở danh sách bên trái để cấu hình lượng Calo và Macros cho học viên.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AI Workout Suggestion Generator (Module AI Dự Phòng) */}
      {activeTab === 'ai-workout' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 'var(--space-xxxl)' }}>
          {/* Left Form: AI Prompt Controls */}
          <div className="card-athletic">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: 8, borderRadius: 'var(--radius-full)' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, color: '#fff' }}>Gợi Ý Giáo Án Bằng AI (Stub)</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Thuật toán gợi ý bài tập chuẩn y khoa thể thao</p>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                Mục Tiêu Tập Luyện:
              </label>
              <select
                className="form-input"
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value as any)}
              >
                <option value="fat_loss">Giảm mỡ & Săn chắc cơ thể (Fat Loss HIIT)</option>
                <option value="hypertrophy">Tăng cơ bắp chuyên sâu (Hypertrophy)</option>
                <option value="strength">Tăng sức mạnh thô (Raw Strength)</option>
                <option value="rehab">Phục hồi chức năng & Cột sống (Rehab & Mobility)</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                Trình Độ Học Viên:
              </label>
              <select
                className="form-input"
                value={aiLevel}
                onChange={(e) => setAiLevel(e.target.value as any)}
              >
                <option value="beginner">Người mới bắt đầu (Beginner - Dưới 3 tháng)</option>
                <option value="intermediate">Trung cấp (Intermediate - 6 tháng đến 2 năm)</option>
                <option value="advanced">Nâng cao (Advanced - Trên 2 năm)</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                Tiền Sử Chấn Thương / Hạn Chế Thể Lực:
              </label>
              <textarea
                rows={3}
                className="form-input"
                value={aiInjuries}
                onChange={(e) => setAiInjuries(e.target.value)}
                placeholder="VD: Đau khớp gối nhẹ, thoát vị đĩa đệm..."
              />
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', padding: '14px' }}
              onClick={handleGenerateAIWorkout}
              disabled={isAiGenerating}
            >
              <Sparkles size={18} />
              <span>{isAiGenerating ? 'Đang Tính Toán Giáo Án...' : 'Khởi Tạo Giáo Án Với AI'}</span>
            </button>
          </div>

          {/* Right: AI Output Display */}
          <div>
            {aiGeneratedWorkout ? (
              <div className="card-athletic" style={{ border: '1px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: 6 }}>AI Recommendation</span>
                    <h3 style={{ fontSize: 18, color: '#fff' }}>{aiGeneratedWorkout.title}</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Nhóm cơ chính: <strong style={{ color: '#fff' }}>{aiGeneratedWorkout.targetMuscle}</strong>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Ước tính tiêu hao</div>
                    <div className="metric-mono" style={{ fontSize: 20, color: 'var(--color-primary)', fontWeight: 800 }}>
                      ~{aiGeneratedWorkout.estimatedCalories} kcal
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {aiGeneratedWorkout.exercises.map((item, idx) => (
                    <div key={idx} style={{
                      padding: 12,
                      background: 'var(--bg-app)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12
                    }}>
                      <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: 'rgba(254,116,19,0.15)',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 12
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ color: '#fff', fontSize: 14 }}>{item.name}</strong>
                          <span className="metric-mono" style={{ color: 'var(--color-success)', fontSize: 12 }}>
                            {item.sets}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.notes}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      soundEffects.playSuccessBeep();
                      alert('Đã áp dụng giáo án AI này cho buổi tập tiếp theo của học viên!');
                    }}
                  >
                    <span>Áp Dụng Vào Lịch Dạy</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="card-athletic" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                <Sparkles size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px auto' }} />
                <h4 style={{ fontSize: 17, color: '#fff' }}>Chưa Có Giáo Án Nào Được Tạo</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, margin: '6px auto 0 auto' }}>
                  Thiết lập mục tiêu và tiền sử thể lực bên trái rồi nhấn "Khởi Tạo Giáo Án Với AI" để nhận kế hoạch tối ưu.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Availability & Pricing */}
      {activeTab === 'availability' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xxxl)' }}>
          <div className="card-athletic">
            <h3 style={{ fontSize: 20, color: '#fff', marginBottom: 16 }}>Cấu Hình Ca Làm Việc</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                Ca Trực Cố Định:
              </label>
              <input type="text" className="form-input" defaultValue={currentCoach.workingHours.shift} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>Giờ bắt đầu:</label>
                <input type="time" className="form-input" defaultValue={currentCoach.workingHours.start} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>Giờ kết thúc:</label>
                <input type="time" className="form-input" defaultValue={currentCoach.workingHours.end} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                Trạng thái nhận Booking từ Học viên:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-active">Đang Bật Nhận Booking</span>
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={() => {
                soundEffects.playSuccessBeep();
                alert('Đã cập nhật khung giờ làm việc cá nhân thành công!');
              }}
            >
              <span>Lưu Thiết Lập Ca Dạy</span>
            </button>
          </div>

          <div className="card-athletic">
            <h3 style={{ fontSize: 20, color: '#fff', marginBottom: 16 }}>Bảng Giá Booking Lẻ Của Bạn</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Đơn giá được cấu hình theo cấp bậc chuyên môn bởi Quản lý Trung tâm.
            </p>

            <div style={{
              background: 'var(--bg-app)',
              padding: 20,
              borderRadius: 'var(--radius-sm)',
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Cấp bậc hiện tại:</span>
                <span className={`badge badge-rank-${currentCoach.rank}`}>{currentCoach.rank.toUpperCase()} COACH</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Đơn giá/buổi dạy lẻ:</span>
                <strong className="metric-mono" style={{ color: 'var(--color-primary)', fontSize: 18 }}>
                  {currentCoach.hourlyRateVND.toLocaleString('vi-VN')} đ
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 10 }}>
                <span style={{ color: 'var(--text-muted)' }}>Tỷ lệ hoa hồng thực nhận:</span>
                <strong style={{ color: 'var(--color-success)' }}>{currentCoach.commissionPercent}%</strong>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              💡 Khi học viên hết hạn mức buổi trong gói chính muốn mua thêm buổi lẻ với bạn, họ sẽ thanh toán theo mức giá niêm yết này trên ứng dụng.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
