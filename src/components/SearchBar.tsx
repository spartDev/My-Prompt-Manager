import { memo } from 'react';
import type { FC } from 'react';

import type { SearchBarProps } from '../types/components';

const SearchBar: FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search...'
}) => {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <svg
          className="h-5 w-5 text-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        placeholder={placeholder}
        className="w-full pl-12 pr-12 py-3 bg-card border border-input rounded-xl focus-input text-sm text-primary placeholder:text-tertiary shadow-sm transition-all duration-200"
        aria-label="Search prompts"
        role="searchbox"
      />
      
      {value && (
        <button
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-tertiary hover:text-accent transition-colors focus-interactive rounded-sm"
          aria-label="Clear search"
          title="Clear search"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

// Custom comparison function for React.memo optimization
// Re-render only when value, placeholder changes, or function references change
const arePropsEqual = (prevProps: SearchBarProps, nextProps: SearchBarProps): boolean => {
  // Check if search value changed
  if (prevProps.value !== nextProps.value) {return false;}
  
  // Check if placeholder changed
  if (prevProps.placeholder !== nextProps.placeholder) {return false;}
  
  // Function reference comparison - these should be stable from parent
  if (prevProps.onChange !== nextProps.onChange) {return false;}
  if (prevProps.onClear !== nextProps.onClear) {return false;}
  
  return true;
};

export default memo(SearchBar, arePropsEqual);