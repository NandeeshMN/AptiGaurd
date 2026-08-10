import React, { forwardRef } from 'react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, id, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full mb-2">
        <div className="flex justify-between items-center mb-1.5">
          <label
            htmlFor={id}
            className="text-[13px] font-semibold text-slate-800"
          >
            {label}
          </label>
        </div>
        <input
          id={id}
          type={type}
          ref={ref}
          className={`w-full px-3.5 py-2.5 rounded-lg border bg-[#f8fafc] text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all duration-200 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'
              : 'border-slate-200 focus:border-[#0952cc] focus:ring-1 focus:ring-[#0952cc]/20'
          }`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-500 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = 'AuthInput';
