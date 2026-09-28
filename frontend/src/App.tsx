import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import { MockDatabase } from './mocks/mockData';
import { Navbar } from './components/layout/Navbar';
import { ReceptionistDashboard } from './features/receptionist/ReceptionistDashboard';
import { CoachDashboard } from './features/coach/CoachDashboard';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { GuestLandingPage } from './features/guest/GuestLandingPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AuthModal } from './features/auth/AuthModal';
import { FloatingAIChatbot } from './features/ai-assistant/FloatingAIChatbot';
import { soundEffects } from './services/audioService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('guest');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [viewMode, setViewMode] = useState<'main' | 'settings'>('main');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  // Initialize session from LocalStorage
  useEffect(() => {
    const saved = MockDatabase.getCurrentSession();
    if (saved) {
      setCurrentUser(saved);
      setCurrentRole(saved.role);
      syncDefaultTab(saved.role);
    } else {
      // Default to public guest landing page when not logged in
      setCurrentUser(null);
      setCurrentRole('guest');
      setActiveTab('home');
    }
  }, []);

  const syncDefaultTab = (role: UserRole) => {
    switch (role) {
      case 'receptionist':
        setActiveTab('checkin');
        break;
      case 'coach':
        setActiveTab('schedule');
        break;
      case 'admin':
        setActiveTab('analytics');
        break;
      case 'guest':
        setActiveTab('home');
        break;
    }
  };

  const handleOpenQuickCheckIn = () => {
    setViewMode('main');
    setActiveTab('checkin');
    soundEffects.playSuccessBeep();
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    setViewMode('main');
    syncDefaultTab(user.role);
    soundEffects.playSuccessBeep();
  };

  const handleLogout = () => {
    MockDatabase.clearSession();
    setCurrentUser(null);
    setCurrentRole('guest');
    setViewMode('main');
    setActiveTab('home');
    soundEffects.playSuccessBeep();
    alert('Bạn đã đăng xuất tài khoản thành công!');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Athletic Sports Center Top Navbar */}
      <Navbar
        currentRole={currentRole}
        currentUser={currentUser}
        onOpenQuickCheckIn={handleOpenQuickCheckIn}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setViewMode('main');
          setActiveTab(tab);
        }}
        onOpenLogin={() => {
          setAuthModalTab('login');
          setIsAuthModalOpen(true);
        }}
        onOpenRegister={() => {
          setAuthModalTab('register');
          setIsAuthModalOpen(true);
        }}
        onOpenSettings={() => setViewMode('settings')}
        onLogout={handleLogout}
      />

      {/* Main Content Rendered Dynamically */}
      <main style={{ flex: 1 }}>
        {viewMode === 'settings' ? (
          <SettingsPage
            currentUser={currentUser}
            onBack={() => setViewMode('main')}
            onLogout={handleLogout}
            onUpdateUser={(updated) => setCurrentUser(updated)}
          />
        ) : (
          <>
            {currentRole === 'receptionist' && (
              <ReceptionistDashboard
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {currentRole === 'coach' && (
              <CoachDashboard
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {currentRole === 'admin' && (
              <AdminDashboard
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {currentRole === 'guest' && (
              <GuestLandingPage
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onOpenRegister={() => {
                  setAuthModalTab('register');
                  setIsAuthModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Persistent Athletic Footer */}
      <footer style={{
        background: 'var(--bg-panel)',
        borderTop: 'var(--border-subtle)',
        padding: '24px var(--space-xl)',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: 'var(--max-content-width)',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          fontSize: 13,
          color: 'var(--text-muted)'
        }}>
          <div>
            <strong style={{ color: '#fff' }}>AURA FITNESS CENTER</strong> • Sports Center Management System (WDP301 FPT)
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Design tokens: <strong style={{ color: 'var(--color-primary)' }}>#FE7413 Freeletics</strong></span>
            <span>Authentication: <strong>Role-Driven Session Active</strong></span>
            <span style={{ color: 'var(--color-success)' }}>● Zero-Backend Mock Engine Active</span>
            <a 
              href="#schedule" 
              onClick={(e) => {
                e.preventDefault();
                setViewMode('main');
                setActiveTab('schedule');
                const el = document.getElementById('schedule');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              style={{ color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Xem Lịch Lớp Công Khai
            </a>
          </div>
        </div>
      </footer>

      {/* Auth Modal for Login, Register, and OTP */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* AI Assistant Chatbot Floating Bubble */}
      <FloatingAIChatbot />
    </div>
  );
}
