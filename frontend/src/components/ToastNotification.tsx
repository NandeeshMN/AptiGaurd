import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface ToastNotificationProps {
  message: string;
  type?: 'success' | 'warning' | 'error';
  duration?: number;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  type = 'success',
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const isWarning = type === 'warning';
  const isError = type === 'error';

  return (
    <div className="fixed top-6 right-6 z-[9999] flex items-center space-x-3 bg-[#031b4e] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/50 animate-in fade-in slide-in-from-top-4 duration-300 select-none">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${
          isWarning
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            : isError
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        }`}
      >
        {isWarning || isError ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
      </div>
      <span className="text-xs font-bold font-sans tracking-wide leading-snug">{message}</span>
    </div>
  );
};

export default ToastNotification;
