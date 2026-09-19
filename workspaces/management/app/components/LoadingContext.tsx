'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import LoadingScreen from './LoadingScreen';
import MiniLoadingPopup from './MiniLoadingPopup';

interface LoadingContextType {
  registerLoadingKey: (key: string) => void;
  resolveLoadingKey: (key: string) => void;
  triggerLoading: (message?: string) => void;
  stopLoading: () => void;
  isLoading: boolean;
  isNavLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType>({
  registerLoadingKey: () => {},
  resolveLoadingKey: () => {},
  triggerLoading: () => {},
  stopLoading: () => {},
  isLoading: true,
  isNavLoading: false,
});

export const useLoading = () => useContext(LoadingContext);

function PathnameListener({ onPathChange }: { onPathChange: (url: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    onPathChange(fullPath);
  }, [fullPath, onPathChange]);

  return null;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Dynamic Mini Popup Loading state
  const [isNavLoading, setIsNavLoading] = useState(false);
  const [isMiniFadingOut, setIsMiniFadingOut] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Compiling & Rendering Page Contents...');

  const triggerTimeRef = useRef<number>(0);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and register basic app_init loading block
  useEffect(() => {
    setMounted(true);
    setActiveKeys(prev => new Set(prev).add('app_init'));

    const minDisplayTimer = setTimeout(() => {
      setActiveKeys(prev => {
        const next = new Set(prev);
        next.delete('app_init');
        return next;
      });
    }, 1200);

    const safetyTimer = setTimeout(() => {
      setHasLoadedOnce(true);
      setIsFadingOut(false);
    }, 3500);

    return () => {
      clearTimeout(minDisplayTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  const registerLoadingKey = useCallback((key: string) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const resolveLoadingKey = useCallback((key: string) => {
    setActiveKeys(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const stopLoading = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    const MIN_DISPLAY_MS = 450; // Guaranteed minimum display duration to prevent glitching/flashing
    const elapsed = Date.now() - triggerTimeRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    dismissTimerRef.current = setTimeout(() => {
      setIsMiniFadingOut(true);
      fadeTimerRef.current = setTimeout(() => {
        setIsNavLoading(false);
        setIsMiniFadingOut(false);
      }, 250);
    }, remaining);
  }, []);

  // Instant pipeline trigger called immediately on click
  const triggerLoading = useCallback((message?: string) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    triggerTimeRef.current = Date.now();
    setLoadingMessage(message || 'Compiling & Rendering Page Contents...');
    setIsMiniFadingOut(false);
    setIsNavLoading(true);

    // Safety fallback timeout (prevents hang if page error occurs)
    dismissTimerRef.current = setTimeout(() => {
      stopLoading();
    }, 3000);
  }, [stopLoading]);

  // Route change listener
  const handlePathChange = useCallback((_path: string) => {
    if (!hasLoadedOnce) return;
    requestAnimationFrame(() => {
      stopLoading();
    });
  }, [hasLoadedOnce, stopLoading]);

  // Overall initial loading status
  const isLoading = !mounted || (!hasLoadedOnce && activeKeys.size > 0);

  // Dismiss initial boot loader
  useEffect(() => {
    if (mounted && activeKeys.size === 0 && !hasLoadedOnce) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setHasLoadedOnce(true);
        setIsFadingOut(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mounted, activeKeys, hasLoadedOnce]);

  // Dynamic key resolution for mini loader once app is booted
  useEffect(() => {
    if (hasLoadedOnce && activeKeys.size === 0 && isNavLoading && !isMiniFadingOut) {
      stopLoading();
    }
  }, [hasLoadedOnce, activeKeys, isNavLoading, isMiniFadingOut, stopLoading]);

  return (
    <LoadingContext.Provider
      value={{
        registerLoadingKey,
        resolveLoadingKey,
        triggerLoading,
        stopLoading,
        isLoading,
        isNavLoading,
      }}
    >
      <Suspense fallback={null}>
        <PathnameListener onPathChange={handlePathChange} />
      </Suspense>

      {/* Initial App Boot Loader */}
      {mounted && (!hasLoadedOnce || isFadingOut) && (
        <LoadingScreen isFadingOut={isFadingOut} activeKeys={Array.from(activeKeys)} />
      )}

      {/* Dynamic Mini Popup Loader for Clicks, Tab Changes, Compiling & Rendering */}
      {hasLoadedOnce && (isNavLoading || isMiniFadingOut) && (
        <MiniLoadingPopup
          isFadingOut={isMiniFadingOut}
          message={loadingMessage}
          activeKeys={Array.from(activeKeys)}
        />
      )}

      {/* Main Page Container */}
      <div
        style={{
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.5s ease',
          minHeight: '100vh',
          width: '100%',
        }}
      >
        {children}
      </div>
    </LoadingContext.Provider>
  );
}
