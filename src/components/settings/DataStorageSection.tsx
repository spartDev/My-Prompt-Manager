import { type FC, useCallback, useEffect, useId, useRef, useState } from 'react';

import type { Category, Prompt } from '../../types';
import type {} from '../../types/file-system-access-api';
import type { ShowToast } from '../../types/hooks';
import { findInvalidImportCategory, findInvalidImportPrompt, formatCount, Logger, toError } from '../../utils';
import { describeStorageUsage } from '../../utils/storageQuota';
import { ExportIcon, ImportIcon } from '../icons/SettingsIcons';

import { ROW_BUTTON_CLASSES } from './rowStyles';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';

/** Export and Import: secondary pills, 40px high */
const DATA_BUTTON_CLASSES = 'h-10 flex items-center justify-center gap-2 rounded-full border-[1.5px] border-strong bg-card text-sm font-semibold text-secondary hover:bg-muted transition-colors focus-secondary disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * What the last import left to read at the user's pace: every item it skipped and why, and why it
 * stopped, if it did. A Notification shows one line for a few seconds, too little for a list of titles.
 */
export interface ImportReport {
  /** `key` tells the items apart: the kind and id (or name) of the Prompt or Category */
  skipped: { key: string; label: string; reason: string }[];
  /** Set when an error stopped the import: the Prompts imported before it stay in the Library */
  stopped?: { imported: number; total: number; reason: string };
}

interface DataStorageSectionProps {
  prompts: Prompt[];
  categories: Category[];
  /**
   * Set when Settings could not read the Library: `prompts` and `categories` are then unknown, not
   * empty, so they are not counted and Export is off, which keeps an empty Backup from being saved
   */
  libraryUnavailable?: boolean;
  /** The bytes Chrome stores (getBytesInUse) and its quota (QUOTA_BYTES); null until they are read */
  storageUsage: { used: number; total: number } | null;
  onImport: (data: { prompts: Prompt[]; categories: Category[] }) => Promise<void>;
  /** The last import's report, shown under Import until dismissed; null when there is none */
  importReport?: ImportReport | null;
  onDismissImportReport?: () => void;
  /** Bring Import into view and give it the keyboard, then call onImportFocused */
  focusImport?: boolean;
  onImportFocused?: () => void;
  onClearData: () => Promise<void>;
  onShowToast: ShowToast;
}

