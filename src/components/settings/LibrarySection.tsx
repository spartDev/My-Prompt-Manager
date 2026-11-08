import type { FC } from 'react';

import type { SortOrder } from '../../types';

import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';

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

/** The Library group: how the Library orders the Prompts */
const LibrarySection: FC<LibrarySectionProps> = ({ sortOrder, onSortOrderChange, disabled = false }) => (
  <SettingsGroup label="Library">
    <SettingsRow
      label="Sort prompts by"
      labelFor="library-sort-order"
      control={
        <select
          id="library-sort-order"
          value={sortOrder}
          disabled={disabled}
          onChange={(e) => { onSortOrderChange(e.target.value as SortOrder); }}
          className="h-[34px] max-w-[186px] pl-3 pr-2 text-[12.5px] font-semibold border border-input rounded-full bg-subtle text-primary focus-input cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {SORT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      }
    />
  </SettingsGroup>
);

export default LibrarySection;
