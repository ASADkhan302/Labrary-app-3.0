import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AlmariErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Almari View Error Boundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full min-h-[400px] flex items-center justify-center p-6 bg-[var(--background)]">
          <div className="max-w-md w-full p-6 rounded-[14px] bg-[#1A1A1A] border border-rose-900/50 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-950/40 border border-rose-800/50 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {this.props.fallbackTitle || 'Unable to display Almari View'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                An unexpected display error occurred while rendering the cupboard view. Your books, groups, and almaris data remain safe.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-primary h-10 px-5 rounded-[10px] text-xs font-bold inline-flex items-center gap-2 cursor-pointer mx-auto shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try again</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
