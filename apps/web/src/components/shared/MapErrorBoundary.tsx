'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MapErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidMount() {
    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        console.warn('[MapErrorBoundary] Captured Google Maps gm_authFailure callback');
        this.setState({ hasError: true });
      };
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[MapErrorBoundary] Suppressed Google Maps error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-3 shadow-xs">
            <AlertTriangle size={24} />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Map Service Unavailable</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
            {this.props.fallbackMessage || 'Google Maps failed to load. Please verify NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment configuration.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            className="mt-4 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={14} /> Retry Loading Map
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MapErrorBoundary;
