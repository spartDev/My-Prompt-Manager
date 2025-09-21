import type { FC } from 'react';

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const ExportButton: FC<ExportButtonProps> = ({ onClick, disabled = false, loading = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
      disabled
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
        : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
    }`}
    aria-label={loading ? 'Exporting configuration' : 'Export custom site configuration'}
  >
    {loading ? (
      <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M8.757 15.243l-2.121 2.121m0-12.728l2.121 2.121m8.486 8.486l2.121 2.121" />
      </svg>
    ) : (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 12l-4-4m0 0l-4 4m4-4v12" />
      </svg>
    )}
    {loading ? 'Copying...' : 'Export'}
  </button>
);

export default ExportButton;
