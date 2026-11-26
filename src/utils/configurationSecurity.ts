import DOMPurify from 'dompurify';

import type {
  CustomSiteConfiguration,
  CustomSitePositioning,
  ElementFingerprint,
  SecurityWarning
} from '../types';

import { keepsAttribute, keepsIdentifier, keepsLabel, MAX_SELECTOR_LENGTH, selectorKeepsOnlyKeptValues } from './pickedValues';

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

const sanitizeTextValue = (value: unknown, maxLength = 200): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const sanitized = sanitizeText(value).slice(0, maxLength);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeNumericValue = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

const sanitizeStringRecord = (
  value: unknown,
  { maxEntries, maxKeyLength, maxValueLength }: { maxEntries: number; maxKeyLength: number; maxValueLength: number }
): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => typeof key === 'string')
    .slice(0, maxEntries)
    .map(([key, rawValue]) => {
      const sanitizedKey = sanitizeTextValue(key, maxKeyLength);
      const sanitizedValue = sanitizeTextValue(rawValue, maxValueLength);

      if (!sanitizedKey || !sanitizedValue) {
        return null;
      }

      return [sanitizedKey, sanitizedValue] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  return Object.fromEntries(entries);
};

const sanitizeStringArray = (
  value: unknown,
  { maxEntries, maxItemLength }: { maxEntries: number; maxItemLength: number }
): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sanitized = value
    .map(item => sanitizeTextValue(item, maxItemLength))
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxEntries);

  if (sanitized.length === 0) {
    return undefined;
  }

  return Array.from(new Set(sanitized)).sort();
};

/**
 * The fingerprint a configuration code holds, going out or coming in: only what a pick keeps now
 * (src/utils/pickedValues.ts). A fingerprint stored or shared before ticket My-Prompt-Manager-je37
 * can hold the page's address, the element's text (which can be the user's draft) and values that
 * are not identifiers: none of them is kept.
 */
const sanitizeFingerprint = (fingerprint: unknown): ElementFingerprint | undefined => {
  if (!fingerprint || typeof fingerprint !== 'object' || Array.isArray(fingerprint)) {
    return undefined;
  }

  const input = fingerprint as Partial<ElementFingerprint> & {
    primary?: Partial<ElementFingerprint['primary']>;
    secondary?: Partial<ElementFingerprint['secondary']>;
    content?: Partial<ElementFingerprint['content']>;
    context?: Partial<ElementFingerprint['context']>;
    attributes?: Record<string, unknown>;
    classPatterns?: unknown;
    meta?: Partial<ElementFingerprint['meta']>;
  };

  const tagName = sanitizeTextValue(input.secondary?.tagName, 40);
  if (!tagName) {
    return undefined;
  }

  const sanitized: ElementFingerprint = {
    primary: {},
    secondary: {
      tagName
    },
    content: {},
    context: {},
    attributes: {},
    meta: {
      generatedAt: Date.now(),
      confidence: 'low'
    }
  };

  const primarySource: Partial<ElementFingerprint['primary']> = input.primary ?? {};
  const primaryKeys = ['id', 'dataTestId', 'dataId', 'name'] as const;
  for (const key of primaryKeys) {
    const value = sanitizeTextValue(primarySource[key], 160);
    if (keepsIdentifier(value)) {
      sanitized.primary[key] = value;
    }
  }
  const ariaLabel = sanitizeTextValue(primarySource.ariaLabel, 160);
  if (keepsLabel(ariaLabel)) {
    sanitized.primary.ariaLabel = ariaLabel;
  }

  const secondarySource: Partial<ElementFingerprint['secondary']> = input.secondary ?? {};
  const secondaryKeys = ['type', 'role'] as const;
  for (const key of secondaryKeys) {
    const value = sanitizeTextValue(secondarySource[key], 120);
    if (value) {
      sanitized.secondary[key] = value;
    }
  }
  const placeholder = sanitizeTextValue(secondarySource.placeholder, 120);
  if (keepsLabel(placeholder)) {
    sanitized.secondary.placeholder = placeholder;
  }

  // The element's text is never kept: `content` stays empty

  if (input.context) {
    const context: Partial<ElementFingerprint['context']> = input.context;
    const contextIdentifierKeys = ['parentId', 'parentDataTestId'] as const;
    for (const key of contextIdentifierKeys) {
      const value = sanitizeTextValue(context[key], 160);
      if (keepsIdentifier(value)) {
        sanitized.context[key] = value;
      }
    }
    const parentTagName = sanitizeTextValue(context.parentTagName, 40);
    if (parentTagName) {
      sanitized.context.parentTagName = parentTagName;
    }

    const contextNumberKeys = ['siblingIndex', 'siblingCount', 'depth'] as const;
    for (const key of contextNumberKeys) {
      const value = sanitizeNumericValue(context[key]);
      if (value !== undefined) {
        sanitized.context[key] = value;
      }
    }
  }

  sanitized.attributes = Object.fromEntries(
    Object.entries(sanitizeStringRecord(input.attributes, {
      maxEntries: 20,
      maxKeyLength: 60,
      maxValueLength: 160
    })).filter(([name, value]) => keepsAttribute(name, value))
  );

  const classPatterns = sanitizeStringArray(input.classPatterns, {
    maxEntries: 20,
    maxItemLength: 80
  });
  if (classPatterns) {
    sanitized.classPatterns = classPatterns;
  }

  // The page's address is never kept: `meta` holds no `url`
  const meta: Partial<ElementFingerprint['meta']> = input.meta ?? {};
  const generatedAt = sanitizeNumericValue(meta.generatedAt);
  const confidence = meta.confidence;

  sanitized.meta = {
    generatedAt: generatedAt ?? Date.now(),
    confidence: confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'low'
  };

  return sanitized;
};

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, min), max);
};

const sanitizePositioning = (positioning: CustomSitePositioning): CustomSitePositioning => {
  const typed = typeof positioning.selector === 'string' ? sanitizeText(positioning.selector) : '';
  // A selector a pick stored before ticket My-Prompt-Manager-je37 can name a value of the page (an id
  // that is a token, a draft copied into an attribute): it is left out, and only the fingerprint can
  // place the button. With no fingerprint either, the configuration has no element and is refused.
  // A selector longer than isSelectorSafe allows is kept as it is, unread, and refused as unsafe
  const selector = typed.length > MAX_SELECTOR_LENGTH || selectorKeepsOnlyKeptValues(typed) ? typed : '';
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

  const fingerprint = sanitizeFingerprint(positioning.fingerprint);
  if (fingerprint) {
    sanitized.fingerprint = fingerprint;
  }

  if (sanitized.offset && sanitized.offset.x === 0 && sanitized.offset.y === 0) {
    delete sanitized.offset;
  }

  if (sanitized.selector && sanitized.selector.length === 0) {
    // Don't delete selector as it's required, set to empty string instead
    sanitized.selector = '';
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

  if (selector.length > MAX_SELECTOR_LENGTH) {
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
