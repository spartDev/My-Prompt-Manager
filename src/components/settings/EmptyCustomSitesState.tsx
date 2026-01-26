import { FC } from 'react';

interface EmptyCustomSitesStateProps {
  onAddClick: () => void;
  addActionDisabled?: boolean;
  addFirstSiteTooltip?: string;
  addFirstSiteLabel?: string;
}

const EmptyCustomSitesState: FC<EmptyCustomSitesStateProps> = ({
  onAddClick,
  addActionDisabled = false,
  addFirstSiteTooltip = 'Add your first custom site',
  addFirstSiteLabel = 'Add Your First Site',
}) => {
  return (
    <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
      <svg
        className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No custom sites added</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Add any website to use your prompt library there</p>
      <button
        onClick={onAddClick}
        disabled={addActionDisabled}
        className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          addActionDisabled
            ? 'bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
            : 'bg-purple-600 text-white hover:bg-purple-700'
        }`}
        title={addFirstSiteTooltip}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {addFirstSiteLabel}
      </button>
    </div>
  );
};

export default EmptyCustomSitesState;
