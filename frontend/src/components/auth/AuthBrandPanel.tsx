import React from 'react';
import { Logo } from './Logo';

interface AuthBrandPanelProps {
  onLogoClick?: () => void;
}

export const AuthBrandPanel: React.FC<AuthBrandPanelProps> = ({ onLogoClick }) => {
  return (
    <div className="relative hidden md:flex w-[46%] flex-shrink-0 bg-[#031b4e] text-white p-12 flex-col justify-between overflow-hidden select-none">
      {/* Decorative subtle dark pattern background */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] rounded-full bg-blue-500 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] rounded-full bg-sky-500 blur-[120px]" />
        
        {/* Subtle grid background to simulate premium tech design */}
        <div 
          className="w-full h-full" 
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }} 
        />
      </div>

      {/* Top Section: Logo & Name */}
      <div className="relative z-10 flex flex-col items-center text-center mt-12">
        <Logo className="w-24 h-24 mb-6" onClick={onLogoClick} />
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          AptiGuard
        </h1>
        <p className="text-[10px] font-bold tracking-widest text-blue-300 uppercase">
          SECURE COLLEGE ASSESSMENT PLATFORM
        </p>
      </div>

      {/* Middle Section: Main Catchphrase & Description */}
      <div className="relative z-10 my-auto text-center px-4">
        <h2 className="text-2xl lg:text-3xl font-bold leading-tight mb-4 text-white">
          Assess your skills.
          <br />
          Build your confidence.
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
          Take secure and distraction-free aptitude assessments designed to help you prepare for placements and demonstrate your skills.
        </p>
      </div>

      {/* Bottom Section: Key features list */}
      <div className="relative z-10 mb-8 space-y-4 px-6 self-center w-full max-w-sm">
        <div className="flex items-start space-x-3">
          <span className="text-blue-400 font-semibold text-base mt-0.5">✓</span>
          <span className="text-sm text-slate-200">Secure online examinations</span>
        </div>
        <div className="flex items-start space-x-3">
          <span className="text-blue-400 font-semibold text-base mt-0.5">✓</span>
          <span className="text-sm text-slate-200">Distraction-free testing environment</span>
        </div>
        <div className="flex items-start space-x-3">
          <span className="text-blue-400 font-semibold text-base mt-0.5">✓</span>
          <span className="text-sm text-slate-200">Fair and reliable assessment</span>
        </div>
      </div>
    </div>
  );
};
