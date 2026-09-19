import React, { useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X
} from 'lucide-react';

export type ModalType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface ModalDetailItem {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export interface InfoModalProps {
  isOpen: boolean;
  type?: ModalType;
  title: string;
  message: string | React.ReactNode;
  details?: ModalDetailItem[];
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onClose: () => void;
  onConfirm?: () => void;
  autoCloseMs?: number;
}

export default function InfoModal({
  isOpen,
  type = 'info',
  title,
  message,
  primaryButtonText = 'OK',
  secondaryButtonText,
  onClose,
  onConfirm,
  autoCloseMs
}: InfoModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    let timer: any;
    if (autoCloseMs && autoCloseMs > 0) {
      timer = setTimeout(() => {
        onClose();
      }, autoCloseMs);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, onClose, autoCloseMs]);

  if (!isOpen) return null;

  const config = {
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold',
      iconBox: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60'
    },
    error: {
      icon: <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
      btn: 'bg-rose-600 hover:bg-rose-700 text-white font-semibold',
      iconBox: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60'
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      btn: 'bg-amber-600 hover:bg-amber-700 text-white font-bold',
      iconBox: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60'
    },
    info: {
      icon: <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold',
      iconBox: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60'
    },
    confirm: {
      icon: <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold',
      iconBox: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60'
    }
  }[type];

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen min-h-screen flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
      {/* Click outside backdrop */}
      <div className="fixed inset-0 w-full h-full" onClick={onClose} />

      {/* Modern Nalka Minimal Modal Box */}
      <div
        className="relative w-full max-w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl z-10 space-y-4 animate-in zoom-in-95 duration-100"
      >
        {/* Header: Small icon + Title + Close Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${config.iconBox}`}>
              {config.icon}
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {typeof message === 'string' ? (
            <p className="whitespace-pre-line">{message}</p>
          ) : (
            message
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          {secondaryButtonText && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {secondaryButtonText}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer active:scale-95 ${config.btn}`}
          >
            {primaryButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
