import { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { StorageManager } from '../../../services/storage';

import { formatBytes } from './types';

/**
 * Storage usage display component with visual indicator and tooltip
 */
const StorageUsageDisplay: FC = () => {
  const [storageUsage, setStorageUsage] = useState<{ used: number; total: number } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const refreshStorageUsage = useCallback(async () => {
    try {
      setLoadingUsage(true);
      const info = await StorageManager.getInstance().getStorageUsage();
      setStorageUsage(info);
    } catch (error) {
      console.error('Failed to load storage usage', error);
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    void refreshStorageUsage();
  }, [refreshStorageUsage]);

  const storageUsagePercentage = useMemo(() => {
    if (!storageUsage) {
      return 0;
    }
    return Math.min(100, Math.round((storageUsage.used / storageUsage.total) * 100));
  }, [storageUsage]);

  const storageUsagePercentageLabel = storageUsagePercentage.toString();

  const storageUsageText = useMemo(() => {
    if (!storageUsage) {
      return loadingUsage ? 'Loading…' : 'Unavailable';
    }
    return `${formatBytes(storageUsage.used)} of ${formatBytes(storageUsage.total)}`;
  }, [storageUsage, loadingUsage]);

  const storageUsageBarColor = storageUsagePercentage >= 90
    ? 'bg-red-500'
    : storageUsagePercentage >= 75
      ? 'bg-yellow-500'
      : 'bg-green-500';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Current usage</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{storageUsageText}</p>
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{storageUsagePercentageLabel}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-2 transition-all duration-300 ${storageUsageBarColor}`}
          style={{ width: `${storageUsagePercentageLabel}%` }}
        />
      </div>
      <div className="mt-3">
        <button
          type="button"
          className="group relative inline-flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300"
          aria-describedby="storage-usage-tooltip"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </span>
          <span>Storage limit details</span>
          <span
            id="storage-usage-tooltip"
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-3 py-2 text-left text-xs text-blue-700 dark:text-blue-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            Chrome extensions can store up to 10&nbsp;MB in <code className="font-mono bg-blue-100/70 dark:bg-blue-900/40 px-1 py-0.5 rounded">chrome.storage.local</code>. Create backups or delete unused prompts if you approach the limit.
          </span>
        </button>
      </div>
    </div>
  );
};

export default StorageUsageDisplay;
