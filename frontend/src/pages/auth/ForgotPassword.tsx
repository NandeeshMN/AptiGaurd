import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, KeyRound, Lock, CheckCircle, ArrowLeft, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface ForgotPasswordProps {
  onBack: () => void;
  prefillEmail?: string;
}

type FPStep = 'email' | 'otp' | 'reset' | 'done';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 120;

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, prefillEmail = '' }) => {
  const [step, setStep] = useState<FPStep>('email');
  const [email, setEmail] = useState(prefillEmail);
  const [emailError, setEmailError] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(0);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState('');
  const [resetting, setResetting] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer]);

  const formatTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  /**
   * STEP 1: Send OTP via Brevo API
   */
  const handleSendOTP = async () => {
    const sanitized = email.trim();
    if (!sanitized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError('');
    setSending(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sanitized }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setEmailError(data.message || 'Failed to send OTP email.');
        return;
      }

      setOtpSent(true);
      setTimer(OTP_EXPIRY_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      console.error('[ForgotPassword] Error sending OTP:', err);
      setEmailError('Network error connecting to backend server.');
    } finally {
      setSending(false);
    }
  };

  /**
   * Resend OTP via Brevo API
   */
  const handleResendOTP = async () => {
    setSending(true);
    setOtpError('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setOtpError(data.message || 'Failed to resend OTP.');
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      setTimer(OTP_EXPIRY_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      console.error('[ForgotPassword] Error resending OTP:', err);
      setOtpError('Network error resending OTP.');
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpError('');
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted.length > 0) {
      e.preventDefault();
      const next = Array(OTP_LENGTH).fill('');
      pasted.split('').forEach((d, i) => {
        next[i] = d;
      });
      setOtp(next);
      otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    }
  };

  /**
   * STEP 2: Verify OTP via Backend
   */
  const handleVerifyOTP = async () => {
    const entered = otp.join('');
    if (entered.length < OTP_LENGTH) {
      setOtpError('Please enter all 6 digits.');
      return;
    }

    if (timer === 0) {
      setOtpError('OTP has expired. Please request a new OTP.');
      return;
    }

    setOtpError('');
    setVerifying(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: entered }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setOtpError(data.message || 'Incorrect OTP code.');
        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
        return;
      }

      setStep('reset');
    } catch (err) {
      console.error('[ForgotPassword] Error verifying OTP:', err);
      setOtpError('Error verifying OTP.');
    } finally {
      setVerifying(false);
    }
  };

  /**
   * STEP 3: Reset Password via Backend & Firebase
   */
  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    setPwError('');
    setResetting(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.join(''),
          newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setPwError(data.message || 'Failed to update password.');
        return;
      }

      setStep('done');

      // Card flips back to Login page immediately after 1.5 seconds
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (err) {
      console.error('[ForgotPassword] Error updating password:', err);
      setPwError('Error updating password.');
    } finally {
      setResetting(false);
    }
  };

  const stepVariants = {
    enter: { opacity: 0, x: 24 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full"
    >
      {/* Back button */}
      {step !== 'done' && (
        <button
          onClick={onBack}
          className="self-start mb-4 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-[#0952cc] transition-colors focus:outline-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Login
        </button>
      )}

      {/* Step Progress Dots */}
      {step !== 'done' && (
        <div className="flex items-center gap-2 mb-6">
          {(['email', 'otp', 'reset'] as FPStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                  step === s
                    ? 'bg-[#0952cc] text-white shadow-md shadow-blue-200'
                    : ['email', 'otp', 'reset'].indexOf(step) > i
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {['email', 'otp', 'reset'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`flex-1 h-px w-8 transition-all duration-300 ${
                    ['email', 'otp', 'reset'].indexOf(step) > i
                      ? 'bg-emerald-400'
                      : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {/* ────── STEP 1: EMAIL ENTRY ────── */}
        {step === 'email' && (
          <motion.div
            key="email-step"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <Mail className="w-5 h-5 text-[#0952cc]" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-slate-900 leading-tight">
                  Forgot Password
                </h2>
                <p className="text-[12px] text-slate-500">
                  Enter your email to receive a 6-digit OTP code via Brevo.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                  placeholder="Enter your registered email"
                  className={`w-full px-3.5 py-2.5 rounded-lg border bg-[#f8fafc] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all duration-200 ${
                    emailError
                      ? 'border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-400/20'
                      : 'border-slate-200 focus:border-[#0952cc] focus:ring-1 focus:ring-[#0952cc]/20'
                  }`}
                  disabled={sending}
                  autoFocus
                />
                {emailError && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{emailError}</p>
                )}
              </div>

              <button
                onClick={handleSendOTP}
                disabled={sending || !email.trim()}
                className="w-full py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-sm font-bold rounded-lg transition-colors duration-200 disabled:opacity-60 flex items-center justify-center gap-2 focus:outline-none shadow-xs"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending OTP via Brevo...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" /> Send OTP
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ────── STEP 2: OTP VERIFICATION ────── */}
        {step === 'otp' && (
          <motion.div
            key="otp-step"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <KeyRound className="w-5 h-5 text-[#0952cc]" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-slate-900 leading-tight">
                  Verify OTP Code
                </h2>
                <p className="text-[12px] text-slate-500">
                  Enter the 6-digit OTP sent to{' '}
                  <span className="font-bold text-slate-700">{email}</span>
                </p>
              </div>
            </div>

            {/* Timer */}
            <div
              className={`mb-4 mt-1 text-[11px] font-bold flex items-center gap-1 ${
                timer < 30 && timer > 0
                  ? 'text-red-500'
                  : timer === 0
                  ? 'text-red-600'
                  : 'text-slate-500'
              }`}
            >
              {timer > 0 ? (
                <>
                  <span className="font-mono text-[13px]">{formatTimer(timer)}</span> remaining
                </>
              ) : (
                <span>OTP expired — please resend.</span>
              )}
            </div>

            {/* OTP Input Boxes */}
            <div className="flex items-center gap-2 mb-4" onPaste={handleOtpPaste}>
              {Array(OTP_LENGTH)
                .fill(null)
                .map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otp[i]}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-11 h-12 text-center text-lg font-bold border-2 rounded-xl bg-[#f8fafc] text-slate-900 focus:outline-none transition-all duration-200 ${
                      otpError
                        ? 'border-red-400 bg-red-50 text-red-600'
                        : otp[i]
                        ? 'border-[#0952cc] bg-blue-50 text-[#0952cc]'
                        : 'border-slate-200 focus:border-[#0952cc] focus:ring-2 focus:ring-[#0952cc]/20'
                    }`}
                  />
                ))}
            </div>

            {otpError && <p className="mb-3 text-xs text-red-500 font-semibold">{otpError}</p>}

            <div className="space-y-2">
              <button
                onClick={handleVerifyOTP}
                disabled={verifying || otp.join('').length < OTP_LENGTH}
                className="w-full py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-sm font-bold rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> Verify OTP
                  </>
                )}
              </button>

              <button
                onClick={handleResendOTP}
                disabled={sending || timer > 90}
                className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12px] font-bold rounded-lg transition-colors duration-200 disabled:opacity-40 flex items-center justify-center gap-2 focus:outline-none"
              >
                {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {otpSent ? 'Resend OTP' : 'Send OTP'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ────── STEP 3: NEW PASSWORD ────── */}
        {step === 'reset' && (
          <motion.div
            key="reset-step"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <Lock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold tracking-tight text-slate-900 leading-tight">
                  New Password
                </h2>
                <p className="text-[12px] text-slate-500">OTP verified ✓ — set your new password.</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* New Password */}
              <div>
                <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPwError('');
                    }}
                    placeholder="Min. 8 characters"
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg border bg-[#f8fafc] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all duration-200 ${
                      pwError
                        ? 'border-red-300'
                        : 'border-slate-200 focus:border-[#0952cc] focus:ring-1 focus:ring-[#0952cc]/20'
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {newPassword && (
                  <div className="mt-1.5 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          newPassword.length >= i * 3
                            ? i <= 2
                              ? 'bg-red-400'
                              : i === 3
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                            : 'bg-slate-100'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPwError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                    placeholder="Re-enter new password"
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg border bg-[#f8fafc] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all duration-200 ${
                      pwError
                        ? 'border-red-300'
                        : 'border-slate-200 focus:border-[#0952cc] focus:ring-1 focus:ring-[#0952cc]/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword && (
                  <p
                    className={`mt-1 text-[11px] font-semibold ${
                      confirmPassword === newPassword ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {confirmPassword === newPassword
                      ? '✓ Passwords match'
                      : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              {pwError && <p className="text-xs text-red-500 font-semibold">{pwError}</p>}

              <button
                onClick={handleResetPassword}
                disabled={resetting || !newPassword || !confirmPassword}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none"
              >
                {resetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Update Password
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ────── DONE / CARD FLIP BACK TO LOGIN ────── */}
        {step === 'done' && (
          <motion.div
            key="done-step"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center justify-center py-10 text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center"
            >
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </motion.div>
            <h2 className="text-[22px] font-bold text-slate-900">Password Updated!</h2>
            <p className="text-sm text-slate-500 max-w-[240px]">
              Your password has been reset. Redirecting to login...
            </p>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#0952cc]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ForgotPassword;
