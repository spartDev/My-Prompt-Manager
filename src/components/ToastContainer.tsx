import { memo, useState, useEffect, useCallback, useRef } from 'react';
import type { FC } from 'react';

import { Toast } from '../types/hooks';

// Module-scope SVG icon constants to avoid recreation on every render
const SuccessIcon = (
  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);

const ErrorIcon = (
  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
      clipRule="evenodd"
    />
  </svg>
);

const WarningIcon = (
  <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

const InfoIcon = (
  <svg className="h-5 w-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

const CloseIcon = (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

const QueueIndicatorIcon = (
  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
  </svg>
);

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'bottom-right';
  queueLength?: number;
}

// Original ToastContainer implementation - will be replaced by memoized version

const ToastItem: FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDismiss = useCallback(() => {
    // Clear the auto-dismiss timer if it's still running
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setIsExiting(true);
    // Wait for animation to complete before actually dismissing
    exitTimerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, 250);
  }, [toast.id, onDismiss]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) {return;}

    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, toast.duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [toast.duration, handleDismiss]);

  const getToastStyles = () => {
    // Match extension's design system with purple theme
    const baseStyles = 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border';
    const borderColor = (() => {
      switch (toast.type) {
        case 'success':
          return 'border-l-4 border-l-green-500 border-t border-r border-b border-green-200 dark:border-green-800';
        case 'error':
          return 'border-l-4 border-l-red-500 border-t border-r border-b border-red-200 dark:border-red-800';
        case 'warning':
          return 'border-l-4 border-l-yellow-500 border-t border-r border-b border-yellow-200 dark:border-yellow-800';
        case 'info':
        default:
          return 'border-l-4 border-l-purple-500 border-t border-r border-b border-purple-200 dark:border-purple-800';
      }
    })();
    return `${baseStyles} ${borderColor}`;
  };

  const getProgressBarColor = () => {
    switch (toast.type) {
      case 'success':
        return '#10b981'; // green-500
      case 'error':
        return '#ef4444'; // red-500
      case 'warning':
        return '#eab308'; // yellow-500
      case 'info':
      default:
        return '#8b5cf6'; // purple-500 (extension's primary color)
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return SuccessIcon;
      case 'error':
        return ErrorIcon;
      case 'warning':
        return WarningIcon;
      case 'info':
      default:
        return InfoIcon;
    }
  };

  // Determine ARIA role and live region based on toast type
  const getAriaProps = () => {
    const isAlert = toast.type === 'error' || toast.type === 'warning';
    return {
      role: isAlert ? 'alert' : 'status',
      'aria-live': isAlert ? 'assertive' as const : 'polite' as const,
      'aria-atomic': 'true' as const
    };
  };

  return (
    <div
      {...getAriaProps()}
      className={`
        ${getToastStyles()}
        rounded-xl max-w-sm min-w-[288px]
        overflow-hidden
        group
        relative
        transition-transform duration-200
        hover:scale-[1.02]
        shadow-lg
        ${isExiting
          ? 'animate-out fade-out slide-out-to-right-2 duration-250'
          : 'animate-in slide-in-from-top-2 fade-in duration-300'
        }
      `}
      style={{
        animationTimingFunction: isExiting
          ? 'cubic-bezier(0.4, 0.0, 1, 1)' // FastOutLinearIn for exit
          : 'cubic-bezier(0.0, 0.0, 0.2, 1)' // StandardEasing for entrance
      }}
    >
      <div className="px-5 py-3 flex items-center space-x-3">
        <div className="shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{toast.message}</p>
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleDismiss();
              }}
              className={`
                mt-2 text-xs font-medium px-3 py-1.5 rounded-lg
                transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400
                ${toast.action.variant === 'secondary'
                  ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
                }
              `}
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 ml-2 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
          aria-label="Dismiss notification"
        >
          {CloseIcon}
        </button>
      </div>
      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && !isExiting && (
        <div
          className="absolute bottom-0 left-0 h-1 w-full"
          style={{
            backgroundColor: getProgressBarColor(),
            opacity: 0.6,
            transformOrigin: 'left',
            animation: `shrink-width ${toast.duration.toString()}ms linear forwards`
          }}
        />
      )}
    </div>
  );
};

// Custom comparison function for ToastContainer
// Re-render only when toasts array content, position, or queueLength changes
const areToastContainerPropsEqual = (prevProps: ToastContainerProps, nextProps: ToastContainerProps): boolean => {
  // Check if position or queueLength changed
  if (prevProps.position !== nextProps.position) {return false;}
  if (prevProps.queueLength !== nextProps.queueLength) {return false;}

  // Check if arrays have different lengths
  if (prevProps.toasts.length !== nextProps.toasts.length) {return false;}

  // Deep comparison of toast array content
  for (let i = 0; i < prevProps.toasts.length; i++) {
    const prevToast = prevProps.toasts[i];
    const nextToast = nextProps.toasts[i];

    if (prevToast.id !== nextToast.id) {return false;}
    if (prevToast.message !== nextToast.message) {return false;}
    if (prevToast.type !== nextToast.type) {return false;}
    if (prevToast.duration !== nextToast.duration) {return false;}
  }

  return true;
};

// Custom comparison function for individual ToastItem
// Re-render only when the specific toast data changes
const areToastItemPropsEqual = (
  prevProps: { toast: Toast; onDismiss: (id: string) => void },
  nextProps: { toast: Toast; onDismiss: (id: string) => void }
): boolean => {
  const { toast: prevToast } = prevProps;
  const { toast: nextToast } = nextProps;

  if (prevToast.id !== nextToast.id) {return false;}
  if (prevToast.message !== nextToast.message) {return false;}
  if (prevToast.type !== nextToast.type) {return false;}
  if (prevToast.duration !== nextToast.duration) {return false;}

  return true;
};

// Memoize the ToastItem component to prevent unnecessary re-renders
const MemoizedToastItem = memo(ToastItem, areToastItemPropsEqual);

// Update the ToastContainer to use the memoized ToastItem
const MemoizedToastContainer: FC<ToastContainerProps> = ({ toasts, onDismiss, position = 'top-right', queueLength = 0 }) => {
  // Add ESC key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && toasts.length > 0) {
        onDismiss(toasts[0].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toasts, onDismiss]);

  if (toasts.length === 0) {return null;}

  const positionClasses = position === 'bottom-right'
    ? 'fixed bottom-4 right-4 z-50 space-y-2'
    : 'fixed top-4 right-4 z-50 space-y-2';

  return (
    <div className={positionClasses}>
      {toasts.map((toast) => (
        <MemoizedToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
      {/* Queue indicator */}
      {queueLength > 0 && (
        <div
          className="
            bg-purple-100 dark:bg-purple-900/30
            text-purple-700 dark:text-purple-300
            text-xs font-medium
            px-3 py-2 rounded-lg
            flex items-center space-x-2
            animate-in fade-in duration-200
            border border-purple-200 dark:border-purple-800
            shadow-sm
          "
        >
          {QueueIndicatorIcon}
          <span>{queueLength} more notification{queueLength > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
};

export default memo(MemoizedToastContainer, areToastContainerPropsEqual);