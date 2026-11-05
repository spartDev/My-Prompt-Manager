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
      <div className="bg-card border border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-xs font-semibold text-secondary uppercase tracking-wide">Configuration Code</h5>
          {value && (
            <button
              type="button"
              onClick={onClear}
              disabled={loading}
              className="text-xs font-medium text-tertiary hover:text-primary disabled:text-faint transition-colors"
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
          className="w-full resize-y min-h-[120px] px-3 py-2 text-sm border border-input rounded-lg bg-subtle text-primary placeholder:text-tertiary font-mono focus-input"
          aria-label="Encoded configuration string"
        />

        {error && (
          <div className="mt-3 p-3 bg-danger-subtle border border-danger rounded-lg">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <p className="mt-3 text-xs text-tertiary">
          Configuration codes are validated and sanitized before import to ensure security.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={loading || !value.trim()}
          className="w-full px-4 py-2.5 bg-accent text-on-accent text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Validating...' : 'Preview Configuration'}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          className="text-sm text-secondary hover:text-primary underline transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ImportSection;
