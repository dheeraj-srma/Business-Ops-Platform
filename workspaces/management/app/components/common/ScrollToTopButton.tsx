'use client';
import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScrollToTopButtonProps {
  containerRef?: React.RefObject<HTMLElement | null>;
  threshold?: number;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  containerRef,
  threshold = 280,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = containerRef?.current;
    if (!target) return;

    const handleScroll = () => {
      if (target.scrollTop > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, threshold]);

  const scrollToTop = () => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  if (!isVisible) return null;

  return (
    <button
      id="btn-scroll-to-top"
      type="button"
      onClick={scrollToTop}
      data-tooltip="Scroll to Top"
      data-tooltip-position="left"
      aria-label="Scroll back to top"
      className={cn(
        'fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40',
        'w-10 h-10 sm:w-11 sm:h-11 rounded-full',
        'bg-indigo-600/90 hover:bg-indigo-600 dark:bg-indigo-500/90 dark:hover:bg-indigo-500',
        'text-white shadow-lg hover:shadow-xl shadow-indigo-600/30 dark:shadow-indigo-500/30',
        'hover:scale-110 active:scale-95 transition-all duration-200',
        'border border-white/25 dark:border-white/20 backdrop-blur-md',
        'cursor-pointer flex items-center justify-center group',
        'animate-in fade-in zoom-in-90 duration-200'
      )}
    >
      <ChevronUp className="w-5 h-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
};
