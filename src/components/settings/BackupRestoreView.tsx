import { FC, useCallback, useState } from 'react';

import type { BackupCreationResult, BackupHistoryEntry } from '../../types/backup';

import BackupHistoryList from './backup-restore/BackupHistoryList';
import BackupSection from './backup-restore/BackupSection';
import RestoreSection from './backup-restore/RestoreSection';
import StorageUsageDisplay from './backup-restore/StorageUsageDisplay';

interface BackupRestoreViewProps {
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Main backup and restore view component
 * Orchestrates backup creation, restore operations, and storage management
 */
const BackupRestoreView: FC<BackupRestoreViewProps> = ({ onShowToast }) => {
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);

  const handleBackupCreated = useCallback((result: BackupCreationResult) => {
    setHistory((prev) => [{
      id: result.metadata.checksum,
      filename: result.fileName,
      createdAt: result.metadata.createdAt,
      metadata: result.metadata
    }, ...prev]);
    setStorageRefreshKey((prev) => prev + 1);
  }, []);

  const handleRestoreCompleted = useCallback(() => {
    setStorageRefreshKey((prev) => prev + 1);
  }, []);

  const handleStorageUsageRefresh = useCallback(() => {
    setStorageRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <button
        onClick={() => { setIsExpanded(!isExpanded); }}
        className="w-full flex items-center justify-between text-left mb-4 group"
        aria-expanded={isExpanded}
        aria-label="Backup & Restore section"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 014-4h.01A6 6 0 0117 7a5 5 0 012 9.584M12 12v7m0 0l-3.5-3.5M12 19l3.5-3.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Backup &amp; Restore
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create encrypted backups, validate files, and selectively restore your prompt library
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Storage Usage */}
          <StorageUsageDisplay key={storageRefreshKey} />

          {/* Backup Section */}
          <BackupSection
            onBackupCreated={handleBackupCreated}
            onShowToast={onShowToast}
          />

          {/* Restore Section */}
          <RestoreSection
            onRestoreCompleted={handleRestoreCompleted}
            onStorageUsageRefresh={handleStorageUsageRefresh}
            onShowToast={onShowToast}
          />

          {/* Backup History */}
          <BackupHistoryList history={history} />
        </div>
      )}
    </section>
  );
};

export default BackupRestoreView;
