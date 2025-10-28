/**
 * Barrel export file for utils
 * Simplifies imports by allowing: import { Logger, toError, debounce } from '../utils'
 */

export { debounce } from './debounce';
export { toError, getErrorMessage } from './error';
export * as Logger from './logger';
export {
  encodeBase64UrlSafe,
  decodeBase64UrlSafe,
  encodeObjectToBase64UrlSafe,
  decodeObjectFromBase64UrlSafe,
  isValidBase64UrlSafe
} from './base64';
export { validatePromptFields, type FieldErrors } from './validation';
export { cn } from './cn';
export { findTextHighlights, type TextHighlight } from './textHighlight';
export {
  QUOTA_THRESHOLDS,
  ESTIMATED_SIZES,
  checkQuotaAvailability,
  estimatePromptSize,
  estimatePromptsArraySize,
  calculateMaxPrompts,
  formatBytes,
  getStorageStats
} from './storageQuota';
export {
  sanitizeConfiguration,
  detectMaliciousContent,
  isSelectorSafe,
  HOSTNAME_PATTERN
} from './configurationSecurity';
