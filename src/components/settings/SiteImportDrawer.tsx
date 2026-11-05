import type { FC } from 'react';

import ImportSection from './ImportSection';

interface SiteImportDrawerProps {
  importCode: string;
  onImportCodeChange: (value: string) => void;
  onPreview: () => void;
  onClear: () => void;
  loading?: boolean;
  error: string | null;
}

const SiteImportDrawer: FC<SiteImportDrawerProps> = ({
  importCode,
  onImportCodeChange,
  onPreview,
  onClear,
  loading = false,
  error,
}) => {
  return (
    <div
      id="custom-site-import-drawer"
      className="py-8 px-4 bg-raised border-2 border-dashed border-strong rounded-lg"
    >
      <div className="text-center mb-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent mb-3">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <h4 className="text-sm font-medium text-primary mb-1">
          Import Configuration
        </h4>
        <p className="text-xs text-tertiary">
          Reuse an existing setup by pasting a configuration code
        </p>
      </div>
      <div className="max-w-2xl mx-auto">
        <ImportSection
          value={importCode}
          onChange={(value) => {
            onImportCodeChange(value);
          }}
          onPreview={onPreview}
          onClear={onClear}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
};

export default SiteImportDrawer;
