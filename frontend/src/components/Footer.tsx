import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full flex-shrink-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md py-3.5 px-4 sm:px-6 md:px-8 select-none shadow-[0_-1px_4px_rgba(0,0,0,0.03)] z-30">
      <div className="max-w-[1200px] mx-auto flex justify-end">
        <div className="flex flex-col items-center text-center space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            Designed and Developed by
          </p>
          
          <a
            href="https://nandeeshmn.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-sm font-extrabold text-[#031b4e] hover:text-[#0952cc] transition-colors leading-tight"
          >
            Nandeesh M N
          </a>

          <div className="flex items-center justify-center space-x-2.5 pt-0.5">
            {/* LinkedIn Logo */}
            <a
              href="https://www.linkedin.com/in/nandeeshmn/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              title="LinkedIn Profile"
              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 text-slate-500 hover:text-[#0952cc] flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            </a>

            {/* Portfolio Logo */}
            <a
              href="https://nandeeshmn.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Portfolio"
              title="Portfolio Website"
              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 text-slate-500 hover:text-[#0952cc] flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30"
            >
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </a>

            {/* GitHub Logo */}
            <a
              href="https://github.com/NandeeshMN/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="GitHub Profile"
              className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 text-slate-500 hover:text-[#0952cc] flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#0952cc]/30"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
