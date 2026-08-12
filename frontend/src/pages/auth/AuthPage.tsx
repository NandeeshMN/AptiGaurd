import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthBrandPanel } from '../../components/auth/AuthBrandPanel';
import { Logo } from '../../components/auth/Logo';
import { Login } from './Login';
import { Register } from './Register';
import { ForgotPassword } from './ForgotPassword';

export const AuthPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [forgotPrefillEmail, setForgotPrefillEmail] = useState('');

  // Track consecutive clicks to trigger secret admin mode bypass
  const [clickCount, setClickCount] = useState(0);

  const handleLogoClick = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    if (nextCount >= 5) {
      setRegisteredEmail('nandeeshmn12@gmail.com');
      setSuccessMsg('Admin shortcut triggered. Please enter the password to log in.');
      setAuthMode('login');
      setClickCount(0);
    }
    setTimeout(() => { setClickCount(0); }, 2000);
  };

  const handleSwitchToRegister = () => { setAuthMode('register'); setSuccessMsg(null); };
  const handleSwitchToLogin = () => { setAuthMode('login'); setSuccessMsg(null); };

  const handleForgotPassword = (email: string) => {
    setForgotPrefillEmail(email);
    setAuthMode('forgot');
  };

  const handleBackFromForgot = () => {
    setAuthMode('login');
    setSuccessMsg(null);
  };

  const handleRegisterSuccess = (email: string) => {
    setRegisteredEmail(email);
    setSuccessMsg('Account created successfully. Please log in.');
    setAuthMode('login');
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#f3f6fc]">
      {/* Outer rounded card container */}
      <div className="w-full max-w-[1080px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100/80 flex overflow-hidden min-h-[660px]">

        {/* Left Side: Fixed branding panel */}
        <AuthBrandPanel onLogoClick={handleLogoClick} />

        {/* Right Side: Animated Authentication Card Panel */}
        <div className="w-full md:w-[54%] flex-shrink-0 px-6 py-8 sm:px-12 md:px-16 flex flex-col justify-center bg-white relative">

          {/* Top Logo — mobile only */}
          <div className="md:hidden flex flex-col items-center mb-6 flex-shrink-0">
            <Logo className="w-16 h-16 mb-3" onClick={handleLogoClick} />
            <h1 className="text-2xl font-bold tracking-tight text-[#031b4e]">AptiGuard</h1>
            <p className="text-[9px] font-bold tracking-widest text-[#0952cc] uppercase mt-1">
              SECURE COLLEGE ASSESSMENT PLATFORM
            </p>
          </div>

          {/* Stable right-side wrapper */}
          <div className="w-full max-w-sm mx-auto min-h-[480px] flex items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>

              {authMode === 'login' && (
                <motion.div
                  key="login-card"
                  initial={{ opacity: 0, rotateY: -90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: 90 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  style={{ backfaceVisibility: 'hidden', width: '100%' }}
                >
                  <Login
                    onSwitchMode={handleSwitchToRegister}
                    onForgotPassword={handleForgotPassword}
                    defaultEmail={registeredEmail}
                    registrationSuccessMsg={successMsg}
                  />
                </motion.div>
              )}

              {authMode === 'register' && (
                <motion.div
                  key="register-card"
                  initial={{ opacity: 0, rotateY: 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: -90 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  style={{ backfaceVisibility: 'hidden', width: '100%' }}
                >
                  <Register
                    onSwitchMode={handleSwitchToLogin}
                    onRegisterSuccess={handleRegisterSuccess}
                  />
                </motion.div>
              )}

              {authMode === 'forgot' && (
                <motion.div
                  key="forgot-card"
                  initial={{ opacity: 0, rotateY: 90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: -90 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  style={{ backfaceVisibility: 'hidden', width: '100%' }}
                >
                  <ForgotPassword
                    onBack={handleBackFromForgot}
                    prefillEmail={forgotPrefillEmail}
                  />
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuthPage;
