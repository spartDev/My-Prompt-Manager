import { FC, useState, useRef } from 'react';

import type { Prompt, Category } from '../../types';

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
      const data = JSON.parse(text) as { prompts?: Prompt[]; categories?: Category[] };
      
      if (!data.prompts || !Array.isArray(data.prompts)) {
        throw new Error('Invalid backup file: missing prompts data');
      }

      await onImport({
        prompts: data.prompts,
        categories: data.categories || []
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import data. Please check the file format.');
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
      console.error('Failed to clear data:', error);
    } finally {
      setClearing(false);
    }
  };

  // Calculate storage usage (rough estimate)
  const storageUsed = JSON.stringify({ prompts, categories }).length;
  const storageMax = 5 * 1024 * 1024; // 5MB Chrome storage limit
  const storagePercentage = Math.min((storageUsed / storageMax) * 100, 100);

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
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
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