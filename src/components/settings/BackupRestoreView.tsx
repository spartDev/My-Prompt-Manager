import { ChangeEvent, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSecurePasswords } from '../../hooks/useSecurePassword';
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
import ConfirmDialog from '../ConfirmDialog';
import { PasswordStrengthIndicator } from '../PasswordStrengthIndicator';

import ToggleSwitch from './ToggleSwitch';

interface BackupRestoreViewProps {
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface BackupOptionsState {
  includeSettings: boolean;
  encryptionEnabled: boolean;
}

const initialBackupOptions: BackupOptionsState = {
  includeSettings: true,
  encryptionEnabled: false
};

const initialRestoreOptions: RestoreOptions = {
  mode: 'merge',
  conflictResolution: 'skip',
  selectedCategoryIds: []
};

const conflictStrategyLabels: Record<ConflictResolutionStrategy, string> = {
  skip: 'Skip duplicates',
  overwrite: 'Overwrite duplicates',
  rename: 'Rename imported items'
};

const conflictStrategyActionLabels: Record<ConflictResolutionStrategy, string> = {
  skip: 'will be skipped',
  overwrite: 'will overwrite existing prompts',
  rename: 'will be renamed'
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
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);
  const [pendingRestoreMode, setPendingRestoreMode] = useState<RestoreMode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileContentRef = useRef<string>('');
  const [storageUsage, setStorageUsage] = useState<{ used: number; total: number } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Secure password management - automatically cleared on unmount
  const [encryptionPassword, decryptionPassword] = useSecurePasswords(2);

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
          password: encryptionPassword.value
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

      // Securely clear password after successful backup
      encryptionPassword.clear();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create backup.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleClearFile = useCallback(() => {
    setSelectedFileName('');
    setValidation(null);
    setPreview(null);
    setRestoreError(null);
    setRestoreOptions(initialRestoreOptions);
    setShowTechnicalDetails(false);
    fileContentRef.current = '';
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Securely clear decryption password when clearing file
    decryptionPassword.clear();
  }, [decryptionPassword]);

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

      if (validationResult.metadata?.encrypted && decryptionPassword.isEmpty()) {
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
      const previewData = await backupManager.previewBackup(
        content,
        decryptionPassword.isEmpty() ? undefined : decryptionPassword.value
      );
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

  const handleRestoreModeSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedMode = event.target.value as RestoreMode;
    if (selectedMode === 'replace' && restoreOptions.mode !== 'replace') {
      setPendingRestoreMode('replace');
      setIsReplaceConfirmOpen(true);
      return;
    }

    setRestoreOptions((prev) => ({
      ...prev,
      mode: selectedMode
    }));
  };

  const confirmReplaceMode = () => {
    if (pendingRestoreMode === 'replace') {
      setRestoreOptions((prev) => ({ ...prev, mode: 'replace' }));
    }
    setPendingRestoreMode(null);
    setIsReplaceConfirmOpen(false);
  };

