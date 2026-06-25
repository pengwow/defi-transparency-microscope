/**
 * ErrorBoundary — catch render-phase errors and show a fallback UI.
 *
 * Usage:
 *   <ErrorBoundary fallback={(err) => <p>{err.message}</p>}>
 *     <RiskyTree />
 *   </ErrorBoundary>
 *
 * If no `fallback` is supplied, a generic message is shown.  The
 * boundary is a React class component because that's the only way
 * React exposes `componentDidCatch`.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback. */
  fallback?: (error: Error, info: ErrorInfo) => ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info });
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.info ?? { componentStack: '' });
      }
      return (
        <div role="alert" className="dtm-error-boundary">
          <h2>Something went wrong</h2>
          <p className="muted">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
