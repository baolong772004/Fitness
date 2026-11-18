import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { api, ApiError, ApiUser, tokenStorage, STORAGE_KEYS } from '../../services/api';
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
  Loader2,
  ShieldCheck,
  RefreshCw,
  ArrowLeft
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

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('');

  // Register form & OTP verification state
  const [registerStep, setRegisterStep] = useState<'form' | 'verify'>('form');
  const [registerForm, setRegisterForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerCooldown, setRegisterCooldown] = useState(0);

  // Forgot password state (1: email -> 2: OTP -> 3: new password)
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotCooldown, setForgotCooldown] = useState(0);

  // Processing state
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Synchronize internal tab state when initialTab or isOpen changes
  React.useEffect(() => {
    if (isOpen) {
      setTab(tokenStorage.getUser()?.mustChangePassword ? 'change' : initialTab);
      setRegisterStep('form');
      setRegisterOtp('');
      setForgotStep(1);
      setForgotOtp('');
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setAuthError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialTab]);

  // Countdown timer for OTP resend cooldown
  React.useEffect(() => {
    if (registerCooldown <= 0 && forgotCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRegisterCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setForgotCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [registerCooldown, forgotCooldown]);

  if (!isOpen) return null;

  const switchTab = (nextTab: 'login' | 'register' | 'forgot') => {
    setTab(nextTab);
    setAuthError(null);
    setSuccessMsg(null);
    if (nextTab === 'register') {
      setRegisterStep('form');
      setRegisterOtp('');
    }
    if (nextTab === 'forgot') {
      setForgotStep(1);
      setForgotOtp('');
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

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
        } catch (err) {
          console.warn('Lỗi đồng bộ ca trực:', err);
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
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        const unverifiedEmail = String(err.data?.email || loginIdentifier.trim().toLowerCase());
        setPendingVerifyEmail(unverifiedEmail);
        setRegisterOtp('');
        setTab('register');
        setRegisterStep('verify');
        setAuthError(err.message || 'Email chưa được xác thực. Vui lòng nhập mã OTP đã gửi về email.');
        return;
      }
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

  // Step 1 of Guest Registration: submit info -> backend sends OTP email
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMsg(null);

    if (registerForm.name.trim().length < 2) {
      soundEffects.playErrorBeep();
      setAuthError('Họ và tên cần có ít nhất 2 ký tự.');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      soundEffects.playErrorBeep();
      setAuthError('Mật khẩu xác nhận không khớp. Vui lòng thử lại.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.auth.register({
        fullName: registerForm.name.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
        phone: registerForm.phone.trim() || undefined
      });

      soundEffects.playSuccessBeep();
      setPendingVerifyEmail(res.email || registerForm.email.trim().toLowerCase());
      setRegisterOtp('');
      setRegisterCooldown(60);
      setRegisterStep('verify');
      setSuccessMsg('Mã OTP 6 số đã được gửi về email của bạn. Vui lòng kiểm tra hộp thư để xác thực.');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      if (err instanceof ApiError && err.code === 'OTP_COOLDOWN' && err.data?.retryAfterSeconds) {
        setRegisterCooldown(Number(err.data.retryAfterSeconds));
      }
      setAuthError(err.message || 'Đăng ký thất bại. Email có thể đã tồn tại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 of Guest Registration: verify 6-digit OTP -> activate account & login
  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMsg(null);

    const trimmedOtp = registerOtp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      soundEffects.playErrorBeep();
      setAuthError('Vui lòng nhập đủ 6 chữ số mã OTP.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.auth.verifyRegisterOtp({
        email: pendingVerifyEmail,
        otp: trimmedOtp
      });

      soundEffects.playSuccessBeep();
      setSuccessMsg('Xác thực email & đăng ký thành công!');
      const frontendUser = mapBackendUserToFrontend(data.user);
      setTimeout(() => {
        onLoginSuccess(frontendUser);
        onClose();
      }, 500);
    } catch (err: any) {
      soundEffects.playErrorBeep();
      setAuthError(err.message || 'Xác thực OTP thất bại. Vui lòng kiểm tra lại mã.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendRegisterOtp = async () => {
    if (registerCooldown > 0 || isLoading) return;
    setAuthError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      await api.auth.resendRegisterOtp(pendingVerifyEmail);
      soundEffects.playSuccessBeep();
      setRegisterCooldown(60);
      setSuccessMsg('Mã OTP mới đã được gửi về email của bạn.');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      if (err instanceof ApiError && err.code === 'OTP_COOLDOWN' && err.data?.retryAfterSeconds) {
        setRegisterCooldown(Number(err.data.retryAfterSeconds));
      }
      setAuthError(err.message || 'Không thể gửi lại mã OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password (Step 1: send OTP -> Step 2: verify OTP -> Step 3: set new password)
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (forgotStep === 1) {
        await api.auth.forgotPassword(forgotEmail.trim());
        soundEffects.playSuccessBeep();
        setForgotOtp('');
        setForgotCooldown(60);
        setForgotStep(2);
        setSuccessMsg('Mã OTP 6 số đã được gửi về email của bạn.');
      } else if (forgotStep === 2) {
        const trimmedOtp = forgotOtp.trim();
        if (!/^\d{6}$/.test(trimmedOtp)) {
          soundEffects.playErrorBeep();
          setAuthError('Vui lòng nhập đủ 6 chữ số mã OTP.');
          setIsLoading(false);
          return;
        }
        const res = await api.auth.verifyForgotPasswordOtp({
          email: forgotEmail.trim(),
          otp: trimmedOtp
        });
        soundEffects.playSuccessBeep();
        setResetToken(res.data.resetToken);
        setNewPassword('');
        setConfirmNewPassword('');
        setForgotStep(3);
        setSuccessMsg('Xác thực OTP thành công! Hãy đặt mật khẩu mới.');
      } else {
        if (newPassword.length < 6) {
          soundEffects.playErrorBeep();
          setAuthError('Mật khẩu mới cần ít nhất 6 ký tự.');
          setIsLoading(false);
          return;
        }
        if (newPassword !== confirmNewPassword) {
          soundEffects.playErrorBeep();
          setAuthError('Mật khẩu xác nhận không khớp.');
          setIsLoading(false);
          return;
        }
        await api.auth.resetPassword({
          resetToken,
          newPassword
        });
        soundEffects.playSuccessBeep();
        setSuccessMsg('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
        const emailToFill = forgotEmail.trim();
        setTimeout(() => {
          setTab('login');
          setForgotStep(1);
          setForgotOtp('');
          setResetToken('');
          setNewPassword('');
          setConfirmNewPassword('');
          setLoginIdentifier(emailToFill);
          setLoginPassword('');
          setSuccessMsg('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
        }, 800);
      }
    } catch (err: any) {
      soundEffects.playErrorBeep();
      if (err instanceof ApiError && err.code === 'OTP_COOLDOWN' && err.data?.retryAfterSeconds) {
        setForgotCooldown(Number(err.data.retryAfterSeconds));
      }
      setAuthError(err.message || 'Không thể xử lý yêu cầu đặt lại mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendForgotOtp = async () => {
    if (forgotCooldown > 0 || isLoading) return;
    setAuthError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      await api.auth.forgotPassword(forgotEmail.trim());
      soundEffects.playSuccessBeep();
      setForgotCooldown(60);
      setSuccessMsg('Mã OTP mới đã được gửi về email của bạn.');
    } catch (err: any) {
      soundEffects.playErrorBeep();
      if (err instanceof ApiError && err.code === 'OTP_COOLDOWN' && err.data?.retryAfterSeconds) {
        setForgotCooldown(Number(err.data.retryAfterSeconds));
      }
      setAuthError(err.message || 'Không thể gửi lại mã OTP.');
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
                {tab === 'register' && (registerStep === 'verify' ? 'Xác Thực Email OTP' : 'Tạo Tài Khoản Mới')}
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
        {tab !== 'change' && (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--aura-border)',
            background: 'var(--bg-card)'
          }}>
            <button
              type="button"
              onClick={() => switchTab('login')}
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
              type="button"
              onClick={() => switchTab('register')}
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
          </div>
        )}

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
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
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
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'change' && (
            <form onSubmit={handleFirstPasswordChange} style={{ display: 'grid', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Tài khoản do lễ tân tạo đang dùng mật khẩu tạm. Hãy đổi mật khẩu để tiếp tục sử dụng hệ thống.
              </p>
              <label>Mật khẩu tạm thời
                <input className="form-input" type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
              </label>
              <label>Mật khẩu mới
                <input className="form-input" type="password" required value={newAccountPassword} onChange={e => setNewAccountPassword(e.target.value)} autoComplete="new-password" />
              </label>
              <label>Xác nhận mật khẩu mới
                <input className="form-input" type="password" required value={confirmAccountPassword} onChange={e => setConfirmAccountPassword(e.target.value)} autoComplete="new-password" />
              </label>
              <button type="submit" disabled={isLoading} className="btn-primary">
                {isLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu và tiếp tục'}
              </button>
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
                    onClick={(e) => {
                      e.preventDefault();
                      setForgotEmail(loginIdentifier.trim());
                      switchTab('forgot');
                    }}
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
                  onClick={() => switchTab('register')}
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

          {/* TAB 2: REGISTER (STEP 1: FORM, STEP 2: VERIFY EMAIL OTP) */}
          {tab === 'register' && registerStep === 'form' && (
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
                    minLength={2}
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
                    <span>Đang gửi mã OTP...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Tiếp Tục & Nhận Mã OTP</span>
                  </>
                )}
              </button>

              {/* Switch to Login link */}
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => switchTab('login')}
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

          {tab === 'register' && registerStep === 'verify' && (
            <form onSubmit={handleVerifyRegisterOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-primary-light)',
                border: '1px solid var(--aura-border)',
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.5
              }}>
                Chúng tôi đã gửi mã OTP gồm 6 chữ số đến <strong>{pendingVerifyEmail}</strong>. Mã có hiệu lực trong 10 phút.
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                  Mã xác thực OTP (6 chữ số) *
                </label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    className="form-input"
                    style={{
                      paddingLeft: 40,
                      letterSpacing: '0.35em',
                      fontWeight: 700,
                      fontSize: 18,
                      textAlign: 'center'
                    }}
                    value={registerOtp}
                    onChange={(e) => setRegisterOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || registerOtp.length !== 6}
                className="btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Xác Thực Email & Đăng Nhập</span>
                  </>
                )}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterStep('form');
                    setAuthError(null);
                    setSuccessMsg(null);
                  }}
                  className="btn-ghost"
                  style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowLeft size={14} />
                  <span>Quay lại</span>
                </button>

                <button
                  type="button"
                  disabled={registerCooldown > 0 || isLoading}
                  onClick={handleResendRegisterOtp}
                  className="btn-ghost"
                  style={{
                    fontSize: 13,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: registerCooldown > 0 ? 'var(--text-muted)' : 'var(--color-primary)'
                  }}
                >
                  <RefreshCw size={14} />
                  <span>{registerCooldown > 0 ? `Gửi lại OTP (${registerCooldown}s)` : 'Gửi lại mã OTP'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD (STEP 1: EMAIL -> STEP 2: OTP -> STEP 3: NEW PASSWORD) */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {forgotStep === 1 && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                    Nhập địa chỉ Email đã đăng ký
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
              )}

              {forgotStep === 2 && (
                <>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-primary-light)',
                    border: '1px solid var(--aura-border)',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    lineHeight: 1.5
                  }}>
                    Nhập mã OTP 6 chữ số đã được gửi tới <strong>{forgotEmail.trim()}</strong> để xác thực trước khi đặt mật khẩu mới.
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                      Mã xác thực OTP *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <ShieldCheck size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        maxLength={6}
                        className="form-input"
                        style={{
                          paddingLeft: 40,
                          letterSpacing: '0.35em',
                          fontWeight: 700,
                          fontSize: 18,
                          textAlign: 'center'
                        }}
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                      />
                    </div>
                  </div>
                </>
              )}

              {forgotStep === 3 && (
                <>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                      Mật khẩu mới *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                      <input
                        type="password"
                        required
                        minLength={6}
                        className="form-input"
                        style={{ paddingLeft: 40 }}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                      Nhập lại mật khẩu mới *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                      <input
                        type="password"
                        required
                        minLength={6}
                        className="form-input"
                        style={{ paddingLeft: 40 }}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading || (forgotStep === 2 && forgotOtp.length !== 6)}
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
                    {forgotStep === 2 ? <ShieldCheck size={16} /> : <KeyRound size={16} />}
                    <span>
                      {forgotStep === 1 && 'Gửi Mã OTP'}
                      {forgotStep === 2 && 'Xác Thực Mã OTP'}
                      {forgotStep === 3 && 'Cập Nhật Mật Khẩu Mới'}
                    </span>
                  </>
                )}
              </button>

              {forgotStep === 2 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setAuthError(null);
                      setSuccessMsg(null);
                    }}
                    className="btn-ghost"
                    style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <ArrowLeft size={14} />
                    <span>Đổi email</span>
                  </button>

                  <button
                    type="button"
                    disabled={forgotCooldown > 0 || isLoading}
                    onClick={handleResendForgotOtp}
                    className="btn-ghost"
                    style={{
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: forgotCooldown > 0 ? 'var(--text-muted)' : 'var(--color-primary)'
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>{forgotCooldown > 0 ? `Gửi lại OTP (${forgotCooldown}s)` : 'Gửi lại mã OTP'}</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => switchTab('login')}
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
