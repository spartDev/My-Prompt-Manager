import type { FC } from 'react';

import type { SortOrder } from '../../types';
import { SortIcon } from '../icons/SettingsIcons';

import SettingsSection from './SettingsSection';

// Hoisted static JSX - avoids recreation on every render
const LibraryIcon = <SortIcon className="w-5 h-5" />;

// Each sort has one direction (NATURAL_SORT_DIRECTION)
const SORT_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: 'updatedAt', label: 'Recently Updated' },
  { value: 'lastUsedAt', label: 'Recently Used' },
  { value: 'createdAt', label: 'Recently Created' },
  { value: 'usageCount', label: 'Number of Uses' },
  { value: 'title', label: 'Alphabetical (A→Z)' }
];

interface LibrarySectionProps {
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  disabled?: boolean;
}

const LibrarySection: FC<LibrarySectionProps> = ({ sortOrder, onSortOrderChange, disabled = false }) => {
  return (
    <SettingsSection
      icon={LibraryIcon}
      title="Library"
      description="Choose how the Library orders your prompts"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <label
          htmlFor="library-sort-order"
          className="block font-medium text-gray-900 dark:text-gray-100 text-sm mb-2"
        >
          Sort prompts by
        </label>
        <select
          id="library-sort-order"
          value={sortOrder}
          disabled={disabled}
          onChange={(e) => { onSortOrderChange(e.target.value as SortOrder); }}
          aria-describedby="library-sort-order-hint"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {SORT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p id="library-sort-order-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Pinned prompts stay on top. Most Used always ranks by number of uses.
        </p>
      </div>
    </SettingsSection>
  );
};

export default LibrarySection;
