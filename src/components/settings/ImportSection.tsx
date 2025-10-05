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
    <div className="space-y-4">
      {/* Configuration Code Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Configuration Code</h5>
          {value && (
            <button
              type="button"
              onClick={onClear}
              disabled={loading}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:text-gray-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <textarea
          value={value}
          onChange={handleChange}
          placeholder="Paste your configuration code here..."
          rows={4}
          className="w-full resize-y min-h-[120px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          aria-label="Encoded configuration string"
        />

        {error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Configuration codes are validated and sanitized before import to ensure security.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={loading || !value.trim()}
          className="w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Validating...' : 'Preview Configuration'}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 underline transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ImportSection;
