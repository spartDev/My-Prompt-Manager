import { ChangeEvent, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { backupManager } from '../../services/backupManager';
import { StorageManager } from '../../services/storage';
import { ErrorType } from '../../types';
import type {
  BackupCreationResult,
  BackupHistoryEntry,
  BackupPreview,
  BackupPreviewCategory,
  BackupValidationResult,
  ConflictResolutionStrategy,
  RestoreMode,
  RestoreOptions
} from '../../types/backup';

import SettingsSection from './SettingsSection';


interface BackupRestoreViewProps {
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface BackupOptionsState {
  includeSettings: boolean;
  encryptionEnabled: boolean;
  password: string;
}

const initialBackupOptions: BackupOptionsState = {
  includeSettings: true,
  encryptionEnabled: false,
  password: ''
};

const initialRestoreOptions: RestoreOptions = {
  mode: 'merge',
  conflictResolution: 'skip',
  selectedCategoryIds: [],
  password: ''
};

const conflictStrategyLabels: Record<ConflictResolutionStrategy, string> = {
  skip: 'Skip duplicates',
  overwrite: 'Overwrite duplicates',
  rename: 'Rename imported items'
};

const modeLabels: Record<RestoreMode, string> = {
  merge: 'Merge with existing data',
  replace: 'Replace existing data'
};

const downloadBackup = (result: BackupCreationResult) => {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file contents.'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file.'));
    };
    reader.readAsText(file);
  });
};

const formatBytes = (size: number): string => {
  if (size === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const order = Math.floor(Math.log(size) / Math.log(1024));
  const scaledSize = size / (1024 ** order);
  return `${scaledSize.toFixed(1)} ${units[order]}`;
};

const formatDate = (timestamp: number): string => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp.toString();
  }
};

