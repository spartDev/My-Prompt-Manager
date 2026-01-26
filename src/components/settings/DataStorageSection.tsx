import { FC, useState, useRef, useMemo } from 'react';

import type { Prompt, Category } from '../../types';
import { Logger, toError } from '../../utils';

import SettingsSection from './SettingsSection';

interface DataStorageSectionProps {
  prompts: Prompt[];
  categories: Category[];
  onImport: (data: { prompts: Prompt[]; categories: Category[] }) => Promise<void>;
  onClearData: () => Promise<void>;
}

const DataStorageSection: FC<DataStorageSectionProps> = ({
  prompts,
  categories,
  onImport,
  onClearData
}) => {
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const icon = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );

  const handleExport = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      prompts,
      categories
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-library-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
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

      // Validate prompt structure
      const invalidPrompt = (typedData.prompts as unknown[]).find((prompt) => {
        if (typeof prompt !== 'object' || prompt === null || Array.isArray(prompt)) {
          return true;
        }
        const p = prompt as Record<string, unknown>;
        if (typeof p.title !== 'string' || typeof p.content !== 'string') {
          return true;
        }
        if (typeof p.category !== 'string') {
          return true;
        }
        return false;
      });

      if (invalidPrompt) {
        throw new Error('Invalid backup file: one or more prompts have invalid structure.');
      }

      // Validate category structure if present
      if (typedData.categories && typedData.categories.length > 0) {
        const invalidCategory = (typedData.categories as unknown[]).find(category => {
          if (typeof category !== 'object' || category === null || Array.isArray(category)) {
            return true;
          }
          const c = category as Record<string, unknown>;
          if (typeof c.name !== 'string') {
            return true;
          }
          return false;
        });

        if (invalidCategory) {
          throw new Error('Invalid backup file: one or more categories have invalid structure.');
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

      // Show more specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Import failed: ${errorMessage}\n\nPlease ensure you are selecting a valid backup file exported from this extension.`);
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

  // Calculate storage usage (rough estimate)
  const storageMax = 5 * 1024 * 1024; // 5MB Chrome storage limit
  const storageUsed = useMemo(
    () => JSON.stringify({ prompts, categories }).length,
    [prompts, categories]
  );
  const storagePercentage = useMemo(
    () => Math.min((storageUsed / storageMax) * 100, 100),
    [storageUsed, storageMax]
  );

  return (
    <SettingsSection
      icon={icon}
      title="Data & Storage"
      description="Manage your prompts and storage"
    >
      <div className="space-y-4">
        {/* Storage Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
              Storage Usage
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {(storageUsed / 1024).toFixed(1)} KB / 5 MB
            </span>
          </div>
          <div data-testid="storage-bar" role="progressbar" aria-valuenow={storagePercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Storage usage" className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300"
              style={{ width: `${storagePercentage.toFixed(1)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{prompts.length} prompts</span>
            <span>{categories.length} categories</span>
          </div>
        </div>

        {/* Export/Import */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
            Backup & Restore
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 focus-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span className="text-sm font-medium">Export</span>
            </button>
            
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border-2 border-purple-600 dark:border-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 focus-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-600 dark:border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Importing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium">Import</span>
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
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Export your prompts as JSON for backup or sharing
          </p>
        </div>

        {/* Clear Data */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">
            Clear Data
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Remove all prompts and categories from local storage
          </p>
          
          {showClearConfirm ? (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  ⚠️ This will permanently delete all your prompts and categories. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleClearData()}
                  disabled={clearing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearing ? 'Clearing...' : 'Yes, Clear All Data'}
                </button>
                <button
                  onClick={() => { setShowClearConfirm(false); }}
                  disabled={clearing}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => void handleClearData()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            >
              Clear All Data
            </button>
          )}
        </div>
      </div>
    </SettingsSection>
  );
};

export default DataStorageSection;