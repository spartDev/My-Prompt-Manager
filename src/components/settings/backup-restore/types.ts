import type { ConflictResolutionStrategy, RestoreMode } from '../../../types/backup';

/**
 * Shared constants and types for backup-restore components
 */

export const conflictStrategyLabels: Record<ConflictResolutionStrategy, string> = {
  skip: 'Skip duplicates',
  overwrite: 'Overwrite duplicates',
  rename: 'Rename imported items'
};

export const conflictStrategyActionLabels: Record<ConflictResolutionStrategy, string> = {
  skip: 'will be skipped',
  overwrite: 'will overwrite existing prompts',
  rename: 'will be renamed'
};

export const modeLabels: Record<RestoreMode, string> = {
  merge: 'Merge with existing data',
  replace: 'Replace existing data'
};

/**
 * Format file size in bytes to human-readable format
 */
export const formatBytes = (size: number): string => {
  if (size === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const order = Math.floor(Math.log(size) / Math.log(1024));
  const scaledSize = size / (1024 ** order);
  return `${scaledSize.toFixed(1)} ${units[order]}`;
};

/**
 * Format timestamp to locale string
 */
export const formatDate = (timestamp: number): string => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp.toString();
  }
};

/**
 * Read file content as text
 */
export const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file contents.'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file.'));
    };
    reader.readAsText(file);
  });
};
