import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

import { Logger } from '../utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error for debugging
    Logger.error('ErrorBoundary caught an error', error, {
      component: 'ErrorBoundary',
      errorInfo: errorInfo.componentStack
    });

    // In a real app, you might want to send this to an error reporting service
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // Here you could send error data to a logging service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    Logger.error('Error Report', new Error('Component error boundary triggered'), {
      component: 'ErrorBoundary',
      ...errorData
    });
  }

  private handleReload = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleReset = () => {
    // Clear extension storage and reload
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (chrome?.storage?.local) {
      chrome.storage.local.clear(() => {
        this.handleReload();
      });
    } else {
      this.handleReload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-full w-full bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-medium text-gray-900">
                  Something went wrong
                </h2>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                The application encountered an unexpected error. This might be due to:
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Corrupted data in storage</li>
                <li>Browser compatibility issues</li>
                <li>Extension context problems</li>
              </ul>
            </div>

            {this.state.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-mono text-red-800 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Reset Data
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              <p>
                If the problem persists, try reloading the extension or contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;