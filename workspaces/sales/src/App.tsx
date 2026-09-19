import React, { Component, ErrorInfo, ReactNode } from 'react';
import SalesmanPortal from './components/SalesmanPortal';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught terminal error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Portal Display Error</h1>
                <p className="text-xs text-slate-400">An unexpected rendering issue occurred.</p>
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-rose-300 overflow-x-auto">
              {this.state.error?.toString()}
            </div>
            {this.state.errorInfo?.componentStack && (
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-400 overflow-x-auto max-h-40 whitespace-pre-wrap">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('nalka_terminal_session');
                } catch (e) {}
                window.location.reload();
              }}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              Reset Session & Reload Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
          <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-indigo-500 selection:text-white">
            <SalesmanPortal />
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}
