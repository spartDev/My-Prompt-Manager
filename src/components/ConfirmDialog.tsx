import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Focus the cancel button by default for safety
      if (cancelButtonRef.current) {
        cancelButtonRef.current.focus();
      }
    }
  }, [isOpen]);

  // Handle ESC key and trap focus
  useEffect(() => {
    if (!isOpen) {return;}

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Tab') {
        // Simple focus trap between the two buttons
        const focusableElements = [cancelButtonRef.current, confirmButtonRef.current].filter(Boolean);
        if (focusableElements.length === 2) {
          const currentIndex = focusableElements.indexOf(document.activeElement as HTMLButtonElement);
          if (e.shiftKey) {
            // Shift+Tab: go backwards
            const nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
            e.preventDefault();
            focusableElements[nextIndex]?.focus();
          } else {
            // Tab: go forwards
            const nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
            e.preventDefault();
            focusableElements[nextIndex]?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [isOpen, onCancel]);

  if (!isOpen) {return null;}

  const variantStyles = {
    danger: {
      icon: (
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      confirmButton: 'bg-red-600 hover:bg-red-700',
      iconBg: 'bg-red-100 dark:bg-red-900/20'
    },
    warning: {
      icon: (
        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      confirmButton: 'bg-yellow-600 hover:bg-yellow-700',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/20'
    },
    info: {
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      confirmButton: 'bg-blue-600 hover:bg-blue-700',
      iconBg: 'bg-blue-100 dark:bg-blue-900/20'
    }
  };

  const styles = variantStyles[variant];

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: '100%',
        width: '100%'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div 
        ref={dialogRef}
        className="relative bg-white dark:bg-gray-800 rounded-xl p-3 shadow-xl transform transition-all max-w-xs w-full mx-2 backdrop-blur-sm border border-purple-100 dark:border-gray-700"
      >
        <div className="flex items-start">
          <div className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${styles.iconBg}`}>
            <div className="scale-75">
              {styles.icon}
            </div>
          </div>
          <div className="ml-3 flex-1">
            <h3 
              id="dialog-title"
              className="text-sm leading-5 font-bold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h3>
            <div className="mt-1">
              <p 
                id="dialog-description"
                className="text-xs text-gray-600 dark:text-gray-400 leading-tight"
              >
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-row-reverse gap-2">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`inline-flex justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm focus-secondary transition-colors ${styles.confirmButton}`}
          >
            {confirmText}
          </button>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus-secondary transition-colors"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;