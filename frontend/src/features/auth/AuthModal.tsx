import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { api, ApiUser, tokenStorage, STORAGE_KEYS } from '../../services/api';
import { soundEffects } from '../../services/audioService';
import { 
  X, 
  LogIn, 
  UserPlus, 
  KeyRound, 
  Sparkles, 
  Phone, 
  Mail, 
  Lock, 
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register' | 'forgot';
  onLoginSuccess: (user: User) => void;
}

// Convert Backend User model to Frontend User format
export function mapBackendUserToFrontend(apiUser: ApiUser): User {
  let mappedRole: UserRole = 'guest';
  const role = (apiUser.role || '').toUpperCase().trim();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER') {
    mappedRole = 'admin';
  } else if (role === 'STAFF' || role === 'RECEPTIONIST' || role === 'LE_TAN' || role === 'FRONT_DESK') {
    mappedRole = 'staff';
  } else if (role === 'COACH' || role === 'TRAINER' || role === 'PT' || role === 'HLV') {
    mappedRole = 'coach';
  } else if (role === 'MEMBER' || role === 'HOI_VIEN' || role === 'CUSTOMER' || role === 'USER') {
    mappedRole = 'member';
  } else {
    mappedRole = 'member';
  }

  return {
    id: String(apiUser.id),
    name: apiUser.fullName || apiUser.email.split('@')[0],
    email: apiUser.email,
    phone: apiUser.phone || '',
    role: mappedRole,
    avatar: apiUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'
  };
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
  onLoginSuccess
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot' | 'change'>(initialTab);

  // Synchronize internal tab state when initialTab or isOpen changes
  React.useEffect(() => {
    if (isOpen) {
      setTab(tokenStorage.getUser()?.mustChangePassword ? 'change' : initialTab);
      setAuthError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialTab]);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('');

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  // Processing state
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle standard login via Backend REST API
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const data = await api.auth.login({
        email: loginIdentifier.trim(),
        password: loginPassword
      });

      if (data.user.mustChangePassword) {
        setCurrentPassword(loginPassword);
        setLoginPassword('');
        setTab('change');
        return;
      }

      // Nếu là role nhân viên quầy (STAFF) / admin, tự động đồng bộ ca trực trong background
      const roleUpper = (data.user?.role || '').toUpperCase();
      if (roleUpper === 'STAFF' || roleUpper === 'RECEPTIONIST' || roleUpper === 'ADMIN') {
        localStorage.setItem('aura_is_staff_desk', 'true');
        try {
          const shiftRes = await api.staff.getCurrentShift();
          if (shiftRes?.data) {
            localStorage.setItem('aura_current_shift', JSON.stringify(shiftRes.data));
          }
        } catch (e) {
          console.warn('Lỗi đồng bộ ca trực:', e);
        }
      }

      soundEffects.playSuccessBeep();
      setSuccessMsg('Đăng nhập thành công!');
      const frontendUser = mapBackendUserToFrontend(data.user);
      setTimeout(() => {
        onLoginSuccess(frontendUser);
        onClose();
      }, 500);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setAuthError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (newAccountPassword.length < 6 || !/[A-Za-z]/.test(newAccountPassword) || !/\d/.test(newAccountPassword)) {
      setAuthError('Mật khẩu mới cần ít nhất 6 ký tự, gồm chữ và số.');
      return;
    }
    if (newAccountPassword === currentPassword || newAccountPassword === '123456') {
      setAuthError('Mật khẩu mới cần khác mật khẩu tạm thời.');
      return;
    }
    if (newAccountPassword !== confirmAccountPassword) {
      setAuthError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setIsLoading(true);
    try {
      await api.auth.changePassword({ oldPassword: currentPassword, newPassword: newAccountPassword });
      const savedUser = tokenStorage.getUser();
      if (!savedUser) throw new Error('Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.');
      const updatedUser = { ...savedUser, mustChangePassword: false };
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      setCurrentPassword('');
      setNewAccountPassword('');
      setConfirmAccountPassword('');
      onLoginSuccess(mapBackendUserToFrontend(updatedUser));
      onClose();
    } catch (err: any) {
      setAuthError(err.message || 'Không thể đổi mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle register via Backend REST API
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMsg(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      soundEffects.playErrorBeep();
      setAuthError('Mật khẩu xác nhận không khớp. Vui lòng thử lại.');
      return;
    }

    setIsLoading(true);
    try {
      await api.auth.register({
        fullName: registerForm.name.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
        phone: registerForm.phone.trim() || undefined
      });

      // Auto login right after registration
      const loginData = await api.auth.login({
        email: registerForm.email.trim(),
        password: registerForm.password
      });

      soundEffects.playSuccessBeep();
      setSuccessMsg('Đăng ký tài khoản thành công!');
      const frontendUser = mapBackendUserToFrontend(loginData.user);
      setTimeout(() => {
        onLoginSuccess(frontendUser);
        onClose();
      }, 600);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setAuthError(err.message || 'Đăng ký thất bại. Email có thể đã tồn tại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (forgotStep === 1) {
        const res = await api.auth.forgotPassword(forgotEmail.trim());
        setSuccessMsg('Đã tạo mã xác nhận Reset Token thành công!');
        if (res.data?.resetToken) {
          setResetToken(res.data.resetToken);
        }
        setForgotStep(2);
      } else {
        await api.auth.resetPassword({
          resetToken: resetToken.trim(),
          newPassword: newPassword
        });
        soundEffects.playSuccessBeep();
        setSuccessMsg('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
        setTimeout(() => {
          setTab('login');
          setForgotStep(1);
          setLoginIdentifier(forgotEmail);
          setLoginPassword(newPassword);
        }, 1000);
      }
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setAuthError(err.message || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 16px',
          borderBottom: '1px solid var(--aura-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-primary-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, color: 'var(--text-primary)', margin: 0 }}>
                {tab === 'login' && 'Đăng Nhập Tài Khoản'}
                {tab === 'register' && 'Tạo Tài Khoản Mới'}
                {tab === 'forgot' && 'Quên Mật Khẩu'}
                {tab === 'change' && 'Đổi Mật Khẩu Lần Đầu'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Aura Gym & Fitness Club System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={tab === 'change' ? 'Đăng xuất' : 'Đóng'}
            title={tab === 'change' ? 'Đăng xuất' : 'Đóng'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switchers */}
        {tab !== 'change' && <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--aura-border)',
          background: 'var(--bg-card)'
        }}>
          <button
            onClick={() => { setTab('login'); setAuthError(null); }}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === 'login' ? '2.5px solid var(--color-primary)' : 'none',
              color: tab === 'login' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: tab === 'login' ? 700 : 500,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Đăng Nhập
          </button>
          <button
            onClick={() => { setTab('register'); setAuthError(null); }}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === 'register' ? '2.5px solid var(--color-primary)' : 'none',
              color: tab === 'register' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: tab === 'register' ? 700 : 500,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Đăng Ký
          </button>
        </div>}

        {/* Form Body */}
        <div style={{ padding: '24px 28px' }}>
          {/* Notification / Error / Success alerts */}
          {authError && (
            <div style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(198, 40, 40, 0.3)'
            }}>
              <AlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(46, 125, 50, 0.3)'
            }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'change' && (
            <form onSubmit={handleFirstPasswordChange} style={{ display: 'grid', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Tài khoản do lễ tân tạo đang dùng mật khẩu tạm. Hãy đổi mật khẩu để tiếp tục sử dụng hệ thống.</p>
              <label>Mật khẩu tạm thời
                <input className="form-input" type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </label>
              <label>Mật khẩu mới
                <input className="form-input" type="password" required value={newAccountPassword} onChange={e => setNewAccountPassword(e.target.value)} autoComplete="new-password" />
              </label>
              <label>Xác nhận mật khẩu mới
                <input className="form-input" type="password" required value={confirmAccountPassword} onChange={e => setConfirmAccountPassword(e.target.value)} autoComplete="new-password" />
              </label>
              <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu và tiếp tục'}</button>
            </form>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleSubmitLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Email hoặc Tên đăng nhập
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    type="email"
                    required
                    className="form-input"
                    style={{ paddingLeft: 40 }}
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Mật khẩu
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => { e.preventDefault(); setTab('forgot'); }}
                    style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Quên mật khẩu?
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    type="password"
                    required
                    className="form-input"
                    style={{ paddingLeft: 40 }}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>



              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: 8 }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang kết nối API...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Đăng Nhập Ngay</span>
                  </>
                )}
              </button>

              {/* Switch to Register link */}
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setAuthError(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  Đăng ký tài khoản ngay
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleSubmitRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Họ và tên *
                </label>
                <div style={{ position: 'relative' }}>
                  <UserIcon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ paddingLeft: 40 }}
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Email liên hệ *
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    type="email"
                    required
                    className="form-input"
                    style={{ paddingLeft: 40 }}
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="nguyenvana@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Số điện thoại
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    type="tel"
                    className="form-input"
                    style={{ paddingLeft: 40 }}
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    placeholder="0912 345 678"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                    Mật khẩu *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="form-input"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                    Nhập lại mật khẩu *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="form-input"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    placeholder="Nhập lại mật khẩu"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: 8 }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Tạo Tài Khoản & Đăng Nhập</span>
                  </>
                )}
              </button>

              {/* Switch to Login link */}
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setAuthError(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  Đăng nhập ngay
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {forgotStep === 1 ? (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                    Nhập địa chỉ Email đăng ký
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input
                      type="email"
                      required
                      className="form-input"
                      style={{ paddingLeft: 40 }}
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="email@aurafitness.vn"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                      Mã Reset Token
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Dán token tại đây"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                      Mật khẩu mới
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="form-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    <span>{forgotStep === 1 ? 'Lấy Mã Xác Nhận' : 'Cập Nhật Mật Khẩu Mới'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTab('login')}
                className="btn-ghost"
                style={{ width: '100%' }}
              >
                Quay lại Đăng nhập
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
