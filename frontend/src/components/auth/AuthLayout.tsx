import React from 'react';
import { AuthBrandPanel } from './AuthBrandPanel';
import { Logo } from './Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#f3f6fc]">
      {/* Outer rounded card container imitating the reference device look */}
      <div className="w-full max-w-[1080px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100/80 flex overflow-hidden min-h-[640px]">
        {/* Left Panel: Branding marketing sidebar */}
        <AuthBrandPanel />

        {/* Right Panel: Content panel */}
        <div className="w-full md:w-[54%] p-6 sm:p-12 md:p-16 flex flex-col justify-center bg-white relative">
          
          {/* Top Logo - only visible on mobile/tablet when left panel is hidden */}
          <div className="md:hidden flex flex-col items-center mb-8">
            <Logo className="w-16 h-16 mb-3" />
            <h1 className="text-2xl font-bold tracking-tight text-[#031b4e]">
              AptiGuard
            </h1>
            <p className="text-[9px] font-bold tracking-widest text-[#0952cc] uppercase mt-1">
              SECURE COLLEGE ASSESSMENT PLATFORM
            </p>
          </div>

          {/* Form wrapper */}
          <div className="w-full max-w-sm mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
