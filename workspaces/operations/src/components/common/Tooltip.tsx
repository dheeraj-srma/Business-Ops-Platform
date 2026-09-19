import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  shortcut?: string;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

interface Coords {
  x: number;
  y: number;
  actualPosition: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Calculates the optimal position for a tooltip avoiding viewport boundaries.
 */
function calculatePosition(
  triggerRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  preferred: TooltipPosition | string = 'auto',
  offset: number = 7
): Coords {
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;

  let pos = preferred;

  if (pos === 'auto') {
    if (triggerRect.top > tooltipHeight + offset + 8) {
      pos = 'top';
    } else if (vpHeight - triggerRect.bottom > tooltipHeight + offset + 8) {
      pos = 'bottom';
    } else if (triggerRect.left > tooltipWidth + offset + 8) {
      pos = 'left';
    } else {
      pos = 'right';
    }
  }

  let x = 0;
  let y = 0;
  let actualPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

  if (pos === 'top') {
    actualPosition = 'top';
    x = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    y = triggerRect.top - tooltipHeight - offset;
    if (y < 8 && vpHeight - triggerRect.bottom > tooltipHeight + offset) {
      actualPosition = 'bottom';
      y = triggerRect.bottom + offset;
    }
  } else if (pos === 'bottom') {
    actualPosition = 'bottom';
    x = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    y = triggerRect.bottom + offset;
    if (y + tooltipHeight > vpHeight - 8 && triggerRect.top > tooltipHeight + offset) {
      actualPosition = 'top';
      y = triggerRect.top - tooltipHeight - offset;
    }
  } else if (pos === 'left') {
    actualPosition = 'left';
    x = triggerRect.left - tooltipWidth - offset;
    y = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
    if (x < 8 && vpWidth - triggerRect.right > tooltipWidth + offset) {
      actualPosition = 'right';
      x = triggerRect.right + offset;
    }
  } else if (pos === 'right') {
    actualPosition = 'right';
    x = triggerRect.right + offset;
    y = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
    if (x + tooltipWidth > vpWidth - 8 && triggerRect.left > tooltipWidth + offset) {
      actualPosition = 'left';
      x = triggerRect.left - tooltipWidth - offset;
    }
  }

  // Constrain inside viewport
  x = Math.max(8, Math.min(x, vpWidth - tooltipWidth - 8));
  y = Math.max(8, Math.min(y, vpHeight - tooltipHeight - 8));

  return { x, y, actualPosition };
}

/**
 * Reusable React Tooltip Wrapper Component
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'auto',
  shortcut,
  delay = 200,
  disabled = false,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled || !content) return;
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const estimatedWidth = 140;
        const estimatedHeight = 30;
        const pos = calculatePosition(rect, estimatedWidth, estimatedHeight, position);
        setCoords(pos);
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const accuratePos = calculatePosition(
        triggerRect,
        tooltipRect.width,
        tooltipRect.height,
        position
      );
      setCoords(accuratePos);
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onClick={hideTooltip}
      className={cn('inline-flex items-center', className)}
    >
      {children}

      {isVisible &&
        coords &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              left: `${coords.x}px`,
              top: `${coords.y}px`,
            }}
            className={cn(
              'z-[9999] pointer-events-none select-none max-w-xs',
              'px-2.5 py-1.5 rounded-lg text-[11px] font-medium leading-snug',
              'bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 dark:text-slate-100',
              'border border-slate-700/80 dark:border-slate-800/80 shadow-xl backdrop-blur-md',
              'ring-1 ring-white/10 flex items-center gap-1.5',
              'animate-in fade-in zoom-in-95 duration-150'
            )}
            role="tooltip"
          >
            <span>{content}</span>
            {shortcut && (
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-800 dark:bg-slate-900 text-slate-300 rounded border border-slate-700 dark:border-slate-700/80 shadow-2xs">
                {shortcut}
              </kbd>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

interface GlobalTooltipState {
  visible: boolean;
  content: string;
  shortcut?: string;
  position: TooltipPosition;
  x: number;
  y: number;
  actualPosition: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Global Tooltip Provider that listens for `data-tooltip` and `title`
 * attributes throughout the entire document, smoothly upgrading them to themed tooltips.
 */
export const GlobalTooltipProvider: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const [tooltipState, setTooltipState] = useState<GlobalTooltipState | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const tooltipElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerEnter = (e: PointerEvent) => {
      // Find element with data-tooltip or title
      const target = (e.target as HTMLElement)?.closest('[data-tooltip], [title]') as HTMLElement | null;
      if (!target) return;

      // Gracefully upgrade native title to data-tooltip to suppress browser native tooltip
      if (target.hasAttribute('title')) {
        const rawTitle = target.getAttribute('title');
        if (rawTitle && rawTitle.trim()) {
          target.setAttribute('data-tooltip', rawTitle.trim());
          target.setAttribute('data-tooltip-original-title', rawTitle);
          target.removeAttribute('title');
        }
      }

      const content = target.getAttribute('data-tooltip');
      if (!content || !content.trim()) return;

      const shortcut = target.getAttribute('data-tooltip-shortcut') || undefined;
      const position = (target.getAttribute('data-tooltip-position') as TooltipPosition) || 'auto';
      const delay = parseInt(target.getAttribute('data-tooltip-delay') || '200', 10);

      currentTargetRef.current = target;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        if (currentTargetRef.current === target && target.isConnected) {
          const rect = target.getBoundingClientRect();
          const estimatedWidth = Math.min(280, Math.max(70, content.length * 6.5 + (shortcut ? 40 : 0)));
          const estimatedHeight = 30;
          const pos = calculatePosition(rect, estimatedWidth, estimatedHeight, position);

          setTooltipState({
            visible: true,
            content,
            shortcut,
            position,
            x: pos.x,
            y: pos.y,
            actualPosition: pos.actualPosition,
          });
        }
      }, delay);
    };

    const handlePointerLeave = (e: PointerEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-tooltip], [data-tooltip-original-title]') as HTMLElement | null;
      if (target && target.hasAttribute('data-tooltip-original-title')) {
        const orig = target.getAttribute('data-tooltip-original-title');
        if (orig) target.setAttribute('title', orig);
        target.removeAttribute('data-tooltip-original-title');
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      currentTargetRef.current = null;
      setTooltipState(null);
    };

    const handlePointerDown = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      currentTargetRef.current = null;
      setTooltipState(null);
    };

    const handleScroll = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      currentTargetRef.current = null;
      setTooltipState(null);
    };

    document.addEventListener('pointerenter', handlePointerEnter, true);
    document.addEventListener('pointerleave', handlePointerLeave, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('pointerenter', handlePointerEnter, true);
      document.removeEventListener('pointerleave', handlePointerLeave, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Recalculate accurately once measured
  useEffect(() => {
    if (tooltipState?.visible && currentTargetRef.current && tooltipElementRef.current) {
      const triggerRect = currentTargetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipElementRef.current.getBoundingClientRect();
      const accuratePos = calculatePosition(
        triggerRect,
        tooltipRect.width,
        tooltipRect.height,
        tooltipState.position
      );
      if (accuratePos.x !== tooltipState.x || accuratePos.y !== tooltipState.y) {
        setTooltipState((prev) => (prev ? { ...prev, ...accuratePos } : null));
      }
    }
  }, [tooltipState?.visible]);

  return (
    <>
      {children}
      {tooltipState &&
        tooltipState.visible &&
        createPortal(
          <div
            ref={tooltipElementRef}
            style={{
              position: 'fixed',
              left: `${tooltipState.x}px`,
              top: `${tooltipState.y}px`,
            }}
            className={cn(
              'z-[9999] pointer-events-none select-none max-w-xs',
              'px-2.5 py-1.5 rounded-lg text-[11px] font-medium leading-snug',
              'bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 dark:text-slate-100',
              'border border-slate-700/80 dark:border-slate-800/80 shadow-xl backdrop-blur-md',
              'ring-1 ring-white/10 flex items-center gap-1.5',
              'animate-in fade-in zoom-in-95 duration-150'
            )}
            role="tooltip"
          >
            <span>{tooltipState.content}</span>
            {tooltipState.shortcut && (
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-800 dark:bg-slate-900 text-slate-300 rounded border border-slate-700 dark:border-slate-700/80 shadow-2xs">
                {tooltipState.shortcut}
              </kbd>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
