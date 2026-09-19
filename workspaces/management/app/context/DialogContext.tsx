'use client';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Info,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

export type DialogType = 'warning' | 'info' | 'confirmation' | 'success' | 'danger';

export interface DialogOptions {
  type?: DialogType;
  title?: string;
  message: React.ReactNode;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface DialogState extends DialogOptions {
  isOpen: boolean;
  type: DialogType;
}

export interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<boolean>;
  showWarning: (messageOrOptions: string | Omit<DialogOptions, 'type'>) => Promise<boolean>;
  showInfo: (messageOrOptions: string | Omit<DialogOptions, 'type'>) => Promise<boolean>;
  showConfirm: (messageOrOptions: string | Omit<DialogOptions, 'type'>) => Promise<boolean>;
  showSuccess: (messageOrOptions: string | Omit<DialogOptions, 'type'>) => Promise<boolean>;
  showError: (messageOrOptions: string | Omit<DialogOptions, 'type'>) => Promise<boolean>;
  closeDialog: (result?: boolean) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: 'info',
    message: '',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeDialog = useCallback(
    (result: boolean = false) => {
      setDialog((prev) => ({ ...prev, isOpen: false }));
      if (resolverRef.current) {
        resolverRef.current(result);
        resolverRef.current = null;
      }
    },
    []
  );

