/**
 * Storage quota utilities for proactive quota management
 * Chrome storage.local limit: 5MB (5,242,880 bytes)
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
 * Estimated average sizes for different data types
 * Based on testing with 20K character limit
 */
export const ESTIMATED_SIZES = {
  PROMPT_BASE: 300,           // Base overhead per prompt (ID, timestamps, metadata)
  PROMPT_PER_CHAR: 2,         // Bytes per character (UTF-8 encoding)
  CATEGORY: 100,              // Average category size
  SETTINGS: 500               // Settings object size
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

/**
 * Estimate the size of a prompt in bytes
 *
 * @param title Prompt title
 * @param content Prompt content
 * @param category Category name
 * @returns Estimated size in bytes
 */
export function estimatePromptSize(
  title: string,
  content: string,
  category: string
): number {
  const titleBytes = title.length * ESTIMATED_SIZES.PROMPT_PER_CHAR;
  const contentBytes = content.length * ESTIMATED_SIZES.PROMPT_PER_CHAR;
  const categoryBytes = category.length * ESTIMATED_SIZES.PROMPT_PER_CHAR;

  return ESTIMATED_SIZES.PROMPT_BASE + titleBytes + contentBytes + categoryBytes;
}

/**
 * Estimate the size of an array of prompts
 *
 * @param prompts Array of prompts to estimate
 * @returns Estimated total size in bytes
 */
export function estimatePromptsArraySize(
  prompts: Array<{ title: string; content: string; category: string }>
): number {
  return prompts.reduce((total, prompt) => {
    return total + estimatePromptSize(prompt.title, prompt.content, prompt.category);
  }, 0);
}

/**
 * Calculate maximum number of prompts that can fit in available storage
 * Assumes average prompt size based on 20K character limit
 *
 * @param availableBytes Available storage in bytes
 * @param averagePromptLength Average prompt content length (default: 5000 chars)
 * @returns Estimated maximum number of prompts
 */
export function calculateMaxPrompts(
  availableBytes: number,
  averagePromptLength: number = 5000
): number {
  // Average prompt: base + title (50 chars) + content (avg length) + category (10 chars)
  const avgPromptSize =
    ESTIMATED_SIZES.PROMPT_BASE +
    (50 * ESTIMATED_SIZES.PROMPT_PER_CHAR) +
    (averagePromptLength * ESTIMATED_SIZES.PROMPT_PER_CHAR) +
    (10 * ESTIMATED_SIZES.PROMPT_PER_CHAR);

  return Math.floor(availableBytes / avgPromptSize);
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

/**
 * Get storage statistics and recommendations
 *
 * @param used Current storage usage
 * @param total Total storage quota
 * @returns Storage statistics with recommendations
 */
export function getStorageStats(
  used: number,
  total: number
): {
  percentage: number;
  available: number;
  warningLevel: 'safe' | 'warning' | 'critical' | 'danger';
  recommendation: string;
  estimatedPromptsRemaining: number;
} {
  const percentage = (used / total) * 100;
  const available = total - used;

  let warningLevel: 'safe' | 'warning' | 'critical' | 'danger';
  let recommendation: string;

  if (percentage < QUOTA_THRESHOLDS.SAFE * 100) {
    warningLevel = 'safe';
    recommendation = 'Storage is healthy. You can continue adding prompts.';
  } else if (percentage < QUOTA_THRESHOLDS.WARNING * 100) {
    warningLevel = 'warning';
    recommendation = 'Storage is getting full. Consider deleting unused prompts or exporting data.';
  } else if (percentage < QUOTA_THRESHOLDS.CRITICAL * 100) {
    warningLevel = 'critical';
    recommendation = 'Storage is critically low. Delete prompts soon to avoid issues.';
  } else {
    warningLevel = 'danger';
    recommendation = 'Storage is nearly full! Delete prompts immediately or risk data loss.';
  }

  const estimatedPromptsRemaining = calculateMaxPrompts(available);

  return {
    percentage,
    available,
    warningLevel,
    recommendation,
    estimatedPromptsRemaining
  };
}