const BackupRestoreView: FC<BackupRestoreViewProps> = ({ onShowToast }) => {
  const [backupOptions, setBackupOptions] = useState<BackupOptionsState>(initialBackupOptions);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [validation, setValidation] = useState<BackupValidationResult | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>(initialRestoreOptions);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileContentRef = useRef<string>('');
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

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) {
      onShowToast(message, type);
    }
  }, [onShowToast]);

  const fileInputId = 'backup-restore-file-input';

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleBackupOptionChange = (key: keyof BackupOptionsState, value: boolean | string) => {
    setBackupOptions((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      const result = await backupManager.createBackup({
        includeSettings: backupOptions.includeSettings,
        includePrivatePrompts: true,
        encryption: {
          enabled: backupOptions.encryptionEnabled,
          password: backupOptions.password
        }
      });

      downloadBackup(result);
      setHistory((prev) => [{
        id: result.metadata.checksum,
        filename: result.fileName,
        createdAt: result.metadata.createdAt,
        metadata: result.metadata
      }, ...prev]);
      showToast('Backup created successfully.', 'success');
      void refreshStorageUsage();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create backup.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await readFileContent(file);
      setSelectedFileName(file.name);
      const validationResult = await backupManager.validateBackup(content);
      setValidation(validationResult);
      setPreview(null);
      setRestoreError(null);

      if (validationResult.metadata?.encrypted && !restoreOptions.password) {
        showToast('This backup is encrypted. Enter the password to preview or restore.', 'info');
      }

      if (!validationResult.valid) {
        const blockingIssue = validationResult.issues.find((issue) => issue.severity === 'error');
        if (blockingIssue) {
          showToast(blockingIssue.message, 'error');
        }
      }

      // Store file content in ref for subsequent actions
      fileContentRef.current = content;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to read backup file.', 'error');
    }
  };

  const handlePreview = async () => {
    const content = fileContentRef.current;
    if (!content) {
      showToast('Select a backup file before previewing.', 'info');
      return;
    }

    try {
      const previewData = await backupManager.previewBackup(content, restoreOptions.password);
      setPreview(previewData);
      setRestoreOptions((prev) => ({
        ...prev,
        selectedCategoryIds: previewData.categories
          .filter((category) => category.selected)
          .map((category) => category.id)
      }));
      setRestoreError(null);
      showToast('Preview generated successfully.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to preview backup.', 'error');
    }
  };

  const handleToggleCategory = (category: BackupPreviewCategory) => {
    setRestoreOptions((prev) => {
      const exists = prev.selectedCategoryIds.includes(category.id);
      const selectedCategoryIds = exists
        ? prev.selectedCategoryIds.filter((id) => id !== category.id)
        : [...prev.selectedCategoryIds, category.id];
      return {
        ...prev,
        selectedCategoryIds
      };
    });
  };

  const handleRestore = async () => {
    const content = fileContentRef.current;
    if (!content) {
      showToast('Select and preview a backup before restoring.', 'info');
      return;
    }

    if (preview && restoreOptions.selectedCategoryIds.length === 0) {
      showToast('Select at least one category to restore.', 'info');
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreError(null);
      const summary = await backupManager.restoreBackup(content, restoreOptions);
      const importedCount = summary.importedPrompts.toLocaleString();
      const updatedCount = summary.updatedPrompts.toLocaleString();
      const skippedCount = summary.skippedPrompts.toLocaleString();
      showToast(
        `Restore completed: ${importedCount} prompts added, ${updatedCount} updated, ${skippedCount} skipped.`,
        'success'
      );
      setPreview(null);
      setValidation(null);
      setSelectedFileName('');
      setRestoreOptions({ ...initialRestoreOptions });
      fileContentRef.current = '';
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      void refreshStorageUsage();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore backup.';
      showToast(errorMessage, 'error');
      console.error('[BackupRestoreView] Restore failed', error);

      if (error && typeof error === 'object' && 'type' in error && (error as { type?: string }).type === ErrorType.STORAGE_QUOTA_EXCEEDED) {
        setRestoreError('Restoring this backup would exceed Chrome\'s storage limit. Delete unused prompts or restore fewer categories, then try again.');
      } else {
        setRestoreError(errorMessage);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const categorySelectionSummary = useMemo(() => {
    if (!preview) {
      return ''; 
    }
    const selected = preview.categories.filter((category) => restoreOptions.selectedCategoryIds.includes(category.id));
    const selectedLabel = selected.length.toString();
    const totalLabel = preview.categories.length.toString();
    return `${selectedLabel} of ${totalLabel} categories selected`;
  }, [preview, restoreOptions.selectedCategoryIds]);

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

  const backupIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 014-4h.01A6 6 0 0117 7a5 5 0 012 9.584M12 12v7m0 0l-3.5-3.5M12 19l3.5-3.5" />
    </svg>
  );

  return (
    <SettingsSection
      icon={backupIcon}
      title="Backup &amp; Restore"
      description="Create encrypted backups, validate files, and selectively restore your prompt library."
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        {/* Backup Section */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Create Backup</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Download an encrypted archive of your prompts, categories, and settings.</p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Storage usage</p>
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
                Chrome extensions can store up to 5&nbsp;MB in <code className="font-mono bg-blue-100/70 dark:bg-blue-900/40 px-1 py-0.5 rounded">chrome.storage.local</code>. Create backups or delete unused prompts if you approach the limit.
              </span>
            </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 grid-flow-col-dense items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Include settings</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Export appearance preferences and other app-level configuration.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={backupOptions.includeSettings}
                aria-label="Include settings"
                onClick={() => { handleBackupOptionChange('includeSettings', !backupOptions.includeSettings); }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${backupOptions.includeSettings ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${backupOptions.includeSettings ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid gap-2 grid-flow-col-dense items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Password protect backup (AES-256)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Encrypt the exported archive with a password before download.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={backupOptions.encryptionEnabled}
                  aria-label="Password protect backup (AES-256)"
                  onClick={() => { handleBackupOptionChange('encryptionEnabled', !backupOptions.encryptionEnabled); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${backupOptions.encryptionEnabled ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${backupOptions.encryptionEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              {backupOptions.encryptionEnabled && (
                <input
                  type="password"
                  placeholder="Encryption password"
                  value={backupOptions.password}
                  onChange={(event) => { handleBackupOptionChange('password', event.target.value); }}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => { void handleCreateBackup(); }}
            disabled={isBackingUp || (backupOptions.encryptionEnabled && !backupOptions.password)}
            className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50"
          >
            {isBackingUp ? 'Creating backup…' : 'Create Backup'}
          </button>
        </div>

        {/* Restore Section */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Restore Backup</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Validate a backup file, preview its contents, and selectively merge or replace your library.</p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-4 text-center focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/40 transition">
              <div className="flex flex-col items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <svg className="h-8 w-8 text-purple-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Drop a backup file here or
                </p>
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="inline-flex items-center gap-2 rounded-lg border border-purple-500 text-purple-600 dark:text-purple-300 px-3 py-1.5 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                >
                  Browse files
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Supports JSON backups exported from My Prompt Manager.
                </p>
                {selectedFileName && (
                  <p className="text-xs text-gray-700 dark:text-gray-300" aria-live="polite">
                    Selected: <span className="font-medium">{selectedFileName}</span>
                  </p>
                )}
              </div>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={(event) => { void handleFileChange(event); }}
                className="sr-only"
              />
            </div>

            {restoreError && (
              <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50/80 dark:bg-red-900/20 px-4 py-3 text-left text-sm text-red-700 dark:text-red-300">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600/10 text-red-600 dark:text-red-300">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6a1 1 0 012 0v5a1 1 0 01-2 0V6zm1 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <p>{restoreError}</p>
                </div>
              </div>
            )}

            {(validation || selectedFileName) && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 text-sm">
                <div className="font-medium text-gray-900 dark:text-gray-100">{selectedFileName || 'Selected backup'}</div>
                {validation?.metadata && (
                  <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <dt className="uppercase tracking-wide">Created</dt>
                      <dd>{formatDate(validation.metadata.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Prompts</dt>
                      <dd>{validation.metadata.promptCount}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Categories</dt>
                      <dd>{validation.metadata.categoryCount}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Size</dt>
                      <dd>{formatBytes(validation.metadata.fileSize)}</dd>
                    </div>
                  </dl>
                )}
                {validation && (
                  <ul className="mt-3 space-y-1">
                    {validation.issues.map((issue) => (
                      <li
                        key={`${issue.field}-${issue.message}`}
                        className={`text-xs ${issue.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}
                      >
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {validation?.metadata?.encrypted && (
            <input
              type="password"
              placeholder="Decryption password"
              value={restoreOptions.password ?? ''}
              onChange={(event) => { setRestoreOptions((prev) => ({ ...prev, password: event.target.value })); }}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Restore mode</span>
              <div className="relative">
                <select
                  value={restoreOptions.mode}
                  onChange={(event) => { setRestoreOptions((prev) => ({ ...prev, mode: event.target.value as RestoreMode })); }}
                  className="peer w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  {Object.entries(modeLabels).map(([mode, label]) => (
                    <option key={mode} value={mode}>{label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">When duplicates are found</span>
              <div className="relative">
                <select
                  value={restoreOptions.conflictResolution}
                  onChange={(event) => { setRestoreOptions((prev) => ({ ...prev, conflictResolution: event.target.value as ConflictResolutionStrategy })); }}
                  className="peer w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  {Object.entries(conflictStrategyLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => { void handlePreview(); }}
              disabled={!fileContentRef.current}
              className="inline-flex flex-1 justify-center px-4 py-2 rounded-lg border border-purple-600 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview Backup
            </button>
            <button
              type="button"
              onClick={() => { void handleRestore(); }}
              disabled={isRestoring || !fileContentRef.current}
              className="inline-flex flex-1 justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestoring ? 'Restoring…' : 'Start Restore'}
            </button>
            {categorySelectionSummary && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{categorySelectionSummary}</span>
            )}
          </div>

          {preview && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Select Categories</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.categories.map((category) => {
                  const selected = restoreOptions.selectedCategoryIds.includes(category.id);
                  const checkboxId = `${category.id}-restore-option`;
                  const labelId = `${category.id}-restore-label`;
                  return (
                    <div key={category.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
                      <div className="flex items-start gap-2">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={selected}
                          onChange={() => { handleToggleCategory(category); }}
                          aria-labelledby={labelId}
                          className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600"
                        />
                        <div id={labelId} className="text-sm text-gray-700 dark:text-gray-300">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{category.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {category.promptCount.toLocaleString()} prompts{category.existsInLibrary ? ' · already in library' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Backup History */}
        {history.length > 0 && (
          <div className="p-6 space-y-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Backups</h3>
            <ul className="space-y-2 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{entry.filename}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Created {formatDate(entry.createdAt)} · {entry.metadata.promptCount} prompts · {formatBytes(entry.metadata.fileSize)}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Backups listed above are available for this session. For safekeeping, store your backups in a secure location.
            </p>
          </div>
        )}
      </div>
    </SettingsSection>
  );
};

export default BackupRestoreView;
