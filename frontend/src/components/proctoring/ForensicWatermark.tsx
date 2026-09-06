import React, { useState, useEffect, useMemo } from 'react';

export interface ForensicWatermarkProps {
  candidateName: string;
  uucmsNo: string;
  testTitle?: string;
  securityCode?: string;
}

export const ForensicWatermark: React.FC<ForensicWatermarkProps> = ({
  candidateName,
  uucmsNo,
  testTitle = 'AptiGuard Assessment',
  securityCode,
}) => {
  // Live dynamic timestamp updated every 10 seconds
  const [timeStr, setTimeStr] = useState<string>(() =>
    new Date().toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStr(
        new Date().toLocaleTimeString('en-US', {
          hour12: true,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  const displaySecCode = useMemo(() => {
    if (securityCode) return securityCode;
    const raw = `${uucmsNo}-${candidateName}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `SEC-${Math.abs(hash).toString(36).toUpperCase().padStart(6, '0')}`;
  }, [securityCode, uucmsNo, candidateName]);

  const cleanName = candidateName || 'Candidate';
  const cleanUucms = uucmsNo || 'UUCMS-VERIFIED';

  const watermarkLine = `🔒 ${cleanName}  •  ${cleanUucms}  •  ${testTitle}  •  ${dateStr} ${timeStr}  •  ${displaySecCode}`;

  // Generate 8 repeating diagonal rows
  const rows = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);

  return (
    <aside
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-20 overflow-hidden flex flex-col justify-around opacity-90"
    >
      <div className="absolute inset-0 flex flex-col justify-around -rotate-12 scale-125 transform-gpu origin-center">
        {rows.map((rIdx) => (
          <div
            key={rIdx}
            className="flex items-center space-x-12 whitespace-nowrap text-slate-900/[0.07] font-mono font-extrabold text-[12px] sm:text-[13px] tracking-wider uppercase"
            style={{
              transform: `translateX(${rIdx % 2 === 0 ? '-30px' : '-180px'})`,
            }}
          >
            <span>{watermarkLine}</span>
            <span>{watermarkLine}</span>
            <span>{watermarkLine}</span>
            <span>{watermarkLine}</span>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ForensicWatermark;
