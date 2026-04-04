import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info);

    // Auto-reload on chunk load errors (stale cache after deploy)
    const isChunkError = error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('Element type is invalid') ||
      error.message?.includes('is not a function') ||
      error.message?.includes('Minified React error #130');

    if (isChunkError && !sessionStorage.getItem('error-boundary-reloaded')) {
      sessionStorage.setItem('error-boundary-reloaded', '1');
      window.location.reload();
      return;
    }
    // Clear the flag after a successful render (in case it was set)
    sessionStorage.removeItem('error-boundary-reloaded');
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-full min-h-[200px] p-8 bg-[var(--ag-bg-deep)]">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-[#FF2D78]/10 border border-[#FF2D78]/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">⚡</span>
            </div>
            <p className="text-[#E8E8F0] text-base font-semibold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Something went wrong</p>
            <p className="text-[var(--ag-text-secondary)] text-sm mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => {
                sessionStorage.removeItem('error-boundary-reloaded');
                window.location.reload();
              }}
              className="px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-[var(--ag-cyan)] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
