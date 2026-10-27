import type { FC } from 'react';
import { useEffect, useId, useState } from 'react';

import { StorageManager } from '../services/storage';
import { Logger, toError } from '../utils';

import ConfirmDialog from './ConfirmDialog';

const WarningIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
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
);

interface StorageWarningProps {
  onClose: () => void;
}

const StorageWarning: FC<StorageWarningProps> = ({ onClose }) => {
  const [storageInfo, setStorageInfo] = useState<{
    used: number;
    total: number;
    percentage: number;
    warningLevel: 'safe' | 'warning' | 'critical' | 'danger';
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        const storageManager = StorageManager.getInstance();
        const info = await storageManager.getStorageUsageWithWarnings();
        setStorageInfo(info);
      } catch (error) {
        Logger.error('Failed to load storage info', toError(error));
      }
    };

    void loadStorageInfo();
  }, []);

  const handleClearData = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = async () => {
    setShowClearConfirm(false);
    try {
      setIsLoading(true);
      const storageManager = StorageManager.getInstance();
      await storageManager.clearAllData();
      onClose();
      // Reload the extension
      window.location.reload();
    } catch (error) {
      Logger.error('Failed to clear data', toError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return String(parseFloat((bytes / Math.pow(k, i)).toFixed(2))) + ' ' + sizes[i];
  };

  const usagePercentage = storageInfo?.percentage ?? 0;
  const warningLevel = storageInfo?.warningLevel ?? 'safe';

  // Map warning levels to colors and states
  const isAtLimit = warningLevel === 'danger';
  const isCritical = warningLevel === 'critical' || warningLevel === 'danger';

  const getProgressBarColor = () => {
    switch (warningLevel) {
      case 'danger': return 'bg-danger';
      case 'critical':
      case 'warning': return 'bg-warning';
      default: return 'bg-success';
    }
  };

  const getIconColor = () => {
    switch (warningLevel) {
      case 'danger': return 'text-danger';
      case 'critical':
      case 'warning': return 'text-warning';
      default: return 'text-success';
    }
  };

  return (
    <div className="fixed inset-0 bg-backdrop backdrop-blur-sm flex items-center justify-center z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card border border-default rounded-lg shadow-xl w-full max-w-md p-6"
      >
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className="shrink-0">
            <WarningIcon className={`h-8 w-8 ${getIconColor()}`} />
          </div>
          <div className="ml-3">
            <h3 id={titleId} className="text-lg font-medium text-primary">
              {isAtLimit ? 'Storage Limit Reached' : isCritical ? 'Critical Storage Warning' : 'Storage Warning'}
            </h3>
          </div>
        </div>

        {/* Storage Info */}
        {storageInfo && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-secondary mb-2">
              <span>Storage Used</span>
              <span>{usagePercentage}%</span>
            </div>

            <div className="w-full bg-(--border-color-strong) rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${getProgressBarColor()}`}
                style={{ width: `${String(Math.min(usagePercentage, 100))}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-tertiary mt-1">
              <span>{formatBytes(storageInfo.used)}</span>
              <span>{formatBytes(storageInfo.total)}</span>
            </div>
          </div>
        )}

        {/* Warning Message */}
        <div className="mb-6">
          <p className="text-sm text-secondary">
            {warningLevel === 'danger' ? (
              <>
                Your storage is full ({Math.round(usagePercentage)}% used). You won&apos;t be able to save new prompts until you free up space.
                Consider deleting old prompts or clearing all data.
              </>
            ) : warningLevel === 'critical' ? (
              <>
                Your storage is critically low ({Math.round(usagePercentage)}% used).
                You may encounter issues saving new prompts soon. Please delete unused prompts to free up space.
              </>
            ) : warningLevel === 'warning' ? (
              <>
                Your storage is getting low ({Math.round(usagePercentage)}% used).
                Consider managing your prompts to free up space before reaching the limit.
              </>
            ) : (
              <>
                Your storage usage is at {Math.round(usagePercentage)}%.
                You have plenty of space available.
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-secondary bg-card border border-strong rounded-lg hover:bg-muted transition-colors focus-secondary"
            disabled={isLoading}
          >
            Continue
          </button>

          {isAtLimit && (
            <button
              onClick={() => { handleClearData(); }}
              className="flex-1 px-4 py-2 text-sm font-medium text-on-accent bg-danger rounded-lg hover:bg-danger-hover transition-colors disabled:opacity-50 focus-danger"
              disabled={isLoading}
            >
              {isLoading ? 'Clearing...' : 'Clear All Data'}
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-4 text-xs text-tertiary">
          <p>
            Tip: Delete unused prompts or export your data before clearing to avoid losing important prompts.
          </p>
        </div>
      </div>

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onConfirm={() => { void handleConfirmClear(); }}
        onCancel={handleCancelClear}
        title="Clear All Data"
        message="Are you sure you want to clear all data? This will permanently delete all your prompts and categories. This action cannot be undone."
        confirmText="Clear All Data"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default StorageWarning;