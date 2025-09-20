import type { ChangeEvent, FC } from 'react';

interface ImportSectionProps {
  value: string;
  onChange: (value: string) => void;
  onPreview: () => void;
  onClear: () => void;
  loading?: boolean;
  error?: string | null;
}

const ImportSection: FC<ImportSectionProps> = ({
  value,
  onChange,
  onPreview,
  onClear,
  loading = false,
  error = null
}) => {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Import Configuration</h4>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            Paste a configuration code shared by another user to preview before importing.
          </p>
        </div>
        {value && (
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:text-gray-400"
          >
            Clear
          </button>
        )}
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        placeholder="Enter configuration code here"
        rows={3}
        className="mt-3 w-full resize-y min-h-[96px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        aria-label="Encoded configuration string"
      />

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={loading || !value.trim()}
          className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            loading || !value.trim()
              ? 'bg-purple-200 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
          }`}
        >
          {loading ? 'Validating...' : 'Preview Configuration'}
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          We will validate and sanitize configs before they are saved.
        </p>
      </div>
    </div>
  );
};

export default ImportSection;
