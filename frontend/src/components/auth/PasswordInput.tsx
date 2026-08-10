import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  showForgotPassword?: boolean;
  onForgotPasswordClick?: (e: React.MouseEvent) => void;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, id, showForgotPassword, onForgotPasswordClick, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = (e: React.MouseEvent) => {
      e.preventDefault();
      setShowPassword(!showPassword);
    };

    return (
      <div className="w-full mb-2">
        <div className="flex justify-between items-center mb-1.5">
          <label
            htmlFor={id}
            className="text-[13px] font-semibold text-slate-800"
          >
            {label}
          </label>
          {showForgotPassword && (
            <button
              type="button"
              onClick={onForgotPasswordClick}
              className="text-[11px] font-semibold text-[#0952cc] hover:underline focus:outline-none"
            >
              Forgot password?
            </button>
          )}
        </div>
        <div className="relative">
          <input
            id={id}
            type={showPassword ? 'text' : 'password'}
            ref={ref}
            className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg border bg-[#f8fafc] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all duration-200 ${
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
                : 'border-slate-200 focus:border-[#0952cc] focus:ring-1 focus:ring-[#0952cc]/20'
            }`}
            {...props}
          />
          <button
            type="button"
            onClick={toggleVisibility}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-500 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
