import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface ActionConfirmationProps {
  message: string;
  type?: 'success' | 'warning' | 'error';
  duration?: number;
  onClose: () => void;
}

export const ActionConfirmation: React.FC<ActionConfirmationProps> = ({
  message,
  type = 'success',
  duration = 2500,
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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px] animate-in fade-in duration-200 select-none pointer-events-none">
      <div className="bg-white text-slate-900 px-8 py-7 rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col items-center justify-center space-y-3 min-w-[280px] max-w-sm text-center animate-in zoom-in-95 duration-200 pointer-events-auto">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center border ${
            isWarning
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : isError
              ? 'bg-red-50 text-red-600 border-red-200'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}
        >
          {isWarning || isError ? (
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
          ) : (
            <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
          )}
        </div>
        <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{message}</h4>
      </div>
    </div>
  );
};

export default ActionConfirmation;
