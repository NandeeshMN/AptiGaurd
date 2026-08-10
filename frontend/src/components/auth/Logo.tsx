import React from 'react';

interface LogoProps {
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = 'w-16 h-16',
  imgClassName = 'w-10 h-10 object-contain',
  onClick
}) => {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-center bg-white rounded-2xl shadow-md border border-slate-100/80 overflow-hidden cursor-pointer ${className}`}
    >
      <img 
        src="/favicon.png" 
        alt="AptiGuard Shield Logo" 
        className={imgClassName}
      />
    </div>
  );
};
export default Logo;
