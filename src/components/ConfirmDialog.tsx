import type { FC, ReactNode } from 'react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';

import { useModalFocus } from '../hooks/useModalFocus';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info';

interface VariantStyle {
  icon: ReactNode;
  confirmButton: string;
  iconBg: string;
}

const variantStyles: Record<ConfirmDialogVariant, VariantStyle> = {
  danger: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    confirmButton: 'bg-danger hover:bg-danger-hover',
    iconBg: 'bg-danger-subtle text-danger'
  },
  warning: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    confirmButton: 'bg-accent hover:bg-accent-hover',
    iconBg: 'bg-warning-subtle text-warning'
  },
  info: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    confirmButton: 'bg-accent hover:bg-accent-hover',
    iconBg: 'bg-accent-subtle text-accent'
  }
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Cancel takes the focus first, for safety
  useModalFocus({ isOpen, onClose: onCancel, containerRef: dialogRef, initialFocusRef: cancelButtonRef });

  if (!isOpen) {return null;}

  const styles = variantStyles[variant];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-backdrop backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div 
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-card rounded-xl p-3 shadow-2xl transform transition-all max-w-xs w-full mx-2 border border-default focus:outline-none"
      >
        <div className="flex items-start">
          <div className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${styles.iconBg}`}>
            <div className="scale-75">
              {styles.icon}
            </div>
          </div>
          <div className="ml-3 flex-1">
            <h3 
              id="dialog-title"
              className="text-sm leading-5 font-bold text-primary"
            >
              {title}
            </h3>
            <div className="mt-1">
              <p 
                id="dialog-description"
                className="text-xs text-secondary leading-tight"
              >
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-row-reverse gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-on-accent shadow-sm focus-secondary transition-colors ${styles.confirmButton}`}
          >
            {confirmText}
          </button>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="inline-flex justify-center rounded-lg border border-strong bg-card px-3 py-1.5 text-xs font-semibold text-secondary shadow-sm hover:bg-muted focus-secondary transition-colors"
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