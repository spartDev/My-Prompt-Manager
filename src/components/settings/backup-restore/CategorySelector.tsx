import { FC } from 'react';

import type { BackupPreview, BackupPreviewCategory, ConflictResolutionStrategy } from '../../../types/backup';

import { conflictStrategyActionLabels } from './types';

interface CategorySelectorProps {
  preview: BackupPreview;
  selectedCategoryIds: string[];
  conflictResolution: ConflictResolutionStrategy;
  onToggleCategory: (category: BackupPreviewCategory) => void;
}

/**
 * Category selection component for selective restore
 */
const CategorySelector: FC<CategorySelectorProps> = ({
  preview,
  selectedCategoryIds,
  conflictResolution,
  onToggleCategory
}) => {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Select Categories</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {preview.categories.map((category) => {
          const selected = selectedCategoryIds.includes(category.id);
          const checkboxId = `${category.id}-restore-option`;
          const labelId = `${category.id}-restore-label`;
          const duplicateTextClass = conflictResolution === 'overwrite'
            ? 'text-red-600 dark:text-red-400'
            : 'text-yellow-600 dark:text-yellow-400';
          return (
            <div key={category.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
              <div className="flex items-start gap-2">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={selected}
                  onChange={() => { onToggleCategory(category); }}
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
                        Duplicates: {category.duplicatePromptCount.toLocaleString()} ({conflictStrategyActionLabels[conflictResolution]})
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
  );
};

export default CategorySelector;
