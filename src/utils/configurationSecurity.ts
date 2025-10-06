import DOMPurify from 'dompurify';

import {
  CustomSiteConfiguration,
  CustomSitePositioning,
  ElementFingerprint,
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
      url: '',
      confidence: 'low'
    }
  };

  const primarySource: Partial<ElementFingerprint['primary']> = input.primary ?? {};
  const primaryKeys = ['id', 'dataTestId', 'dataId', 'name', 'ariaLabel'] as const;
  for (const key of primaryKeys) {
    const value = sanitizeTextValue(primarySource[key], 160);
    if (value) {
      sanitized.primary[key] = value;
    }
  }

  const secondarySource: Partial<ElementFingerprint['secondary']> = input.secondary ?? {};
  const secondaryKeys = ['type', 'role', 'placeholder'] as const;
  for (const key of secondaryKeys) {
    const value = sanitizeTextValue(secondarySource[key], 120);
    if (value) {
      sanitized.secondary[key] = value;
    }
  }

  const contentSource: Partial<ElementFingerprint['content']> = input.content ?? {};
  const contentEntries: Array<[keyof ElementFingerprint['content'], number]> = [
    ['textContent', 200],
    ['textHash', 128]
  ];
  for (const [key, maxLength] of contentEntries) {
    const value = sanitizeTextValue(contentSource[key], maxLength);
    if (value) {
      sanitized.content[key] = value;
    }
  }

  if (input.context) {
    const context: Partial<ElementFingerprint['context']> = input.context;
    const contextStringEntries: Array<[Extract<keyof ElementFingerprint['context'], 'parentId' | 'parentDataTestId' | 'parentTagName'>, number]> = [
      ['parentId', 160],
      ['parentDataTestId', 160],
      ['parentTagName', 40]
    ];
    for (const [key, maxLength] of contextStringEntries) {
      const value = sanitizeTextValue(context[key], maxLength);
      if (value) {
        sanitized.context[key] = value;
      }
    }

    const contextNumberKeys = ['siblingIndex', 'siblingCount', 'depth'] as const;
    for (const key of contextNumberKeys) {
      const value = sanitizeNumericValue(context[key]);
      if (value !== undefined) {
        sanitized.context[key] = value;
      }
    }
  }

  sanitized.attributes = sanitizeStringRecord(input.attributes, {
    maxEntries: 20,
    maxKeyLength: 60,
    maxValueLength: 160
  });

  const classPatterns = sanitizeStringArray(input.classPatterns, {
    maxEntries: 20,
    maxItemLength: 80
  });
  if (classPatterns) {
    sanitized.classPatterns = classPatterns;
  }

  const meta: Partial<ElementFingerprint['meta']> = input.meta ?? {};
  const generatedAt = sanitizeNumericValue(meta.generatedAt);
  const metaUrl = sanitizeTextValue(meta.url, 2048);
  const confidence = meta.confidence;

  sanitized.meta = {
    generatedAt: generatedAt ?? Date.now(),
    url: metaUrl ?? '',
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
  const selector = typeof positioning.selector === 'string' ? sanitizeText(positioning.selector) : '';
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
