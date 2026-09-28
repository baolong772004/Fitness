import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { MockDatabase, SystemSettings, DEFAULT_SYSTEM_SETTINGS } from '../../mocks/mockData';
import { soundEffects } from '../../services/audioService';
import { 
  Settings, 
  User as UserIcon, 
  Building2, 
  Bell, 
  ShieldCheck, 
  Volume2, 
  Save, 
  ArrowLeft, 
  Check, 
  LogOut,
  Lock,
  Smartphone,
  Sparkles
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'center' | 'preferences' | 'security'>('profile');

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || 'Người dùng AURA',
    phone: currentUser?.phone || '0900 111 222',
    email: currentUser?.email || 'user@aurafitness.vn',
    avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    newPassword: '',
    confirmPassword: ''
  });

  // Center Settings State
  const [centerSettings, setCenterSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setCenterSettings(MockDatabase.getSettings());
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser) {
      const updated: User = {
        ...currentUser,
        name: profileForm.name,
        phone: profileForm.phone,
        email: profileForm.email,
        avatar: profileForm.avatar
      };
      MockDatabase.saveCurrentSession(updated);
      onUpdateUser(updated);
    }
    soundEffects.playSuccessBeep();
    setSaveSuccessMsg('Đã cập nhật hồ sơ cá nhân thành công!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleSaveCenterConfig = (e: React.FormEvent) => {
    e.preventDefault();
    MockDatabase.saveSettings(centerSettings);
    MockDatabase.logAction(
      currentUser?.name || 'Quản trị viên',
      currentUser?.role || 'admin',
      'Cập nhật cấu hình trung tâm',
      'Hệ thống AURA Fitness',
      `Giờ mở cửa: ${centerSettings.operatingHours} - Giới hạn báo vắng: ${centerSettings.makeupNoticeHours}h`
    );
    soundEffects.playSuccessBeep();
    setSaveSuccessMsg('Đã lưu cấu hình trung tâm thể thao thành công!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
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
          <h2 style={{ fontSize: 24, color: '#fff' }}>Cài Đặt Hệ Thống & Tài Khoản</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Quản lý hồ sơ, cấu hình phòng tập, thông báo và bảo mật
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
              color: activeTab === 'profile' ? '#fff' : 'var(--text-muted)',
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
            onClick={() => setActiveTab('center')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: activeTab === 'center' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'center' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 6,
              textAlign: 'left'
            }}
          >
            <Building2 size={16} />
            <span>Cấu Hình Trung Tâm</span>
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
              color: activeTab === 'preferences' ? '#fff' : 'var(--text-muted)',
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
            <span>Thông Báo & Âm Thanh</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: activeTab === 'security' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'security' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <ShieldCheck size={16} />
            <span>Bảo Mật & 2FA</span>
          </button>
        </div>

        {/* Content Pane */}
        <div className="card-athletic" style={{ padding: 28 }}>
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile}>
              <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 20 }}>Thông Tin Hồ Sơ Cá Nhân</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <img
                  src={profileForm.avatar}
                  alt={profileForm.name}
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                />
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
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
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Địa Chỉ Email:
                </label>
                <input
                  type="email"
                  required
                  className="form-input"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }}>
                <Save size={16} />
                <span>Lưu Thay Đổi Hồ Sơ</span>
              </button>
            </form>
          )}

          {/* TAB 2: CENTER CONFIGURATION */}
          {activeTab === 'center' && (
            <form onSubmit={handleSaveCenterConfig}>
              <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 20 }}>Cấu Hình Trung Tâm Thể Thao</h3>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Tên Thương Hiệu Trung Tâm:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={centerSettings.centerName}
                  onChange={(e) => setCenterSettings({ ...centerSettings, centerName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Đường Dây Nóng (Hotline):
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={centerSettings.hotline}
                    onChange={(e) => setCenterSettings({ ...centerSettings, hotline: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Thời Gian Mở Cửa Hàng Ngày:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={centerSettings.operatingHours}
                    onChange={(e) => setCenterSettings({ ...centerSettings, operatingHours: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Địa Chỉ Cơ Sở:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={centerSettings.address}
                  onChange={(e) => setCenterSettings({ ...centerSettings, address: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Thời hạn tối thiểu báo trước khi hủy buổi để được cấp học bù (Tiếng):
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  className="form-input"
                  value={centerSettings.makeupNoticeHours}
                  onChange={(e) => setCenterSettings({ ...centerSettings, makeupNoticeHours: parseInt(e.target.value) || 4 })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, display: 'block' }}>
                  * Nếu học viên báo trước số giờ này, hệ thống sẽ bảo lưu 01 buổi học bù (Makeup session).
                </span>
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }}>
                <Save size={16} />
                <span>Lưu Cấu Hình Trung Tâm</span>
              </button>
            </form>
          )}

          {/* TAB 3: PREFERENCES & AUDIO */}
          {activeTab === 'preferences' && (
            <div>
              <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 20 }}>Tùy Chọn Âm Thanh & Thông Báo</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 16,
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div>
                    <strong style={{ color: '#fff', fontSize: 14 }}>Hiệu Ứng Âm Thanh Web Audio (Bíp/Tít)</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Phát âm thanh phản hồi khi quét mã QR check-in hoặc thanh toán thành công.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={centerSettings.soundEffectsEnabled}
                    onChange={(e) => {
                      const updated = { ...centerSettings, soundEffectsEnabled: e.target.checked };
                      setCenterSettings(updated);
                      MockDatabase.saveSettings(updated);
                      if (e.target.checked) soundEffects.playSuccessBeep();
                    }}
                    style={{ transform: 'scale(1.4)', cursor: 'pointer' }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 16,
                  background: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div>
                    <strong style={{ color: '#fff', fontSize: 14 }}>Thông Báo Đẩy & Tin Nhắn Zalo</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Gửi thông báo nhắc lịch học, kết quả buổi tập và cảnh báo khi gói sắp hết hạn.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={centerSettings.notificationsEnabled}
                    onChange={(e) => {
                      const updated = { ...centerSettings, notificationsEnabled: e.target.checked };
                      setCenterSettings(updated);
                      MockDatabase.saveSettings(updated);
                    }}
                    style={{ transform: 'scale(1.4)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & 2FA */}
          {activeTab === 'security' && (
            <div>
              <h3 style={{ fontSize: 18, color: '#fff', marginBottom: 20 }}>Bảo Mật & Phiên Đăng Nhập</h3>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 20
              }}>
                <div>
                  <strong style={{ color: '#fff', fontSize: 14 }}>Xác Thực 2 Lớp (2FA qua SMS OTP)</strong>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Yêu cầu nhập mã OTP mỗi lần đăng nhập từ trình duyệt hoặc thiết bị lạ.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={centerSettings.twoFactorEnabled}
                  onChange={(e) => {
                    const updated = { ...centerSettings, twoFactorEnabled: e.target.checked };
                    setCenterSettings(updated);
                    MockDatabase.saveSettings(updated);
                  }}
                  style={{ transform: 'scale(1.4)', cursor: 'pointer' }}
                />
              </div>

              <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Phiên Làm Việc Hiện Tại</h4>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <div>Trình duyệt: <strong>Google Chrome / Edge (Windows 11)</strong></div>
                  <div>Địa chỉ IP: <strong>118.70.12.89 (Hà Nội, Việt Nam)</strong></div>
                  <div>Trạng thái: <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>● Đang hoạt động</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
