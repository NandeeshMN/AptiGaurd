import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { registerSchema } from '../../schemas/authSchemas';
import type { RegisterInput } from '../../schemas/authSchemas';
import { AuthInput } from '../../components/auth/AuthInput';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { AuthButton } from '../../components/auth/AuthButton';
import { useAuth } from '../../context/AuthContext';
import { getFriendlyErrorMessage } from '../../config/errorHelper';

interface RegisterProps {
  onSwitchMode: () => void;
  onRegisterSuccess: (email: string) => void;
}

export const Register: React.FC<RegisterProps> = ({
  onSwitchMode,
  onRegisterSuccess,
}) => {
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await registerUser(data);
      setSuccessMsg('Account created successfully!');
      // Wait slightly, then notify parent wrapper of success returning the email
      setTimeout(() => {
        onRegisterSuccess(data.email);
      }, 1000);
    } catch (error: any) {
      setErrorMsg(getFriendlyErrorMessage(error));
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full"
    >
      {/* Top Badge */}
      <div className="self-start mb-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-[#eef2f6] text-[#475569] border border-slate-200/50">
          Get started
        </span>
      </div>

      {/* Headings */}
      <h2 className="text-[26px] font-bold tracking-tight text-slate-900 leading-tight mb-2">
        Create your account
      </h2>
      <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
        Join AptiGuard and get ready for secure college aptitude assessments.
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <div className="!mb-2">
          <AuthInput
            id="fullName"
            label="Full name"
            placeholder="Enter your full name"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
        </div>

        <div className="!mb-2">
          <AuthInput
            id="email"
            label="Email address"
            placeholder="Enter your email address"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div className="!mb-2">
          <AuthInput
            id="uucmsNo"
            label="UUCMS Number"
            placeholder="Enter your university UUCMS number"
            error={errors.uucmsNo?.message}
            {...register('uucmsNo')}
          />
        </div>

        <div className="!mb-2">
          <PasswordInput
            id="password"
            label="Password"
            placeholder="Create a password"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <div className="!mb-2">
          <PasswordInput
            id="confirmPassword"
            label="Confirm password"
            placeholder="Confirm your password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <div className="pt-1">
          <AuthButton type="submit" isLoading={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </AuthButton>
        </div>
      </form>

      {/* Footer Navigation Link */}
      <div className="mt-6 text-center">
        <p className="text-[13px] text-slate-500">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchMode}
            className="font-bold text-[#0952cc] hover:underline focus:outline-none"
          >
            Log in
          </button>
        </p>
      </div>
    </motion.div>
  );
};
