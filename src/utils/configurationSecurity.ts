import DOMPurify from 'dompurify';

import {
  CustomSiteConfiguration,
  CustomSitePositioning,
  SecurityWarning
} from '../types';

const MAX_OFFSET = 500;
const MAX_Z_INDEX = 2147483647;
export const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const UNSAFE_SELECTOR_PATTERNS: RegExp[] = [
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /expression\s*\(/i,
  /behaviour\s*:/i,
  /url\s*\(\s*["']?\s*javascript:/i,
  /[`]/,
  /on[a-z]+\s*=\s*/i,
  /</
];

const CONTROL_CHARACTER_PATTERN = /[\r\n\t]/;
const NULL_CHARACTER = String.fromCharCode(0);

const sanitizeText = (value: string): string => {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
};

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, min), max);
};

const sanitizePositioning = (positioning: CustomSitePositioning): CustomSitePositioning => {
  const selector = sanitizeText(positioning.selector);
  const sanitized: CustomSitePositioning = {
    mode: 'custom',
    selector,
    placement: positioning.placement,
    offset: positioning.offset ? {
      x: clampNumber(positioning.offset.x, -MAX_OFFSET, MAX_OFFSET),
      y: clampNumber(positioning.offset.y, -MAX_OFFSET, MAX_OFFSET)
    } : undefined,
    zIndex: positioning.zIndex !== undefined ? clampNumber(positioning.zIndex, 0, MAX_Z_INDEX) : undefined,
    description: positioning.description ? sanitizeText(positioning.description).slice(0, 160) : undefined
  };

  if (sanitized.offset && sanitized.offset.x === 0 && sanitized.offset.y === 0) {
    delete sanitized.offset;
  }

  if (sanitized.selector.length === 0) {
    delete sanitized.selector;
  }

  if (sanitized.zIndex === 0) {
    delete sanitized.zIndex;
  }

  return sanitized;
};

export const isSelectorSafe = (selector: string): boolean => {
  if (!selector || selector.trim().length === 0) {
    return false;
  }

  if (selector.length > 300) {
    return false;
  }

  if (CONTROL_CHARACTER_PATTERN.test(selector) || selector.includes(NULL_CHARACTER)) {
    return false;
  }

  return !UNSAFE_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector));
};

export const sanitizeConfiguration = (config: CustomSiteConfiguration): CustomSiteConfiguration => {
  const hostname = sanitizeText(config.hostname).toLowerCase();
  const displayName = sanitizeText(config.displayName).slice(0, 80);

  const sanitizedConfig: CustomSiteConfiguration = {
    hostname,
    displayName
  };

  if (config.positioning) {
    sanitizedConfig.positioning = sanitizePositioning(config.positioning);
  }

  return sanitizedConfig;
};

export const detectMaliciousContent = (config: CustomSiteConfiguration): SecurityWarning[] => {
  const warnings: SecurityWarning[] = [];

  if (!HOSTNAME_PATTERN.test(config.hostname)) {
    warnings.push({
      field: 'hostname',
      message: 'Hostname does not look like a valid public domain.',
      severity: 'error'
    });
  }

  if (config.positioning?.selector && !isSelectorSafe(config.positioning.selector)) {
    warnings.push({
      field: 'positioning.selector',
      message: 'Selector contains potentially unsafe patterns.',
      severity: 'error'
    });
  }

  if (config.positioning?.description && config.positioning.description.length > 160) {
    warnings.push({
      field: 'positioning.description',
      message: 'Description is too long and was truncated for safety.',
      severity: 'warning'
    });
  }

  return warnings;
};
