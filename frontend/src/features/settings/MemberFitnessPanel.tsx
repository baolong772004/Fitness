import React, { useEffect, useState } from 'react';
import { api, ApiSubscription } from '../../services/api';

export const MemberFitnessPanel: React.FC<{ userId: string }> = ({ userId }) => {
  const [trainers, setTrainers] = useState<Array<{ id: number; userId: number; fullName: string; specialization?: string; rating?: number; hourlyRate: number }>>([]);
  const [subscriptions, setSubscriptions] = useState<ApiSubscription[]>([]);
  const [trainerId, setTrainerId] = useState<number | null>(null);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string; isAvailable: boolean }>>([]);
  const [progress, setProgress] = useState<{ inbodyLogs: Array<{ id: number; weight: number; bodyFat?: number | null; muscleMass?: number | null; loggedAt: string }>; workoutLogs: any[] }>({ inbodyLogs: [], workoutLogs: [] });
  const [reviews, setReviews] = useState<Array<{ id: number; rating: number; comment?: string | null; member?: { fullName: string } }>>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [metrics, setMetrics] = useState({ weight: '', bodyFat: '', muscleMass: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [trainerRes, memberSubs, memberProgress] = await Promise.all([
        api.pt.getAvailableTrainers(), api.subscriptions.getMySubscriptions(), api.workouts.getMemberProgress(userId)
      ]);
      setTrainers(trainerRes.data || []);
      setSubscriptions(memberSubs || []);
      setProgress(memberProgress || { inbodyLogs: [], workoutLogs: [] });
    } catch (err: any) { setMessage(err.message || 'Không thể tải dữ liệu tập luyện.'); }
  };
  useEffect(() => { load(); }, [userId]);
  const loadSlots = async (id: number) => {
    setTrainerId(id); setSlots([]); setReviews([]);
    try {
      const trainer = trainers.find(item => item.userId === id);
      const [slotResponse, reviewResponse] = await Promise.all([api.pt.getTrainerSlots(id, date), trainer ? api.reviews.getCoachReviews(trainer.id) : Promise.resolve(null)]);
      setSlots(slotResponse.slots || []);
      setReviews(reviewResponse?.data || []);
    } catch (err: any) { setMessage(err.message || 'Không thể tải khung giờ.'); }
  };
  const book = async (time: string) => {
    const sub = subscriptions.find(item => item.package?.type === 'PT' && item.status === 'ACTIVE' && item.coachId === trainerId);
    if (!sub) { setMessage('Bạn cần một gói PT đang hoạt động, được gán đúng HLV này.'); return; }
    try { await api.pt.createBooking({ ptSubscriptionId: sub.id, bookingDate: new Date(`${date}T${time}:00+07:00`).toISOString() }); setMessage('Đã gửi yêu cầu đặt lịch PT.'); setSlots([]); } catch (err: any) { setMessage(err.message || 'Không thể đặt lịch.'); }
  };
  const submitReview = async () => {
    const profile = trainers.find(item => item.userId === trainerId)?.id;
    if (!profile) { setMessage('Chọn HLV từ danh sách để đánh giá.'); return; }
    try { await api.reviews.createReview({ coachProfileId: profile, rating, comment }); setComment(''); setMessage('Đã gửi đánh giá.'); } catch (err: any) { setMessage(err.message || 'Không thể gửi đánh giá.'); }
  };
  const saveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.workouts.logInBody({ memberId: Number(userId), weight: Number(metrics.weight), bodyFat: metrics.bodyFat ? Number(metrics.bodyFat) : undefined, muscleMass: metrics.muscleMass ? Number(metrics.muscleMass) : undefined }); setMessage('Đã lưu chỉ số InBody.'); setMetrics({ weight: '', bodyFat: '', muscleMass: '' }); load(); } catch (err: any) { setMessage(err.message || 'Không thể lưu InBody.'); }
  };
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}><div><h3 style={{ margin: 0 }}>PT & Tiến độ cá nhân</h3><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Đặt lịch PT, đánh giá HLV và cập nhật InBody.</p></div><button className="btn-secondary" onClick={load}>Làm mới</button></div>
    {message && <div style={{ padding: 10, marginBottom: 12, borderRadius: 6, background: 'var(--color-primary-light)', fontSize: 12 }}>{message}</div>}
    <section style={{ padding: 14, border: '1px solid var(--aura-border)', borderRadius: 8, marginBottom: 14 }}><strong>Đặt lịch PT</strong><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}><select className="form-input" value={trainerId || ''} onChange={e => loadSlots(Number(e.target.value))}><option value="">Chọn HLV</option>{trainers.map(t => <option key={t.userId} value={t.userId}>{t.fullName} · {t.specialization || 'PT'} · ★{t.rating || 0}</option>)}</select><input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /><button className="btn-secondary" disabled={!trainerId} onClick={() => trainerId && loadSlots(trainerId)}>Xem giờ trống</button></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{slots.filter(s => s.isAvailable).map(s => <button key={s.startTime} className="btn-primary" onClick={() => book(s.startTime)}>{s.startTime}–{s.endTime}</button>)}</div></section>
    <section style={{ padding: 14, border: '1px solid var(--aura-border)', borderRadius: 8, marginBottom: 14 }}><strong>Đánh giá HLV</strong><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><select className="form-input" value={rating} onChange={e => setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} sao</option>)}</select><input className="form-input" placeholder="Nhận xét" value={comment} onChange={e => setComment(e.target.value)} /><button className="btn-primary" onClick={submitReview}>Gửi</button></div>{reviews.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>{reviews.map(item => <div key={item.id}>★{item.rating} · {item.member?.fullName || 'Hội viên'}: {item.comment || 'Không có nhận xét'}</div>)}</div>}</section>
    <section style={{ padding: 14, border: '1px solid var(--aura-border)', borderRadius: 8 }}><strong>InBody & tiến độ</strong><form onSubmit={saveMetrics} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}><input required className="form-input" type="number" step="0.1" placeholder="Cân nặng (kg)" value={metrics.weight} onChange={e => setMetrics({ ...metrics, weight: e.target.value })} /><input className="form-input" type="number" step="0.1" placeholder="Mỡ cơ thể (%)" value={metrics.bodyFat} onChange={e => setMetrics({ ...metrics, bodyFat: e.target.value })} /><input className="form-input" type="number" step="0.1" placeholder="Cơ (kg)" value={metrics.muscleMass} onChange={e => setMetrics({ ...metrics, muscleMass: e.target.value })} /><button className="btn-primary">Lưu InBody</button></form><div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>{progress.inbodyLogs.length ? progress.inbodyLogs.map(item => <div key={item.id}>{new Date(item.loggedAt).toLocaleDateString('vi-VN')}: {item.weight}kg · mỡ {item.bodyFat ?? '—'}% · cơ {item.muscleMass ?? '—'}kg</div>) : 'Chưa có dữ liệu InBody.'}</div></section>
  </div>;
};
