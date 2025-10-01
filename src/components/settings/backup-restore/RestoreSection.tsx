import { ChangeEvent, FC, useCallback, useMemo, useRef, useState } from 'react';

import { useSecurePassword } from '../../../hooks/useSecurePassword';
import { backupManager } from '../../../services/backupManager';
import { ErrorType } from '../../../types';
import type {
  BackupPreview,
  BackupPreviewCategory,
  BackupValidationResult,
  ConflictResolutionStrategy,
  RestoreMode,
  RestoreOptions,
  RestoreSummary
} from '../../../types/backup';
import ConfirmDialog from '../../ConfirmDialog';

import BackupFilePreview from './BackupFilePreview';
import CategorySelector from './CategorySelector';
import { conflictStrategyLabels, modeLabels, readFileContent } from './types';

interface RestoreSectionProps {
  onRestoreCompleted?: (summary: RestoreSummary) => void;
  onStorageUsageRefresh?: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const initialRestoreOptions: RestoreOptions = {
  mode: 'merge',
  conflictResolution: 'skip',
  selectedCategoryIds: []
};

/**
 * Restore section with file upload, preview, and selective restore
 */
const RestoreSection: FC<RestoreSectionProps> = ({
  onRestoreCompleted,
  onStorageUsageRefresh,
  onShowToast
}) => {
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

  const decryptionPassword = useSecurePassword();

  const fileInputId = 'backup-restore-file-input';

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFileName('');
    setValidation(null);
    setPreview(null);
    setRestoreError(null);
    setRestoreOptions(initialRestoreOptions);
    fileContentRef.current = '';
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        if (onShowToast) {
          onShowToast('This backup is encrypted. Enter the password to preview or restore.', 'info');
        }
      }

      if (!validationResult.valid) {
        const blockingIssue = validationResult.issues.find((issue) => issue.severity === 'error');
        if (blockingIssue && onShowToast) {
          onShowToast(blockingIssue.message, 'error');
        }
      }

      fileContentRef.current = content;
    } catch (error) {
      if (onShowToast) {
        onShowToast(error instanceof Error ? error.message : 'Failed to read backup file.', 'error');
      }
    }
  };

  const handlePreview = async () => {
    const content = fileContentRef.current;
    if (!content) {
      if (onShowToast) {
        onShowToast('Select a backup file before previewing.', 'info');
      }
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
      if (onShowToast) {
        onShowToast('Preview generated successfully.', 'success');
      }
    } catch (error) {
      if (onShowToast) {
        onShowToast(error instanceof Error ? error.message : 'Failed to preview backup.', 'error');
      }
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
      if (onShowToast) {
        onShowToast('Select and preview a backup before restoring.', 'info');
      }
      return;
    }

    if (preview && restoreOptions.selectedCategoryIds.length === 0) {
      if (onShowToast) {
        onShowToast('Select at least one category to restore.', 'info');
      }
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreError(null);

      const restoreOptionsWithPassword: RestoreOptions = {
        ...restoreOptions,
        password: decryptionPassword.isEmpty() ? undefined : decryptionPassword.value
      };

      const summary = await backupManager.restoreBackup(content, restoreOptionsWithPassword);
      const importedCount = summary.importedPrompts.toLocaleString();
      const updatedCount = summary.updatedPrompts.toLocaleString();
      const skippedCount = summary.skippedPrompts.toLocaleString();

      if (onShowToast) {
        onShowToast(
          `Restore completed: ${importedCount} prompts added, ${updatedCount} updated, ${skippedCount} skipped.`,
          'success'
        );
      }

      if (onRestoreCompleted) {
        onRestoreCompleted(summary);
      }

      handleClearFile();

      if (onStorageUsageRefresh) {
        onStorageUsageRefresh();
      }

      decryptionPassword.clear();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore backup.';
      if (onShowToast) {
        onShowToast(errorMessage, 'error');
      }
      console.error('[RestoreSection] Restore failed', error);

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

  return (
    <>
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
            <BackupFilePreview
              fileName={selectedFileName}
              validation={validation}
              decryptionPassword={decryptionPassword.value}
              onPasswordChange={decryptionPassword.setValue}
              onClearFile={handleClearFile}
            />
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

        <div className="grid gap-3 sm:grid-cols-2 mt-4">
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
          <div className="mt-4">
            <CategorySelector
              preview={preview}
              selectedCategoryIds={restoreOptions.selectedCategoryIds}
              conflictResolution={restoreOptions.conflictResolution}
              onToggleCategory={handleToggleCategory}
            />
          </div>
        )}
      </div>

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
    </>
  );
};

export default RestoreSection;