const DataStorageSection: FC<DataStorageSectionProps> = ({
  prompts,
  categories,
  libraryUnavailable = false,
  storageUsage,
  onImport,
  importReport = null,
  onDismissImportReport,
  focusImport = false,
  onImportFocused,
  onClearData,
  onShowToast
}) => {
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusImport) {return;}
    importButtonRef.current?.scrollIntoView({ block: 'center' });
    importButtonRef.current?.focus({ preventScroll: true });
    onImportFocused?.();
  }, [focusImport, onImportFocused]);
  const exportHintId = useId();

  const handleExport = useCallback(async () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      prompts,
      categories
    };

    const content = JSON.stringify(data, null, 2);
    const filename = `prompt-library-backup-${new Date().toISOString().split('T')[0]}.json`;

    // Use File System Access API if available (modern browsers)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      } catch (error) {
        // User cancelled the dialog - not an error
        if ((error as Error).name === 'AbortError') {
          return;
        }
        Logger.warn('File System Access API failed, falling back to legacy method', { component: 'DataStorageSection', error: toError(error) });
      }
    }

    // Fallback to legacy DOM manipulation
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [prompts, categories]);

  const handleImportClick = () => {
    // aria-disabled rather than disabled while importing: Chrome takes the keyboard away from a
    // disabled button, and it must come back to Import when the storage warning closes
    if (importing) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      
      // Parse JSON with better error handling
      let data: unknown;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        throw new Error('Invalid JSON format. Please select a valid backup file.');
      }
      
      // Validate the basic structure
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('Invalid backup file: file does not contain valid data structure.');
      }

      // Cast to expected type after basic validation
      const typedData = data as { prompts?: Prompt[]; categories?: Category[]; version?: string; exportDate?: string };

      if (!typedData.prompts || !Array.isArray(typedData.prompts)) {
        throw new Error('Invalid backup file: missing or invalid prompts data.');
      }

      if (typedData.categories && !Array.isArray(typedData.categories)) {
        throw new Error('Invalid backup file: categories data is not in valid format.');
      }

      // Validate prompt structure. The finder returns the offending entry itself, which can be
      // falsy (a null entry), so compare with undefined rather than testing it for truthiness.
      if (findInvalidImportPrompt(typedData.prompts as unknown[]) !== undefined) {
        throw new Error('Invalid backup file: one or more prompts have invalid structure.');
      }

      // Validate category structure if present
      if (typedData.categories && typedData.categories.length > 0) {
        if (findInvalidImportCategory(typedData.categories as unknown[]) !== undefined) {
          throw new Error('Invalid backup file: one or more categories are invalid.');
        }
      }

      await onImport({
        prompts: typedData.prompts,
        categories: typedData.categories || []
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      Logger.error('Import failed', toError(error));

      // An invalid file says so in its message; any other failure is not blamed on the file. An
      // import stopped by storage never reaches here: Settings opens the storage warning for it.
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      onShowToast('Import failed', 'error', { sub: errorMessage });
    } finally {
      setImporting(false);
    }
  };

  const handleClearData = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setClearing(true);
    try {
      await onClearData();
      setShowClearConfirm(false);
    } catch (error) {
      Logger.error('Failed to clear data', toError(error));
    } finally {
      setClearing(false);
    }
  };

  // What Chrome stores for every key (Prompts, Categories, usage history, settings), against its quota
  const usage = storageUsage ? describeStorageUsage(storageUsage.used, storageUsage.total) : null;

  return (
    <SettingsGroup label="Your data">
      {/* Storage: what Chrome stores, and what the Library holds */}
      <SettingsRow
        label="Stored on this device"
        control={usage && (
          <span className="text-[12.5px] font-semibold text-tertiary">
            {usage.used} of {usage.total}
          </span>
        )}
      >
        <div data-testid="storage-bar" role="progressbar" aria-valuenow={usage?.percentage} aria-valuemin={0} aria-valuemax={100} aria-label="Storage usage" className="mt-2 w-full h-2 bg-subtle rounded-full overflow-hidden">
          {/* Grows from the left once, on arrival; then follows each write */}
          <div
            className="h-full bg-accent rounded-full origin-left animate-fill-grow transition-[width] duration-(--duration-track)"
            style={{ width: `${String(usage?.percentage ?? 0)}%` }}
          />
        </div>
        {libraryUnavailable ? (
          <p className="mt-2 text-xs font-medium text-danger">The Library could not be read</p>
        ) : (
          <p className="mt-2 text-[11.5px] text-tertiary">
            {formatCount(prompts.length, 'prompt', 'prompts')} · {formatCount(categories.length, 'category', 'categories')}
          </p>
        )}
      </SettingsRow>

      {/* Backup: Export and Import */}
      <div className="py-2.5 pr-2.5 pl-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={libraryUnavailable}
            aria-describedby={libraryUnavailable ? exportHintId : undefined}
            className={DATA_BUTTON_CLASSES}
          >
            <ExportIcon />
            Export
          </button>
          <button
            ref={importButtonRef}
            type="button"
            onClick={handleImportClick}
            aria-disabled={importing}
            className={`${DATA_BUTTON_CLASSES} aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`}
          >
            {importing ? (
              <>
                <span aria-hidden="true" className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <ImportIcon />
                Import
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
        </div>
        {libraryUnavailable && (
          <p id={exportHintId} className="mt-2 text-xs text-danger">
            Export is off: the Library could not be read. Leave Settings and open it again to retry.
          </p>
        )}

        {importReport && (
          <div
            role="status"
            aria-label="Import report"
            className={`mt-3 rounded-lg border p-3 text-xs ${importReport.stopped ? 'bg-danger-subtle border-danger' : 'bg-warning-subtle border-warning'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                {importReport.stopped && (
                  <>
                    <p className="font-medium text-danger">
                      The import stopped: {importReport.stopped.imported} of {formatCount(importReport.stopped.total, 'prompt was', 'prompts were')} imported.
                    </p>
                    <p className="text-primary break-words">{importReport.stopped.reason}</p>
                  </>
                )}
                {importReport.skipped.length > 0 && (
                  <p className="font-medium text-warning">
                    Skipped {formatCount(importReport.skipped.length, 'item', 'items')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onDismissImportReport}
                aria-label="Dismiss import report"
                className="shrink-0 rounded p-0.5 text-secondary hover:text-primary focus-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {importReport.skipped.length > 0 && (
              <ul className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                {importReport.skipped.map((item) => (
                  <li key={item.key} className="break-words text-secondary">
                    <span className="font-medium text-primary">&quot;{item.label}&quot;</span>
                    {' '}
                    <span>{item.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Clear all data: deletes every Prompt and Category, after a confirmation */}
      <SettingsRow
        label={<span className="text-danger">Clear all data</span>}
        control={showClearConfirm ? undefined : (
          <button type="button" onClick={() => void handleClearData()} className={ROW_BUTTON_CLASSES}>
            Clear All Data
          </button>
        )}
      >
        {showClearConfirm && (
          <div className="mt-2 space-y-2">
            <div className="p-3 bg-danger-subtle border border-danger rounded-lg">
              <p className="text-sm text-danger">
                ⚠️ This will permanently delete all your prompts and categories. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleClearData()}
                disabled={clearing}
                className="flex-1 h-10 px-4 bg-danger hover:bg-danger-hover text-on-accent text-sm font-semibold rounded-full transition-colors focus-danger disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? 'Clearing...' : 'Yes, Clear All Data'}
              </button>
              <button
                type="button"
                onClick={() => { setShowClearConfirm(false); }}
                disabled={clearing}
                className="flex-1 h-10 px-4 bg-card text-secondary text-sm font-semibold border-[1.5px] border-strong rounded-full hover:bg-muted transition-colors focus-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SettingsRow>
    </SettingsGroup>
  );
};

export default DataStorageSection;