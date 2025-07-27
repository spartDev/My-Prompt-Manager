import { useState, useEffect } from 'react';
import type { FC } from 'react';

import { StorageManager } from '../services/storage';

interface StorageWarningProps {
  onClose: () => void;
}

const StorageWarning: FC<StorageWarningProps> = ({ onClose }) => {
  const [storageInfo, setStorageInfo] = useState<{ used: number; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        const storageManager = StorageManager.getInstance();
        const info = await storageManager.getStorageUsage();
        setStorageInfo(info);
      } catch (error) {
         
        console.error('Failed to load storage info:', error);
      }
    };

    loadStorageInfo();
  }, []);

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const storageManager = StorageManager.getInstance();
      await storageManager.clearAllData();
      onClose();
      // Reload the extension
      window.location.reload();
    } catch (error) {
       
      console.error('Failed to clear data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUsagePercentage = () => {
    if (!storageInfo) {return 0;}
    return Math.round((storageInfo.used / storageInfo.total) * 100);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usagePercentage = getUsagePercentage();
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 95;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg
              className={`h-8 w-8 ${isAtLimit ? 'text-red-500' : 'text-yellow-500'}`}
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
            <h3 className="text-lg font-medium text-gray-900">
              {isAtLimit ? 'Storage Limit Reached' : 'Storage Warning'}
            </h3>
          </div>
        </div>

        {/* Storage Info */}
        {storageInfo && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Storage Used</span>
              <span>{usagePercentage}%</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatBytes(storageInfo.used)}</span>
              <span>{formatBytes(storageInfo.total)}</span>
            </div>
          </div>
        )}

        {/* Warning Message */}
        <div className="mb-6">
          <p className="text-sm text-gray-700">
            {isAtLimit ? (
              <>
                Your storage is full. You won&apos;t be able to save new prompts until you free up space.
                Consider deleting old prompts or clearing all data.
              </>
            ) : (
              <>
                Your storage is nearly full ({usagePercentage}% used). 
                Consider managing your prompts to free up space.
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Continue
          </button>
          
          {isAtLimit && (
            <button
              onClick={handleClearData}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Clearing...' : 'Clear All Data'}
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-4 text-xs text-gray-500">
          <p>
            Tip: Delete unused prompts or export your data before clearing to avoid losing important prompts.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StorageWarning;