import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { TEST_USERS, AuthUser, MockDatabase } from '../../mocks/mockData';
import { soundEffects } from '../../services/audioService';
import { 
  X, 
  LogIn, 
  UserPlus, 
  KeyRound, 
  ShieldCheck, 
  Sparkles, 
  Phone, 
  Mail, 
  Lock, 
  User as UserIcon,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register' | 'otp';
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
  onLoginSuccess
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'otp'>(initialTab);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('admin@aurafitness.vn');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [useOtpLogin, setUseOtpLogin] = useState(false);

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: 'male' as const,
    role: 'coach' as UserRole
  });

  // OTP state
  const [otpCode, setOtpCode] = useState(['8', '8', '8', '9', '9', '9']);
  const [otpTimer, setOtpTimer] = useState(59);
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle direct 1-click test account login
  const handleQuickLogin = (testUser: AuthUser) => {
    soundEffects.playSuccessBeep();
    MockDatabase.saveCurrentSession({
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      phone: testUser.phone,
      role: testUser.role,
      avatar: testUser.avatar
    });
    onLoginSuccess(testUser);
    onClose();
  };

  // Handle standard login
  const handleSubmitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const trimmed = loginIdentifier.trim().toLowerCase();
    if (trimmed.includes('member') || trimmed.includes('guest') || trimmed.includes('vanan') || trimmed.includes('maitran') || trimmed.includes('hoangnam')) {
      soundEffects.playErrorBeep();
      setAuthError('Khách vãng lai (Guest) không cần đăng nhập. Cổng đăng nhập này chỉ dành riêng cho Ban Quản Lý, Lễ Tân và Huấn Luyện Viên.');
      return;
    }

    const found = TEST_USERS.find(u => 
      (u.email.toLowerCase() === trimmed || u.phone.includes(trimmed)) &&
      u.password === loginPassword
    );

    if (found) {
      if (useOtpLogin) {
        setPendingUser(found);
        setTab('otp');
        soundEffects.playSuccessBeep();
      } else {
        soundEffects.playSuccessBeep();
        MockDatabase.saveCurrentSession({
          id: found.id,
          name: found.name,
          email: found.email,
          phone: found.phone,
          role: found.role,
          avatar: found.avatar
        });
        onLoginSuccess(found);
        onClose();
      }
    } else {
      soundEffects.playErrorBeep();
      setAuthError('Email/SĐT hoặc mật khẩu không chính xác. Đăng nhập web chỉ áp dụng cho Quản Lý, Lễ Tân và Huấn Luyện Viên.');
    }
  };

  // Handle register
  const handleSubmitRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      soundEffects.playErrorBeep();
      setAuthError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    const newUser: AuthUser = {
      id: 'user-' + Date.now(),
      name: registerForm.name,
      email: registerForm.email || `${registerForm.phone}@aurafitness.vn`,
      phone: registerForm.phone,
      role: registerForm.role,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
      password: registerForm.password,
      mockOtp: '888999',
      title: 'Hội Viên Mới Đăng Ký',
      description: 'Tài khoản đăng ký trực tuyến'
    };

    setPendingUser(newUser);
    setTab('otp');
    soundEffects.playSuccessBeep();
  };

  // Handle OTP verification
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = otpCode.join('');
    if (entered === '888999' || entered.length === 6) {
      soundEffects.playSuccessBeep();
      const userToSave = pendingUser || TEST_USERS[0];
      MockDatabase.saveCurrentSession({
        id: userToSave.id,
        name: userToSave.name,
        email: userToSave.email,
        phone: userToSave.phone,
        role: userToSave.role,
        avatar: userToSave.avatar
      });
      onLoginSuccess(userToSave);
      onClose();
    } else {
      soundEffects.playErrorBeep();
      setAuthError('Mã OTP không đúng. Vui lòng nhập mã test 888999.');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 580 }}>
        {/* Header Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: 'var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => { setTab('login'); setAuthError(null); }}
              style={{
                background: tab === 'login' ? 'var(--color-primary)' : 'transparent',
                color: tab === 'login' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '6px 16px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Đăng Nhập
            </button>

            <button
              type="button"
              onClick={() => { setTab('register'); setAuthError(null); }}
              style={{
                background: tab === 'register' ? 'var(--color-primary)' : 'transparent',
                color: tab === 'register' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '6px 16px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Đăng Ký Tài Khoản
            </button>

            {pendingUser && (
              <button
                type="button"
                onClick={() => setTab('otp')}
                style={{
                  background: tab === 'otp' ? 'var(--color-primary)' : 'transparent',
                  color: tab === 'otp' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 16px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Xác Thực OTP
              </button>
            )}
          </div>

          <button className="btn-ghost" style={{ padding: 6 }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {authError && (
            <div style={{
              background: 'rgba(255, 61, 0, 0.12)',
              border: '1px solid rgba(255, 61, 0, 0.3)',
              color: 'var(--color-danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              marginBottom: 16
            }}>
              ⚠️ {authError}
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <div>
              <form onSubmit={handleSubmitLogin} style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Email Hoặc Số Điện Thoại *:
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="admin@aurafitness.vn hoặc 0900 111 222"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                    />
                    <Mail size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-dim)' }} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 6 }}>
                    Mật Khẩu *:
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <Lock size={16} style={{ position: 'absolute', right: 12, top: 14, color: 'var(--text-dim)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, fontSize: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useOtpLogin}
                      onChange={(e) => setUseOtpLogin(e.target.checked)}
                    />
                    <span>Xác thực qua mã OTP 2 lớp (2FA)</span>
                  </label>
                  <span style={{ color: 'var(--color-primary)', cursor: 'pointer' }}>Quên mật khẩu?</span>
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                  <LogIn size={16} />
                  <span>Đăng Nhập Vào Hệ Thống</span>
                </button>
              </form>

              {/* 1-Click Fast Login for Testing (Rất tiện cho việc chấm bài / demo) */}
              <div style={{
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Sparkles size={14} color="var(--color-primary)" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Tài khoản nhân sự test nhanh (1-Click Đăng nhập)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TEST_USERS.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickLogin(u)}
                      style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                    >
                      <img src={u.avatar} alt={u.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-primary)' }}>
                          {u.role.toUpperCase()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleSubmitRegister}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Họ và Tên *:
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="VD: Trần Đình Trọng"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Số Điện Thoại *:
                  </label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    placeholder="VD: 0988 123 456"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Địa Chỉ Email:
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Mật Khẩu *:
                  </label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                    Xác Nhận Mật Khẩu *:
                  </label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Nhập lại mật khẩu"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'block', marginBottom: 4 }}>
                  Đăng ký ứng tuyển nhân sự:
                </label>
                <select
                  className="form-input"
                  value={registerForm.role}
                  onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value as UserRole })}
                >
                  <option value="coach">Ứng tuyển Huấn luyện viên (Coach)</option>
                  <option value="receptionist">Nhân viên Lễ tân (Front-Desk Staff)</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.4 }}>
                  💡 Lưu ý: Khách vãng lai (Guest) không cần đăng ký tài khoản. Hội viên tập luyện (Member) sẽ sử dụng Mobile App riêng.
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                <UserPlus size={16} />
                <span>Tiếp Tục Xác Thực Tài Khoản</span>
              </button>
            </form>
          )}

          {/* TAB 3: OTP VERIFICATION */}
          {tab === 'otp' && (
            <form onSubmit={handleVerifyOtp} style={{ textAlign: 'center' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto'
              }}>
                <ShieldCheck size={28} />
              </div>

              <h4 style={{ fontSize: 18, color: '#fff', marginBottom: 6 }}>Xác Thực Mã OTP Bảo Mật</h4>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Hệ thống đã gửi mã xác thực 6 số đến số điện thoại / email của bạn.
              </p>

              {/* 6 OTP Boxes */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                {otpCode.map((digit, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value;
                      const next = [...otpCode];
                      next[i] = val;
                      setOtpCode(next);
                      if (val && e.target.nextElementSibling) {
                        (e.target.nextElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    style={{
                      width: 44,
                      height: 52,
                      fontSize: 22,
                      fontWeight: 800,
                      textAlign: 'center',
                      background: 'var(--bg-app)',
                      border: '2px solid var(--color-primary)',
                      borderRadius: 8,
                      color: '#fff',
                      outline: 'none'
                    }}
                  />
                ))}
              </div>

              <div style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                background: 'rgba(255,255,255,0.04)',
                padding: '8px 12px',
                borderRadius: 6,
                display: 'inline-block',
                marginBottom: 20
              }}>
                💡 Mã OTP test mặc định: <strong style={{ color: 'var(--color-primary)' }}>888999</strong>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                <CheckCircle2 size={16} />
                <span>Xác Nhận & Đăng Nhập Ngay</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