  const showDialog = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        isOpen: true,
        type: options.type || 'info',
        title: options.title,
        message: options.message,
        description: options.description,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        isDestructive: options.isDestructive,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
      });
    });
  }, []);

  const showWarning = useCallback(
    (messageOrOptions: string | Omit<DialogOptions, 'type'>): Promise<boolean> => {
      const options: DialogOptions =
        typeof messageOrOptions === 'string'
          ? {
              type: 'warning',
              title: 'Warning',
              message: messageOrOptions,
              confirmText: 'Acknowledge',
            }
          : {
              type: 'warning',
              title: messageOrOptions.title || 'Warning',
              confirmText: messageOrOptions.confirmText || 'Acknowledge',
              ...messageOrOptions,
            };
      return showDialog(options);
    },
    [showDialog]
  );

  const showInfo = useCallback(
    (messageOrOptions: string | Omit<DialogOptions, 'type'>): Promise<boolean> => {
      const options: DialogOptions =
        typeof messageOrOptions === 'string'
          ? {
              type: 'info',
              title: 'Information',
              message: messageOrOptions,
              confirmText: 'Got it',
            }
          : {
              type: 'info',
              title: messageOrOptions.title || 'Information',
              confirmText: messageOrOptions.confirmText || 'Got it',
              ...messageOrOptions,
            };
      return showDialog(options);
    },
    [showDialog]
  );

  const showConfirm = useCallback(
    (messageOrOptions: string | Omit<DialogOptions, 'type'>): Promise<boolean> => {
      const options: DialogOptions =
        typeof messageOrOptions === 'string'
          ? {
              type: 'confirmation',
              title: 'Please Confirm',
              message: messageOrOptions,
              confirmText: 'Confirm',
              cancelText: 'Cancel',
            }
          : {
              type: 'confirmation',
              title: messageOrOptions.title || 'Please Confirm',
              confirmText: messageOrOptions.confirmText || 'Confirm',
              cancelText: messageOrOptions.cancelText || 'Cancel',
              ...messageOrOptions,
            };
      return showDialog(options);
    },
    [showDialog]
  );

  const showSuccess = useCallback(
    (messageOrOptions: string | Omit<DialogOptions, 'type'>): Promise<boolean> => {
      const options: DialogOptions =
        typeof messageOrOptions === 'string'
          ? {
              type: 'success',
              title: 'Operation Successful',
              message: messageOrOptions,
              confirmText: 'OK',
            }
          : {
              type: 'success',
              title: messageOrOptions.title || 'Operation Successful',
              confirmText: messageOrOptions.confirmText || 'OK',
              ...messageOrOptions,
            };
      return showDialog(options);
    },
    [showDialog]
  );

  const showError = useCallback(
    (messageOrOptions: string | Omit<DialogOptions, 'type'>): Promise<boolean> => {
      const options: DialogOptions =
        typeof messageOrOptions === 'string'
          ? {
              type: 'danger',
              title: 'Action Error',
              message: messageOrOptions,
              confirmText: 'Dismiss',
            }
          : {
              type: 'danger',
              title: messageOrOptions.title || 'Action Error',
              confirmText: messageOrOptions.confirmText || 'Dismiss',
              ...messageOrOptions,
            };
      return showDialog(options);
    },
    [showDialog]
  );

  // Keyboard navigation: Escape to cancel/close, Enter to confirm
  useEffect(() => {
    if (!dialog.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.onCancel) dialog.onCancel();
        closeDialog(false);
      } else if (e.key === 'Enter') {
        // Prevent enter if the user is focused on cancel button
        if (document.activeElement === cancelButtonRef.current) {
          return;
        }
        e.preventDefault();
        if (dialog.onConfirm) dialog.onConfirm();
        closeDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog.isOpen, dialog.onCancel, dialog.onConfirm, closeDialog]);

  // Focus primary action when opened
  useEffect(() => {
    if (dialog.isOpen) {
      const timer = setTimeout(() => {
        if (dialog.isDestructive && cancelButtonRef.current) {
          // For destructive dialogs, default focus to cancel for safety
          cancelButtonRef.current.focus();
        } else if (confirmButtonRef.current) {
          confirmButtonRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [dialog.isOpen, dialog.isDestructive]);

  const handleConfirm = () => {
    if (dialog.onConfirm) dialog.onConfirm();
    closeDialog(true);
  };

  const handleCancel = () => {
    if (dialog.onCancel) dialog.onCancel();
    closeDialog(false);
  };

  // Determine styling based on dialog type (simple, light, clean, minimal)
  const getTypeConfig = () => {
    switch (dialog.type) {
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2.2]" />,
          iconBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
          btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white',
          defaultTitle: 'Warning',
          defaultConfirmText: 'OK',
        };
      case 'confirmation':
        if (dialog.isDestructive) {
          return {
            icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[2.2]" />,
            iconBg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
            btnPrimary: 'bg-rose-600 hover:bg-rose-700 text-white',
            defaultTitle: 'Confirm',
            defaultConfirmText: 'Confirm',
          };
        }
        return {
          icon: <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 stroke-[2.2]" />,
          iconBg: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
          btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600',
          defaultTitle: 'Confirm',
          defaultConfirmText: 'Confirm',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-indigo-600 dark:text-indigo-400 stroke-[2.2]" />,
          iconBg: 'bg-cyan-50 dark:bg-indigo-50 dark:bg-indigo-950/40 text-cyan-600 dark:text-indigo-600 dark:text-indigo-400',
          btnPrimary: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900',
          defaultTitle: 'Success',
          defaultConfirmText: 'OK',
        };
      case 'danger':
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[2.2]" />,
          iconBg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
          btnPrimary: 'bg-rose-600 hover:bg-rose-700 text-white',
          defaultTitle: 'Error',
          defaultConfirmText: 'Dismiss',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.2]" />,
          iconBg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
          btnPrimary: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900',
          defaultTitle: 'Information',
          defaultConfirmText: 'OK',
        };
    }
  };

  const config = getTypeConfig();
  const title = dialog.title || config.defaultTitle;
  const confirmText = dialog.confirmText || config.defaultConfirmText;
  const isConfirmation = dialog.type === 'confirmation';

  return (
    <DialogContext.Provider
      value={{
        showDialog,
        showWarning,
        showInfo,
        showConfirm,
        showSuccess,
        showError,
        closeDialog,
      }}
    >
      {children}

      {/* Custom Popup Modal with Blurred Background */}
      {dialog.isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-popup-title"
          >
            {/* Clean, Light Background Blur Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/30 dark:bg-black/50 backdrop-blur-xs cursor-pointer transition-opacity animate-in fade-in duration-150"
              onClick={handleCancel}
              aria-hidden="true"
              title="Click outside to dismiss"
            />

            {/* Simple, Clean & Minimal Popup Card */}
            <div
              id="custom-popup-box"
              className={cn(
                'relative w-full max-w-[360px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl',
                'border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 overflow-hidden z-10',
                'text-slate-900 dark:text-slate-100 transition-all duration-150',
                'animate-in zoom-in-95 fade-in duration-150'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                {/* Subtle, Minimal Icon Badge */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    config.iconBg
                  )}
                >
                  {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="custom-popup-title"
                      className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-snug break-words"
                    >
                      {title}
                    </h3>

                    <button
                      onClick={handleCancel}
                      className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md transition-colors cursor-pointer -mr-1 -mt-1"
                      title="Close (Esc)"
                      aria-label="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Message Body */}
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300/90 leading-relaxed break-words whitespace-pre-line">
                    {dialog.message}
                  </div>

                  {/* Optional Secondary Detail/Description */}
                  {dialog.description && (
                    <div className="mt-2.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all">
                      {dialog.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Minimal Clean Action Buttons */}
              <div className="mt-4 pt-1 flex items-center justify-end gap-2">
                {isConfirmation && (
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {dialog.cancelText || 'Cancel'}
                  </button>
                )}

                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={handleConfirm}
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer shadow-2xs active:scale-95',
                    config.btnPrimary
                  )}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
