import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[KUK ErrorBoundary] Uncaught runtime exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-kuk-surface-bg flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 text-kuk-maroon rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-bold text-gray-900 mb-2">Terjadi Gangguan Sistem</h1>
            <p className="text-sm text-gray-600 mb-6">
              Aplikasi mengalami kesalahan tak terduga pada antarmuka. Integritas data operasional
              tetap aman.
            </p>

            {this.state.error && (
              <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6 text-xs text-gray-700 font-mono overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-dark text-white font-medium text-sm transition-colors shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Muat Ulang
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
              KUK Management System v3.1.0 · Error Recovery
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
