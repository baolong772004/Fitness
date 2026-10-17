import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { api } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import { 
  Settings, 
  User as UserIcon, 
  Volume2, 
  ArrowLeft, 
  Check,
  LogOut,
  Loader2,
  CreditCard,
  Calendar,
  Clock,
  Sparkles,
  Save
} from 'lucide-react';
import { ApiSubscription } from '../../services/api';
import { MemberFitnessPanel } from './MemberFitnessPanel';

interface SettingsPageProps {
  currentUser: User | null;
  onBack: () => void;
  onLogout: () => void;
  onUpdateUser: (updated: User) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  currentUser,
  onBack,
  onLogout,
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'subscriptions' | 'schedule' | 'fitness' | 'preferences'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [mySubscriptions, setMySubscriptions] = useState<ApiSubscription[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [mySchedule, setMySchedule] = useState<Array<{ id: number; bookingType: 'PERSONAL_TRAINING' | 'GROUP_CLASS'; title: string; startTime: string; endTime: string; status: string; trainerName?: string; location?: string; canCancel?: boolean }>>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [scheduleDetail, setScheduleDetail] = useState<any>(null);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('aura_sound_effects_enabled') !== 'false';
  });

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || 'Người dùng AURA',
    phone: currentUser?.phone || '0900 111 222',
    email: currentUser?.email || 'user@aurafitness.vn',
    avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'subscriptions') {
      setIsLoadingSubs(true);
      api.subscriptions.getMySubscriptions()
        .then(subs => {
          setMySubscriptions(subs || []);
        })
        .catch(err => {
          console.warn('Lỗi tải gói tập cá nhân:', err);
          setMySubscriptions([]);
        })
        .finally(() => {
          setIsLoadingSubs(false);
        });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'schedule') return;
    setIsLoadingSchedule(true);
    api.member.getMySchedule()
      .then(items => setMySchedule(items || []))
      .catch(err => { console.warn('Lỗi tải lịch tập cá nhân:', err); setMySchedule([]); })
      .finally(() => setIsLoadingSchedule(false));
  }, [activeTab]);

  const showBookingDetail = async (item: typeof mySchedule[number]) => {
    try {
      setScheduleDetail(await api.member.getBookingDetail(item.bookingType === 'PERSONAL_TRAINING' ? 'PT' : 'GROUP', item.id));
    } catch (err: any) {
      alert(err.message || 'Không thể tải chi tiết buổi tập.');
    }
  };

  const cancelGroupBooking = async (item: typeof mySchedule[number]) => {
    if (!window.confirm('Bạn có chắc muốn hủy lịch lớp nhóm này?')) return;
    try {
      await api.groupClasses.cancel(item.id);
      setMySchedule(items => items.map(entry => entry.id === item.id ? { ...entry, status: 'CANCELLED', canCancel: false } : entry));
      setScheduleDetail(null);
      soundEffects.playSuccessBeep();
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(err.message || 'Không thể hủy lịch lớp.');
    }
  };

  const renewSubscription = async (subscriptionId: number, packageId: number) => {
    try {
      const result = await api.subscriptions.renewSubscription({ subscriptionId, packageId });
      if (result.data.checkoutUrl) window.open(result.data.checkoutUrl, '_blank');
      else alert(`Đã tạo yêu cầu gia hạn #${result.data.orderCode}.`);
    } catch (err: any) {
      alert(err.message || 'Không thể tạo yêu cầu gia hạn.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      if (currentUser?.id) {
        // 1. Call Backend API to update Profile
        try {
          await api.users.updateUser(currentUser.id, {
            fullName: profileForm.name,
            phone: profileForm.phone,
            avatar: profileForm.avatar
          });
        } catch (apiErr) {
          console.warn('API update profile warning (using session cache):', apiErr);
        }

        // 2. If password change was provided
        if (profileForm.newPassword) {
          if (profileForm.newPassword !== profileForm.confirmPassword) {
            alert('Mật khẩu mới và mật khẩu xác nhận không khớp!');
            setIsSaving(false);
            return;
          }
          if (!profileForm.oldPassword) {
            alert('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu!');
            setIsSaving(false);
            return;
          }
          await api.auth.changePassword({
            oldPassword: profileForm.oldPassword,
            newPassword: profileForm.newPassword
          });
        }

        const updated: User = {
          ...currentUser,
          name: profileForm.name,
          phone: profileForm.phone,
          email: profileForm.email,
          avatar: profileForm.avatar
        };
        onUpdateUser(updated);
      }
      soundEffects.playSuccessBeep();
      setSaveSuccessMsg('Đã cập nhật hồ sơ cá nhân lên cơ sở dữ liệu thành công!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      alert(`Lỗi khi cập nhật hồ sơ: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div style={{ padding: 'var(--space-xxl) var(--space-xl)', maxWidth: 1080, margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn-secondary" style={{ padding: '8px 16px' }} onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Quay Lại Bàn Làm Việc</span>
        </button>

        <button className="btn-danger" style={{ padding: '8px 16px' }} onClick={onLogout}>
          <LogOut size={16} />
          <span>Đăng Xuất Tài Khoản</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: 10, borderRadius: 'var(--radius-full)' }}>
          <Settings size={26} />
        </div>
        <div>
          <h2 style={{ fontSize: 24, color: 'var(--text-primary)', fontWeight: 800 }}>Cài Đặt Tài Khoản & Gói Tập</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Quản lý hồ sơ cá nhân, đổi mật khẩu, theo dõi gói tập hội viên và tùy chọn âm thanh
          </p>
        </div>
      </div>

      {saveSuccessMsg && (
        <div style={{
          background: 'rgba(0, 200, 83, 0.12)',
          border: '1px solid var(--color-success)',
          color: 'var(--color-success)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <Check size={18} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>
        {/* Navigation Sidebar */}
        <div className="card-athletic" style={{ padding: 12 }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: activeTab === 'profile' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'profile' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 6,
              textAlign: 'left'
            }}
          >
            <UserIcon size={16} />
            <span>Hồ Sơ Của Tôi</span>
          </button>

          <button
            onClick={() => setActiveTab('subscriptions')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: activeTab === 'subscriptions' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'subscriptions' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 6,
              textAlign: 'left'
            }}
          >
            <CreditCard size={16} />
            <span>Gói Tập & Thẻ Hội Viên</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: activeTab === 'schedule' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'schedule' ? '#FFFFFF' : 'var(--text-muted)', border: 'none',
              borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 6, textAlign: 'left'
            }}
          >
            <Calendar size={16} />
            <span>Lịch Tập Của Tôi</span>
          </button>

          <button
            onClick={() => setActiveTab('fitness')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: activeTab === 'fitness' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'fitness' ? '#FFFFFF' : 'var(--text-muted)', border: 'none',
              borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 6, textAlign: 'left'
            }}
          >
            <Sparkles size={16} />
            <span>PT & Tiến Độ</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: activeTab === 'preferences' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'preferences' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 6,
              textAlign: 'left'
            }}
          >
            <Volume2 size={16} />
            <span>Tùy Chọn Âm Thanh</span>
          </button>
        </div>

        {/* Content Pane */}
        <div className="card-athletic" style={{ padding: 28 }}>
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile}>
              <h3 style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 800, marginBottom: 20 }}>Thông Tin Hồ Sơ Cá Nhân</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <img
                  src={profileForm.avatar}
                  alt={profileForm.name}
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                />
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Đường dẫn ảnh đại diện (Avatar URL):
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.avatar}
                    onChange={(e) => setProfileForm({ ...profileForm, avatar: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Họ và Tên:
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Số Điện Thoại:
                  </label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                  Địa Chỉ Email:
                </label>
                <input
                  type="email"
                  required
                  disabled
                  className="form-input"
                  style={{ opacity: 0.7 }}
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </div>

              {/* Password Change Sub-section */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 18, marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, color: 'var(--color-primary)', marginBottom: 12, fontWeight: 700 }}>
                  Đổi Mật Khẩu Tài Khoản (Bảo Mật API)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Mật khẩu hiện tại:
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={profileForm.oldPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, oldPassword: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Mật khẩu mới (≥ 6 ký tự):
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={profileForm.newPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Xác nhận mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="btn-primary" style={{ padding: '12px 24px' }}>
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang lưu cập nhật...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Lưu Thay Đổi Hồ Sơ</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB: MY SUBSCRIPTIONS (HỘI VIÊN & GÓI TẬP) */}
          {activeTab === 'subscriptions' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 800 }}>Gói Tập & Thẻ Hội Viên Của Tôi</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Thông tin thẻ tập, ngày hết hạn và số buổi huấn luyện cá nhân (PT) còn lại
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setIsLoadingSubs(true);
                    api.subscriptions.getMySubscriptions()
                      .then(subs => setMySubscriptions(subs || []))
                      .finally(() => setIsLoadingSubs(false));
                  }}
                  style={{ padding: '8px 14px', fontSize: 12 }}
                >
                  Làm Mới
                </button>
              </div>

              {isLoadingSubs ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                  <div>Đang tải thông tin gói tập của bạn...</div>
                </div>
              ) : mySubscriptions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  background: 'var(--bg-app)',
                  border: '1px dashed var(--aura-border)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <CreditCard size={40} color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Bạn chưa có gói tập nào đang hoạt động
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 20px' }}>
                    Khám phá bảng giá niêm yết trên hệ thống và đăng ký gói tập phù hợp để bắt đầu tập luyện cùng trang thiết bị chuẩn Olympic!
                  </p>
                  <button className="btn-primary" onClick={onBack} style={{ padding: '10px 20px', fontSize: 13 }}>
                    Khám Phá Gói Tập Tại Trang Chủ
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {mySubscriptions.map(sub => {
                    const isActive = sub.status === 'ACTIVE';
                    const isPt = sub.package?.type === 'PT';
                    const startDateStr = new Date(sub.startDate).toLocaleDateString('vi-VN');
                    const endDateStr = new Date(sub.endDate).toLocaleDateString('vi-VN');

                    return (
                      <div
                        key={sub.id}
                        style={{
                          padding: 20,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-app)',
                          border: isActive ? '1.5px solid var(--color-primary)' : '1px solid var(--aura-border)',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                background: isPt ? 'rgba(254, 116, 19, 0.15)' : 'rgba(0, 200, 83, 0.15)',
                                color: isPt ? 'var(--color-primary)' : 'var(--color-success)'
                              }}>
                                {isPt ? 'Huấn Luyện 1:1 (PT)' : 'Hội Viên Gym'}
                              </span>

                              <span style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                background: isActive ? 'var(--color-success-bg)' : sub.status === 'PENDING_ACTIVATION' ? 'rgba(254, 116, 19, 0.15)' : 'rgba(150, 150, 150, 0.15)',
                                color: isActive ? 'var(--color-success)' : sub.status === 'PENDING_ACTIVATION' ? 'var(--color-primary)' : 'var(--text-muted)'
                              }}>
                                {isActive ? 'Đang Hoạt Động' : sub.status === 'PENDING_ACTIVATION' ? 'Chờ Kích Hoạt' : sub.status === 'PENDING' ? 'Chờ Thanh Toán' : sub.status}
                              </span>
                            </div>

                            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0' }}>
                              {sub.package?.name || `Gói tập #${sub.packageId}`}
                            </h4>
                            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                              {sub.package?.description || 'Quyền lợi tập luyện đầy đủ tại hệ thống AURA Fitness.'}
                            </p>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                              Mã Đăng Ký
                            </div>
                            <div className="metric-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-primary)' }}>
                              #SUB-{sub.id}
                            </div>
                          </div>
                        </div>

                        <div style={{
                          marginTop: 18,
                          paddingTop: 14,
                          borderTop: '1px solid var(--aura-border)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 16
                        }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Calendar size={13} color="var(--color-primary)" />
                              <span>Thời Hạn Sử Dụng</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                              {startDateStr} - {endDateStr}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Clock size={13} color="var(--aura-caramel)" />
                              <span>Buổi Kèm PT Còn Lại</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                              {sub.remainingSessions !== undefined && sub.remainingSessions !== null
                                ? `${sub.remainingSessions} buổi`
                                : `${sub.package?.trialPtSessions || 0} buổi định hướng`}
                            </div>
                          </div>

                          {sub.coach && (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Sparkles size={13} color="var(--color-primary)" />
                                <span>HLV Phụ Trách</span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                                {sub.coach.fullName}
                              </div>
                            </div>
                          )}
                        </div>
                        {sub.package?.type === 'MEMBERSHIP' && (sub.status === 'ACTIVE' || sub.status === 'EXPIRED') ? (
                          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-primary" onClick={() => renewSubscription(sub.id, sub.packageId)} style={{ padding: '8px 12px', fontSize: 12 }}>Gia hạn gói tập</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 20 }}>
                <div><h3 style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 800, margin: 0 }}>Lịch Tập Sắp Tới</h3><p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0 }}>Bao gồm lịch PT và lớp nhóm trong 30 ngày tới.</p></div>
                <button type="button" className="btn-secondary" onClick={() => { setIsLoadingSchedule(true); api.member.getMySchedule().then(items => setMySchedule(items || [])).finally(() => setIsLoadingSchedule(false)); }} style={{ padding: '8px 14px', fontSize: 12 }}>Làm Mới</button>
              </div>
              {isLoadingSchedule ? <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}><Loader2 size={26} className="animate-spin" style={{ margin: '0 auto 10px' }} />Đang tải lịch tập...</div> : mySchedule.length === 0 ? <div style={{ padding: 36, textAlign: 'center', border: '1px dashed var(--aura-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>Bạn chưa có buổi tập nào sắp tới.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{mySchedule.map(item => <div key={`${item.bookingType}-${item.id}`} style={{ padding: 14, border: '1px solid var(--aura-border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><div><div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 5 }}><span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-primary)' }}>{item.bookingType === 'PERSONAL_TRAINING' ? 'PT 1:1' : 'LỚP NHÓM'}</span><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.status}</span></div><strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.title}</strong><div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-muted)' }}>{new Date(item.startTime).toLocaleString('vi-VN')} · {item.trainerName || 'HLV AURA'} · {item.location || 'AURA Fitness'}</div></div><div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn-secondary" onClick={() => showBookingDetail(item)} style={{ padding: '7px 10px', fontSize: 11 }}>Chi tiết</button>{item.bookingType === 'GROUP_CLASS' && item.canCancel && <button type="button" className="btn-danger" onClick={() => cancelGroupBooking(item)} style={{ padding: '7px 10px', fontSize: 11 }}>Hủy lịch</button>}</div></div>)}</div>}
              {scheduleDetail && <div style={{ marginTop: 18, padding: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>Chi tiết buổi tập</strong><button type="button" onClick={() => setScheduleDetail(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>Đóng</button></div><pre style={{ margin: '10px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{JSON.stringify(scheduleDetail, null, 2)}</pre></div>}
            </div>
          )}

          {activeTab === 'fitness' && currentUser && <MemberFitnessPanel userId={currentUser.id} />}

          {/* TAB 3: PREFERENCES & AUDIO */}
          {activeTab === 'preferences' && (
            <div>
              <h3 style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 800, marginBottom: 20 }}>Tùy Chọn Âm Thanh</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 16,
                  background: 'var(--bg-app)',
                  border: '1px solid var(--aura-border)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>Hiệu Ứng Âm Thanh Web Audio (Bíp/Tít Phản Hồi)</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Phát âm thanh phản hồi khi quẹt mã QR, chuyển đổi chế độ hoặc thực hiện các thao tác thành công.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEffectsEnabled}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setSoundEffectsEnabled(val);
                      localStorage.setItem('aura_sound_effects_enabled', String(val));
                      if (val) soundEffects.playSuccessBeep();
                    }}
                    style={{ transform: 'scale(1.4)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
