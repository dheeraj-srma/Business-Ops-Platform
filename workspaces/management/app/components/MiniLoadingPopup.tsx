'use client';

import React from 'react';

interface MiniLoadingPopupProps {
  isFadingOut: boolean;
  message?: string;
  activeKeys?: string[];
}

export default function MiniLoadingPopup({
  isFadingOut,
  message = 'Compiling & Rendering Page Contents...',
  activeKeys = []
}: MiniLoadingPopupProps) {
  return (
    <div className={`mini-loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="mini-loading-card">
        {/* Animated Glowing Hex Header Icon */}
        <div className="mini-logo-wrap">
          <svg className="mini-glowing-logo" viewBox="0 0 100 100" width="44" height="44">
            <defs>
              <linearGradient id="miniMetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <filter id="miniGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Outer Spinning Hex Ring */}
            <polygon 
              points="50,5 90,28 90,72 50,95 10,72 10,28" 
              fill="none" 
              stroke="url(#miniMetalGrad)" 
              strokeWidth="5"
              strokeLinejoin="round"
              filter="url(#miniGlow)"
              className="spin-slow"
              style={{ transformOrigin: '50px 50px' }}
            />
            {/* Stylized Metal "N" */}
            <path 
              d="M 34,68 L 34,32 L 48,32 L 66,68 L 66,32" 
              fill="none" 
              stroke="#f8fafc" 
              strokeWidth="6" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
        </div>

        {/* Floating Live Badge */}
        <div className="mini-badge">
          <span className="mini-pulse-dot"></span>
          <span>COMPILING &amp; RENDERING</span>
        </div>

        {/* Dynamic Main Title / Status */}
        <div className="mini-title-wrap">
          <h3 className="mini-loading-message">{message}</h3>
          <p className="mini-loading-subtext">Executing pipeline &amp; loading graph visualizations...</p>
        </div>

        {/* CSS Animated Neon Progress Line */}
        <div className="mini-progress-track">
          <div className="mini-progress-fill-animated"></div>
        </div>

        {/* Active Keys Detail Indicator */}
        {activeKeys.length > 0 && (
          <div className="mini-keys-detail">
            <span>Active task: {activeKeys.map(k => `[${k.replace('module_/api/', '').replace('analytics_', '')}]`).join(' ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
