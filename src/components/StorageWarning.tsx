import { useState, useEffect } from 'react';
import type { FC } from 'react';

import { StorageManager } from '../services/storage';
import { Logger, toError } from '../utils';

import ConfirmDialog from './ConfirmDialog';

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

  const handleConfirmClear = () => {
    setShowClearConfirm(false);
    void (async () => {
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
    })();
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
      case 'danger': return 'bg-red-500';
      case 'critical': return 'bg-orange-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getIconColor = () => {
    switch (warningLevel) {
      case 'danger': return 'text-red-500';
      case 'critical': return 'text-orange-500';
      case 'warning': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className="shrink-0">
            <svg
              className={`h-8 w-8 ${getIconColor()}`}
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {isAtLimit ? 'Storage Limit Reached' : isCritical ? 'Critical Storage Warning' : 'Storage Warning'}
            </h3>
          </div>
        </div>

        {/* Storage Info */}
        {storageInfo && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
              <span>Storage Used</span>
              <span>{usagePercentage}%</span>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${getProgressBarColor()}`}
                style={{ width: `${String(Math.min(usagePercentage, 100))}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{formatBytes(storageInfo.used)}</span>
              <span>{formatBytes(storageInfo.total)}</span>
            </div>
          </div>
        )}

        {/* Warning Message */}
        <div className="mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">
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
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            disabled={isLoading}
          >
            Continue
          </button>

          {isAtLimit && (
            <button
              onClick={() => { handleClearData(); }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-700 rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Clearing...' : 'Clear All Data'}
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>
            Tip: Delete unused prompts or export your data before clearing to avoid losing important prompts.
          </p>
        </div>
      </div>

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onConfirm={handleConfirmClear}
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