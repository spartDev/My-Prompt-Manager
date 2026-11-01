/**
 * Storage quota utilities for proactive quota management
 * Chrome storage.local limit: 10 MB (10,485,760 bytes) since Chrome 114
 */

/**
 * Storage quota thresholds for different warning levels
 */
export const QUOTA_THRESHOLDS = {
  SAFE: 0.7,      // 70% - Safe to write
  WARNING: 0.85,  // 85% - Show warning
  CRITICAL: 0.95, // 95% - Block non-critical writes
  DANGER: 0.98    // 98% - Block all writes
} as const;

/**
 * Check if there's enough quota available before writing data
 *
 * @param estimatedSize Estimated size of data to be written (in bytes)
 * @param currentUsage Current storage usage (in bytes)
 * @param totalQuota Total storage quota (in bytes)
 * @returns Object with canWrite flag and details
 */
export function checkQuotaAvailability(
  estimatedSize: number,
  currentUsage: number,
  totalQuota: number
): {
  canWrite: boolean;
  available: number;
  afterWrite: number;
  percentageAfterWrite: number;
  reason?: string;
} {
  const available = totalQuota - currentUsage;
  const afterWrite = currentUsage + estimatedSize;
  const percentageAfterWrite = (afterWrite / totalQuota) * 100;

  // Check if write would exceed quota
  if (estimatedSize > available) {
    return {
      canWrite: false,
      available,
      afterWrite,
      percentageAfterWrite,
      reason: `Insufficient storage space. Need ${formatBytes(estimatedSize)} but only ${formatBytes(available)} available.`
    };
  }

  // Check if write would push us into danger zone (98%+)
  if (afterWrite / totalQuota > QUOTA_THRESHOLDS.DANGER) {
    return {
      canWrite: false,
      available,
      afterWrite,
      percentageAfterWrite,
      reason: `Write would exceed safety threshold (98%). Storage would be ${percentageAfterWrite.toFixed(1)}% full.`
    };
  }

  return {
    canWrite: true,
    available,
    afterWrite,
    percentageAfterWrite
  };
}

const utf8 = new TextEncoder();

// Chrome writes these characters as 6-byte \uXXXX escapes in the JSON it stores
const ESCAPED_BY_CHROME = /[<\u2028\u2029]/g;
const escapeLikeChrome = (char: string) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;

// Chrome writes an integer past 32 bits, such as a timestamp, as a double: 1793212345678 becomes
// 1.793212345678e+12, at most 5 bytes longer than its JSON
const DOUBLE_EXTRA_BYTES = 5;
const isStoredAsDouble = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && (value > 2 ** 31 - 1 || value < -(2 ** 31));

/**
 * The bytes `value` takes in chrome.storage.local: the JSON Chrome stores, in UTF-8, as getBytesInUse
 * counts it. It never counts less than Chrome: an integer past 32 bits counts its longest form.
 */
export function storedSize(value: unknown): number {
  let doubles = 0;
  const json = JSON.stringify(value, (_key, item: unknown) => {
    if (isStoredAsDouble(item)) {
      doubles += 1;
    }
    return item;
  });
  return utf8.encode(json.replace(ESCAPED_BY_CHROME, escapeLikeChrome)).length + doubles * DOUBLE_EXTRA_BYTES;
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "1.5 MB", "256 KB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {return '0 B';}

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/** A size as the storage displays show it: "0 Bytes", "1.5 KB", "10 MB" */
const formatStorageSize = (bytes: number): string => {
  if (bytes === 0) {return '0 Bytes';}
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${String(parseFloat((bytes / 1024 ** i).toFixed(2)))} ${sizes[i]}`;
};

/**
 * Chrome storage use as the Settings bar and the storage warning both show it, so they never disagree:
 * the share of the quota in use as a whole percentage, and the two sizes.
 *
 * @param used Bytes in use, as chrome.storage.local.getBytesInUse counts them
 * @param total The quota, chrome.storage.local.QUOTA_BYTES
 */
export function describeStorageUsage(used: number, total: number): { percentage: number; used: string; total: string } {
  return {
    percentage: total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0,
    used: formatStorageSize(used),
    total: formatStorageSize(total)
  };
}
