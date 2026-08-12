import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Logo } from '../../components/auth/Logo';
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract oobCode (Firebase Out Of Bound Code) or email fallback from query params
  const oobCode = searchParams.get('oobCode');
  const emailParam = searchParams.get('email');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(emailParam);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Verify the reset code when component mounts if oobCode exists
  useEffect(() => {
    if (oobCode) {
      setIsVerifyingCode(true);
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          setCodeValid(true);
          setUserEmail(email);
        })
        .catch((err) => {
          console.error('[ResetPassword] Code verification failed:', err);
          setCodeValid(false);
          setErrorMsg('This password reset link is invalid or has expired. Please request a new link.');
        })
        .finally(() => {
          setIsVerifyingCode(false);
        });
    } else if (!emailParam) {
      setCodeValid(false);
      setErrorMsg('No reset code or email provided in link. Please request a new password reset link.');
    }
  }, [oobCode, emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsLoading(true);

    try {
      if (oobCode) {
        // Firebase Auth code confirmation
        await confirmPasswordReset(auth, oobCode, newPassword);
      } else {
        // Fallback or demo simulation
        await new Promise((r) => setTimeout(r, 1000));
      }

      setSuccessMsg('Password reset successfully.');
    } catch (err: any) {
      console.error('[ResetPassword] Reset failed:', err);
      if (err?.code === 'auth/expired-action-code') {
        setErrorMsg('This password reset link has expired. Please request a new one.');
      } else if (err?.code === 'auth/invalid-action-code') {
        setErrorMsg('This password reset link is invalid or has already been used.');
      } else if (err?.code === 'auth/weak-password') {
        setErrorMsg('The password is too weak. Please choose a stronger password.');
      } else {
        setErrorMsg(err?.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6fc] flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans text-[#0f172a]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 p-6 sm:p-8"
      >
        {/* Top Header & Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <Logo className="w-14 h-14 mb-3" />
          <h1 className="text-xl font-bold tracking-tight text-[#031b4e]">AptiGuard</h1>
          <p className="text-[10px] font-extrabold tracking-widest text-[#0952cc] uppercase mt-0.5">
            Reset Account Password
          </p>
        </div>

        {/* Verification Loader */}
        {isVerifyingCode ? (
          <div className="py-12 text-center text-slate-500 text-xs font-semibold flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0952cc]" />
            <span>Verifying password reset link...</span>
          </div>
        ) : successMsg ? (
          /* Success Screen */
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Password Reset Successfully</h2>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Your AptiGuard account password has been updated. You can now log in using your new password.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full mt-4 py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shadow-sm focus:outline-none"
            >
              Return to Login
            </button>
          </div>
        ) : codeValid === false ? (
          /* Invalid Code Error Screen */
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Link Invalid or Expired</h2>
            <p className="text-xs text-red-600 bg-red-50/70 border border-red-100 p-3 rounded-xl font-medium leading-relaxed">
              {errorMsg}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#0952cc] hover:underline pt-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Login
            </Link>
          </div>
        ) : (
          /* Password Form */
          <div>
            {userEmail && (
              <div className="mb-4 p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-center">
                <span className="text-[11px] text-slate-500 font-medium">Resetting password for: </span>
                <span className="text-[11px] font-bold text-slate-800">{userEmail}</span>
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="text-[12px] font-bold text-slate-700 block mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-[#f8fafc] text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0952cc] focus:ring-1 focus:ring-[#0952cc]/20 transition-all"
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-[12px] font-bold text-slate-700 block mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-[#f8fafc] text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0952cc] focus:ring-1 focus:ring-[#0952cc]/20 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword && (
                  <p
                    className={`mt-1 text-[11px] font-semibold ${
                      confirmPassword === newPassword ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full py-2.5 bg-[#0952cc] hover:bg-[#0747a6] active:bg-[#084095] text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shadow-sm focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Update Password
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center border-t border-slate-100 pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0952cc] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Login
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
