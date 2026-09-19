'use client';

import React, { useState, useEffect } from 'react';

const MESSAGES = [
  'Initializing Secure Gateway Connection...',
  'Connecting to SQLite / Supabase Database...',
  'Synchronizing Active SKU Catalog...',
  'Verifying Pending Orders Ledger...',
  'Optimizing Analytics Caching...',
  'Systems Nominal. Launching WMS...'
];

export default function LoadingScreen({ isFadingOut, activeKeys }: { isFadingOut: boolean; activeKeys: string[] }) {
  const [progress, setProgress] = useState(0);
  const [currentMsgIdx, setCurrentMsgIdx] = useState(0);

  // Message rotation
  useEffect(() => {
    const msgTimer = setInterval(() => {
      setCurrentMsgIdx(prev => {
        if (prev < MESSAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 450);

    return () => clearInterval(msgTimer);
  }, []);

  // Smooth pseudo-progress bar simulation
  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev < 92) {
          return prev + Math.floor(Math.random() * 8) + 2;
        }
        return prev;
      });
    }, 120);

    return () => clearInterval(progressTimer);
  }, []);

  // Set progress to 100% when activeKeys (excluding app_init or overall) matches completion or fading out
  useEffect(() => {
    if (isFadingOut) {
      setProgress(100);
    }
  }, [isFadingOut]);

  return (
    <div className={`loading-screen-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="loading-container">
        
        {/* Animated Neon Hexagonal Steel Logo */}
        <div className="logo-glow-wrapper">
          <svg className="glowing-logo" viewBox="0 0 100 100" width="90" height="90">
            <defs>
              <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Outer Hexagon */}
            <polygon 
              points="50,5 90,28 90,72 50,95 10,72 10,28" 
              fill="none" 
              stroke="url(#metalGrad)" 
              strokeWidth="4"
              strokeLinejoin="round"
              filter="url(#glow)"
            />
            {/* Inner Hexagon Ring */}
            <polygon 
              points="50,15 82,33 82,67 50,85 18,67 18,33" 
              fill="none" 
              stroke="rgba(255, 255, 255, 0.1)" 
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Bold Stylized Metal "N" */}
            <path 
              d="M 32,70 L 32,30 L 46,30 L 68,70 L 68,30 M 32,30 H 44 M 56,70 H 68" 
              fill="none" 
              stroke="#f8fafc" 
              strokeWidth="6" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            {/* Center chevron accent */}
            <path 
              d="M 45,45 L 50,52 L 55,45" 
              fill="none" 
              stroke="#6366f1" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
        </div>

        {/* Company Title */}
        <div className="loading-title-wrap">
          <h1 className="loading-title">NALKA METALS</h1>
          <p className="loading-subtitle">OPERATIONAL ADMIN CENTER</p>
        </div>

        {/* Custom Progress Bar */}
        <div className="progress-bar-container">
          <div className="progress-bar-glow" style={{ width: `${progress}%` }}></div>
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>

        {/* Dynamic Console Logs */}
        <div className="console-log-area">
          <div className="console-line current">
            <span className="console-prompt">&gt;</span> 
            <span className="console-text">{MESSAGES[currentMsgIdx]}</span>
            <span className="cursor-blink">|</span>
          </div>
          
          <div className="console-details">
            {activeKeys.length > 0 && activeKeys.includes('app_init') ? (
              <span className="detail-item">Initializing interface components...</span>
            ) : activeKeys.length > 0 ? (
              <span className="detail-item">Loading live dataset: {activeKeys.map(k => `[${k}]`).join(', ')}</span>
            ) : (
              <span className="detail-item text-green">Establishing database connection: Success</span>
            )}
          </div>
        </div>

        {/* Percentage Display */}
        <div className="percentage-display">
          <span>SYSTEM LOADING: {progress}%</span>
        </div>

      </div>
    </div>
  );
}
