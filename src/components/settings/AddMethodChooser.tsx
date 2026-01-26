import { FC } from 'react';

interface AddMethodChooserProps {
  onManualClick: () => void;
  onImportClick: () => void;
  onCancel: () => void;
}

const AddMethodChooser: FC<AddMethodChooserProps> = ({ onManualClick, onImportClick, onCancel }) => {
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
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
        How would you like to add this site?
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Choose a method to continue</p>
      <div className="grid gap-3 max-w-2xl mx-auto sm:grid-cols-2">
        <button
          type="button"
          onClick={onManualClick}
          className="group flex flex-row items-start gap-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 text-left transition-all hover:border-purple-400 hover:shadow-md dark:hover:border-purple-500"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/60 transition-colors">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Manual Configuration</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Configure hostname, selectors, and positioning yourself
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onImportClick}
          className="group flex flex-row items-start gap-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 text-left transition-all hover:border-purple-400 hover:shadow-md dark:hover:border-purple-500"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/60 transition-colors">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Import Configuration</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Paste a shared code to reuse an existing setup instantly
            </p>
          </div>
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-6 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 underline transition-colors"
      >
        Cancel
      </button>
    </div>
  );
};

export default AddMethodChooser;