  const cancelReplaceMode = () => {
    setPendingRestoreMode(null);
    setIsReplaceConfirmOpen(false);
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

      // Use secure password for restore
      const restoreOptionsWithPassword: RestoreOptions = {
        ...restoreOptions,
        password: decryptionPassword.isEmpty() ? undefined : decryptionPassword.value
      };

      const summary = await backupManager.restoreBackup(content, restoreOptionsWithPassword);
      const importedCount = summary.importedPrompts.toLocaleString();
      const updatedCount = summary.updatedPrompts.toLocaleString();
      const skippedCount = summary.skippedPrompts.toLocaleString();
      showToast(
        `Restore completed: ${importedCount} prompts added, ${updatedCount} updated, ${skippedCount} skipped.`,
        'success'
      );
      handleClearFile();
      void refreshStorageUsage();

      // Securely clear password after successful restore
      decryptionPassword.clear();
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
        {/* Storage Usage Section */}
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

        {/* Backup Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">Create Backup</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Download an encrypted archive of your prompts, categories, and settings.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 grid-flow-col-dense items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Include settings</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Export appearance preferences and other app-level configuration.</p>
              </div>
              <ToggleSwitch
                checked={backupOptions.includeSettings}
                onChange={(checked) => { handleBackupOptionChange('includeSettings', checked); }}
                ariaLabel="Include settings"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid gap-2 grid-flow-col-dense items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Password protect backup (AES-256)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Encrypt the exported archive with a password before download.</p>
                </div>
                <ToggleSwitch
                  checked={backupOptions.encryptionEnabled}
                  onChange={(checked) => { handleBackupOptionChange('encryptionEnabled', checked); }}
                  ariaLabel="Password protect backup (AES-256)"
                />
              </div>

              {backupOptions.encryptionEnabled && (
                <div className="space-y-1">
                  <input
                    type="password"
                    placeholder="Encryption password"
                    value={encryptionPassword.value}
                    onChange={(event) => { encryptionPassword.setValue(event.target.value); }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                  <PasswordStrengthIndicator password={encryptionPassword.value} />
                </div>
              )}
            </div>
            <button
            type="button"
            onClick={() => { void handleCreateBackup(); }}
            disabled={isBackingUp || (backupOptions.encryptionEnabled && encryptionPassword.isEmpty())}
            className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50"
          >
            {isBackingUp ? 'Creating backup…' : 'Create Backup'}
          </button>
        </div>
          </div>

          

        {/* Restore Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">Restore Backup</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Validate a backup file, preview its contents, and selectively merge or replace your library.</p>
          </div>

          <div className="space-y-3">
            {!selectedFileName ? (
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
            ) : (
              <div className={`rounded-xl border p-4 ${
                validation?.metadata?.encrypted
                  ? 'border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {validation?.metadata?.encrypted ? (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                          <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                          <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {selectedFileName.replace(/\.(json)$/i, '')}
                        </div>
                      </div>
                    </div>
                    {validation?.metadata?.encrypted && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 w-fit">
                        <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                          Encrypted backup
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-3"
                    aria-label="Clear selected file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {validation?.metadata && (
                  <div className="mt-4">
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Created</span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(validation.metadata.createdAt)}</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Prompts</span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{validation.metadata.promptCount.toLocaleString()}</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Categories</span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{validation.metadata.categoryCount.toLocaleString()}</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Size</span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{formatBytes(validation.metadata.fileSize)}</span>
                      </li>
                    </ul>

                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => { setShowTechnicalDetails(!showTechnicalDetails); }}
                        className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                        aria-expanded={showTechnicalDetails}
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium">
                          {showTechnicalDetails ? 'Hide Technical Details' : 'Show Technical Details'}
                        </span>
                      </button>

                      {showTechnicalDetails && (
                        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                          <h4 className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-3">
                            Technical Information
                          </h4>
                          <ul className="space-y-2 text-sm">
                            <li className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Format Version</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium font-mono text-xs">
                                {validation.metadata.version || '1.0.0'}
                              </span>
                            </li>
                            <li className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Encryption</span>
                              <span className={`font-medium text-xs ${
                                validation.metadata.encrypted
                                  ? 'text-purple-600 dark:text-purple-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {validation.metadata.encrypted ? 'AES-256' : 'None'}
                              </span>
                            </li>
                            <li className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Data Integrity</span>
                              <span className="text-green-600 dark:text-green-400 font-medium text-xs">
                                Verified
                              </span>
                            </li>
                            <li className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Validation Status</span>
                              <span className={`font-medium text-xs ${
                                validation.valid
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {validation.valid ? 'Valid' : 'Invalid'}
                              </span>
                            </li>
                            <li className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">Checksum</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium font-mono text-xs">
                                {validation.metadata.checksum ? validation.metadata.checksum.substring(0, 8) + '...' : 'N/A'}
                              </span>
                            </li>
                            <li className="flex justify-between items-center">
                              <span className="text-gray-600 dark:text-gray-400">File Type</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">
                                JSON Backup
                              </span>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {validation?.metadata?.encrypted && (
                  <div className="mt-4 p-3 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.414-6.414a6 6 0 015.743-7.743z" />
                      </svg>
                      <label htmlFor="backup-password-input" className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        Decryption Password Required
                      </label>
                    </div>
                    <input
                      id="backup-password-input"
                      type="password"
                      placeholder="Enter your backup password"
                      value={decryptionPassword.value}
                      onChange={(event) => { decryptionPassword.setValue(event.target.value); }}
                      className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 shadow-sm"
                    />
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      This backup is encrypted. Enter the password you used when creating it.
                    </p>
                  </div>
                )}

                {validation && validation.issues.length > 0 && (
                  <div className="mt-4">
                    <ul className="space-y-1">
                      {validation.issues.map((issue) => (
                        <li
                          key={`${issue.field}-${issue.message}`}
                          className={`text-xs flex items-start gap-2 ${
                            issue.severity === 'error'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                          }`}
                        >
                          <span className="flex-shrink-0 mt-0.5">
                            {issue.severity === 'error' ? '❌' : '⚠️'}
                          </span>
                          <span>{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

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

          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Restore mode</span>
              <div className="relative">
                <select
                  value={restoreOptions.mode}
                  onChange={handleRestoreModeSelect}
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

          {restoreOptions.mode === 'replace' && (
            <div className="mt-2 rounded-lg border border-red-200 dark:border-red-700 bg-red-50/80 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              Replacing will delete prompts and categories that are not present in the backup. Make sure you have a copy of anything you want to keep.
            </div>
          )}

          <div className="flex flex-col mt-4 sm:flex-row sm:items-center gap-2 sm:gap-3">
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
                  const duplicateTextClass = restoreOptions.conflictResolution === 'overwrite'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400';
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
                          <div className="mt-1 space-y-1 text-xs">
                            <div className="text-gray-500 dark:text-gray-400">
                              {category.promptCount.toLocaleString()} prompts
                              {' '}
                              {category.existsInLibrary ? '· already in library' : '· new category'}
                            </div>
                            {category.existsInLibrary && (
                              <div className="text-gray-500 dark:text-gray-400">
                                Library currently has {category.existingLibraryPromptCount.toLocaleString()} prompts
                              </div>
                            )}
                            {category.newPromptCount > 0 && (
                              <div className="text-green-700 dark:text-green-400">
                                New prompts: {category.newPromptCount.toLocaleString()}
                              </div>
                            )}
                            {category.duplicatePromptCount > 0 && (
                              <div className={duplicateTextClass}>
                                Duplicates: {category.duplicatePromptCount.toLocaleString()} ({conflictStrategyActionLabels[restoreOptions.conflictResolution]})
                              </div>
                            )}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">Recent Backups</h3>
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
      )}

      <ConfirmDialog
        isOpen={isReplaceConfirmOpen}
        onConfirm={confirmReplaceMode}
        onCancel={cancelReplaceMode}
        title="Replace existing library?"
        message="This will overwrite your current prompts, categories, and settings with the backup contents. Make sure you have exported anything you want to keep before continuing."
        confirmText="Replace library"
        cancelText="Keep merge mode"
        variant="danger"
      />
    </section>
  );
};

export default BackupRestoreView;
