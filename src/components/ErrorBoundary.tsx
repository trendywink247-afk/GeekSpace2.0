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
        <div className="flex items-center justify-center h-full min-h-[200px] p-8">
          <div className="text-center">
            <p className="text-red-400 text-sm font-medium mb-2">Something went wrong</p>
            <p className="text-[#6B7280] text-xs">{this.state.error?.message}</p>
            <button
              onClick={() => {
                sessionStorage.removeItem('error-boundary-reloaded');
                window.location.reload();
              }}
              className="mt-4 text-xs text-[#00F0FF] hover:underline"
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
