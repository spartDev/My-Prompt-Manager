import { memo } from 'react';
import type { FC } from 'react';

import { Toast } from '../types/hooks';

interface ToastContainerProps {
  toasts: Toast[];
}

// Original ToastContainer implementation - will be replaced by memoized version

const ToastItem: FC<{ toast: Toast }> = ({ toast }) => {
  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'info':
      default:
        return 'bg-purple-600 text-white';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={`
        ${getToastStyles()}
        px-5 py-4 rounded-xl shadow-xl max-w-sm
        flex items-center space-x-3
        animate-in slide-in-from-top-2 duration-300
        backdrop-blur-sm border border-white/20
      `}
    >
      <div className="flex-shrink-0">
        {getIcon()}
      </div>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
    </div>
  );
};

// Custom comparison function for ToastContainer
// Re-render only when toasts array content changes
const areToastContainerPropsEqual = (prevProps: ToastContainerProps, nextProps: ToastContainerProps): boolean => {
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
const areToastItemPropsEqual = (prevProps: { toast: Toast }, nextProps: { toast: Toast }): boolean => {
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
const MemoizedToastContainer: FC<ToastContainerProps> = ({ toasts }) => {
  if (toasts.length === 0) {return null;}

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <MemoizedToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default memo(MemoizedToastContainer, areToastContainerPropsEqual);