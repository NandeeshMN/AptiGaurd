import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loginSchema } from '../../schemas/authSchemas';
import type { LoginInput } from '../../schemas/authSchemas';
import { AuthInput } from '../../components/auth/AuthInput';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { AuthButton } from '../../components/auth/AuthButton';
import { useAuth } from '../../context/AuthContext';
import { getFriendlyErrorMessage } from '../../config/errorHelper';

interface LoginProps {
  onSwitchMode: () => void;
  onForgotPassword: (email: string) => void;
  defaultEmail?: string;
  registrationSuccessMsg?: string | null;
}

export const Login: React.FC<LoginProps> = ({
  onSwitchMode,
  onForgotPassword,
  defaultEmail = '',
  registrationSuccessMsg = null,
}) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: defaultEmail,
      password: '',
    },
  });

  // Pre-fill email if provided (e.g. after successful signup)
  useEffect(() => {
    if (defaultEmail) {
      setValue('email', defaultEmail);
    }
  }, [defaultEmail, setValue]);

  // Sync parent registration success message to local state
  useEffect(() => {
    if (registrationSuccessMsg) {
      setSuccessMsg(registrationSuccessMsg);
      setErrorMsg(null);
    }
  }, [registrationSuccessMsg]);

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await login(data);
      navigate('/dashboard');
    } catch (error: any) {
      setErrorMsg(getFriendlyErrorMessage(error));
      setIsLoading(false);
    }
  };

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const email = getValues('email');
    onForgotPassword(email || '');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full"
    >
      {/* Top Welcome Badge */}
      <div className="self-start mb-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-[#eef2f6] text-[#475569] border border-slate-200/50">
          Welcome back
        </span>
      </div>

      {/* Headings */}
      <h2 className="text-[26px] font-bold tracking-tight text-slate-900 leading-tight mb-2">
        Log in to your account
      </h2>
      <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
        Continue your aptitude assessment and stay on track with your placement preparation.
      </p>

      {/* Success Banner */}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AuthInput
          id="email"
          label="Email address"
          placeholder="Enter your email address"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordInput
          id="password"
          label="Password"
          placeholder="Enter your password"
          showForgotPassword
          error={errors.password?.message}
          {...register('password')}
          onForgotPasswordClick={handleForgotPasswordClick}
        />

        <div className="pt-2">
          <AuthButton type="submit" isLoading={isLoading}>
            {isLoading ? 'Logging in...' : 'Log in →'}
          </AuthButton>
        </div>
      </form>

      {/* Footer Navigation Link */}
      <div className="mt-6 text-center">
        <p className="text-[13px] text-slate-500">
          New here?{' '}
          <button
            type="button"
            onClick={onSwitchMode}
            className="font-bold text-[#0952cc] hover:underline focus:outline-none"
          >
            Create account
          </button>
        </p>
      </div>
    </motion.div>
  );
};
