'use client';

import React from 'react';

interface GlassmorphicModuleLoaderProps {
  isLoading: boolean;
  moduleName?: string;
}

export function GlassmorphicModuleLoader({ isLoading }: GlassmorphicModuleLoaderProps) {
  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-md transition-all duration-300 select-none"
    >
      {/* Frosted Glass Window Frame */}
      <div className="relative w-full max-w-[380px] mx-4 rounded-2xl bg-slate-900/90 border border-slate-700/60 shadow-[0_25px_65px_rgba(0,0,0,0.7)] backdrop-blur-2xl overflow-hidden ring-1 ring-white/10 flex flex-col">
        {/* Window Titlebar with macOS Traffic Lights */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800/80 bg-slate-950/30">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
        </div>

        {/* Window Body */}
        <div className="px-8 pt-7 pb-9 flex flex-col items-center justify-center gap-4 text-center">
          {/* "Loading..." Text */}
          <span className="text-sm font-medium tracking-wide text-slate-300">
            Loading...
          </span>

          {/* Horizontal Loading Bar */}
          <div className="w-full max-w-[270px] h-1.5 bg-slate-800/90 rounded-full overflow-hidden relative border border-slate-700/50">
            <div className="absolute top-0 bottom-0 w-28 bg-gradient-to-r from-transparent via-sky-400 to-transparent rounded-full shadow-[0_0_10px_rgba(99, 102, 241, 0.5)] animate-loader-sweep" />
          </div>
        </div>
      </div>
    </div>
  );
}

