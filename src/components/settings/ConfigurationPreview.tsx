import { useEffect } from 'react';
import type { FC } from 'react';
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
  useEffect(() => {
    if (!isOpen) {return;}

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [isOpen, onClose]);

  if (!isOpen || !config) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-40" aria-hidden="true" onClick={onClose}></div>
      <div className="relative max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Review Configuration
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Confirm the details before importing this custom site.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close preview"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">Hostname</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">{config.hostname}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">Display Name</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{config.displayName}</p>
          </div>

          {config.positioning && (
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Custom Placement</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 uppercase">Selector</p>
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100 break-all">{config.positioning.selector}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 uppercase">Placement</p>
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">{config.positioning.placement}</p>
                </div>
                {config.positioning.offset && (
                  <div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-300 uppercase">Offset</p>
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                      x: {config.positioning.offset.x}, y: {config.positioning.offset.y}
                    </p>
                  </div>
                )}
                {config.positioning.zIndex !== undefined && (
                  <div>
                    <p className="text-xs text-indigo-600 dark:text-indigo-300 uppercase">Z-Index</p>
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">{config.positioning.zIndex}</p>
                  </div>
                )}
                {config.positioning.description && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-indigo-600 dark:text-indigo-300 uppercase">Description</p>
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">{config.positioning.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">Security Notes</p>
              </div>
              <ul className="mt-2 space-y-1">
                {warnings.map((warning) => (
                  <li key={`${warning.field}-${warning.message}`} className="text-xs text-amber-700 dark:text-amber-200">
                    <strong>{warning.field}</strong>: {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {duplicate && (
            <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase">Existing Configuration</p>
              </div>
              <p className="mt-1 text-xs text-red-700 dark:text-red-200">
                A custom site named <strong>{existingDisplayName ?? config.displayName}</strong> already exists for this hostname. Importing will replace the current setup.
              </p>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              isProcessing
                ? 'bg-green-300 dark:bg-green-800 text-green-900 dark:text-green-200 cursor-wait'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isProcessing ? 'Importing...' : duplicate ? 'Overwrite & Import' : 'Import Configuration'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfigurationPreview;
