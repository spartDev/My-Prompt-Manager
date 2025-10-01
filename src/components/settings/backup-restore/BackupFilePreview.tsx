import { FC, useState } from 'react';

import type { BackupValidationResult } from '../../../types/backup';

import { formatBytes, formatDate } from './types';

interface BackupFilePreviewProps {
  fileName: string;
  validation: BackupValidationResult | null;
  decryptionPassword: string;
  onPasswordChange: (password: string) => void;
  onClearFile: () => void;
}

/**
 * Backup file preview with metadata, validation status, and password input
 */
const BackupFilePreview: FC<BackupFilePreviewProps> = ({
  fileName,
  validation,
  decryptionPassword,
  onPasswordChange,
  onClearFile
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <div className={`rounded-xl border p-4 ${
      validation?.metadata?.encrypted
        ? 'border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            {validation?.metadata?.encrypted ? (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            ) : (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {fileName.replace(/\.(json)$/i, '')}
              </div>
            </div>
          </div>
          {validation?.metadata?.encrypted && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 w-fit">
              <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                Encrypted backup
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClearFile}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-3"
          aria-label="Clear selected file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {validation?.metadata && (
        <div className="mt-4">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Created</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{formatDate(validation.metadata.createdAt)}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Prompts</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{validation.metadata.promptCount.toLocaleString()}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Categories</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{validation.metadata.categoryCount.toLocaleString()}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Size</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">{formatBytes(validation.metadata.fileSize)}</span>
            </li>
          </ul>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => { setShowTechnicalDetails(!showTechnicalDetails); }}
              className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              aria-expanded={showTechnicalDetails}
            >
              <svg
                className={`w-4 h-4 transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium">
                {showTechnicalDetails ? 'Hide Technical Details' : 'Show Technical Details'}
              </span>
            </button>

            {showTechnicalDetails && (
              <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <h4 className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-3">
                  Technical Information
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Format Version</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium font-mono text-xs">
                      {validation.metadata.version || '1.0.0'}
                    </span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Encryption</span>
                    <span className={`font-medium text-xs ${
                      validation.metadata.encrypted
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {validation.metadata.encrypted ? 'AES-256' : 'None'}
                    </span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Data Integrity</span>
                    <span className="text-green-600 dark:text-green-400 font-medium text-xs">
                      Verified
                    </span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Validation Status</span>
                    <span className={`font-medium text-xs ${
                      validation.valid
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {validation.valid ? 'Valid' : 'Invalid'}
                    </span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Checksum</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium font-mono text-xs">
                      {validation.metadata.checksum ? validation.metadata.checksum.substring(0, 8) + '...' : 'N/A'}
                    </span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">File Type</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">
                      JSON Backup
                    </span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {validation?.metadata?.encrypted && (
        <div className="mt-4 p-3 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.414-6.414a6 6 0 015.743-7.743z" />
            </svg>
            <label htmlFor="backup-password-input" className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Decryption Password Required
            </label>
          </div>
          <input
            id="backup-password-input"
            type="password"
            placeholder="Enter your backup password"
            value={decryptionPassword}
            onChange={(event) => { onPasswordChange(event.target.value); }}
            className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 shadow-sm"
          />
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            This backup is encrypted. Enter the password you used when creating it.
          </p>
        </div>
      )}

      {validation && validation.issues.length > 0 && (
        <div className="mt-4">
          <ul className="space-y-1">
            {validation.issues.map((issue) => (
              <li
                key={`${issue.field}-${issue.message}`}
                className={`text-xs flex items-start gap-2 ${
                  issue.severity === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {issue.severity === 'error' ? '❌' : '⚠️'}
                </span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BackupFilePreview;
