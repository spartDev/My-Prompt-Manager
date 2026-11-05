import type { FC } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { CustomSiteConfiguration, SecurityWarning } from '../../types';

interface ConfigurationPreviewProps {
  isOpen: boolean;
  config: CustomSiteConfiguration | null;
  warnings: SecurityWarning[];
  duplicate: boolean;
  existingDisplayName?: string;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing?: boolean;
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ConfigurationPreview: FC<ConfigurationPreviewProps> = ({
  isOpen,
  config,
  warnings,
  duplicate,
  existingDisplayName,
  onClose,
  onConfirm,
  isProcessing = false
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) {return [];}
    return Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }, []);

  // Store the previously focused element and focus the first focusable element when opened
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the first focusable element (close button) after a brief delay to ensure modal is rendered
      requestAnimationFrame(() => {
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      });
    }

    return () => {
      // Restore focus when modal closes
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, getFocusableElements]);

  // Handle ESC key and trap focus
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'Tab') {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {return;}

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [onClose, getFocusableElements]);

  useEffect(() => {
    if (!isOpen) {return;}

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !config) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="configuration-preview-title"
    >
      <div className="absolute inset-0 bg-backdrop backdrop-blur-sm" aria-hidden="true" onClick={onClose}></div>
      <div
        ref={modalRef}
        className="relative max-w-lg w-full bg-raised rounded-2xl shadow-2xl border border-default overflow-hidden"
      >
        {/* Header */}
        <div className="bg-card border-b border-default px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-subtle text-accent">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 id="configuration-preview-title" className="text-base font-semibold text-primary">
                  Review Configuration
                </h3>
                <p className="text-xs text-tertiary">
                  Confirm details before importing
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-tertiary hover:text-primary transition-colors"
              aria-label="Close preview"
              data-testid="close-modal"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto">

          {/* Site Information Card */}
          <div className="bg-card border border-default rounded-lg p-4">
            <h5 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Site Information</h5>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-tertiary mb-1">Hostname</p>
                <p className="text-sm font-medium text-primary break-all">{config.hostname}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-tertiary mb-1">Display Name</p>
                <p className="text-sm font-medium text-primary">{config.displayName}</p>
              </div>
            </div>
          </div>

          {/* Custom Positioning Card */}
          {config.positioning && (
            <div className="bg-card border border-default rounded-lg p-4">
              <h5 className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">Custom Positioning</h5>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">Placement</p>
                    <p className="text-sm font-medium text-primary">{config.positioning.placement}</p>
                  </div>
                  {config.positioning.zIndex !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-tertiary mb-1">Z-Index</p>
                      <p className="text-sm font-medium text-primary">{config.positioning.zIndex}</p>
                    </div>
                  )}
                </div>
                {config.positioning.offset && (
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">Offset</p>
                    <p className="text-sm font-medium text-primary">
                      X: {config.positioning.offset.x}px, Y: {config.positioning.offset.y}px
                    </p>
                  </div>
                )}
                {config.positioning.description && (
                  <div>
                    <p className="text-xs font-medium text-tertiary mb-1">Description</p>
                    <p className="text-sm text-secondary">{config.positioning.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Security Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning-subtle p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs font-semibold text-warning uppercase tracking-wide">Security Notes</p>
              </div>
              <ul className="space-y-1.5">
                {warnings.map((warning) => (
                  <li key={`${warning.field}-${warning.message}`} className="text-xs text-warning flex gap-1.5">
                    <span className="text-warning">•</span>
                    <span><strong className="font-semibold">{warning.field}:</strong> {warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Duplicate Warning */}
          {duplicate && (
            <div className="rounded-lg border border-danger bg-danger-subtle p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-xs font-semibold text-danger uppercase tracking-wide">Existing Configuration</p>
              </div>
              <p className="text-xs text-danger leading-relaxed">
                A custom site named <strong className="font-semibold">{existingDisplayName ?? config.displayName}</strong> already exists for this hostname. Importing will replace the current configuration.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-card border-t border-default px-6 py-4">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-strong bg-card text-secondary hover:bg-muted focus-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Importing...' : duplicate ? 'Replace & Import' : 'Import Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfigurationPreview;
